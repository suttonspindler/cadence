-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Era" AS ENUM ('MEDIEVAL', 'RENAISSANCE', 'BAROQUE', 'CLASSICAL', 'ROMANTIC', 'LATE_ROMANTIC', 'MODERN', 'CONTEMPORARY');

-- CreateEnum
CREATE TYPE "PerformanceTradition" AS ENUM ('HISTORICALLY_INFORMED', 'PERIOD_INSTRUMENT', 'ROMANTIC', 'TRADITIONAL', 'MODERN', 'OTHER');

-- CreateEnum
CREATE TYPE "ArtistKind" AS ENUM ('PERSON', 'ENSEMBLE');

-- CreateEnum
CREATE TYPE "CreditRole" AS ENUM ('SOLOIST', 'PERFORMER', 'CONDUCTOR', 'ENSEMBLE', 'CHOIR');

-- CreateEnum
CREATE TYPE "RagSourceType" AS ENUM ('COMPOSER_BIO', 'WORK_DESCRIPTION', 'RECORDING_NOTES', 'REVIEW', 'HISTORICAL_CONTEXT');

-- CreateTable
CREATE TABLE "Composer" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortName" TEXT NOT NULL,
    "birthYear" INTEGER,
    "deathYear" INTEGER,
    "era" "Era" NOT NULL,
    "nationality" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Composer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Work" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "composerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "catalogNumber" TEXT,
    "key" TEXT,
    "genre" TEXT,
    "composedYear" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movement" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "tempoMarking" TEXT,

    CONSTRAINT "Movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "year" INTEGER,
    "label" TEXT,
    "tradition" "PerformanceTradition" NOT NULL DEFAULT 'OTHER',
    "notes" TEXT,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ArtistKind" NOT NULL,
    "instrument" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingCredit" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "role" "CreditRole" NOT NULL,

    CONSTRAINT "RecordingCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "body" TEXT,
    "performanceQuality" INTEGER,
    "soundQuality" INTEGER,
    "historicalAuthenticity" INTEGER,
    "emotionalImpact" INTEGER,
    "recommendationLevel" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listen" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "listenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RagChunk" (
    "id" TEXT NOT NULL,
    "sourceType" "RagSourceType" NOT NULL,
    "sourceId" TEXT,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RagChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Composer_slug_key" ON "Composer"("slug");

-- CreateIndex
CREATE INDEX "Composer_sortName_idx" ON "Composer"("sortName");

-- CreateIndex
CREATE INDEX "Composer_era_idx" ON "Composer"("era");

-- CreateIndex
CREATE UNIQUE INDEX "Work_slug_key" ON "Work"("slug");

-- CreateIndex
CREATE INDEX "Work_composerId_idx" ON "Work"("composerId");

-- CreateIndex
CREATE INDEX "Work_genre_idx" ON "Work"("genre");

-- CreateIndex
CREATE INDEX "Movement_workId_idx" ON "Movement"("workId");

-- CreateIndex
CREATE UNIQUE INDEX "Movement_workId_position_key" ON "Movement"("workId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Recording_slug_key" ON "Recording"("slug");

-- CreateIndex
CREATE INDEX "Recording_workId_idx" ON "Recording"("workId");

-- CreateIndex
CREATE INDEX "Recording_tradition_idx" ON "Recording"("tradition");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_slug_key" ON "Artist"("slug");

-- CreateIndex
CREATE INDEX "Artist_kind_idx" ON "Artist"("kind");

-- CreateIndex
CREATE INDEX "Artist_name_idx" ON "Artist"("name");

-- CreateIndex
CREATE INDEX "RecordingCredit_artistId_idx" ON "RecordingCredit"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingCredit_recordingId_artistId_role_key" ON "RecordingCredit"("recordingId", "artistId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Review_recordingId_idx" ON "Review"("recordingId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_recordingId_key" ON "Review"("userId", "recordingId");

-- CreateIndex
CREATE INDEX "Listen_userId_idx" ON "Listen"("userId");

-- CreateIndex
CREATE INDEX "Listen_recordingId_idx" ON "Listen"("recordingId");

-- CreateIndex
CREATE INDEX "Collection_userId_idx" ON "Collection"("userId");

-- CreateIndex
CREATE INDEX "CollectionItem_collectionId_idx" ON "CollectionItem"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_collectionId_recordingId_key" ON "CollectionItem"("collectionId", "recordingId");

-- CreateIndex
CREATE INDEX "RagChunk_sourceType_idx" ON "RagChunk"("sourceType");

-- AddForeignKey
ALTER TABLE "Work" ADD CONSTRAINT "Work_composerId_fkey" FOREIGN KEY ("composerId") REFERENCES "Composer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingCredit" ADD CONSTRAINT "RecordingCredit_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingCredit" ADD CONSTRAINT "RecordingCredit_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listen" ADD CONSTRAINT "Listen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listen" ADD CONSTRAINT "Listen_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;
