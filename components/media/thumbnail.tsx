"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";

export function Thumbnail({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="thumbnail-fallback" role="img" aria-label={`${alt} preview unavailable`}><ImageOff size={23} aria-hidden="true" /><small>Preview unavailable</small></span>;
  return <Image src={src} alt={alt} width={873} height={360} sizes="(max-width: 540px) calc(100vw - 34px), (max-width: 820px) 45vw, (max-width: 1350px) 28vw, 260px" priority={priority} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" unoptimized onError={() => setFailed(true)} />;
}
