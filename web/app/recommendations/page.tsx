import { getSessionUser } from "@/lib/session";
import { recommendationsForUser } from "@/lib/ai";
import { RecordingHitList } from "@/components/RecordingHitList";
import { SignedOutNotice } from "@/components/SignedOutNotice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recommended for you" };

export default async function RecommendationsPage() {
  const user = await getSessionUser();
  if (!user?.id) {
    return (
      <SignedOutNotice title="Recommended for you" what="get recommendations based on your listening" />
    );
  }

  const recommendations = await recommendationsForUser(user.id, 24);

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Recommended for you</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Recordings near your taste that you haven&apos;t heard yet — found by comparing the meaning
        of what you&apos;ve listened to against the rest of the catalog, not by matching tags.
      </p>

      {!recommendations || recommendations.length === 0 ? (
        <p className="mt-8 rounded-lg border border-line bg-paper-raised p-4 text-ink-soft">
          Mark a few recordings as listened and recommendations will appear here.
        </p>
      ) : (
        <div className="mt-8">
          <RecordingHitList hits={recommendations} />
        </div>
      )}
    </div>
  );
}
