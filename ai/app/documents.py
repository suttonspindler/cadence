"""Turn a recording (plus its work, composer, movements, and credits) into a rich
text document for embedding. The richer and more natural this text, the better
semantic search and recommendations perform."""

from __future__ import annotations

_TRADITION_TEXT = {
    "HISTORICALLY_INFORMED": "historically informed performance on period practice",
    "PERIOD_INSTRUMENT": "period-instrument performance",
    "ROMANTIC": "Romantic-tradition interpretation",
    "TRADITIONAL": "traditional interpretation",
    "MODERN": "modern interpretation",
    "OTHER": "",
}

_ERA_TEXT = {
    "MEDIEVAL": "Medieval",
    "RENAISSANCE": "Renaissance",
    "BAROQUE": "Baroque",
    "CLASSICAL": "Classical",
    "ROMANTIC": "Romantic",
    "LATE_ROMANTIC": "late Romantic",
    "MODERN": "Modern",
    "CONTEMPORARY": "Contemporary",
}


def build_recording_document(row: dict) -> str:
    parts: list[str] = []

    era = _ERA_TEXT.get(row.get("era") or "", "")
    composer = row.get("composer") or ""
    parts.append(f"{composer}, {era} composer." if era else f"{composer}.")

    work_bits = [row.get("work")]
    for key in ("genre", "key", "catalog_number"):
        if row.get(key):
            work_bits.append(row[key])
    parts.append(" ".join(b for b in work_bits if b) + ".")

    if row.get("work_desc"):
        parts.append(row["work_desc"])
    if row.get("movements"):
        parts.append(f"Movements: {row['movements']}.")
    if row.get("performers"):
        parts.append(f"Performed by {row['performers']}.")

    trad = _TRADITION_TEXT.get(row.get("tradition") or "", "")
    meta = ", ".join(
        b for b in [trad, row.get("label"), str(row["year"]) if row.get("year") else None] if b
    )
    if meta:
        parts.append(f"{meta}.")

    if row.get("notes"):
        parts.append(row["notes"])
    if row.get("composer_bio"):
        parts.append(row["composer_bio"])

    return " ".join(p.strip() for p in parts if p and p.strip())
