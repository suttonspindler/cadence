// The five rating dimensions from the product brief. `key` matches the column
// names on the Review model.
export const RATING_DIMENSIONS = [
  { key: "performanceQuality", label: "Performance" },
  { key: "soundQuality", label: "Sound quality" },
  { key: "historicalAuthenticity", label: "Historical authenticity" },
  { key: "emotionalImpact", label: "Emotional impact" },
  { key: "recommendationLevel", label: "Recommendation" },
] as const;

export type RatingKey = (typeof RATING_DIMENSIONS)[number]["key"];

export type RatingScores = Partial<Record<RatingKey, number | null>>;

/** Mean of the provided (non-null) dimension scores, or null if none were given. */
export function reviewOverall(scores: RatingScores): number | null {
  const values = RATING_DIMENSIONS.map((d) => scores[d.key]).filter(
    (v): v is number => typeof v === "number",
  );
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Average of many reviews' overall scores + a count. */
export function aggregateRating(reviews: RatingScores[]): { avg: number | null; count: number } {
  const overalls = reviews
    .map(reviewOverall)
    .filter((v): v is number => typeof v === "number");
  if (overalls.length === 0) return { avg: null, count: 0 };
  return { avg: overalls.reduce((a, b) => a + b, 0) / overalls.length, count: overalls.length };
}
