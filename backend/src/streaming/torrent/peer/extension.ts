import { decode, encode, skipValue, type BencodeValue } from "../bencode";
import { BLOCK_SIZE, MessageId, encodeMessage } from "./messages";
import type { PeerAddress } from "../tracker/tracker-client";
import { parseCompactPeers } from "../tracker/tracker-client";

export const UT_METADATA = "ut_metadata";
export const UT_PEX = "ut_pex";
export const EXTENDED_HANDSHAKE = 0;

/** Local extension IDs we advertise (remote maps them in its handshake). */
export const LOCAL_UT_METADATA_ID = 1;
export const LOCAL_UT_PEX_ID = 2;

export interface ExtensionHandshake {
    m: Record<string, number>;
    metadataSize?: number;
}

export function buildExtendedHandshake(metadataSize?: number): Buffer {
    const dict: Record<string, BencodeValue> = {
        m: {
            [UT_METADATA]: LOCAL_UT_METADATA_ID,
            [UT_PEX]: LOCAL_UT_PEX_ID,
        },
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

function compactPeers(peers: PeerAddress[]): Buffer {
    const buf = Buffer.alloc(peers.length * 6);
    peers.forEach((p, i) => {
        const parts = p.host.split(".").map((x) => Number(x));
        buf[i * 6] = parts[0] ?? 0;
        buf[i * 6 + 1] = parts[1] ?? 0;
        buf[i * 6 + 2] = parts[2] ?? 0;
        buf[i * 6 + 3] = parts[3] ?? 0;
        buf.writeUInt16BE(p.port & 0xffff, i * 6 + 4);
    });
    return buf;
}

/** BEP 11 — build ut_pex message with compact IPv4 peers. */
export function buildPexMessage(remoteExtId: number, peers: PeerAddress[]): Buffer {
    const added = compactPeers(peers);
    const flags = Buffer.alloc(peers.length, 0);
    const body = encode({
        added: added.toString("binary"),
        "added.f": flags.toString("binary"),
    });
    const payload = Buffer.concat([Buffer.from([remoteExtId]), body]);
    return encodeMessage(MessageId.Extended, payload);
}

/** BEP 11 — parse ut_pex "added" compact peer list. */
export function parsePexMessage(payload: Buffer): PeerAddress[] {
    if (payload.length < 1)
        return [];
    try {
        const { value } = decode(payload.subarray(1));
        const dict = value as Record<string, unknown>;
        const added = dict.added;
        if (typeof added === "string")
            return parseCompactPeers(Buffer.from(added, "binary"));
        if (Buffer.isBuffer(added))
            return parseCompactPeers(added);
        return [];
    }
    catch {
        return [];
    }
}
