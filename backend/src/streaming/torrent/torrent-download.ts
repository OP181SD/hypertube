import { EventEmitter } from "node:events";
import { randomBytes } from "node:crypto";
import type { Readable } from "node:stream";
import { join } from "node:path";
import type { TorrentMetadata, TorrentFileEntry } from "./metadata/torrent-metadata";
import type { MagnetLink } from "./metadata/from-magnet";
import { parseMagnetUri, metadataFromUtPayload } from "./metadata/from-magnet";
import { loadTorrentFromUrl, parseTorrentBuffer } from "./metadata/from-torrent-file";
import { announceAllTrackers, type PeerAddress } from "./tracker/tracker-client";
import { PeerConnection } from "./peer/peer-connection";
import { BLOCK_SIZE } from "./peer/messages";
import { PiecePicker } from "./piece/piece-picker";
import { PieceStore } from "./piece/piece-store";
const VIDEO_EXTENSIONS = [".mp4", ".mkv", ".avi", ".webm", ".mov"];
const MAX_PEERS = 30;
const LISTEN_PORT = 6881;
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
    private readonly peerId = randomBytes(20);
    private announceTimer: ReturnType<typeof setInterval> | null = null;
    private requestLoopTimer: ReturnType<typeof setInterval> | null = null;
    private readonly inFlightBlocks = new Set<string>();
    private destroyed = false;
    private videoFile: TorrentFileEntry | null = null;
    private downloadDir = "";
    private status: "starting" | "downloading" | "ready" | "error" = "starting";
    constructor(private readonly source: TorrentSource, private readonly storagePath: string) {
        super();
        this.peerId[0] = 0x2d;
        this.peerId[1] = 0x48;
        this.peerId[2] = 0x54;
    }
    get isReady(): boolean {
        return this.videoFile != null && (this.status === "ready" || this.status === "downloading");
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
                    this.picker?.setPriorityRange(start, end, meta.pieceLength);
                });
            },
        };
    }
    async start(): Promise<void> {
        try {
            await this.loadMetadata();
            if (!this.metadata)
                throw new Error("No metadata");
            this.downloadDir = join(this.storagePath, this.metadata.infoHashHex);
            this.store = new PieceStore(this.metadata, this.downloadDir);
            await this.store.init();
            this.picker = new PiecePicker(this.metadata.pieces.length);
            this.videoFile = this.selectVideoFile(this.metadata.files);
            if (!this.videoFile)
                throw new Error("No video file in torrent");
            this.status = "downloading";
            this.emit("ready");
            await this.startSwarm();
            this.startRequestLoop();
        }
        catch (err) {
            this.status = "error";
            this.emit("error", err instanceof Error ? err : new Error(String(err)));
        }
    }
    destroy(): void {
        this.destroyed = true;
        if (this.announceTimer)
            clearInterval(this.announceTimer);
        if (this.requestLoopTimer)
            clearInterval(this.requestLoopTimer);
        for (const peer of this.peers)
            peer.destroy();
        this.peers = [];
        this.connectedAddrs.clear();
    }
    private async loadMetadata(): Promise<void> {
        if (this.source.kind === "file") {
            this.metadata = await loadTorrentFromUrl(this.source.url);
            return;
        }
        if (this.source.kind === "buffer") {
            this.metadata = parseTorrentBuffer(this.source.data);
            return;
        }
        const magnet = parseMagnetUri(this.source.uri);
        this.metadata = await this.fetchMetadataViaMagnet(magnet);
    }
    private fetchMetadataViaMagnet(magnet: MagnetLink): Promise<TorrentMetadata> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error("Metadata fetch timeout"));
            }, 30000);
            const metadataPeers: PeerConnection[] = [];
            const pieces = new Map<number, Buffer>();
            let metadataSize = 0;
            const cleanup = () => {
                clearTimeout(timeout);
                for (const p of metadataPeers)
                    p.destroy();
                metadataPeers.length = 0;
            };
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
                    resolve(metadataFromUtPayload(buf, magnet));
                    cleanup();
                }
                catch {
                }
            };
            void (async () => {
                const { peers } = await announceAllTrackers(magnet.trackers, magnet.infoHash, this.peerId, LISTEN_PORT, 1);
                for (const addr of peers.slice(0, 15)) {
                    const peer = new PeerConnection(addr.host, addr.port, magnet.infoHash, this.peerId, 0, {
                        onBlock: () => { },
                        onHave: () => { },
                        onChoke: () => { },
                        onUnchoke: () => { },
                        onDisconnect: () => { },
                        onMetadataSize: (size) => {
                            metadataSize = size;
                        },
                        onMetadataPiece: (piece, data) => {
                            pieces.set(piece, data);
                            tryAssemble();
                        },
                        onMetadataComplete: (assembled) => {
                            try {
                                resolve(metadataFromUtPayload(assembled, magnet));
                                cleanup();
                            }
                            catch (e) {
                                reject(e instanceof Error ? e : new Error(String(e)));
                            }
                        },
                    }, true);
                    metadataPeers.push(peer);
                    peer.connect();
                }
                if (peers.length === 0) {
                    reject(new Error("No peers for metadata"));
                    cleanup();
                }
            })();
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
            const { peers, interval } = await announceAllTrackers(this.metadata.trackers, this.metadata.infoHash, this.peerId, LISTEN_PORT, Math.max(left, 0));
            for (const addr of peers)
                this.connectPeer(addr);
            if (this.announceTimer)
                clearInterval(this.announceTimer);
            this.announceTimer = setInterval(announce, Math.max(interval, 60) * 1000);
        };
        await announce();
    }
    private connectPeer(addr: PeerAddress): void {
        if (this.destroyed || !this.metadata || !this.picker || !this.store)
            return;
        if (this.peers.length >= MAX_PEERS)
            return;
        const key = `${addr.host}:${addr.port}`;
        if (this.connectedAddrs.has(key))
            return;
        this.connectedAddrs.add(key);
        const peer = new PeerConnection(addr.host, addr.port, this.metadata.infoHash, this.peerId, this.metadata.pieces.length, {
            onBlock: (index, begin, block) => {
                const blockKey = `${index}:${begin}`;
                void this.store?.addBlock(index, begin, block).then((ok) => {
                    this.inFlightBlocks.delete(blockKey);
                    if (ok) {
                        this.picker?.markComplete(index);
                        this.emit("progress", this.picker?.progress ?? 0);
                        if (this.picker?.isFinished) {
                            this.status = "ready";
                            this.emit("complete");
                        }
                    }
                });
            },
            onHave: () => peer.setInterested(true),
            onChoke: () => { },
            onUnchoke: () => this.scheduleRequests(peer),
            onDisconnect: () => {
                this.peers = this.peers.filter((p) => p !== peer);
                this.connectedAddrs.delete(key);
            },
        });
        this.peers.push(peer);
        peer.connect();
    }
    private startRequestLoop(): void {
        this.requestLoopTimer = setInterval(() => {
            for (const peer of [...this.peers]) {
                if (peer.isUnchoked)
                    this.scheduleRequests(peer);
            }
        }, 50);
    }
    private scheduleRequests(peer: PeerConnection): void {
        if (!this.metadata || !this.picker || !this.store)
            return;
        const pieceHasPendingBlocks = (index: number): boolean => {
            const pieceSize = this.store!.pieceSize(index);
            for (let begin = 0; begin < pieceSize; begin += BLOCK_SIZE) {
                if (!this.inFlightBlocks.has(`${index}:${begin}`))
                    return true;
            }
            return false;
        };
        for (let n = 0; n < 8; n++) {
            const index = this.picker.pickNext(pieceHasPendingBlocks);
            if (index == null)
                return;
            if (!peer.hasPiece(index))
                continue;
            const pieceSize = this.store.pieceSize(index);
            for (let begin = 0; begin < pieceSize; begin += BLOCK_SIZE) {
                const blockKey = `${index}:${begin}`;
                if (this.inFlightBlocks.has(blockKey))
                    continue;
                const length = Math.min(BLOCK_SIZE, pieceSize - begin);
                if (peer.requestBlock(index, begin, length)) {
                    this.inFlightBlocks.add(blockKey);
                    peer.setInterested(true);
                }
            }
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
