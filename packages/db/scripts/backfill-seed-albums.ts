// Backfill Albums for the hand-authored seed recordings (which have no
// MusicBrainz id). For each, search MusicBrainz for a release matching the
// work + performer, resolve its release group, and attach an Album (title,
// year, label, Cover Art Archive cover). Fuzzy — the matched release may be a
// different edition of the same performance.

import path from "node:path";
import { config as loadEnv } from "dotenv";
import { prisma } from "@cadence/db";
import { mbGet } from "../import/musicbrainz";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const USER_AGENT =
  "CadenceBot/0.1 (classical music portfolio project; spindler.s@northeastern.edu)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
function yearOf(date?: string): number | null {
  const m = date?.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

async function caaCover(kind: "release" | "release-group", mbid: string): Promise<string | null> {
  try {
    const res = await fetch(`https://coverartarchive.org/${kind}/${mbid}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    const data: { images?: { front?: boolean; image?: string; thumbnails?: Record<string, string> }[] } =
      await res.json();
    const front = data.images?.find((i) => i.front) ?? data.images?.[0];
    return front?.thumbnails?.["500"] ?? front?.thumbnails?.large ?? front?.image ?? null;
  } catch {
    return null;
  } finally {
    await sleep(250);
  }
}

type MbRelease = {
  id: string;
  title?: string;
  date?: string;
  "release-group"?: { id: string; title?: string };
  "label-info"?: { label?: { name?: string } }[];
};

async function main() {
  const recordings = await prisma.recording.findMany({
    where: { musicbrainzId: null, albumId: null },
    include: {
      work: { include: { composer: true } },
      credits: { include: { artist: true } },
    },
  });

  let matched = 0;
  for (const r of recordings) {
    const performer =
      r.credits.find((c) => c.role === "SOLOIST" || c.role === "CONDUCTOR")?.artist.name ??
      r.credits[0]?.artist.name ??
      "";
    const query = encodeURIComponent(
      `${r.work.composer.name} ${r.work.title} ${performer}`.trim(),
    );
    const search = await mbGet<{ releases?: { id: string }[] }>(`/release?query=${query}&limit=5`);
    const hit = search.releases?.[0];
    if (!hit) {
      console.log(`  ✗ ${r.work.composer.name} — ${r.work.title} (${performer}): no match`);
      continue;
    }

    const rel = await mbGet<MbRelease>(`/release/${hit.id}?inc=release-groups+labels`);
    const rgId = rel["release-group"]?.id;
    const albumMbid = rgId ?? rel.id;
    const title = rel["release-group"]?.title ?? rel.title ?? "Album";
    const cover = rgId
      ? (await caaCover("release-group", rgId)) ?? (await caaCover("release", rel.id))
      : await caaCover("release", rel.id);

    const album = await prisma.album.upsert({
      where: { musicbrainzId: albumMbid },
      update: cover ? { imageUrl: cover } : {},
      create: {
        slug: `${slugify(title)}-${albumMbid.slice(0, 6)}`,
        title,
        year: yearOf(rel.date) ?? r.year,
        label: rel["label-info"]?.[0]?.label?.name ?? r.label,
        imageUrl: cover,
        musicbrainzId: albumMbid,
      },
    });
    await prisma.recording.update({ where: { id: r.id }, data: { albumId: album.id } });
    matched++;
    console.log(`  ✓ ${r.work.composer.name} — ${r.work.title}: ${title}${cover ? " (cover)" : ""}`);
  }

  console.log(`\nMatched ${matched}/${recordings.length} seed recordings to albums.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
