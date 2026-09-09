import { EventEmitter } from "node:events";
import { createReadStream, promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { BLOCK_SIZE } from "../peer/messages";
import type { TorrentFileEntry, TorrentMetadata } from "../metadata/torrent-metadata";

/** Bytes ahead of the read cursor to keep requesting from peers. */
export const STREAM_PRIORITY_WINDOW = 16 * 1024 * 1024;

export class PieceStore extends EventEmitter {
    private readonly pieceBlocks = new Map<number, Map<number, Buffer>>();
    private readonly completed = new Set<number>();
    private readonly waiters = new Map<number, Array<() => void>>();
    constructor(private readonly metadata: TorrentMetadata, private readonly downloadDir: string) {
        super();
    }
    get pieceCount(): number {
        return this.metadata.pieces.length;
    }
    hasPiece(index: number): boolean {
        return this.completed.has(index);
    }
    /**
     * Read a verified piece block for upload (A3).
     * Returns null if the piece is missing or the range is invalid.
     */
    async readBlock(index: number, begin: number, length: number): Promise<Buffer | null> {
        if (!this.completed.has(index))
            return null;
        if (begin < 0 || length <= 0 || length > BLOCK_SIZE * 2)
            return null;
        const size = this.pieceSize(index);
        if (begin >= size || begin + length > size)
            return null;
        const piece = await this.readPieceFromDisk(index, size);
        if (!piece)
            return null;
        return piece.subarray(begin, begin + length);
    }
    /** True if this block is already on disk or buffered for the piece. */
    hasBlock(index: number, begin: number): boolean {
        if (this.completed.has(index))
            return true;
        const b = this.pieceBlocks.get(index)?.get(begin);
        if (!b)
            return false;
        const expectedSize = this.pieceSize(index);
        const len = Math.min(BLOCK_SIZE, expectedSize - begin);
        return b.length >= len;
    }
    /** Completed piece indices (for resuming the picker after disk verify). */
    getCompletedIndices(): number[] {
        return [...this.completed];
    }
    async init(): Promise<void> {
        await fs.mkdir(this.downloadDir, { recursive: true });
        for (const file of this.metadata.files) {
            const filePath = join(this.downloadDir, file.path);
            await fs.mkdir(dirname(filePath), { recursive: true });
            if (file.length <= 0)
                continue;
            // Preserve existing sparse downloads across Nest restarts (do not wipe).
            try {
                const st = await fs.stat(filePath);
                if (st.size === file.length)
                    continue;
            }
            catch {
                // file missing — create below
            }
            const handle = await fs.open(filePath, "w");
            await handle.truncate(file.length);
            await handle.close();
        }
    }
    /**
     * Hash pieces already on disk and mark them complete.
     * Skips empty sparse files entirely. Optional `onlyIndices` for fast prefix resume.
     */
    async resumeVerifiedPieces(onlyIndices?: number[]): Promise<number> {
        if (!(await this.hasAllocatedData())) {
            return 0;
        }
        let resumed = 0;
        const indices = onlyIndices ??
            Array.from({ length: this.metadata.pieces.length }, (_, i) => i);
        for (const index of indices) {
            if (index < 0 || index >= this.metadata.pieces.length)
                continue;
            if (this.completed.has(index))
                continue;
            const expectedSize = this.pieceSize(index);
            const piece = await this.readPieceFromDisk(index, expectedSize);
            if (!piece)
                continue;
            if (isLikelySparseHole(piece))
                continue;
            const hash = createHash("sha1").update(piece).digest();
            if (!hash.equals(this.metadata.pieces[index]))
                continue;
            this.completed.add(index);
            resumed++;
        }
        return resumed;
    }
    /** True if any torrent file has allocated disk blocks (non-empty sparse). */
    async hasAllocatedData(): Promise<boolean> {
        for (const file of this.metadata.files) {
            if (file.length <= 0)
                continue;
            try {
                const st = await fs.stat(join(this.downloadDir, file.path));
                if (typeof st.blocks === "number" && st.blocks > 0)
                    return true;
            }
            catch {
                // missing
            }
        }
        return false;
    }
    clearPieceBlocks(index: number): void {
        this.pieceBlocks.delete(index);
    }
    private async readPieceFromDisk(index: number, expectedSize: number): Promise<Buffer | null> {
        const piece = Buffer.alloc(expectedSize);
        const pieceLength = this.metadata.pieceLength;
        const globalOffset = index * pieceLength;
        let filled = 0;
        for (const file of this.metadata.files) {
            const fileEnd = file.offset + file.length;
            if (globalOffset + expectedSize <= file.offset || globalOffset >= fileEnd)
                continue;
            const filePath = join(this.downloadDir, file.path);
            const localStart = Math.max(0, globalOffset - file.offset);
            const copyStart = Math.max(0, file.offset - globalOffset);
            const copyLen = Math.min(expectedSize - copyStart, file.length - localStart);
            if (copyLen <= 0)
                continue;
            try {
                const handle = await fs.open(filePath, "r");
                await handle.read(piece, copyStart, copyLen, localStart);
                await handle.close();
                filled += copyLen;
            }
            catch {
                return null;
            }
        }
        return filled >= expectedSize ? piece : null;
    }
    pieceSize(index: number): number {
        const pieceLength = this.metadata.pieceLength;
        const isLast = index === this.metadata.pieces.length - 1;
        return isLast ? this.metadata.totalLength - index * pieceLength : pieceLength;
    }
    async addBlock(index: number, begin: number, block: Buffer): Promise<"incomplete" | "hashfail" | "duplicate" | "ok"> {
        if (this.completed.has(index))
            return "duplicate";
        if (block.length === 0)
            return "incomplete";
        let blocks = this.pieceBlocks.get(index);
        if (!blocks) {
            blocks = new Map();
            this.pieceBlocks.set(index, blocks);
        }
        const prev = blocks.get(begin);
        if (!prev || block.length > prev.length)
            blocks.set(begin, block);
        const expectedSize = this.pieceSize(index);
        const blockCount = Math.ceil(expectedSize / BLOCK_SIZE);
        let received = 0;
        for (let i = 0; i < blockCount; i++) {
            const offset = i * BLOCK_SIZE;
            const len = Math.min(BLOCK_SIZE, expectedSize - offset);
            const b = blocks.get(offset);
            // Accept >= requested length (some peers pad / send full 16KiB).
            if (b && b.length >= len)
                received++;
        }
        if (received < blockCount)
            return "incomplete";
        const piece = Buffer.alloc(expectedSize);
        for (let i = 0; i < blockCount; i++) {
            const offset = i * BLOCK_SIZE;
            const len = Math.min(BLOCK_SIZE, expectedSize - offset);
            const b = blocks.get(offset)!;
            b.copy(piece, offset, 0, len);
        }
        const hash = createHash("sha1").update(piece).digest();
        if (!hash.equals(this.metadata.pieces[index])) {
            this.pieceBlocks.delete(index);
            return "hashfail";
        }
        try {
            await this.writePieceToDisk(index, piece);
        }
        catch {
            this.pieceBlocks.delete(index);
            return "hashfail";
        }
        this.pieceBlocks.delete(index);
        this.completed.add(index);
        this.emit("piece", index);
        this.resolveWaiters(index);
        return "ok";
    }
    /** How many blocks are buffered for an in-progress piece. */
    bufferedBlockCount(index: number): number {
        return this.pieceBlocks.get(index)?.size ?? 0;
    }
    private async writePieceToDisk(index: number, data: Buffer): Promise<void> {
        const pieceLength = this.metadata.pieceLength;
        const globalOffset = index * pieceLength;
        for (const file of this.metadata.files) {
            const fileEnd = file.offset + file.length;
            if (globalOffset + data.length <= file.offset || globalOffset >= fileEnd)
                continue;
            const filePath = join(this.downloadDir, file.path);
            const localStart = Math.max(0, globalOffset - file.offset);
            const copyStart = Math.max(0, file.offset - globalOffset);
            const copyLen = Math.min(data.length - copyStart, file.length - localStart);
            if (copyLen > 0) {
                const handle = await fs.open(filePath, "r+");
                await handle.write(data, copyStart, copyLen, localStart);
                await handle.close();
            }
        }
    }
    private resolveWaiters(index: number): void {
        const list = this.waiters.get(index);
        if (!list)
            return;
        this.waiters.delete(index);
        list.forEach((fn) => fn());
    }
    waitForPiece(index: number, signal?: AbortSignal): Promise<void> {
        if (this.completed.has(index))
            return Promise.resolve();
        return new Promise((resolve, reject) => {
            const onAbort = () => {
                cleanup();
                reject(new Error("aborted"));
            };
            const done = () => {
                cleanup();
                resolve();
            };
            const cleanup = () => {
                signal?.removeEventListener("abort", onAbort);
                const list = this.waiters.get(index);
                if (list) {
                    const idx = list.indexOf(done);
                    if (idx >= 0)
                        list.splice(idx, 1);
                }
            };
            signal?.addEventListener("abort", onAbort);
            const list = this.waiters.get(index) ?? [];
            list.push(done);
            this.waiters.set(index, list);
        });
    }
    createReadStream(file: TorrentFileEntry, opts?: {
        start?: number;
        end?: number;
    }, onPriority?: (start: number, end: number) => void): Readable {
        const fileStart = opts?.start ?? 0;
        const fileEnd = opts?.end ?? file.length - 1;
        const pieceLength = this.metadata.pieceLength;
        const globalStart = file.offset + fileStart;
        const globalEnd = file.offset + fileEnd;
        // Prefer a sliding window from the read position — not the entire Range
        // (open-ended bytes=0- would otherwise prioritize the whole multi-GB file).
        onPriority?.(globalStart, Math.min(globalEnd, globalStart + STREAM_PRIORITY_WINDOW - 1));
        // Backpressure: Readable never emits "drain" — resume the pump from read().
        const drainWaiters: Array<() => void> = [];
        const flushWaiters = () => {
            while (drainWaiters.length > 0)
                drainWaiters.shift()?.();
        };
        const stream = new Readable({ read() { flushWaiters(); } });
        const abort = new AbortController();
        stream.on("close", () => {
            abort.abort();
            flushWaiters();
        });
        const waitDrain = () => new Promise<void>((resolve) => drainWaiters.push(resolve));
        void this.pumpFile(stream, file, globalStart, globalEnd, pieceLength, abort.signal, waitDrain, onPriority);
        return stream;
    }
    private async pumpFile(stream: Readable, file: TorrentFileEntry, globalStart: number, globalEnd: number, pieceLength: number, signal: AbortSignal, waitDrain: () => Promise<void>, onPriority?: (start: number, end: number) => void): Promise<void> {
        try {
            let offset = globalStart;
            while (offset <= globalEnd && !stream.destroyed) {
                onPriority?.(offset, Math.min(globalEnd, offset + STREAM_PRIORITY_WINDOW - 1));
                const pieceIndex = Math.floor(offset / pieceLength);
                await this.waitForPiece(pieceIndex, signal);
                const pieceGlobalStart = pieceIndex * pieceLength;
                const chunkEnd = Math.min(globalEnd, pieceGlobalStart + pieceLength - 1);
                const readLen = chunkEnd - offset + 1;
                const filePath = join(this.downloadDir, file.path);
                const localOffset = offset - file.offset;
                const buf = Buffer.alloc(readLen);
                const handle = await fs.open(filePath, "r");
                await handle.read(buf, 0, readLen, localOffset);
                await handle.close();
                if (stream.destroyed)
                    break;
                if (!stream.push(buf))
                    await waitDrain();
                offset += readLen;
            }
            stream.push(null);
        }
        catch {
            stream.destroy();
        }
    }
    static createDiskReadStream(absolutePath: string, opts?: {
        start?: number;
        end?: number;
    }): Readable {
        return createReadStream(absolutePath, { start: opts?.start, end: opts?.end });
    }
}

function isLikelySparseHole(piece: Buffer): boolean {
    if (piece.length === 0)
        return true;
    if (piece[0] !== 0 || piece[piece.length - 1] !== 0)
        return false;
    for (let i = 0; i < 16; i++) {
        if (piece[(i * 9973) % piece.length] !== 0)
            return false;
    }
    return true;
}
