import { randomBytes } from "node:crypto";
import { createSocket, type Socket } from "node:dgram";
import { EventEmitter } from "node:events";
import { Logger } from "@nestjs/common";
import { decode, encode, type BencodeValue } from "../bencode";
import type { PeerAddress } from "../tracker/tracker-client";
import { parseCompactPeers } from "../tracker/tracker-client";

const log = new Logger("DhtClient");

const BOOTSTRAP: PeerAddress[] = [
    { host: "router.bittorrent.com", port: 6881 },
    { host: "dht.transmissionbt.com", port: 6881 },
    { host: "router.utorrent.com", port: 6881 },
    { host: "dht.aelitis.com", port: 6881 },
    { host: "router.silotis.us", port: 6881 },
    { host: "dht.libtorrent.org", port: 25401 },
];

/** Process-wide node cache so successive downloads bootstrap faster (B2). */
const globalNodeCache = new Map<string, DhtNode>();

interface DhtNode {
    id: Buffer;
    host: string;
    port: number;
}

function xorDistance(a: Buffer, b: Buffer): Buffer {
    const out = Buffer.alloc(20);
    for (let i = 0; i < 20; i++)
        out[i] = (a[i] ?? 0) ^ (b[i] ?? 0);
    return out;
}

function distanceCmp(a: Buffer, b: Buffer): number {
    for (let i = 0; i < 20; i++) {
        if (a[i] !== b[i])
            return a[i]! - b[i]!;
    }
    return 0;
}

function binStr(buf: Buffer): string {
    return buf.toString("binary");
}

function fromBin(s: unknown): Buffer | null {
    if (typeof s === "string")
        return Buffer.from(s, "binary");
    if (Buffer.isBuffer(s))
        return s;
    return null;
}

function parseCompactNodes(buf: Buffer): DhtNode[] {
    const nodes: DhtNode[] = [];
    for (let i = 0; i + 26 <= buf.length; i += 26) {
        const id = Buffer.from(buf.subarray(i, i + 20));
        const host = `${buf[i + 20]}.${buf[i + 21]}.${buf[i + 22]}.${buf[i + 23]}`;
        const port = buf.readUInt16BE(i + 24);
        if (port > 0)
            nodes.push({ id, host, port });
    }
    return nodes;
}

/**
 * Minimal BEP 5 DHT client: bootstrap + iterative get_peers + announce_peer.
 * Hand-rolled (no bittorrent-dht) to stay subject-compliant.
 */
export class DhtClient extends EventEmitter {
    private readonly nodeId = randomBytes(20);
    private socket: Socket | null = null;
    private readonly nodes = new Map<string, DhtNode>();
    private readonly pending = new Map<string, {
        resolve: (msg: Record<string, unknown>) => void;
        reject: (err: Error) => void;
        timer: ReturnType<typeof setTimeout>;
    }>();
    private destroyed = false;
    private tid = 0;

    async start(): Promise<void> {
        if (this.socket)
            return;
        this.socket = createSocket("udp4");
        this.socket.on("message", (msg, rinfo) => this.onMessage(msg, rinfo.address, rinfo.port));
        this.socket.on("error", (err) => log.warn(`[DHT] socket error: ${err.message}`));
        await new Promise<void>((resolve) => {
            this.socket!.bind(0, () => resolve());
        });
        const port = this.socket.address().port;
        log.log(`[DHT] listening udp/${port}`);
        // Seed from process cache before contacting bootstrap routers.
        for (const [k, n] of globalNodeCache)
            this.nodes.set(k, n);
        await this.bootstrap();
    }

    destroy(): void {
        this.destroyed = true;
        for (const [, p] of this.pending) {
            clearTimeout(p.timer);
            p.reject(new Error("dht destroyed"));
        }
        this.pending.clear();
        this.socket?.close();
        this.socket = null;
        // Keep globalNodeCache — do not clear process-wide table.
        this.nodes.clear();
    }

    /**
     * Iterative get_peers; optionally announce our listen port to nodes that returned a token.
     */
    async lookup(
        infoHash: Buffer,
        onPeers?: (peers: PeerAddress[]) => void,
        opts?: { rounds?: number; announcePort?: number },
    ): Promise<PeerAddress[]> {
        if (!this.socket || this.destroyed)
            return [];
        const rounds = opts?.rounds ?? 8;
        const found = new Map<string, PeerAddress>();
        const queried = new Set<string>();
        const tokens = new Map<string, { node: DhtNode; token: Buffer }>();
        let closest = this.closestNodes(infoHash, 16);
        if (closest.length === 0) {
            await this.bootstrap();
            closest = this.closestNodes(infoHash, 16);
        }

        for (let round = 0; round < rounds && !this.destroyed; round++) {
            const batch = closest.filter((n) => !queried.has(`${n.host}:${n.port}`)).slice(0, 16);
            if (batch.length === 0)
                break;
            await Promise.all(batch.map(async (node) => {
                const key = `${node.host}:${node.port}`;
                queried.add(key);
                try {
                    const resp = await this.query(node, "get_peers", {
                        id: binStr(this.nodeId),
                        info_hash: binStr(infoHash),
                    });
                    const r = (resp.r ?? {}) as Record<string, unknown>;
                    const token = fromBin(r.token);
                    if (token)
                        tokens.set(key, { node, token });
                    const values = r.values;
                    if (Array.isArray(values)) {
                        for (const v of values) {
                            const peers = typeof v === "string"
                                ? parseCompactPeers(Buffer.from(v, "binary"))
                                : [];
                            for (const p of peers) {
                                const pk = `${p.host}:${p.port}`;
                                if (!found.has(pk)) {
                                    found.set(pk, p);
                                    onPeers?.([p]);
                                }
                            }
                        }
                    }
                    else if (typeof values === "string") {
                        for (const p of parseCompactPeers(Buffer.from(values, "binary"))) {
                            const pk = `${p.host}:${p.port}`;
                            if (!found.has(pk)) {
                                found.set(pk, p);
                                onPeers?.([p]);
                            }
                        }
                    }
                    const nodesRaw = fromBin(r.nodes);
                    if (nodesRaw)
                        this.rememberNodes(parseCompactNodes(nodesRaw));
                }
                catch {
                    // timeout / bad node
                }
            }));
            closest = this.closestNodes(infoHash, 32);
        }

        if (opts?.announcePort && opts.announcePort > 0 && tokens.size > 0) {
            const targets = [...tokens.values()].slice(0, 12);
            await Promise.all(targets.map(async ({ node, token }) => {
                try {
                    await this.query(node, "announce_peer", {
                        id: binStr(this.nodeId),
                        info_hash: binStr(infoHash),
                        port: opts.announcePort!,
                        token: binStr(token),
                        implied_port: 0,
                    }, 3000);
                }
                catch {
                    // ignore announce failures
                }
            }));
            log.log(`[DHT] announce_peer → ${targets.length} nodes port=${opts.announcePort}`);
        }

        log.log(`[DHT] lookup done peers=${found.size} nodes=${this.nodes.size} queried=${queried.size}`);
        return [...found.values()];
    }

    private async bootstrap(): Promise<void> {
        await Promise.all(BOOTSTRAP.map(async (boot) => {
            try {
                const resp = await this.query(boot, "find_node", {
                    id: binStr(this.nodeId),
                    target: binStr(this.nodeId),
                }, 2500);
                const r = (resp.r ?? {}) as Record<string, unknown>;
                const nodesRaw = fromBin(r.nodes);
                if (nodesRaw)
                    this.rememberNodes(parseCompactNodes(nodesRaw));
                const id = fromBin(r.id);
                if (id)
                    this.rememberNodes([{ id, host: boot.host, port: boot.port }]);
            }
            catch {
                log.debug(`[DHT] bootstrap miss ${boot.host}:${boot.port}`);
            }
        }));
        log.log(`[DHT] bootstrap nodes=${this.nodes.size}`);
    }

    private rememberNodes(list: DhtNode[]): void {
        for (const n of list) {
            if (n.port <= 0 || n.host.startsWith("0."))
                continue;
            const key = `${n.host}:${n.port}`;
            this.nodes.set(key, n);
            globalNodeCache.set(key, n);
        }
        if (this.nodes.size > 600) {
            const keys = [...this.nodes.keys()].slice(0, this.nodes.size - 400);
            for (const k of keys)
                this.nodes.delete(k);
        }
        if (globalNodeCache.size > 800) {
            const keys = [...globalNodeCache.keys()].slice(0, globalNodeCache.size - 500);
            for (const k of keys)
                globalNodeCache.delete(k);
        }
    }

    private closestNodes(target: Buffer, n: number): DhtNode[] {
        return [...this.nodes.values()]
            .map((node) => ({ node, d: xorDistance(node.id, target) }))
            .sort((a, b) => distanceCmp(a.d, b.d))
            .slice(0, n)
            .map((x) => x.node);
    }

    private nextTid(): string {
        this.tid = (this.tid + 1) & 0xffff;
        const buf = Buffer.alloc(2);
        buf.writeUInt16BE(this.tid);
        return buf.toString("binary");
    }

    private query(
        dest: { host: string; port: number },
        q: string,
        a: Record<string, BencodeValue>,
        timeoutMs = 3500,
    ): Promise<Record<string, unknown>> {
        return new Promise((resolve, reject) => {
            if (!this.socket || this.destroyed) {
                reject(new Error("dht not started"));
                return;
            }
            const t = this.nextTid();
            const msg = encode({
                t,
                y: "q",
                q,
                a,
            });
            const timer = setTimeout(() => {
                this.pending.delete(t);
                reject(new Error("dht timeout"));
            }, timeoutMs);
            this.pending.set(t, { resolve, reject, timer });
            this.socket.send(msg, dest.port, dest.host, (err) => {
                if (err) {
                    clearTimeout(timer);
                    this.pending.delete(t);
                    reject(err);
                }
            });
        });
    }

    private onMessage(msg: Buffer, host: string, port: number): void {
        try {
            const { value } = decode(msg);
            const dict = value as Record<string, unknown>;
            const t = dict.t;
            const tid = typeof t === "string" ? t : null;
            if (!tid)
                return;
            const y = dict.y;
            if (y === "r") {
                const pending = this.pending.get(tid);
                if (pending) {
                    clearTimeout(pending.timer);
                    this.pending.delete(tid);
                    pending.resolve(dict);
                }
                const r = dict.r as Record<string, unknown> | undefined;
                const id = fromBin(r?.id);
                if (id)
                    this.rememberNodes([{ id, host, port }]);
                return;
            }
            if (y === "q") {
                this.replyQuery(dict, host, port);
            }
        }
        catch {
            // ignore garbage
        }
    }

    private replyQuery(dict: Record<string, unknown>, host: string, port: number): void {
        if (!this.socket)
            return;
        const t = dict.t;
        if (typeof t !== "string")
            return;
        const q = dict.q;
        const r: Record<string, BencodeValue> = { id: binStr(this.nodeId) };
        if (q === "ping") {
            // ok
        }
        else if (q === "find_node" || q === "get_peers" || q === "announce_peer") {
            const a = dict.a as Record<string, unknown> | undefined;
            const target = fromBin(a?.target ?? a?.info_hash) ?? this.nodeId;
            const closest = this.closestNodes(target, 8);
            const compact = Buffer.alloc(closest.length * 26);
            closest.forEach((n, i) => {
                n.id.copy(compact, i * 26);
                const parts = n.host.split(".").map(Number);
                compact[i * 26 + 20] = parts[0] ?? 0;
                compact[i * 26 + 21] = parts[1] ?? 0;
                compact[i * 26 + 22] = parts[2] ?? 0;
                compact[i * 26 + 23] = parts[3] ?? 0;
                compact.writeUInt16BE(n.port, i * 26 + 24);
            });
            r.nodes = binStr(compact);
            if (q === "get_peers")
                r.token = binStr(randomBytes(8));
        }
        else {
            return;
        }
        const resp = encode({ t, y: "r", r });
        this.socket.send(resp, port, host);
    }
}
