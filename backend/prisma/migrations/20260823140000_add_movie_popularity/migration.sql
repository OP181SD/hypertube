-- Popular sort aligned with TMDb popularity (hero + catalog fill).
ALTER TABLE "movies" ADD COLUMN "popularity" DOUBLE PRECISION NOT NULL DEFAULT 0;
CREATE INDEX "movies_popularity_idx" ON "movies"("popularity");
