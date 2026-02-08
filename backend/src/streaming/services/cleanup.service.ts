import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { rm } from "node:fs/promises";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    // Delete files from disk
    for (const torrent of staleTorrents) {
      if (!torrent.filePath) continue;

      try {
        await rm(torrent.filePath, { recursive: true, force: true });
        this.logger.log(`Deleted file: ${torrent.filePath}`);
      } catch (error) {
        this.logger.warn(
          `Failed to delete ${torrent.filePath}: ${(error as Error).message}`,
        );
      }
    }

    // Reset DB records
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
