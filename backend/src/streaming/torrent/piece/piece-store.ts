import { EventEmitter } from "node:events";
import { createReadStream, promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { BLOCK_SIZE } from "../peer/messages";
import type { TorrentFileEntry, TorrentMetadata } from "../metadata/torrent-metadata";
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
    async init(): Promise<void> {
        await fs.mkdir(this.downloadDir, { recursive: true });
        for (const file of this.metadata.files) {
            const filePath = join(this.downloadDir, file.path);
            await fs.mkdir(dirname(filePath), { recursive: true });
            if (file.length > 0) {
                const handle = await fs.open(filePath, "w");
                await handle.truncate(file.length);
                await handle.close();
            }
        }
    }
    pieceSize(index: number): number {
        const pieceLength = this.metadata.pieceLength;
        const isLast = index === this.metadata.pieces.length - 1;
        return isLast ? this.metadata.totalLength - index * pieceLength : pieceLength;
    }
    async addBlock(index: number, begin: number, block: Buffer): Promise<boolean> {
        if (this.completed.has(index))
            return false;
        let blocks = this.pieceBlocks.get(index);
        if (!blocks) {
            blocks = new Map();
            this.pieceBlocks.set(index, blocks);
        }
        blocks.set(begin, block);
        const expectedSize = this.pieceSize(index);
        const blockCount = Math.ceil(expectedSize / BLOCK_SIZE);
        let received = 0;
        for (let i = 0; i < blockCount; i++) {
            const offset = i * BLOCK_SIZE;
            const len = Math.min(BLOCK_SIZE, expectedSize - offset);
            const b = blocks.get(offset);
            if (b && b.length === len)
                received++;
        }
        if (received < blockCount)
            return false;
        const piece = Buffer.alloc(expectedSize);
        for (let i = 0; i < blockCount; i++) {
            const offset = i * BLOCK_SIZE;
            const b = blocks.get(offset)!;
            b.copy(piece, offset);
        }
        const hash = createHash("sha1").update(piece).digest();
        if (!hash.equals(this.metadata.pieces[index])) {
            this.pieceBlocks.delete(index);
            return false;
        }
        await this.writePieceToDisk(index, piece);
        this.pieceBlocks.delete(index);
        this.completed.add(index);
        this.emit("piece", index);
        this.resolveWaiters(index);
        return true;
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
        onPriority?.(file.offset + fileStart, file.offset + fileEnd);
        const pieceLength = this.metadata.pieceLength;
        const globalStart = file.offset + fileStart;
        const globalEnd = file.offset + fileEnd;
        const stream = new Readable({ read() { } });
        const abort = new AbortController();
        stream.on("close", () => abort.abort());
        void this.pumpFile(stream, file, globalStart, globalEnd, pieceLength, abort.signal);
        return stream;
    }
    private async pumpFile(stream: Readable, file: TorrentFileEntry, globalStart: number, globalEnd: number, pieceLength: number, signal: AbortSignal): Promise<void> {
        try {
            let offset = globalStart;
            while (offset <= globalEnd && !stream.destroyed) {
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
                if (!stream.push(buf)) {
                    await new Promise<void>((resolve) => stream.once("drain", resolve));
                }
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
