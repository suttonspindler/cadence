import { RATING_DIMENSIONS, reviewOverall, type RatingScores } from "@/lib/ratings";

type ReviewWithUser = RatingScores & {
  id: string;
  body: string | null;
  createdAt: Date;
  user: { name: string | null; email: string | null; image: string | null };
};

function ScoreDot({ value }: { value: number | null | undefined }) {
  if (typeof value !== "number") return <span className="text-ink-faint">—</span>;
  return <span className="font-display font-semibold text-ink">{value}</span>;
}

export function ReviewList({
  reviews,
  currentUserId,
}: {
  reviews: (ReviewWithUser & { userId: string })[];
  currentUserId?: string;
}) {
  if (reviews.length === 0) {
    return <p className="text-sm text-ink-soft">No reviews yet. Be the first.</p>;
  }

  return (
    <ul className="space-y-4">
      {reviews.map((r) => {
        const overall = reviewOverall(r);
        const isMine = r.userId === currentUserId;
        return (
          <li key={r.id} className="rounded-xl border border-line bg-paper-raised p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{r.user.name ?? r.user.email ?? "Listener"}</span>
                {isMine && (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                    You
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-ink-faint">
                {overall !== null && (
                  <span className="font-display text-base font-semibold text-ink">
                    {overall.toFixed(1)}
                    <span className="text-ink-faint"> / 5</span>
                  </span>
                )}
                <span>{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
              {RATING_DIMENSIONS.map((d) => (
                <div key={d.key} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-ink-faint">{d.label}</span>
                  <ScoreDot value={r[d.key]} />
                </div>
              ))}
            </div>

            {r.body && <p className="mt-3 leading-relaxed text-ink-soft">{r.body}</p>}
          </li>
        );
      })}
    </ul>
  );
}
