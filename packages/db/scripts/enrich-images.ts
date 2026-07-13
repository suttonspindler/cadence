// Populate Composer.imageUrl / Artist.imageUrl from Wikipedia portrait thumbnails.
// A lightweight precursor to the full MusicBrainz importer — reliable and quick,
// so the UI has real portraits now. Failures (no page / no image) leave the field
// null and the UI falls back to a monogram placeholder.

import path from "node:path";
import { config as loadEnv } from "dotenv";
import { prisma } from "@cadence/db";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const USER_AGENT =
  "CadenceBot/0.1 (classical music portfolio project; spindler.s@northeastern.edu)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function wikipediaThumbnail(title: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data: { thumbnail?: { source?: string }; originalimage?: { source?: string } } =
      await res.json();
    return data.thumbnail?.source ?? data.originalimage?.source ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const composers = await prisma.composer.findMany();
  let composerHits = 0;
  for (const c of composers) {
    const img = await wikipediaThumbnail(c.name);
    if (img) {
      await prisma.composer.update({ where: { id: c.id }, data: { imageUrl: img } });
      composerHits++;
    }
    await sleep(150);
  }

  const artists = await prisma.artist.findMany();
  let artistHits = 0;
  for (const a of artists) {
    const img = await wikipediaThumbnail(a.name);
    if (img) {
      await prisma.artist.update({ where: { id: a.id }, data: { imageUrl: img } });
      artistHits++;
    }
    await sleep(150);
  }

  console.log(
    `Composer portraits: ${composerHits}/${composers.length} · Artist portraits: ${artistHits}/${artists.length}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
