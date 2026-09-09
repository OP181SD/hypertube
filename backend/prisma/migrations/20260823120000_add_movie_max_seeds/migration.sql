-- Popular library sort: denormalized max torrent seeds (YTS + EZTV).
ALTER TABLE "movies" ADD COLUMN "max_seeds" INTEGER NOT NULL DEFAULT 0;

UPDATE "movies" AS m
SET "max_seeds" = COALESCE((
  SELECT MAX(t."seeds") FROM "torrents" t WHERE t."movie_id" = m."id"
), 0);

CREATE INDEX "movies_max_seeds_idx" ON "movies"("max_seeds");
