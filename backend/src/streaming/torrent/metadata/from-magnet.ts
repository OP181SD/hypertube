import { createHash } from "node:crypto";
import { decode, encode, type BencodeValue } from "../bencode";
import type { TorrentFileEntry, TorrentMetadata } from "./torrent-metadata";
import { mergeTrackers, hexToInfoHash, infoHashToHex } from "./torrent-metadata";
export interface MagnetLink {
    infoHash: Buffer;
    infoHashHex: string;
    displayName?: string;
    trackers: string[];
}
function base32ToInfoHash(encoded: string): Buffer {
    const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
    const cleaned = encoded.toUpperCase().replace(/=+$/, "");
    let bits = "";
    for (const ch of cleaned) {
        const val = alphabet.indexOf(ch.toLowerCase());
        if (val === -1)
            throw new Error(`Invalid base32 char: ${ch}`);
        bits += val.toString(2).padStart(5, "0");
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    const hash = Buffer.from(bytes.slice(0, 20));
    if (hash.length !== 20)
        throw new Error("Invalid base32 info hash length");
    return hash;
}
export function parseMagnetUri(uri: string): MagnetLink {
    if (!uri.startsWith("magnet:?"))
        throw new Error("Invalid magnet URI");
    const params = new URLSearchParams(uri.slice("magnet:?".length));
    const xt = params.get("xt");
    if (!xt)
        throw new Error("Magnet missing xt parameter");
    let infoHash: Buffer;
    const hexMatch = xt.match(/^urn:btih:([0-9a-fA-F]{40})$/i);
    const b32Match = xt.match(/^urn:btih:([0-9a-zA-Z]{32})$/i);
    if (hexMatch)
        infoHash = hexToInfoHash(hexMatch[1]);
    else if (b32Match)
        infoHash = base32ToInfoHash(b32Match[1]);
    else
        throw new Error(`Unsupported magnet xt: ${xt}`);
    const trackers = mergeTrackers(params.getAll("tr").filter(Boolean));
    return {
        infoHash,
        infoHashHex: infoHashToHex(infoHash),
        displayName: params.get("dn") ?? undefined,
        trackers,
    };
}
interface InfoDict {
    name: string;
    "piece length": number;
    pieces: string;
    length?: number;
    files?: {
        length: number;
        path: string | string[];
    }[];
}
function buildFiles(info: InfoDict): TorrentFileEntry[] {
    if (info.length != null) {
        return [{ path: info.name, length: info.length, offset: 0 }];
    }
    const files: TorrentFileEntry[] = [];
    let offset = 0;
    for (const f of info.files ?? []) {
        const pathParts = Array.isArray(f.path) ? f.path : [f.path];
        const path = pathParts.join("/");
        files.push({ path, length: f.length, offset });
        offset += f.length;
    }
    return files;
}
export function metadataFromUtPayload(payload: Buffer, magnet: MagnetLink): TorrentMetadata {
    const infoHash = createHash("sha1").update(payload).digest();
    if (!infoHash.equals(magnet.infoHash)) {
        throw new Error("Metadata info_hash mismatch");
    }
    const { value } = decode(payload);
    const info = value as unknown as InfoDict;
    const pieceHashes: Buffer[] = [];
    const piecesBuf = Buffer.from(info.pieces, "binary");
    for (let i = 0; i < piecesBuf.length; i += 20) {
        pieceHashes.push(piecesBuf.subarray(i, i + 20));
    }
    const files = buildFiles(info);
    return {
        infoHash,
        infoHashHex: infoHashToHex(infoHash),
        name: info.name,
        pieceLength: info["piece length"],
        pieces: pieceHashes,
        files,
        totalLength: files.reduce((sum, f) => sum + f.length, 0),
        trackers: magnet.trackers,
    };
}
export function metadataFromInfoDict(infoDictBytes: Buffer, magnet: MagnetLink): TorrentMetadata {
    const infoHash = createHash("sha1").update(infoDictBytes).digest();
    if (!infoHash.equals(magnet.infoHash)) {
        throw new Error("Metadata info_hash mismatch");
    }
    const inner = infoDictBytes.subarray(1, infoDictBytes.length - 1);
    return metadataFromUtPayload(Buffer.concat([Buffer.from("d"), inner, Buffer.from("e")]), magnet);
}
export function encodeInfoDict(info: Record<string, BencodeValue>): Buffer {
    return encode(info);
}
