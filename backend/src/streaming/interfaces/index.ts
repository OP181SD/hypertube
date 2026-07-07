import type { Readable } from "node:stream";
export interface DownloadProgress {
    status: "idle" | "downloading" | "ready" | "error";
    progress: number;
    filePath: string | null;
    fileSize: number | null;
    mimeType?: string;
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
    audioCodec: string;
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
