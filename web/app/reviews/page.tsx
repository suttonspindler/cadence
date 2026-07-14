import Link from "next/link";
import { prisma } from "@cadence/db";
import { getSessionUser } from "@/lib/session";
import { reviewOverall } from "@/lib/ratings";
import { SignedOutNotice } from "@/components/SignedOutNotice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your reviews" };

export default async function ReviewsPage() {
  const user = await getSessionUser();
  if (!user?.id) {
    return <SignedOutNotice title="Your reviews" what="see the reviews and ratings you've written" />;
  }

  const reviews = await prisma.review.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { recording: { include: { work: { include: { composer: true } } } } },
  });

  return (
    <div>
      <h1 className="mb-2 font-display text-4xl font-semibold tracking-tight">Your reviews</h1>
      <p className="mb-6 text-sm text-ink-faint">
        {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
      </p>

      {reviews.length === 0 ? (
        <p className="text-ink-soft">
          You haven&apos;t reviewed anything yet. Open a{" "}
          <Link href="/recordings" className="text-accent hover:underline">
            recording
          </Link>{" "}
          and share what you think.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-paper-raised">
          {reviews.map((r) => {
            const overall = reviewOverall(r);
            return (
              <li key={r.id}>
                <Link
                  href={`/recordings/${r.recording.slug}`}
                  className="flex items-baseline justify-between gap-4 px-5 py-4 transition hover:bg-paper"
                >
                  <span>
                    <span className="font-medium">{r.recording.work.composer.name}</span>
                    <span className="text-ink-soft"> — {r.recording.work.title}</span>
                    {r.body && (
                      <span className="mt-1 block line-clamp-2 text-sm text-ink-faint">{r.body}</span>
                    )}
                  </span>
                  {overall !== null && (
                    <span className="shrink-0 font-display font-semibold">
                      {overall.toFixed(1)}
                      <span className="text-ink-faint"> / 5</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
