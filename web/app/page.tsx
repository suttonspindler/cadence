import Link from "next/link";
import { prisma } from "@cadence/db";
import { composerDates, eraLabel, traditionLabel } from "@/lib/format";

// Read fresh from the DB on each request while the catalog is small.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [composers, recordings, composerCount, workCount, recordingCount] = await Promise.all([
    prisma.composer.findMany({
      orderBy: { sortName: "asc" },
      include: { _count: { select: { works: true } } },
    }),
    prisma.recording.findMany({
      take: 6,
      orderBy: { createdAt: "asc" },
      include: {
        work: { include: { composer: true } },
        credits: { include: { artist: true } },
      },
    }),
    prisma.composer.count(),
    prisma.work.count(),
    prisma.recording.count(),
  ]);

  return (
    <div className="space-y-16">
      <section className="max-w-2xl">
        <p className="mb-3 text-xs uppercase tracking-widest text-accent">
          Classical music discovery
        </p>
        <h1 className="font-display text-5xl font-semibold leading-tight tracking-tight">
          One work. Many interpretations.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-soft">
          The same piece exists in dozens of recordings — different performers, ensembles,
          conductors, and traditions. Cadence organizes them so you can explore, compare, and
          understand the world of classical performance.
        </p>
        <div className="mt-6 flex gap-8 text-sm text-ink-faint">
          <span>
            <strong className="font-display text-lg text-ink">{composerCount}</strong> composers
          </span>
          <span>
            <strong className="font-display text-lg text-ink">{workCount}</strong> works
          </span>
          <span>
            <strong className="font-display text-lg text-ink">{recordingCount}</strong> recordings
          </span>
        </div>
      </section>

      <section>
        <h2 className="mb-5 font-display text-2xl font-semibold">Composers</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {composers.map((c) => (
            <li key={c.id}>
              <Link
                href={`/composers/${c.slug}`}
                className="block rounded-lg border border-line bg-paper-raised px-4 py-3 transition hover:border-accent-soft hover:shadow-sm"
              >
                <div className="font-display text-lg">{c.name}</div>
                <div className="mt-0.5 text-sm text-ink-faint">
                  {eraLabel(c.era)} · {composerDates(c.birthYear, c.deathYear)} ·{" "}
                  {c._count.works} {c._count.works === 1 ? "work" : "works"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-5 font-display text-2xl font-semibold">Recently added recordings</h2>
        <ul className="divide-y divide-line rounded-lg border border-line bg-paper-raised">
          {recordings.map((r) => {
            const performers = r.credits
              .map((cr) => cr.artist.name)
              .slice(0, 2)
              .join(", ");
            return (
              <li key={r.id}>
                <Link
                  href={`/recordings/${r.slug}`}
                  className="flex items-baseline justify-between gap-4 px-4 py-3 transition hover:bg-paper"
                >
                  <span>
                    <span className="font-medium">{r.work.composer.name}</span>
                    <span className="text-ink-soft"> — {r.work.title}</span>
                    <span className="block text-sm text-ink-faint">
                      {performers}
                      {r.year ? ` · ${r.year}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-ink-soft">
                    {traditionLabel(r.tradition)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
