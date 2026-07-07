import { describe, it, expect } from "vitest";
import { MessageId, buildHandshake, encodeMessage, encodeRequest, parseHandshake, parseMessage, parseBitfield, } from "./messages";
describe("peer messages", () => {
    it("builds and parses handshake", () => {
        const infoHash = Buffer.alloc(20, 1);
        const peerId = Buffer.alloc(20, 2);
        const hs = buildHandshake(infoHash, peerId, true);
        const parsed = parseHandshake(hs);
        expect(parsed?.infoHash.equals(infoHash)).toBe(true);
        expect(parsed?.extensions).toBe(true);
    });
    it("encodes request messages", () => {
        const msg = encodeRequest(3, 0, 16384);
        const parsed = parseMessage(msg);
        expect(parsed?.id).toBe(MessageId.Request);
        expect(parsed?.payload.readUInt32BE(0)).toBe(3);
    });
    it("parses bitfield", () => {
        const bf = Buffer.from([0b10100000]);
        const have = parseBitfield(bf, 3);
        expect(have).toEqual([true, false, true]);
    });
    it("encodes choke message", () => {
        const msg = encodeMessage(MessageId.Choke);
        expect(parseMessage(msg)?.id).toBe(MessageId.Choke);
    });
});
