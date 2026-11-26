/**
 * The character card's ability box (as in the game): ability name, category labels and summary.
 *
 * Labels come from the wiki's Currency Wars ability table for the position the character is in
 * ("On Field" / "Off Field" groups; one group when the character has a single kit): each ability row's
 * Type with "(Change)"/"(New)" removed, in the game's order. This matches the game's cards, e.g. Pearl
 * "Basic ATK · Ultimate · Elation Skill · Talent · Innate Trace", Sunday (On-Field) "Ultimate · Talent",
 * Silver Wolf LV.999 "Talent", Topaz & Numby (Off-Field) "Skill · Talent".
 */
import type { CwCharInfo } from "./parse";

/** The game's label order. */
export const LABEL_ORDER = ["Basic ATK", "Enhanced Basic ATK", "Skill", "Ultimate", "Elation Skill", "Follow-Up ATK", "Talent", "Innate Trace", "Memosprite Skill", "Memosprite Talent", "Summon", "Technique", "Character Empowerment", "Bond Effect"];

export const normalizeLabel = (t: string) => t.replace(/\s*\((?:Change|New)\)\s*$/i, "").replace(/^Elation$/i, "Elation Skill").trim();

/** The ability group for a position. */
export function groupFor(info: CwCharInfo | null | undefined, place: "on" | "off" | "bench", cost?: number) {
  const groups = info?.abilities ?? [];
  if (!groups.length) return null;
  const want = place === "off" ? /off/i : /on/i;
  const byCost = cost ? groups.find((g) => new RegExp(`^${cost}-Cost`, "i").test(g.group)) : undefined;
  return byCost ?? groups.find((g) => want.test(g.group) && !(place !== "off" && /off/i.test(g.group))) ?? groups[0];
}

/** Wiki typos corrected to the in-game names (checked against the game's card). */
const NAME_FIX: Record<string, string> = { "Blezzed Brushwork": "Blessed Brushwork" };

export interface AbilityCard { name: string; labels: string[]; desc: string; energy?: number }

/** The card's ability box for a character in a position. */
export function abilityCard(info: CwCharInfo | null | undefined, place: "on" | "off" | "bench", cost?: number): AbilityCard | null {
  if (!info) return null;
  const sums = info.summaries ?? [];
  const field = info.field;
  // Infobox order: ability1 = On-Field kit, ability2 = Off-Field kit (for On/Off-Field characters); cost tabs for Aeon ★ Aha.
  const costIdx = cost && sums.length > 2 ? Math.max(0, [4, 5, 7].indexOf(cost)) : -1;
  const sum = costIdx >= 0 ? sums[costIdx] : field === "both" && sums.length >= 2 ? sums[place === "off" ? 1 : 0] : sums[0];
  const group = groupFor(info, place, cost);
  const fromRows = group ? group.list.flatMap((a) => a.types.map(normalizeLabel)) : [];
  const raw = fromRows.length ? fromRows : (sum?.types ?? []).map(normalizeLabel);
  const labels = [...new Set(raw)].sort((a, b) => (LABEL_ORDER.indexOf(a) + 1 || 99) - (LABEL_ORDER.indexOf(b) + 1 || 99));
  if (!sum && !group) return null;
  const name = sum?.name ?? group?.list[0]?.name ?? "";
  return { name: NAME_FIX[name] ?? name, labels, desc: sum?.desc ?? "", energy: sum?.energy };
}
