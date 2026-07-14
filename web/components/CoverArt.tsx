"use client";

import Image from "next/image";
import { useState } from "react";

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

/** Square cover art for albums/recordings; a music-note placeholder shows
 *  immediately behind the image and the cover fades in on load, so there's no
 *  blank→pop. `fill` mode fills a responsive square parent (albums grid);
 *  otherwise it renders at a fixed `size`. Images go through Next's optimizer
 *  (resized, cached, WebP). Cover Art Archive URLs are normalized to https to
 *  avoid an extra http→https redirect hop. */
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
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = imageUrl ? imageUrl.replace(/^http:\/\//, "https://") : null;
  const showImage = src && !failed;

  // The placeholder fades out as the image fades in, so it never lingers over
  // the artwork regardless of stacking order.
  const placeholder = (
    <div
      className={`absolute inset-0 flex items-center justify-center bg-accent/5 text-accent-soft transition-opacity duration-500 ${
        loaded ? "opacity-0" : "opacity-100"
      }`}
    >
      <NoteIcon dim={fill ? 40 : Math.round(size * 0.4)} />
    </div>
  );

  const imgClass = `object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`;
  const onLoad = () => setLoaded(true);
  const onError = () => setFailed(true);

  if (fill) {
    return (
      <div className="absolute inset-0">
        {placeholder}
        {showImage && (
          <Image
            src={src}
            alt={title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            onLoad={onLoad}
            onError={onError}
            className={imgClass}
          />
        )}
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="relative shrink-0 overflow-hidden rounded-md"
    >
      {placeholder}
      {showImage && (
        <Image
          src={src}
          alt={title}
          width={size}
          height={size}
          onLoad={onLoad}
          onError={onError}
          className={`h-full w-full ${imgClass}`}
        />
      )}
    </div>
  );
}
