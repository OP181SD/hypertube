import { EventEmitter } from "node:events";
import { Socket, connect as netConnect } from "node:net";
import {
    BLOCK_SIZE,
    MessageId,
    buildHandshake,
    encodeBitfield,
    encodeCancel,
    encodeHave,
    encodeMessage,
    encodePiece,
    encodeRequest,
    parseBitfield,
    parseHandshake,
    parseMessage,
    parsePiece,
    parseHave,
    parseRequest,
} from "./messages";
import {
    UT_METADATA,
    UT_PEX,
    LOCAL_UT_PEX_ID,
    LOCAL_UT_METADATA_ID,
    buildExtendedHandshake,
    buildMetadataRequest,
    buildPexMessage,
    parseExtendedHandshake,
    parseMetadataMessage,
    parsePexMessage,
} from "./extension";
import type { PeerAddress } from "../tracker/tracker-client";

/** Outstanding block requests per peer (BitTorrent pipeline). */
export const MAX_PEER_PIPELINE = 64;
/** Max block size we will fulfill for a peer Request (A3). */
export const MAX_UPLOAD_BLOCK = 32 * 1024;

export interface PeerCallbacks {
    onBlock: (index: number, begin: number, block: Buffer) => void;
    onHave: (index: number) => void;
    onChoke: (releasedRequests?: string[]) => void;
    onUnchoke: () => void;
    onDisconnect: () => void;
    onHandshakeComplete?: () => void;
    onPeerInterest?: (interested: boolean) => void;
    onPeerRequest?: (index: number, begin: number, length: number) => void;
    onMetadataSize?: (size: number) => void;
    onMetadataPiece?: (piece: number, data: Buffer) => void;
    onMetadataComplete?: (metadata: Buffer) => void;
    onPexPeers?: (peers: PeerAddress[]) => void;
}

export class PeerConnection extends EventEmitter {
    private socket: Socket | null = null;
    private buffer = Buffer.alloc(0);
    private handshook = false;
    private incoming = false;
    private peerChoking = true;
    private amChoking = true;
    private amInterested = false;
    private peerInterested = false;
    private peerPieces: boolean[] = [];
    private pendingRequests = new Map<string, {
        index: number;
        begin: number;
        length: number;
        at: number;
    }>();
    private lastBlockAt = Date.now();
    private connectedAt = Date.now();
    private utMetadataId: number | null = null;
    private utPexId: number | null = null;
    private metadataPieces = new Map<number, Buffer>();
    private metadataSize = 0;
    private destroyed = false;
    private extendedSent = false;

    constructor(
        private host: string,
        private port: number,
        private readonly infoHash: Buffer,
        private readonly peerId: Buffer,
        private readonly pieceCount: number,
        private readonly callbacks: PeerCallbacks,
        private readonly fetchMetadata = false,
    ) {
        super();
        this.peerPieces = new Array(pieceCount).fill(false);
    }

    get isUnchoked(): boolean {
        return !this.peerChoking;
    }
    get peerWantsData(): boolean {
        return this.peerInterested;
    }
    get weAreChoking(): boolean {
        return this.amChoking;
    }
    get pendingCount(): number {
        return this.pendingRequests.size;
    }
    get address(): string {
        return `${this.host}:${this.port}`;
    }
    /** Peer has outstanding requests but sent no piece data recently. */
    get isSnubbed(): boolean {
        return this.pendingRequests.size > 0 && Date.now() - this.lastBlockAt > 20_000;
    }
    get hasAnyPieces(): boolean {
        return this.peerPieces.some(Boolean);
    }
    get ageMs(): number {
        return Date.now() - this.connectedAt;
    }
    get supportsPex(): boolean {
        return this.utPexId != null;
    }
    hasPiece(index: number): boolean {
        return this.peerPieces[index] ?? false;
    }

    connect(): void {
        if (this.destroyed)
            return;
        this.incoming = false;
        this.socket = netConnect({ host: this.host, port: this.port });
        this.socket.setTimeout(10_000);
        this.socket.on("timeout", () => this.disconnect());
        this.socket.on("data", (chunk: Buffer | string) => this.onData(Buffer.from(chunk)));
        this.socket.on("error", () => this.disconnect());
        this.socket.on("close", () => this.disconnect());
        this.socket.on("connect", () => {
            this.socket?.setTimeout(0);
            this.socket?.write(buildHandshake(this.infoHash, this.peerId, true));
        });
    }

    /** Attach an inbound TCP peer (remote already dialed us; handshake in initialBuffer). */
    acceptIncoming(socket: Socket, initialBuffer: Buffer): void {
        if (this.destroyed)
            return;
        this.incoming = true;
        this.host = (socket.remoteAddress ?? "0.0.0.0").replace(/^::ffff:/, "");
        this.port = socket.remotePort ?? 0;
        this.socket = socket;
        socket.setTimeout(0);
        socket.on("data", (chunk: Buffer | string) => this.onData(Buffer.from(chunk)));
        socket.on("error", () => this.disconnect());
        socket.on("close", () => this.disconnect());
        if (initialBuffer.length > 0)
            this.onData(initialBuffer);
    }

    destroy(): void {
        this.disconnect();
    }

    setInterested(interested: boolean): void {
        if (this.amInterested === interested)
            return;
        this.amInterested = interested;
        this.send(interested ? MessageId.Interested : MessageId.NotInterested);
    }

    /** Tit-for-tat: choke/unchoke this peer for upload (A3). */
    setChoking(choking: boolean): void {
        if (this.amChoking === choking)
            return;
        this.amChoking = choking;
        this.send(choking ? MessageId.Choke : MessageId.Unchoke);
    }

    sendBitfield(have: boolean[]): void {
        if (!this.handshook)
            return;
        this.sendRaw(encodeBitfield(have));
    }

    sendHave(index: number): void {
        if (!this.handshook)
            return;
        this.sendRaw(encodeHave(index));
    }

    sendPiece(index: number, begin: number, block: Buffer): void {
        if (!this.handshook || this.amChoking)
            return;
        this.sendRaw(encodePiece(index, begin, block));
    }

    /** B3: push compact peer list via ut_pex. */
    sendPex(peers: PeerAddress[]): void {
        if (!this.handshook || this.utPexId == null || peers.length === 0)
            return;
        this.sendRaw(buildPexMessage(this.utPexId, peers.slice(0, 50)));
    }

    requestBlock(index: number, begin: number, length: number): boolean {
        if (this.peerChoking || !this.amInterested)
            return false;
        if (this.pendingRequests.size >= MAX_PEER_PIPELINE)
            return false;
        const key = `${index}:${begin}`;
        if (this.pendingRequests.has(key))
            return false;
        this.pendingRequests.set(key, { index, begin, length, at: Date.now() });
        this.sendRaw(encodeRequest(index, begin, length));
        return true;
    }

    /** Cancel stale outstanding requests (>timeoutMs with no matching piece). */
    cancelStaleRequests(timeoutMs: number): string[] {
        const now = Date.now();
        const cancelled: string[] = [];
        for (const [key, req] of this.pendingRequests) {
            if (now - req.at < timeoutMs)
                continue;
            this.sendRaw(encodeCancel(req.index, req.begin, req.length));
            this.pendingRequests.delete(key);
            cancelled.push(key);
        }
        return cancelled;
    }

    requestMetadataPiece(piece: number): void {
        if (this.utMetadataId == null)
            return;
        this.sendRaw(buildMetadataRequest(this.utMetadataId, piece));
    }

    private releasePending(): void {
        if (this.pendingRequests.size === 0)
            return;
        const released = [...this.pendingRequests.keys()];
        this.pendingRequests.clear();
        this.callbacks.onChoke(released);
    }

    private disconnect(): void {
        if (this.destroyed)
            return;
        this.releasePending();
        this.destroyed = true;
        const sock = this.socket;
        this.socket = null;
        sock?.destroy();
        this.callbacks.onDisconnect();
    }

    private send(id: MessageId): void {
        this.sendRaw(encodeMessage(id));
    }

    private sendRaw(buf: Buffer): void {
        if (!this.socket || this.socket.destroyed)
            return;
        this.socket.write(buf);
    }

    private maybeSendExtendedHandshake(): void {
        if (this.extendedSent)
            return;
        this.extendedSent = true;
        this.sendRaw(buildExtendedHandshake());
    }

    private onData(chunk: Buffer): void {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        if (!this.handshook) {
            if (this.buffer.length < 68)
                return;
            const hs = parseHandshake(this.buffer);
            if (!hs) {
                this.disconnect();
                return;
            }
            if (!hs.infoHash.equals(this.infoHash)) {
                this.disconnect();
                return;
            }
            this.buffer = this.buffer.subarray(68);
            // Inbound: reply with our handshake after theirs (outgoing already sent on connect).
            if (this.incoming)
                this.sendRaw(buildHandshake(this.infoHash, this.peerId, true));
            this.handshook = true;
            // Always negotiate extensions (ut_metadata + ut_pex) when peer supports them.
            if (hs.extensions)
                this.maybeSendExtendedHandshake();
            else if (this.fetchMetadata)
                this.maybeSendExtendedHandshake();
            this.callbacks.onHandshakeComplete?.();
        }
        while (this.buffer.length >= 4) {
            const msgLen = this.buffer.readUInt32BE(0);
            if (msgLen === 0) {
                this.buffer = this.buffer.subarray(4);
                continue;
            }
            if (this.buffer.length < 4 + msgLen)
                break;
            const msgBuf = this.buffer.subarray(0, 4 + msgLen);
            this.buffer = this.buffer.subarray(4 + msgLen);
            const msg = parseMessage(msgBuf);
            if (!msg)
                continue;
            this.handleMessage(msg.id, msg.payload);
        }
    }

    private handleMessage(id: MessageId, payload: Buffer): void {
        switch (id) {
            case MessageId.Choke: {
                this.peerChoking = true;
                const released = [...this.pendingRequests.keys()];
                this.pendingRequests.clear();
                this.callbacks.onChoke(released);
                break;
            }
            case MessageId.Unchoke:
                this.peerChoking = false;
                this.callbacks.onUnchoke();
                break;
            case MessageId.Interested:
                this.peerInterested = true;
                this.callbacks.onPeerInterest?.(true);
                break;
            case MessageId.NotInterested:
                this.peerInterested = false;
                this.callbacks.onPeerInterest?.(false);
                break;
            case MessageId.Have: {
                const index = parseHave(payload);
                if (index != null && index < this.pieceCount) {
                    this.peerPieces[index] = true;
                    this.callbacks.onHave(index);
                }
                break;
            }
            case MessageId.Bitfield:
                this.peerPieces = parseBitfield(payload, this.pieceCount);
                if (this.peerPieces.some(Boolean) && !this.amInterested) {
                    this.setInterested(true);
                }
                break;
            case MessageId.Request: {
                if (this.amChoking)
                    break;
                const req = parseRequest(payload);
                if (!req)
                    break;
                if (req.index < 0 || req.index >= this.pieceCount)
                    break;
                if (req.begin < 0 || req.length <= 0 || req.length > MAX_UPLOAD_BLOCK)
                    break;
                this.callbacks.onPeerRequest?.(req.index, req.begin, req.length);
                break;
            }
            case MessageId.Piece: {
                const piece = parsePiece(payload);
                if (!piece)
                    break;
                const key = `${piece.index}:${piece.begin}`;
                this.pendingRequests.delete(key);
                this.lastBlockAt = Date.now();
                this.callbacks.onBlock(piece.index, piece.begin, piece.block);
                break;
            }
            case MessageId.Extended:
                this.handleExtended(payload);
                break;
            default:
                break;
        }
    }

    private handleExtended(payload: Buffer): void {
        if (payload.length < 1)
            return;
        const extId = payload[0]!;
        if (extId === 0) {
            const hs = parseExtendedHandshake(payload);
            if (!hs)
                return;
            this.utMetadataId = hs.m[UT_METADATA] ?? null;
            this.utPexId = hs.m[UT_PEX] ?? null;
            if (hs.metadataSize) {
                this.metadataSize = hs.metadataSize;
                this.callbacks.onMetadataSize?.(hs.metadataSize);
            }
            if (this.fetchMetadata && this.utMetadataId != null) {
                const pieceCount = Math.ceil(this.metadataSize / BLOCK_SIZE) || 1;
                for (let i = 0; i < pieceCount; i++)
                    this.requestMetadataPiece(i);
            }
            return;
        }
        if (extId === LOCAL_UT_PEX_ID) {
            const peers = parsePexMessage(payload);
            if (peers.length > 0)
                this.callbacks.onPexPeers?.(peers);
            return;
        }
        if (extId === LOCAL_UT_METADATA_ID || extId === this.utMetadataId) {
            const meta = parseMetadataMessage(payload);
            if (!meta)
                return;
            if (meta.msgType === 1 && meta.data) {
                this.metadataPieces.set(meta.piece, meta.data);
                this.callbacks.onMetadataPiece?.(meta.piece, meta.data);
                if (this.metadataSize > 0) {
                    const assembled = Buffer.alloc(this.metadataSize);
                    let complete = true;
                    const pieceCount = Math.ceil(this.metadataSize / BLOCK_SIZE);
                    for (let i = 0; i < pieceCount; i++) {
                        const part = this.metadataPieces.get(i);
                        if (!part) {
                            complete = false;
                            break;
                        }
                        const offset = i * BLOCK_SIZE;
                        part.copy(assembled, offset, 0, Math.min(part.length, assembled.length - offset));
                    }
                    if (complete)
                        this.callbacks.onMetadataComplete?.(assembled);
                }
            }
        }
    }
}
