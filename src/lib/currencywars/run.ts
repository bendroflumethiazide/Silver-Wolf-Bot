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
import type { BondTier, CwAdvancedItem, CwCharInfo, CwNamed, CwStrategy, StrategyRarity } from "./parse";
import { combineResult, emblemBond, goldOreName, isOre, itemKind, ORE_DROP_ODDS, ORE_REWARDS, ORE_TIERS, oreGold, oreName, oreTier, type OreTier } from "./items";
import { boardBonds, bondVariants, copiesFor, rollShop, withVariants, type CwPack } from "./sim";
import { buildTimeline, type Timeline } from "./timeline";

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
  bond: { bronze: 0.08, silver: 0.12, gold: 0.18, plat: 0.25 } as Record<BondTier, number>,
  basicItem: 0.05,
  /** An Emblem's own stats (its Bond is counted separately). */
  emblemItem: 0.08,
  advancedItem: 0.15,
  /** Extra for an advanced item the wiki lists as good on that character. */
  recommended: 0.1,
  /** How much the HP bonus counts toward strength. */
  hpWeight: 0.5,
  /** Win chance = 1 / (1 + e^(-steepness × (ratio − 1))). */
  steepness: 6,
  enemyScale: 0.66,
  /** Expected player level at the start, at each plane's boss. */
  levelCurve: [3, 6, 8, 9],
} as const;

export interface Unit { uid: number; name: string; cost: number; stars: 1 | 2 | 3; items: string[] }
export interface ShopSlot { name: string; cost: number; stars: 1 | 2 }
export type Zone = "on" | "off" | "bench";
export interface Spot { zone: Zone; index: number }
export type Phase = "environment" | "strategy" | "supply" | "encounter" | "prep" | "result" | "over";

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
  locked: boolean;
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
  offers: { environments?: CwNamed[]; strategies?: CwStrategy[]; supply?: { name: string; cost: number; item: string }[] };
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
  nextUid: number;
  result: "cleared" | "defeated" | null;
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
function step(s: RunState): [RunState, () => number] {
  const next = { ...s, tick: s.tick + 1, note: null };
  return [next, createRng(`${s.seed}:${s.tick}`)];
}

const log = (s: RunState, line: string): RunState => ({ ...s, log: [...s.log, line] });
const note = (s: RunState, text: string): RunState => ({ ...s, note: text });

export const nodeKinds = (plane: number) => RULES.planes[plane] ?? [];
export const totalNodes = RULES.planes.reduce((n, p) => n + p.length, 0);
export const globalIndex = (plane: number, node: number) => RULES.planes.slice(0, plane).reduce((n, p) => n + p.length, 0) + node;
const rankNumber = (rank: string) => Number(/^A(\d+)/.exec(rank)?.[1] ?? 0);

/** The node kind actually played (Encounters below Jade Steel are plain fights). */
export function nodeKind(s: Pick<RunState, "plane" | "node" | "rank">): NodeKind {
  const k = nodeKinds(s.plane)[s.node] ?? "Combat";
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

function makeUnit(s: RunState, name: string, cost: number, stars: 1 | 2 | 3 = 1, items: string[] = []): [RunState, Unit] {
  return [{ ...s, nextUid: s.nextUid + 1 }, { uid: s.nextUid, name, cost, stars, items }];
}

/** Put a unit in the first free bench slot (then merge). Fails when the bench is full and nothing merges. */
function gain(s: RunState, unit: Unit): RunState | null {
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
    const group = all.find((a) => a.u.stars < 3 && all.filter((b) => b.u.name === a.u.name && b.u.stars === a.u.stars).length >= 3);
    if (!group) break;
    const trio = all.filter((b) => b.u.name === group.u.name && b.u.stars === group.u.stars).slice(0, 3);
    const items = trio.flatMap((t) => t.u.items);
    const kept: Unit = { ...trio[0].u, stars: (trio[0].u.stars + 1) as 2 | 3, items: items.slice(0, RULES.itemsPerUnit) };
    const next = { ...state, on: [...state.on], off: [...state.off], bench: [...state.bench], bag: [...state.bag, ...items.slice(RULES.itemsPerUnit)] };
    for (const t of trio.slice(1)) next[t.spot.zone][t.spot.index] = null;
    next[trio[0].spot.zone][trio[0].spot.index] = kept;
    state = log(next, `${"★".repeat(kept.stars)} ${kept.name}: three copies merged.`);
  }
  if (trimBench && state.bench.length > RULES.benchSlots) {
    const bench = state.bench.filter((u, i) => u || i < RULES.benchSlots).slice(0, RULES.benchSlots);
    while (bench.length < RULES.benchSlots) bench.push(null);
    state = { ...state, bench };
  }
  return state;
}

function levelUp(s: RunState, xp: number): RunState {
  let { level, xp: cur } = s;
  cur += xp;
  while (level < ASSUMED.maxLevel && cur >= xpToNext(level)) { cur -= xpToNext(level); level++; }
  if (level >= ASSUMED.maxLevel) cur = 0;
  const out = { ...s, level, xp: cur };
  return level > s.level ? log(out, `Level ${level}: you can deploy ${ASSUMED.teamSize(level)}.`) : out;
}

function rollShopSlots(s: RunState, pack: CwPack, rng: () => number): ShopSlot[] {
  const owned3 = new Set(units(s).filter((u) => u.stars === 3).map((u) => u.name));
  return rollShop(pack.odds, s.level, shopRoster(pack), rng, RULES.shopSlots, owned3)
    .map((c) => ({ name: c.name, cost: c.cost, stars: s.twoStarShop && rng() < ASSUMED.twoStarShop ? 2 : 1 }));
}

const basicNames = (pack: CwPack) => pack.equipment?.basic.map((b) => b.name) ?? [];
const randomBasic = (pack: CwPack, rng: () => number) => { const b = basicNames(pack); return b.length ? pickOne(rng, b) : null; };
const randomEmblem = (pack: CwPack, rng: () => number) => { const e = pack.equipment?.emblems ?? []; return e.length ? pickOne(rng, e).name : null; };
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
export function applyEffect(s: RunState, pack: CwPack, text: string, rng: () => number): [RunState, string[]] {
  let state = s;
  const applied: string[] = [];
  const addUnits = (n: number, cost: number, stars: 1 | 2 | 3) => {
    const pool = shopRoster(pack).filter((c) => c.cost === cost);
    for (let i = 0; i < n && pool.length; i++) {
      const c = pickOne(rng, pool);
      let u: Unit; [state, u] = makeUnit(state, c.name, c.cost, stars);
      state = gain(state, u) ?? state;
      applied.push(`${"★".repeat(stars)} ${c.name}`);
    }
  };
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
  // Only an unconditional grant ("Immediately obtains a Gold Crystal Ore"), not "a chance to obtain …".
  const giveOre = /(?:^|[.!]\s+)(?:Immediately )?obtains? an? (White|Blue|Gold|Prismatic) Crystal Ore/i.exec(text);
  if (giveOre) { state = { ...state, bag: [...state.bag, oreName(giveOre[1] as OreTier)] }; applied.push(oreName(giveOre[1] as OreTier)); }
  const named = /Obtains? (?:a|an|1) "([^"]+? Emblem)\.?"/i.exec(text);
  if (named && pack.equipment?.emblems?.some((e) => e.name === named[1])) { state = { ...state, bag: [...state.bag, named[1]] }; applied.push(named[1]); }
  const randEm = /(?:Gain|Obtains?) (?:a|(\d+)) random emblem/i.exec(text);
  let lastEmblem: string | null = null;
  if (randEm) {
    for (let i = 0; i < Number(randEm[1] ?? 1); i++) { const em = randomEmblem(pack, rng); if (em) { lastEmblem = em; state = { ...state, bag: [...state.bag, em] }; applied.push(em); } }
  }
  if (/Each time you enter a Boss Node, receive a random character with the corresponding Bond/i.test(text) && lastEmblem) {
    const bond = emblemBond(pack, lastEmblem);
    if (bond) { state = { ...state, dispatchBond: bond }; applied.push(`a ${bond} character at each Boss node`); }
  }
  const xpNode = /Gain (\d+) Experience whenever you enter a new Node/i.exec(text);
  if (xpNode) { state = { ...state, xpPerNode: state.xpPerNode + Number(xpNode[1]) }; applied.push(`+${xpNode[1]} XP each node`); }
  const forced = /All Investment Strategies in this round are of (Silver|Gold|Prismatic) quality/i.exec(text);
  if (forced) { state = { ...state, forcedRarity: forced[1] as StrategyRarity }; applied.push(`${forced[1]} strategies only`); }
  if (/2-star characters may appear in the Store/i.test(text)) { state = { ...state, twoStarShop: true }; applied.push("2-star characters in the shop"); }

  for (const sentence of text.split(/(?<=[.!])\s+/)) {
    if (CONDITIONAL.test(sentence.trim())) continue;
    const gold = /^(?:Instantly )?(?:gains?|obtains?) (\d+) Gold Coin/i.exec(sentence.trim()) ?? /\band (?:instantly )?gain (\d+) Gold Coin/i.exec(sentence);
    if (gold && !ore) { state = { ...state, gold: state.gold + Number(gold[1]) }; applied.push(`+${gold[1]} gold`); }
    const cap = /interest cap increases to (\d+)|maximum Interest is increased to (\d+)/i.exec(sentence);
    if (cap) { const v = Number(cap[1] ?? cap[2]); state = { ...state, interestCap: v }; applied.push(`interest cap ${v}`); }
    if (/You no longer gain Interest/i.test(sentence)) { state = { ...state, interestCap: 0 }; applied.push("no interest"); }
    const cheaper = /Reduce Experience cost by (\d+)/i.exec(sentence);
    if (cheaper) { state = { ...state, xpCost: Math.max(1, state.xpCost - Number(cheaper[1])) }; applied.push(`XP costs ${state.xpCost}`); }
    const free = /(?:Receives?|gains?|get) (\d+) free (?:Store )?refresh/i.exec(sentence);
    if (free) { state = { ...state, freeRefreshes: state.freeRefreshes + Number(free[1]) }; applied.push(`${free[1]} free refreshes`); }
    const chars = /(?:Obtains?|Gets?|Starts? with|Gains?) (?:(\d+) |an? )?random (?:(\d)-star )?(\d)-cost character/i.exec(sentence);
    if (chars) addUnits(Number(chars[1] ?? 1), Number(chars[3]), Number(chars[2] ?? 1) as 1 | 2 | 3);
    const boxes = /(\d+) "?Basic Weapon Box/i.exec(sentence);
    if (boxes) {
      for (let i = 0; i < Number(boxes[1]); i++) { const it = randomBasic(pack, rng); if (it) state = { ...state, bag: [...state.bag, it] }; }
      applied.push(`${boxes[1]} basic equipment`);
    }
  }
  return [state, applied];
}

// --------------------------------------------------------------------------------------------- run flow

export function newRun(pack: CwPack, seed: string, rank: string): RunState {
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
  if (!s.offers.environments?.length) s = enterNode(s, pack);
  for (const v of Object.values(s.variants ?? {})) s = log(s, `This run's rule: ${v}.`);
  return log(s, `Starting squad: ${units(s).map((u) => u.name).join(", ")}.`);
}

export function chooseEnvironment(s0: RunState, pack: CwPack, index: number): RunState {
  const env = s0.offers.environments?.[index];
  if (s0.phase !== "environment" || !env) return s0;
  const [s1, rng] = step(s0);
  const [s2, applied] = applyEffect({ ...s1, environment: env, offers: {} }, pack, env.effect, rng);
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
  if (!s.locked) s = { ...s, shop: rollShopSlots(s, pack, rng) };
  const opp = kind === "Boss" ? s.opponents[s.plane] ?? s.opponents[0] : s.opponents.length ? pickOne(rng, s.opponents) : "";
  s = { ...s, nodeOpponent: opp ?? "", encounter: null, last: null };
  if (kind === "Strategy") {
    const rarity: StrategyRarity = s.forcedRarity ?? (["Silver", "Gold", "Prismatic"] as const)[weighted(rng, [ASSUMED.strategyRarity.Silver, ASSUMED.strategyRarity.Gold, ASSUMED.strategyRarity.Prismatic])];
    const pool = (pack.strategies ?? []).filter((x) => x.rarity === rarity && x.planes.includes(s.plane + 1) && !s.strategies.some((o) => o.name === x.name));
    const offer = sample(rng, pool, RULES.strategyOffers);
    if (offer.length) return { ...s, phase: "strategy", offers: { strategies: offer } };
  }
  if (kind === "Supply") {
    const roster = shopRoster(pack);
    const offer = rollShop(pack.odds, s.level, roster, rng, RULES.supplyOffers).map((c) => ({ name: c.name, cost: c.cost, item: randomBasic(pack, rng) ?? "" }));
    if (offer.length) return { ...s, phase: "supply", offers: { supply: offer } };
  }
  if (kind === "Encounter") return { ...s, phase: "encounter", offers: {} };
  return { ...s, phase: "prep", offers: {} };
}

export function pickStrategy(s0: RunState, pack: CwPack, index: number): RunState {
  const st = s0.offers.strategies?.[index];
  if (s0.phase !== "strategy" || !st) return s0;
  const [s1, rng] = step(s0);
  const [s2, applied] = applyEffect({ ...s1, strategies: [...s1.strategies, st], extraDifficulty: s1.extraDifficulty + RULES.strategyDifficulty[st.rarity] }, pack, st.effect, rng);
  return log({ ...s2, phase: "prep", offers: {} }, `${st.rarity} strategy: ${st.name}${applied.length ? ` (${applied.join(", ")})` : " (effect not simulated)"}.`);
}

/** Supply node: take one character with the basic item they carry, then move on (no battle). */
export function pickSupply(s0: RunState, pack: CwPack, index: number): RunState {
  const o = s0.offers.supply?.[index];
  if (s0.phase !== "supply" || !o) return s0;
  const [s, u] = makeUnit(step(s0)[0], o.name, o.cost);
  const after = gain(s, u);
  if (!after) return note(s0, "Your bench is full. Sell someone first, or skip.");
  return advance(log({ ...after, bag: o.item ? [...after.bag, o.item] : after.bag, offers: {} }, `Supply: ${o.name}${o.item ? ` with ${o.item}` : ""}.`), pack);
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
  return { ...after, shop };
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
  return { ...s, gold: free ? s.gold : s.gold - RULES.refreshCost, freeRefreshes: free ? s.freeRefreshes - 1 : s.freeRefreshes, shop: rollShopSlots(s, pack, rng), stats: { ...s.stats, refreshes: s.stats.refreshes + 1 } };
}

export function buyXp(s0: RunState): RunState {
  if (s0.phase !== "prep") return s0;
  if (s0.level >= ASSUMED.maxLevel) return note(s0, "Already max level.");
  if (s0.gold < s0.xpCost) return note(s0, `Experience costs ${s0.xpCost} gold.`);
  const [s] = step(s0);
  return levelUp({ ...s, gold: s.gold - s.xpCost, stats: { ...s.stats, xpBought: s.stats.xpBought + 1 } }, ASSUMED.xpPerBuy);
}

export const toggleLock = (s: RunState): RunState => ({ ...s, locked: !s.locked });

/** Equip a bag item. A basic item on a unit holding a basic item combines into the advanced one. */
export function equip(s0: RunState, pack: CwPack, bagIndex: number, spot: Spot): RunState {
  const item = s0.bag[bagIndex];
  const u = at(s0, spot);
  if (!item || !u || s0.phase !== "prep") return s0;
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
  return made ? log(out, `${u.name}: ${item} combined into ${made}.`) : out;
}

/** Combine two items in the bag (basic + basic, gem + basic, gem + gem). */
export function combineBag(s0: RunState, pack: CwPack, i: number, j: number): RunState {
  const a = s0.bag[i], b = s0.bag[j];
  const r = a && b && i !== j && isComponent(pack, a) && isComponent(pack, b) ? combineResult(pack, a, b) : null;
  if (!r) return note(s0, "Those two don't combine.");
  const [s] = step(s0);
  return log({ ...s, bag: [...s.bag.filter((_, k) => k !== i && k !== j), r] }, `${a} + ${b} → ${r}.`);
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
    for (let k = 0; k < (r.basic ?? 0); k++) { const it = randomBasic(pack, rng); if (it) { s = { ...s, bag: [...s.bag, it] }; got.push(it); } }
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

/** One unit's strength in a position: wiki On-/Off-Field Strength at its star, HP bonus and items. */
export function unitPower(u: Unit, place: "on" | "off", pack: CwPack): number {
  const info: CwCharInfo | undefined = pack.info?.[u.name];
  const i = u.stars - 1;
  let base = info ? ((place === "on" ? info.onField : info.offField)[i] ?? 0) * (1 + ((info.hp[i] ?? 0) / 100) * MODEL.hpWeight) : (STRENGTH_FALLBACK[u.cost] ?? STRENGTH_FALLBACK[1])[i];
  if (!base) return 0;
  let mult = 1;
  for (const it of u.items) {
    const kind = itemKind(pack, it);
    if (kind === "basic") mult += MODEL.basicItem;
    else if (kind === "emblem") mult += MODEL.emblemItem;
    else if (kind === "gem") continue;
    else {
      mult += MODEL.advancedItem;
      if (pack.equipment?.advanced.find((a) => a.name === it)?.users.includes(u.name)) mult += MODEL.recommended;
    }
  }
  base *= mult;
  return base;
}

/** The season's bonds with this run's variant rules. */
export const runBonds = (s: Pick<RunState, "variants">, pack: CwPack) => withVariants(pack.bonds, s.variants);

export function teamPower(s: RunState, pack: CwPack) {
  const placed = [...s.on.map((u) => ({ u, place: "on" as const })), ...s.off.map((u) => ({ u, place: "off" as const }))].filter((x): x is { u: Unit; place: "on" | "off" } => !!x.u);
  const raw = placed.reduce((n, x) => n + unitPower(x.u, x.place, pack), 0);
  // An Emblem makes its wearer a member of that Bond (and counts toward it).
  const extra = new Map<string, string[]>();
  for (const x of placed) for (const it of x.u.items) { const b = emblemBond(pack, it); if (b) extra.set(b, [...(extra.get(b) ?? []), x.u.name]); }
  const bondList = runBonds(s, pack).map((b) => {
    const add = extra.get(b.name) ?? extra.get(b.name.replace(/: .*$/, "")) ?? [];
    return add.length ? { ...b, members: [...new Set([...b.members, ...add])] } : b;
  });
  const bonds = boardBonds(placed.map((x) => ({ name: x.u.name, stars: x.u.stars })), bondList).filter((b) => b.tier);
  const bonus = bonds.reduce((n, b) => n + MODEL.bond[b.tier!], 0);
  const idle = placed.filter((x) => unitPower(x.u, x.place, pack) === 0).map((x) => x.u.name);
  return { raw, bonus, power: raw * (1 + bonus), bonds, idle };
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
  const kindMult: Record<NodeKind, number> = { Reward: 0.3, Strategy: 0.95, Combat: 0.95, Supply: 0, Encounter: s.encounter === "hard" ? ASSUMED.encounter.hard.power : ASSUMED.encounter.easy.power, Boss: 1.15 };
  const third = kind === "Combat" && nodeKinds(s.plane).lastIndexOf("Combat") === s.node ? 1.1 : 1;
  const rankStep = pack.difficulty?.find((d) => d.id === s.rank);
  const hpBoost = rankStep?.planes[s.plane]?.hp ?? 0;
  const diff = (1 + hpBoost / 100) ** 0.2 * (1 + 0.03 * s.extraDifficulty);
  return level * unit * 1.15 * kindMult[kind] * third * diff * MODEL.enemyScale;
}

export const winChance = (power: number, enemy: number) => (enemy <= 0 ? 1 : 1 / (1 + Math.exp(-MODEL.steepness * (power / enemy - 1))));

/** Fight the current node, then pay out gold and XP. */
export function battle(s0: RunState, pack: CwPack): RunState {
  if (s0.phase !== "prep") return s0;
  if (!deployed(s0).length) return note(s0, "Deploy at least one character first.");
  const [s1, rng] = step(s0);
  let s = s1;
  const kind = nodeKind(s);
  const { power } = teamPower(s, pack);
  const enemy = enemyPower(s, pack, kind);
  const chance = kind === "Reward" ? 1 : winChance(power, enemy);
  const won = kind === "Reward" || rng() < chance;
  const boss = kind === "Boss";
  const base = RULES.hpLoss[s.plane][boss ? 1 : 0];
  const cleared = won ? 1 : Math.max(0.05, Math.min(0.95, (power / Math.max(1, enemy)) * 0.9));
  const hpLost = won ? 0 : base + Math.round((1 - cleared) * base);
  const streak = kind === "Reward" ? s.streak : won ? s.streak + 1 : 0;
  const interest = Math.min(s.interestCap, Math.floor(s.gold / RULES.interestPer));
  const streakGold = won && kind !== "Reward" ? ASSUMED.streakBonus[Math.min(streak, ASSUMED.streakBonus.length - 1)] : 0;
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
  const enemies = !oppData ? [] : boss ? [oppData.bosses.join(" + ")] : kind === "Reward" ? ["Independent Venture"] : sample(rng, oppData.normals, 2).concat(nodeKinds(s.plane).lastIndexOf("Combat") === s.node ? sample(rng, oppData.elites, 1) : []);
  const tp = teamPower(s, pack);
  const placed = [...s.on.map((u) => ({ u, place: "on" as const })), ...s.off.map((u) => ({ u, place: "off" as const }))].filter((x): x is { u: Unit; place: "on" | "off" } => !!x.u);
  const foes = kind === "Boss" ? [{ name: enemies[0] ?? "Boss", boss: true }]
    : Array.from({ length: kind === "Reward" ? 4 : 5 + (nodeKinds(s.plane).lastIndexOf("Combat") === s.node ? 1 : 0) }, (_, k) => {
      const elite = kind !== "Reward" && nodeKinds(s.plane).lastIndexOf("Combat") === s.node && k >= 4;
      const list = elite ? oppData?.elites : oppData?.normals;
      return { name: list?.length ? list[k % list.length] : kind === "Reward" ? "Independent Venture" : "Enemy", elite };
    });
  const timeline = buildTimeline({
    allies: placed.map((x) => ({ name: x.u.name, cost: x.u.cost, stars: x.u.stars, power: unitPower(x.u, x.place, pack) * (1 + tp.bonus), place: x.place, spd: pack.info?.[x.u.name]?.spd?.[x.u.stars - 1] ?? 0 })),
    enemies: foes, waves: kind === "Boss" ? 1 : 2, won, cleared, ratio: power / Math.max(1, enemy),
    limit: kind === "Reward" ? null : RULES.actionValue[s.plane][boss ? 1 : 0], bossPhases: s.plane === 2 ? 3 : 2,
    reviveCost: rankNumber(s.rank) >= 3 ? 35 : 15,
  }, rng);
  if (s.oreOnKill) for (let k = 0; k < timeline.kills; k++) if (rng() < s.oreOnKill) ores.push(randomOre(s.plane, rng));
  const report: BattleReport = { kind, won, chance, power, enemy, cleared, hpLost, gold, xp: ASSUMED.xpPerBattle, opponent: s.nodeOpponent, enemies, item, ores, timeline };
  s = {
    ...s, gold: s.gold + earned, hp: Math.max(0, s.hp - hpLost), streak, last: report, phase: "result",
    bag: [...s.bag, ...(item ? [item] : []), ...ores],
    pendingOres: kind === "Reward" ? [] : s.pendingOres,
    stats: { ...s.stats, goldEarned: s.stats.goldEarned + earned, interest: s.stats.interest + interest, wins: s.stats.wins + (won && kind !== "Reward" ? 1 : 0), losses: s.stats.losses + (won ? 0 : 1), bestStreak: Math.max(s.stats.bestStreak, streak) },
  };
  s = levelUp(s, ASSUMED.xpPerBattle);
  s = log(s, `P${s.plane + 1}-${s.node + 1} ${kind}${s.nodeOpponent ? ` vs ${s.nodeOpponent}` : ""}: ${won ? "cleared" : `not cleared (−${hpLost} HP)`} · +${earned} gold.`);
  const last = s.plane === RULES.planes.length - 1 && s.node === RULES.planes[s.plane].length - 1;
  if (s.hp <= 0) return log({ ...s, phase: "over", result: "defeated" }, "Squad HP hit 0. Run over.");
  if (last) return log({ ...s, phase: "over", result: "cleared" }, `Run cleared with ${s.hp} squad HP.`);
  return s;
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
