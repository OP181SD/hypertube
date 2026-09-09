import { randomBytes } from "node:crypto";
import { createSocket } from "node:dgram";
import { decode } from "../bencode";

export interface PeerAddress {
  host: string;
  port: number;
}

const CONNECT_TIMEOUT_MS = 5000;
const ANNOUNCE_TIMEOUT_MS = 8000;
/** BEP 15 magic connection id for connect requests. */
const UDP_PROTOCOL_ID = 0x41727101980n;

function parseCompactPeers(buf: Buffer): PeerAddress[] {
  const peers: PeerAddress[] = [];
  for (let i = 0; i + 6 <= buf.length; i += 6) {
    const host = `${buf[i]}.${buf[i + 1]}.${buf[i + 2]}.${buf[i + 3]}`;
    const port = buf.readUInt16BE(i + 4);
    if (port > 0) peers.push({ host, port });
  }
  return peers;
}

export { parseCompactPeers };

/** Percent-encode raw bytes (info_hash / peer_id) for HTTP trackers. */
function encodeBinaryQueryParam(buf: Buffer): string {
  return [...buf].map((b) => `%${b.toString(16).padStart(2, "0")}`).join("");
}

function parsePeersField(peersRaw: unknown): PeerAddress[] {
  if (typeof peersRaw === "string") {
    return parseCompactPeers(Buffer.from(peersRaw, "binary"));
  }
  if (Buffer.isBuffer(peersRaw)) {
    return parseCompactPeers(peersRaw);
  }
  return [];
}

export async function announceHttp(
  trackerUrl: string,
  infoHash: Buffer,
  peerId: Buffer,
  port: number,
  left: number,
  event: "started" | "completed" | null = "started",
): Promise<{ peers: PeerAddress[]; interval: number }> {
  const sep = trackerUrl.includes("?") ? "&" : "?";
  const eventParam = event ? `&event=${event}` : "";
  const query =
    `info_hash=${encodeBinaryQueryParam(infoHash)}` +
    `&peer_id=${encodeBinaryQueryParam(peerId)}` +
    `&port=${port}` +
    `&uploaded=0&downloaded=0&left=${left}` +
    `&compact=1${eventParam}`;
  const fullUrl = `${trackerUrl}${sep}${query}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANNOUNCE_TIMEOUT_MS);
  try {
    const response = await fetch(fullUrl, { signal: controller.signal });
    if (!response.ok) return { peers: [], interval: 180 };
    const buf = Buffer.from(await response.arrayBuffer());
    const { value } = decode(buf);
    const dict = value as Record<string, unknown>;
    if (dict["failure reason"]) {
      throw new Error(String(dict["failure reason"]));
    }
    const interval = typeof dict.interval === "number" ? dict.interval : 180;
    return { peers: parsePeersField(dict.peers), interval };
  } finally {
    clearTimeout(timer);
  }
}

function sendUdp(
  socket: ReturnType<typeof createSocket>,
  host: string,
  port: number,
  message: Buffer,
  expectTx: Buffer,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("UDP tracker timeout"));
    }, CONNECT_TIMEOUT_MS);

    const onMessage = (msg: Buffer) => {
      if (msg.length < 8) return;
      if (!msg.subarray(4, 8).equals(expectTx)) return;
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

export async function announceUdp(
  trackerUrl: string,
  infoHash: Buffer,
  peerId: Buffer,
  port: number,
  left: number,
  event: "started" | "completed" | null = "started",
): Promise<{ peers: PeerAddress[]; interval: number }> {
  const url = new URL(trackerUrl.replace(/^udp:/, "http:"));
  const host = url.hostname;
  const trackerPort = Number(url.port) || 80;
  const socket = createSocket("udp4");
  try {
    const transactionId = randomBytes(4);
    const connectReq = Buffer.alloc(16);
    connectReq.writeBigUInt64BE(UDP_PROTOCOL_ID, 0);
    connectReq.writeUInt32BE(0, 8); // action = connect
    transactionId.copy(connectReq, 12);

    const connectResp = await sendUdp(socket, host, trackerPort, connectReq, transactionId);
    if (connectResp.length < 16) return { peers: [], interval: 180 };
    if (connectResp.readUInt32BE(0) !== 0) return { peers: [], interval: 180 };
    const connectionId = connectResp.subarray(8, 16);

    // BEP 15: 0=none, 1=completed, 2=started, 3=stopped
    const eventCode = event === "started" ? 2 : event === "completed" ? 1 : 0;
    const announceTx = randomBytes(4);
    const announceReq = Buffer.alloc(98);
    connectionId.copy(announceReq, 0);
    announceReq.writeUInt32BE(1, 8); // action = announce
    announceTx.copy(announceReq, 12);
    infoHash.copy(announceReq, 16);
    peerId.copy(announceReq, 36);
    announceReq.writeBigUInt64BE(0n, 56); // downloaded
    announceReq.writeBigUInt64BE(BigInt(Math.max(0, left)), 64); // left
    announceReq.writeBigUInt64BE(0n, 72); // uploaded
    announceReq.writeUInt32BE(eventCode, 80);
    announceReq.writeUInt32BE(0, 84); // IP
    announceReq.writeUInt32BE(randomBytes(4).readUInt32BE(0), 88); // key
    announceReq.writeInt32BE(-1, 92); // num_want
    announceReq.writeUInt16BE(port & 0xffff, 96);

    const announceResp = await sendUdp(socket, host, trackerPort, announceReq, announceTx);
    if (announceResp.length < 20) return { peers: [], interval: 180 };
    if (announceResp.readUInt32BE(0) !== 1) return { peers: [], interval: 180 };
    const interval = announceResp.readUInt32BE(8);
    return { peers: parseCompactPeers(announceResp.subarray(20)), interval };
  } finally {
    socket.close();
  }
}

export async function announceTracker(
  trackerUrl: string,
  infoHash: Buffer,
  peerId: Buffer,
  port: number,
  left: number,
  event: "started" | "completed" | null = "started",
): Promise<{ peers: PeerAddress[]; interval: number }> {
  try {
    if (trackerUrl.startsWith("udp://")) {
      return await announceUdp(trackerUrl, infoHash, peerId, port, left, event);
    }
    if (trackerUrl.startsWith("http://") || trackerUrl.startsWith("https://")) {
      return await announceHttp(trackerUrl, infoHash, peerId, port, left, event);
    }
    return { peers: [], interval: 180 };
  } catch {
    return { peers: [], interval: 180 };
  }
}

/**
 * Announce to all trackers in parallel. Invokes onPeers as soon as each tracker
 * returns so dialing can start before the slowest tracker times out.
 */
export async function announceAllTrackers(
  trackers: string[],
  infoHash: Buffer,
  peerId: Buffer,
  port: number,
  left: number,
  onPeers?: (peers: PeerAddress[]) => void,
  event: "started" | "completed" | null = "started",
): Promise<{ peers: PeerAddress[]; interval: number }> {
  const allPeers = new Map<string, PeerAddress>();
  let minInterval = 180;
  await Promise.allSettled(
    trackers.map(async (t) => {
      const result = await announceTracker(t, infoHash, peerId, port, left, event);
      minInterval = Math.min(minInterval, result.interval);
      if (result.peers.length > 0) {
        for (const peer of result.peers) {
          allPeers.set(`${peer.host}:${peer.port}`, peer);
        }
        onPeers?.(result.peers);
      }
    }),
  );
  return { peers: [...allPeers.values()], interval: minInterval };
}
