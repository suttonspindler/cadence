import Link from "next/link";
import { prisma } from "@cadence/db";
import { traditionLabel } from "@/lib/format";
import { CoverArt } from "@/components/CoverArt";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recordings" };

export default async function RecordingsPage() {
  const recordings = await prisma.recording.findMany({
    orderBy: [{ work: { composer: { sortName: "asc" } } }, { year: "asc" }],
    include: {
      work: { include: { composer: true } },
      credits: { include: { artist: true } },
      album: { select: { imageUrl: true } },
    },
  });

  return (
    <div>
      <h1 className="mb-8 font-display text-4xl font-semibold tracking-tight">Recordings</h1>
      <ul className="divide-y divide-line rounded-lg border border-line bg-paper-raised">
        {recordings.map((r) => (
          <li key={r.id}>
            <Link
              href={`/recordings/${r.slug}`}
              className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-paper"
            >
              <span className="flex items-center gap-4">
                <CoverArt title={r.work.title} imageUrl={r.album?.imageUrl ?? r.imageUrl} size={48} />
                <span>
                  <span className="font-medium">{r.work.composer.name}</span>
                  <span className="text-ink-soft"> — {r.work.title}</span>
                  <span className="block text-sm text-ink-faint">
                    {r.credits.map((cr) => cr.artist.name).join(", ")}
                    {r.year ? ` · ${r.year}` : ""}
                  </span>
                </span>
              </span>
              <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-ink-soft">
                {traditionLabel(r.tradition)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
