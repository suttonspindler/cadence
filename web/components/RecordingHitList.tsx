import Link from "next/link";
import type { RecordingHit } from "@/lib/ai";
import { traditionLabel } from "@/lib/format";
import type { PerformanceTradition } from "@cadence/db";

export function RecordingHitList({
  hits,
  showScore = false,
}: {
  hits: RecordingHit[];
  showScore?: boolean;
}) {
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-paper-raised">
      {hits.map((h) => (
        <li key={h.slug}>
          <Link
            href={`/recordings/${h.slug}`}
            className="flex items-baseline justify-between gap-4 px-5 py-3 transition hover:bg-paper"
          >
            <span className="min-w-0">
              <span className="font-medium">{h.composer}</span>
              <span className="text-ink-soft"> — {h.work}</span>
              <span className="block truncate text-sm text-ink-faint">
                {[h.performers, h.year ? String(h.year) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {showScore && h.score !== null && (
                <span className="text-xs text-ink-faint" title="Semantic match">
                  {Math.round(h.score * 100)}%
                </span>
              )}
              <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-soft">
                {traditionLabel(h.tradition as PerformanceTradition)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
