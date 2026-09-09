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
    "udp://open.stealth.si:80/announce",
    "udp://tracker.torrent.eu.org:451/announce",
    "udp://tracker.moeking.me:6969/announce",
    "udp://exodus.desync.com:6969/announce",
    "udp://tracker.theoks.net:6969/announce",
    "udp://tracker-udp.gbitt.info:80/announce",
    "udp://open.demonii.com:1337/announce",
    "udp://tracker.openbittorrent.com:80/announce",
    "http://tracker.openbittorrent.com:80/announce",
    "udp://explodie.org:6969/announce",
    "udp://tracker1.bt.moack.co.kr:80/announce",
];

/** Always include public trackers — many .torrent announce lists are dead (old YIFY, etc.). */
export function mergeTrackers(...lists: (string[] | undefined)[]): string[] {
    const set = new Set<string>();
    for (const list of lists) {
        for (const t of list ?? []) {
            if (typeof t === "string" && t.length > 0)
                set.add(t);
        }
    }
    for (const t of DEFAULT_TRACKERS)
        set.add(t);
    return [...set];
}
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
