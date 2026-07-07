import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { decode, encode, extractInfoDictRaw } from "./bencode";
import { parseTorrentBuffer } from "./metadata/from-torrent-file";
function buildTestTorrent(pieceContent: Buffer): Buffer {
    const pieceHash = createHash("sha1").update(pieceContent).digest();
    const info = {
        name: "test.mp4",
        length: pieceContent.length,
        "piece length": 16384,
        pieces: pieceHash.toString("binary"),
    };
    const root = {
        announce: "udp://tracker.opentrackr.org:1337/announce",
        info,
    };
    return encode(root);
}
describe("bencode", () => {
    it("round-trips integers", () => {
        const buf = encode(42);
        expect(decode(buf).value).toBe(42);
    });
    it("round-trips strings", () => {
        const buf = encode("hello");
        expect(decode(buf).value).toBe("hello");
    });
    it("round-trips dictionaries with sorted keys", () => {
        const buf = encode({ a: 1, z: "x" });
        const { value } = decode(buf);
        expect(value).toEqual({ a: 1, z: "x" });
    });
    it("round-trips lists", () => {
        const buf = encode([1, "two"]);
        expect(decode(buf).value).toEqual([1, "two"]);
    });
});
describe("torrent metadata", () => {
    it("computes info_hash from raw info dict bytes", () => {
        const piece = Buffer.alloc(100, 0xab);
        const torrentBuf = buildTestTorrent(piece);
        const rawInfo = extractInfoDictRaw(torrentBuf);
        const expectedHash = createHash("sha1").update(rawInfo).digest("hex");
        const meta = parseTorrentBuffer(torrentBuf);
        expect(meta.infoHashHex).toBe(expectedHash);
        expect(meta.name).toBe("test.mp4");
        expect(meta.totalLength).toBe(100);
        expect(meta.pieces).toHaveLength(1);
        expect(meta.files).toHaveLength(1);
    });
});
