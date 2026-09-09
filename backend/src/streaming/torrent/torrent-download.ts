import { EventEmitter } from "node:events";
import { Logger } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { openSync, readSync, closeSync } from "node:fs";
import type { Readable } from "node:stream";
import type { Socket } from "node:net";
import { join } from "node:path";
import type { TorrentMetadata, TorrentFileEntry } from "./metadata/torrent-metadata";
import type { MagnetLink } from "./metadata/from-magnet";
import { parseMagnetUri, metadataFromUtPayload } from "./metadata/from-magnet";
import { loadTorrentFromUrl, parseTorrentBuffer } from "./metadata/from-torrent-file";
import { announceAllTrackers, type PeerAddress } from "./tracker/tracker-client";
import { DhtClient } from "./dht/dht-client";
import { PeerConnection, MAX_PEER_PIPELINE } from "./peer/peer-connection";
import { peerListener } from "./peer/peer-listener";
import { BLOCK_SIZE } from "./peer/messages";
import { PiecePicker } from "./piece/piece-picker";
import { PieceStore, STREAM_PRIORITY_WINDOW } from "./piece/piece-store";
import type { PlaybackDebug } from "../interfaces";
const VIDEO_EXTENSIONS = [".mp4", ".mkv", ".avi", ".webm", ".mov"];
/** Concurrent outbound+inbound peer connections (B1). */
const MAX_PEERS = 90;
/** Preferred BitTorrent listen port (fallback to next free / ephemeral). */
const PREFERRED_LISTEN_PORT = 6881;
/** Hard cap while probing for a complete moov atom. */
const PLAYBACK_PREFIX_MAX = 8 * 1024 * 1024;
/** Extra mdat after moov before opening the player (first frames). */
const PLAYBACK_MDAT_SLACK = 512 * 1024;
/** How many prefix pieces may be requested in parallel before canPlay. */
const PREFIX_PARALLEL_PIECES = 4;
/** After canPlay: pieces ahead of the HTTP read cursor (B4 / torrent-stream-like). */
const STREAM_AHEAD_PIECES = 8;
/** torrent-stream critical window: ~1MB ahead of the read cursor, max 2 pieces. */
const CRITICAL_BYTES = 1024 * 1024;
/** How many peers we keep unchoked for upload (tit-for-tat slots). */
const MAX_UPLOAD_SLOTS = 4;
/** Cap concurrent disk→wire upload serves so streaming stays responsive. */
const MAX_UPLOAD_INFLIGHT = 12;
/** Drop peers that stay choked this long (B1 rotation). */
const CHOKE_EVICT_MS = 30_000;
/** Drop peers with no useful bitfield after this long. */
const USELESS_PEER_MS = 25_000;
/** Magnet ut_metadata: search trackers+DHT this long, then give up. */
const METADATA_DEADLINE_MS = 90_000;
const METADATA_REANNOUNCE_MS = 20_000;
const METADATA_MAX_PEERS = 40;
const log = new Logger("TorrentDownload");

/** Inspect a contiguous MP4 prefix: ready once ftyp+moov are fully present. */
function analyzeMp4Prefix(buf: Buffer): {
    complete: boolean;
    needBytes: number;
    moovAtEnd: boolean;
    hasFtyp: boolean;
} {
    if (buf.length < 8)
        return { complete: false, needBytes: 64, moovAtEnd: false, hasFtyp: false };
    const hasFtyp = buf.subarray(4, 8).toString("ascii") === "ftyp";
    if (!hasFtyp) {
        // Matroska / WebM — small head is enough to open
        if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3)
            return { complete: buf.length >= 256 * 1024, needBytes: 256 * 1024, moovAtEnd: false, hasFtyp: false };
        if (buf.subarray(0, 4).toString("ascii") === "RIFF")
            return { complete: buf.length >= 128 * 1024, needBytes: 128 * 1024, moovAtEnd: false, hasFtyp: false };
        return { complete: false, needBytes: Math.min(buf.length + 256 * 1024, PLAYBACK_PREFIX_MAX), moovAtEnd: false, hasFtyp: false };
    }
    let off = 0;
    while (off + 8 <= buf.length) {
        let size = buf.readUInt32BE(off);
        const typ = buf.subarray(off + 4, off + 8).toString("ascii");
        if (size === 1) {
            if (off + 16 > buf.length)
                return { complete: false, needBytes: off + 16, moovAtEnd: false, hasFtyp: true };
            size = Number(buf.readBigUInt64BE(off + 8));
        }
        else if (size === 0) {
            // extends to EOF — treat as incomplete for prefix purposes
            break;
        }
        if (size < 8)
            break;
        if (typ === "moov") {
            const moovEnd = off + size;
            if (moovEnd > buf.length)
                return { complete: false, needBytes: moovEnd, moovAtEnd: false, hasFtyp: true };
            return { complete: true, needBytes: moovEnd, moovAtEnd: false, hasFtyp: true };
        }
        // Reaching mdat means moov did not come first, so the index sits at the
        // end of the file and no prefix will ever hold it.
        if (typ === "mdat")
            return { complete: false, needBytes: 0, moovAtEnd: true, hasFtyp: true };
        off += size;
    }
    return {
        complete: false,
        needBytes: Math.min(Math.max(off + 64 * 1024, buf.length + 256 * 1024), PLAYBACK_PREFIX_MAX),
        moovAtEnd: false,
        hasFtyp: true,
    };
}
export type TorrentSource = {
    kind: "file";
    url: string;
} | {
    kind: "magnet";
    uri: string;
} | {
    kind: "buffer";
    data: Buffer;
};
export interface TorrentFileHandle {
    name: string;
    path: string;
    length: number;
    createReadStream: (opts?: {
        start?: number;
        end?: number;
    }) => Readable;
}
export class TorrentDownload extends EventEmitter {
    private metadata: TorrentMetadata | null = null;
    private store: PieceStore | null = null;
    private picker: PiecePicker | null = null;
    private peers: PeerConnection[] = [];
    private readonly connectedAddrs = new Set<string>();
    private readonly seenAddrs = new Set<string>();
    private peerQueue: PeerAddress[] = [];
    private readonly peerId = randomBytes(20);
    private announceTimer: ReturnType<typeof setInterval> | null = null;
    private requestLoopTimer: ReturnType<typeof setInterval> | null = null;
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private dhtTimer: ReturnType<typeof setInterval> | null = null;
    private pexTimer: ReturnType<typeof setInterval> | null = null;
    private uploadTimer: ReturnType<typeof setInterval> | null = null;
    private dht: DhtClient | null = null;
    private metadataAbort: (() => void) | null = null;
    private readonly inFlightBlocks = new Set<string>();
    private destroyed = false;
    private videoFile: TorrentFileEntry | null = null;
    private downloadDir = "";
    private status: "starting" | "downloading" | "ready" | "error" = "starting";
    private cachedCanPlay = false;
    private needsMoovTail: boolean | null = null;
    /** Bytes from video start required for playback (learned from moov size when possible). */
    private playbackNeedBytes: number | null = null;
    private startedAt = 0;
    private announceStartedSent = false;
    private hashFails = 0;
    private blocksReceived = 0;
    private bytesUploaded = 0;
    private uploadInFlight = 0;
    /** Bound TCP port advertised to trackers (0 until listen starts). */
    private listenPort = 0;
    /** Global byte offset the HTTP pump is currently waiting on (torrent space). */
    private streamReadCursor: number | null = null;
    private readonly peerChokedSince = new Map<string, number>();
    constructor(private readonly source: TorrentSource, private readonly storagePath: string) {
        super();
        this.peerId[0] = 0x2d;
        this.peerId[1] = 0x48;
        this.peerId[2] = 0x54;
    }
    get isReady(): boolean {
        return this.videoFile != null && (this.status === "ready" || this.status === "downloading");
    }
    /** Magnet still waiting on BEP9 `info` (no video download yet). */
    get awaitingMetadata(): boolean {
        return this.source.kind === "magnet" && this.metadata == null && this.status !== "error";
    }
    get progress(): number {
        return this.picker?.progress ?? 0;
    }
    get isComplete(): boolean {
        return this.picker?.isFinished ?? false;
    }
    get filePath(): string | null {
        if (!this.videoFile)
            return null;
        return join(this.downloadDir, this.videoFile.path);
    }
    get fileSize(): number | null {
        return this.videoFile?.length ?? null;
    }
    get storageDirectory(): string {
        return this.downloadDir;
    }
    /**
     * True once a contiguous prefix contains a complete MP4 moov (or mkv/avi head).
     * Need size is adaptive — not a fixed 8 MB wait.
     */
    hasBytesForPlayback(): boolean {
        if (!this.videoFile || !this.store || !this.metadata)
            return false;
        if (this.picker?.isFinished) {
            this.cachedCanPlay = true;
            return true;
        }
        const contiguous = this.contiguousBytesFromVideoStart();
        // If we previously said canPlay, still require the prefix to remain contiguous.
        if (this.cachedCanPlay) {
            const need = this.playbackNeedBytes ?? 0;
            if (need > 0 && contiguous < need) {
                this.cachedCanPlay = false;
                return false;
            }
            return true;
        }
        if (contiguous < 32)
            return false;
        const readLen = Math.min(contiguous, PLAYBACK_PREFIX_MAX, this.videoFile.length);
        const buf = this.readVideoPrefix(readLen);
        if (!buf || buf.length < 8)
            return false;
        const analysis = analyzeMp4Prefix(buf);
        this.needsMoovTail = analysis.moovAtEnd;
        if (analysis.needBytes > 0)
            this.playbackNeedBytes = Math.min(analysis.needBytes, PLAYBACK_PREFIX_MAX, this.videoFile.length);
        if (analysis.moovAtEnd) {
            const tailLen = Math.min(PLAYBACK_PREFIX_MAX, this.videoFile.length);
            const tailStart = this.videoFile.offset + this.videoFile.length - tailLen;
            if (!this.piecesComplete(tailStart, this.videoFile.offset + this.videoFile.length - 1, this.metadata.pieceLength))
                return false;
            this.cachedCanPlay = true;
            log.log(`[PLAYBACK] canPlay=true (moov-at-end) after ${((Date.now() - this.startedAt) / 1000).toFixed(1)}s`);
            return true;
        }
        if (analysis.complete) {
            // Moov alone is not enough — need a bit of mdat so the first frame can decode.
            const withMedia = Math.min(
                analysis.needBytes + PLAYBACK_MDAT_SLACK,
                this.videoFile.length,
                PLAYBACK_PREFIX_MAX,
            );
            this.playbackNeedBytes = withMedia;
            if (contiguous < withMedia)
                return false;
            this.cachedCanPlay = true;
            log.log(
                `[PLAYBACK] canPlay=true need=${withMedia}B ` +
                    `after ${((Date.now() - this.startedAt) / 1000).toFixed(1)}s`,
            );
            return true;
        }
        return false;
    }
    getPlaybackDebug(): PlaybackDebug {
        const pieceLength = this.metadata?.pieceLength ?? null;
        const start = this.videoFile?.offset ?? null;
        const videoLength = this.videoFile?.length ?? null;
        const needBytes = this.playbackNeedBytes ??
            Math.min(PLAYBACK_PREFIX_MAX, videoLength ?? PLAYBACK_PREFIX_MAX);
        let prefixFirst: number | null = null;
        let prefixLast: number | null = null;
        let prefixHave: number | null = null;
        let prefixNeed: number | null = null;
        let tailHave: number | null = null;
        let tailNeed: number | null = null;
        if (pieceLength != null && start != null && videoLength != null) {
            prefixFirst = Math.floor(start / pieceLength);
            prefixLast = Math.floor((start + needBytes - 1) / pieceLength);
            prefixNeed = prefixLast - prefixFirst + 1;
            prefixHave = 0;
            for (let i = prefixFirst; i <= prefixLast; i++) {
                if (this.store?.hasPiece(i))
                    prefixHave++;
            }
            if (this.needsMoovTail) {
                const tailLen = Math.min(PLAYBACK_PREFIX_MAX, videoLength);
                const tailStart = start + videoLength - tailLen;
                const tailFirst = Math.floor(tailStart / pieceLength);
                const tailLast = Math.floor((start + videoLength - 1) / pieceLength);
                tailNeed = tailLast - tailFirst + 1;
                tailHave = 0;
                for (let i = tailFirst; i <= tailLast; i++) {
                    if (this.store?.hasPiece(i))
                        tailHave++;
                }
            }
        }
        return {
            canPlay: this.hasBytesForPlayback(),
            cachedCanPlay: this.cachedCanPlay,
            needsMoovTail: this.needsMoovTail,
            videoName: this.videoFile?.path.split("/").pop() ?? null,
            videoOffset: start,
            videoLength,
            pieceLength,
            pieceCount: this.metadata?.pieces.length ?? null,
            completedPieces: this.store?.getCompletedIndices().length ?? 0,
            prefixFirstPiece: prefixFirst,
            prefixLastPiece: prefixLast,
            prefixHave,
            prefixNeed,
            prefixBytes: needBytes,
            tailHave,
            tailNeed,
            hasContainerHeader: this.videoFile ? this.hasPlayableContainerHeader() : false,
            peersConnected: this.peers.length,
            peersUnchoked: this.peers.filter((p) => p.isUnchoked).length,
            peersQueued: this.peerQueue.length,
            inFlightBlocks: this.inFlightBlocks.size,
            downloadDir: this.downloadDir || null,
        };
    }
    /** Contiguous verified bytes of the video file starting at `fileOffset` (0 = BOF). */
    contiguousLengthFrom(fileOffset: number): number {
        if (!this.videoFile || !this.store || !this.metadata)
            return 0;
        if (this.picker?.isFinished)
            return Math.max(0, this.videoFile.length - fileOffset);
        const pieceLength = this.metadata.pieceLength;
        const fileStart = this.videoFile.offset + Math.max(0, Math.min(fileOffset, this.videoFile.length));
        const fileEnd = this.videoFile.offset + this.videoFile.length;
        let offset = fileStart;
        while (offset < fileEnd) {
            const index = Math.floor(offset / pieceLength);
            if (!this.store.hasPiece(index))
                break;
            offset = Math.min(fileEnd, (index + 1) * pieceLength);
        }
        return Math.max(0, offset - fileStart);
    }
    private contiguousBytesFromVideoStart(): number {
        return this.contiguousLengthFrom(0);
    }
    private readVideoPrefix(length: number): Buffer | null {
        if (!this.videoFile || length <= 0)
            return null;
        try {
            const abs = join(this.downloadDir, this.videoFile.path);
            const fd = openSync(abs, "r");
            const buf = Buffer.alloc(length);
            const read = readSync(fd, buf, 0, length, 0);
            closeSync(fd);
            return read > 0 ? buf.subarray(0, read) : null;
        }
        catch {
            return null;
        }
    }
    private piecesComplete(globalStart: number, globalEnd: number, pieceLength: number): boolean {
        if (!this.store)
            return false;
        const firstPiece = Math.floor(globalStart / pieceLength);
        const lastPiece = Math.floor(globalEnd / pieceLength);
        for (let i = firstPiece; i <= lastPiece; i++) {
            if (!this.store.hasPiece(i))
                return false;
        }
        return true;
    }
    /** Prefer head (adaptive moov size); once we know moov is at EOF, switch to tail. */
    private refreshPlaybackPriority(): void {
        if (!this.videoFile || !this.metadata || !this.picker)
            return;
        const pieceLength = this.metadata.pieceLength;
        const start = this.videoFile.offset;
        if (this.needsMoovTail) {
            const tailLen = Math.min(STREAM_PRIORITY_WINDOW, this.videoFile.length);
            const tailStart = this.videoFile.offset + this.videoFile.length - tailLen;
            this.picker.setPriorityRange(tailStart, this.videoFile.offset + this.videoFile.length - 1, pieceLength);
            return;
        }
        const need = this.playbackNeedBytes ?? Math.min(STREAM_PRIORITY_WINDOW, this.videoFile.length);
        const preloadEnd = start + Math.min(Math.max(need, STREAM_PRIORITY_WINDOW), this.videoFile.length) - 1;
        this.picker.setPriorityRange(start, preloadEnd, pieceLength);
    }
    private isPrefixPiece(index: number): boolean {
        if (!this.videoFile || !this.metadata)
            return false;
        const need = this.playbackNeedBytes ?? Math.min(PLAYBACK_PREFIX_MAX, this.videoFile.length);
        const first = Math.floor(this.videoFile.offset / this.metadata.pieceLength);
        const last = Math.floor((this.videoFile.offset + need - 1) / this.metadata.pieceLength);
        return index >= first && index <= last;
    }
    private hasPlayableContainerHeader(): boolean {
        if (!this.videoFile)
            return false;
        try {
            const abs = join(this.downloadDir, this.videoFile.path);
            const fd = openSync(abs, "r");
            const buf = Buffer.alloc(12);
            readSync(fd, buf, 0, 12, 0);
            closeSync(fd);
            // ISO BMFF (mp4/mov)
            if (buf.subarray(4, 8).toString("ascii") === "ftyp")
                return true;
            // Matroska / WebM
            if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3)
                return true;
            // AVI
            if (buf.subarray(0, 4).toString("ascii") === "RIFF")
                return true;
            return false;
        }
        catch {
            return false;
        }
    }
    getFile(): TorrentFileHandle | null {
        if (!this.videoFile || !this.store || !this.metadata)
            return null;
        const file = this.videoFile;
        const store = this.store;
        const meta = this.metadata;
        const absolutePath = join(this.downloadDir, file.path);
        const finished = this.picker?.isFinished ?? false;
        return {
            name: file.path.split("/").pop() ?? file.path,
            path: absolutePath,
            length: file.length,
            createReadStream: (opts) => {
                if (finished)
                    return PieceStore.createDiskReadStream(absolutePath, opts);
                return store.createReadStream(file, opts, (start, end) => {
                    this.streamReadCursor = start;
                    const pieceLength = meta.pieceLength;
                    const cursorPiece = Math.floor(start / pieceLength);
                    // torrent-stream: critical(currentPiece, ~1MB/pieceLen capped at 2)
                    const criticalWidth = Math.max(1, Math.min(2, Math.floor(CRITICAL_BYTES / pieceLength) || 1));
                    this.picker?.markCritical(cursorPiece, criticalWidth);
                    // Never drop head priority while still buffering for canPlay.
                    if (!this.cachedCanPlay && this.videoFile && this.metadata) {
                        const headEnd = this.videoFile.offset +
                            Math.min(this.playbackNeedBytes ?? STREAM_PRIORITY_WINDOW, this.videoFile.length) - 1;
                        this.picker?.setPriorityRange(
                            this.videoFile.offset,
                            Math.max(end, headEnd),
                            this.metadata.pieceLength,
                        );
                        return;
                    }
                    // After canPlay: sliding window from the HTTP read cursor (not the whole Range).
                    this.picker?.setPriorityRange(start, end, meta.pieceLength);
                });
            },
        };
    }
    async start(): Promise<void> {
        this.startedAt = Date.now();
        try {
            log.log(`[START] source=${this.source.kind} storage=${this.storagePath}`);
            try {
                this.listenPort = await peerListener.ensureListening();
            }
            catch (err) {
                log.warn(`[LISTEN] failed: ${err instanceof Error ? err.message : err} — announcing port ${PREFERRED_LISTEN_PORT}`);
                this.listenPort = PREFERRED_LISTEN_PORT;
            }
            const metaStarted = Date.now();
            await this.loadMetadata();
            if (!this.metadata)
                throw new Error("No metadata");
            log.log(
                `[META] hash=${this.metadata.infoHashHex} pieces=${this.metadata.pieces.length} ` +
                    `pieceLen=${this.metadata.pieceLength} total=${(this.metadata.totalLength / 1024 / 1024).toFixed(1)}MB ` +
                    `files=${this.metadata.files.length} trackers=${this.metadata.trackers.length} ` +
                    `in ${Date.now() - metaStarted}ms`,
            );
            peerListener.register(this.metadata.infoHash, (socket, buf) => this.acceptIncomingPeer(socket, buf));
            this.downloadDir = join(this.storagePath, this.metadata.infoHashHex);
            this.store = new PieceStore(this.metadata, this.downloadDir);
            await this.store.init();
            this.picker = new PiecePicker(this.metadata.pieces.length);
            this.videoFile = this.selectVideoFile(this.metadata.files);
            if (!this.videoFile)
                throw new Error("No video file in torrent");
            log.log(
                `[VIDEO] name=${this.videoFile.path} offset=${this.videoFile.offset} ` +
                    `size=${(this.videoFile.length / 1024 / 1024).toFixed(1)}MB`,
            );
            const preloadEnd = this.videoFile.offset +
                Math.min(STREAM_PRIORITY_WINDOW, this.videoFile.length) - 1;
            this.picker.setPriorityRange(this.videoFile.offset, preloadEnd, this.metadata.pieceLength);
            this.status = "downloading";
            this.emit("ready");
            // Swarm + requests IMMEDIATELY — do not block on full-disk resume.
            this.startRequestLoop();
            this.startUploadLoop();
            this.startHeartbeat();
            void this.startSwarm();
            void this.startDht();
            this.startPexExchange();
            void this.resumeFromDiskInBackground();
        }
        catch (err) {
            this.status = "error";
            log.error(`[START-FAIL] ${err instanceof Error ? err.message : err}`);
            this.emit("error", err instanceof Error ? err : new Error(String(err)));
        }
    }
    private async resumeFromDiskInBackground(): Promise<void> {
        if (!this.store || !this.picker || !this.metadata || !this.videoFile)
            return;
        try {
            const pieceLength = this.metadata.pieceLength;
            const need = Math.min(STREAM_PRIORITY_WINDOW, this.videoFile.length);
            const first = Math.floor(this.videoFile.offset / pieceLength);
            const last = Math.floor((this.videoFile.offset + need - 1) / pieceLength);
            const prefixIndices = Array.from({ length: last - first + 1 }, (_, i) => first + i);
            const t0 = Date.now();
            const resumedHead = await this.store.resumeVerifiedPieces(prefixIndices);
            for (const index of this.store.getCompletedIndices())
                this.picker.markComplete(index);
            if (resumedHead > 0) {
                log.log(`[RESUME] head ${resumedHead} pieces in ${Date.now() - t0}ms`);
                this.emit("progress", this.picker.progress);
            }
            const t1 = Date.now();
            const resumedRest = await this.store.resumeVerifiedPieces();
            for (const index of this.store.getCompletedIndices())
                this.picker.markComplete(index);
            if (resumedRest > resumedHead) {
                log.log(`[RESUME] total ${resumedRest} pieces (+${resumedRest - resumedHead}) in ${Date.now() - t1}ms`);
                this.emit("progress", this.picker.progress);
            }
        }
        catch (err) {
            log.warn(`[RESUME] background failed: ${err instanceof Error ? err.message : err}`);
        }
    }
    destroy(): void {
        this.destroyed = true;
        this.metadataAbort?.();
        this.metadataAbort = null;
        if (this.metadata)
            peerListener.unregister(this.metadata.infoHash);
        if (this.announceTimer)
            clearInterval(this.announceTimer);
        if (this.requestLoopTimer)
            clearInterval(this.requestLoopTimer);
        if (this.uploadTimer)
            clearInterval(this.uploadTimer);
        if (this.heartbeatTimer)
            clearInterval(this.heartbeatTimer);
        if (this.dhtTimer)
            clearInterval(this.dhtTimer);
        if (this.pexTimer)
            clearInterval(this.pexTimer);
        this.dht?.destroy();
        this.dht = null;
        for (const peer of this.peers)
            peer.destroy();
        this.peers = [];
        this.peerQueue = [];
        this.connectedAddrs.clear();
        this.seenAddrs.clear();
        log.log(`[DESTROY] download torn down after ${((Date.now() - this.startedAt) / 1000).toFixed(1)}s`);
    }
    private startHeartbeat(): void {
        this.heartbeatTimer = setInterval(() => {
            if (this.destroyed)
                return;
            const dbg = this.getPlaybackDebug();
            const focus = this.focusPrefixPiece();
            const focusBuf = focus != null ? (this.store?.bufferedBlockCount(focus) ?? 0) : 0;
            const focusList = this.focusPieces();
            log.log(
                `[HEARTBEAT] +${((Date.now() - this.startedAt) / 1000).toFixed(0)}s ` +
                    `progress=${this.picker?.progress ?? 0}% canPlay=${dbg.canPlay} ` +
                    `prefix=${dbg.prefixHave}/${dbg.prefixNeed} pieces=${dbg.completedPieces}/${dbg.pieceCount} ` +
                    `peers=${dbg.peersConnected} unchoked=${dbg.peersUnchoked} queued=${dbg.peersQueued} ` +
                    `inflight=${dbg.inFlightBlocks} blocks=${this.blocksReceived} hashFails=${this.hashFails} ` +
                    `up=${(this.bytesUploaded / 1024 / 1024).toFixed(1)}MB upSlots=${this.peers.filter((p) => !p.weAreChoking).length} ` +
                    `focus=[${focusList.join(",")}] buf=${focusBuf}/64 ` +
                    `header=${dbg.hasContainerHeader} moovTail=${dbg.needsMoovTail}`,
            );
        }, 5000);
    }
    private async loadMetadata(): Promise<void> {
        if (this.source.kind === "file") {
            log.log(`[META] loading .torrent from URL…`);
            this.metadata = await loadTorrentFromUrl(this.source.url);
            return;
        }
        if (this.source.kind === "buffer") {
            log.log(`[META] parsing torrent buffer (${this.source.data.length} bytes)`);
            this.metadata = parseTorrentBuffer(this.source.data);
            return;
        }
        log.log(`[META] fetching via magnet (ut_metadata)…`);
        const magnet = parseMagnetUri(this.source.uri);
        this.metadata = await this.fetchMetadataViaMagnet(magnet);
    }
    private fetchMetadataViaMagnet(magnet: MagnetLink): Promise<TorrentMetadata> {
        return new Promise((resolve, reject) => {
            let settled = false;
            const metadataPeers: PeerConnection[] = [];
            const seen = new Set<string>();
            const extra: PeerAddress[] = [];
            const pieces = new Map<number, Buffer>();
            let metadataSize = 0;
            let announceTimer: ReturnType<typeof setInterval> | null = null;
            let waitLogTimer: ReturnType<typeof setInterval> | null = null;
            let announcedStarted = false;

            const stopDiscovery = () => {
                if (announceTimer)
                    clearInterval(announceTimer);
                if (waitLogTimer)
                    clearInterval(waitLogTimer);
                announceTimer = null;
                waitLogTimer = null;
                for (const p of metadataPeers)
                    p.destroy();
                metadataPeers.length = 0;
            };

            let deadline: ReturnType<typeof setTimeout> | undefined;
            const finish = (fn: () => void) => {
                if (settled)
                    return;
                settled = true;
                this.metadataAbort = null;
                if (deadline)
                    clearTimeout(deadline);
                stopDiscovery();
                fn();
            };
            this.metadataAbort = () => finish(() => reject(new Error("destroyed")));

            deadline = setTimeout(() => {
                log.error(
                    `[META] no ut_metadata after ${METADATA_DEADLINE_MS / 1000}s ` +
                        `(dialed=${seen.size} live=${metadataPeers.length})`,
                );
                finish(() => reject(new Error("No sources for magnet metadata")));
            }, METADATA_DEADLINE_MS);

            const tryAssemble = () => {
                if (metadataSize <= 0)
                    return;
                const pieceCount = Math.ceil(metadataSize / BLOCK_SIZE);
                const buf = Buffer.alloc(metadataSize);
                for (let i = 0; i < pieceCount; i++) {
                    const part = pieces.get(i);
                    if (!part)
                        return;
                    part.copy(buf, i * BLOCK_SIZE, 0, Math.min(part.length, buf.length - i * BLOCK_SIZE));
                }
                try {
                    log.log(`[META] got info dict from ut_metadata (${buf.length} bytes)`);
                    finish(() => resolve(metadataFromUtPayload(buf, magnet)));
                }
                catch {
                    // Garbage from one peer: keep the lookup open for the others.
                }
            };

            const fillSlots = () => {
                while (metadataPeers.length < METADATA_MAX_PEERS && extra.length > 0)
                    dial(extra.shift()!);
            };

            const dial = (addr: PeerAddress) => {
                if (settled || this.destroyed)
                    return;
                if (addr.port <= 0 || addr.host.startsWith("0."))
                    return;
                const key = `${addr.host}:${addr.port}`;
                if (seen.has(key))
                    return;
                if (metadataPeers.length >= METADATA_MAX_PEERS) {
                    if (extra.length < 200)
                        extra.push(addr);
                    return;
                }
                seen.add(key);
                const peer = new PeerConnection(addr.host, addr.port, magnet.infoHash, this.peerId, 0, {
                    onBlock: () => { },
                    onHave: () => { },
                    onChoke: () => { },
                    onUnchoke: () => { },
                    onDisconnect: () => {
                        const i = metadataPeers.indexOf(peer);
                        if (i >= 0)
                            metadataPeers.splice(i, 1);
                        fillSlots();
                    },
                    onMetadataSize: (size) => {
                        metadataSize = size;
                    },
                    onMetadataPiece: (piece, data) => {
                        pieces.set(piece, data);
                        tryAssemble();
                    },
                    onMetadataComplete: (assembled) => {
                        try {
                            const meta = metadataFromUtPayload(assembled, magnet);
                            log.log(`[META] got info dict from ut_metadata (${assembled.length} bytes)`);
                            finish(() => resolve(meta));
                        }
                        catch {
                            // Hash mismatch from this peer — wait for another.
                        }
                    },
                }, true);
                metadataPeers.push(peer);
                peer.connect();
            };

            const onPeerBatch = (batch: PeerAddress[]) => {
                for (const addr of batch)
                    dial(addr);
            };

            const announce = async () => {
                if (settled || this.destroyed)
                    return;
                const event = announcedStarted ? null : "started";
                announcedStarted = true;
                log.log(`[META] announcing to ${magnet.trackers.length} trackers for metadata…`);
                const { peers } = await announceAllTrackers(
                    magnet.trackers,
                    magnet.infoHash,
                    this.peerId,
                    this.listenPort || PREFERRED_LISTEN_PORT,
                    1,
                    onPeerBatch,
                    event,
                );
                if (!settled)
                    log.log(`[META] trackers returned ${peers.length} peers (live=${metadataPeers.length} seen=${seen.size})`);
            };

            waitLogTimer = setInterval(() => {
                if (settled || this.destroyed) {
                    if (this.destroyed)
                        finish(() => reject(new Error("destroyed")));
                    return;
                }
                log.log(`[META] waiting ut_metadata live=${metadataPeers.length} seen=${seen.size} queued=${extra.length}`);
            }, 10_000);

            void announce();
            announceTimer = setInterval(() => void announce(), METADATA_REANNOUNCE_MS);

            void this.ensureDht().then((dht) => {
                if (!dht || settled || this.destroyed)
                    return;
                log.log(`[META] DHT lookup for magnet metadata`);
                return dht.lookup(magnet.infoHash, onPeerBatch, {
                    rounds: 8,
                    announcePort: this.listenPort || PREFERRED_LISTEN_PORT,
                });
            }).then((peers) => {
                if (peers && !settled)
                    log.log(`[META] DHT lookup done +${peers.length} peers`);
            }).catch((err: Error) => {
                log.warn(`[META] DHT lookup failed: ${err.message}`);
            });
        });
    }
    private async startSwarm(): Promise<void> {
        if (!this.metadata)
            return;
        const announce = async () => {
            if (this.destroyed || !this.metadata || !this.picker)
                return;
            const downloaded = Math.floor((this.picker.progress / 100) * this.metadata.totalLength);
            const left = this.picker.isFinished ? 0 : this.metadata.totalLength - downloaded;
            const event = this.announceStartedSent ? null : "started";
            this.announceStartedSent = true;
            log.log(`[ANNOUNCE] event=${event ?? "none"} port=${this.listenPort || PREFERRED_LISTEN_PORT} left≈${(left / 1024 / 1024).toFixed(1)}MB trackers=${this.metadata.trackers.length}`);
            const { peers, interval } = await announceAllTrackers(
                this.metadata.trackers,
                this.metadata.infoHash,
                this.peerId,
                this.listenPort || PREFERRED_LISTEN_PORT,
                Math.max(left, 0),
                (batch) => {
                    log.log(`[ANNOUNCE] +${batch.length} peers (early)`);
                    this.enqueuePeers(batch);
                },
                event,
            );
            this.enqueuePeers(peers);
            if (peers.length === 0)
                log.warn(`[ANNOUNCE] 0 peers from ${this.metadata.trackers.length} trackers — will retry soon`);
            this.emit("swarm", {
                peers: peers.length,
                queued: this.peerQueue.length,
                connected: this.peers.length,
                unchoked: this.peers.filter((p) => p.isUnchoked).length,
                progress: this.picker.progress,
            });
            if (this.announceTimer)
                clearInterval(this.announceTimer);
            // Faster re-announce while we still have no peers.
            const retrySec = peers.length === 0 && this.peers.length === 0 ? 20 : Math.max(interval, 60);
            this.announceTimer = setInterval(announce, retrySec * 1000);
        };
        void announce();
    }
    private async ensureDht(): Promise<DhtClient | null> {
        if (this.destroyed)
            return null;
        if (this.dht)
            return this.dht;
        try {
            this.dht = new DhtClient();
            await this.dht.start();
            return this.dht;
        }
        catch (err) {
            log.warn(`[DHT] start failed: ${err instanceof Error ? err.message : err}`);
            this.dht = null;
            return null;
        }
    }
    private async startDht(): Promise<void> {
        if (!this.metadata || this.destroyed)
            return;
        const dht = await this.ensureDht();
        if (!dht)
            return;
        const runLookup = async () => {
            if (this.destroyed || !this.dht || !this.metadata)
                return;
            const before = this.seenAddrs.size;
            const peers = await this.dht.lookup(
                this.metadata.infoHash,
                (batch) => this.enqueuePeers(batch),
                {
                    rounds: 8,
                    announcePort: this.listenPort || PREFERRED_LISTEN_PORT,
                },
            );
            this.enqueuePeers(peers);
            const gained = this.seenAddrs.size - before;
            log.log(`[DHT] lookup +${peers.length} peers (new≈${Math.max(0, gained)}) queue=${this.peerQueue.length}`);
        };
        void runLookup();
        if (!this.dhtTimer)
            this.dhtTimer = setInterval(() => void runLookup(), 45_000);
    }
    /** B3: share our connected peers with remotes that support ut_pex. */
    private startPexExchange(): void {
        this.pexTimer = setInterval(() => {
            if (this.destroyed || this.peers.length === 0)
                return;
            const addrs: PeerAddress[] = [];
            for (const p of this.peers) {
                const [host, portStr] = p.address.split(":");
                const port = Number(portStr);
                if (!host || !Number.isFinite(port) || port <= 0)
                    continue;
                if (host.includes(":"))
                    continue; // compact IPv4 only
                addrs.push({ host, port });
            }
            if (addrs.length < 2)
                return;
            let sent = 0;
            for (const peer of this.peers) {
                if (!peer.supportsPex)
                    continue;
                const others = addrs.filter((a) => `${a.host}:${a.port}` !== peer.address);
                if (others.length === 0)
                    continue;
                peer.sendPex(others);
                sent += 1;
            }
            if (sent > 0)
                log.debug(`[PEX] sent ${addrs.length} peers → ${sent} remotes`);
        }, 60_000);
    }
    private enqueuePeers(peers: PeerAddress[]): void {
        // Shuffle so we do not only try the first (often dead) tracker entries.
        const shuffled = [...peers];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        for (const addr of shuffled) {
            if (addr.port <= 0 || addr.host.startsWith("0."))
                continue;
            const key = `${addr.host}:${addr.port}`;
            if (this.connectedAddrs.has(key))
                continue;
            if (this.seenAddrs.has(key))
                continue;
            this.seenAddrs.add(key);
            this.peerQueue.push(addr);
        }
        this.fillPeerSlots();
    }
    private fillPeerSlots(): void {
        this.evictStalePeers();
        while (!this.destroyed && this.peers.length < MAX_PEERS && this.peerQueue.length > 0) {
            const next = this.peerQueue.shift();
            if (next)
                this.connectPeer(next);
        }
    }
    /** Drop useless / long-choked peers so slots rotate (B1). */
    private evictStalePeers(): void {
        const now = Date.now();
        for (const peer of [...this.peers]) {
            const key = peer.address;
            if (peer.ageMs > USELESS_PEER_MS && !peer.hasAnyPieces && !peer.isUnchoked) {
                log.log(`[EVICT] useless peer ${key} (no bitfield >${USELESS_PEER_MS / 1000}s)`);
                peer.destroy();
                continue;
            }
            if (peer.isUnchoked) {
                this.peerChokedSince.delete(key);
                continue;
            }
            if (!this.peerChokedSince.has(key))
                this.peerChokedSince.set(key, now);
            else if (now - (this.peerChokedSince.get(key) ?? now) > CHOKE_EVICT_MS) {
                log.log(`[EVICT] choked peer ${key} >${CHOKE_EVICT_MS / 1000}s`);
                peer.destroy();
            }
        }
        // Full swarm + waiting queue → rotate oldest choked peers for fresh ones.
        if (this.peers.length >= MAX_PEERS && this.peerQueue.length > 0) {
            const candidates = this.peers
                .filter((p) => !p.isUnchoked)
                .sort((a, b) => b.ageMs - a.ageMs);
            const n = Math.min(4, candidates.length, this.peerQueue.length);
            for (let i = 0; i < n; i++) {
                const p = candidates[i];
                if (!p)
                    break;
                log.log(`[EVICT] rotate ${p.address} for queued peer`);
                p.destroy();
            }
        }
    }
    private connectPeer(addr: PeerAddress): void {
        if (this.destroyed || !this.metadata || !this.picker || !this.store)
            return;
        const key = `${addr.host}:${addr.port}`;
        if (this.connectedAddrs.has(key))
            return;
        this.connectedAddrs.add(key);
        this.peerChokedSince.set(key, Date.now());
        log.debug(`[PEER+] ${addr.host}:${addr.port} (connected=${this.peers.length + 1}/${MAX_PEERS} queue=${this.peerQueue.length})`);
        // The callbacks need the connection they belong to, which only exists
        // once the constructor returns: they reach it through a getter.
        const peer: PeerConnection = new PeerConnection(addr.host, addr.port, this.metadata.infoHash, this.peerId, this.metadata.pieces.length, this.buildPeerCallbacks(() => key, () => peer));
        this.peers.push(peer);
        peer.connect();
    }
    private acceptIncomingPeer(socket: Socket, initialBuffer: Buffer): void {
        if (this.destroyed || !this.metadata || !this.picker || !this.store) {
            socket.destroy();
            return;
        }
        if (this.peers.length >= MAX_PEERS) {
            log.debug(`[LISTEN] full (${MAX_PEERS}) — drop inbound`);
            socket.destroy();
            return;
        }
        const host = (socket.remoteAddress ?? "0.0.0.0").replace(/^::ffff:/, "");
        const port = socket.remotePort ?? 0;
        const key = `${host}:${port}`;
        if (this.connectedAddrs.has(key)) {
            socket.destroy();
            return;
        }
        this.connectedAddrs.add(key);
        this.seenAddrs.add(key);
        this.peerChokedSince.set(key, Date.now());
        log.log(`[PEER+] inbound ${key} (connected=${this.peers.length + 1}/${MAX_PEERS})`);
        const peer: PeerConnection = new PeerConnection(host, port, this.metadata.infoHash, this.peerId, this.metadata.pieces.length, this.buildPeerCallbacks(() => key, () => peer));
        this.peers.push(peer);
        peer.acceptIncoming(socket, initialBuffer);
    }
    private buildPeerCallbacks(getKey: () => string, getPeer: () => PeerConnection) {
        return {
            onBlock: (index: number, begin: number, block: Buffer) => {
                const blockKey = `${index}:${begin}`;
                this.blocksReceived += 1;
                void this.store?.addBlock(index, begin, block)
                    .then((result) => {
                    if (result === "ok") {
                        this.picker?.markComplete(index);
                        this.refreshPlaybackPriority();
                        for (const p of this.peers)
                            p.sendHave(index);
                        const dbg = this.getPlaybackDebug();
                        const inPrefix = dbg.prefixFirstPiece != null &&
                            dbg.prefixLastPiece != null &&
                            index >= dbg.prefixFirstPiece &&
                            index <= dbg.prefixLastPiece;
                        log.log(
                            `[PIECE] #${index}${inPrefix ? " (PREFIX)" : ""} ` +
                                `progress=${this.picker?.progress ?? 0}% ` +
                                `prefix=${dbg.prefixHave}/${dbg.prefixNeed} canPlay=${dbg.canPlay}`,
                        );
                        this.emit("progress", this.picker?.progress ?? 0);
                        if (this.picker?.isFinished) {
                            this.status = "ready";
                            this.emit("complete");
                        }
                        return;
                    }
                    if (result === "hashfail") {
                        // Only wipe buffered blocks when the assembled piece is corrupt.
                        this.store?.clearPieceBlocks(index);
                        this.hashFails += 1;
                        if (this.hashFails <= 20 || this.hashFails % 50 === 0) {
                            log.warn(
                                `[HASHFAIL] piece #${index} (totalFails=${this.hashFails}) — re-requesting`,
                            );
                        }
                    }
                    // incomplete / duplicate: keep buffered blocks so the piece can fill.
                })
                    .catch((err: Error) => {
                    log.warn(`[BLOCK] addBlock failed ${blockKey}: ${err.message}`);
                })
                    .finally(() => {
                    this.inFlightBlocks.delete(blockKey);
                });
            },
            onHave: () => getPeer().setInterested(true),
            onChoke: (released?: string[]) => {
                for (const releasedKey of released ?? [])
                    this.inFlightBlocks.delete(releasedKey);
                this.peerChokedSince.set(getKey(), Date.now());
                log.debug(`[PEER choke] ${getKey()} released=${released?.length ?? 0}`);
            },
            onUnchoke: () => {
                this.peerChokedSince.delete(getKey());
                log.debug(`[PEER unchoke] ${getKey()}`);
                this.scheduleRequests(getPeer());
            },
            onHandshakeComplete: () => {
                this.sendOurBitfield(getPeer());
                getPeer().setInterested(true);
                this.recomputeUploadSlots();
            },
            onPeerInterest: () => {
                this.recomputeUploadSlots();
            },
            onPeerRequest: (index: number, begin: number, length: number) => {
                void this.serveUploadRequest(getPeer(), index, begin, length);
            },
            onPexPeers: (pexPeers: PeerAddress[]) => {
                if (pexPeers.length === 0)
                    return;
                log.debug(`[PEX] +${pexPeers.length} from ${getKey()}`);
                this.enqueuePeers(pexPeers);
            },
            onDisconnect: () => {
                const peer = getPeer();
                const key = getKey();
                this.peers = this.peers.filter((p) => p !== peer);
                this.connectedAddrs.delete(key);
                this.peerChokedSince.delete(key);
                // Allow retry later — remove from seen so re-announce can re-queue.
                this.seenAddrs.delete(key);
                log.debug(`[PEER-] ${key} (left=${this.peers.length} inflight=${this.inFlightBlocks.size})`);
                this.recomputeUploadSlots();
                this.fillPeerSlots();
            },
        };
    }
    private sendOurBitfield(peer: PeerConnection): void {
        if (!this.store || !this.metadata)
            return;
        const have = new Array(this.metadata.pieces.length).fill(false);
        for (const index of this.store.getCompletedIndices())
            have[index] = true;
        peer.sendBitfield(have);
    }
    /** A3: choose which peers we upload to (tit-for-tat + optimistic unchoke). */
    private startUploadLoop(): void {
        this.recomputeUploadSlots();
        this.uploadTimer = setInterval(() => this.recomputeUploadSlots(), 10_000);
    }
    private recomputeUploadSlots(): void {
        if (this.destroyed || this.peers.length === 0)
            return;
        // Prefer peers that are also unchoking us (reciprocity), then any interested peer.
        const interested = this.peers
            .filter((p) => p.peerWantsData)
            .sort((a, b) => Number(b.isUnchoked) - Number(a.isUnchoked));
        const keep = new Set<PeerConnection>();
        for (const p of interested.slice(0, MAX_UPLOAD_SLOTS))
            keep.add(p);
        // Optimistic unchoke: one extra random peer (even if not interested yet).
        const rest = this.peers.filter((p) => !keep.has(p));
        if (rest.length > 0) {
            const pick = rest[Math.floor(Math.random() * rest.length)]!;
            keep.add(pick);
        }
        for (const p of this.peers)
            p.setChoking(!keep.has(p));
    }
    private async serveUploadRequest(
        peer: PeerConnection,
        index: number,
        begin: number,
        length: number,
    ): Promise<void> {
        if (this.destroyed || !this.store || peer.weAreChoking)
            return;
        if (!this.store.hasPiece(index))
            return;
        if (this.uploadInFlight >= MAX_UPLOAD_INFLIGHT)
            return;
        this.uploadInFlight += 1;
        try {
            const block = await this.store.readBlock(index, begin, length);
            if (!block || this.destroyed || peer.weAreChoking)
                return;
            peer.sendPiece(index, begin, block);
            this.bytesUploaded += block.length;
        }
        catch (err) {
            log.debug(`[UPLOAD] fail #${index}@${begin}: ${err instanceof Error ? err.message : err}`);
        }
        finally {
            this.uploadInFlight = Math.max(0, this.uploadInFlight - 1);
        }
    }
    private startRequestLoop(): void {
        this.requestLoopTimer = setInterval(() => {
            for (const peer of [...this.peers]) {
                if (peer.isSnubbed) {
                    log.warn(`[SNUB] dropping ${peer.address} (no data for 20s)`);
                    peer.destroy();
                    continue;
                }
                for (const key of peer.cancelStaleRequests(8_000))
                    this.inFlightBlocks.delete(key);
                if (peer.isUnchoked)
                    this.scheduleRequests(peer);
            }
        }, 100);
    }
    /** Incomplete pieces we are allowed to request right now (prefix parallel or stream-ahead). */
    private focusPieces(): number[] {
        if (!this.videoFile || !this.metadata || !this.store)
            return [];
        const pieceLength = this.metadata.pieceLength;
        if (!this.cachedCanPlay) {
            const need = this.playbackNeedBytes ?? Math.min(PLAYBACK_PREFIX_MAX, this.videoFile.length);
            const first = Math.floor(this.videoFile.offset / pieceLength);
            const last = Math.floor((this.videoFile.offset + need - 1) / pieceLength);
            const out: number[] = [];
            for (let i = first; i <= last && out.length < PREFIX_PARALLEL_PIECES; i++) {
                if (!this.store.hasPiece(i))
                    out.push(i);
            }
            return out;
        }
        // After canPlay: strict sequential fill from the HTTP read cursor (or video start).
        const cursor = this.streamReadCursor ?? this.videoFile.offset;
        const first = Math.floor(cursor / pieceLength);
        const last = Math.min(
            this.metadata.pieces.length - 1,
            first + STREAM_AHEAD_PIECES - 1,
        );
        const out: number[] = [];
        for (let i = first; i <= last && out.length < STREAM_AHEAD_PIECES; i++) {
            if (!this.store.hasPiece(i))
                out.push(i);
        }
        // If the tight window is done, fall back to picker priority (still sequential via focus).
        if (out.length === 0) {
            const fallback = this.focusPrefixPiece();
            if (fallback != null)
                out.push(fallback);
        }
        return out;
    }
    /** Pieces under the read cursor — highest priority, always endgame (torrent-stream critical). */
    private criticalPieces(): number[] {
        if (!this.store || !this.picker)
            return [];
        return this.picker.getCriticalIndices().filter((i) => !this.store!.hasPiece(i));
    }
    /** First incomplete piece in the playback prefix (debug / fallback). */
    private focusPrefixPiece(): number | null {
        if (!this.videoFile || !this.metadata || !this.store)
            return null;
        const need = this.playbackNeedBytes ?? Math.min(PLAYBACK_PREFIX_MAX, this.videoFile.length);
        const first = Math.floor(this.videoFile.offset / this.metadata.pieceLength);
        const last = Math.floor((this.videoFile.offset + need - 1) / this.metadata.pieceLength);
        for (let i = first; i <= last; i++) {
            if (!this.store.hasPiece(i))
                return i;
        }
        // After prefix: first incomplete from stream cursor or video start.
        const cursor = this.streamReadCursor ?? this.videoFile.offset;
        const from = Math.floor(cursor / this.metadata.pieceLength);
        for (let i = from; i < this.metadata.pieces.length; i++) {
            if (!this.store.hasPiece(i))
                return i;
        }
        return null;
    }
    private scheduleRequests(peer: PeerConnection): void {
        if (!this.metadata || !this.picker || !this.store)
            return;
        if (!peer.isUnchoked)
            return;
        // Keep critical in sync with the stream cursor (torrent-stream demand-driven).
        if (this.videoFile && this.metadata) {
            const pieceLength = this.metadata.pieceLength;
            const criticalWidth = Math.max(1, Math.min(2, Math.floor(CRITICAL_BYTES / pieceLength) || 1));
            if (this.streamReadCursor != null) {
                const cursorPiece = Math.floor(this.streamReadCursor / pieceLength);
                this.picker.markCritical(cursorPiece, criticalWidth);
            }
            else if (!this.cachedCanPlay) {
                // Before the player opens: critical = head of the playback prefix.
                const first = Math.floor(this.videoFile.offset / pieceLength);
                this.picker.markCritical(first, Math.max(criticalWidth, PREFIX_PARALLEL_PIECES));
            }
        }
        const critical = this.criticalPieces();
        const criticalSet = critical.length > 0 ? new Set(critical) : null;
        const focus = this.focusPieces();
        const focusSet = focus.length > 0 ? new Set(focus) : null;
        // torrent-stream order: critical (endgame) → stream window (endgame) → background.
        if (criticalSet)
            this.fillPeerPipeline(peer, criticalSet, "critical");
        this.fillPeerPipeline(peer, focusSet, "focus");
        if (this.cachedCanPlay && peer.pendingCount < MAX_PEER_PIPELINE)
            this.fillPeerPipeline(peer, focusSet, "background", criticalSet);
    }
    private fillPeerPipeline(
        peer: PeerConnection,
        focusSet: Set<number> | null,
        mode: "critical" | "focus" | "background",
        alsoSkip?: Set<number> | null,
    ): void {
        if (!this.metadata || !this.picker || !this.store)
            return;
        const tried = new Set<number>();
        while (peer.pendingCount < MAX_PEER_PIPELINE) {
            const endgame = mode === "critical" || mode === "focus";
            const shouldSkip = (index: number): boolean => {
                if (tried.has(index))
                    return true;
                if (mode === "critical" && focusSet && !focusSet.has(index))
                    return true;
                if (mode === "focus" && focusSet && !focusSet.has(index))
                    return true;
                if (mode === "background") {
                    if (focusSet?.has(index))
                        return true;
                    if (alsoSkip?.has(index))
                        return true;
                }
                if (!peer.hasPiece(index))
                    return true;
                if (this.store!.hasPiece(index))
                    return true;
                const pieceSize = this.store!.pieceSize(index);
                for (let begin = 0; begin < pieceSize; begin += BLOCK_SIZE) {
                    if (this.store!.hasBlock(index, begin))
                        continue;
                    if (!endgame && this.inFlightBlocks.has(`${index}:${begin}`))
                        continue;
                    return false;
                }
                return true;
            };
            const index = this.picker.pickNext(shouldSkip);
            if (index == null)
                return;
            tried.add(index);
            const pieceSize = this.store.pieceSize(index);
            let sent = false;
            for (let begin = 0; begin < pieceSize; begin += BLOCK_SIZE) {
                const blockKey = `${index}:${begin}`;
                if (this.store.hasBlock(index, begin))
                    continue;
                if (!endgame && this.inFlightBlocks.has(blockKey))
                    continue;
                const length = Math.min(BLOCK_SIZE, pieceSize - begin);
                peer.setInterested(true);
                if (!peer.requestBlock(index, begin, length)) {
                    if (peer.pendingCount >= MAX_PEER_PIPELINE || !peer.isUnchoked)
                        return;
                    continue;
                }
                this.inFlightBlocks.add(blockKey);
                sent = true;
                break;
            }
            if (!sent)
                continue;
        }
    }
    private selectVideoFile(files: TorrentFileEntry[]): TorrentFileEntry | null {
        const videos = files.filter((f) => {
            const name = f.path.toLowerCase();
            const ext = name.slice(name.lastIndexOf("."));
            return VIDEO_EXTENSIONS.includes(ext);
        });
        if (videos.length === 0)
            return null;
        return videos.reduce((a, b) => (a.length > b.length ? a : b));
    }
}
