import Image from "next/image";

/** Square cover art for recordings; music-note placeholder until covers are imported. */
export function CoverArt({
  title,
  imageUrl,
  size = 64,
}: {
  title: string;
  imageUrl?: string | null;
  size?: number;
}) {
  if (imageUrl) {
    // Cover Art Archive URLs redirect to dynamic archive.org CDN hosts that the
    // Next image optimizer can't follow, so load them unoptimized (the browser
    // follows the redirects directly).
    return (
      <Image
        src={imageUrl}
        alt={title}
        width={size}
        height={size}
        unoptimized
        style={{ width: size, height: size }}
        className="shrink-0 rounded-md object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-md border border-line bg-accent/5 text-accent-soft"
      aria-hidden="true"
    >
      <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 24 24" fill="none">
        <path
          d="M9 18V5l10-2v13"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </div>
  );
}
