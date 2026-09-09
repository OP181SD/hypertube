-- AlterTable
ALTER TABLE "movies" ADD COLUMN "media_type" TEXT NOT NULL DEFAULT 'movie';

-- CreateIndex
CREATE INDEX "movies_media_type_idx" ON "movies"("media_type");
