// Pin the hand-authored seed recordings to their correct MusicBrainz release
// groups. The seed recordings have no MusicBrainz id, so an automated search
// can't reliably surface the *specific* historic album (e.g. Kleiber's DG
// Beethoven 5/7, or Mravinsky's Shostakovich 5 vs. a Rostropovich one). Each
// mapping below was verified by hand — matching composer + work + performer,
// and confirmed to have Cover Art Archive artwork. After re-pinning, any album
// left with zero recordings (the earlier fuzzy matches) is deleted.

import path from "node:path";
import { config as loadEnv } from "dotenv";
import { prisma } from "@cadence/db";
import { mbGet } from "../import/musicbrainz";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const USER_AGENT =
  "CadenceBot/0.1 (classical music portfolio project; spindler.s@northeastern.edu)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// seed recording slug -> verified MusicBrainz release-group MBID
const SEED_ALBUMS: Record<string, string> = {
  "beethoven-5-kleiber-vpo": "1c71037d-a648-3093-ba2e-f3c0f00e520a", // Symphonien nos. 5 & 7 — VPO / Kleiber
  "beethoven-5-norrington": "520de2aa-3ca9-3eca-bd4a-119ad771982c", // Symphonies 4 & 5 — London Classical Players / Norrington
  "cello-suite-1-casals": "8aeaeb97-3187-31a5-9231-c0dca413a0d1", // Cello Suites nos. 1–6 — Casals
  "cello-suite-1-yoyoma": "01e23da3-2cba-3a44-b7fc-3f8d4a3f2056", // The 6 Unaccompanied Cello Suites — Yo-Yo Ma (1983)
  "four-seasons-biondi-europa-galante": "ae0db602-a664-45cf-8cc2-a2b61b54f45c", // The Four Seasons — Biondi / Europa Galante
  "four-seasons-perlman-lpo": "aadcdac6-c0fb-3b1a-b767-062fd6269b9c", // The Four Seasons — Perlman / LPO
  "goldberg-gould-1955": "c73dade4-5470-33db-a1ce-5c16dc427dfc", // The 1955 Goldberg Variations — Gould
  "goldberg-gould-1981": "7c8f2d45-d764-347a-9ab9-0aa771a3447d", // The Goldberg Variations (1981 digital) — Gould
  "goldberg-schiff-ecm": "cd08cd83-0e7a-3439-85fc-fe24d65cf20f", // Goldberg Variations (2003 ECM) — Schiff
  "mahler-5-bernstein-vpo": "731a9a23-c263-42a7-abe7-9046310bfbc2", // Mahler: Symphony No. 5 — Bernstein / VPO
  "mozart-40-bohm-bpo": "54a6c3bf-098b-3ce9-a171-77ec85140fb7", // Symphonien nos. 35–41 — Böhm / BPO
  "mozart-40-hogwood-aam": "dd1c14d2-2e63-49e5-b645-8e8900a0c8e0", // Symphony no. 40 / no. 31 "Paris" — AAM
  "shostakovich-5-mravinsky": "615080da-43e1-436d-8305-fb0c239ebea4", // Symphony no. 5 in D minor, op. 47 — Mravinsky
};

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

async function caaCover(rgMbid: string): Promise<string | null> {
  try {
    const res = await fetch(`https://coverartarchive.org/release-group/${rgMbid}`, {
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

type MbReleaseGroup = { id: string; title?: string; "first-release-date"?: string };

async function main() {
  const previousAlbumIds = new Set<string>();
  const pinnedAlbumIds = new Set<string>();
  let matched = 0;

  for (const [slug, rgMbid] of Object.entries(SEED_ALBUMS)) {
    const rec = await prisma.recording.findUnique({
      where: { slug },
      include: { work: { include: { composer: true } } },
    });
    if (!rec) {
      console.log(`  ? ${slug}: no such recording`);
      continue;
    }
    if (rec.albumId) previousAlbumIds.add(rec.albumId);

    const rg = await mbGet<MbReleaseGroup>(`/release-group/${rgMbid}`);
    const title = rg.title ?? `${rec.work.composer.name} — ${rec.work.title}`;
    const cover = await caaCover(rgMbid);

    const album = await prisma.album.upsert({
      where: { musicbrainzId: rgMbid },
      update: { title, ...(cover ? { imageUrl: cover } : {}) },
      create: {
        slug: `${slugify(title)}-${rgMbid.slice(0, 6)}`,
        title,
        year: yearOf(rg["first-release-date"]) ?? rec.year,
        label: rec.label,
        imageUrl: cover,
        musicbrainzId: rgMbid,
      },
    });
    await prisma.recording.update({ where: { id: rec.id }, data: { albumId: album.id } });
    pinnedAlbumIds.add(album.id);
    matched++;
    console.log(`  ✓ ${slug} → ${title}${cover ? " (cover)" : " (no cover!)"}`);
  }

  // Delete the earlier fuzzy albums that no longer back any recording.
  const orphanIds = [...previousAlbumIds].filter((id) => !pinnedAlbumIds.has(id));
  let removed = 0;
  for (const id of orphanIds) {
    const count = await prisma.recording.count({ where: { albumId: id } });
    if (count === 0) {
      const a = await prisma.album.delete({ where: { id } });
      removed++;
      console.log(`  ✗ removed orphaned album: ${a.title}`);
    }
  }

  console.log(`\nPinned ${matched}/${Object.keys(SEED_ALBUMS).length} seed recordings; removed ${removed} orphaned albums.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
