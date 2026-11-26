/**
 * Simulated Universe run simulator (sandbox). Uses the classic Simulated Universe blessings from game
 * data. Blessing ids encode Path and rarity: 612 + Path digit + rarity digit + n, where Path digits are
 * listed in SU_PATHS and rarity digit 3 = ★★★, 4 = ★★, 5 = ★ (612P20 is the Path's Resonance).
 * Offer odds in the real game aren't published; ASSUMPTIONS below are shown in the UI.
 */
import type { GameData, SrrBlessing } from "../gamedata/types";

export const SU_PATHS = ["Preservation", "Remembrance", "Nihility", "Abundance", "The Hunt", "Destruction", "Elation", "Propagation", "Erudition"] as const;
export type SuPath = (typeof SU_PATHS)[number];

export const ASSUMPTIONS = {
  /** Chance each offered blessing belongs to your chosen Path. */
  ownPath: 0.5,
  /** Rarity weights for normal fights (★, ★★, ★★★) and for elites. */
  rarity: [0.7, 0.25, 0.05],
  eliteRarity: [0.35, 0.45, 0.2],
  /** Path blessings needed to unlock Path Resonance. */
  resonanceAt: 3,
  domains: 13,
} as const;

export interface SuBlessing { id: string; name: string; desc: string; enhancedDesc: string; path: SuPath; rarity: 1 | 2 | 3 }

/** Classic SU blessings with their Path and rarity decoded from the id. */
export function classicBlessings(blessings: Record<string, SrrBlessing>): { pool: SuBlessing[]; resonance: Partial<Record<SuPath, SuBlessing>> } {
  const pool: SuBlessing[] = [];
  const resonance: Partial<Record<SuPath, SuBlessing>> = {};
  for (const b of Object.values(blessings)) {
    const m = /^612(\d)(\d)\d$/.exec(b.id);
    if (!m || !b.name) continue;
    const path = SU_PATHS[Number(m[1])];
    if (!path) continue;
    const base = { id: b.id, name: b.name, desc: b.desc, enhancedDesc: b.enhanced_desc, path };
    if (m[2] === "2") { if (b.id.endsWith("20")) resonance[path] = { ...base, rarity: 3 }; continue; }
    const rarity = m[2] === "3" ? 3 : m[2] === "4" ? 2 : m[2] === "5" ? 1 : null;
    if (rarity) pool.push({ ...base, rarity });
  }
  return { pool, resonance };
}

export type DomainKind = "Combat" | "Elite" | "Occurrence" | "Respite" | "Boss";
export interface Owned { blessing: SuBlessing; enhanced: boolean }
export interface RunState {
  path: SuPath;
  domain: number;
  blessings: Owned[];
  curios: string[];
  occurrences: string[];
  log: string[];
  finished: boolean;
}

export const newRun = (path: SuPath): RunState => ({ path, domain: 0, blessings: [], curios: [], occurrences: [], log: [`Chose the Path of ${path}.`], finished: false });

const weighted = (rng: () => number, w: readonly number[]) => { let r = rng(); for (let i = 0; i < w.length; i++) { if (r < w[i]) return i; r -= w[i]; } return w.length - 1; };

/** Next-domain choices: 2–3 options; the last domain is always the Boss. */
export function domainChoices(state: RunState, rng: () => number): DomainKind[] {
  if (state.domain >= ASSUMPTIONS.domains - 1) return ["Boss"];
  const kinds: DomainKind[] = ["Combat", "Combat", "Elite", "Occurrence", "Occurrence", "Respite"];
  const n = 2 + Math.floor(rng() * 2);
  const out: DomainKind[] = [];
  while (out.length < n) { const k = kinds[Math.floor(rng() * kinds.length)]; if (!out.includes(k)) out.push(k); }
  return out;
}

/** Three distinct blessings you don't own yet. */
export function blessingOffer(pool: SuBlessing[], state: RunState, rng: () => number, elite = false): SuBlessing[] {
  const owned = new Set(state.blessings.map((o) => o.blessing.id));
  const offer: SuBlessing[] = [];
  for (let tries = 0; offer.length < 3 && tries < 60; tries++) {
    const own = rng() < ASSUMPTIONS.ownPath;
    const rarity = (weighted(rng, elite ? ASSUMPTIONS.eliteRarity : ASSUMPTIONS.rarity) + 1) as 1 | 2 | 3;
    const cands = pool.filter((b) => b.rarity === rarity && (own ? b.path === state.path : b.path !== state.path) && !owned.has(b.id) && !offer.some((o) => o.id === b.id));
    if (cands.length) offer.push(cands[Math.floor(rng() * cands.length)]);
  }
  return offer;
}

export function pathCount(state: RunState, path = state.path) {
  return state.blessings.filter((o) => o.blessing.path === path).length;
}

export function hasResonance(state: RunState) {
  return pathCount(state) >= ASSUMPTIONS.resonanceAt;
}

/** Take a blessing; logs when Resonance unlocks. */
export function takeBlessing(state: RunState, b: SuBlessing): RunState {
  const before = hasResonance(state);
  const next = { ...state, blessings: [...state.blessings, { blessing: b, enhanced: false }], log: [...state.log, `Took ${"★".repeat(b.rarity)} ${b.name} (${b.path}).`] };
  if (!before && hasResonance(next)) next.log = [...next.log, `Path Resonance unlocked: ${state.path}!`];
  return next;
}

export function enhance(state: RunState, id: string): RunState {
  const target = state.blessings.find((o) => o.blessing.id === id);
  return { ...state, blessings: state.blessings.map((o) => (o.blessing.id === id ? { ...o, enhanced: true } : o)), log: [...state.log, `Enhanced ${target?.blessing.name ?? "a blessing"} at a Respite.`] };
}

export const advance = (state: RunState, label: string): RunState => ({ ...state, domain: state.domain + 1, log: [...state.log, label] });

/** Random curio / occurrence names from game data. */
export function randomCurio(game: GameData, rng: () => number) {
  const list = Object.values(game.curios).filter((c) => c.name);
  return list[Math.floor(rng() * list.length)];
}
export function randomOccurrence(game: GameData, rng: () => number) {
  const list = Object.values(game.simEvents).filter((e) => e.type === "Occurrence" && e.name);
  return list[Math.floor(rng() * list.length)];
}

/** End-of-run summary numbers. */
export function summarize(state: RunState) {
  const byPath = SU_PATHS.map((p) => ({ path: p, count: pathCount(state, p) })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count);
  const rarity = [1, 2, 3].map((r) => state.blessings.filter((o) => o.blessing.rarity === r).length);
  const focus = state.blessings.length ? pathCount(state) / state.blessings.length : 0;
  return { byPath, rarity, focus, enhanced: state.blessings.filter((o) => o.enhanced).length };
}
