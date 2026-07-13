import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@cadence/db";
import { composerDates, eraLabel, workSubtitle } from "@/lib/format";
import { Portrait } from "@/components/Portrait";

export const dynamic = "force-dynamic";

async function getComposer(slug: string) {
  return prisma.composer.findUnique({
    where: { slug },
    include: {
      works: {
        orderBy: { title: "asc" },
        include: { _count: { select: { recordings: true, movements: true } } },
      },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const composer = await getComposer(slug);
  return { title: composer?.name ?? "Composer" };
}

export default async function ComposerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const composer = await getComposer(slug);
  if (!composer) notFound();

  return (
    <div>
      <Link href="/composers" className="text-sm text-accent hover:underline">
        ← Composers
      </Link>

      <header className="mt-4 flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-start">
        <Portrait name={composer.name} imageUrl={composer.imageUrl} size={112} />
        <div>
          <div className="mb-2 flex items-center gap-3 text-sm text-ink-faint">
            <span className="rounded-full border border-line px-2 py-0.5 text-xs">
              {eraLabel(composer.era)}
            </span>
            <span>{composerDates(composer.birthYear, composer.deathYear)}</span>
            {composer.nationality && <span>· {composer.nationality}</span>}
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">{composer.name}</h1>
          {composer.bio && (
            <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">{composer.bio}</p>
          )}
        </div>
      </header>

      <section className="mt-8">
        <h2 className="mb-4 font-display text-2xl font-semibold">Works</h2>
        <ul className="grid gap-3">
          {composer.works.map((w) => (
            <li key={w.id}>
              <Link
                href={`/works/${w.slug}`}
                className="block rounded-lg border border-line bg-paper-raised px-5 py-4 transition hover:border-accent-soft"
              >
                <div className="font-display text-lg">{w.title}</div>
                <div className="mt-0.5 text-sm text-ink-faint">
                  {[workSubtitle(w), `${w._count.recordings} recordings`]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
