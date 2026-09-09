import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { rm } from "node:fs/promises";
import { join } from "node:path";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
@Injectable()
export class CleanupService {
    private readonly logger = new Logger(CleanupService.name);
    private readonly storagePath: string;
    constructor(private readonly prisma: PrismaService, configService: ConfigService) {
        this.storagePath = join(process.cwd(), configService.get<string>("STORAGE_PATH") ?? "./data/videos");
    }
    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async handleCleanup(): Promise<void> {
        this.logger.log("Starting stale torrent cleanup...");
        const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
        const staleTorrents = await this.prisma.torrent.findMany({
            where: {
                downloadStatus: "ready",
                lastAccessedAt: { lt: cutoff },
            },
        });
        if (staleTorrents.length === 0) {
            this.logger.log("No stale torrents to clean up");
            return;
        }
        this.logger.log(`Found ${staleTorrents.length} stale torrents to clean up`);
        for (const torrent of staleTorrents) {
            const torrentDir = join(this.storagePath, torrent.hash);
            try {
                await rm(torrentDir, { recursive: true, force: true });
                this.logger.log(`Deleted torrent directory: ${torrentDir}`);
            }
            catch (error) {
                this.logger.warn(`Failed to delete ${torrentDir}: ${(error as Error).message}`);
            }
            if (torrent.filePath && torrent.filePath !== torrentDir) {
                try {
                    await rm(torrent.filePath, { recursive: true, force: true });
                }
                catch {
                    // A path already gone is the outcome we were after.
                }
            }
        }
        const ids = staleTorrents.map((t) => t.id);
        await this.prisma.torrent.updateMany({
            where: { id: { in: ids } },
            data: {
                downloadStatus: "idle",
                filePath: null,
                lastAccessedAt: null,
            },
        });
        this.logger.log(`Cleaned up ${staleTorrents.length} torrents`);
    }
}
