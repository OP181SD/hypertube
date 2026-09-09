import type { Readable } from "node:stream";
export interface PlaybackDebug {
    canPlay: boolean;
    cachedCanPlay: boolean;
    needsMoovTail: boolean | null;
    videoName: string | null;
    videoOffset: number | null;
    videoLength: number | null;
    pieceLength: number | null;
    pieceCount: number | null;
    completedPieces: number;
    prefixFirstPiece: number | null;
    prefixLastPiece: number | null;
    prefixHave: number | null;
    prefixNeed: number | null;
    prefixBytes: number;
    tailHave: number | null;
    tailNeed: number | null;
    hasContainerHeader: boolean;
    peersConnected: number;
    peersUnchoked: number;
    peersQueued: number;
    inFlightBlocks: number;
    downloadDir: string | null;
}
export interface DownloadProgress {
    status: "idle" | "searching" | "downloading" | "converting" | "ready" | "error";
    progress: number;
    filePath: string | null;
    fileSize: number | null;
    mimeType?: string;
    error?: "no_sources";
    debug?: PlaybackDebug;
}
export interface StreamResult {
    stream: Readable;
    mimeType: string;
    fileSize: number | null;
    start?: number;
    end?: number;
    totalSize?: number;
}
export interface SubtitleEntry {
    lang: string;
    label: string;
    fileId: string;
}
export interface OpenSubtitlesResult {
    id: string;
    attributes: {
        language: string;
        files: {
            file_id: number;
            file_name: string;
        }[];
    };
}
export interface OpenSubtitlesSearchResponse {
    total_count: number;
    data: OpenSubtitlesResult[];
}
export interface OpenSubtitlesDownloadResponse {
    link: string;
    file_name: string;
}
export interface VideoInfo {
    format: string;
    duration: number;
    videoCodec: string;
    videoHeight: number;
    audioCodec: string;
    audioChannels: number;
}
export interface TorrentFile {
    name: string;
    path: string;
    length: number;
    createReadStream: (opts?: {
        start?: number;
        end?: number;
    }) => Readable;
}
