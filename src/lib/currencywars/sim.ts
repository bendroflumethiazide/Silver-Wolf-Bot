import { wikiQueryAll, wikiText, WIKI } from "../wiki/fandom";
import {
  parseBonds, parseCharacters, parseCharInfo, parseCurrentSeason, parseDifficulty, parseEnvironments, parseEquipment, parseOdds, parseRareEquipment,
  parseOpponents, parseStrategies,
  type BondTier, type CwAdvancedItem, type CwBasicItem, type CwEmblem, type CwGem, type CwBond, type CwCharacter, type CwCharInfo, type CwDifficulty,
  type CwNamed, type CwOdds, type CwOpponent, type CwStrategy,
} from "./parse";

export const CW_PACK_KEY = "cwPack";
/** Bump when CwPack gains fields, so the page can ask for a re-download. */
export const CW_PACK_SCHEMA = 4;

export interface CwPack {
  schema?: number;
  season: string;
  version: string;
  characters: CwCharacter[];
  bonds: CwBond[];
  odds: CwOdds[];
  /** Page the shop odds came from (the current season's page may not list them yet). */
  oddsFrom: string;
  equipment?: { basic: CwBasicItem[]; advanced: CwAdvancedItem[]; emblems?: CwEmblem[]; gems?: CwGem[] };
  environments?: CwNamed[];
  strategies?: CwStrategy[];
  opponents?: CwOpponent[];
  difficulty?: CwDifficulty[];
  /** Per-character position, roles and strength by star, from "<Name> (<Season>)" pages. */
  info?: Record<string, CwCharInfo>;
  fetchedAt: string;
  source: string;
  license: string;
}

/** Character pages in batches of 50 titles (the API limit). Missing pages are skipped. */
async function downloadCharInfo(names: string[], season: string, fetchFn: typeof fetch): Promise<Record<string, CwCharInfo>> {
  const out: Record<string, CwCharInfo> = {};
  const suffix = ` (${season})`;
  for (let i = 0; i < names.length; i += 50) {
    const titles = names.slice(i, i + 50).map((n) => n + suffix).join("|");
    const pages = await wikiQueryAll({ prop: "revisions", rvprop: "content", rvslots: "main", titles }, 3, fetchFn);
    for (const p of Object.values(pages)) {
      const rev = (p.revisions as { slots?: { main?: { "*"?: string } }; "*"?: string }[] | undefined)?.[0];
      const text = rev?.slots?.main?.["*"] ?? rev?.["*"];
      const title = String(p.title ?? "");
      const info = text ? parseCharInfo(text) : null;
      if (info && title.endsWith(suffix)) out[title.slice(0, -suffix.length)] = info;
    }
  }
  return out;
}

/** Download the current Currency Wars season from the wiki (about ten requests). */
export async function downloadCwPack(fetchFn: typeof fetch = fetch): Promise<CwPack> {
  const cur = parseCurrentSeason(await wikiText("Currency Wars", fetchFn));
  if (!cur) throw new Error("Couldn't find the current Currency Wars period on the wiki.");
  const base = `Currency Wars: ${cur.season}`;
  const optional = (title: string) => wikiText(title, fetchFn).catch(() => "");
  const [charsText, bondsText, mainText, equipText, envText, stratText, oppText] = await Promise.all([
    wikiText(`${base}/Characters`, fetchFn),
    wikiText(`${base}/Bonds`, fetchFn),
    optional(base),
    optional(`${base}/Equipment`),
    optional(`${base}/Investment Environment`),
    optional(`${base}/Investment Strategy`),
    optional(`${base}/Opponent`),
  ]);
  const characters = parseCharacters(charsText);
  const bonds = parseBonds(bondsText);
  if (!characters.length || !bonds.length) throw new Error("The wiki pages for this period are empty or changed format.");
  let odds = parseOdds(mainText);
  let oddsFrom = base;
  if (!odds.length) {
    oddsFrom = "Currency Wars: Zero-Sum Game";
    odds = parseOdds(await optional(oddsFrom));
  }
  const info = await downloadCharInfo(characters.map((c) => c.name), cur.season, fetchFn).catch(() => ({}));
  return {
    schema: CW_PACK_SCHEMA, season: cur.season, version: cur.version, characters, bonds, odds, oddsFrom,
    equipment: { ...parseEquipment(equipText), ...parseRareEquipment(equipText) }, environments: parseEnvironments(envText), strategies: parseStrategies(stratText),
    opponents: parseOpponents(oppText), difficulty: parseDifficulty(oppText), info,
    fetchedAt: new Date().toISOString(), source: WIKI.name, license: WIKI.license,
  };
}

/** Bonds that come as per-game variants ("Phantasmoon Games: Wishpower", "…: Roll-Call"), by family. */
export function bondVariants(bonds: CwBond[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const b of bonds) { const m = /^(.+?): /.exec(b.name); if (m) (groups[m[1]] ??= []).push(b.name); }
  return Object.fromEntries(Object.entries(groups).filter(([, v]) => v.length > 1));
}

/** Keep one variant per family: the chosen one, or the first. */
export function withVariants(bonds: CwBond[], chosen: Record<string, string> = {}): CwBond[] {
  const fams = bondVariants(bonds);
  const skip = new Set(Object.entries(fams).flatMap(([f, names]) => names.filter((n) => n !== (chosen[f] && names.includes(chosen[f]) ? chosen[f] : names[0]))));
  return bonds.filter((b) => !skip.has(b.name));
}

export interface BoardUnit {
  name: string;
  stars: 1 | 2 | 3;
  /** Team builder placement; older saves have none and count as on-field. */
  place?: "on" | "off";
}

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
export function rollShop(odds: CwOdds[], level: number, roster: CwCharacter[], rng: () => number, slots = 5, exclude?: Set<string>): CwCharacter[] {
  const row = odds.find((o) => o.level === level)?.odds ?? [1, 0, 0, 0, 0];
  const out: CwCharacter[] = [];
  for (let i = 0; i < slots; i++) {
    let r = rng(), cost = 1;
    for (let c = 0; c < 5; c++) { if (r < row[c]) { cost = c + 1; break; } r -= row[c]; }
    const pool = roster.filter((ch) => ch.cost === cost && !exclude?.has(ch.name));
    if (pool.length) out.push(pool[Math.floor(rng() * pool.length)]);
  }
  return out;
}
