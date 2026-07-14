import Image from "next/image";

function NoteIcon({ dim }: { dim: number }) {
  return (
    <svg width={dim} height={dim} viewBox="0 0 24 24" fill="none">
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
  );
}

/** Square cover art for albums/recordings; music-note placeholder when absent.
 *  `fill` mode fills a responsive square parent (used in the albums grid);
 *  otherwise renders at a fixed `size`. Cover Art Archive URLs redirect to
 *  dynamic archive.org hosts, so images load unoptimized. */
export function CoverArt({
  title,
  imageUrl,
  size = 64,
  fill = false,
}: {
  title: string;
  imageUrl?: string | null;
  size?: number;
  fill?: boolean;
}) {
  if (imageUrl) {
    if (fill) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={imageUrl} alt={title} loading="lazy" className="h-full w-full object-cover" />;
    }
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

  if (fill) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-accent/5 text-accent-soft">
        <NoteIcon dim={40} />
      </div>
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-md border border-line bg-accent/5 text-accent-soft"
      aria-hidden="true"
    >
      <NoteIcon dim={size * 0.4} />
    </div>
  );
}
