export type BencodeValue = string | number | BencodeValue[] | {
    [key: string]: BencodeValue;
};
export function decode(buf: Buffer, offset = 0): {
    value: BencodeValue;
    next: number;
} {
    const byte = buf[offset];
    if (byte === 0x69) {
        let i = offset + 1;
        const end = buf.indexOf(0x65, i);
        if (end === -1)
            throw new Error("Unterminated bencode integer");
        const num = Number(buf.subarray(i, end).toString("ascii"));
        if (!Number.isFinite(num))
            throw new Error("Invalid bencode integer");
        return { value: num, next: end + 1 };
    }
    if (byte === 0x6c) {
        const items: BencodeValue[] = [];
        let pos = offset + 1;
        while (buf[pos] !== 0x65) {
            const item = decode(buf, pos);
            items.push(item.value);
            pos = item.next;
        }
        return { value: items, next: pos + 1 };
    }
    if (byte === 0x64) {
        const dict: Record<string, BencodeValue> = {};
        let pos = offset + 1;
        while (buf[pos] !== 0x65) {
            const keyResult = decode(buf, pos);
            if (typeof keyResult.value !== "string") {
                throw new Error("Bencode dict key must be a string");
            }
            const valResult = decode(buf, keyResult.next);
            dict[keyResult.value] = valResult.value;
            pos = valResult.next;
        }
        return { value: dict, next: pos + 1 };
    }
    if (byte >= 0x30 && byte <= 0x39) {
        const colon = buf.indexOf(0x3a, offset);
        if (colon === -1)
            throw new Error("Invalid bencode string");
        const len = Number(buf.subarray(offset, colon).toString("ascii"));
        if (!Number.isInteger(len) || len < 0)
            throw new Error("Invalid bencode string length");
        const start = colon + 1;
        const end = start + len;
        if (end > buf.length)
            throw new Error("Bencode string exceeds buffer");
        return { value: buf.subarray(start, end).toString("binary"), next: end };
    }
    throw new Error(`Unexpected bencode byte 0x${byte.toString(16)} at offset ${offset}`);
}
export function encode(value: BencodeValue): Buffer {
    if (typeof value === "string") {
        const data = Buffer.from(value, "binary");
        return Buffer.concat([Buffer.from(`${data.length}:`), data]);
    }
    if (typeof value === "number") {
        return Buffer.from(`i${Math.trunc(value)}e`);
    }
    if (Array.isArray(value)) {
        return Buffer.concat([Buffer.from("l"), ...value.map(encode), Buffer.from("e")]);
    }
    const keys = Object.keys(value).sort();
    return Buffer.concat([
        Buffer.from("d"),
        ...keys.flatMap((k) => [encode(k), encode(value[k])]),
        Buffer.from("e"),
    ]);
}
export function skipValue(buf: Buffer, offset: number): number {
    return decode(buf, offset).next;
}
export function extractInfoDictRaw(buf: Buffer): Buffer {
    const marker = Buffer.from("4:info");
    const idx = buf.indexOf(marker);
    if (idx === -1)
        throw new Error("info key not found in torrent file");
    const dictStart = idx + marker.length;
    if (buf[dictStart] !== 0x64)
        throw new Error("info value is not a dictionary");
    let depth = 0;
    for (let i = dictStart; i < buf.length; i++) {
        const b = buf[i];
        if (b === 0x64 || b === 0x6c) {
            depth++;
        }
        else if (b === 0x65) {
            depth--;
            if (depth === 0)
                return buf.subarray(dictStart, i + 1);
        }
        else if (b >= 0x30 && b <= 0x39) {
            const colon = buf.indexOf(0x3a, i);
            const len = Number(buf.subarray(i, colon).toString("ascii"));
            i = colon + len;
        }
        else if (b === 0x69) {
            const end = buf.indexOf(0x65, i + 1);
            i = end;
        }
    }
    throw new Error("Unclosed info dictionary");
}
