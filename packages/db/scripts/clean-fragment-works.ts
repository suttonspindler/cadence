// Remove imported works that are really movement/aria/scene fragments (and any
// artists left with no credits afterward). Uses the same filter as the importer.

import path from "node:path";
import { config as loadEnv } from "dotenv";
import { prisma } from "@cadence/db";
import { isMovementLike } from "../import/filters";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

async function main() {
  const works = await prisma.work.findMany({
    where: { musicbrainzId: { not: null } },
    select: { id: true, title: true },
  });
  const fragmentIds = works.filter((w) => isMovementLike(w.title)).map((w) => w.id);
  const delWorks = await prisma.work.deleteMany({ where: { id: { in: fragmentIds } } });

  const orphans = await prisma.artist.findMany({
    where: { musicbrainzId: { not: null }, credits: { none: {} } },
    select: { id: true },
  });
  const delArtists = await prisma.artist.deleteMany({
    where: { id: { in: orphans.map((o) => o.id) } },
  });

  const [w, r, a, emptyComposers] = await Promise.all([
    prisma.work.count(),
    prisma.recording.count(),
    prisma.artist.count(),
    prisma.composer.count({ where: { works: { none: {} } } }),
  ]);
  console.log(
    `Deleted ${delWorks.count} fragment works, ${delArtists.count} orphan artists.\n` +
      `Now: ${w} works, ${r} recordings, ${a} artists. Composers with 0 works: ${emptyComposers}.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
