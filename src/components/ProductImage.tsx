"use client";

import { useState } from "react";

/** A product photo from an outside database, hidden if it doesn't load. */
export function ProductImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-28 w-28 shrink-0 rounded-xl border border-line bg-white object-contain"
    />
  );
}
