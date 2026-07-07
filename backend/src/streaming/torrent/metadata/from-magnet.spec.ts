import { describe, it, expect } from "vitest";
import { parseMagnetUri } from "./from-magnet";
describe("from-magnet", () => {
    it("parses hex info hash and trackers", () => {
        const uri = "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=Test&tr=udp%3A%2F%2Ftracker.example%3A80";
        const link = parseMagnetUri(uri);
        expect(link.infoHashHex).toBe("0123456789abcdef0123456789abcdef01234567");
        expect(link.displayName).toBe("Test");
        expect(link.trackers.some((t) => t.includes("tracker.example"))).toBe(true);
    });
    it("rejects invalid magnet URIs", () => {
        expect(() => parseMagnetUri("http://example.com")).toThrow();
    });
});
