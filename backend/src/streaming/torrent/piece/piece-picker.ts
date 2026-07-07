export class PiecePicker {
    private readonly completed: boolean[];
    private priorityRange: {
        start: number;
        end: number;
    } | null = null;
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
    markComplete(index: number): void {
        if (index >= 0 && index < this.pieceCount) {
            this.completed[index] = true;
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
