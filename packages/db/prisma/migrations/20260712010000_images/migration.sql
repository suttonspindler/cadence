-- Image URLs (composer/artist portraits, recording cover art).
ALTER TABLE "Composer" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Artist" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Recording" ADD COLUMN "imageUrl" TEXT;
