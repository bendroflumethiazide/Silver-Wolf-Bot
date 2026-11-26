/**
 * Currency Wars run simulator (sandbox). Pure, seeded state machine: every action takes a state and
 * returns a new one, so runs replay exactly from their seed.
 *
 * RULES holds numbers checked against the Honkai: Star Rail Wiki (Currency Wars pages and tutorial
 * texts, Version 4.7) or the game's own screens. ASSUMED holds numbers the game doesn't publish;
 * the UI lists them. Combat is a strength comparison built from each character's wiki stats, not a
 * turn-by-turn battle.
 */
import { createRng } from "../warp/simulator";
import type { CwAdvancedItem, CwCharInfo, CwNamed, CwStrategy, StrategyRarity } from "./parse";
import { combineResult, emblemBond, goldOreName, isOre, itemKind, ORE_DROP_ODDS, ORE_REWARDS, ORE_TIERS, oreGold, oreName, oreTier, type OreTier } from "./items";
import { membersOf } from "./bonds";
import { boardBonds, bondVariants, copiesFor, rollShop, withVariants, type CwPack } from "./sim";
import { buildTimeline, type Timeline, type TlKind } from "./timeline";
import { GRADES, offerGrades, shiftGrade, startingRefreshes, type Grade, type GradeRules, type OfferMeta, type PendingSelection } from "./strategyGrades";
import { kitEffect } from "./kits";
import { advantageStats } from "./advantage";
import { AHA, simulateElation, type AhaState, type ElationResult } from "./elation";
import { addStats, bondEffect, itemEffect, powerMult, zeroStats, type BondCtx, type Stats, type Summon } from "./combat";
import { specialItem } from "./specialItems";
import { afterCombat, expressPower, nodeTp, storeStats, syncTsrLevel, TSR_BOND, tsrOf, type TsrState } from "./trailblazeStore";
import {
  addBasics, afterFight, checkAssignments, chooseTea, enemyMods, enterSpecial, ESCAPADE_ASSUMED, onEnterNode, robotFor, specialNode, startEscapade,
  supplyOffers, synthesisRefund, talentRefill, spendWoofSave, woofSave, xpBonus, type EscapadeState, type TeaOption,
} from "./escapade";
import {
  beginSelection, choosePlot, frenzyContract, PLOT_ARMOR_RULES, plotInvestment, plotOf, plotUnitBonus, remapHolders, rollCallGrant,
  selectionDue, type PlotArmorState, type UnitCtx,
} from "./plotArmor";

export type NodeKind = "Reward" | "Strategy" | "Combat" | "Supply" | "Encounter" | "Boss";

export const RULES = {
  /** Tutorial "Squad HP". */
  startHp: 100,
  /** Tutorial "Gold Coin: Interest": 1 per 10 owned, up to 5. */
  interestPer: 10,
  interestCap: 5,
  /** Tutorial "Store". */
  refreshCost: 2,
  /** The game's "Purchase Experience" button. */
  xpCost: 4,
  shopSlots: 5,
  benchSlots: 9,
  /** Tutorial "Equipment". */
  itemsPerUnit: 3,
  /** Characters page: you start with three characters of up to blue (3-cost) rarity. */
  startUnits: 3,
  /** "Currency Wars/Nodes": node order per plane ("Strategy" = Strategy/Combat). */
  planes: [
    ["Reward", "Reward", "Strategy", "Combat", "Supply", "Combat", "Encounter", "Reward", "Boss"],
    ["Combat", "Strategy", "Supply", "Combat", "Encounter", "Reward", "Boss"],
    ["Combat", "Strategy", "Supply", "Combat", "Encounter", "Reward", "Boss"],
  ] as NodeKind[][],
  /** Squad HP lost when a node isn't cleared in time, [combat, boss] per plane, before the clear-% part. */
  hpLoss: [[5, 10], [10, 15], [15, 20]],
  /** Action Value per node in Voyage Into the Canvas, [combat/encounter, boss] per plane. Two cycles each. */
  actionValue: [[150, 180], [125, 150], [100, 150]],
  supplyOffers: 5,
  strategyOffers: 3,
  environmentOffers: 3,
  /** Encounter nodes appear from Jade Steel (A2). */
  encounterFromRank: 2,
  /** Difficulty table (A1-1): enemy difficulty added by a Silver/Gold/Prismatic strategy. */
  strategyDifficulty: { Silver: 0, Gold: 1, Prismatic: 3 } as Record<StrategyRarity, number>,
  /** Tutorial "Rank: Ascension Rules". */
  rankGain: (hp: number) => (hp >= 70 ? 3 : hp >= 40 ? 2 : 1),
} as const;

export const ASSUMED = {
  /** Base gold after each battle. */
  baseIncome: 6,
  /** Extra gold by winning streak (index = streak, capped at the last entry). */
  streakBonus: [0, 0, 1, 1, 2, 3],
  xpPerBuy: 4,
  xpPerBattle: 2,
  /** XP from level n to n+1. The 84 for level 9 matches the game's screen; the rest are guesses. */
  levelXp: { 1: 2, 2: 2, 3: 6, 4: 10, 5: 20, 6: 36, 7: 48, 8: 76, 9: 84 } as Record<number, number>,
  startLevel: 3,
  maxLevel: 10,
  /** Characters you can deploy = level. */
  teamSize: (level: number) => level,
  onFieldSlots: 4,
  offFieldSlots: 6,
  startGold: 0,
  /** Weights for the three starting characters' cost (1, 2, 3); the wiki says gray and green are commoner. */
  startCost: [0.55, 0.3, 0.15],
  /** Reward nodes: gold dropped by enemies, plus this many Crystal Ores (equipment and characters come from ores). */
  rewardGold: [2, 4] as const,
  rewardOres: 2,
  /** "Gold Miner": the "very small chance" of a Prismatic ore when opening one. */
  goldMinerPrismatic: 0.03,
  strategyRarity: { Silver: 0.5, Gold: 0.35, Prismatic: 0.15 } as Record<StrategyRarity, number>,
  encounter: { easy: { power: 0.9, gold: 2, item: false }, hard: { power: 1.3, gold: 5, item: true } },
  /** Selling returns what the copies cost. */
  sellRefund: (cost: number, stars: 1 | 2 | 3) => cost * copiesFor(stars),
  /** "Downward Mobility of Talent": chance a shop slot is 2-star. */
  twoStarShop: 0.1,
} as const;

/** Combat model weights (a simplification). */
export const MODEL = {
  // Equipment and Bonds now use their own wiki stats and effects (combat.ts).
  /** Extra for an advanced item the wiki lists as good on that character. */
  recommended: 0.1,
  /** How much the HP bonus counts toward strength. */
  hpWeight: 0.5,
  /** Win chance = 1 / (1 + e^(-steepness × (ratio − 1))). */
  steepness: 6,
  enemyScale: 1.0,
  /** Expected player level at the start, at each plane's boss. */
  levelCurve: [3, 6, 8, 9],
} as const;

export interface Unit {
  uid: number; name: string; cost: number; stars: 1 | 2 | 3; items: string[];
  /** A non-character squad member (Peppy): no strength of its own, never merges, its Emblems count for Bonds. */
  npc?: boolean;
  /** Whatever Dice: basic equipment it put on this unit for the current node. */
  dice?: string[];
}
/** A grant that happens later or repeatedly. `text` is wiki wording run through the grant parser (or a special "__" rule). */
export interface Trigger {
  on: "node" | "plane" | "boss" | "combat" | "encounter" | "supply" | "levelup" | "refresh";
  text: string;
  source: string;
  /** Nodes (or refreshes) still to go for a one-shot trigger. */
  after?: number;
  /** Plane index for a plane trigger (undefined = every new plane). */
  plane?: number;
  repeat?: boolean;
}

export interface ShopSlot { name: string; cost: number; stars: 1 | 2 }
export type Zone = "on" | "off" | "bench";
export interface Spot { zone: Zone; index: number }
export type Phase = "environment" | "strategy" | "supply" | "encounter" | "prep" | "result" | "over" | "plotArmor" | "teaBreak";
export interface SupplyOffer { name: string; cost: number; item: string; stars?: 1 | 2 | 3; items?: string[] }
/** Steps that interrupt a node before it continues (Plot Armor selection, a bonus Strategy). */
export interface Interlude { queue: ("plotArmor" | "bonusStrategy" | "imagenae" | "swap")[]; active?: "plotArmor" | "bonusStrategy" | "imagenae" | "swap"; uid?: number; resume: { phase: Phase; offers: RunState["offers"] } }

export interface BattleReport {
  kind: NodeKind;
  won: boolean;
  chance: number;
  power: number;
  enemy: number;
  /** Share of the enemy cleared, when lost. */
  cleared: number;
  hpLost: number;
  gold: { base: number; streak: number; interest: number; drops: number };
  xp: number;
  opponent: string;
  enemies: string[];
  item?: string;
  /** Crystal Ores this fight dropped. */
  ores?: string[];
  timeline?: Timeline;
  /** Woof Woof Dan turned a loss into a Perfect Clear. */
  saved?: boolean;
  trotter?: boolean;
  express?: { collisions: number; bonus: number };
  elation?: { instants: number; ahaSpd: number; punchlineStart: number; punchlinePeak: number; luckyStrikes: number; participants: string[]; share: number; hiddenMmr?: number };
}

export interface RunState {
  seed: string;
  tick: number;
  rank: string;
  plane: number;
  node: number;
  phase: Phase;
  hp: number;
  gold: number;
  level: number;
  xp: number;
  streak: number;
  interestCap: number;
  xpCost: number;
  xpPerNode: number;
  freeRefreshes: number;
  forcedRarity: StrategyRarity | null;
  planeGold: number[] | null;
  twoStarShop: boolean;
  extraDifficulty: number;
  shop: (ShopSlot | null)[];
  /** Lock: keep this stock through the next node's refresh (then it releases). */
  locked: boolean;
  /** What happened to the store at the start of this node. */
  shopNote?: "refreshed" | "kept";
  on: (Unit | null)[];
  off: (Unit | null)[];
  bench: (Unit | null)[];
  bag: string[];
  environment: CwNamed | null;
  strategies: CwStrategy[];
  opponents: string[];
  /** The rule each variant bond (e.g. Phantasmoon Games) uses this run. */
  variants?: Record<string, string>;
  nodeOpponent: string;
  offers: { environments?: CwNamed[]; strategies?: CwStrategy[]; strategyMeta?: OfferMeta; supply?: SupplyOffer[]; teaBreak?: { kind: "teaBreak" | "treasury"; options: TeaOption[] } };
  encounter: "easy" | "hard" | null;
  last: BattleReport | null;
  note: string | null;
  log: string[];
  stats: { goldEarned: number; interest: number; refreshes: number; xpBought: number; wins: number; losses: number; bestStreak: number; oresOpened?: number };
  /** Ores promised for the next Reward node ("Prismatic Ore" strategies). */
  pendingOres?: string[];
  /** Chance per defeated enemy to get an ore ("Bursting Ore", "Cracked Quartz"). */
  oreOnKill?: number;
  /** "Gold Miner": opening an ore may give one a tier lower. */
  oreEcho?: boolean;
  /** "Labor Dispatch Contract": Bond of the character you get at each Boss Node. */
  dispatchBond?: string | null;
  /** Character names by cost (for grants made inside level-ups). */
  rosterByCost?: Record<number, string[]>;
  /** Grants that happen later or repeatedly ("after 3 Nodes…", "after each combat…", "at the start of the Second Plane…"). */
  triggers?: Trigger[];
  /** "I Want It ALL": fewer Supply options, and how many Supply phases still give every unselected character. */
  supplyFewer?: number;
  supplyAll?: number;
  nextUid: number;
  result: "cleared" | "defeated" | null;
  /** 4.7: Trailblaze Power and the Trailblaze Store. */
  tsr?: TsrState;
  /** 4.7: this run's Voyage Companion. */
  escapade?: EscapadeState;
  /** 4.7: protagonists and Plot Armor. */
  plotArmor?: PlotArmorState;
  /** Node order when a companion moved nodes (else RULES.planes). */
  layout?: NodeKind[][];
  interlude?: Interlude;
  /** Investment Strategy grade rules from Environments/Strategies (one place, see strategyGrades.ts). */
  grades?: GradeRules;
  /** Extra Strategy selections waiting for a node (Futures, Gold Investment, Joint Decision…). */
  pendingSelections?: PendingSelection[];
  /** Strategy refreshes banked for the next selection ("After 3 Nodes, gains another refresh"). */
  bankedStrategyRefreshes?: { at: number; n: number }[];
  /** Fixed Strategy Node selections offered so far (Jackpot = 1st, Last Chance = 3rd). */
  nodeSelections?: number;
  /** Gold per owned Strategy when obtaining one (Strategy Master). */
  goldPerStrategy?: number;
  /** Aha (Elation Bond): THEIR equipment (3 random basic pieces on arrival; synthesized into advanced). */
  aha?: { items: string[] };
  /** Advantage Layout nodes unlocked when this run started (advantage.ts). */
  advantage?: string[];
  /** One-time Advantage effects used (Claims Settlement, Safety Mechanism, Total Refresh of the Environment). */
  advantageUsed?: string[];
}

// --------------------------------------------------------------------------------------------- helpers

const pickOne = <T,>(rng: () => number, list: readonly T[]): T => list[Math.floor(rng() * list.length)];
const weighted = (rng: () => number, w: readonly number[]) => { let r = rng() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { if (r < w[i]) return i; r -= w[i]; } return w.length - 1; };
const sample = <T,>(rng: () => number, list: readonly T[], n: number): T[] => {
  const pool = [...list]; const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
};

/** A fresh RNG for the next action (the tick makes every action replayable). */
export function step(s: RunState): [RunState, () => number] {
  const next = { ...s, tick: s.tick + 1, note: null };
  return [next, createRng(`${s.seed}:${s.tick}`)];
}

export const log = (s: RunState, line: string): RunState => ({ ...s, log: [...s.log, line] });
export const note = (s: RunState, text: string): RunState => ({ ...s, note: text });

export const nodeKinds = (plane: number, s?: Pick<RunState, "layout">) => s?.layout?.[plane] ?? RULES.planes[plane] ?? [];
export const totalNodes = RULES.planes.reduce((n, p) => n + p.length, 0);
export const globalIndex = (plane: number, node: number) => RULES.planes.slice(0, plane).reduce((n, p) => n + p.length, 0) + node;
const rankNumber = (rank: string) => Number(/^A(\d+)/.exec(rank)?.[1] ?? 0);

/** The node kind actually played (Encounters below Jade Steel are plain fights). */
export function nodeKind(s: Pick<RunState, "plane" | "node" | "rank" | "layout">): NodeKind {
  const k = nodeKinds(s.plane, s)[s.node] ?? "Combat";
  return k === "Encounter" && rankNumber(s.rank) < RULES.encounterFromRank ? "Combat" : k;
}

export const units = (s: RunState) => [...s.on, ...s.off, ...s.bench].filter((u): u is Unit => !!u);
export const deployed = (s: RunState) => [...s.on, ...s.off].filter((u): u is Unit => !!u);
/** Owning a Wealth Gem raises the team size limit by 1, equipped or not (wiki). */
export const wealthGems = (s: RunState) => [...s.bag, ...units(s).flatMap((u) => u.items)].filter((i) => i === "Wealth Gem").length;
export const teamSize = (s: RunState) => ASSUMED.teamSize(s.level) + wealthGems(s);
export const xpToNext = (level: number) => ASSUMED.levelXp[level] ?? 0;
export const lineupValue = (s: RunState) => deployed(s).reduce((n, u) => n + u.cost * copiesFor(u.stars), 0);
const shopRoster = (pack: CwPack) => pack.characters.filter((c) => c.cost <= 5);
const costOf = (pack: CwPack, name: string) => pack.characters.find((c) => c.name === name)?.cost ?? 1;

export function makeUnit(s: RunState, name: string, cost: number, stars: 1 | 2 | 3 = 1, items: string[] = []): [RunState, Unit] {
  return [{ ...s, nextUid: s.nextUid + 1 }, { uid: s.nextUid, name, cost, stars, items }];
}

/** Put a unit in the first free bench slot (then merge). Fails when the bench is full and nothing merges. */
export function gain(s: RunState, unit: Unit): RunState | null {
  const free = s.bench.findIndex((x) => !x);
  if (free < 0) {
    const same = units(s).filter((u) => u.name === unit.name && u.stars === unit.stars).length;
    if (same < 2 || unit.stars === 3) return null;
    // Merges straight away, so it needs no bench space.
    return merge({ ...s, bench: [...s.bench, unit] }, true);
  }
  const bench = [...s.bench]; bench[free] = unit;
  return merge({ ...s, bench });
}

/** Three copies of the same star merge into the next star (kept where the first copy sits). */
export function merge(s: RunState, trimBench = false): RunState {
  let state = s;
  for (let guard = 0; guard < 20; guard++) {
    const all: { u: Unit; spot: Spot }[] = [];
    (["on", "off", "bench"] as Zone[]).forEach((zone) => state[zone].forEach((u, index) => { if (u) all.push({ u, spot: { zone, index } }); }));
    const group = all.find((a) => a.u.stars < 3 && !a.u.npc && all.filter((b) => !b.u.npc && b.u.name === a.u.name && b.u.stars === a.u.stars).length >= 3);
    if (!group) break;
    const trio = all.filter((b) => !b.u.npc && b.u.name === group.u.name && b.u.stars === group.u.stars).slice(0, 3);
    const items = trio.flatMap((t) => t.u.items);
    const kept: Unit = { ...trio[0].u, stars: (trio[0].u.stars + 1) as 2 | 3, items: items.slice(0, RULES.itemsPerUnit) };
    const next = { ...state, on: [...state.on], off: [...state.off], bench: [...state.bench], bag: [...state.bag, ...items.slice(RULES.itemsPerUnit)] };
    for (const t of trio.slice(1)) next[t.spot.zone][t.spot.index] = null;
    next[trio[0].spot.zone][trio[0].spot.index] = kept;
    state = remapHolders(next, trio.slice(1).map((t) => t.u.uid), kept.uid);
    state = log(state, `${"★".repeat(kept.stars)} ${kept.name}: three copies merged.`);
  }
  if (trimBench && state.bench.length > RULES.benchSlots) {
    const bench = state.bench.filter((u, i) => u || i < RULES.benchSlots).slice(0, RULES.benchSlots);
    while (bench.length < RULES.benchSlots) bench.push(null);
    state = { ...state, bench };
  }
  return state;
}

export function levelUp(s: RunState, xp: number): RunState {
  let { level, xp: cur } = s;
  cur += xp;
  while (level < ASSUMED.maxLevel && cur >= xpToNext(level)) { cur -= xpToNext(level); level++; }
  if (level >= ASSUMED.maxLevel) cur = 0;
  let out = { ...s, level, xp: cur };
  if (level > s.level) {
    out = log(out, `Level ${level}: you can deploy ${ASSUMED.teamSize(level)}.`);
    for (const t of out.triggers ?? []) {
      const m = /^__climb:(\d+)$/.exec(t.text);
      if (t.on !== "levelup" || !m) continue;
      for (let lv = s.level + 1; lv <= level; lv++) out = climbGrant(out, lv, Number(m[1]), t.source);
    }
  }
  return out;
}

/** "Climbing the Ranks": a 2-star character costing (level − 4, at least 1) and some gold. Needs the roster, kept on the state at run start. */
function climbGrant(s: RunState, level: number, gold: number, source: string): RunState {
  const cost = Math.max(1, level - 4);
  const pool = (s.rosterByCost?.[cost] ?? []);
  if (!pool.length) return log({ ...s, gold: s.gold + gold }, `${source}: +${gold} gold.`);
  const name = pool[Math.floor(createRng(`${s.seed}:climb:${level}`)() * pool.length)];
  const [s2, u] = makeUnit({ ...s, gold: s.gold + gold }, name, cost, 2);
  const got = gain(s2, u);
  return log(got ?? s2, `${source}: ${got ? `★★ ${name}` : `${name} (bench full)`}, +${gold} gold.`);
}

function rollShopSlots(s: RunState, pack: CwPack, rng: () => number): ShopSlot[] {
  const owned3 = new Set(units(s).filter((u) => u.stars === 3).map((u) => u.name));
  return rollShop(pack.odds, s.level, shopRoster(pack), rng, RULES.shopSlots, owned3)
    .map((c) => ({ name: c.name, cost: c.cost, stars: s.twoStarShop && rng() < ASSUMED.twoStarShop ? 2 : 1 }));
}

const basicNames = (pack: CwPack) => pack.equipment?.basic.map((b) => b.name) ?? [];
const randomBasic = (pack: CwPack, rng: () => number) => { const b = basicNames(pack); return b.length ? pickOne(rng, b) : null; };
const randomEmblem = (pack: CwPack, rng: () => number) => { const e = pack.equipment?.emblems ?? []; return e.length ? pickOne(rng, e).name : null; };
export const randomBasicName = randomBasic;
export const randomEmblemName = randomEmblem;
export const randomAdvancedName = (pack: CwPack, rng: () => number) => { const a = pack.equipment?.advanced ?? []; return a.length ? pickOne(rng, a).name : null; };
export const shopRosterOf = (pack: CwPack) => shopRoster(pack);
const randomOre = (plane: number, rng: () => number) => oreName(ORE_TIERS[weighted(rng, ORE_DROP_ODDS[Math.min(2, plane)])]);
/** Items that combine with each other (basic equipment and gems); finished items don't. */
const isComponent = (pack: CwPack, name: string) => { const k = itemKind(pack, name); return k === "basic" || (k === "gem" && name !== "Wealth Gem"); };

/** The advanced item two basic items make, if any. */
export function recipe(pack: CwPack, a: string, b: string): CwAdvancedItem | undefined {
  return pack.equipment?.advanced.find((x) => (x.recipe[0] === a && x.recipe[1] === b) || (x.recipe[0] === b && x.recipe[1] === a));
}
export const isBasic = (pack: CwPack, name: string) => basicNames(pack).includes(name);

// --------------------------------------------------------------------------------------------- effects

const CONDITIONAL = /^(when|after|each|every|if|upon|whenever|in |during|at the start of (each|every)|the first|for each)/i;

/**
 * Apply the parts of an Environment/Strategy text the simulator understands; returns what it applied.
 * Anything else is listed as "not simulated".
 */
const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const toNum = (x: string | undefined) => (x === undefined ? 1 : NUM[x.toLowerCase()] ?? (Number(x) || 1));
/** Items the simulator doesn't model (named in the log instead of silently ignored). */
const UNMODELLED = /Chimera|Smelting Furnace|Disassembly Wrench|Good Fortune Token|Special Privilege Card|Surprise Box|Dice|Trash Bag|Owlbert|massive reward/i;

/**
 * Apply the parts of an Environment/Strategy text the simulator understands; returns what it applied.
 * `source` is the Environment/Strategy name (an "X Emblem" strategy whose item the wiki lists as
 * "Unknown" grants the X Emblem). Parts it can't model are listed as "not simulated: …".
 */
export function applyEffect(s: RunState, pack: CwPack, text0: string, rng: () => number, source = ""): [RunState, string[]] {
  // Plot Armor and Strategy-grade investments first; their sentences are then left out of the general parser.
  const [plotState, plotApplied, handled] = plotInvestment(s, text0, source);
  const [gradeState, gradeApplied, gradeHandled] = strategyInvestment(plotState, pack, text0, source, rng);
  const text = [...handled, ...gradeHandled].reduce((t, h) => t.replace(h, ""), text0).trim();
  let state = gradeState;
  const applied: string[] = [...plotApplied, ...gradeApplied];
  const skipped: string[] = [];
  let lastEmblem: string | null = null;
  const roster = shopRoster(pack);
  const eq = pack.equipment;
  const isItem = (n: string) => !!specialItem(n) || !!(eq?.basic.some((x) => x.name === n) || eq?.advanced.some((x) => x.name === n) || eq?.emblems?.some((x) => x.name === n) || eq?.gems?.some((x) => x.name === n));
  const addItem = (n: string) => { state = { ...state, bag: [...state.bag, n] }; if (emblemBond(pack, n)) lastEmblem = n; };
  const addUnit = (name: string, cost: number, stars: 1 | 2 | 3, items: string[] = [], npc = false) => {
    const [s2, u] = makeUnit(state, name, cost, stars, items);
    const after = gain(s2, npc ? { ...u, npc: true } : u);
    if (after) { state = after; applied.push(`${npc ? "" : "★".repeat(stars) + " "}${name}${items.length ? ` with ${items.join(", ")}` : ""}`); }
    else { state = { ...s2, bag: [...s2.bag, ...items] }; skipped.push(`${name} (bench full)`); }
  };
  const randomUnits = (n: number, cost: number, stars: 1 | 2 | 3) => {
    const pool = roster.filter((c) => c.cost === cost);
    for (let i = 0; i < n && pool.length; i++) { const c = pickOne(rng, pool); addUnit(c.name, c.cost, stars); }
  };
  const randomAdvanced = () => { const a = eq?.advanced ?? []; return a.length ? pickOne(rng, a).name : null; };
  const emblems = (n: number) => Array.from({ length: n }, () => randomEmblem(pack, rng)).filter((x): x is string => !!x);
  const sourceEmblem = /^(.+? Emblem)(?: Set)?$/.exec(source.trim())?.[1];
  let unknownUsed = false;
  const sample = <T,>(r: () => number, list: readonly T[], k: number): T[] => { const pool = [...list]; const out: T[] = []; while (out.length < k && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); return out; };

  /** One granted thing, e.g. '1 "Sparxie"', '2 piece(s) of random basic equipment', '8 Gold Coin(s)'. */
  const grantPart = (raw: string) => {
    const part = raw.trim().replace(/^(?:and|also)\s+/i, "").replace(/[.!]$/, "");
    if (!part) return;
    const m = /^(\d+|an?|one|two|three|four|five|six)\s+(.*)$/i.exec(part);
    const n = toNum(m?.[1]);
    let desc = (m ? m[2] : part).replace(/^(?:piece\(s\)|pieces?) of /i, "").trim();
    const starM = /^(\d)-star\s+(.*)$/i.exec(desc);
    const stars = (starM ? Math.min(3, Number(starM[1])) : 1) as 1 | 2 | 3;
    if (starM) desc = starM[2];
    let g: RegExpExecArray | null;
    if (/^Gold Coins?(\(s\))?$/i.test(desc)) { state = { ...state, gold: state.gold + n }; applied.push(`+${n} gold`); return; }
    if (/^(Experience|EXP)$/i.test(desc)) { state = levelUp(state, n); applied.push(`+${n} XP`); return; }
    if (/^free (?:Store )?refresh/i.test(desc)) { state = { ...state, freeRefreshes: state.freeRefreshes + n }; applied.push(`${n} free refreshes`); return; }
    if ((g = /^"([^"]+)"(.*)$/.exec(desc))) {
      const name = g[1];
      const rest = g[2];
      if (/^Trailblaze Power$/i.test(name)) { const t = tsrOf(state); state = { ...state, tsr: { ...t, tp: t.tp + n, earned: t.earned + n } }; applied.push(`+${n} Trailblaze Power`); return; }
      if (/^Unknown/i.test(name)) {
        if (sourceEmblem && !unknownUsed && eq?.emblems?.some((e) => e.name === sourceEmblem)) { unknownUsed = true; for (let i = 0; i < n; i++) addItem(sourceEmblem); applied.push(sourceEmblem); return; }
        skipped.push("an item the wiki hasn't named"); return;
      }
      // '"Beast Garden" character and basic equipment' (Index Funds): a member of that Bond, plus what follows.
      if (/^\s*character/i.test(rest) && membersOf(pack, name).length) {
        const pool = roster.filter((c) => membersOf(pack, name).includes(c.name));
        for (let i = 0; i < n && pool.length; i++) { const c = pickOne(rng, pool); addUnit(c.name, c.cost, stars); }
        const more = /^\s*characters?\s+and\s+(.+)$/i.exec(rest);
        if (more) grantPart(more[1]);
        return;
      }
      if (name === "Emblem Codex") { for (const e of emblems(n)) { addItem(e); applied.push(`${e} (Emblem Codex: you'd pick one; random here)`); } return; }
      if (name === "Peppy") { for (let i = 0; i < n; i++) addUnit("Peppy", 0, 1, emblems(toNum(/(\d+|three|two|one)\s+(?:permanently attached |random )?Emblems?/i.exec(rest)?.[1] ?? "0") || 0), true); return; }
      // Short names the wiki uses in some texts: "Topaz" → "Topaz & Numby", "SAM" (Firefly's armour) → "Firefly".
      const alias: Record<string, string> = { SAM: "Firefly" };
      const ch = roster.find((c) => c.name === name) ?? pack.characters.find((c) => c.name === name)
        ?? roster.find((c) => c.name === alias[name]) ?? roster.find((c) => c.name.startsWith(`${name} `));
      if (ch) { for (let i = 0; i < n; i++) addUnit(ch.name, ch.cost, stars); return; }
      if (isItem(name)) { for (let i = 0; i < n; i++) addItem(name); applied.push(n > 1 ? `${n} × ${name}` : name); return; }
      if (/^Basic Weapon Box$/i.test(name)) { for (let i = 0; i < n; i++) { const b = randomBasic(pack, rng); if (b) addItem(b); } applied.push(`${n} basic equipment`); return; }
      if (/Weapon Box$/i.test(name)) { for (let i = 0; i < n; i++) { const a = randomAdvanced(); if (a) addItem(a); } applied.push(`${n} advanced equipment (${name})`); return; }
      if (oreTier(name) || oreGold(name) !== null) { for (let i = 0; i < n; i++) addItem(name); applied.push(name); return; }
      skipped.push(n > 1 ? `${n} × ${name}` : name); return;
    }
    // "2-Cost character or 1-Cost character": one of the options.
    if (/ or /i.test(desc) && desc.split(/ or /i).every((o) => /\d-cost character/i.test(o))) { grantPart(`${n} ${pickOne(rng, desc.split(/ or /i))}`); return; }
    if ((g = /^random (?:(\d)-star )?(\d)-cost (damage-dealing )?characters?/i.exec(desc)) || (g = /^(?:(\d)-star )?(\d)-cost (damage-dealing )?characters?/i.exec(desc))) {
      const st = (g[1] ? Math.min(3, Number(g[1])) : stars) as 1 | 2 | 3;
      if (g[3]) { const pool = roster.filter((c) => c.cost === Number(g![2]) && pack.info?.[c.name]?.roles.includes("DPS")); for (let i = 0; i < n && pool.length; i++) { const c = pickOne(rng, pool); addUnit(c.name, c.cost, st); } return; }
      randomUnits(n, Number(g[2]), st); return;
    }
    if ((g = /^of every (\d)-cost character/i.exec(desc))) { for (const c of roster.filter((x) => x.cost === Number(g![1]))) addUnit(c.name, c.cost, 1); return; }
    if ((g = /^random (.+?) characters?$/i.exec(desc)) && membersOf(pack, g[1]).length) {
      const pool = roster.filter((c) => membersOf(pack, g![1]).includes(c.name));
      for (let i = 0; i < n && pool.length; i++) { const c = pickOne(rng, pool); addUnit(c.name, c.cost, stars); }
      return;
    }
    if ((g = /^"([^"]+)" character/i.exec(desc)) && membersOf(pack, g[1]).length) {
      const pool = roster.filter((c) => membersOf(pack, g![1]).includes(c.name));
      for (let i = 0; i < n && pool.length; i++) { const c = pickOne(rng, pool); addUnit(c.name, c.cost, stars); }
      return;
    }
    if ((g = /^half of the members of "([^"]+)"/i.exec(desc))) {
      const pool = sample(rng, roster.filter((c) => membersOf(pack, g![1]).includes(c.name)), Math.ceil(roster.filter((c) => membersOf(pack, g![1]).includes(c.name)).length / 2));
      for (const c of pool) addUnit(c.name, c.cost, 1);
      return;
    }
    if ((g = /^the other half of the members of "([^"]+)"/i.exec(desc))) {
      const owned = new Set(units(state).map((u) => u.name));
      for (const c of roster.filter((x) => membersOf(pack, g![1]).includes(x.name) && !owned.has(x.name))) addUnit(c.name, c.cost, 1);
      return;
    }
    if (/^duplicate of an Emblem you already own/i.test(desc)) {
      const mine = [...state.bag, ...units(state).flatMap((u) => u.items)].filter((x) => emblemBond(pack, x));
      if (mine.length) { const e = pickOne(rng, mine); addItem(e); applied.push(`a copy of ${e}`); } else skipped.push("an Emblem copy (you own none)");
      const xp = /receive (\d+) EXP/i.exec(text);
      if (xp) { state = levelUp(state, Number(xp[1])); applied.push(`+${xp[1]} XP`); }
      return;
    }
    if (/^"?Emblem Codex"?/i.test(desc)) { for (const e of emblems(n)) { addItem(e); applied.push(`${e} (Emblem Codex: you'd pick one; random here)`); } return; }
    if (/^(?:random )?privileged equipment/i.test(desc)) { for (let i = 0; i < n; i++) { const a = randomAdvanced(); if (a) addItem(a); } applied.push(`${n} advanced equipment (privileged versions aren't modelled)`); return; }
    if (/^(?:random )?basic weapons?(\(s\))?$/i.test(desc) || /^Random Basic Weapon/i.test(desc)) { for (let i = 0; i < n; i++) { const b = randomBasic(pack, rng); if (b) addItem(b); } applied.push(`${n} basic equipment`); return; }
    if (/^Privilege Weapon Box/i.test(desc)) { for (let i = 0; i < n; i++) { const a = randomAdvanced(); if (a) addItem(a); } applied.push(`${n} advanced equipment (Privilege Weapon Box)`); return; }
    if ((g = /Employment Contract: Cost (\d)|(\d)-Cost Employment Contract/i.exec(desc))) { randomUnits(n, Number(g[1] ?? g[2]), 1); applied.push(`(Employment Contract used as a random ${g[1] ?? g[2]}-cost character)`); return; }
    if (/^random Emblems?/i.test(desc)) { for (const e of emblems(n)) { addItem(e); applied.push(e); } return; }
    if (/^of each type of basic equipment/i.test(desc)) { for (const b of eq?.basic ?? []) for (let i = 0; i < n; i++) addItem(b.name); applied.push(`${n} of each basic equipment`); return; }
    if (/^(?:random |initial )?basic equipment/i.test(desc) || /^Basic Weapon Box/i.test(desc)) { for (let i = 0; i < n; i++) { const b = randomBasic(pack, rng); if (b) addItem(b); } applied.push(`${n} basic equipment`); return; }
    if (/^(?:random )?advanced equipment(?!.*recommended)/i.test(desc)) { for (let i = 0; i < n; i++) { const a = randomAdvanced(); if (a) addItem(a); } applied.push(`${n} advanced equipment`); return; }
    if ((g = /^(White|Blue|Gold|Prismatic) Crystal Ore/i.exec(desc))) { for (let i = 0; i < n; i++) addItem(oreName(g[1] as OreTier)); applied.push(oreName(g[1] as OreTier)); return; }
    if (/^(?:cute )?Peppy\b/i.test(desc)) { for (let i = 0; i < n; i++) addUnit("Peppy", 0, 1, emblems(toNum(/(\d+|three|two|one)\s+(?:random )?Emblems?/i.exec(desc)?.[1] ?? "0") || 0), true); return; }
    if (/^Peppi that looks exactly like your Peppy/i.test(desc)) {
      const peppy = units(state).find((u) => u.npc && u.name === "Peppy");
      if (peppy) addUnit("Peppi", 0, 1, [...peppy.items], true); else skipped.push("Peppi (you have no Peppy)");
      return;
    }
    if (/Express deals/i.test(desc)) return;
    if (UNMODELLED.test(desc) || desc.length < 60) skipped.push(desc.replace(/^"|"$/g, ""));
  };

  // Ores and other effects with their own wording.
  const ore = /crystal ore worth (\d+)\/(\d+)\/(\d+) Gold Coin/i.exec(text);
  if (ore) {
    const planeGold = [Number(ore[1]), Number(ore[2]), Number(ore[3])];
    state = { ...state, planeGold };
    applied.push(`a crystal ore worth ${planeGold.join("/")} gold at the start of each plane`);
  }
  const extraOre = /extra (White|Blue|Gold|Prismatic) Crystal Ore .*?next Reward Node/i.exec(text);
  if (extraOre) { state = { ...state, pendingOres: [...(state.pendingOres ?? []), oreName(extraOre[1] as OreTier)] }; applied.push(`a ${extraOre[1]} Crystal Ore at the next Reward node`); }
  const onKill = /defeats an enemy target, there's a (\d+)% chance to obtain a crystal ore/i.exec(text);
  if (onKill) { state = { ...state, oreOnKill: Math.max(state.oreOnKill ?? 0, Number(onKill[1]) / 100) }; applied.push(`${onKill[1]}% ore chance per enemy defeated`); }
  if (/When opening a crystal ore, there is a 50% chance to obtain a crystal ore of one tier lower/i.test(text)) { state = { ...state, oreEcho: true }; applied.push("opening ores may give another"); }
  const xpNode = /Gain (\d+) Experience whenever you enter a new Node/i.exec(text);
  if (xpNode) { state = { ...state, xpPerNode: state.xpPerNode + Number(xpNode[1]) }; applied.push(`+${xpNode[1]} XP each node`); }
  const express = /the Express deals (\d+)% of the original DMG/i.exec(text);
  if (express) { const t = tsrOf(state); state = { ...state, tsr: { ...t, expressMult: Math.max(t.expressMult ?? 1, Number(express[1]) / 100) } }; applied.push(`the Express deals ${express[1]}% DMG`); }
  if (/2-star characters may appear in the Store/i.test(text)) { state = { ...state, twoStarShop: true }; applied.push("2-star characters in the shop"); }

  // Later or repeated grants become triggers; their sentences are not granted now.
  const consumed = new Set<string>();
  const schedule = (t: Trigger, sentence: string, label: string) => { state = { ...state, triggers: [...(state.triggers ?? []), t] }; consumed.add(sentence); applied.push(label); };
  const planeNames: Record<string, number> = { first: 0, second: 1, third: 2 };
  const sentences = text.replace(/"([^"]*?)([,.])"/g, '"$1"$2').replace(/\s+when the round starts/gi, "").split(/(?<=[.!])\s+/).map((x) => x.trim());
  const halfBond = /half of the members of "([^"]+)"/i.exec(text)?.[1];
  sentences.forEach((sen, idx) => {
    let m: RegExpExecArray | null;
    if ((m = /^After (?:entering )?(\d+) (?:new )?Nodes?(?:\(s\))?,\s*(.+)$/i.exec(sen))) {
      const what = halfBond ? m[2].replace(/the other half of the members/i, `the other half of the members of "${halfBond}"`) : m[2];
      schedule({ on: "node", after: Number(m[1]), text: what, source }, sen, `after ${m[1]} nodes: ${what.replace(/[.]$/, "")}`);
    } else if ((m = /^After that,\s*(.+)$/i.exec(sen)) && (m[0], /For the next (\d+) Node/i.exec(sentences[idx - 1] ?? ""))) {
      const n = Number(/For the next (\d+) Node/i.exec(sentences[idx - 1] ?? "")?.[1] ?? 0);
      if (n) schedule({ on: "node", after: n, text: m[1], source }, sen, `after ${n} nodes: ${m[1].replace(/[.]$/, "")}`);
    } else if ((m = /^After the next Boss Node,\s*(.+)$/i.exec(sen)) || (m = /^After clearing the next Boss Node,\s*(.+)$/i.exec(sen))) {
      const what = /Gold Coins equal to the value of all characters on the field/i.test(m[1]) ? "__lineupGold" : m[1];
      schedule({ on: "boss", text: what, source }, sen, `after the next Boss: ${m[1].replace(/[.]$/, "")}`);
    } else if ((m = /^(.+?)\s+at the start of the (First|Second|Third) Plane\.?$/i.exec(sen))) {
      schedule({ on: "plane", plane: planeNames[m[2].toLowerCase()], text: m[1], source }, sen, `at the start of the ${m[2]} Plane: ${m[1].replace(/^(Gains?|Obtains?)\s+/i, "")}`);
    } else if ((m = /^At the start of the First, Second, and Third Planes, respectively, gain (\d+), (\d+), and (\d+) (.+?)\.?$/i.exec(sen))) {
      [m[1], m[2], m[3]].forEach((n, pl) => { state = { ...state, triggers: [...(state.triggers ?? []), { on: "plane", plane: pl, text: `Gain ${n} ${m![4]}`, source }] }; });
      consumed.add(sen); applied.push(`${m[1]}/${m[2]}/${m[3]} ${m[4]} at the start of each plane`);
    } else if ((m = /^(?:Now|Immediately) and at the start of each plane,\s*(.+)$/i.exec(sen))) {
      state = { ...state, triggers: [...(state.triggers ?? []), { on: "plane", repeat: true, text: m[1], source }] };
      applied.push("again at the start of each plane");
    } else if ((m = /^After each combat ends,\s*(.+)$/i.exec(sen))) {
      schedule({ on: "combat", repeat: true, text: m[1], source }, sen, `after each combat: ${m[1].replace(/[.]$/, "")}`);
    } else if ((m = /^After battling in Encounter Node,\s*(.+)$/i.exec(sen))) {
      schedule({ on: "encounter", repeat: true, text: m[1], source }, sen, `after each Encounter: ${m[1].replace(/[.]$/, "")}`);
    } else if (/^Every time after entering a supply phase, randomly obtain an unselected character and their carried equipment/i.test(sen)) {
      schedule({ on: "supply", repeat: true, text: "__scout", source }, sen, "a second Supply pick each Supply node");
    } else if ((m = /^Gain (\d+) free refresh every time you enter a new Node/i.exec(sen))) {
      schedule({ on: "node", repeat: true, text: `Gain ${m[1]} free refresh`, source }, sen, `${m[1]} free refresh each node`);
    } else if (/^When entering a new Node, gain Experience equal to the base cost of the leftmost character in your preparation area/i.test(sen)) {
      schedule({ on: "node", repeat: true, text: "__passiveIncome", source }, sen, "XP each node = cost of your leftmost bench character");
    } else if ((m = /^Get a 2-star character and (\d+) Gold Coin\(s\) each time you level up/i.exec(sen))) {
      schedule({ on: "levelup", repeat: true, text: `__climb:${m[1]}`, source }, sen, "a 2-star character and gold each level up");
    } else if ((m = /^After the Store refreshes (\d+) time\(s\),\s*(.+)$/i.exec(sen))) {
      schedule({ on: "refresh", after: Number(m[1]), text: m[2], source }, sen, `after ${m[1]} refreshes: ${m[2].replace(/[.]$/, "")}`);
    } else if ((m = /^Obtains? an? (\d)-star (\d)-cost character that can be deployed after (\d+) Node/i.exec(sen))) {
      schedule({ on: "node", after: Number(m[3]), text: `Obtains a ${m[1]}-star ${m[2]}-cost character.`, source }, sen, `a ${m[1]}-star ${m[2]}-cost character after ${m[3]} nodes`);
    } else if ((m = /you have (\d+) fewer option\(s\) during the Supply phase/i.exec(sen))) {
      const next = /After making your selection in the next (\d+) Supply phase/i.exec(text);
      state = { ...state, supplyFewer: Number(m[1]), supplyAll: next ? Number(next[1]) : 99 };
      consumed.add(sen); applied.push(`${m[1]} fewer Supply options, but you get every unselected one${next ? ` (next ${next[1]} Supply nodes)` : ""}`);
    } else if (/^After making your selection in (?:the next \d+ )?(?:the )?Supply phase/i.test(sen)) {
      consumed.add(sen);
    } else if ((m = /^For every (\d+) Gold Coins lost, gains a random (\d)-cost character, up to (\d+) Gold Coin/i.exec(sen))) {
      // Hiring Spree: spend gold in steps, one character per step.
      const step = Number(m[1]), spend = Math.min(Number(m[3]), state.gold - (state.gold % step));
      const n = Math.floor(spend / step);
      state = { ...state, gold: state.gold - spend };
      consumed.add(sen);
      applied.push(`−${spend} gold → ${n} random ${m[2]}-cost character${n === 1 ? "" : "s"}`);
      const pool = shopRoster(pack).filter((c) => c.cost === Number(m![2]));
      for (let i = 0; i < n && pool.length; i++) { const c = pickOne(rng, pool); addUnit(c.name, c.cost, 1); }
    } else if (/^Loses Gold Coins\.?$/i.test(sen)) {
      consumed.add(sen);
    } else if ((m = /^Loses (\d+) Squad HP/i.exec(sen))) {
      state = { ...state, hp: Math.max(1, state.hp - Number(m[1])) }; applied.push(`−${m[1]} squad HP`);
    }
  });

  // Grants: every "obtain / gain / get / receive / start with …" clause in a sentence that isn't conditional.
  // Commas inside quotes ('"Unknown," 1 "Sparxie,"') move outside so lists split cleanly.
  for (const sen of sentences) {
    if (consumed.has(sen) || CONDITIONAL.test(sen)) continue;
    const cap = /interest cap increases to (\d+)|maximum Interest is increased to (\d+)/i.exec(sen);
    if (cap) { const v = Number(cap[1] ?? cap[2]); state = { ...state, interestCap: v }; applied.push(`interest cap ${v}`); }
    if (/You no longer gain Interest/i.test(sen)) { state = { ...state, interestCap: 0 }; applied.push("no interest"); }
    const cheaper = /Reduce Experience cost by (\d+)/i.exec(sen);
    if (cheaper) { state = { ...state, xpCost: Math.max(1, state.xpCost - Number(cheaper[1])) }; applied.push(`XP costs ${state.xpCost}`); }
    if (ore || extraOre || onKill) continue;
    const verb = /(^|[\s,(])((?:immediately |instantly )?(?:obtains?|gains?|gets?|receives?|starts? with|you got))\s+/gi;
    const hits = [...sen.matchAll(verb)];
    hits.forEach((h, k) => {
      const before = sen.slice(Math.max(0, (h.index ?? 0) - 12), h.index ?? 0);
      // "a chance to obtain", "is able to gain" are possibilities, not grants.
      if (/\bto\s*$/i.test(before + h[1])) return;
      const startAt = (h.index ?? 0) + h[0].length;
      const end = k + 1 < hits.length ? hits[k + 1].index ?? sen.length : sen.length;
      let chunk = sen.slice(startAt, end).replace(/[,\s]+(?:and)?\s*$/i, "");
      // Future or conditional grants stay text ("at the next Reward Node", "each time …").
      if (/\b(next|each|every|when|after|whenever|per|if|for each|at the start of)\b/i.test(chunk.replace(/\bof (?:every|each)\b/gi, "")) && !/^(\d+|an?)\s+"?Peppy/i.test(chunk)) return;
      chunk = chunk.replace(/\s+(?:instead|in total|immediately)$/i, "");
      for (const piece of chunk.split(/,\s*(?:and\s+)?|\s+and\s+(?=(?:\d+|an?|one|two|three)\s|")/i)) grantPart(piece);
    });
  }

  if (/Each time you enter a Boss Node, receive a random character with the corresponding Bond/i.test(text) && lastEmblem) {
    const bond = emblemBond(pack, lastEmblem);
    if (bond) { state = { ...state, dispatchBond: bond }; applied.push(`a ${bond} character at each Boss node`); }
  }
  if (skipped.length) applied.push(`not simulated: ${[...new Set(skipped)].join(", ")}`);
  return [state, applied];
}

/** Run the triggers of one kind. One-shot countdowns tick first; repeating ones stay. */
export function fireTriggers(s0: RunState, pack: CwPack, on: Trigger["on"], rng: () => number): RunState {
  const keep: Trigger[] = [];
  const fire: Trigger[] = [];
  for (const t of s0.triggers ?? []) {
    if (t.on !== on) { keep.push(t); continue; }
    if (on === "plane" && t.plane !== undefined && t.plane !== s0.plane) { keep.push(t); continue; }
    // "Now and at the start of each plane": the "now" part was granted on the spot.
    if (on === "plane" && t.repeat && t.plane === undefined && s0.plane === 0) { keep.push(t); continue; }
    if (!t.repeat && t.after !== undefined && t.after > 1) { keep.push({ ...t, after: t.after - 1 }); continue; }
    if (t.repeat) keep.push(t);
    fire.push(t);
  }
  let s: RunState = { ...s0, triggers: keep };
  for (const t of fire) s = runTriggerText(s, pack, t, rng);
  return s;
}

function runTriggerText(s: RunState, pack: CwPack, t: Trigger, rng: () => number): RunState {
  if (t.text === "__lineupGold") { const g = lineupValue(s); return log({ ...s, gold: s.gold + g }, `${t.source}: +${g} gold (lineup value).`); }
  if (t.text === "__passiveIncome") {
    const left = s.bench.find((u) => u && !u.npc);
    return left ? log(levelUp(s, left.cost), `${t.source}: +${left.cost} XP.`) : s;
  }
  if (t.text === "__scout") return s; // handled in pickSupply
  const [s2, applied] = applyEffect(s, pack, /^(gain|obtain|get|receive)/i.test(t.text) ? t.text : `Obtains ${t.text}`, rng, t.source);
  return applied.length ? log(s2, `${t.source}: ${applied.join(", ")}.`) : s2;
}

// --------------------------------------------------------------------------------------------- run flow

export function newRun(pack: CwPack, seed: string, rank: string, opts: { companion?: string; variant?: string; advantage?: string[]; lastPlaneOne?: boolean } = {}): RunState {
  const rng = createRng(`${seed}:start`);
  let s: RunState = {
    seed, tick: 0, rank, plane: 0, node: 0, phase: "environment",
    hp: RULES.startHp, gold: ASSUMED.startGold, level: ASSUMED.startLevel, xp: 0, streak: 0,
    interestCap: RULES.interestCap, xpCost: RULES.xpCost, xpPerNode: 0, freeRefreshes: 0, forcedRarity: null, planeGold: null, twoStarShop: false, extraDifficulty: 0,
    shop: Array(RULES.shopSlots).fill(null), locked: false,
    on: Array(ASSUMED.onFieldSlots).fill(null), off: Array(ASSUMED.offFieldSlots).fill(null), bench: Array(RULES.benchSlots).fill(null),
    bag: [], environment: null, strategies: [],
    opponents: sample(rng, pack.opponents ?? [], 3).map((o) => o.name),
    variants: Object.fromEntries(Object.entries(bondVariants(pack.bonds)).map(([f, names]) => [f, pickOne(rng, names)])),
    nodeOpponent: "", offers: { environments: sample(rng, pack.environments ?? [], RULES.environmentOffers) },
    encounter: null, last: null, note: null, log: [`New run at ${rank}. Seed ${seed}.`],
    stats: { goldEarned: 0, interest: 0, refreshes: 0, xpBought: 0, wins: 0, losses: 0, bestStreak: 0 },
    nextUid: 1, result: null,
    rosterByCost: Object.fromEntries([1, 2, 3, 4, 5].map((c) => [c, pack.characters.filter((x) => x.cost === c).map((x) => x.name)])),
  };
  const roster = shopRoster(pack);
  for (let i = 0; i < RULES.startUnits; i++) {
    const cost = weighted(rng, ASSUMED.startCost) + 1;
    // Three different characters (three copies of one would merge on the spot).
    const owned = new Set(units(s).map((u) => u.name));
    const fresh = roster.filter((c) => c.cost <= 3 && !owned.has(c.name));
    const pool = fresh.filter((c) => c.cost === cost).length ? fresh.filter((c) => c.cost === cost) : fresh;
    if (!pool.length) continue;
    const c = pickOne(rng, pool);
    let u: Unit; [s, u] = makeUnit(s, c.name, c.cost);
    s = gain(s, u) ?? s;
  }
  // Start the three on the field so a first battle isn't empty.
  for (const u of [...s.bench]) if (u) s = moveUnit(s, findUnit(s, u.uid)!, autoSpot(s, pack, u) ?? findUnit(s, u.uid)!);
  // Advantage Layout: the nodes unlocked now apply to this run.
  const adv = opts.advantage ?? [];
  if (adv.length) {
    s = { ...s, advantage: [...adv] };
    if (adv.includes("strategy-refresh")) s = { ...s, grades: { ...s.grades, perOptionRefresh: true } };
    if (adv.includes("sustained-combat")) { const b = randomBasic(pack, rng); if (b) s = log({ ...s, bag: [...s.bag, b] }, `Sustained Combat: ${b}.`); }
    if (adv.includes("gold-blessing") && opts.lastPlaneOne) s = { ...s, triggers: [0, 1, 2].map((plane) => ({ on: "plane" as const, plane, text: "Gains 2 Gold Coin(s)", source: "Gold Blessing" })) };
    if (adv.includes("plot-selection")) s = { ...s, plotArmor: { ...plotOf(s), cheapBonus: 2 } };
    s = log(s, `Advantage Layout: ${adv.length} node${adv.length === 1 ? "" : "s"} active.`);
  }
  // Escapade: one random Voyage Companion per run.
  s = startEscapade(s, pack, opts.companion, opts.variant, adv.includes("luck-escapade"));
  if (!s.offers.environments?.length) s = enterNode(s, pack);
  for (const v of Object.values(s.variants ?? {})) s = log(s, `This run's rule: ${v}.`);
  return log(s, `Starting squad: ${units(s).map((u) => u.name).join(", ")}.`);
}

/** Advantage Layout "Total Refresh": reroll the Investment Environment offers once per run. */
export function rerollEnvironments(s0: RunState, pack: CwPack): RunState {
  if (s0.phase !== "environment" || !s0.advantage?.includes("total-refresh") || (s0.advantageUsed ?? []).includes("env")) return s0;
  const [s, rng] = step(s0);
  const seen = new Set((s.offers.environments ?? []).map((e) => e.name));
  const pool = (pack.environments ?? []).filter((e) => !seen.has(e.name));
  return log({ ...s, advantageUsed: [...(s.advantageUsed ?? []), "env"], offers: { environments: sample(rng, pool.length >= RULES.environmentOffers ? pool : pack.environments ?? [], RULES.environmentOffers) } }, "Total Refresh: new Investment Environments.");
}

/** Advantage Layout "Total Refresh": reroll a Supply node's options once. */
export function rerollSupply(s0: RunState, pack: CwPack): RunState {
  const key = `supply:${s0.plane}-${s0.node}`;
  if (s0.phase !== "supply" || !s0.advantage?.includes("total-refresh") || (s0.advantageUsed ?? []).includes(key)) return s0;
  const [s, rng] = step(s0);
  const fresh = nodePhase({ ...s, advantageUsed: [...(s.advantageUsed ?? []), key] }, pack, "Supply", rng);
  return log(fresh, "Total Refresh: new Supply options.");
}

export function chooseEnvironment(s0: RunState, pack: CwPack, index: number): RunState {
  const env = s0.offers.environments?.[index];
  if (s0.phase !== "environment" || !env) return s0;
  const [s1, rng] = step(s0);
  const [s2, applied] = applyEffect({ ...s1, environment: env, offers: {} }, pack, env.effect, rng, env.name);
  return enterNode(log(s2, `Investment Environment: ${env.name}${applied.length ? ` (${applied.join(", ")})` : " (effect not simulated)"}.`), pack);
}

/** Arrive at the current node: plane-start gold, passive XP, store refresh, then the node's choice. */
export function enterNode(s0: RunState, pack: CwPack): RunState {
  const [s1, rng] = step(s0);
  let s = s1;
  const kind = nodeKind(s);
  if (s.node === 0 && s.planeGold?.[s.plane]) s = log({ ...s, bag: [...s.bag, goldOreName(s.planeGold[s.plane])] }, `Got a crystal ore worth ${s.planeGold[s.plane]} gold.`);
  if (kind === "Boss" && s.dispatchBond) {
    const members = withVariants(pack.bonds, s.variants).find((b) => b.name === s.dispatchBond || b.name.startsWith(`${s.dispatchBond}: `))?.members ?? [];
    const pool = shopRoster(pack).filter((c) => members.includes(c.name));
    if (pool.length) {
      const c = pickOne(rng, pool);
      const [s2, u] = makeUnit(s, c.name, c.cost);
      const after = gain(s2, u);
      s = after ? log(after, `Labor Dispatch: ${c.name} (${s.dispatchBond}) joins.`) : log(s, `Labor Dispatch: ${c.name} couldn't join (bench full).`);
    }
  }
  if (s.xpPerNode) s = levelUp(s, s.xpPerNode);
  if (s.node === 0) s = fireTriggers(s, pack, "plane", rng);
  if (s.node === 0 && s.plane === 1 && s.advantage?.includes("reselect")) s = log({ ...s, plotArmor: { ...plotOf(s), swaps: plotOf(s).swaps + 1 } }, "Reselect Protagonist: 1 Plot Armor reselection chance.");
  if (s.node === 0 && s.plane === 1 && s.advantage?.includes("master-smith")) s = log({ ...s, bag: [...s.bag, "Smelting Furnace", "Disassembly Wrench"] }, "Master Smith: Smelting Furnace and Disassembly Wrench.");
  s = fireTriggers(s, pack, "node", rng);
  s = nodeTp(s);
  s = frenzyContract(s, pack, rng);
  s = rollDice(s, pack);
  // The store refreshes at the start of every node. Lock keeps it for the next node only (tutorial "Store"), then releases.
  if (!s.locked) s = { ...s, shop: rollShopSlots(s, pack, rng), shopNote: "refreshed" };
  else s = log({ ...s, locked: false, shopNote: "kept" }, "Store kept by Lock for this node (lock released).");
  const opp = kind === "Boss" ? s.opponents[s.plane] ?? s.opponents[0] : s.opponents.length ? pickOne(rng, s.opponents) : "";
  s = { ...s, nodeOpponent: opp ?? "", encounter: null, last: null, interlude: undefined };
  s = onEnterNode(s, pack, rng, () => highestBond(s, pack));
  return settle(withInterludes(nodePhase(s, pack, kind, rng), pack), pack);
}

/** Whatever Dice: at each node it puts two random items on its holder (for that node). */
function rollDice(s: RunState, pack: CwPack): RunState {
  if (!units(s).some((u) => u.items.includes("Whatever Dice") || u.dice)) return s;
  const rng = createRng(`${s.seed}:dice:${s.tick}`);
  const roll = (u: Unit | null): Unit | null => {
    if (!u || (!u.items.includes("Whatever Dice") && !u.dice)) return u;
    if (!u.items.includes("Whatever Dice")) { const { dice: _gone, ...rest } = u; void _gone; return rest; }
    return { ...u, dice: [randomBasic(pack, rng), randomBasic(pack, rng)].filter((x): x is string => !!x) };
  };
  const out = { ...s, on: s.on.map(roll), off: s.off.map(roll), bench: s.bench.map(roll) };
  const got = units(out).filter((u) => u.dice?.length).map((u) => `${u.name}: ${u.dice!.join(", ")}`);
  return got.length ? log(out, `Whatever Dice: ${got.join("; ")}.`) : out;
}

/** The node's own choice (Strategy, Supply, Encounter, Tea Break) or preparation. */
function nodePhase(s: RunState, pack: CwPack, kind: NodeKind, rng: () => number): RunState {
  const special = kind === "Reward" ? specialNode(s) : null;
  if (special) return enterSpecial(s, pack, special, rng);
  if (kind === "Strategy") {
    // Visionary: the node grants 1 random Prismatic Strategy (no choice, no refresh, no difficulty).
    if (gradeRulesOf(s).visionary) return { ...grantRandomStrategy(s, pack, "Prismatic", rng, gradeRulesOf(s).sources?.visionary ?? "Visionary", true), phase: "prep", offers: {} };
    const [opts, meta, s2] = strategyOffer(s, pack, rng, { kind: "node" });
    if (opts.length) return { ...s2, phase: "strategy", offers: { strategies: opts, strategyMeta: meta } };
    s = s2;
  }
  if (kind === "Supply") {
    const roster = shopRoster(pack);
    const extra = s.advantage?.includes("bonus-supply") ? 1 : 0;
    const gem = () => (s.advantage?.includes("shining-diamond") || s.advantage?.includes("diamond")) && rng() < 0.2 ? pickOne(rng, ["Red Gem", "Blue Gem"]) : null;
    const base = rollShop(pack.odds, s.level, roster, rng, Math.max(1, RULES.supplyOffers + extra - (s.supplyFewer ?? 0))).map((c) => ({ name: c.name, cost: c.cost, item: gem() ?? randomBasic(pack, rng) ?? "" }));
    const offer = supplyOffers(s, pack, base, rng);
    if (offer.length) return { ...s, phase: "supply", offers: { supply: offer } };
  }
  if (kind === "Encounter") return { ...s, phase: "encounter", offers: {} };
  return { ...s, phase: "prep", offers: {} };
}

/** Grade rules in effect (older saves kept a single forced grade). */
export function gradeRulesOf(s: Pick<RunState, "grades" | "forcedRarity">): GradeRules {
  const r = s.grades ?? {};
  return !r.fixed && s.forcedRarity ? { ...r, fixed: s.forcedRarity, sources: { ...r.sources, fixed: r.sources?.fixed ?? "Investment Environment" } } : r;
}

const rollGrade = (rng: () => number): Grade => GRADES[weighted(rng, [ASSUMED.strategyRarity.Silver, ASSUMED.strategyRarity.Gold, ASSUMED.strategyRarity.Prismatic])];

/** Draw one Strategy of a grade not owned and not already offered. */
function drawStrategy(s: RunState, pack: CwPack, grade: Grade, rng: () => number, exclude: string[]): CwStrategy | null {
  const pool = (pack.strategies ?? []).filter((x) => x.rarity === grade && x.planes.includes(s.plane + 1) && !s.strategies.some((o) => o.name === x.name) && !exclude.includes(x.name));
  const any = pool.length ? pool : (pack.strategies ?? []).filter((x) => x.rarity === grade && !s.strategies.some((o) => o.name === x.name) && !exclude.includes(x.name));
  return any.length ? pickOne(rng, any) : null;
}

/** One Strategy selection: the grades come from offerGrades (the one place that decides them). */
function strategyOffer(s0: RunState, pack: CwPack, rng: () => number, opts: { kind: "node" | "extra"; pending?: PendingSelection }): [CwStrategy[], OfferMeta, RunState] {
  let s = s0;
  const rules = gradeRulesOf(s);
  const selection = opts.kind === "node" ? (s.nodeSelections ?? 0) + 1 : 0;
  // Bubble Wolf's hack: this offer becomes Prismatic.
  let forced = opts.pending?.grade;
  if (!forced && s.escapade?.nextPrismatic) { forced = "Prismatic"; s = { ...s, escapade: { ...s.escapade, nextPrismatic: false, history: [...s.escapade.history, { tick: s.tick, text: "modified this Investment Strategy offer to Prismatic." }] } }; }
  const { grades, why, usedShift } = offerGrades(rules, { rolled: rollGrade(rng), kind: opts.kind, selection, count: RULES.strategyOffers, forced });
  const picked: CwStrategy[] = [];
  for (const g of grades) { const x = drawStrategy(s, pack, g, rng, picked.map((p) => p.name)); if (x) picked.push(x); }
  const now = globalIndex(s.plane, s.node);
  const banked = (s.bankedStrategyRefreshes ?? []).filter((b) => b.at <= now).reduce((n, b) => n + b.n, 0);
  const refreshable = opts.pending ? opts.pending.refreshable : true;
  const meta: OfferMeta = {
    grades: picked.map((p) => p.rarity), why: why.slice(0, picked.length),
    refreshes: refreshable ? startingRefreshes(rules, opts.pending) + banked : 0,
    perOption: refreshable && rules.perOptionRefresh ? picked.map(() => false) : undefined,
    refreshable, kind: opts.kind, source: opts.pending?.source, free: opts.pending?.free,
  };
  s = {
    ...s,
    nodeSelections: opts.kind === "node" ? selection : s.nodeSelections,
    grades: usedShift ? { ...rules, nextShift: undefined } : s.grades,
    bankedStrategyRefreshes: banked ? (s.bankedStrategyRefreshes ?? []).filter((b) => b.at > now) : s.bankedStrategyRefreshes,
  };
  return [picked, meta, s];
}

/** Refresh one offered Strategy: same grade (Environment rules can't be bypassed); Cottontail upgrades the first one each plane. */
export function refreshStrategy(s0: RunState, pack: CwPack, index: number): RunState {
  const meta = s0.offers.strategyMeta;
  const cur = s0.offers.strategies?.[index];
  if (s0.phase !== "strategy" || !meta || !cur) return s0;
  if (!meta.refreshable) return note(s0, "These Investment Strategies can't be refreshed.");
  const usePerOption = !!meta.perOption && !meta.perOption[index];
  if (!usePerOption && meta.refreshes <= 0) return note(s0, "No Investment Strategy refreshes left.");
  const [s1, rng] = step(s0);
  let s = s1;
  let grade = meta.grades[index];
  let why = meta.why[index];
  const e = s.escapade;
  if (e?.variant === "ct-strategy" && !(e.boosted ?? []).includes(s.plane) && grade !== "Prismatic") {
    grade = shiftGrade(grade, 1); why = "refresh-up";
    s = { ...s, escapade: { ...e, boosted: [...(e.boosted ?? []), s.plane], history: [...e.history, { tick: s.tick, text: `first Strategy refresh this plane became ${grade}.` }] } };
    s = log(s, `Cottontail: the first Strategy refresh this plane is upgraded to ${grade}.`);
  }
  const offered = s.offers.strategies ?? [];
  const x = drawStrategy(s, pack, grade, rng, offered.map((o) => o.name));
  if (!x) return note(s0, `No other ${grade} Investment Strategy to refresh into.`);
  const strategies = offered.map((o, i) => (i === index ? x : o));
  const next: OfferMeta = {
    ...meta, grades: meta.grades.map((g, i) => (i === index ? grade : g)), why: meta.why.map((w, i) => (i === index ? why : w)),
    refreshes: usePerOption ? meta.refreshes : meta.refreshes - 1, perOption: meta.perOption?.map((u, i) => u || (usePerOption && i === index)),
  };
  return log({ ...s, offers: { ...s.offers, strategies, strategyMeta: next } }, `Refreshed Strategy: ${cur.name} → ${x.name} (${grade}).`);
}

/** Apply a Strategy directly (Visionary's grants). */
function grantRandomStrategy(s0: RunState, pack: CwPack, grade: Grade, rng: () => number, source: string, free: boolean): RunState {
  const st = drawStrategy(s0, pack, grade, rng, []);
  if (!st) return s0;
  const [s2, applied] = applyEffect({ ...s0, strategies: [...s0.strategies, st], extraDifficulty: s0.extraDifficulty + (free ? 0 : RULES.strategyDifficulty[st.rarity]) }, pack, st.effect, rng, st.name);
  return log(s2, `${source}: ${grade} strategy ${st.name}${applied.length ? ` (${applied.join(", ")})` : ""}.`);
}

/** Global node index of "Node P-N" (1-based plane and node). */
const nodeAt = (plane: number, node: number) => globalIndex(plane - 1, node - 1);

/**
 * Strategy-grade Investments (Environment or Strategy text). Returns the state, what it applied and
 * the sentences it handled.
 */
export function strategyInvestment(s: RunState, pack: CwPack, text: string, source: string, rng: () => number): [RunState, string[], string[]] {
  let out = s;
  let rules: GradeRules = { ...gradeRulesOf(s), sources: { ...gradeRulesOf(s).sources } };
  const pend: PendingSelection[] = [...(s.pendingSelections ?? [])];
  const applied: string[] = [];
  const handled: string[] = [];
  const now = globalIndex(s.plane, s.node);
  const ORD: Record<string, number> = { first: 1, second: 2, third: 3 };
  for (const sen of text.split(/(?<=[.!])\s+/).map((x) => x.trim())) {
    let m: RegExpExecArray | null;
    if ((m = /All Investment Strategies in this round are of (Silver|Gold|Prismatic) quality/i.exec(sen))) {
      rules = { ...rules, fixed: m[1] as Grade, sources: { ...rules.sources, fixed: source } }; applied.push(`every Strategy ${m[1]}`); handled.push(sen);
    } else if ((m = /^The (first|second|third) investment strategy is of (Silver|Gold|Prismatic) quality/i.exec(sen))) {
      rules = { ...rules, guarantees: { ...rules.guarantees, [ORD[m[1].toLowerCase()]]: m[2] as Grade }, sources: { ...rules.sources, guarantee: source } }; applied.push(`${m[1]} Strategy selection ${m[2]}`); handled.push(sen);
    } else if ((m = /left, middle, and right options will be (Silver|Gold|Prismatic), (Silver|Gold|Prismatic), and (Silver|Gold|Prismatic) quality respectively/i.exec(sen))) {
      rules = { ...rules, positions: [m[1], m[2], m[3]] as Grade[], sources: { ...rules.sources, positions: source } }; applied.push(`left/middle/right ${m[1]}/${m[2]}/${m[3]}`);
      const more = /Investment Strategy refresh count increases by (\d+)/i.exec(sen);
      if (more) { rules = { ...rules, refreshBonus: (rules.refreshBonus ?? 0) + Number(more[1]), sources: { ...rules.sources, refresh: source } }; applied.push(`+${more[1]} Strategy refreshes`); }
      handled.push(sen);
    } else if ((m = /The quality of your next Investment Strategy increases by (\d+)/i.exec(sen))) {
      rules = { ...rules, nextShift: (rules.nextShift ?? 0) + Number(m[1]), sources: { ...rules.sources, shift: source } }; applied.push(`next Strategy +${m[1]} grade`); handled.push(sen);
    } else if ((m = /Immediately choose one of three (Silver|Gold|Prismatic) Investment Strategies, with (\d+) refresh/i.exec(sen))) {
      pend.push({ grade: m[1] as Grade, refreshes: Number(m[2]), refreshable: true, source }); applied.push(`choose a ${m[1]} Strategy now (${m[2]} refreshes)`); handled.push(sen);
    } else if ((m = /^After (\d+) Nodes?, gains another refresh/i.exec(sen))) {
      out = { ...out, bankedStrategyRefreshes: [...(out.bankedStrategyRefreshes ?? []), { at: now + Number(m[1]), n: 1 }] }; applied.push(`+1 Strategy refresh after ${m[1]} nodes`); handled.push(sen);
    } else if ((m = /After (?:entering )?(\d+) (?:new )?Node\(?s?\)?, (?:choose one of three|select (?:a|1)) non-refreshable (Silver|Gold|Prismatic) Investment Strateg/i.exec(sen)) || (m = /After (?:entering )?(\d+) (?:new )?Nodes?, select 1 (Silver|Gold|Prismatic) Investment Strategy that cannot be refreshed/i.exec(sen))) {
      pend.push({ at: now + Number(m[1]), grade: m[2] as Grade, refreshes: 0, refreshable: false, source }); applied.push(`a non-refreshable ${m[2]} Strategy after ${m[1]} nodes`); handled.push(sen);
    } else if ((m = /^At Node (\d)-(\d), gain an additional (?:choice and choose one of three Investment Strategies|Investment Strategy)/i.exec(sen))) {
      pend.push({ at: nodeAt(Number(m[1]), Number(m[2])), refreshes: 0, refreshable: true, source }); applied.push(`an extra Strategy choice at Node ${m[1]}-${m[2]}`); handled.push(sen);
    } else if ((m = /When obtaining an Investment Strategy, gain \((\d+) × current number of Investment Strategies owned\) Gold Coins/i.exec(sen))) {
      out = { ...out, goldPerStrategy: Number(m[1]) }; applied.push(`${m[1]} gold per Strategy owned on each new one`); handled.push(sen);
    } else if (/Subsequent Investment Strategy Nodes will be changed to grant 1 random Prismatic Investment Strateg/i.test(sen)) {
      rules = { ...rules, visionary: true, sources: { ...rules.sources, visionary: source } }; applied.push("later Strategy Nodes grant a random Prismatic Strategy (no difficulty)"); handled.push(sen);
    } else if ((m = /^Gains a random (Silver|Gold|Prismatic) Investment Strategy(?: and (\d+) Gold Coins?)?/i.exec(sen))) {
      out = grantRandomStrategy({ ...out, grades: rules }, pack, m[1] as Grade, rng, source, false);
      rules = gradeRulesOf(out);
      if (m[2]) out = { ...out, gold: out.gold + Number(m[2]) };
      applied.push(`a random ${m[1]} Strategy${m[2] ? ` and ${m[2]} gold` : ""}`); handled.push(sen);
    }
  }
  if (!applied.length) return [s, [], []];
  return [{ ...out, grades: rules, pendingSelections: pend }, applied, handled];
}

/** Queue what interrupts this node: Bubble Wolf's bonus Strategy, then the Plot Armor selection. */
function withInterludes(s: RunState, pack: CwPack): RunState {
  if (s.phase === "teaBreak") return s;
  const queue: Interlude["queue"] = [];
  let out = s;
  if (out.escapade?.extraStrategy) {
    out = { ...out, escapade: { ...out.escapade, extraStrategy: false }, pendingSelections: [...(out.pendingSelections ?? []), { refreshes: 0, refreshable: true, source: "Bubble Wolf" }] };
  }
  const now = globalIndex(out.plane, out.node);
  for (const p of out.pendingSelections ?? []) if (p.at === undefined || p.at <= now) queue.push("bonusStrategy");
  if (selectionDue(out)) {
    if (deployed(out).some((u) => !u.npc)) queue.push("plotArmor");
    else out = log({ ...out, plotArmor: { ...plotOf(out), done: [...plotOf(out).done, out.plane] } }, "Plot Armor: no one deployed to become the protagonist.");
  }
  if (!queue.length) return out;
  return nextInterlude({ ...out, interlude: { queue, resume: { phase: out.phase, offers: out.offers } } }, pack);
}

/** Start the next queued interlude, or return to the node's own phase. */
export function nextInterlude(s: RunState, pack: CwPack): RunState {
  const il = s.interlude;
  if (!il) return s;
  const [head, ...rest] = il.queue;
  if (!head) return { ...s, phase: il.resume.phase, offers: il.resume.offers, interlude: undefined };
  const next: RunState = { ...s, interlude: { ...il, queue: rest, active: head } };
  if (head === "bonusStrategy") {
    const now = globalIndex(next.plane, next.node);
    const i = (next.pendingSelections ?? []).findIndex((p) => p.at === undefined || p.at <= now);
    if (i < 0) return nextInterlude(next, pack);
    const pending = next.pendingSelections![i];
    const rest2 = next.pendingSelections!.filter((_, k) => k !== i);
    const [opts, meta, s2] = strategyOffer({ ...next, pendingSelections: rest2 }, pack, createRng(`${s.seed}:bonus-strategy:${s.tick}:${i}`), { kind: "extra", pending });
    if (!opts.length) return nextInterlude(s2, pack);
    return log({ ...s2, phase: "strategy", offers: { strategies: opts, strategyMeta: meta } }, `${pending.source}: an extra Investment Strategy selection${pending.grade ? ` (${pending.grade})` : ""}!`);
  }
  if (head === "plotArmor") return log(beginSelection(next, pack, "protagonist"), `Plot Armor: choose Protagonist ${plotOf(next).done.length + 1} from your deployed characters.`);
  if (head === "swap") return beginSelection(next, pack, "swap");
  return beginSelection(next, pack, "imagenae", il.uid);
}

/** A selection started during preparation (Imagenae item, It's A Wrap swap) returns to preparation. */
function startPrepInterlude(s: RunState, pack: CwPack, what: "imagenae" | "swap", uid?: number): RunState {
  return nextInterlude({ ...s, interlude: { queue: [what], uid, resume: { phase: s.phase, offers: s.offers } } }, pack);
}

/** Take a Plot Armor option, then continue the node. */
export function choosePlotArmor(s0: RunState, pack: CwPack, index: number): RunState {
  const s = choosePlot(s0, pack, index);
  if (s === s0 || s.plotArmor?.current) return s;
  return settle(s.interlude ? nextInterlude(s, pack) : { ...s, phase: "prep" }, pack);
}

/** "It's A Wrap": use a swap chance to name a new protagonist. */
export function useSwap(s0: RunState, pack: CwPack): RunState {
  const p = plotOf(s0);
  if (s0.phase !== "prep" || p.swaps < 1) return s0;
  const [s] = step(s0);
  return startPrepInterlude({ ...s, plotArmor: { ...p, swaps: p.swaps - 1 } }, pack, "swap");
}

/** Pick a Backstage Tea Break / Treasury option; the node is then cleared without a fight. */
export function pickTea(s0: RunState, pack: CwPack, index: number): RunState {
  const s = chooseTea(s0, pack, index);
  return s === s0 ? s0 : advance(s, pack);
}

/** The Bond with the highest active tier (for March Bunny). */
function highestBond(s: RunState, pack: CwPack): string | null {
  const order = { bronze: 1, silver: 2, gold: 3, plat: 4 } as Record<string, number>;
  const best = teamPower(s, pack).bonds.filter((b) => b.bond.category !== PLOT_ARMOR_RULES.bondCategory).sort((a, b) => (order[b.tier!] ?? 0) - (order[a.tier!] ?? 0) || b.count - a.count)[0];
  return best?.bond.name.replace(/: .*$/, "") ?? null;
}

/**
 * Aeon ★ Aha's cost: 5-cost from level 5 (the wiki's "Upgrade Aeon ★ Aha's level to 5", read as the level),
 * 7-cost when Elation characters' total star rating reaches 10 or Phantasmoon Games' reaches 12 (verified).
 */
export function promoteAeonAha(s: RunState, states: ReturnType<typeof placedBondStates>): RunState {
  const all = units(s).filter((u) => u.name === "Aeon ★ Aha");
  if (!all.length) return s;
  const starsOf = (bond: string) => [...s.on, ...s.off].filter((u): u is Unit => !!u && !u.npc && (states.find((b) => b.bond.name === bond || b.bond.name.startsWith(`${bond}: `))?.bond.members.includes(u.name) ?? false)).reduce((n, u) => n + u.stars, 0);
  const target = starsOf("Elation") >= 10 || starsOf("Phantasmoon Games") >= 12 ? 7 : s.level >= 5 ? 5 : 4;
  if (all.every((u) => u.cost >= target)) return s;
  const up = (u: Unit | null) => (u && u.name === "Aeon ★ Aha" && u.cost < target ? { ...u, cost: target } : u);
  return note(log({ ...s, on: s.on.map(up), off: s.off.map(up), bench: s.bench.map(up) }, `Aeon ★ Aha ascends to ${target}-cost!`), `Aeon ★ Aha is now ${target}-cost: stronger Elation Skill and buffs.`);
}

/**
 * Things that happen as soon as the board allows them (once each): Trailblaze Store unlocks and the
 * Bond level 10 grant, Roll-Call's Imagenae: Plot Armor, finished Ashwolf assignments. Returns the
 * same object when nothing changes.
 */
export function settle(s: RunState, pack: CwPack): RunState {
  if (s.phase === "over") return s;
  const states = placedBondStates(s, pack);
  const count = (name: string) => states.find((b) => b.bond.name === name || b.bond.name.startsWith(`${name}: `))?.count ?? 0;
  let out = syncTsrLevel(s, pack, count(TSR_BOND));
  const rule = s.variants?.["Phantasmoon Games"];
  out = rollCallGrant(out, count("Phantasmoon Games"), !!rule && /Roll-Call/.test(rule));
  out = checkAssignments(out);
  // Aeon ★ Aha becomes 5-cost, then 7-cost (Master of Phantasia's unlock criteria).
  out = promoteAeonAha(out, states);
  // Aha descends into the preparation area once the Elation Bond is active, with 3 random basic pieces.
  if (!out.aha && count("Elation") && ahaStar(out, pack)) {
    const rng = createRng(`${out.seed}:aha`);
    const items = [randomBasic(pack, rng), randomBasic(pack, rng), randomBasic(pack, rng)].filter((x): x is string => !!x);
    out = note(log({ ...out, aha: { items } }, `Aha descends into the preparation area with ${items.join(", ")}.`), "Aha joined: drag equipment onto Aha to synthesize THEIR gear.");
  }
  return out;
}

export function pickStrategy(s0: RunState, pack: CwPack, index: number): RunState {
  const st = s0.offers.strategies?.[index];
  if (s0.phase !== "strategy" || !st) return s0;
  const [s1, rng] = step(s0);
  const meta = s0.offers.strategyMeta;
  // The grade the card showed is the grade that counts (Silver Age / Visionary picks add no difficulty).
  const difficulty = meta?.free || gradeRulesOf(s1).fixed === "Silver" ? 0 : RULES.strategyDifficulty[st.rarity];
  const owned = [...s1.strategies, st];
  const bonusGold = (s1.goldPerStrategy ?? 0) * owned.length;
  const [s2, applied] = applyEffect({ ...s1, strategies: owned, gold: s1.gold + bonusGold, extraDifficulty: s1.extraDifficulty + difficulty }, pack, st.effect, rng, st.name);
  let out = log({ ...s2, phase: "prep" as Phase, offers: {} }, `${st.rarity} strategy: ${st.name}${applied.length ? ` (${applied.join(", ")})` : " (effect not simulated)"}${bonusGold ? ` · +${bonusGold} gold` : ""}.`);
  // Selections that start right away (Gold/Silver Investment).
  const immediate = (out.pendingSelections ?? []).some((p) => p.at === undefined);
  if (immediate) {
    if (out.interlude?.active === "bonusStrategy") out = { ...out, interlude: { ...out.interlude, queue: ["bonusStrategy", ...out.interlude.queue] } };
    else return settle(nextInterlude({ ...out, interlude: { queue: ["bonusStrategy"], resume: { phase: "prep", offers: {} } } }, pack), pack);
  }
  return settle(out.interlude?.active === "bonusStrategy" ? nextInterlude(out, pack) : out, pack);
}

/** Supply node: take one character with the basic item they carry, then move on (no battle). */
export function pickSupply(s0: RunState, pack: CwPack, index: number): RunState {
  const o = s0.offers.supply?.[index];
  if (s0.phase !== "supply" || !o) return s0;
  const items = o.items ?? (o.item ? [o.item] : []);
  const withItems = (st: RunState, got: string[]) => addBasics({ ...st, bag: [...st.bag, ...got.filter((i) => !isBasic(pack, i))] }, got.filter((i) => isBasic(pack, i)));
  // Mummicat: the pick is equipment boxes, not a character.
  if (o.name === "Basic Weapon Box") return advance(log(withItems({ ...step(s0)[0], offers: {} }, items), `Supply: ${items.length} × Basic Weapon Box (Mummicat).`), pack);
  const [s, u] = makeUnit(step(s0)[0], o.name, o.cost, o.stars ?? 1);
  const after = gain(s, u);
  if (!after) return note(s0, "Your bench is full. Sell someone first, or skip.");
  let next = log(withItems(after, items), `Supply: ${o.stars && o.stars > 1 ? `${"★".repeat(o.stars)} ` : ""}${o.name}${items.length ? ` with ${items.join(", ")}` : ""}.`);
  const rest = (s0.offers.supply ?? []).filter((_, k) => k !== index);
  const rng = createRng(`${s0.seed}:supply:${s0.tick}`);
  const extra: typeof rest = [];
  if ((next.supplyAll ?? 0) > 0) { extra.push(...rest); next = { ...next, supplyAll: (next.supplyAll ?? 0) - 1 }; }
  else if ((next.triggers ?? []).some((t) => t.on === "supply" && t.text === "__scout") && rest.length) extra.push(pickOne(rng, rest));
  for (const x of extra) {
    const [s2, u2] = makeUnit(next, x.name, x.cost, x.stars ?? 1);
    const got = gain(s2, u2);
    next = got ? log({ ...got, bag: x.item ? [...got.bag, x.item] : got.bag }, `Supply bonus: ${x.name}${x.item ? ` with ${x.item}` : ""}.`) : log({ ...s2, bag: x.item ? [...s2.bag, x.item] : s2.bag }, `Supply bonus: ${x.name} couldn't join (bench full); kept ${x.item || "nothing"}.`);
  }
  return advance({ ...next, offers: {} }, pack);
}

/** Leave a Supply node without taking anything. */
export function skipSupply(s: RunState, pack: CwPack): RunState {
  if (s.phase !== "supply") return s;
  return advance(log({ ...s, offers: {} }, "Supply: skipped."), pack);
}

export function pickEncounter(s: RunState, which: "easy" | "hard"): RunState {
  if (s.phase !== "encounter") return s;
  return log({ ...s, encounter: which, phase: "prep" }, `Encounter: chose the ${which} fight.`);
}

// --------------------------------------------------------------------------------------------- preparation

export function findUnit(s: RunState, uid: number): Spot | null {
  for (const zone of ["on", "off", "bench"] as Zone[]) { const index = s[zone].findIndex((u) => u?.uid === uid); if (index >= 0) return { zone, index }; }
  return null;
}
export const at = (s: RunState, spot: Spot) => s[spot.zone][spot.index] ?? null;

export function buy(s0: RunState, pack: CwPack, index: number): RunState {
  const slot = s0.shop[index];
  if (s0.phase !== "prep" || !slot) return s0;
  const price = slot.cost * copiesFor(slot.stars);
  if (s0.gold < price) return note(s0, `Not enough gold (${price} needed).`);
  const [s, u] = makeUnit(step(s0)[0], slot.name, slot.cost, slot.stars);
  const after = gain({ ...s, gold: s.gold - price }, u);
  if (!after) return note(s0, "Your bench is full. Sell someone or deploy them first.");
  const shop = [...after.shop]; shop[index] = null;
  return talentRefill({ ...after, shop }, pack, index, slot.cost, createRng(`${s0.seed}:talent:${s0.tick}`));
}

export function sell(s0: RunState, spot: Spot): RunState {
  const u = at(s0, spot);
  // Allowed at Supply too, so a full bench never blocks taking a character.
  if (!u || (s0.phase !== "prep" && s0.phase !== "supply")) return s0;
  const [s] = step(s0);
  const zone = [...s[spot.zone]]; zone[spot.index] = null;
  const refund = ASSUMED.sellRefund(u.cost, u.stars);
  return log({ ...s, [spot.zone]: zone, gold: s.gold + refund, bag: [...s.bag, ...u.items] }, `Sold ${"★".repeat(u.stars)} ${u.name} for ${refund}.`);
}

/** Move or swap. Deploying from the bench needs a free team slot (team size = level). */
export function moveUnit(s0: RunState, from: Spot, to: Spot): RunState {
  const a = at(s0, from), b = at(s0, to);
  if (!a || (from.zone === to.zone && from.index === to.index)) return s0;
  const deploying = from.zone === "bench" && to.zone !== "bench" && !b;
  if (deploying && deployed(s0).length >= teamSize(s0)) return note(s0, `Team is full: level ${s0.level} deploys ${teamSize(s0)}. Buy XP to level up.`);
  const s = { ...s0, on: [...s0.on], off: [...s0.off], bench: [...s0.bench], note: null };
  s[to.zone][to.index] = a;
  s[from.zone][from.index] = b;
  return s;
}

/** Best free spot for a unit by its wiki position (on-field, off-field or either). */
export function autoSpot(s: RunState, pack: CwPack, u: Unit): Spot | null {
  if (deployed(s).length >= teamSize(s)) return null;
  const field = pack.info?.[u.name]?.field ?? "both";
  const order: ("on" | "off")[] = field === "off" ? ["off", "on"] : field === "on" ? ["on", "off"] : ["on", "off"];
  for (const zone of order) {
    if (field !== "both" && zone !== order[0]) continue;
    const index = s[zone].findIndex((x) => !x);
    if (index >= 0) return { zone, index };
  }
  return null;
}

export function refresh(s0: RunState, pack: CwPack): RunState {
  if (s0.phase !== "prep") return s0;
  const free = s0.freeRefreshes > 0;
  if (!free && s0.gold < RULES.refreshCost) return note(s0, `Refreshing costs ${RULES.refreshCost} gold.`);
  const [s, rng] = step(s0);
  const out = { ...s, gold: free ? s.gold : s.gold - RULES.refreshCost, freeRefreshes: free ? s.freeRefreshes - 1 : s.freeRefreshes, shop: rollShopSlots(s, pack, rng), stats: { ...s.stats, refreshes: s.stats.refreshes + 1 } };
  return (out.triggers ?? []).some((t) => t.on === "refresh") ? fireTriggers(out, pack, "refresh", rng) : out;
}

export function buyXp(s0: RunState): RunState {
  if (s0.phase !== "prep") return s0;
  if (s0.level >= ASSUMED.maxLevel) return note(s0, "Already max level.");
  if (s0.gold < s0.xpCost) return note(s0, `Experience costs ${s0.xpCost} gold.`);
  const [s] = step(s0);
  return levelUp({ ...s, gold: s.gold - s.xpCost, stats: { ...s.stats, xpBought: s.stats.xpBought + 1 } }, ASSUMED.xpPerBuy + xpBonus(s));
}

export const toggleLock = (s: RunState): RunState => ({ ...s, locked: !s.locked });

/** Equip a bag item. A basic item on a unit holding a basic item combines into the advanced one. Consumables are used on the unit. */
export function equip(s0: RunState, pack: CwPack, bagIndex: number, spot: Spot): RunState {
  const item = s0.bag[bagIndex];
  const u = at(s0, spot);
  if (!item || !u || s0.phase !== "prep") return s0;
  if (u.npc) return note(s0, `${u.name}'s Emblems are permanently attached.`);
  const sp = specialItem(item);
  if (sp?.use === "projector") {
    if (u.cost > (sp.maxCost ?? 99)) return note(s0, `${item} works on ${sp.maxCost}-Cost or lower characters.`);
    if (sp.bond && !runBonds(s0, pack).some((b) => (b.name === sp.bond || b.name.startsWith(`${sp.bond}: `)) && b.members.includes(u.name))) return note(s0, `${item} works on "${sp.bond}" characters.`);
    const [s1] = step(s0);
    const [s2, copy] = makeUnit({ ...s1, bag: s1.bag.filter((_, i) => i !== bagIndex) }, u.name, u.cost);
    const after = gain(s2, copy);
    if (!after) return note(s0, "Your bench is full. Make room for the copy first.");
    return log(after, `${item}: a 1-star copy of ${u.name}.`);
  }
  if (sp?.use === "plotArmor") {
    if (spot.zone === "bench") return note(s0, "Deploy the character first: Plot Armor goes on a character on the field.");
    if (plotOf(s0).holders.some((h) => h.uid === u.uid && !h.disabled)) return note(s0, `${u.name} already has Plot Armor.`);
    const [s1] = step(s0);
    return startPrepInterlude(log({ ...s1, bag: s1.bag.filter((_, i) => i !== bagIndex) }, `Imagenae: Plot Armor used on ${u.name}.`), pack, "imagenae", u.uid);
  }
  if (sp?.use === "box") return note(s0, "Tap the Basic Weapon Box in Items to choose what's inside.");
  if (sp?.only && sp.only !== u.name) return note(s0, `${item} can only be equipped by ${sp.only}.`);
  let items = [...u.items];
  let made: string | null = null;
  if (isOre(item)) return note(s0, "Tap an ore to open it.");
  if (isComponent(pack, item)) {
    const i = items.findIndex((x) => isComponent(pack, x) && combineResult(pack, x, item));
    if (i >= 0) { made = combineResult(pack, items[i], item)!; items[i] = made; }
  }
  if (!made) {
    if (items.length >= RULES.itemsPerUnit) return note(s0, `${u.name} already holds ${RULES.itemsPerUnit} items.`);
    items = [...items, item];
  }
  const [s] = step(s0);
  const zone = [...s[spot.zone]]; zone[spot.index] = { ...u, items };
  const bag = s.bag.filter((_, i) => i !== bagIndex);
  const out = { ...s, [spot.zone]: zone, bag };
  return made ? synthesisRefund(log(out, `${u.name}: ${item} combined into ${made}.`), [u.items.find((x) => isComponent(pack, x) && combineResult(pack, x, item)) ?? item, item].filter((x) => isBasic(pack, x))) : out;
}

/** Combine two items in the bag (basic + basic, gem + basic, gem + gem). */
export function combineBag(s0: RunState, pack: CwPack, i: number, j: number): RunState {
  const a = s0.bag[i], b = s0.bag[j];
  const r = a && b && i !== j && isComponent(pack, a) && isComponent(pack, b) ? combineResult(pack, a, b) : null;
  if (!r) return note(s0, "Those two don't combine.");
  const [s] = step(s0);
  return synthesisRefund(log({ ...s, bag: [...s.bag.filter((_, k) => k !== i && k !== j), r] }, `${a} + ${b} → ${r}.`), [a, b].filter((x) => isBasic(pack, x)));
}

/** Phases when you can open ores (any time you're in the run, not on its end screen). */
const canOpen = (s: RunState) => s.phase !== "over" && s.phase !== "environment";

/** Open a Crystal Ore from the bag. Contents of random ores are a stated guess (ORE_REWARDS). */
export function openOre(s0: RunState, pack: CwPack, bagIndex: number): RunState {
  const name = s0.bag[bagIndex];
  if (!name || !isOre(name) || !canOpen(s0)) return s0;
  const [s1, rng] = step(s0);
  let s: RunState = { ...s1, bag: s1.bag.filter((_, k) => k !== bagIndex), stats: { ...s1.stats, oresOpened: (s1.stats.oresOpened ?? 0) + 1 } };
  const got: string[] = [];
  const fixed = oreGold(name);
  if (fixed !== null) { s = { ...s, gold: s.gold + fixed }; got.push(`${fixed} gold`); }
  const tier = oreTier(name);
  if (tier) {
    const table = ORE_REWARDS[tier];
    const r = table[weighted(rng, table.map((x) => x.weight))];
    if (r.character) {
      const cost = pickOne(rng, r.character);
      const pool = shopRoster(pack).filter((c) => c.cost === cost);
      if (pool.length) {
        const c = pickOne(rng, pool);
        const [s2, u] = makeUnit(s, c.name, c.cost);
        const after = gain(s2, u);
        if (!after) return note(s0, "Your bench is full. Make room before opening this ore.");
        s = after; got.push(c.name);
      }
    }
    if (r.gold) { const g = r.gold[0] + Math.floor(rng() * (r.gold[1] - r.gold[0] + 1)); s = { ...s, gold: s.gold + g }; got.push(`${g} gold`); }
    for (let k = 0; k < (r.basic ?? 0); k++) { const it = randomBasic(pack, rng); if (it) { s = addBasics(s, [it]); got.push(it); } }
    if (r.emblem) { const em = randomEmblem(pack, rng); if (em) { s = { ...s, bag: [...s.bag, em] }; got.push(em); } }
    if (s.oreEcho) {
      const roll = rng();
      if (roll < ASSUMED.goldMinerPrismatic) { s = { ...s, bag: [...s.bag, oreName("Prismatic")] }; got.push("a Prismatic Crystal Ore!"); }
      else if (roll < 0.5 && tier !== "White") { const lower = oreName(ORE_TIERS[ORE_TIERS.indexOf(tier) - 1]); s = { ...s, bag: [...s.bag, lower] }; got.push(`a ${lower}`); }
    }
  }
  const goldGained = s.gold - s0.gold;
  if (goldGained > 0) s = { ...s, stats: { ...s.stats, goldEarned: s.stats.goldEarned + goldGained } };
  const line = `Opened ${name}: ${got.join(", ") || "nothing"}.`;
  return note(log(s, line), line);
}

// --------------------------------------------------------------------------------------------- combat

const STRENGTH_FALLBACK: Record<number, number[]> = { 1: [100, 160, 220], 2: [125, 190, 260], 3: [140, 220, 300], 4: [175, 270, 450], 5: [200, 320, 2000] };

/** A unit's strength from its wiki page alone: On-/Off-Field Strength at its star and HP bonus. */
export function unitBase(u: Unit, place: "on" | "off", pack: CwPack): number {
  if (u.npc) return 0;
  const info: CwCharInfo | undefined = pack.info?.[u.name];
  const i = u.stars - 1;
  const aeon = u.name === "Aeon ★ Aha" ? (u.cost >= 7 ? 2 : u.cost >= 5 ? 1.25 : 1) : 1;
  return aeon * (info ? ((place === "on" ? info.onField : info.offField)[i] ?? 0) * (1 + ((info.hp[i] ?? 0) / 100) * MODEL.hpWeight) : (STRENGTH_FALLBACK[u.cost] ?? STRENGTH_FALLBACK[1])[i]);
}

/** What a unit's own equipment does: stats on itself, and passives for the whole squad. */
export function unitItems(u: Unit, place: "on" | "off", pack: CwPack, ctx: { singularity?: number; boss?: boolean } = {}): { self: Stats; squad: Partial<Stats>[]; notes: string[] } {
  let self = zeroStats();
  const squad: Partial<Stats>[] = [];
  const notes: string[] = [];
  // Evolution Modification Module: the first advanced item counts as privileged.
  const evo = u.items.includes("Evolution Modification Module");
  const firstAdv = u.items.find((it) => itemKind(pack, it) === "advanced");
  for (const it of [...u.items, ...(u.dice ?? [])]) {
    if (it === "Imploding Singularity") { self = addStats(self, { str: ESCAPADE_ASSUMED.singularity.perStack * (ctx.singularity ?? 0) }); continue; }
    const fx = itemEffect(pack, it, { place, stars: u.stars, boss: !!ctx.boss, privileged: evo && it === firstAdv });
    self = addStats(self, fx.self);
    if (Object.keys(fx.squad).length) squad.push(fx.squad);
    if (fx.notes.length) notes.push(`${it}: ${fx.notes.join(", ")}`);
    if (pack.equipment?.advanced.find((a) => a.name === it)?.users.includes(u.name)) self = addStats(self, { str: MODEL.recommended });
  }
  return { self, squad, notes };
}

/** One unit's strength in a position on its own: wiki strength, HP bonus and its equipment's stats. */
export function unitPower(u: Unit, place: "on" | "off", pack: CwPack, ctx: { singularity?: number; boss?: boolean } = {}): number {
  const base = unitBase(u, place, pack);
  if (!base) return 0;
  return base * powerMult(unitItems(u, place, pack, ctx).self, place);
}

/** The season's bonds with this run's variant rules. */
export const runBonds = (s: Pick<RunState, "variants">, pack: CwPack) => withVariants(pack.bonds, s.variants);

type Placed = { u: Unit; place: "on" | "off" };
const placedOf = (s: RunState) => [...s.on.map((u) => ({ u, place: "on" as const })), ...s.off.map((u) => ({ u, place: "off" as const }))].filter((x): x is Placed => !!x.u);

/** Bond states on the field: Emblems and Plot Armor Bonds add their holders as members. */
export function placedBondStates(s: RunState, pack: CwPack) {
  const placed = placedOf(s);
  const extra = new Map<string, string[]>();
  const add = (bond: string, who: string) => extra.set(bond, [...(extra.get(bond) ?? []), who]);
  for (const x of placed) for (const it of x.u.items) { const b = emblemBond(pack, it); if (b) add(b, x.u.name); }
  for (const h of plotOf(s).holders) {
    if (h.disabled || !placed.some((x) => x.u.uid === h.uid)) continue;
    const bond = /^bond:(.+)$/.exec(h.option)?.[1];
    if (bond) add(bond, `${h.name}#${h.uid}`);
  }
  const bondList = runBonds(s, pack).map((b) => {
    const more = extra.get(b.name) ?? extra.get(b.name.replace(/: .*$/, "")) ?? [];
    return more.length ? { ...b, members: [...new Set([...b.members, ...more])] } : b;
  });
  // Plot Armor Bonds count holders (two holders of the same name count twice).
  const board = [...placed.map((x) => ({ name: x.u.name, stars: x.u.stars })), ...plotOf(s).holders.filter((h) => !h.disabled && placed.some((x) => x.u.uid === h.uid) && h.option.startsWith("bond:")).map((h) => ({ name: `${h.name}#${h.uid}`, stars: 1 as const }))];
  return boardBonds(board, bondList);
}

export interface SummonPower extends Summon { power: number }

/** Aha's star from the Elation Bond level (Bond levels 3/5/6/8 → 1★–4★; 0 = no Aha). */
export function ahaStar(s: RunState, pack: CwPack): number {
  const st = placedBondStates(s, pack).find((b) => b.bond.name === "Elation");
  if (!st?.active) return 0;
  return Math.max(1, st.bond.levels.findIndex((l) => l.count === st.active!.count) + 1);
}

/** Aha's stats: base by star plus THEIR equipment's stats (offensive effects apply during Elation Skills). */
export function ahaStats(s: RunState, pack: CwPack, star = ahaStar(s, pack)): AhaState | null {
  if (!star) return null;
  const i = Math.min(3, star - 1);
  let st = addStats(zeroStats(), { str: AHA.strength[i] / 100, dmg: AHA.dmg[i] / 100, lucky: AHA.lucky[i] / 100, luckyDmg: AHA.luckyDmg[i] / 100 });
  for (const it of s.aha?.items ?? []) st = addStats(st, itemEffect(pack, it, { place: "on", stars: star, boss: false }).self);
  return { star, strength: st.str + (st.on + st.off) / 2, dmg: st.dmg, lucky: st.lucky, luckyDmg: st.luckyDmg, spdAmp: st.spd };
}

/** Equipment slots Aha has for advanced pieces (= THEIR star). */
export const ahaSlots = (star: number) => star;

/** Drag an item onto Aha: a basic piece synthesizes with one of Aha's basics; advanced pieces go into a free slot. */
export function equipAha(s0: RunState, pack: CwPack, bagIndex: number): RunState {
  const item = s0.bag[bagIndex];
  const star = ahaStar(s0, pack);
  if (!item || !star || !s0.aha || s0.phase !== "prep") return note(s0, "Aha appears once the Elation Bond is active.");
  const items = [...s0.aha.items];
  const advanced = items.filter((x) => itemKind(pack, x) === "advanced").length;
  const kind = itemKind(pack, item);
  if (kind === "basic") {
    const j = items.findIndex((x) => itemKind(pack, x) === "basic" && combineResult(pack, x, item));
    if (j < 0) return note(s0, `${item} doesn't combine with Aha's basic equipment.`);
    if (advanced >= ahaSlots(star)) return note(s0, `Aha (${star}★) has ${ahaSlots(star)} equipment slot${star === 1 ? "" : "s"}: raise the Elation Bond for more.`);
    const made = combineResult(pack, items[j], item)!;
    items[j] = made;
    const [s] = step(s0);
    return log({ ...s, bag: s.bag.filter((_, k) => k !== bagIndex), aha: { items } }, `Aha: ${item} synthesized into ${made}.`);
  }
  if (kind === "advanced") {
    if (advanced >= ahaSlots(star)) return note(s0, `Aha's ${ahaSlots(star)} equipment slot${star === 1 ? " is" : "s are"} full.`);
    const [s] = step(s0);
    return log({ ...s, bag: s.bag.filter((_, k) => k !== bagIndex), aha: { items: [...items, item] } }, `Aha equips ${item}.`);
  }
  return note(s0, "Aha takes basic or advanced equipment.");
}

export function teamPower(s: RunState, pack: CwPack) {
  const placed = placedOf(s);
  const kind = nodeKind(s);
  const boss = kind === "Boss" || kind === "Encounter";
  const av = kind === "Reward" ? null : RULES.actionValue[s.plane]?.[kind === "Boss" ? 1 : 0] ?? null;
  const ctx = { singularity: s.escapade?.singularity, boss };
  const fighters = placed.filter((x) => !x.u.npc);
  const items = new Map(placed.map((x) => [x.u.uid, unitItems(x.u, x.place, pack, ctx)]));
  const bases = new Map(fighters.map((x) => [x.u.uid, unitBase(x.u, x.place, pack)]));
  const raw = fighters.reduce((n, x) => n + (bases.get(x.u.uid) ?? 0) * powerMult(items.get(x.u.uid)!.self, x.place), 0);
  // Equipment passives that help the whole squad (Weapon Master, Meteor Wings, Sturdy Plate…).
  const aStar = ahaStar(s, pack);
  // Aha's Survival/Support equipment works for the squad all the time (Aha User Manual ⑥).
  const ahaSquad = aStar ? (s.aha?.items ?? []).map((it) => itemEffect(pack, it, { place: "on", stars: aStar, boss }).squad) : [];
  const squadItems = [...[...items.values()].flatMap((x) => x.squad), ...ahaSquad].reduce<Stats>((a, b) => addStats(a, b), zeroStats());
  const touched = placedBondStates(s, pack);
  const bonds = touched.filter((b) => b.tier);
  const teamBonds = bonds.filter((b) => b.bond.category !== PLOT_ARMOR_RULES.bondCategory);
  const idle = placed.filter((x) => !x.u.npc && !bases.get(x.u.uid)).map((x) => x.u.name);
  const bctx: BondCtx = {
    placed: fighters.map((x) => ({ uid: x.u.uid, name: x.u.name, cost: x.u.cost, stars: x.u.stars, items: x.u.items, place: x.place, base: (bases.get(x.u.uid) ?? 0) * powerMult(items.get(x.u.uid)!.self, x.place) })),
    nodes: globalIndex(s.plane, s.node) + 1, av: av ?? 150, boss, storeLevel: s.level, isBasic: (i) => isBasic(pack, i),
  };
  const effects = teamBonds.map((b) => bondEffect(pack, b, bctx));
  // Every character's kit for where they stand: team buffs, enemy debuffs, ally actions, shields, healing, named summons (kits.ts).
  const kits = fighters.map((x) => ({ x, k: kitEffect(pack.info?.[x.u.name], x.u.name, x.u.stars, x.place, x.u.cost) }));
  const kitSquad = kits.reduce<Stats>((a, { k }) => addStats(a, k.squad), zeroStats());
  const memberOf = (e: (typeof effects)[number], name: string) => teamBonds.find((b) => b.bond.name === e.bond)?.bond.members.includes(name) ?? false;
  // 4.7 extras: Trailblaze Store stats, Plot Armor (options, Plot Armor Bonds, Roll-Call 7).
  const store = storeStats(s);
  const rule = s.variants?.["Phantasmoon Games"];
  const phantasmoon = touched.find((b) => b.bond.name.startsWith("Phantasmoon Games"))?.count ?? 0;
  const rollCall7 = !!rule && /Roll-Call/.test(rule) && phantasmoon >= PLOT_ARMOR_RULES.rollCall.boostAt;
  const ctxs: UnitCtx[] = fighters.map((x) => ({ uid: x.u.uid, name: x.u.name, cost: x.u.cost, stars: x.u.stars, place: x.place, bonds: touched.filter((b) => b.bond.members.includes(x.u.name)).map((b) => b.bond.name.replace(/: .*$/, "")) }));
  const share = (c: UnitCtx) => effects.filter((e) => memberOf(e, c.name)).reduce((n, e) => n + (e.members.str ?? 0) + (e.members.dmg ?? 0), 0);
  const per = fighters.map((x) => {
    const c = ctxs.find((y) => y.uid === x.u.uid)!;
    const plot = plotUnitBonus(s, pack, c, ctxs, rollCall7, share);
    let st = addStats(items.get(x.u.uid)!.self, squadItems);
    const noBonds = st;
    for (const e of effects) {
      if (memberOf(e, x.u.name)) st = addStats(st, e.members);
      st = addStats(st, e.squad);
      const own = e.perUnit.get(x.u.uid);
      if (own) st = addStats(st, own);
    }
    st = addStats(st, kitSquad);
    st = addStats(st, advantageStats(s.advantage ?? []));
    if (s.advantage?.includes("battle-prep")) st = addStats(st, { dmg: 0.05 });
    st = addStats(st, { on: store.on, off: store.off, dmg: store.team, str: plot.strength, spd: plot.spd });
    const base = bases.get(x.u.uid) ?? 0;
    return { uid: x.u.uid, name: x.u.name, place: x.place, power: base * powerMult(st, x.place), noBonds: base * powerMult(noBonds, x.place), spd: st.spd, plot: plot.strength, stats: st };
  });
  // Elation: Aha Instants, Punchline, Certified Banger, Lucky Strike (elation.ts).
  const elation = simulateElation(
    per.map((x) => ({ uid: x.uid, name: x.name, cost: fighters.find((f) => f.u.uid === x.uid)!.u.cost, stars: fighters.find((f) => f.u.uid === x.uid)!.u.stars, place: x.place, power: x.power, spdAmp: x.spd + (pack.info?.[x.name]?.spd?.[fighters.find((f) => f.u.uid === x.uid)!.u.stars - 1] ?? 0) / 100, lucky: x.stats.lucky, luckyDmg: x.stats.luckyDmg, elation: 0 })),
    ahaStats(s, pack, aStar), av ?? 150, `${s.seed}:${s.tick}:${s.plane}-${s.node}`,
  );
  // Silver Wolf LV.999: Hidden MMR at 180+ adds DMG Amplification.
  if (elation.hiddenMmr !== undefined && elation.hiddenMmr >= 180) {
    const sw = per.find((x) => x.name === "Silver Wolf LV.999");
    if (sw) { const f = fighters.find((x) => x.u.uid === sw.uid)!; sw.power *= 1 + [15, 20, 25][Math.min(2, f.u.stars - 1)] / 100; }
  }
  const elationPower = elation.damage / Math.max(1, (av ?? 150) / 100);
  const units = per.reduce((n, x) => n + x.power, 0);
  const bonus = units / Math.max(1, per.reduce((n, x) => n + x.noBonds, 0)) - 1;
  // Bond summons fight too (Crimson Thorns, Starskiff, Quintet Joint, Soul, Aha, chimeras, Svarog, Dan Heng • Permansor Terrae…).
  // Named summons from kits (Numby, Lightning-Lord, Little Ica…) replace the Summon Bond's generic ones and get its Summon Power.
  const summonBond = effects.find((e) => e.bond === "Summon");
  const summonPowerLevel = summonBond ? Number(/Summon Power (\d)/.exec(summonBond.summons[0]?.note ?? "")?.[1] ?? 0) : 0;
  const kitOwners = new Set(kits.filter(({ k }) => k.summons.length).map(({ x }) => x.u.name));
  const kitSummons: Summon[] = kits.flatMap(({ x, k }) => k.summons.map((sm) => ({ name: sm.name, bond: `${x.u.name}'s kit`, emoji: "✨", spd: 110, share: 0,
    power: (per.find((p) => p.uid === x.u.uid)?.power ?? 0) * sm.share * (summonBond && summonBond.summons.some((g) => g.name === `${x.u.name}'s summon`) ? 1 + 0.25 * summonPowerLevel : 1), note: sm.note })));
  const bondSummons = effects.flatMap((e) => e.summons).filter((m) => !(m.bond === "Summon" && kitOwners.has(m.name.replace(/'s summon$/, ""))));
  const summons: SummonPower[] = [...bondSummons, ...kitSummons].map((m) => {
    if (m.character) {
      const src = fighters.find((x) => x.u.name === "Dan Heng • Imbibitor Lunae");
      const copy: Unit = { uid: -1, name: m.character.name, cost: m.character.cost, stars: m.character.stars, items: (src?.u.items ?? []).slice(0, m.character.stars) };
      return { ...m, power: unitPower(copy, m.character.place, pack, ctx) * powerMult(squadItems, m.character.place) };
    }
    return { ...m, power: m.power ?? m.share * units };
  });
  const summonPower = summons.reduce((n, m) => n + m.power, 0);
  const whistles = placed.filter((x) => x.u.items.includes("Trailblaze's Whistle")).length;
  const express = expressPower(s, av, whistles);
  const robot = robotFor(s, kind);
  const robotBonus = robot ? (robot.mult / 100) * Math.max(1, Math.floor(((av ?? 150) * robot.spd) / 10000)) * 0.01 : 0;
  const power = (units + summonPower + elationPower) * (1 + express.bonus + robotBonus + elation.repellency * 0.5);
  return { raw, bonus, power, bonds, idle, per, summons, effects, kits: kits.map(({ x, k }) => ({ uid: x.u.uid, name: x.u.name, kit: k })), express, robot: robot ? { ...robot, bonus: robotBonus } : null, store, rollCall7, squadItems, elation, elationPower, ahaStar: aStar };
}

/** Average strength of a cost at a (fractional) star level, from the pack's character pages. */
function avgStrength(pack: CwPack, cost: number, star: number): number {
  const infos = Object.values(pack.info ?? {}).filter((i) => i.cost === cost);
  const at = (k: number) => (infos.length ? infos.reduce((n, i) => n + Math.max(i.onField[k] ?? 0, i.offField[k] ?? 0) * (1 + ((i.hp[k] ?? 0) / 100) * MODEL.hpWeight), 0) / infos.length : (STRENGTH_FALLBACK[cost] ?? STRENGTH_FALLBACK[1])[k]);
  const lo = Math.min(2, Math.floor(star - 1)), hi = Math.min(2, lo + 1), f = star - 1 - lo;
  return at(lo) * (1 - f) + at(hi) * f;
}

/** Enemy strength for a node: what a typical board at that point would have, scaled by difficulty. */
export function enemyPower(s: RunState, pack: CwPack, kind: NodeKind = nodeKind(s)): number {
  const g = globalIndex(s.plane, s.node);
  const bosses = [0, ...RULES.planes.map((_, p) => globalIndex(p, RULES.planes[p].length - 1))];
  const seg = Math.max(0, bosses.findIndex((b, i) => i > 0 && g <= b) - 1);
  const t = (g - bosses[seg]) / Math.max(1, bosses[seg + 1] - bosses[seg]);
  const level = MODEL.levelCurve[seg] + (MODEL.levelCurve[seg + 1] - MODEL.levelCurve[seg]) * t;
  const star = 1 + 0.9 * (g / (totalNodes - 1));
  const odds = pack.odds.find((o) => o.level === Math.round(level))?.odds ?? [1, 0, 0, 0, 0];
  const unit = odds.reduce((n, p, c) => n + p * avgStrength(pack, c + 1, star), 0);
  const kindMult: Record<NodeKind, number> = { Reward: 0.3, Strategy: 0.95, Combat: 0.95, Supply: 0, Encounter: s.encounter === "hard" ? (s.advantage?.includes("risk-hedging") ? 1.15 : ASSUMED.encounter.hard.power) : ASSUMED.encounter.easy.power, Boss: 1.15 };
  const third = kind === "Combat" && nodeKinds(s.plane, s).lastIndexOf("Combat") === s.node ? 1.1 : 1;
  const rankStep = pack.difficulty?.find((d) => d.id === s.rank);
  const hpBoost = rankStep?.planes[s.plane]?.hp ?? 0;
  const diff = (1 + hpBoost / 100) ** 0.2 * (1 + 0.03 * s.extraDifficulty);
  const elite = kind === "Combat" && nodeKinds(s.plane, s).lastIndexOf("Combat") === s.node;
  const companion = s.escapade ? (s.escapade.enemyMult ?? 1) * (s.escapade.variant === "bw-weaken" && elite ? ESCAPADE_ASSUMED.weakenedMult : 1) : 1;
  return level * unit * 1.15 * kindMult[kind] * third * diff * MODEL.enemyScale * companion;
}

export const winChance = (power: number, enemy: number) => (enemy <= 0 ? 1 : 1 / (1 + Math.exp(-MODEL.steepness * (power / enemy - 1))));

/** Fight the current node, then pay out gold and XP. */
export function battle(s0: RunState, pack: CwPack): RunState {
  if (s0.phase !== "prep") return s0;
  if (!deployed(s0).length) return note(s0, "Deploy at least one character first.");
  const [s1, rng] = step(s0);
  let s = s1;
  const kind = nodeKind(s);
  const tp = teamPower(s, pack);
  const { power } = tp;
  // Bubble Wolf's Trotters (own RNG stream, so other rolls stay the same).
  const trotterRng = createRng(`${s.seed}:trotter:${s.tick}`);
  const trotter = enemyMods(s, kind, false, trotterRng).trotter || (!!s.advantage?.includes("fauna") && kind !== "Boss" && kind !== "Reward" && trotterRng() < 0.15);
  const enemy = enemyPower(s, pack, kind) * (trotter ? ESCAPADE_ASSUMED.trotterMult : 1);
  const chance = kind === "Reward" ? 1 : winChance(power, enemy);
  let won = kind === "Reward" || rng() < chance;
  // Woof Woof Dan: the first failed fight (per plane, or from a plane on) becomes a Perfect Clear.
  const saved = !won && woofSave(s);
  if (saved) { won = true; s = spendWoofSave(s); }
  const boss = kind === "Boss";
  const base = RULES.hpLoss[s.plane][boss ? 1 : 0];
  const cleared = won ? 1 : Math.max(0.05, Math.min(0.95, (power / Math.max(1, enemy)) * 0.9));
  const hpLost = won ? 0 : Math.round((base + Math.round((1 - cleared) * base)) * (s.advantage?.includes("safety") ? 0.9 : 1));
  const streak = kind === "Reward" ? s.streak : won ? s.streak + 1 : 0;
  const interest = Math.min(s.interestCap, Math.floor(s.gold / RULES.interestPer));
  const adv = s.advantage ?? [];
  let streakGold: number = won && kind !== "Reward" ? ASSUMED.streakBonus[Math.min(streak, ASSUMED.streakBonus.length - 1)] : 0;
  if (adv.includes("fauna") && streak >= 6 && won) streakGold = Math.max(streakGold, 4);
  if (adv.includes("claims") && kind !== "Reward" && streak === 0) streakGold = Math.max(streakGold, 1);
  let drops = 0, item: string | undefined;
  const ores: string[] = [];
  if (kind === "Reward") {
    drops = ASSUMED.rewardGold[0] + Math.floor(rng() * (ASSUMED.rewardGold[1] - ASSUMED.rewardGold[0] + 1));
    for (let k = 0; k < ASSUMED.rewardOres; k++) ores.push(randomOre(s.plane, rng));
    ores.push(...(s.pendingOres ?? []));
  }
  if (kind === "Encounter" && won && s.encounter) {
    const e = ASSUMED.encounter[s.encounter];
    drops = e.gold;
    if (e.item) item = randomBasic(pack, rng) ?? undefined;
  }
  const gold = { base: ASSUMED.baseIncome, streak: streakGold, interest, drops };
  const earned = gold.base + gold.streak + gold.interest + gold.drops;
  const oppData = pack.opponents?.find((o) => o.name === s.nodeOpponent);
  const enemies = !oppData ? [] : boss ? [oppData.bosses.join(" + ")] : kind === "Reward" ? ["Independent Venture"] : sample(rng, oppData.normals, 2).concat(nodeKinds(s.plane, s).lastIndexOf("Combat") === s.node ? sample(rng, oppData.elites, 1) : []);
  const placed = [...s.on.map((u) => ({ u, place: "on" as const })), ...s.off.map((u) => ({ u, place: "off" as const }))].filter((x): x is { u: Unit; place: "on" | "off" } => !!x.u && !x.u.npc);
  const perOf = (uid: number) => tp.per.find((p) => p.uid === uid);
  // Bond summons, the Astral Express and Mr. Yang's Belobog Robot fight alongside the squad (and show on the turn order).
  type Helper = { name: string; cost: number; stars: 1 | 2 | 3; power: number; place: "on" | "off"; spd: number; summon?: { emoji: string; bond: string; spd: number; note?: string; scripted?: boolean } };
  const helpers: Helper[] = [];
  const squad = tp.per.reduce((n, p) => n + p.power, 0);
  for (const m of tp.summons) {
    if (m.character) helpers.push({ name: m.character.name, cost: m.character.cost, stars: m.character.stars, power: m.power, place: m.character.place, spd: pack.info?.[m.character.name]?.spd?.[m.character.stars - 1] ?? 0 });
    else helpers.push({ name: m.name, cost: 3, stars: 1, power: m.power, place: "on", spd: 0, summon: { emoji: m.emoji, bond: m.bond, spd: m.spd, note: m.note } });
  }
  if (tp.express.bonus > 0) helpers.push({ name: "Astral Express", cost: 5, stars: 1, power: squad * tp.express.bonus, place: "on", spd: 0, summon: { emoji: "🚂", bond: "Trailblaze Silver Rail", spd: tp.express.spd, note: tp.express.spd ? `${tp.express.spd} SPD` : "crashes in at the start" } });
  if (tp.robot) helpers.push({ name: "Belobog Robot", cost: 4, stars: 1, power: squad * tp.robot.bonus, place: "on", spd: 0, summon: { emoji: "🤖", bond: "Mr. Yang", spd: tp.robot.spd, note: `${tp.robot.mult}% base DMG` } });
  // Elation: Aha takes part as an attacker; Elation Skills, Punchline and Certified Banger show in the fight.
  const el: ElationResult = tp.elation;
  let scripted: { t: number; ally: number; weight: number; text?: string; lucky?: boolean }[] = [];
  let notes: { t: number; kind: TlKind; text: string; punchline?: number; turn?: number }[] = [];
  if (el.active && kind !== "Reward") {
    const ahaIndex = placed.length + helpers.length;
    helpers.push({ name: "Aha", cost: 5, stars: (Math.max(1, tp.ahaStar) as 1), power: 1, place: "on", spd: 0, summon: { emoji: "🎭", bond: "Elation", spd: Math.round(el.ahaSpd), note: `${el.instants} Aha Instant${el.instants === 1 ? "" : "s"}`, scripted: true } });
    const idx = (uid?: number) => (uid === undefined ? ahaIndex : placed.findIndex((x) => x.u.uid === uid));
    scripted = el.events.filter((e) => (e.kind === "hit" || e.kind === "lucky") && (e.amount ?? 0) > 0).map((e) => ({ t: e.t, ally: idx(e.uid), weight: e.amount!, lucky: e.lucky })).filter((x) => x.ally >= 0);
    notes = el.events.filter((e) => e.kind !== "hit" && e.kind !== "lucky").map((e) => ({ t: e.t, kind: e.kind as TlKind, text: e.text, punchline: e.punchline, turn: e.kind === "aha" ? ahaIndex : e.kind === "elation" ? idx(e.uid) : undefined }));
    if (el.ore) ores.push(randomOre(s.plane, rng));
  }
  const foes = kind === "Boss" ? [{ name: enemies[0] ?? "Boss", boss: true }]
    : Array.from({ length: kind === "Reward" ? 4 : 5 + (nodeKinds(s.plane, s).lastIndexOf("Combat") === s.node ? 1 : 0) }, (_, k) => {
      const elite = kind !== "Reward" && nodeKinds(s.plane, s).lastIndexOf("Combat") === s.node && k >= 4;
      const list = elite ? oppData?.elites : oppData?.normals;
      return { name: list?.length ? list[k % list.length] : kind === "Reward" ? "Independent Venture" : "Enemy", elite };
    });
  const timeline = buildTimeline({
    allies: [...placed.map((x) => ({ name: x.u.name, cost: x.u.cost, stars: x.u.stars, power: perOf(x.u.uid)?.power ?? 0, place: x.place, spd: (pack.info?.[x.u.name]?.spd?.[x.u.stars - 1] ?? 0) + 100 * (perOf(x.u.uid)?.spd ?? 0) })), ...helpers],
    enemies: foes, waves: kind === "Boss" ? 1 : 2, won, cleared, ratio: power / Math.max(1, enemy),
    limit: kind === "Reward" ? null : RULES.actionValue[s.plane][boss ? 1 : 0], bossPhases: s.plane === 2 ? 3 : 2,
    reviveCost: (rankNumber(s.rank) >= 3 ? 35 : 15) - (s.advantage?.includes("action-recovery") ? 10 : 0),
    scripted, notes,
  }, rng);
  if (s.oreOnKill) for (let k = 0; k < timeline.kills; k++) if (rng() < s.oreOnKill) ores.push(randomOre(s.plane, rng));
  if (trotter && won) ores.push(oreName("Blue"));
  const report: BattleReport = { kind, won, chance, power, enemy, cleared, hpLost, gold, xp: ASSUMED.xpPerBattle, opponent: s.nodeOpponent, enemies, item, ores, timeline, saved, trotter, express: tp.express.collisions ? { collisions: tp.express.collisions, bonus: tp.express.bonus } : undefined,
    elation: el.active && kind !== "Reward" ? { instants: el.instants, ahaSpd: Math.round(el.ahaSpd), punchlineStart: el.punchlineStart, punchlinePeak: el.punchlinePeak, luckyStrikes: el.luckyStrikes, participants: el.participants, share: tp.power > 0 ? tp.elationPower / tp.power : 0, hiddenMmr: el.hiddenMmr } : undefined };
  s = {
    ...s, gold: s.gold + earned, hp: Math.max(0, s.hp - hpLost), streak, last: report, phase: "result",
    bag: [...s.bag, ...ores],
    pendingOres: kind === "Reward" ? [] : s.pendingOres,
    stats: { ...s.stats, goldEarned: s.stats.goldEarned + earned, interest: s.stats.interest + interest, wins: s.stats.wins + (won && kind !== "Reward" ? 1 : 0), losses: s.stats.losses + (won ? 0 : 1), bestStreak: Math.max(s.stats.bestStreak, streak) },
  };
  if (item) s = addBasics(s, [item]);
  s = levelUp(s, ASSUMED.xpPerBattle);
  if (kind !== "Reward") {
    // Trailblaze Power after each combat phase (and Fuel from Express crashes).
    const tsrLevel = tp.bonds.find((b) => b.bond.name === TSR_BOND)?.count ?? placedBondStates(s, pack).find((b) => b.bond.name === TSR_BOND)?.count ?? 0;
    s = afterCombat(s, pack, tsrLevel, tp.express.collisions);
    s = afterFight(s, won);
  }
  // Advantage Layout after-fight effects.
  // Safety first: at 0 HP the run is over unless the Safety Mechanism catches it; healing never revives.
  if (adv.includes("safety") && s.hp <= 0 && !(s.advantageUsed ?? []).includes("safety")) s = log({ ...s, hp: 1, advantageUsed: [...(s.advantageUsed ?? []), "safety"] }, "Safety Mechanism: squad HP stays at 1.");
  if (adv.includes("claims") && s.hp > 0 && s.hp < 50 && !(s.advantageUsed ?? []).includes("claims")) s = log({ ...s, gold: s.gold + 5, advantageUsed: [...(s.advantageUsed ?? []), "claims"] }, "Claims Settlement: +5 gold.");
  if (adv.includes("sustained-combat") && kind !== "Reward" && s.hp > 0) s = { ...s, hp: Math.min(RULES.startHp, s.hp + 2) };
  if (adv.includes("basic-armament") && kind === "Boss" && won && s.plane < 2) { const b = randomBasic(pack, rng); if (b) s = log({ ...s, bag: [...s.bag, b] }, `Basic Armament: ${b}.`); }
  if (adv.includes("victory") && kind === "Boss" && won && s.plane === RULES.planes.length - 1 && (timeline.end <= (timeline.limit ?? 0) - 100)) s = log({ ...s, hp: Math.min(RULES.startHp, s.hp + 40) }, "Victory Commendation: +40 squad HP.");
  if (kind !== "Reward") s = fireTriggers(s, pack, "combat", rng);
  if (kind === "Encounter") s = fireTriggers(s, pack, "encounter", rng);
  if (kind === "Boss") s = fireTriggers(s, pack, "boss", rng);
  s = log(s, `P${s.plane + 1}-${s.node + 1} ${kind}${s.nodeOpponent ? ` vs ${s.nodeOpponent}` : ""}${trotter ? " (Trotters!)" : ""}: ${won ? "cleared" : `not cleared (−${hpLost} HP)`} · +${earned} gold.`);
  const last = s.plane === RULES.planes.length - 1 && s.node === RULES.planes[s.plane].length - 1;
  if (s.hp <= 0) return log({ ...s, phase: "over", result: "defeated" }, "Squad HP hit 0. Run over.");
  if (last) return log({ ...s, phase: "over", result: "cleared" }, `Run cleared with ${s.hp} squad HP.`);
  return settle(s, pack);
}

/** Go to the next node (or plane). */
export function advance(s: RunState, pack: CwPack): RunState {
  if (s.phase === "over") return s;
  const lastNode = s.node >= RULES.planes[s.plane].length - 1;
  const next = lastNode ? { ...s, plane: s.plane + 1, node: 0 } : { ...s, node: s.node + 1 };
  return enterNode(lastNode ? log(next, `Plane ${next.plane + 1}.`) : next, pack);
}

export const nextNode = (s: RunState, pack: CwPack) => (s.phase === "result" ? advance(s, pack) : s);

// --------------------------------------------------------------------------------------------- summary

/** Expected Profit / Ultimate Game objectives (4.7) this run meets. They count only on a clear. */
export function objectives(s: RunState, pack: CwPack) {
  const line = deployed(s);
  const advanced = line.reduce((n, u) => n + u.items.filter((i) => itemKind(pack, i) === "advanced").length, 0);
  return [
    { label: "Reach Lv. 10", done: s.level >= 10 },
    { label: "Earn a total of 400 Gold Coins", done: s.stats.goldEarned >= 400, value: `${s.stats.goldEarned}/400` },
    { label: "Total lineup value reaches 100 Gold Coins", done: lineupValue(s) >= 100, value: `${lineupValue(s)}/100` },
    { label: "Characters hold 12 advanced equipment", done: advanced >= 12, value: `${advanced}/12` },
    { label: "A 3-star 5-cost character in your lineup", done: line.some((u) => u.stars === 3 && u.cost === 5) },
    { label: "Six 3-star characters in your lineup", done: line.filter((u) => u.stars === 3).length >= 6, value: `${line.filter((u) => u.stars === 3).length}/6` },
  ];
}

export const rankGain = (s: RunState) => (s.result === "cleared" ? RULES.rankGain(s.hp) : 0);
export { costOf };
