import { createServer, type Server, type Socket } from "node:net";
import { Logger } from "@nestjs/common";
import { parseHandshake } from "./messages";

const log = new Logger("PeerListener");

export type IncomingPeerHandler = (socket: Socket, initialBuffer: Buffer) => void;

const PREFERRED_PORTS = [6881, 6882, 6883, 6889];

/**
 * Shared TCP listen for inbound BitTorrent peers.
 * Routes connections by info_hash from the handshake to the active download.
 */
class PeerListener {
    private server: Server | null = null;
    private listenPort = 0;
    private starting: Promise<number> | null = null;
    private readonly handlers = new Map<string, IncomingPeerHandler>();

    get port(): number {
        return this.listenPort;
    }

    register(infoHash: Buffer, handler: IncomingPeerHandler): void {
        this.handlers.set(infoHash.toString("hex"), handler);
    }

    unregister(infoHash: Buffer): void {
        this.handlers.delete(infoHash.toString("hex"));
    }

    async ensureListening(): Promise<number> {
        if (this.listenPort > 0)
            return this.listenPort;
        if (this.starting)
            return this.starting;
        this.starting = this.bind();
        try {
            return await this.starting;
        }
        finally {
            this.starting = null;
        }
    }

    private bind(): Promise<number> {
        return new Promise((resolve, reject) => {
            const ports = [...PREFERRED_PORTS, 0];
            let idx = 0;
            const attempt = () => {
                const port = ports[idx++]!;
                const server = createServer((socket) => this.onConnection(socket));
                const onError = (err: NodeJS.ErrnoException) => {
                    server.off("listening", onListening);
                    try {
                        server.close();
                    }
                    catch {
                        /* ignore */
                    }
                    if ((err.code === "EADDRINUSE" || err.code === "EACCES") && idx < ports.length) {
                        attempt();
                        return;
                    }
                    reject(err);
                };
                const onListening = () => {
                    server.off("error", onError);
                    const addr = server.address();
                    this.server = server;
                    this.listenPort = typeof addr === "object" && addr ? addr.port : port;
                    log.log(`[LISTEN] tcp/${this.listenPort} (inbound peers)`);
                    resolve(this.listenPort);
                };
                server.once("error", onError);
                server.once("listening", onListening);
                server.listen(port, "0.0.0.0");
            };
            attempt();
        });
    }

    private onConnection(socket: Socket): void {
        socket.setTimeout(15_000);
        let buf = Buffer.alloc(0);
        const onData = (chunk: Buffer) => {
            buf = Buffer.concat([buf, chunk]);
            if (buf.length < 68)
                return;
            socket.off("data", onData);
            socket.setTimeout(0);
            const hs = parseHandshake(buf);
            if (!hs) {
                socket.destroy();
                return;
            }
            const key = hs.infoHash.toString("hex");
            const handler = this.handlers.get(key);
            if (!handler) {
                log.debug(`[LISTEN] reject unknown hash ${key.slice(0, 8)}…`);
                socket.destroy();
                return;
            }
            handler(socket, buf);
        };
        socket.on("data", onData);
        socket.on("error", () => socket.destroy());
        socket.on("timeout", () => socket.destroy());
    }
}

export const peerListener = new PeerListener();
