// Detect MusicBrainz "works" that are really individual movements / arias /
// scenes / concert excerpts rather than top-level works. Top-level works
// essentially never contain a colon in MusicBrainz — sections are formatted
// "Work: Section" — which makes the colon the single most reliable signal.
export function isMovementLike(title: string): boolean {
  if (title.includes(":")) return true; // "Der fliegende Holländer, WWV 63: Akt III …"
  if (/\bfrom\s+[“"'‚„]?[A-ZÄÖÜ]/.test(title)) return true; // "Bridal Chorus from 'Lohengrin'"
  if (
    /,\s*(?:Act|Akt|Aufzug|Scene|Szene|No\.?|Nr\.?|Movement|Satz|Aria|Arie|Var(?:iation)?|Finale|Duett|Terzett)\b/i.test(
      title,
    )
  ) {
    return true;
  }
  return false;
}
