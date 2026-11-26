"use client";

import { GameImage } from "../GameImage";

/** Game-data element icon by display name ("Lightning" is "Thunder" in the data). */
export function ElementIcon({ name, size = 18 }: { name: string; size?: number }) {
  const id = name === "Lightning" ? "Thunder" : name;
  return <span title={name} style={{ width: size, height: size }} className="inline-block shrink-0"><GameImage path={`icon/element/${id}.png`} alt={name} className="h-full w-full object-contain" rounded="rounded-none" /></span>;
}
