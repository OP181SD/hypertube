export const BLOCK_SIZE = 16 * 1024;
export const PROTOCOL_STRING = "BitTorrent protocol";
export const PROTOCOL_BUFFER = Buffer.from(PROTOCOL_STRING);
export enum MessageId {
    Choke = 0,
    Unchoke = 1,
    Interested = 2,
    NotInterested = 3,
    Have = 4,
    Bitfield = 5,
    Request = 6,
    Piece = 7,
    Cancel = 8,
    Extended = 20
}
export function buildHandshake(infoHash: Buffer, peerId: Buffer, enableExtensions = true): Buffer {
    const reserved = Buffer.alloc(8);
    if (enableExtensions)
        reserved[5] |= 0x10;
    return Buffer.concat([
        Buffer.from([PROTOCOL_BUFFER.length]),
        PROTOCOL_BUFFER,
        reserved,
        infoHash,
        peerId,
    ]);
}
export function parseHandshake(buf: Buffer): {
    infoHash: Buffer;
    peerId: Buffer;
    extensions: boolean;
} | null {
    if (buf.length < 68)
        return null;
    const pstrlen = buf[0];
    if (pstrlen !== PROTOCOL_BUFFER.length)
        return null;
    if (!buf.subarray(1, 20).equals(PROTOCOL_BUFFER))
        return null;
    const reserved = buf.subarray(20, 28);
    return {
        extensions: (reserved[5] & 0x10) !== 0,
        infoHash: buf.subarray(28, 48),
        peerId: buf.subarray(48, 68),
    };
}
export function encodeMessage(id: MessageId, payload: Buffer = Buffer.alloc(0)): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(1 + payload.length);
    return Buffer.concat([len, Buffer.from([id]), payload]);
}
export function encodeRequest(pieceIndex: number, begin: number, length: number): Buffer {
    const payload = Buffer.alloc(12);
    payload.writeUInt32BE(pieceIndex, 0);
    payload.writeUInt32BE(begin, 4);
    payload.writeUInt32BE(length, 8);
    return encodeMessage(MessageId.Request, payload);
}
export function encodeHave(pieceIndex: number): Buffer {
    const payload = Buffer.alloc(4);
    payload.writeUInt32BE(pieceIndex, 0);
    return encodeMessage(MessageId.Have, payload);
}
export function parseMessage(buf: Buffer): {
    id: MessageId;
    payload: Buffer;
} | null {
    if (buf.length < 5)
        return null;
    const len = buf.readUInt32BE(0);
    if (len === 0)
        return { id: MessageId.Choke, payload: Buffer.alloc(0) };
    if (buf.length < 4 + len)
        return null;
    const id = buf[4] as MessageId;
    const payload = buf.subarray(5, 4 + len);
    return { id, payload };
}
export function parseRequest(payload: Buffer): {
    index: number;
    begin: number;
    length: number;
} | null {
    if (payload.length < 12)
        return null;
    return {
        index: payload.readUInt32BE(0),
        begin: payload.readUInt32BE(4),
        length: payload.readUInt32BE(8),
    };
}
export function parsePiece(payload: Buffer): {
    index: number;
    begin: number;
    block: Buffer;
} | null {
    if (payload.length < 8)
        return null;
    return {
        index: payload.readUInt32BE(0),
        begin: payload.readUInt32BE(4),
        block: payload.subarray(8),
    };
}
export function parseHave(payload: Buffer): number | null {
    if (payload.length < 4)
        return null;
    return payload.readUInt32BE(0);
}
export function parseBitfield(payload: Buffer, pieceCount: number): boolean[] {
    const have: boolean[] = new Array(pieceCount).fill(false);
    for (let i = 0; i < pieceCount; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = 7 - (i % 8);
        if (byteIndex < payload.length) {
            have[i] = ((payload[byteIndex] >> bitIndex) & 1) === 1;
        }
    }
    return have;
}
