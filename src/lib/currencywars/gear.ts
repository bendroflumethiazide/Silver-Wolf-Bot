/**
 * Equipment Tracking (like the game's): which items, and which crafting components, tracked characters
 * need for their recommended equipment, and whether a component can be crafted right away.
 */
import { madeFrom } from "./items";
import type { CwPack } from "./sim";

/** Every item recommended for a character in their position (or every group when unplaced). */
export function recommendedFor(pack: CwPack, name: string, place?: "on" | "off" | "bench"): string[] {
  const groups = pack.info?.[name]?.recommended ?? [];
  const want = place === "off" ? /^off/i : place === "on" ? /^on/i : null;
  const match = want ? groups.filter((g) => want.test(g.group)) : [];
  const pick = match.length ? match : groups;
  return [...new Set(pick.flatMap((g) => g.items))];
}

export interface GearTarget { name: string; place?: "on" | "off" | "bench"; held: string[] }
export interface GearNeed { who: string; makes: string; /** The other component, when this is a component. */ partner?: string }

/** item or component → which tracked character needs it, and for what. Items a character already holds are skipped. */
export function gearNeeds(pack: CwPack, targets: GearTarget[]): Map<string, GearNeed[]> {
  const out = new Map<string, GearNeed[]>();
  const add = (key: string, need: GearNeed) => {
    const list = out.get(key) ?? [];
    if (!list.some((n) => n.who === need.who && n.makes === need.makes && n.partner === need.partner)) out.set(key, [...list, need]);
  };
  for (const t of targets) {
    for (const rec of recommendedFor(pack, t.name, t.place)) {
      if (t.held.includes(rec)) continue;
      add(rec, { who: t.name, makes: rec });
      const recipe = madeFrom(pack, rec)[0];
      if (recipe) { add(recipe[0], { who: t.name, makes: rec, partner: recipe[1] }); add(recipe[1], { who: t.name, makes: rec, partner: recipe[0] }); }
    }
  }
  return out;
}

/**
 * How an item relates to tracked gear: `wanted` (thumbs-up) when it is, or is a component of, a tracked
 * character's recommended item; `ready` (blue outline) when you already have the other component.
 * `have` is what you'd have to craft with (bag and the items the tracked characters hold), without this item.
 */
export function gearMark(needs: Map<string, GearNeed[]>, item: string, have: string[]): { wanted: boolean; ready: boolean; notes: string[] } {
  const list = needs.get(item) ?? [];
  const ready = list.filter((n) => n.partner && have.includes(n.partner));
  return {
    wanted: list.length > 0,
    ready: ready.length > 0,
    notes: list.map((n) => (n.partner ? `${n.who}: ${n.makes} (with ${n.partner}${have.includes(n.partner) ? ", which you have" : ""})` : `${n.who}: ${n.makes}`)),
  };
}

/** Wiki text with "Unknown" items filled in: an "X Emblem (Set)" plan's first one is the X Emblem. */
export function fillUnknown(source: string, effect: string): string {
  const emblem = /^(.+? Emblem)(?: Set)?$/.exec(source.trim())?.[1];
  let first = true;
  return effect.replace(/"Unknown(?:\{\{verify\}\})?([,.]?)"/gi, (_m, punct: string) => {
    if (emblem && first) { first = false; return `"${emblem}${punct}"`; }
    first = false;
    return `"an item the wiki hasn't named${punct}"`;
  });
}
