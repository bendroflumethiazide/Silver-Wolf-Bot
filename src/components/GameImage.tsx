"use client";

import { useEffect, useState } from "react";
import { ASSET_CACHE } from "@/lib/backup";
import { assetUrl } from "@/lib/gamedata/source";
import { useApp } from "@/lib/store";
import { cx } from "./ui";

const memory = new Map<string, string>();

/** Resolve a StarRailRes asset path to a displayable URL, caching it offline in Cache Storage. */
async function resolve(path: string, cache: boolean): Promise<string> {
  const url = assetUrl(path)!;
  if (memory.has(url)) return memory.get(url)!;
  if (typeof caches !== "undefined") {
    try {
      const c = await caches.open(ASSET_CACHE);
      let res = await c.match(url);
      if (!res && cache && navigator.onLine) {
        const fresh = await fetch(url, { mode: "cors" });
        if (fresh.ok) { await c.put(url, fresh.clone()); res = fresh; }
      }
      if (res) {
        const obj = URL.createObjectURL(await res.blob());
        memory.set(url, obj);
        return obj;
      }
    } catch {
      /* fall through to the network URL */
    }
  }
  return url;
}

/** Game artwork with an offline cache and a typographic fallback when the asset is unavailable. */
export function GameImage({ path, alt, className, fallback, rounded = "rounded-lg" }: { path?: string | null; alt: string; className?: string; fallback?: string; rounded?: string }) {
  const cacheImages = useApp((s) => s.settings.cacheImages);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    setSrc(null);
    if (!path) return;
    resolve(path, cacheImages).then((u) => alive && setSrc(u)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [path, cacheImages]);

  if (!path || failed || !src) {
    const initials = (fallback ?? alt).split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    return (
      <div className={cx("pixel-grid flex items-center justify-center bg-gradient-to-br from-violet-950/60 to-black/60 font-mono text-xs text-violet/80", rounded, className)} role="img" aria-label={alt}>
        {path && !failed && !src ? <span className="animate-pulse">··</span> : initials}
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cx("object-cover", rounded, className)} />;
}
