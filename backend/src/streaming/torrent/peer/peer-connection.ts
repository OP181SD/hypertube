import { EventEmitter } from "node:events";
import { Socket, connect as netConnect } from "node:net";
import { BLOCK_SIZE, MessageId, buildHandshake, encodeMessage, encodeRequest, parseBitfield, parseHandshake, parseMessage, parsePiece, parseHave, } from "./messages";
import { UT_METADATA, buildExtendedHandshake, buildMetadataRequest, parseExtendedHandshake, parseMetadataMessage, } from "./extension";
export interface PeerCallbacks {
    onBlock: (index: number, begin: number, block: Buffer) => void;
    onHave: (index: number) => void;
    onChoke: () => void;
    onUnchoke: () => void;
    onDisconnect: () => void;
    onMetadataSize?: (size: number) => void;
    onMetadataPiece?: (piece: number, data: Buffer) => void;
    onMetadataComplete?: (metadata: Buffer) => void;
}
export class PeerConnection extends EventEmitter {
    private socket: Socket | null = null;
    private buffer = Buffer.alloc(0);
    private handshook = false;
    private peerChoking = true;
    private amChoking = true;
    private amInterested = false;
    private peerInterested = false;
    private peerPieces: boolean[] = [];
    private pendingRequests = new Map<string, {
        index: number;
        begin: number;
    }>();
    private utMetadataId: number | null = null;
    private metadataPieces = new Map<number, Buffer>();
    private metadataSize = 0;
    private destroyed = false;
    constructor(private readonly host: string, private readonly port: number, private readonly infoHash: Buffer, private readonly peerId: Buffer, private readonly pieceCount: number, private readonly callbacks: PeerCallbacks, private readonly fetchMetadata = false) {
        super();
        this.peerPieces = new Array(pieceCount).fill(false);
    }
    get isUnchoked(): boolean {
        return !this.peerChoking;
    }
    get hasAnyPieces(): boolean {
        return this.peerPieces.some(Boolean);
    }
    hasPiece(index: number): boolean {
        return this.peerPieces[index] ?? false;
    }
    connect(): void {
        if (this.destroyed)
            return;
        this.socket = netConnect({ host: this.host, port: this.port });
        this.socket.on("data", (chunk: Buffer | string) => this.onData(Buffer.from(chunk)));
        this.socket.on("error", () => this.disconnect());
        this.socket.on("close", () => this.disconnect());
        this.socket.on("connect", () => {
            this.socket?.write(buildHandshake(this.infoHash, this.peerId, true));
        });
    }
    destroy(): void {
        this.destroyed = true;
        this.socket?.destroy();
        this.socket = null;
    }
    setInterested(interested: boolean): void {
        if (this.amInterested === interested)
            return;
        this.amInterested = interested;
        this.send(interested ? MessageId.Interested : MessageId.NotInterested);
    }
    requestBlock(index: number, begin: number, length: number): boolean {
        if (this.peerChoking || !this.amInterested)
            return false;
        const key = `${index}:${begin}`;
        if (this.pendingRequests.has(key))
            return false;
        this.pendingRequests.set(key, { index, begin });
        this.sendRaw(encodeRequest(index, begin, length));
        return true;
    }
    requestMetadataPiece(piece: number): void {
        if (this.utMetadataId == null)
            return;
        this.sendRaw(buildMetadataRequest(this.utMetadataId, piece));
    }
    private disconnect(): void {
        if (this.destroyed)
            return;
        this.destroyed = true;
        this.socket?.destroy();
        this.socket = null;
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
            this.handshook = true;
            if (this.fetchMetadata) {
                this.sendRaw(buildExtendedHandshake());
            }
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
            case MessageId.Choke:
                this.peerChoking = true;
                this.pendingRequests.clear();
                this.callbacks.onChoke();
                break;
            case MessageId.Unchoke:
                this.peerChoking = false;
                this.callbacks.onUnchoke();
                break;
            case MessageId.Interested:
                this.peerInterested = true;
                break;
            case MessageId.NotInterested:
                this.peerInterested = false;
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
            case MessageId.Piece: {
                const piece = parsePiece(payload);
                if (!piece)
                    break;
                const key = `${piece.index}:${piece.begin}`;
                this.pendingRequests.delete(key);
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
        if (payload[0] === 0) {
            const hs = parseExtendedHandshake(payload);
            if (!hs)
                return;
            this.utMetadataId = hs.m[UT_METADATA] ?? null;
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
        if (this.utMetadataId == null)
            return;
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
