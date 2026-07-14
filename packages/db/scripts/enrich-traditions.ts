// Infer a PerformanceTradition for imported recordings (which all default to
// OTHER) so the /recordings filter has substance and semantic search — which
// embeds the tradition — can distinguish period-instrument from mainstream
// performances. Only touches recordings still tagged OTHER, preserving the
// hand-set traditions on the curated seed recordings.
//
// Signal, in priority order:
//   1. Performer is a known period-instrument ensemble  → PERIOD_INSTRUMENT
//   2. Performer is a known historically-informed conductor → HISTORICALLY_INFORMED
//   3. Performer is a legendary early/mid-century conductor → ROMANTIC
//   4. Otherwise, default by the composer's era:
//        Modern / Contemporary repertoire → MODERN
//        everything else (mainstream modern-instrument) → TRADITIONAL

import path from "node:path";
import { config as loadEnv } from "dotenv";
import { prisma, type PerformanceTradition } from "@cadence/db";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Substrings that identify a period-instrument ensemble.
const PERIOD_ENSEMBLES = [
  "baroque",
  "ancient music",
  "concentus musicus",
  "english concert",
  "arts florissants",
  "europa galante",
  "giardino armonico",
  "pomo d'oro",
  "pomo doro",
  "freiburger",
  "tafelmusik",
  "gabrieli",
  "age of enlightenment",
  "english baroque soloists",
  "petite bande",
  "collegium vocale",
  "talens lyriques",
  "concert des nations",
  "hesperion",
  "academy of ancient",
  "dunedin",
  "arcangelo",
  "complesso barocco",
  "venice baroque",
  "akademie fur alte musik",
  "musica antiqua",
  "zefiro",
  "la cetra",
  "pygmalion",
  "revolutionnaire",
  "monteverdi choir",
  "orchestra of the eighteenth",
].map(norm);

// Surnames of conductors closely identified with the HIP movement.
const HIP_CONDUCTORS = [
  "harnoncourt",
  "gardiner",
  "hogwood",
  "pinnock",
  "william christie",
  "rene jacobs",
  "herreweghe",
  "savall",
  "koopman",
  "norrington",
  "bruggen",
  "minkowski",
  "rousset",
  "alessandrini",
  "biondi",
  "antonini",
  "masaaki suzuki",
  "mccreesh",
  "egarr",
  "fasolis",
  "kuijken",
  "immerseel",
  "currentzis",
  "leonhardt",
  "goebel",
  "dantone",
  "emmanuelle haim",
  "andrew manze",
].map(norm);

// Legendary early/mid-20th-century conductors of the "grand" Romantic tradition.
const ROMANTIC_CONDUCTORS = [
  "furtwangler",
  "mengelberg",
  "stokowski",
  "bruno walter",
  "nikisch",
  "knappertsbusch",
  "de sabata",
].map(norm);

function classify(
  performerNames: string[],
  era: string | null,
): PerformanceTradition {
  const names = performerNames.map(norm);
  const anyMatch = (needles: string[]) =>
    names.some((n) => needles.some((needle) => n.includes(needle)));

  if (anyMatch(PERIOD_ENSEMBLES)) return "PERIOD_INSTRUMENT";
  if (anyMatch(HIP_CONDUCTORS)) return "HISTORICALLY_INFORMED";
  if (anyMatch(ROMANTIC_CONDUCTORS)) return "ROMANTIC";
  if (era === "MODERN" || era === "CONTEMPORARY") return "MODERN";
  return "TRADITIONAL";
}

async function main() {
  // Imported recordings only (they carry a MusicBrainz id); the curated seed
  // recordings have null musicbrainzId and keep their hand-set traditions.
  // Re-runnable — recomputes every time rather than only touching OTHER rows.
  const recordings = await prisma.recording.findMany({
    where: { musicbrainzId: { not: null } },
    include: {
      work: { include: { composer: { select: { era: true } } } },
      credits: { include: { artist: { select: { name: true } } } },
    },
  });

  const counts: Record<string, number> = {};
  for (const r of recordings) {
    const performers = r.credits.map((c) => c.artist.name);
    const tradition = classify(performers, r.work.composer.era);
    await prisma.recording.update({ where: { id: r.id }, data: { tradition } });
    counts[tradition] = (counts[tradition] ?? 0) + 1;
  }

  console.log(`Enriched ${recordings.length} imported recordings:`);
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("\nRe-embed to reflect the new traditions: npm run ai:reindex && npm run ai:rag");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
