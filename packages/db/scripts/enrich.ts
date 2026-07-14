// Enrich the catalog with Wikipedia content: composer/artist bios + portraits,
// and work descriptions. Reliable and quick (one Wikipedia call per entity),
// so the RAG assistant has real prose to draw on before the full MusicBrainz
// import. Idempotent — safe to re-run. Run after `db:seed`, then re-embed with
// `ai:reindex` + `ai:rag`.

import path from "node:path";
import { config as loadEnv } from "dotenv";
import { prisma } from "@cadence/db";
import { wikipediaSummary, composerSummary, sleep } from "./wikipedia";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

async function main() {
  // --- Composers: bio + portrait ---
  const composers = await prisma.composer.findMany();
  let cBio = 0;
  let cImg = 0;
  for (const c of composers) {
    const s = await composerSummary(c.name);
    if (s) {
      const data: { bio?: string; imageUrl?: string } = {};
      if (s.extract) {
        data.bio = s.extract;
        cBio++;
      }
      if (s.thumbnail) {
        data.imageUrl = s.thumbnail;
        cImg++;
      }
      if (Object.keys(data).length) await prisma.composer.update({ where: { id: c.id }, data });
    }
    await sleep(150);
  }

  // --- Artists: bio + portrait ---
  const artists = await prisma.artist.findMany();
  let aBio = 0;
  let aImg = 0;
  for (const a of artists) {
    const s = await wikipediaSummary(a.name);
    if (s) {
      const data: { bio?: string; imageUrl?: string } = {};
      if (s.extract) {
        data.bio = s.extract;
        aBio++;
      }
      if (s.thumbnail) {
        data.imageUrl = s.thumbnail;
        aImg++;
      }
      if (Object.keys(data).length) await prisma.artist.update({ where: { id: a.id }, data });
    }
    await sleep(150);
  }

  // --- Works: description (best-effort). Classical work titles collide, so try a
  // composer-qualified title first and only accept a result whose extract actually
  // mentions the composer's surname — guards against grabbing the wrong article. ---
  const works = await prisma.work.findMany({ include: { composer: true } });
  let wDesc = 0;
  for (const w of works) {
    const surname = w.composer.name.split(/\s+/).pop() ?? "";
    const candidates = [`${w.title} (${surname})`, w.title];
    for (const title of candidates) {
      const s = await wikipediaSummary(title);
      await sleep(150);
      if (s?.extract && surname && s.extract.includes(surname)) {
        await prisma.work.update({ where: { id: w.id }, data: { description: s.extract } });
        wDesc++;
        break;
      }
    }
  }

  console.log(
    `Composers: ${cBio} bios, ${cImg} portraits · Artists: ${aBio} bios, ${aImg} portraits · Works: ${wDesc}/${works.length} descriptions`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
