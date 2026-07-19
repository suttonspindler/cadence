// Sweep: complete the catalog's partial albums (those with a single recording),
// with guardrails so we don't pull in compilations or box sets.
//
// Dry-run (default) just classifies each album; --apply actually completes the
// eligible ones. --limit N bounds how many albums to look at.
//
//   tsx scripts/complete-albums-sweep.ts               # dry-run, all partial albums
//   tsx scripts/complete-albums-sweep.ts --limit 25    # dry-run, first 25
//   tsx scripts/complete-albums-sweep.ts --apply        # write eligible albums
// After --apply, re-embed:  npm run ai:reindex && npm run ai:rag

import path from "node:path";
import { config as loadEnv } from "dotenv";
import { prisma } from "@cadence/db";
import { mbGet } from "../import/musicbrainz";
import { completeAlbum } from "./complete-album";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const MAX_TRACKS = 30; // above this a release group is almost certainly a box set / compilation

type Classification = { primary?: string; secondary: string[]; tracks: number; verdict: string };

async function classify(rgId: string): Promise<Classification> {
  const rg = await mbGet<{ "primary-type"?: string; "secondary-types"?: string[] }>(`/release-group/${rgId}`);
  const secondary = rg["secondary-types"] ?? [];
  const primary = rg["primary-type"];
  const rels = await mbGet<{ releases?: { media?: { "track-count"?: number }[] }[] }>(
    `/release?release-group=${rgId}&limit=25&inc=media`,
  );
  let tracks = 0;
  for (const r of rels.releases ?? []) {
    const t = (r.media ?? []).reduce((s, m) => s + (m["track-count"] ?? 0), 0);
    if (t > tracks) tracks = t;
  }
  let verdict = "eligible";
  if (secondary.includes("Compilation")) verdict = "skip:compilation";
  else if (primary && primary !== "Album") verdict = `skip:${primary.toLowerCase()}`;
  else if (tracks === 0) verdict = "skip:no-tracks";
  else if (tracks > MAX_TRACKS) verdict = "skip:large";
  return { primary, secondary, tracks, verdict };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const li = process.argv.indexOf("--limit");
  const limit = li >= 0 ? parseInt(process.argv[li + 1], 10) : Infinity;

  const albums = await prisma.album.findMany({
    where: { musicbrainzId: { not: null }, recordings: { every: {} } },
    include: { _count: { select: { recordings: true } } },
    orderBy: { title: "asc" },
  });
  const partial = albums.filter((a) => a._count.recordings === 1).slice(0, limit === Infinity ? undefined : limit);
  console.log(`${apply ? "APPLY" : "DRY-RUN"} over ${partial.length} partial album(s)\n`);

  const verdicts: Record<string, number> = {};
  let totalAdded = 0;
  let totalComposers = 0;

  for (const a of partial) {
    const c = await classify(a.musicbrainzId!);
    verdicts[c.verdict] = (verdicts[c.verdict] ?? 0) + 1;

    if (!apply) {
      console.log(`  [${c.verdict}] ${a.title.slice(0, 48).padEnd(48)} tracks=${c.tracks}`);
      continue;
    }
    if (c.verdict !== "eligible") {
      console.log(`  · skip (${c.verdict}): ${a.title.slice(0, 44)}`);
      continue;
    }
    const res = await completeAlbum(a.musicbrainzId!);
    if (res && (res.added > 0 || res.createdComposers > 0)) {
      totalAdded += res.added;
      totalComposers += res.createdComposers;
      console.log(`  ✓ ${res.album.slice(0, 44).padEnd(44)} +${res.added} rec, +${res.createdComposers} composer`);
    }
  }

  console.log("\nVerdicts:");
  for (const [k, v] of Object.entries(verdicts).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
  if (apply) {
    console.log(`\nAdded ${totalAdded} recording(s), ${totalComposers} new composer(s).`);
    if (totalAdded > 0) console.log("Re-embed: npm run ai:reindex && npm run ai:rag");
  } else {
    console.log(`\nEligible for completion: ${verdicts["eligible"] ?? 0}. Re-run with --apply to write them.`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
