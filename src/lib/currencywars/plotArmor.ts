/**
 * Plot Armor (Version 4.7): protagonists, Plot Armor options, refreshes, the investments that change
 * them, Phantasmoon Games: Roll-Call and the Plot Armor Bonds.
 *
 * VERIFIED (HSR Wiki 4.7):
 *  - Two Plot Armor selections a run: one before the First Plane boss, one before the Second Plane boss
 *    ("Early Entrance": "The Plot Armor selection stage has been moved up to Nodes 1-6 and 2-4").
 *  - "Plot Armor Procurement": refresh cost fixed at 1 Gold Coin, plus 6 free Plot Armor refreshes.
 *  - "Refresh Chain" / "Refresh Chain+": 3 / 6 free Plot Armor refreshes, and each Plot Armor refresh
 *    gives 1 free Store refresh. "New Cast Performance": 1 chance to change the Protagonist + 10 free
 *    refreshes. "It's A Wrap": all protagonists' Plot Armor is disabled; gain as many chances to swap them out.
 *  - Advantage Layout "Plot Armor Selection": "the number of refreshes costing 1 Gold Coin(s) increases
 *    by 2", so the first paid refreshes cost 1 Gold Coin and later ones cost more.
 *  - Roll-Call (5): "Immediately gains 1 Imagenae: Plot Armor" (item "Phantasmoon: Plot Armor": "Drag
 *    onto a character to use. You can select Plot Armor 1 time."). Roll-Call (7): characters with Plot
 *    Armor gain 100% On-/Off-Field Strength and 50% SPD Amplification.
 *  - Plot Armor Bonds (Joint Follow-Up ATK, Four-Dimensional Frenzy, Star Hunt Oath, Deliverer,
 *    Apprenticeship) and their texts; options can raise enemy difficulty (achievement "Select a Plot
 *    Armor that increases enemy difficulty by 8"); Bubble Wolf makes "powerful" Plot Armor likelier.
 * PROVISIONAL (PLOT_ARMOR_CONFIG): when the default selection happens (at the boss node), how many paid
 * refreshes cost 1 Gold Coin and how the price rises after, the non-Bond option pool (the wiki has no
 * list) and how each option turns into strength.
 */
import { createRng } from "../warp/simulator";
import { oreName } from "./items";
import { deployed, gain, levelUp, log, makeUnit, nodeKinds, note, randomBasicName, randomEmblemName, step, type RunState, type Unit } from "./run";
import type { CwPack } from "./sim";

export const PLOT_ARMOR_RULES = {
  /** Planes (0-based) with a protagonist selection. */
  planes: [0, 1],
  firstPaidCost: 1,
  procurement: { cost: 1, free: 6 },
  rollCall: { imagenaeAt: 5, boostAt: 7, strength: 1, spd: 0.5 },
  bondCategory: "Plot Armor",
} as const;

export const PLOT_ARMOR_CONFIG = {
  /** Options shown at once. */
  options: 2,
  /** Paid refreshes that cost the first price (1 Gold Coin). */
  cheapRefreshes: 2,
  /** Price added per paid refresh after the cheap ones (2, 3, 4…). */
  escalation: 1,
  /** Chance an option is a "powerful" one (Bubble Wolf: boosted). */
  powerful: 0.2,
  powerfulBoosted: 0.55,
} as const;

export type PlotCategory = "character" | "bond" | "resource";
export interface PlotOption {
  id: string;
  name: string;
  category: PlotCategory;
  target: "protagonist" | "squad";
  duration: "run" | "instant";
  text: string;
  /** True for wiki-verified options (the Plot Armor Bonds); the rest are this simulator's stand-ins. */
  verified: boolean;
  powerful: boolean;
  /** Enemy difficulty it adds. */
  difficulty: number;
  /** Strength / SPD Amplification shares for the holder. */
  strength?: number;
  spd?: number;
  bond?: string;
}

const PROVISIONAL: PlotOption[] = [
  { id: "lead", name: "Leading Role", category: "character", target: "protagonist", duration: "run", text: "The protagonist's On-/Off-Field Strength increases by 40%.", verified: false, powerful: false, difficulty: 0, strength: 0.4 },
  { id: "spotlight", name: "Spotlight", category: "character", target: "protagonist", duration: "run", text: "The protagonist gains 25% SPD Amplification and 15% On-/Off-Field Strength.", verified: false, powerful: false, difficulty: 0, strength: 0.15, spd: 0.25 },
  { id: "lucky", name: "Lucky Break", category: "character", target: "protagonist", duration: "run", text: "The protagonist's Lucky Strike Rate increases by 20%.", verified: false, powerful: false, difficulty: 0, strength: 0.2 },
  { id: "star", name: "Star of the Show", category: "character", target: "protagonist", duration: "run", text: "The protagonist's On-/Off-Field Strength increases by 100%. Enemy difficulty +4.", verified: false, powerful: true, difficulty: 4, strength: 1 },
  { id: "twist", name: "Plot Twist", category: "character", target: "protagonist", duration: "instant", text: "The protagonist's star rating increases by 1 (up to 3). Enemy difficulty +8.", verified: false, powerful: true, difficulty: 8 },
  { id: "pay", name: "Opening Night Pay", category: "resource", target: "squad", duration: "instant", text: "Gain 12 Gold Coins.", verified: false, powerful: false, difficulty: 0 },
  { id: "rehearsal", name: "Rehearsal", category: "resource", target: "squad", duration: "instant", text: "Gain 16 Experience.", verified: false, powerful: false, difficulty: 0 },
  { id: "props", name: "Prop Room", category: "resource", target: "squad", duration: "instant", text: "Obtain 2 random basic equipment.", verified: false, powerful: false, difficulty: 0 },
  { id: "encore", name: "Encore", category: "resource", target: "squad", duration: "instant", text: "Obtain a Gold Crystal Ore.", verified: false, powerful: false, difficulty: 0 },
  { id: "fanmail", name: "Fan Mail", category: "resource", target: "squad", duration: "instant", text: "Obtain a random Emblem.", verified: false, powerful: false, difficulty: 0 },
  { id: "understudy", name: "Understudy", category: "resource", target: "protagonist", duration: "instant", text: "Obtain a 1-star copy of the protagonist.", verified: false, powerful: false, difficulty: 0 },
  { id: "boxoffice", name: "Box Office Hit", category: "resource", target: "squad", duration: "instant", text: "Obtain a Prismatic Crystal Ore. Enemy difficulty +3.", verified: false, powerful: true, difficulty: 3 },
];

/** Every option: the wiki's Plot Armor Bonds (from the pack) plus the provisional pool. */
export function plotOptions(pack: CwPack): PlotOption[] {
  const bonds = pack.bonds.filter((b) => b.category === PLOT_ARMOR_RULES.bondCategory).map((b): PlotOption => ({
    id: `bond:${b.name}`, name: b.name, category: "bond", target: "protagonist", duration: "run", verified: true, powerful: false, difficulty: 0, bond: b.name,
    text: `The protagonist joins "${b.name}". ${b.summary} ${b.levels.map((l) => `(${l.count}) ${l.effect}`).join(" ")}`.trim(),
  }));
  return [...bonds, ...PROVISIONAL];
}
export const optionById = (pack: CwPack, id: string) => plotOptions(pack).find((o) => o.id === id);

export interface Holder {
  uid: number;
  name: string;
  option: string;
  source: "protagonist" | "imagenae" | "swap";
  plane: number;
  disabled?: boolean;
}
export interface PlotHistory { tick: number; plane: number; kind: "select" | "refresh" | "change" | "swap" | "imagenae" | "disabled" | "free"; text: string; cost?: number; free?: string }
export interface PlotArmorState {
  holders: Holder[];
  /** Planes whose protagonist selection is done. */
  done: number[];
  /** Free Plot Armor refreshes by source (used oldest first). */
  free: { source: string; left: number }[];
  /** Paid refreshes this run (prices escalate). */
  paid: number;
  /** "Plot Armor Procurement": fixed price. */
  fixedCost?: number;
  /** "Refresh Chain": free Store refreshes per Plot Armor refresh. */
  storeChain: number;
  /** "Early Entrance": selection nodes [plane 1, plane 2] (0-based). */
  early?: [number, number];
  /** "New Cast Performance": chances to change the Protagonist. */
  changes: number;
  /** "It's A Wrap": chances to swap a protagonist out. */
  swaps: number;
  rollCall?: boolean;
  history: PlotHistory[];
  /** The selection in progress. */
  current?: { stage: "protagonist" | "imagenae" | "swap"; plane: number; uid?: number; options: string[]; refreshes: number };
}

export const emptyPlot = (): PlotArmorState => ({ holders: [], done: [], free: [], paid: 0, storeChain: 0, changes: 0, swaps: 0, history: [] });
export const plotOf = (s: RunState): PlotArmorState => s.plotArmor ?? emptyPlot();
const withPlot = (s: RunState, p: PlotArmorState): RunState => ({ ...s, plotArmor: p });
const hist = (p: PlotArmorState, s: RunState, h: Omit<PlotHistory, "tick" | "plane">): PlotArmorState => ({ ...p, history: [...p.history, { tick: s.tick, plane: s.plane, ...h }] });
export const freeLeft = (p: PlotArmorState) => p.free.reduce((n, f) => n + f.left, 0);

/** Node (0-based) where this plane's protagonist is chosen. Default: the Boss Node itself, before the fight. */
export function selectionNode(s: RunState, plane: number): number {
  const p = plotOf(s);
  if (p.early) return p.early[plane] ?? nodeKinds(plane, s).length - 1;
  return nodeKinds(plane, s).lastIndexOf("Boss");
}
export const selectionDue = (s: RunState) => (PLOT_ARMOR_RULES.planes as readonly number[]).includes(s.plane) && !plotOf(s).done.includes(s.plane) && s.node === selectionNode(s, s.plane);

/** The price of the next paid refresh. */
export function refreshPrice(p: PlotArmorState): number {
  if (p.fixedCost !== undefined) return p.fixedCost;
  const over = Math.max(0, p.paid - PLOT_ARMOR_CONFIG.cheapRefreshes + 1);
  return PLOT_ARMOR_RULES.firstPaidCost + over * PLOT_ARMOR_CONFIG.escalation;
}

function rollOptions(s: RunState, pack: CwPack, rng: () => number, avoid: string[] = []): string[] {
  const all = plotOptions(pack);
  const boosted = !!s.escapade?.powerfulPlot;
  const chance = boosted ? PLOT_ARMOR_CONFIG.powerfulBoosted : PLOT_ARMOR_CONFIG.powerful;
  const out: string[] = [];
  for (let k = 0; k < PLOT_ARMOR_CONFIG.options; k++) {
    const wantPowerful = rng() < chance;
    let pool = all.filter((o) => o.powerful === wantPowerful && !out.includes(o.id) && !avoid.includes(o.id));
    if (!pool.length) pool = all.filter((o) => !out.includes(o.id) && !avoid.includes(o.id));
    if (!pool.length) pool = all.filter((o) => !out.includes(o.id));
    if (pool.length) out.push(pool[Math.floor(rng() * pool.length)].id);
  }
  return out;
}

/** Start a selection (protagonist stage, an Imagenae item on `uid`, or an It's A Wrap swap). */
export function beginSelection(s: RunState, pack: CwPack, stage: "protagonist" | "imagenae" | "swap", uid?: number): RunState {
  const p = plotOf(s);
  const rng = createRng(`${s.seed}:plot:${s.tick}:${stage}`);
  const current = { stage, plane: s.plane, uid, options: uid !== undefined ? rollOptions(s, pack, rng) : [], refreshes: 0 };
  return { ...withPlot(s, { ...p, current }), phase: "plotArmor" };
}

/** Characters who can become a protagonist now (deployed, not already holding Plot Armor). */
export function eligible(s: RunState): Unit[] {
  const held = new Set(plotOf(s).holders.filter((h) => !h.disabled).map((h) => h.uid));
  return deployed(s).filter((u) => !u.npc && !held.has(u.uid));
}

export function chooseProtagonist(s0: RunState, pack: CwPack, uid: number): RunState {
  const p = plotOf(s0);
  if (s0.phase !== "plotArmor" || !p.current || p.current.uid !== undefined) return s0;
  if (!eligible(s0).some((u) => u.uid === uid)) return note(s0, "Pick a deployed character without Plot Armor.");
  const [s, rng] = step(s0);
  return withPlot(s, { ...p, current: { ...p.current, uid, options: rollOptions(s, pack, rng) } });
}

/** Refresh the two options: free refreshes first (oldest source first), then gold. */
export function refreshPlot(s0: RunState, pack: CwPack): RunState {
  const p0 = plotOf(s0);
  const cur = p0.current;
  if (s0.phase !== "plotArmor" || !cur || cur.uid === undefined) return s0;
  const freeIdx = p0.free.findIndex((f) => f.left > 0);
  const price = refreshPrice(p0);
  if (freeIdx < 0 && s0.gold < price) return note(s0, `A Plot Armor refresh costs ${price} gold.`);
  const [s1, rng] = step(s0);
  let p: PlotArmorState = { ...p0, free: p0.free.map((f, i) => (i === freeIdx ? { ...f, left: f.left - 1 } : f)) };
  let s = s1;
  let text: string;
  if (freeIdx >= 0) text = `Free Plot Armor refresh (${p0.free[freeIdx].source}).`;
  else { s = { ...s, gold: s.gold - price }; p = { ...p, paid: p.paid + 1 }; text = `Plot Armor refresh for ${price} gold.`; }
  p = hist(p, s, { kind: "refresh", text, cost: freeIdx >= 0 ? 0 : price, free: freeIdx >= 0 ? p0.free[freeIdx].source : undefined });
  p = { ...p, current: { ...cur, options: rollOptions(s, pack, rng, cur.options), refreshes: cur.refreshes + 1 } };
  if (p.storeChain) { s = { ...s, freeRefreshes: s.freeRefreshes + p.storeChain }; text += ` +${p.storeChain} free Store refresh (Refresh Chain).`; }
  return log(withPlot(s, p), text);
}

/** Take one of the two options. Returns the state still in the "plotArmor" phase; run.ts moves on. */
export function choosePlot(s0: RunState, pack: CwPack, index: number): RunState {
  const p0 = plotOf(s0);
  const cur = p0.current;
  const id = cur?.options[index];
  const opt = id ? optionById(pack, id) : undefined;
  if (s0.phase !== "plotArmor" || !cur || cur.uid === undefined || !opt) return s0;
  const unit = deployed(s0).find((u) => u.uid === cur.uid) ?? [...s0.bench].find((u) => u?.uid === cur.uid) ?? null;
  if (!unit) return note(s0, "That character is no longer in your squad.");
  const [s1, rng] = step(s0);
  let s = s1;
  const free = !!s.escapade?.powerfulPlot;
  const difficulty = free ? 0 : opt.difficulty;
  const applied: string[] = [];
  switch (opt.id) {
    case "twist": {
      for (const zone of ["on", "off", "bench"] as const) {
        const i = s[zone].findIndex((u) => u?.uid === unit.uid);
        if (i >= 0) { const z = [...s[zone]]; z[i] = { ...unit, stars: Math.min(3, unit.stars + 1) as 1 | 2 | 3 }; s = { ...s, [zone]: z }; }
      }
      applied.push(`${unit.name} is now ${Math.min(3, unit.stars + 1)}-star`);
      break;
    }
    case "pay": s = { ...s, gold: s.gold + 12, stats: { ...s.stats, goldEarned: s.stats.goldEarned + 12 } }; applied.push("+12 gold"); break;
    case "rehearsal": s = levelUp(s, 16); applied.push("+16 XP"); break;
    case "props": { const got = [randomBasicName(pack, rng), randomBasicName(pack, rng)].filter((x): x is string => !!x); s = { ...s, bag: [...s.bag, ...got] }; applied.push(got.join(", ")); break; }
    case "encore": s = { ...s, bag: [...s.bag, oreName("Gold")] }; applied.push("a Gold Crystal Ore"); break;
    case "boxoffice": s = { ...s, bag: [...s.bag, oreName("Prismatic")] }; applied.push("a Prismatic Crystal Ore"); break;
    case "fanmail": { const e = randomEmblemName(pack, rng); if (e) { s = { ...s, bag: [...s.bag, e] }; applied.push(e); } break; }
    case "understudy": { const [s2, u] = makeUnit(s, unit.name, unit.cost); const after = gain(s2, u); s = after ?? s2; applied.push(after ? `a 1-star ${unit.name}` : `${unit.name} (bench full)`); break; }
  }
  const holder: Holder = { uid: unit.uid, name: unit.name, option: opt.id, source: cur.stage === "imagenae" ? "imagenae" : cur.stage === "swap" ? "swap" : "protagonist", plane: s.plane };
  let p: PlotArmorState = { ...plotOf(s), current: undefined, holders: [...plotOf(s).holders, holder], done: cur.stage === "protagonist" ? [...plotOf(s).done, cur.plane] : plotOf(s).done };
  const label = `${holder.source === "imagenae" ? "Imagenae: Plot Armor" : holder.source === "swap" ? "Swapped-in protagonist" : `Protagonist ${p.done.length}`} ${unit.name}: ${opt.name}${applied.length ? ` (${applied.join(", ")})` : ""}${difficulty ? `, enemy difficulty +${difficulty}` : free && opt.difficulty ? " (no extra difficulty: Bubble Wolf)" : ""}.`;
  p = hist(p, s, { kind: holder.source === "imagenae" ? "imagenae" : holder.source === "swap" ? "swap" : "select", text: label });
  return log(withPlot({ ...s, extraDifficulty: s.extraDifficulty + difficulty }, p), label);
}

/** "New Cast Performance": hand a protagonist's Plot Armor to another deployed character. */
export function changeProtagonist(s0: RunState, fromUid: number, toUid: number): RunState {
  const p = plotOf(s0);
  const h = p.holders.find((x) => x.uid === fromUid && !x.disabled && x.source !== "imagenae");
  const to = deployed(s0).find((u) => u.uid === toUid && !u.npc);
  if (s0.phase !== "prep" || p.changes < 1 || !h || !to || p.holders.some((x) => x.uid === toUid && !x.disabled)) return note(s0, "Choose a protagonist and a deployed character without Plot Armor.");
  const [s] = step(s0);
  const holders = p.holders.map((x) => (x === h ? { ...x, uid: to.uid, name: to.name } : x));
  const text = `Protagonist changed: ${h.name} → ${to.name}.`;
  return log(withPlot(s, hist({ ...p, holders, changes: p.changes - 1 }, s, { kind: "change", text })), text);
}

/** Keep holders attached when copies merge (the merged unit keeps the first copy's uid). */
export function remapHolders(s: RunState, mergedUids: number[], keptUid: number): RunState {
  const p = s.plotArmor;
  if (!p?.holders.some((h) => mergedUids.includes(h.uid))) return s;
  return { ...s, plotArmor: { ...p, holders: p.holders.map((h) => (mergedUids.includes(h.uid) ? { ...h, uid: keptUid } : h)) } };
}

/**
 * Investment Environment / Strategy texts about Plot Armor. Returns the new state, what it applied and
 * the sentences it handled (so the general grant parser skips them).
 */
export function plotInvestment(s: RunState, text: string, source: string): [RunState, string[], string[]] {
  let p = plotOf(s);
  const applied: string[] = [];
  const handled: string[] = [];
  const sentences = text.split(/(?<=[.!])\s+/).map((x) => x.trim());
  for (const sen of sentences) {
    let m: RegExpExecArray | null;
    if ((m = /Plot Armor refresh cost for this run is fixed at (\d+) Gold Coin\(s\), and you'll receive (\d+) free Plot Armor refreshes/i.exec(sen))) {
      p = { ...p, fixedCost: Number(m[1]), free: [...p.free, { source, left: Number(m[2]) }] };
      applied.push(`Plot Armor refreshes cost ${m[1]} gold`, `${m[2]} free Plot Armor refreshes`); handled.push(sen);
    } else if ((m = /selection stage has been moved up to Nodes (\d)-(\d+) and (\d)-(\d+)/i.exec(sen))) {
      p = { ...p, early: [Number(m[2]) - 1, Number(m[4]) - 1] };
      applied.push(`Plot Armor chosen at nodes ${m[1]}-${m[2]} and ${m[3]}-${m[4]}`); handled.push(sen);
    } else if ((m = /When refreshing the "?Plot Armor"? effect, gains (\d+) free Store refresh/i.exec(sen))) {
      p = { ...p, storeChain: p.storeChain + Number(m[1]) };
      applied.push(`each Plot Armor refresh gives ${m[1]} free Store refresh`); handled.push(sen);
    } else if (/All protagonists' Plot Armor is disabled/i.test(sen)) {
      const active = p.holders.filter((h) => h.source !== "imagenae" && !h.disabled);
      p = { ...p, holders: p.holders.map((h) => (active.includes(h) ? { ...h, disabled: true } : h)), swaps: p.swaps + active.length };
      p = hist(p, s, { kind: "disabled", text: `${source}: ${active.length} protagonist${active.length === 1 ? "" : "s"}' Plot Armor disabled, ${active.length} swap chance${active.length === 1 ? "" : "s"}.` });
      applied.push(`${active.length} protagonists disabled, ${active.length} swap chances`); handled.push(sen);
    } else if (/Gain an equal number of chances to swap/i.test(sen)) handled.push(sen);
    // Counts inside sentences (New Cast Performance, Refresh Chain).
    const free = /(?:get|gains?) (\d+) free Plot Armor refresh/i.exec(sen);
    if (free && !handled.includes(sen)) { p = { ...p, free: [...p.free, { source, left: Number(free[1]) }] }; applied.push(`${free[1]} free Plot Armor refreshes`); }
    const change = /Obtains (\d+) chance\(s\) to change the Protagonist/i.exec(sen);
    if (change) { p = { ...p, changes: p.changes + Number(change[1]) }; applied.push(`${change[1]} chance to change the Protagonist`); }
    if (free || change) handled.push(sen);
  }
  if (!applied.length) return [s, [], []];
  p = hist(p, s, { kind: "free", text: `${source}: ${applied.join(", ")}.` });
  return [withPlot(s, p), applied, handled];
}

// --------------------------------------------------------------------------------------------- combat

/** Active holders standing on the field. */
export function activeHolders(s: RunState): Holder[] {
  const on = new Set(deployed(s).map((u) => u.uid));
  return plotOf(s).holders.filter((h) => !h.disabled && on.has(h.uid));
}

/** Count of Plot Armor Bond holders by Bond. */
export function plotBondCounts(s: RunState, pack: CwPack): Map<string, number> {
  const m = new Map<string, number>();
  for (const h of activeHolders(s)) { const o = optionById(pack, h.option); if (o?.bond) m.set(o.bond, (m.get(o.bond) ?? 0) + 1); }
  return m;
}

export interface UnitCtx { uid: number; name: string; cost: number; stars: number; place: "on" | "off"; bonds: string[] }
/**
 * Extra strength share and SPD Amplification for one unit from Plot Armor (options, Plot Armor Bonds,
 * Roll-Call 7). `bondShare(u)` = the team-Bond bonus shares of the active Bonds a unit is in.
 */
export function plotUnitBonus(s: RunState, pack: CwPack, u: UnitCtx, all: UnitCtx[], rollCall7: boolean, bondShare: (u: UnitCtx) => number): { strength: number; spd: number } {
  let strength = 0, spd = 0;
  const holder = activeHolders(s).find((h) => h.uid === u.uid);
  const counts = plotBondCounts(s, pack);
  if (holder) {
    const o = optionById(pack, holder.option);
    strength += o?.strength ?? 0;
    spd += o?.spd ?? 0;
    if (rollCall7) { strength += PLOT_ARMOR_RULES.rollCall.strength; spd += PLOT_ARMOR_RULES.rollCall.spd; }
    if (o?.bond === "Star Hunt Oath") {
      const mates = (counts.get("Star Hunt Oath") ?? 0) >= 2 ? all : all.filter((x) => x.place === u.place);
      const sum = mates.filter((x) => x.uid !== u.uid).reduce((n, x) => n + [1, 2, 4, 8][x.stars - 1], 0);
      strength += 0.05 * sum; spd += 0.05 * sum;
    }
    if (o?.bond === "Deliverer") strength += all.reduce((best, x) => Math.max(best, bondShare(x)), 0);
    if (o?.bond === "Apprenticeship") {
      const shifu = all.filter((x) => x.uid !== u.uid).sort((a, b) => b.cost * 3 + b.stars - (a.cost * 3 + a.stars))[0];
      if (shifu) strength += bondShare(shifu);
    }
  }
  if ((counts.get("Joint Follow-Up ATK") ?? 0) >= 1 && u.bonds.includes("Follow-Up ATK")) strength += 0.15 + ((counts.get("Joint Follow-Up ATK") ?? 0) >= 2 ? 0.1 : 0);
  if ((counts.get("Four-Dimensional Frenzy") ?? 0) >= 1 && u.cost === 4) { strength += 0.15 * 3; spd += 0.15; }
  return { strength, spd };
}

/** Four-Dimensional Frenzy (2): a "4-Cost Employment Contract" in each Node (a random 4-cost character here). */
export function frenzyContract(s: RunState, pack: CwPack, rng: () => number): RunState {
  if ((plotBondCounts(s, pack).get("Four-Dimensional Frenzy") ?? 0) < 2) return s;
  const pool = pack.characters.filter((c) => c.cost === 4);
  if (!pool.length) return s;
  const c = pool[Math.floor(rng() * pool.length)];
  const [s2, u] = makeUnit(s, c.name, c.cost);
  const after = gain(s2, u);
  return after ? log(after, `Four-Dimensional Frenzy: 4-Cost Employment Contract → ${c.name}.`) : s;
}

/** Roll-Call (5): one "Imagenae: Plot Armor" (once). */
export function rollCallGrant(s: RunState, phantasmoonCount: number, isRollCall: boolean): RunState {
  if (!isRollCall || phantasmoonCount < PLOT_ARMOR_RULES.rollCall.imagenaeAt || s.plotArmor?.rollCall) return s;
  const p = plotOf(s);
  const out = { ...s, bag: [...s.bag, "Phantasmoon: Plot Armor"], plotArmor: hist({ ...p, rollCall: true }, s, { kind: "imagenae", text: "Roll-Call (5): gained Imagenae: Plot Armor." }) };
  return note(log(out, "Phantasmoon Games: Roll-Call (5): gained 1 \"Imagenae: Plot Armor\" (drag it onto a character)."), "Roll-Call 5: you got an Imagenae: Plot Armor. Tap it, then a character.");
}
