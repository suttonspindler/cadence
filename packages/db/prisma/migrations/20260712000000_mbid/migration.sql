-- Add optional MusicBrainz identifiers for the future importer to upsert/dedupe against.
ALTER TABLE "Composer" ADD COLUMN "musicbrainzId" TEXT;
ALTER TABLE "Work" ADD COLUMN "musicbrainzId" TEXT;
ALTER TABLE "Recording" ADD COLUMN "musicbrainzId" TEXT;
ALTER TABLE "Artist" ADD COLUMN "musicbrainzId" TEXT;

CREATE UNIQUE INDEX "Composer_musicbrainzId_key" ON "Composer"("musicbrainzId");
CREATE UNIQUE INDEX "Work_musicbrainzId_key" ON "Work"("musicbrainzId");
CREATE UNIQUE INDEX "Recording_musicbrainzId_key" ON "Recording"("musicbrainzId");
CREATE UNIQUE INDEX "Artist_musicbrainzId_key" ON "Artist"("musicbrainzId");
