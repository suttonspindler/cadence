import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@cadence/db";
import { traditionLabel, workSubtitle } from "@/lib/format";
import { CoverArt } from "@/components/CoverArt";

export const dynamic = "force-dynamic";

async function getWork(slug: string) {
  return prisma.work.findUnique({
    where: { slug },
    include: {
      composer: true,
      movements: { orderBy: { position: "asc" } },
      recordings: {
        orderBy: [{ year: "asc" }],
        include: {
          credits: { include: { artist: true } },
          album: { select: { title: true, imageUrl: true } },
        },
      },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const work = await getWork(slug);
  return { title: work ? `${work.title} — ${work.composer.name}` : "Work" };
}

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const work = await getWork(slug);
  if (!work) notFound();

  return (
    <div>
      <Link href={`/composers/${work.composer.slug}`} className="text-sm text-accent hover:underline">
        ← {work.composer.name}
      </Link>

      <header className="mt-4 border-b border-line pb-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{work.title}</h1>
        <p className="mt-2 text-ink-soft">{workSubtitle(work) || "—"}</p>
        {work.composedYear && (
          <p className="mt-1 text-sm text-ink-faint">Composed {work.composedYear}</p>
        )}
        {work.description && (
          <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">{work.description}</p>
        )}
      </header>

      {work.movements.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 font-display text-2xl font-semibold">Movements</h2>
          <ol className="divide-y divide-line rounded-lg border border-line bg-paper-raised">
            {work.movements.map((m) => (
              <li key={m.id} className="flex items-baseline gap-4 px-5 py-3">
                <span className="font-display text-ink-faint">{m.position}</span>
                <span>{m.title}</span>
                {m.tempoMarking && m.tempoMarking !== "—" && (
                  <span className="ml-auto text-sm italic text-ink-faint">{m.tempoMarking}</span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-4 font-display text-2xl font-semibold">
          Recordings <span className="text-ink-faint">({work.recordings.length})</span>
        </h2>
        <p className="mb-4 max-w-2xl text-sm text-ink-soft">
          Compare interpretations of the same work — different performers, ensembles, and
          performance traditions.
        </p>
        <ul className="grid gap-3">
          {work.recordings.map((r) => (
            <li key={r.id}>
              <Link
                href={`/recordings/${r.slug}`}
                className="flex gap-4 rounded-lg border border-line bg-paper-raised px-5 py-4 transition hover:border-accent-soft"
              >
                <CoverArt title={work.title} imageUrl={r.album?.imageUrl ?? r.imageUrl} size={56} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-4">
                    <span className="font-medium">
                      {r.credits.map((cr) => cr.artist.name).join(", ")}
                    </span>
                    <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-ink-soft">
                      {traditionLabel(r.tradition)}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-ink-faint">
                    {[r.album?.title, r.year].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
