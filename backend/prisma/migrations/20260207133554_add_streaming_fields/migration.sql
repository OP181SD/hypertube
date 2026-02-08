-- AlterTable
ALTER TABLE "torrents" ADD COLUMN     "download_status" TEXT NOT NULL DEFAULT 'idle',
ADD COLUMN     "file_path" TEXT,
ADD COLUMN     "last_accessed_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "torrents_download_status_last_accessed_at_idx" ON "torrents"("download_status", "last_accessed_at");
