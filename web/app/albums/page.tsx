import Link from "next/link";
import { prisma } from "@cadence/db";
import { CoverArt } from "@/components/CoverArt";
import { Pagination } from "@/components/Pagination";

export const dynamic = "force-dynamic";
export const metadata = { title: "Albums" };

const PAGE_SIZE = 48;

export default async function AlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where = { recordings: { some: {} } };
  const [total, albums] = await Promise.all([
    prisma.album.count({ where }),
    prisma.album.findMany({
      where,
      orderBy: [{ imageUrl: { sort: "asc", nulls: "last" } }, { title: "asc" }],
      include: { _count: { select: { recordings: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="mb-2 font-display text-4xl font-semibold tracking-tight">Albums</h1>
      <p className="mb-6 text-sm text-ink-faint">{total} albums</p>

      <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {albums.map((a) => (
          <li key={a.id}>
            <Link href={`/albums/${a.slug}`} className="group block">
              <div className="relative aspect-square overflow-hidden rounded-lg border border-line transition group-hover:border-accent-soft">
                <CoverArt title={a.title} imageUrl={a.imageUrl} fill />
              </div>
              <div className="mt-2">
                <div className="line-clamp-2 font-medium leading-snug group-hover:text-accent">
                  {a.title}
                </div>
                <div className="mt-0.5 text-sm text-ink-faint">
                  {[a.year, `${a._count.recordings} ${a._count.recordings === 1 ? "work" : "works"}`]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Pagination basePath="/albums" page={page} totalPages={totalPages} />
    </div>
  );
}
