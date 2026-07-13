import Image from "next/image";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Circular portrait for composers and artists; monogram fallback when no image. */
export function Portrait({
  name,
  imageUrl,
  size = 48,
}: {
  name: string;
  imageUrl?: string | null;
  size?: number;
}) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        // Anchor the crop to the top so heads aren't clipped on tall portraits.
        className="shrink-0 rounded-full object-cover object-top"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className="flex shrink-0 items-center justify-center rounded-full bg-accent/10 font-display font-semibold text-accent"
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
