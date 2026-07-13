import type { Era, PerformanceTradition, CreditRole } from "@cadence/db";

export function composerDates(birthYear?: number | null, deathYear?: number | null): string {
  if (!birthYear && !deathYear) return "";
  return `${birthYear ?? "?"}–${deathYear ?? ""}`;
}

const ERA_LABELS: Record<Era, string> = {
  MEDIEVAL: "Medieval",
  RENAISSANCE: "Renaissance",
  BAROQUE: "Baroque",
  CLASSICAL: "Classical",
  ROMANTIC: "Romantic",
  LATE_ROMANTIC: "Late Romantic",
  MODERN: "Modern",
  CONTEMPORARY: "Contemporary",
};
export const eraLabel = (era: Era) => ERA_LABELS[era] ?? era;

const TRADITION_LABELS: Record<PerformanceTradition, string> = {
  HISTORICALLY_INFORMED: "Historically informed",
  PERIOD_INSTRUMENT: "Period instrument",
  ROMANTIC: "Romantic tradition",
  TRADITIONAL: "Traditional",
  MODERN: "Modern",
  OTHER: "—",
};
export const traditionLabel = (t: PerformanceTradition) => TRADITION_LABELS[t] ?? t;

const ROLE_LABELS: Record<CreditRole, string> = {
  SOLOIST: "Soloist",
  PERFORMER: "Performer",
  CONDUCTOR: "Conductor",
  ENSEMBLE: "Ensemble",
  CHOIR: "Choir",
};
export const roleLabel = (r: CreditRole) => ROLE_LABELS[r] ?? r;

export function workSubtitle(w: {
  catalogNumber?: string | null;
  key?: string | null;
  genre?: string | null;
}): string {
  return [w.genre, w.catalogNumber, w.key].filter(Boolean).join(" · ");
}
