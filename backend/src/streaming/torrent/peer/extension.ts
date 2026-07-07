import { decode, encode, skipValue, type BencodeValue } from "../bencode";
import { BLOCK_SIZE, MessageId, encodeMessage } from "./messages";
export const UT_METADATA = "ut_metadata";
export const EXTENDED_HANDSHAKE = 0;
export interface ExtensionHandshake {
    m: Record<string, number>;
    metadataSize?: number;
}
export function buildExtendedHandshake(metadataSize?: number): Buffer {
    const dict: Record<string, BencodeValue> = {
        m: { [UT_METADATA]: 1 },
    };
    if (metadataSize != null)
        dict.metadata_size = metadataSize;
    const payload = Buffer.concat([Buffer.from([EXTENDED_HANDSHAKE]), encode(dict)]);
    return encodeMessage(MessageId.Extended, payload);
}
export function parseExtendedHandshake(payload: Buffer): ExtensionHandshake | null {
    if (payload.length < 1 || payload[0] !== EXTENDED_HANDSHAKE)
        return null;
    try {
        const { value } = decode(payload.subarray(1));
        const dict = value as Record<string, unknown>;
        const m = (dict.m as Record<string, number>) ?? {};
        const metadataSize = typeof dict.metadata_size === "number" ? dict.metadata_size : undefined;
        return { m, metadataSize };
    }
    catch {
        return null;
    }
}
export function buildMetadataRequest(extId: number, piece: number): Buffer {
    const body = encode({ msg_type: 0, piece });
    const payload = Buffer.concat([Buffer.from([extId]), body]);
    return encodeMessage(MessageId.Extended, payload);
}
export function parseMetadataMessage(payload: Buffer): {
    msgType: number;
    piece: number;
    totalSize?: number;
    data?: Buffer;
} | null {
    if (payload.length < 1)
        return null;
    try {
        const dictStart = 1;
        const { value } = decode(payload.subarray(dictStart));
        const dict = value as Record<string, unknown>;
        const msgType = dict.msg_type as number;
        const piece = dict.piece as number;
        const totalSize = dict.total_size as number | undefined;
        const dictEnd = skipValue(payload, dictStart);
        const data = msgType === 1 ? payload.subarray(dictEnd) : undefined;
        return { msgType, piece, totalSize, data };
    }
    catch {
        return null;
    }
}
export function splitMetadataPayload(buf: Buffer, pieceLength = BLOCK_SIZE): Buffer[] {
    const pieces: Buffer[] = [];
    for (let i = 0; i < buf.length; i += pieceLength) {
        pieces.push(buf.subarray(i, Math.min(i + pieceLength, buf.length)));
    }
    return pieces;
}
