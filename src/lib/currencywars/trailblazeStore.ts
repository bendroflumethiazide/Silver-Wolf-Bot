/**
 * "Trailblaze Silver Rail" Bond: Trailblaze Power (TP) and the Trailblaze Store (Version 4.7).
 *
 * VERIFIED (HSR Wiki, "Currency Wars: Voyage Into the Canvas/Bonds" → Trailblaze Store):
 *  - After each combat phase the Bond accumulates TP: 20/45/75/125/225 at Bond levels 2/4/6/8/10.
 *  - Level 4 and 6: "Goods become better"; level 6: "Bond-exclusive Components appear".
 *  - Level 10: obtain 500 TP and unlock "Astral Express, Forward IV". Consuming 500 TP in total unlocks King Pom-Pom.
 *  - Express Enhancement prices rise by 40 per purchase; Express Component prices rise by 60 per purchase.
 *  - Every good's name, description and listed cost.
 * PROVISIONAL (TSR_ASSUMED): which level unlocks each good (apart from the above), the number of stock
 * slots and when stock rolls over, that "Others" goods cost Gold Coins, the Perfect Projector's
 * price (none listed), and how the Express turns into strength in this simulator's combat model.
 */
import { gain, log, makeUnit, note, step, units, type RunState } from "./run";
import { createRng } from "../warp/simulator";
import type { CwPack } from "./sim";

export const TSR_BOND = "Trailblaze Silver Rail";

export const TSR_RULES = {
  /** Bond level (characters) → TP after each combat phase. */
  income: [[2, 20], [4, 45], [6, 75], [8, 125], [10, 225]] as [number, number][],
  levelTenGrant: 500,
  pomPomAfterConsumed: 500,
  enhancementStep: 40,
  componentStep: 60,
} as const;

export const TSR_ASSUMED = {
  /** Rotating goods offered at once. */
  stockSlots: 6,
  /** "Refresh All" costs 1; its currency (and that of the TP goods) isn't shown in text, assumed Gold. */
  refreshAllCost: 1,
  perfectProjectorCost: 150,
  /** Express → strength: each 100% of base DMG it deals adds this share of team strength. */
  expressPer100: 0.01,
  expressCap: 1.5,
  /** Light Rail (30% per stack, verified) is up for about half a fight on average. */
  lightRailUptime: 0.5,
  /** Strength from the store's stat bonuses: Lucky Strike counts at its base 100% DMG; Mitigation at half. */
  mitigationWeight: 0.5,
} as const;

export type StatKey = "on" | "off" | "dmgAmp" | "mitigation" | "lucky" | "spd";
export type GoodType = "express" | "enhancement" | "stat" | "character" | "consumable" | "component" | "other";

export interface TsrGood {
  id: string;
  name: string;
  type: GoodType;
  /** Listed cost (enhancement/component prices then rise per purchase). */
  cost: number;
  currency: "tp" | "gold";
  text: string;
  /** Bond level (characters) needed to see it. */
  minLevel: number;
  /** True when the wiki states the unlock level; otherwise it's a guess. */
  levelVerified: boolean;
  costVerified: boolean;
  stat?: [StatKey, number];
  character?: string;
  item?: string;
  tpGain?: number;
}

const STAT_TEXT: Record<StatKey, string> = { on: "On-Field Strength", off: "Off-Field Strength", dmgAmp: "DMG Amplification", mitigation: "DMG Mitigation", lucky: "Lucky Strike Rate", spd: "Speed Amplification" };
const ROMAN = ["I", "II", "III", "IV"];
const statGoods = (key: StatKey, values: number[], costs: number[], from = 0): TsrGood[] => values.map((v, i) => ({
  id: `${key}-${i + from + 1}`, name: `${STAT_TEXT[key]} ${ROMAN[i + from]}`, type: "stat" as const, cost: costs[i], currency: "tp" as const,
  text: `${STAT_TEXT[key]} increases by ${v}%.`, minLevel: [2, 4, 6, 8][i + from], levelVerified: false, costVerified: true, stat: [key, v] as [StatKey, number],
}));

export const TSR_GOODS: TsrGood[] = [
  { id: "warp", name: "Astral Express, warp!", type: "express", cost: 0, currency: "tp", minLevel: 2, levelVerified: true, costVerified: true, text: "At the start of battle, summons the \"Astral Express\" to crash into all enemy targets, dealing 250% Imaginary base DMG." },
  { id: "forward2", name: "Astral Express, Forward II", type: "express", cost: 10, currency: "tp", minLevel: 4, levelVerified: false, costVerified: true, text: "Summons the \"Astral Express\" with 300 SPD. When taking action, it strikes all enemies, dealing Imaginary base DMG. The DMG multiplier is 250% + (2.5% × total \"Trailblaze Power\" consumed)." },
  { id: "forward3", name: "Astral Express, Forward III", type: "express", cost: 10, currency: "tp", minLevel: 6, levelVerified: false, costVerified: true, text: "Summons the \"Astral Express\" with 300 SPD. When taking action, it strikes all enemies, dealing Imaginary base DMG. The DMG multiplier is 400% + (2.5% × total \"Trailblaze Power\" consumed)." },
  { id: "forward4", name: "Astral Express, Forward IV", type: "express", cost: 0, currency: "tp", minLevel: 10, levelVerified: true, costVerified: true, text: "Summons the \"Astral Express\" with 999 SPD. When taking action, it strikes all enemies, dealing Imaginary base DMG. The DMG multiplier is 5,000% + (5.0% × total \"Trailblaze Power\" consumed)." },
  { id: "fuel", name: "Express Enhancement: Fuel", type: "enhancement", cost: 40, currency: "tp", minLevel: 4, levelVerified: false, costVerified: true, text: "Express crashes generate 5 \"Trailblaze Power,\" which can be used for purchases in the Silver Rail Store." },
  { id: "rail", name: "Express Enhancement: Light Rail", type: "enhancement", cost: 40, currency: "tp", minLevel: 4, levelVerified: false, costVerified: true, text: "\"Light Rail\": Increases the ally squad's On/Off-Field Strength by 30%. Provides 1 stack of \"Light Rail\" after an Express collision. Increases the max stack limit of \"Light Rail\" by 2." },
  { id: "spdboost", name: "Express Enhancement: SPD Boost", type: "enhancement", cost: 40, currency: "tp", minLevel: 4, levelVerified: false, costVerified: true, text: "The Express's SPD increases by 200." },
  ...statGoods("on", [5, 10, 15, 75], [15, 30, 50, 100]),
  ...statGoods("off", [5, 10, 15, 75], [15, 30, 50, 100]),
  ...statGoods("dmgAmp", [30], [100], 3),
  ...statGoods("mitigation", [30], [100], 3),
  ...statGoods("lucky", [2, 4, 6, 30], [15, 30, 50, 100]),
  ...statGoods("spd", [2, 4, 6, 30], [15, 30, 50, 100]),
  ...([["Welt", 15, 2], ["March 7th (The Hunt)", 15, 2], ["Sunday", 35, 2], ["Trailblazer (Elation)", 50, 4], ["Himeko • Nova", 75, 4], ["Dan Heng • Imbibitor Lunae", 100, 6], ["King Pom-Pom", 100, 2]] as [string, number, number][])
    .map(([name, cost, minLevel]): TsrGood => ({ id: `char-${name}`, name, type: "character", cost, currency: "tp", minLevel, levelVerified: false, costVerified: true, character: name,
      text: name === "King Pom-Pom" ? "A 1-star King Pom-Pom. Unlocked after consuming 500 Trailblaze Power in total." : `A 1-star ${name}.` })),
  { id: "staff", name: "Trailblaze: Staff Projector", type: "consumable", cost: 30, currency: "tp", minLevel: 2, levelVerified: false, costVerified: true, item: "Trailblaze: Staff Projector", text: "Drag onto a 3-Cost or lower \"Trailblaze Silver Rail\" character to use, creating a 1-star copy of this character in the preparation area." },
  { id: "perfect", name: "Trailblaze: Perfect Projector", type: "consumable", cost: TSR_ASSUMED.perfectProjectorCost, currency: "tp", minLevel: 8, levelVerified: false, costVerified: false, item: "Trailblaze: Perfect Projector", text: "Drag onto any \"Trailblaze Silver Rail\" character to use, creating a 1-star copy of this character in the preparation area." },
  ...["Overload Energy Module", "Evolution Modification Module", "Navigator's Banner", "Cloud-Piercer Thunder", "Nameless Proof", "Trailblaze's Whistle"]
    .map((item): TsrGood => ({ id: `comp-${item}`, name: item, type: "component", cost: 100, currency: "tp", minLevel: 6, levelVerified: true, costVerified: true, item, text: "Bond-exclusive Component (see item details)." })),
  { id: "tp30", name: "Trailblaze Power: 30", type: "other", cost: 1, currency: "gold", minLevel: 2, levelVerified: false, costVerified: true, tpGain: 30, text: "Immediately obtains 30 Trailblaze Power." },
  { id: "tp60", name: "Trailblaze Power: 60", type: "other", cost: 1, currency: "gold", minLevel: 4, levelVerified: false, costVerified: true, tpGain: 60, text: "Immediately obtains 60 Trailblaze Power." },
];
export const tsrGood = (id: string) => TSR_GOODS.find((g) => g.id === id);

export interface TsrState {
  /** Trailblaze Power held. */
  tp: number;
  /** Total TP spent (Express multiplier; King Pom-Pom unlock at 500). */
  consumed: number;
  /** Total TP received. */
  earned: number;
  /** Rotating goods (ids; "" = sold). */
  stock: string[];
  /** Highest Bond level reached (for "goods became better" notices). */
  best: number;
  /** 0 none, 1 warp, 2–4 Forward II–IV. */
  express: number;
  enh: { fuel: number; rail: number; spd: number };
  components: number;
  stats: Partial<Record<StatKey, number>>;
  /** Purchases in order. */
  history: { tick: number; id: string; name: string; cost: number; currency: "tp" | "gold" }[];
  levelTen: boolean;
  /** "Full Speed Trailblaze": the Express deals this multiple of its DMG. */
  expressMult?: number;
}

export const emptyTsr = (): TsrState => ({ tp: 0, consumed: 0, earned: 0, stock: [], best: 0, express: 0, enh: { fuel: 0, rail: 0, spd: 0 }, components: 0, stats: {}, history: [], levelTen: false });
export const tsrOf = (s: RunState): TsrState => s.tsr ?? emptyTsr();

/** TP per combat phase at a Bond level (from the pack's Bond text when it parses, else the verified table). */
export function tsrIncome(pack: CwPack, level: number): number {
  const bond = pack.bonds.find((b) => b.name === TSR_BOND);
  const fromPack = bond?.levels.map((l) => [l.count, Number(/(\d+) "?Trailblaze Power/.exec(l.effect)?.[1] ?? NaN)] as [number, number]).filter(([, v]) => !Number.isNaN(v));
  const table = fromPack?.length ? fromPack : TSR_RULES.income;
  return table.filter(([c]) => c <= level).reduce((n, [, v]) => Math.max(n, v), 0);
}

/** Current price of a good (Express Enhancements +40 and Components +60 per purchase). */
export function priceOf(t: TsrState, g: TsrGood): number {
  if (g.type === "enhancement") return g.cost + TSR_RULES.enhancementStep * (t.enh.fuel + t.enh.rail + t.enh.spd);
  if (g.type === "component") return g.cost + TSR_RULES.componentStep * t.components;
  return g.cost;
}

/** Why a good can't be bought right now, or null. */
export function goodLock(t: TsrState, g: TsrGood, level: number): string | null {
  if (level < g.minLevel) return `Bond level ${g.minLevel}`;
  if (g.character === "King Pom-Pom" && t.consumed < TSR_RULES.pomPomAfterConsumed) return `Consume ${TSR_RULES.pomPomAfterConsumed} TP (${t.consumed} so far)`;
  if (g.type === "express") {
    const order = ["warp", "forward2", "forward3", "forward4"].indexOf(g.id) + 1;
    if (t.express >= order) return "Owned";
    if (g.id === "forward4") return "Unlocks at Bond level 10";
    if (t.express < order - 1) return order === 3 ? "Needs Forward II" : "Needs the Express";
  }
  return null;
}

/** Goods the rotating stock draws from at a Bond level. */
function stockPool(pack: CwPack, t: TsrState, level: number): TsrGood[] {
  const members = new Set(pack.bonds.find((b) => b.name === TSR_BOND)?.members ?? []);
  return TSR_GOODS.filter((g) => g.type !== "express" && g.type !== "enhancement" && !goodLock(t, g, level) && (!g.character || members.has(g.character)));
}

export function rollStock(pack: CwPack, t: TsrState, level: number, rng: () => number): string[] {
  const pool = stockPool(pack, t, level);
  if (!pool.length) return [];
  // Better goods weigh more as the Bond grows ("goods become better").
  const w = pool.map((g) => 1 + Math.max(0, g.minLevel - 2) * (level >= 4 ? 0.4 : 0));
  // Drawn without repeats while there are enough different goods.
  const out: string[] = [];
  const left = pool.map((g, i) => ({ g, w: w[i] }));
  for (let i = 0; i < TSR_ASSUMED.stockSlots; i++) {
    const from = left.length ? left : pool.map((g, k) => ({ g, w: w[k] }));
    let r = rng() * from.reduce((a, b) => a + b.w, 0);
    let k = 0;
    for (; k < from.length - 1; k++) { if (r < from[k].w) break; r -= from[k].w; }
    out.push(from[k].g.id);
    if (from === left) left.splice(k, 1);
  }
  return out;
}

/** Store actions are allowed while preparing. */
const open = (s: RunState) => s.phase === "prep";

export function buyTsr(s0: RunState, pack: CwPack, id: string, level: number, slot?: number): RunState {
  if (!open(s0)) return s0;
  const t0 = tsrOf(s0);
  const g = tsrGood(id);
  if (!g) return s0;
  if (slot !== undefined && t0.stock[slot] !== id) return s0;
  const lock = goodLock(t0, g, level);
  if (lock) return note(s0, `${g.name}: ${lock}.`);
  const price = priceOf(t0, g);
  if (g.currency === "tp" ? t0.tp < price : s0.gold < price) return note(s0, `${g.name} costs ${price} ${g.currency === "tp" ? "Trailblaze Power" : "gold"}.`);
  let [s] = step(s0);
  let t: TsrState = { ...t0, stock: [...t0.stock], stats: { ...t0.stats }, enh: { ...t0.enh } };
  if (g.character) {
    const ch = pack.characters.find((c) => c.name === g.character);
    const [s2, u] = makeUnit(s, g.character, ch?.cost ?? 1);
    const after = gain(s2, u);
    if (!after) return note(s0, "Your bench is full. Make room first.");
    s = after;
  } else if (g.item) s = { ...s, bag: [...s.bag, g.item] };
  else if (g.stat) t.stats[g.stat[0]] = (t.stats[g.stat[0]] ?? 0) + g.stat[1];
  else if (g.type === "express") t.express = ["warp", "forward2", "forward3", "forward4"].indexOf(g.id) + 1;
  else if (g.type === "enhancement") t.enh = { ...t.enh, [g.id === "spdboost" ? "spd" : g.id]: t.enh[g.id === "spdboost" ? "spd" : (g.id as "fuel" | "rail")] + 1 };
  if (g.type === "component") t.components += 1;
  if (g.currency === "tp") t = { ...t, tp: t.tp - price, consumed: t.consumed + price };
  else s = { ...s, gold: s.gold - price };
  if (g.tpGain) t = { ...t, tp: t.tp + g.tpGain, earned: t.earned + g.tpGain };
  if (slot !== undefined) t.stock[slot] = "";
  t.history = [...t.history, { tick: s0.tick, id, name: g.name, cost: price, currency: g.currency }];
  const unlockedPom = t0.consumed < TSR_RULES.pomPomAfterConsumed && t.consumed >= TSR_RULES.pomPomAfterConsumed;
  s = log({ ...s, tsr: t }, `Trailblaze Store: ${g.name} for ${price} ${g.currency === "tp" ? "TP" : "gold"}.`);
  return unlockedPom ? note(log(s, "Trailblaze Store: 500 TP consumed. King Pom-Pom unlocked!"), "King Pom-Pom is now in the Trailblaze Store.") : s;
}

/** "Refresh All": new stock. */
export function refreshTsr(s0: RunState, pack: CwPack, level: number): RunState {
  if (!open(s0)) return s0;
  if (level < 2) return note(s0, "The Trailblaze Store opens at Trailblaze Silver Rail level 2.");
  if (s0.gold < TSR_ASSUMED.refreshAllCost) return note(s0, `Refresh All costs ${TSR_ASSUMED.refreshAllCost} gold.`);
  const [s, rng] = step(s0);
  const t = tsrOf(s);
  return { ...s, gold: s.gold - TSR_ASSUMED.refreshAllCost, tsr: { ...t, stock: rollStock(pack, t, level, rng) } };
}

/** The Express in a fight: collisions and the strength it adds. */
export function expressPower(s: RunState, avLimit: number | null, whistles = 0) {
  const t = tsrOf(s);
  if (!t.express && !whistles) return { bonus: 0, collisions: 0, spd: 0, mult: 0, rail: 0 };
  const spd = t.express >= 4 ? 999 + 200 * t.enh.spd : t.express >= 2 ? 300 + 200 * t.enh.spd : 0;
  const mult = t.express >= 4 ? 5000 + 5 * t.consumed : t.express === 3 ? 400 + 2.5 * t.consumed : t.express === 2 ? 250 + 2.5 * t.consumed : 250;
  const av = avLimit ?? 150;
  const actions = t.express >= 2 ? Math.max(1, Math.floor((av * spd) / 10000)) : t.express === 1 ? 1 : 0;
  const collisions = actions + whistles;
  const railCap = 2 * (t.enh.rail + whistles);
  const rail = Math.min(railCap, collisions);
  const bonus = Math.min(TSR_ASSUMED.expressCap, (mult / 100) * (t.expressMult ?? 1) * collisions * TSR_ASSUMED.expressPer100) + 0.3 * rail * TSR_ASSUMED.lightRailUptime;
  return { bonus, collisions, spd, mult, rail };
}

/** Team-wide shares from bought stats (On-/Off-Field are per position). */
export function storeStats(s: RunState) {
  const st = tsrOf(s).stats;
  const pct = (k: StatKey) => (st[k] ?? 0) / 100;
  return { on: pct("on"), off: pct("off"), team: pct("dmgAmp") + pct("lucky") + pct("spd") + pct("mitigation") * TSR_ASSUMED.mitigationWeight, spd: pct("spd") };
}

/** After a combat phase: TP income, Fuel from Express crashes, and new stock. */
export function afterCombat(s: RunState, pack: CwPack, level: number, collisions: number): RunState {
  const t0 = tsrOf(s);
  const income = level >= 2 ? tsrIncome(pack, level) : 0;
  const fuel = 5 * t0.enh.fuel * collisions;
  if (!income && !fuel && !s.tsr) return s;
  const gainTp = income + fuel;
  const rng = createRng(`${s.seed}:tsr:${s.tick}`);
  const t = { ...t0, tp: t0.tp + gainTp, earned: t0.earned + gainTp, stock: level >= 2 ? rollStock(pack, t0, level, rng) : t0.stock };
  return gainTp ? log({ ...s, tsr: t }, `Trailblaze Power +${income}${fuel ? ` (+${fuel} Fuel)` : ""} → ${t.tp}.`) : { ...s, tsr: t };
}

/** Overload Energy Module: TP on entering a node, by King Pom-Pom's stars. */
export function nodeTp(s: RunState): RunState {
  const gainTp = units(s).filter((u) => u.name === "King Pom-Pom" && u.items.includes("Overload Energy Module")).reduce((n, u) => n + [10, 20, 100][u.stars - 1], 0);
  if (!gainTp) return s;
  const t = tsrOf(s);
  return log({ ...s, tsr: { ...t, tp: t.tp + gainTp, earned: t.earned + gainTp } }, `Overload Energy Module: +${gainTp} Trailblaze Power.`);
}

/** Bond level changes: open the store, "goods become better", and the level-10 grant (once). */
export function syncTsrLevel(s: RunState, pack: CwPack, level: number): RunState {
  const t0 = s.tsr;
  if (!t0 && level < 2) return s;
  const t = t0 ?? emptyTsr();
  let out = s;
  let next = t;
  if (level > t.best) {
    next = { ...next, best: level };
    const msgs: string[] = [];
    if (t.best < 2 && level >= 2) msgs.push("Trailblaze Store open. Astral Express, all aboard!");
    if (t.best < 4 && level >= 4) msgs.push("Trailblaze Store: goods became better.");
    if (t.best < 6 && level >= 6) msgs.push("Trailblaze Store: Bond-exclusive Components appear.");
    if (!next.stock.length && level >= 2) next = { ...next, stock: rollStock(pack, next, level, createRng(`${s.seed}:tsr-open:${s.tick}`)) };
    if (msgs.length) out = note(log(out, msgs.join(" ")), msgs.join(" "));
  }
  if (level >= 10 && !next.levelTen) {
    next = { ...next, levelTen: true, tp: next.tp + TSR_RULES.levelTenGrant, earned: next.earned + TSR_RULES.levelTenGrant, express: 4 };
    out = note(log(out, "Trailblaze Silver Rail 10: +500 Trailblaze Power and Astral Express, Forward IV!"), "Express evolution! +500 TP, Forward IV unlocked.");
  }
  return next === t && t0 ? out : { ...out, tsr: next };
}
