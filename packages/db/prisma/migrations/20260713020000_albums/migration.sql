-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "label" TEXT,
    "imageUrl" TEXT,
    "musicbrainzId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Recording" ADD COLUMN "albumId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Album_slug_key" ON "Album"("slug");
CREATE UNIQUE INDEX "Album_musicbrainzId_key" ON "Album"("musicbrainzId");
CREATE INDEX "Album_title_idx" ON "Album"("title");
CREATE INDEX "Recording_albumId_idx" ON "Recording"("albumId");

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE SET NULL ON UPDATE CASCADE;
