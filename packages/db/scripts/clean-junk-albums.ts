// Clean junk album associations left by the composer-first import (which
// attached recordings to whatever release came first — often a compilation or
// non-album release).
//
// Reliable-signal cleanup only: albums whose MusicBrainz release group is a
// Compilation or a non-Album primary type (Single/EP/Broadcast/Other) are
// deleted and their recordings detached (the recordings themselves stay — they
// point at a real work). Live albums are AMBIGUOUS (a great live recording and
// an amateur one look identical by type), so they're only *reported* for review,
// never auto-deleted.
//
//   tsx scripts/clean-junk-albums.ts           # report only
//   tsx scripts/clean-junk-albums.ts --apply    # delete compilation/non-album albums

import path from "node:path";
import { config as loadEnv } from "dotenv";
import { prisma } from "@cadence/db";
import { mbGet } from "../import/musicbrainz";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

async function classifyType(rgId: string): Promise<{ verdict: string; detail: string }> {
  let rg: { "primary-type"?: string; "secondary-types"?: string[] };
  try {
    rg = await mbGet(`/release-group/${rgId}`);
  } catch {
    return { verdict: "ok", detail: "lookup-failed" };
  }
  const primary = rg["primary-type"];
  const secondary = rg["secondary-types"] ?? [];
  if (secondary.includes("Compilation")) return { verdict: "compilation", detail: secondary.join("+") };
  if (primary && primary !== "Album") return { verdict: "non-album", detail: primary };
  if (secondary.includes("Live")) return { verdict: "live-review", detail: "Live" };
  return { verdict: "ok", detail: primary ?? "?" };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const albums = await prisma.album.findMany({
    where: { musicbrainzId: { not: null } },
    include: { _count: { select: { recordings: true } } },
    orderBy: { title: "asc" },
  });
  console.log(`${apply ? "APPLY" : "REPORT"} — classifying ${albums.length} albums…\n`);

  const junk: { title: string; id: string; recs: number; detail: string }[] = [];
  const review: { title: string; detail: string }[] = [];
  let processed = 0;

  for (const a of albums) {
    const { verdict, detail } = await classifyType(a.musicbrainzId!);
    processed++;
    if (processed % 25 === 0) console.log(`  …${processed}/${albums.length}`);
    if (verdict === "compilation" || verdict === "non-album") {
      junk.push({ title: a.title, id: a.id, recs: a._count.recordings, detail });
    } else if (verdict === "live-review") {
      review.push({ title: a.title, detail });
    }
  }

  console.log(`\nJunk (compilation / non-album) — ${junk.length}:`);
  junk.forEach((j) => console.log(`  [${j.detail}] ${j.title.slice(0, 50)} (${j.recs} rec)`));
  console.log(`\nLive albums to review (not auto-deleted) — ${review.length}:`);
  review.slice(0, 30).forEach((r) => console.log(`  ${r.title.slice(0, 55)}`));

  if (apply && junk.length) {
    let detached = 0;
    for (const j of junk) {
      const upd = await prisma.recording.updateMany({ where: { albumId: j.id }, data: { albumId: null } });
      detached += upd.count;
      await prisma.album.delete({ where: { id: j.id } });
    }
    console.log(`\nDeleted ${junk.length} junk album(s); detached ${detached} recording(s) (kept).`);
    console.log("Re-embed if you like (album title isn't embedded, so not strictly required).");
  } else if (junk.length) {
    console.log(`\nRe-run with --apply to delete the ${junk.length} junk album(s) and detach their recordings.`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
