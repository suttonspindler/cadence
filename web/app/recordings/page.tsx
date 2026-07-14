import Link from "next/link";
import { prisma } from "@cadence/db";
import type { PerformanceTradition, Prisma } from "@cadence/db";
import { traditionLabel } from "@/lib/format";
import { CoverArt } from "@/components/CoverArt";
import { Pagination } from "@/components/Pagination";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recordings" };

const PAGE_SIZE = 40;

// Traditions offered as filter chips (OTHER is the unlabeled default — skip it).
const TRADITIONS: PerformanceTradition[] = [
  "HISTORICALLY_INFORMED",
  "PERIOD_INSTRUMENT",
  "ROMANTIC",
  "TRADITIONAL",
  "MODERN",
];

export default async function RecordingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tradition?: string }>;
}) {
  const sp = await searchParams;
  const tradition = TRADITIONS.includes(sp.tradition as PerformanceTradition)
    ? (sp.tradition as PerformanceTradition)
    : undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.RecordingWhereInput = tradition ? { tradition } : {};
  const [total, recordings] = await Promise.all([
    prisma.recording.count({ where }),
    prisma.recording.findMany({
      where,
      orderBy: [{ work: { composer: { sortName: "asc" } } }, { year: "asc" }],
      include: {
        work: { include: { composer: true } },
        credits: { include: { artist: true } },
        album: { select: { imageUrl: true } },
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const chip = (label: string, value?: string) => {
    const active = value === tradition || (!value && !tradition);
    const qs = value ? `?tradition=${value}` : "";
    return (
      <Link
        key={label}
        href={`/recordings${qs}`}
        className={`rounded-full border px-3 py-1 text-sm transition ${
          active
            ? "border-accent bg-accent text-paper-raised"
            : "border-line text-ink-soft hover:border-accent-soft"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div>
      <h1 className="mb-2 font-display text-4xl font-semibold tracking-tight">Recordings</h1>
      <p className="mb-6 text-sm text-ink-faint">{total} recordings</p>

      <div className="mb-6 flex flex-wrap gap-2">
        {chip("All")}
        {TRADITIONS.map((t) => chip(traditionLabel(t), t))}
      </div>

      {recordings.length === 0 ? (
        <p className="text-ink-soft">No recordings match this filter.</p>
      ) : (
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
      )}

      <Pagination
        basePath="/recordings"
        page={page}
        totalPages={totalPages}
        params={{ tradition }}
      />
    </div>
  );
}
