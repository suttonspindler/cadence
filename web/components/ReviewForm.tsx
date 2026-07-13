import { saveReview, deleteReview } from "@/app/recordings/actions";
import { RATING_DIMENSIONS, type RatingScores } from "@/lib/ratings";
import { RatingInput } from "./RatingInput";

type ExistingReview = (RatingScores & { body: string | null }) | null;

export function ReviewForm({
  recordingId,
  slug,
  review,
}: {
  recordingId: string;
  slug: string;
  review: ExistingReview;
}) {
  const isEditing = review !== null;

  return (
    <div className="rounded-xl border border-line bg-paper-raised p-5">
      <h3 className="mb-4 font-display text-lg font-semibold">
        {isEditing ? "Your review" : "Rate & review"}
      </h3>

      <form action={saveReview} className="space-y-4">
        <input type="hidden" name="recordingId" value={recordingId} />
        <input type="hidden" name="slug" value={slug} />

        <div className="space-y-3">
          {RATING_DIMENSIONS.map((d) => (
            <RatingInput key={d.key} name={d.key} label={d.label} current={review?.[d.key]} />
          ))}
        </div>

        <div>
          <label htmlFor="body" className="mb-1 block text-sm text-ink-soft">
            Review <span className="text-ink-faint">(optional)</span>
          </label>
          <textarea
            id="body"
            name="body"
            rows={4}
            defaultValue={review?.body ?? ""}
            placeholder="What stands out about this interpretation?"
            className="w-full rounded-md border border-line bg-paper px-3 py-2 outline-none focus:border-accent-soft"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-paper-raised transition hover:bg-accent-soft"
          >
            {isEditing ? "Update review" : "Post review"}
          </button>
        </div>
      </form>

      {isEditing && (
        <form action={deleteReview} className="mt-3">
          <input type="hidden" name="recordingId" value={recordingId} />
          <input type="hidden" name="slug" value={slug} />
          <button type="submit" className="text-sm text-ink-faint hover:text-accent">
            Delete review
          </button>
        </form>
      )}
    </div>
  );
}
