/**
 * Currency Wars items: basic and advanced equipment, Emblems, Diamond gems and Crystal Ores.
 *
 * Crystal Ore tiers (White, Blue, Gold, Prismatic) are named on the HSR Wiki (Sparxie's Zero-Sum Game
 * page lists "White/Blue/Golden/Prismatic crystal ore"; Investment Strategies name "Gold" and
 * "Prismatic Crystal Ore"). What a random ore contains isn't published, so ORE_REWARDS is a stated guess.
 */
import { specialItem } from "./specialItems";
import type { CwPack } from "./sim";

export const ORE_TIERS = ["White", "Blue", "Gold", "Prismatic"] as const;
export type OreTier = (typeof ORE_TIERS)[number];
export const oreName = (tier: OreTier) => `${tier} Crystal Ore`;
/** A fixed-content ore, e.g. Print More Money's "crystal ore worth 6 Gold Coins". */
export const goldOreName = (gold: number) => `Crystal Ore (${gold} Gold Coins)`;

export function oreTier(name: string): OreTier | null {
  const m = /^(White|Blue|Gold|Prismatic) Crystal Ore$/.exec(name);
  return m ? (m[1] as OreTier) : null;
}
export const oreGold = (name: string) => { const m = /^Crystal Ore \((\d+) Gold Coins\)$/.exec(name); return m ? Number(m[1]) : null; };
export const isOre = (name: string) => oreTier(name) !== null || oreGold(name) !== null;

/** Guessed contents of a random ore (weights per outcome). Not published by the game. */
export const ORE_REWARDS: Record<OreTier, { weight: number; gold?: [number, number]; basic?: number; character?: number[]; emblem?: boolean; label: string }[]> = {
  White: [
    { weight: 0.7, gold: [2, 3], label: "2–3 gold" },
    { weight: 0.3, character: [1], label: "a 1-cost character" },
  ],
  Blue: [
    { weight: 0.5, gold: [4, 6], label: "4–6 gold" },
    { weight: 0.25, basic: 1, label: "a basic item" },
    { weight: 0.25, character: [2, 3], label: "a 2- or 3-cost character" },
  ],
  Gold: [
    { weight: 0.4, gold: [8, 12], label: "8–12 gold" },
    { weight: 0.3, basic: 1, gold: [3, 3], label: "a basic item and 3 gold" },
    { weight: 0.3, character: [4], label: "a 4-cost character" },
  ],
  Prismatic: [
    { weight: 0.4, gold: [15, 25], basic: 1, label: "15–25 gold and a basic item" },
    { weight: 0.3, character: [5], gold: [5, 5], label: "a 5-cost character and 5 gold" },
    { weight: 0.3, emblem: true, basic: 1, label: "a random Emblem and a basic item" },
  ],
};

/** Ore tier odds for drops, per plane (guesses: rarer ores later). */
export const ORE_DROP_ODDS: number[][] = [
  [0.6, 0.3, 0.09, 0.01],
  [0.4, 0.4, 0.17, 0.03],
  [0.25, 0.4, 0.3, 0.05],
];

export type ItemKind = "basic" | "advanced" | "emblem" | "gem" | "ore" | "consumable" | "component" | "other";

export function itemKind(pack: CwPack, name: string): ItemKind {
  const eq = pack.equipment;
  if (isOre(name)) return "ore";
  if (eq?.basic.some((b) => b.name === name)) return "basic";
  if (eq?.advanced.some((a) => a.name === name)) return "advanced";
  if (eq?.emblems?.some((e) => e.name === name)) return "emblem";
  if (eq?.gems?.some((g) => g.name === name)) return "gem";
  const sp = specialItem(name);
  if (sp) return sp.kind;
  return "other";
}

/** What two items make together, whatever kind of recipe it is. */
export function combineResult(pack: CwPack, a: string, b: string): string | null {
  const eq = pack.equipment;
  if (!eq) return null;
  const match = (r: readonly [string, string] | null | undefined) => !!r && ((r[0] === a && r[1] === b) || (r[0] === b && r[1] === a));
  return eq.advanced.find((x) => match(x.recipe))?.name
    ?? eq.emblems?.find((x) => match(x.recipe))?.name
    ?? eq.gems?.find((x) => x.recipes.some(match))?.name
    ?? null;
}

/** Everything this item can be combined with, and what each pair makes. */
export function combinations(pack: CwPack, name: string): { partner: string; makes: string }[] {
  const eq = pack.equipment;
  if (!eq) return [];
  const parts = [...eq.basic.map((b) => b.name), ...(eq.gems ?? []).map((g) => g.name)];
  const out: { partner: string; makes: string }[] = [];
  for (const p of parts) {
    const r = combineResult(pack, name, p);
    if (r) out.push({ partner: p, makes: r });
  }
  return out;
}

/** The two items something is made from. */
export function madeFrom(pack: CwPack, name: string): [string, string][] {
  const eq = pack.equipment;
  const adv = eq?.advanced.find((a) => a.name === name);
  if (adv) return [adv.recipe];
  const em = eq?.emblems?.find((e) => e.name === name);
  if (em?.recipe) return [em.recipe];
  return eq?.gems?.find((g) => g.name === name)?.recipes ?? [];
}

/** Display text for any item. */
export function describe(pack: CwPack, name: string): { kind: ItemKind; kindLabel: string; summary: string; details: string[]; users: string[] } {
  const eq = pack.equipment;
  const kind = itemKind(pack, name);
  if (kind === "basic") { const b = eq!.basic.find((x) => x.name === name)!; return { kind, kindLabel: `Basic equipment · ${b.tags.join(", ")}`, summary: b.stats, details: [], users: [] }; }
  if (kind === "advanced") { const a = eq!.advanced.find((x) => x.name === name)!; return { kind, kindLabel: `Advanced equipment · ${a.tags.join(", ")}`, summary: a.effect, details: a.stats, users: a.users }; }
  if (kind === "emblem") { const e = eq!.emblems!.find((x) => x.name === name)!; return { kind, kindLabel: `Emblem · ${e.bond}`, summary: e.effect, details: e.stats, users: e.users }; }
  if (kind === "gem") { const g = eq!.gems!.find((x) => x.name === name)!; return { kind, kindLabel: "Diamond", summary: g.effect, details: [], users: [] }; }
  if (kind === "ore") {
    const gold = oreGold(name);
    if (gold !== null) return { kind, kindLabel: "Crystal Ore", summary: `Open it for ${gold} Gold Coins.`, details: [], users: [] };
    const tier = oreTier(name)!;
    return { kind, kindLabel: `Crystal Ore · ${tier}`, summary: "Tap to open. Ores hold Gold Coins, characters or equipment; rarer ores hold more.", details: ORE_REWARDS[tier].map((r) => `${Math.round(r.weight * 100)}%: ${r.label} (guess)`), users: [] };
  }
  const sp = specialItem(name);
  if (sp) return { kind, kindLabel: `${sp.kind === "component" ? "Component" : "Consumable"} · ${sp.source}`, summary: sp.text, details: sp.verified ? [] : ["(Wording partly assumed: the wiki doesn't give every detail.)"], users: sp.only ? [sp.only] : [] };
  return { kind, kindLabel: "Item", summary: "", details: [], users: [] };
}

/** Bond an Emblem grants, if the item is one. */
export const emblemBond = (pack: CwPack, name: string) => pack.equipment?.emblems?.find((e) => e.name === name)?.bond ?? null;
