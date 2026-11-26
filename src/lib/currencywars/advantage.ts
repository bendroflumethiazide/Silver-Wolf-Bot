/**
 * Advantage Layout and Phantasmal Orbs (Version 4.7), kept across runs.
 *
 * VERIFIED (HSR Wiki "Currency Wars/Advantage Layout"): node names and effects; Seasonal Advantages unlock
 * only after every Permanent Advantage; the layout can be reset at any time, refunding every Orb; each
 * Combat Ability Boost node costs 20 Phantasmal Orbs (Permanent: ATK +12%, HP +6%, CRIT Rate +6%, CRIT DMG
 * +12%, DEF +8%, Break Effect +15%, Effect RES +8%; Seasonal: ATK +36%, DMG Mitigation +25%, DEF +36%,
 * HP +12%, CRIT Rate +18%, Break Effect +30%, Effect RES +16%, CRIT DMG +36%). Seasonal progress belongs to
 * a season; permanent progress stays.
 * PROVISIONAL (ADVANTAGE_ASSUMED): the Orb cost of non-boost nodes (the page shows only the icon) and how
 * many Orbs a run earns; how each node's stat turns into strength uses the simulator's weights.
 */
import type { Stats } from "./combat";

export const ADVANTAGE_ASSUMED = {
  permanentCost: 10,
  seasonalCost: 15,
  boostCost: 20,
  /** Orbs per run: per rank step gained, plus a clear bonus, plus one per plane reached. */
  orbsPerRankStep: 5,
  orbsForClear: 10,
  orbsPerPlane: 2,
} as const;

export interface AdvantageNode {
  id: string;
  name: string;
  kind: "permanent" | "seasonal" | "boost-permanent" | "boost-seasonal";
  text: string;
  cost: number;
  /** Stat effect for the squad (Combat Ability Boosts and simple stat nodes). */
  stats?: Partial<Stats>;
}

const P = (id: string, name: string, text: string): AdvantageNode => ({ id, name, kind: "permanent", text, cost: ADVANTAGE_ASSUMED.permanentCost });
const S = (id: string, name: string, text: string, stats?: Partial<Stats>): AdvantageNode => ({ id, name, kind: "seasonal", text, cost: ADVANTAGE_ASSUMED.seasonalCost, stats });
const B = (id: string, name: string, kind: "boost-permanent" | "boost-seasonal", stats: Partial<Stats>): AdvantageNode => ({ id, name, kind, text: name, cost: ADVANTAGE_ASSUMED.boostCost, stats });

/** Stat → strength share (ATK ≈ DMG at 0.4, CRIT Rate at 0.5, CRIT DMG at 0.5, DEF at 0.25 mitigation, Effect RES small). */
const atk = (p: number) => ({ dmg: p * 0.4 });
const critRate = (p: number) => ({ dmg: p * 0.5 });
const critDmg = (p: number) => ({ dmg: p * 0.5 });
const def = (p: number) => ({ mit: p * 0.25 });
const res = (p: number) => ({ mit: p * 0.1 });

export const ADVANTAGE_NODES: AdvantageNode[] = [
  P("battle-prep", "Battle Prep", "When entering combat, triggers the Technique effects of all On-Field characters."),
  P("gold-blessing", "Gold Blessing", "If the First Plane was cleared in the last game, gains 2 Gold Coin(s) at the start of each Plane in the next game."),
  P("basic-armament", "Basic Armament", "Get one random piece of basic equipment after clearing the Boss Node on the First or Second Plane."),
  P("bonus-supply", "Bonus Supply", "Get one extra reward option at the start of the Supply Phase."),
  P("strategy-refresh", "Strategy Refresh", "You can refresh each investment strategy option 1 time when making a choice."),
  P("sustained-combat", "Sustained Combat", "Get 1 extra piece(s) of basic equipment at the start. Restores 2 Squad HP after combat on a Node."),
  S("pre-battle", "Pre-Battle Suppression", "At the start of battle, recovers 1 Skill Point(s). In Reward Node battles, enemy targets take DMG equal to 99% of their Max HP at the start of battle."),
  S("atk-1", "ATK Boost", "Increases ATK by 12%.", atk(0.12)),
  S("mit-1", "DMG Mitigation", "Reduces DMG taken by 5%.", { mit: 0.05 }),
  S("def-1", "DEF Boost", "Increases DEF by 12%.", def(0.12)),
  S("hp-1", "HP Boost", "Increases Max HP by 4%.", { hp: 0.04 }),
  S("crit-1", "CRIT Rate Boost", "Increases CRIT Rate by 6%.", critRate(0.06)),
  S("break-1", "Break Boost", "Increases Break Effect by 15%.", { brk: 0.15 }),
  S("critdmg-1", "CRIT DMG Boost", "Increases CRIT DMG by 12%.", critDmg(0.12)),
  S("res-1", "Effect RES Boost", "Increases Effect RES by 8%.", res(0.08)),
  S("reselect", "Reselect Protagonist", "When entering the Second Plane, gains 1 Plot Armor reselection chance(s)."),
  S("risk-hedging", "Risk Hedging", "Enemies in Encounter Nodes will appear at difficulty level 4."),
  S("total-refresh", "Total Refresh", "When selecting Investment Environments, Encounter Node branches, or supplies in the Supply phase, you can refresh 1 time(s) to reset the options."),
  S("dmg-1", "DMG Boost", "Increases DMG dealt by 6%.", { dmg: 0.06 }),
  S("victory", "Victory Commendation", "When refreshing Plot Armor, duplicate options will not appear within 12 times. When defeating the final boss with 1 or more Cycles remaining, restores 40% Squad HP. Increases Lucky Strike DMG by 10%.", { luckyDmg: 0.1 }),
  S("diamond", "Shining Diamond", "There is a chance for Diamond equipment to appear as an option in the Supply Phase."),
  S("claims", "Claims Settlement", "When squad HP drops below 50 for the first time, obtain 5 Gold Coin(s). When the winning streak is 0, you can still obtain 1 Gold Coin(s) as a winning streak reward."),
  S("plot-selection", "Plot Armor Selection", "When selecting Plot Armor, the number of refreshes costing 1 Gold Coin(s) increases by 2."),
  S("safety", "Safety Mechanism", "The first time squad HP would be reduced to 0, it remains at 1, preventing a game over. DMG received decreases by 10%. The strength of Healing and Shield increases by 10%.", { support: 0.1 }),
  S("action-recovery", "Action Recovery", "When the character receives a killing blow, the action value penalty is reduced by 10 points."),
  S("luck-escapade", "Luck Escapade", "There is a chance for luckier Escapade Occurrences to appear!"),
  S("master-smith", "Master Smith", "When entering the Second Plane, gains \"Smelting Furnace\" and \"Disassembly Wrench.\""),
  S("fauna", "Fantastic Fauna", "There is a chance for Trotters to appear in your battles. Defeat them to get random rewards. DMG Amplification increases by 10%. When reaching a winning streak of 6 or higher, the winning streak reward increases to 4 Gold Coins.", { dmg: 0.1 }),
  B("pb-atk", "ATK +12%", "boost-permanent", atk(0.12)), B("pb-hp", "HP +6%", "boost-permanent", { hp: 0.06 }), B("pb-crit", "CRIT Rate +6%", "boost-permanent", critRate(0.06)),
  B("pb-critdmg", "CRIT DMG +12%", "boost-permanent", critDmg(0.12)), B("pb-def", "DEF +8%", "boost-permanent", def(0.08)), B("pb-break", "Break Effect +15%", "boost-permanent", { brk: 0.15 }),
  B("pb-res", "Effect RES +8%", "boost-permanent", res(0.08)),
  B("sb-atk", "ATK +36%", "boost-seasonal", atk(0.36)), B("sb-mit", "DMG Mitigation +25%", "boost-seasonal", { mit: 0.25 }), B("sb-def", "DEF +36%", "boost-seasonal", def(0.36)),
  B("sb-hp", "HP +12%", "boost-seasonal", { hp: 0.12 }), B("sb-crit", "CRIT Rate +18%", "boost-seasonal", critRate(0.18)), B("sb-break", "Break Effect +30%", "boost-seasonal", { brk: 0.3 }),
  B("sb-res", "Effect RES +16%", "boost-seasonal", res(0.16)), B("sb-critdmg", "CRIT DMG +36%", "boost-seasonal", critDmg(0.36)),
];
export const advNode = (id: string) => ADVANTAGE_NODES.find((n) => n.id === id);

export interface AdvantageLayout {
  orbs: number;
  /** Unlocked node ids. */
  unlocked: string[];
  /** The season the seasonal nodes belong to. */
  season: string;
  /** Whether the First Plane was cleared in the last run (Gold Blessing). */
  lastPlaneOne?: boolean;
  /** Runs already paid out (so a reload never pays twice). */
  paid: string[];
}

export const emptyLayout = (season: string): AdvantageLayout => ({ orbs: 0, unlocked: [], season, paid: [] });
const isSeasonal = (n: AdvantageNode) => n.kind === "seasonal" || n.kind === "boost-seasonal";
const permanentIds = ADVANTAGE_NODES.filter((n) => n.kind === "permanent").map((n) => n.id);

/** Why a node can't be unlocked now, or null. */
export function lockReason(l: AdvantageLayout, n: AdvantageNode): string | null {
  if (l.unlocked.includes(n.id)) return "Unlocked";
  if (isSeasonal(n) && !permanentIds.every((id) => l.unlocked.includes(id))) return "Unlock every Permanent Advantage first";
  if (l.orbs < n.cost) return `${n.cost} Phantasmal Orbs`;
  return null;
}

export function unlockNode(l: AdvantageLayout, id: string): AdvantageLayout {
  const n = advNode(id);
  if (!n || lockReason(l, n)) return l;
  return { ...l, orbs: l.orbs - n.cost, unlocked: [...l.unlocked, id] };
}

/** Reset refunds every Orb spent. */
export function resetLayout(l: AdvantageLayout): AdvantageLayout {
  const refund = l.unlocked.reduce((n, id) => n + (advNode(id)?.cost ?? 0), 0);
  return { ...l, orbs: l.orbs + refund, unlocked: [] };
}

/** A new season: seasonal nodes are refunded and locked; permanent ones stay. */
export function syncSeason(l: AdvantageLayout, season: string): AdvantageLayout {
  if (l.season === season) return l;
  const seasonal = l.unlocked.filter((id) => { const n = advNode(id); return n && isSeasonal(n); });
  const refund = seasonal.reduce((n, id) => n + (advNode(id)?.cost ?? 0), 0);
  return { ...l, season, orbs: l.orbs + refund, unlocked: l.unlocked.filter((id) => !seasonal.includes(id)) };
}

/** Orbs a finished run earns (once per run). */
export function payRun(l: AdvantageLayout, run: { id: string; cleared: boolean; rankSteps: number; planesReached: number; planeOneCleared: boolean }): [AdvantageLayout, number] {
  if (l.paid.includes(run.id)) return [l, 0];
  const n = run.rankSteps * ADVANTAGE_ASSUMED.orbsPerRankStep + (run.cleared ? ADVANTAGE_ASSUMED.orbsForClear : 0) + run.planesReached * ADVANTAGE_ASSUMED.orbsPerPlane;
  return [{ ...l, orbs: l.orbs + n, paid: [...l.paid, run.id].slice(-100), lastPlaneOne: run.planeOneCleared }, n];
}

/** Squad stats from unlocked nodes. */
export function advantageStats(ids: string[]): Partial<Stats> {
  const out: Partial<Stats> = {};
  for (const id of ids) for (const [k, v] of Object.entries(advNode(id)?.stats ?? {})) out[k as keyof Stats] = (out[k as keyof Stats] ?? 0) + (v ?? 0);
  return out;
}
