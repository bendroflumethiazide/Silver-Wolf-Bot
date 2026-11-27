/**
 * Currency Wars pictures bundled with the app (public/cw, from the HSR Wiki; see THIRD_PARTY_NOTICES).
 * Lookup by name with the manifest's aliases, plus fallbacks: a privileged item uses its base picture, a Strategy's
 * Gold/Prismatic/"+" version uses its base version's, "X Emblem (Set)" uses the X Emblem, "X's Invitation" the X Emblem
 * and "X Index Funds" the X Bond.
 */
import { CW_ICON_INDEX } from "./iconIndex";

export type IconKind = "item" | "character" | "bond" | "environment" | "strategy" | "companion" | "resource" | "misc";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const url = (kind: string, slug: string) => (slug.startsWith("../") ? `${BASE}/cw/${slug.slice(3)}.webp` : `${BASE}/cw/${kind}/${slug}.webp`);
const find = (kind: IconKind, name: string) => CW_ICON_INDEX[kind]?.[name];

export function cwIcon(kind: IconKind, name: string): string | null {
  const hit = find(kind, name);
  if (hit) return url(kind, hit);
  let m: RegExpExecArray | null;
  if (kind === "item" && name.endsWith(": Privilege")) return cwIcon("item", name.slice(0, -": Privilege".length));
  if (kind === "bond" && name.includes(": ")) return cwIcon("bond", name.replace(/: .*$/, ""));
  if (kind === "strategy") {
    if ((m = /^(.+ Emblem)(?: Set)?$/.exec(name))) return cwIcon("item", m[1]);
    const base = name.replace(/\++$/, "").replace(/:? (Silver|Gold|Prismatic)$/, "").trim();
    const key = Object.keys(CW_ICON_INDEX.strategy ?? {}).find((k) => k === base || k.replace(/\++$/, "").replace(/:? (Silver|Gold|Prismatic)$/, "").trim() === base);
    return key ? url("strategy", CW_ICON_INDEX.strategy[key]) : null;
  }
  if (kind === "environment") {
    if ((m = /^(.+?)'s? Invitation$/.exec(name))) return cwIcon("item", `${m[1].replace(/^AoE ATK$/, "AoE")} Emblem`);
    if ((m = /^(.+) Index Funds$/.exec(name))) return cwIcon("bond", m[1]);
  }
  return null;
}
