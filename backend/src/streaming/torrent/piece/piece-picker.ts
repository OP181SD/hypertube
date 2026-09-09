export class PiecePicker {
    private readonly completed: boolean[];
    private priorityRange: {
        start: number;
        end: number;
    } | null = null;
    /** torrent-stream-style critical window (highest priority, usually at the read cursor). */
    private readonly critical = new Set<number>();
    private cursor = 0;
    constructor(private readonly pieceCount: number) {
        this.completed = new Array(pieceCount).fill(false);
    }
    setPriorityRange(startByte: number, endByte: number, pieceLength: number): void {
        const startPiece = Math.floor(startByte / pieceLength);
        const endPiece = Math.floor(endByte / pieceLength);
        this.priorityRange = {
            start: Math.max(0, startPiece),
            end: Math.min(this.pieceCount - 1, endPiece),
        };
    }
    clearPriorityRange(): void {
        this.priorityRange = null;
    }
    /**
     * Mark pieces at/near the HTTP read cursor as critical (endgame + first pick).
     * Width mirrors torrent-stream: ~1MB ahead, capped at 2 pieces.
     */
    markCritical(fromPiece: number, width = 2): void {
        this.critical.clear();
        const start = Math.max(0, fromPiece);
        const end = Math.min(this.pieceCount - 1, start + Math.max(1, width) - 1);
        for (let i = start; i <= end; i++)
            this.critical.add(i);
    }
    clearCritical(): void {
        this.critical.clear();
    }
    isCritical(index: number): boolean {
        return this.critical.has(index);
    }
    getCriticalIndices(): number[] {
        return [...this.critical].sort((a, b) => a - b);
    }
    markComplete(index: number): void {
        if (index >= 0 && index < this.pieceCount) {
            this.completed[index] = true;
            this.critical.delete(index);
        }
    }
    isComplete(index: number): boolean {
        return this.completed[index] ?? false;
    }
    get progress(): number {
        const done = this.completed.filter(Boolean).length;
        return this.pieceCount === 0 ? 0 : Math.round((done / this.pieceCount) * 100);
    }
    get isFinished(): boolean {
        return this.completed.every(Boolean);
    }
    pickNext(isBlockInFlight?: (index: number) => boolean): number | null {
        const available = (i: number) => !this.completed[i] && !(isBlockInFlight?.(i) ?? false);
        for (const i of this.getCriticalIndices()) {
            if (available(i))
                return i;
        }
        if (this.priorityRange) {
            for (let i = this.priorityRange.start; i <= this.priorityRange.end; i++) {
                if (available(i))
                    return i;
            }
        }
        for (let i = this.cursor; i < this.pieceCount; i++) {
            if (available(i)) {
                this.cursor = i;
                return i;
            }
        }
        for (let i = 0; i < this.cursor; i++) {
            if (available(i))
                return i;
        }
        return null;
    }
}
