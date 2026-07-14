import Link from "next/link";
import { prisma } from "@cadence/db";
import { composerDates, eraLabel } from "@/lib/format";
import { Portrait } from "@/components/Portrait";

export const dynamic = "force-dynamic";
export const metadata = { title: "Composers" };

export default async function ComposersPage() {
  const composers = await prisma.composer.findMany({
    where: { works: { some: {} } }, // only composers with at least one work
    orderBy: { sortName: "asc" },
    include: { _count: { select: { works: true } } },
  });

  return (
    <div>
      <h1 className="mb-8 font-display text-4xl font-semibold tracking-tight">Composers</h1>
      <ul className="divide-y divide-line rounded-lg border border-line bg-paper-raised">
        {composers.map((c) => (
          <li key={c.id}>
            <Link
              href={`/composers/${c.slug}`}
              className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-paper"
            >
              <span className="flex items-center gap-4">
                <Portrait name={c.name} imageUrl={c.imageUrl} size={44} />
                <span>
                  <span className="font-display text-xl">{c.name}</span>
                  <span className="ml-3 text-sm text-ink-faint">
                    {composerDates(c.birthYear, c.deathYear)}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-3 text-sm text-ink-soft">
                <span className="rounded-full border border-line px-2 py-0.5 text-xs">
                  {eraLabel(c.era)}
                </span>
                <span className="text-ink-faint">
                  {c._count.works} {c._count.works === 1 ? "work" : "works"}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
