-- AlterTable
ALTER TABLE "movies" ADD COLUMN     "cast" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "director" TEXT,
ADD COLUMN     "genres" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "torrents" (
    "id" TEXT NOT NULL,
    "movie_id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "seeds" INTEGER NOT NULL DEFAULT 0,
    "peers" INTEGER NOT NULL DEFAULT 0,
    "size_bytes" BIGINT NOT NULL DEFAULT 0,
    "magnet_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "torrents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "torrents_hash_key" ON "torrents"("hash");

-- CreateIndex
CREATE INDEX "torrents_movie_id_idx" ON "torrents"("movie_id");

-- CreateIndex
CREATE INDEX "movies_title_idx" ON "movies"("title");

-- CreateIndex
CREATE INDEX "movies_imdb_rating_idx" ON "movies"("imdb_rating");

-- CreateIndex
CREATE INDEX "movies_year_idx" ON "movies"("year");

-- AddForeignKey
ALTER TABLE "torrents" ADD CONSTRAINT "torrents_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
