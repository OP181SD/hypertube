import { createHash } from "node:crypto";
import { decode, extractInfoDictRaw } from "../bencode";
import type { TorrentMetadata, TorrentFileEntry } from "./torrent-metadata";
import { DEFAULT_TRACKERS, infoHashToHex } from "./torrent-metadata";
interface TorrentDict {
    announce?: string;
    "announce-list"?: (string | string[])[];
    info: InfoDict;
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
function collectTrackers(root: TorrentDict): string[] {
    const trackers = new Set<string>();
    if (root.announce)
        trackers.add(root.announce);
    const list = root["announce-list"];
    if (Array.isArray(list)) {
        for (const tier of list) {
            if (typeof tier === "string")
                trackers.add(tier);
            else if (Array.isArray(tier))
                tier.forEach((t) => trackers.add(t));
        }
    }
    if (trackers.size === 0)
        DEFAULT_TRACKERS.forEach((t) => trackers.add(t));
    return [...trackers];
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
export function parseTorrentBuffer(buf: Buffer): TorrentMetadata {
    const rawInfo = extractInfoDictRaw(buf);
    const infoHash = createHash("sha1").update(rawInfo).digest();
    const { value } = decode(buf);
    const root = value as unknown as TorrentDict;
    const info = root.info as InfoDict;
    if (!info?.name || !info["piece length"] || !info.pieces) {
        throw new Error("Invalid torrent: missing info fields");
    }
    const pieceHashes: Buffer[] = [];
    const piecesBuf = Buffer.from(info.pieces, "binary");
    for (let i = 0; i < piecesBuf.length; i += 20) {
        pieceHashes.push(piecesBuf.subarray(i, i + 20));
    }
    const files = buildFiles(info);
    const totalLength = files.reduce((sum, f) => sum + f.length, 0);
    return {
        infoHash,
        infoHashHex: infoHashToHex(infoHash),
        name: info.name,
        pieceLength: info["piece length"],
        pieces: pieceHashes,
        files,
        totalLength,
        trackers: collectTrackers(root),
    };
}
export async function loadTorrentFromUrl(url: string): Promise<TorrentMetadata> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch torrent file: ${response.status}`);
    }
    const buf = Buffer.from(await response.arrayBuffer());
    return parseTorrentBuffer(buf);
}
