import { randomBytes } from "node:crypto";
import { createSocket } from "node:dgram";
import { decode } from "../bencode";
export interface PeerAddress {
    host: string;
    port: number;
}
const CONNECT_TIMEOUT_MS = 5000;
const ANNOUNCE_TIMEOUT_MS = 5000;
function parseCompactPeers(buf: Buffer): PeerAddress[] {
    const peers: PeerAddress[] = [];
    for (let i = 0; i + 6 <= buf.length; i += 6) {
        const host = `${buf[i]}.${buf[i + 1]}.${buf[i + 2]}.${buf[i + 3]}`;
        const port = buf.readUInt16BE(i + 4);
        if (port > 0)
            peers.push({ host, port });
    }
    return peers;
}
export async function announceHttp(trackerUrl: string, infoHash: Buffer, peerId: Buffer, port: number, left: number): Promise<{
    peers: PeerAddress[];
    interval: number;
}> {
    const url = new URL(trackerUrl);
    url.searchParams.set("info_hash", infoHash.toString("binary"));
    url.searchParams.set("peer_id", peerId.toString("binary"));
    url.searchParams.set("port", String(port));
    url.searchParams.set("uploaded", "0");
    url.searchParams.set("downloaded", "0");
    url.searchParams.set("left", String(left));
    url.searchParams.set("compact", "1");
    url.searchParams.set("event", "started");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ANNOUNCE_TIMEOUT_MS);
    try {
        const response = await fetch(url.toString(), { signal: controller.signal });
        if (!response.ok)
            return { peers: [], interval: 180 };
        const buf = Buffer.from(await response.arrayBuffer());
        const { value } = decode(buf);
        const dict = value as Record<string, unknown>;
        if (dict["failure reason"]) {
            throw new Error(String(dict["failure reason"]));
        }
        const peersRaw = dict.peers;
        const peers = typeof peersRaw === "string"
            ? parseCompactPeers(Buffer.from(peersRaw, "binary"))
            : [];
        const interval = typeof dict.interval === "number" ? dict.interval : 180;
        return { peers, interval };
    }
    finally {
        clearTimeout(timer);
    }
}
function sendUdp(socket: ReturnType<typeof createSocket>, host: string, port: number, message: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off("message", onMessage);
            reject(new Error("UDP tracker timeout"));
        }, CONNECT_TIMEOUT_MS);
        const onMessage = (msg: Buffer) => {
            clearTimeout(timer);
            socket.off("message", onMessage);
            resolve(msg);
        };
        socket.on("message", onMessage);
        socket.send(message, port, host, (err) => {
            if (err) {
                clearTimeout(timer);
                socket.off("message", onMessage);
                reject(err);
            }
        });
    });
}
export async function announceUdp(trackerUrl: string, infoHash: Buffer, peerId: Buffer, port: number, left: number): Promise<{
    peers: PeerAddress[];
    interval: number;
}> {
    const url = new URL(trackerUrl.replace(/^udp:/, "http:"));
    const host = url.hostname;
    const trackerPort = Number(url.port) || 80;
    const socket = createSocket("udp4");
    try {
        const transactionId = randomBytes(4);
        const connectReq = Buffer.alloc(16);
        connectReq.writeUInt32BE(0x00000417, 0);
        connectReq.writeUInt32BE(0, 4);
        transactionId.copy(connectReq, 12);
        const connectResp = await sendUdp(socket, host, trackerPort, connectReq);
        if (connectResp.length < 16)
            return { peers: [], interval: 180 };
        if (!connectResp.subarray(4, 8).equals(Buffer.from([0, 0, 0, 0]))) {
            return { peers: [], interval: 180 };
        }
        if (!connectResp.subarray(12, 16).equals(transactionId)) {
            return { peers: [], interval: 180 };
        }
        const connectionId = connectResp.subarray(8, 16);
        const announceTx = randomBytes(4);
        const announceReq = Buffer.alloc(98);
        connectionId.copy(announceReq, 0);
        announceReq.writeUInt32BE(1, 8);
        announceTx.copy(announceReq, 12);
        infoHash.copy(announceReq, 16);
        peerId.copy(announceReq, 36);
        announceReq.writeBigUInt64BE(0n, 56);
        announceReq.writeBigUInt64BE(0n, 64);
        announceReq.writeBigUInt64BE(BigInt(left), 72);
        announceReq.writeUInt32BE(0, 80);
        announceReq.writeUInt32BE(0, 84);
        announceReq.writeUInt32BE(-1, 88);
        announceReq.writeUInt32BE(port, 92);
        announceReq.writeUInt32BE(0, 96);
        const announceResp = await sendUdp(socket, host, trackerPort, announceReq);
        if (announceResp.length < 20)
            return { peers: [], interval: 180 };
        const action = announceResp.readUInt32BE(4);
        if (action !== 1)
            return { peers: [], interval: 180 };
        const interval = announceResp.readUInt32BE(8);
        const peerData = announceResp.subarray(20);
        return { peers: parseCompactPeers(peerData), interval };
    }
    finally {
        socket.close();
    }
}
export async function announceTracker(trackerUrl: string, infoHash: Buffer, peerId: Buffer, port: number, left: number): Promise<{
    peers: PeerAddress[];
    interval: number;
}> {
    try {
        if (trackerUrl.startsWith("udp://")) {
            return await announceUdp(trackerUrl, infoHash, peerId, port, left);
        }
        if (trackerUrl.startsWith("http://") || trackerUrl.startsWith("https://")) {
            return await announceHttp(trackerUrl, infoHash, peerId, port, left);
        }
        return { peers: [], interval: 180 };
    }
    catch {
        return { peers: [], interval: 180 };
    }
}
export async function announceAllTrackers(trackers: string[], infoHash: Buffer, peerId: Buffer, port: number, left: number): Promise<{
    peers: PeerAddress[];
    interval: number;
}> {
    const allPeers = new Map<string, PeerAddress>();
    let minInterval = 180;
    const results = await Promise.allSettled(trackers.map((t) => announceTracker(t, infoHash, peerId, port, left)));
    for (const result of results) {
        if (result.status !== "fulfilled")
            continue;
        minInterval = Math.min(minInterval, result.value.interval);
        for (const peer of result.value.peers) {
            allPeers.set(`${peer.host}:${peer.port}`, peer);
        }
    }
    return { peers: [...allPeers.values()], interval: minInterval };
}
