import { wikiText, WIKI } from "../wiki/fandom";
import { parseBonds, parseCharacters, parseCurrentSeason, parseOdds, type BondTier, type CwBond, type CwCharacter, type CwOdds } from "./parse";

export const CW_PACK_KEY = "cwPack";

export interface CwPack {
  season: string;
  version: string;
  characters: CwCharacter[];
  bonds: CwBond[];
  odds: CwOdds[];
  /** Page the shop odds came from (the current season's page may not list them yet). */
  oddsFrom: string;
  fetchedAt: string;
  source: string;
  license: string;
}

/** Download the current Currency Wars season from the wiki. */
export async function downloadCwPack(fetchFn: typeof fetch = fetch): Promise<CwPack> {
  const cur = parseCurrentSeason(await wikiText("Currency Wars", fetchFn));
  if (!cur) throw new Error("Couldn't find the current Currency Wars period on the wiki.");
  const base = `Currency Wars: ${cur.season}`;
  const [charsText, bondsText, mainText] = await Promise.all([
    wikiText(`${base}/Characters`, fetchFn),
    wikiText(`${base}/Bonds`, fetchFn),
    wikiText(base, fetchFn).catch(() => ""),
  ]);
  const characters = parseCharacters(charsText);
  const bonds = parseBonds(bondsText);
  if (!characters.length || !bonds.length) throw new Error("The wiki pages for this period are empty or changed format.");
  let odds = parseOdds(mainText);
  let oddsFrom = base;
  if (!odds.length) {
    oddsFrom = "Currency Wars: Zero-Sum Game";
    odds = parseOdds(await wikiText(oddsFrom, fetchFn).catch(() => ""));
  }
  return { season: cur.season, version: cur.version, characters, bonds, odds, oddsFrom, fetchedAt: new Date().toISOString(), source: WIKI.name, license: WIKI.license };
}

export interface BoardUnit { name: string; stars: 1 | 2 | 3 }

export interface BondState {
  bond: CwBond;
  /** Unique members on the board. */
  count: number;
  active: CwBond["levels"][number] | null;
  next: CwBond["levels"][number] | null;
  tier: BondTier | null;
}

/** Bonds touched by the board. A character counts once per bond, however many copies you field. */
export function boardBonds(board: BoardUnit[], bonds: CwBond[]): BondState[] {
  const names = new Set(board.map((u) => u.name));
  return bonds
    .map((bond) => {
      const count = bond.members.filter((m) => names.has(m)).length;
      const reached = bond.levels.filter((l) => l.count <= count);
      const active = reached[reached.length - 1] ?? null;
      const next = bond.levels.find((l) => l.count > count) ?? null;
      return { bond, count, active, next, tier: active?.tier ?? null };
    })
    .filter((b) => b.count > 0)
    .sort((a, b) => Number(!!b.active) - Number(!!a.active) || b.count - a.count || a.bond.name.localeCompare(b.bond.name));
}

/** Copies needed for a star level: 3 one-stars make a two-star, 3 two-stars a three-star. */
export const copiesFor = (stars: 1 | 2 | 3) => (stars === 1 ? 1 : stars === 2 ? 3 : 9);

/** Gold spent buying the board from the shop (cost × copies). */
export function boardGold(board: BoardUnit[], roster: CwCharacter[]): number {
  const cost = new Map(roster.map((c) => [c.name, c.cost]));
  return board.reduce((sum, u) => sum + (cost.get(u.name) ?? 0) * copiesFor(u.stars), 0);
}

/** Chance of at least one character of `cost` among `slots` shop offers at this level. */
export function chanceToSee(odds: CwOdds[], level: number, cost: number, slots: number): number {
  const p = odds.find((o) => o.level === level)?.odds[cost - 1] ?? 0;
  return 1 - (1 - p) ** slots;
}

/**
 * One shop roll for practice: each slot picks a cost by the level's odds, then a character of that
 * cost uniformly. (Per-character pool sizes aren't documented, so this is a simplification.)
 */
export function rollShop(odds: CwOdds[], level: number, roster: CwCharacter[], rng: () => number, slots = 5): CwCharacter[] {
  const row = odds.find((o) => o.level === level)?.odds ?? [1, 0, 0, 0, 0];
  const out: CwCharacter[] = [];
  for (let i = 0; i < slots; i++) {
    let r = rng(), cost = 1;
    for (let c = 0; c < 5; c++) { if (r < row[c]) { cost = c + 1; break; } r -= row[c]; }
    const pool = roster.filter((ch) => ch.cost === cost);
    if (pool.length) out.push(pool[Math.floor(rng() * pool.length)]);
  }
  return out;
}
