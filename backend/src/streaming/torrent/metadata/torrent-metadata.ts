export interface TorrentFileEntry {
    path: string;
    length: number;
    offset: number;
}
export interface TorrentMetadata {
    infoHash: Buffer;
    infoHashHex: string;
    name: string;
    pieceLength: number;
    pieces: Buffer[];
    files: TorrentFileEntry[];
    totalLength: number;
    trackers: string[];
}
export const DEFAULT_TRACKERS = [
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://tracker.openbittorrent.com:80/announce",
    "udp://open.demonii.com:1337/announce",
];
export function infoHashToHex(hash: Buffer): string {
    return hash.toString("hex");
}
export function hexToInfoHash(hex: string): Buffer {
    const normalized = hex.toLowerCase();
    if (!/^[0-9a-f]{40}$/.test(normalized)) {
        throw new Error(`Invalid info hash hex: ${hex}`);
    }
    return Buffer.from(normalized, "hex");
}
