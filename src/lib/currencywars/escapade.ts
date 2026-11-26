/**
 * Escapade (Version 4.7): one random Voyage Companion per run, its effect, Backstage Tea Break and
 * Pearliefin's Treasury. Companion data and which parts are assumed: voyageCompanions.ts.
 */
import { createRng } from "../warp/simulator";
import { emblemBond, oreName } from "./items";
import {
  deployed, gain, levelUp, log, makeUnit, nodeKinds, note, randomAdvancedName, randomBasicName, randomEmblemName, shopRosterOf, step, units,
  type NodeKind, type RunState, type Unit,
} from "./run";
import type { CwPack } from "./sim";
import { COMPANIONS, companionOf, variantOf, type CompanionVariant } from "./voyageCompanions";

const pickOne = <T,>(rng: () => number, list: readonly T[]): T => list[Math.floor(rng() * list.length)];
const sample = <T,>(rng: () => number, list: readonly T[], n: number): T[] => { const pool = [...list]; const out: T[] = []; while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]); return out; };

/** Numbers the wiki doesn't give (each is also stated on its companion's `assumed` line). */
export const ESCAPADE_ASSUMED = {
  coffeeOffers: 3,
  assignmentOffers: 3,
  difficultyDown: 2,
  enemyStarMult: 0.9,
  weakenedMult: 0.85,
  trotterChance: 0.25,
  trotterMult: 0.6,
  robot: { spd: 150, mult: 400, plusMult: 800 },
  singularity: { perStack: 0.03, max: 10 },
  malfunctionRefreshes: 7,
  levelGoal: [8, 9],
} as const;

export interface Assignment {
  id: string; name: string; text: string; tier: 1 | 2;
  /** Counters when accepted (refreshes, failed fights). */
  base: { refreshes: number; losses: number };
  reward: string;
  source: string;
}
export interface TeaOption { id: string; name: string; text: string }
export interface EscapadeState {
  companion: string;
  variant: string;
  /** The reveal animation has been shown (not replayed on reload). */
  revealed: boolean;
  history: { tick: number; text: string }[];
  /** Tea Breaks / Treasuries done, by plane. */
  done: number[];
  photo?: string[];
  autoBuy?: number;
  saveFrom?: number;
  savesUsed?: number[];
  enemyMult?: number;
  turbulence?: number | null;
  talentSlot?: number | null;
  singularity?: number;
  refunded?: number[];
  assignments?: Assignment[];
  completed?: string[];
  trotters?: boolean;
  powerfulPlot?: boolean;
  extraStrategy?: boolean;
  boosted?: number[];
  nextPrismatic?: boolean;
  malfunction?: boolean;
}

export const escOf = (s: RunState) => s.escapade;
export const hasVariant = (s: RunState, id: string) => s.escapade?.variant === id;
const record = (s: RunState, text: string): RunState => {
  const e = s.escapade!;
  return log({ ...s, escapade: { ...e, history: [...e.history, { tick: s.tick, text }] } }, `${e.companion}: ${text}`);
};
const patch = (s: RunState, p: Partial<EscapadeState>): RunState => ({ ...s, escapade: { ...s.escapade!, ...p } });

// --------------------------------------------------------------------------------------------- assignments

const ASSIGNMENTS: { id: string; name: string; text: string; tier: 1 | 2 }[] = [
  { id: "encounter", name: "Encounter Challenge", text: "Complete combat in an Encounter Node at difficulty 3 or higher.", tier: 1 },
  { id: "plot", name: "Plot Armor", text: "Have one 3-star Plot Armor character take the stage.", tier: 1 },
  { id: "gold80", name: "Gold Coin Reserve", text: "Have a total of 80 Gold Coins.", tier: 1 },
  { id: "refresh", name: "Rapid Refresh", text: "Refresh the Store 30 times.", tier: 1 },
  { id: "healthy", name: "Stay Healthy", text: "Squad HP above 90.", tier: 1 },
  { id: "extreme", name: "Extreme State", text: "Squad HP below 40.", tier: 1 },
  { id: "level", name: "Level Up", text: `Reach level ${ESCAPADE_ASSUMED.levelGoal[0]} (the wiki leaves this one blank).`, tier: 1 },
  { id: "stumble", name: "Stumbling", text: "Achieve an Imperfect Clear 3 times in total.", tier: 1 },
  { id: "streak", name: "Perfect Winning Streak", text: "Achieve 4 consecutive Perfect Clears.", tier: 1 },
  { id: "encounter2", name: "Encounter Challenge II", text: "Complete combat in an Encounter Node at difficulty 3 or higher.", tier: 2 },
  { id: "three2", name: "3-Star Lineup", text: "Have two 3-star characters take the stage.", tier: 2 },
  { id: "gold100", name: "Gold Coin Reserve II", text: "Have a total of 100 Gold Coins.", tier: 2 },
  { id: "refresh2", name: "Rapid Refresh II", text: "Refresh the Store 30 times.", tier: 2 },
  { id: "healthy2", name: "Stay Healthy II", text: "Squad HP above 90.", tier: 2 },
  { id: "extreme2", name: "Extreme State II", text: "Squad HP below 40.", tier: 2 },
  { id: "level2", name: "Level Up II", text: `Reach level ${ESCAPADE_ASSUMED.levelGoal[1]} (the wiki leaves this one blank).`, tier: 2 },
  { id: "stumble2", name: "Stumbling II", text: "Achieve an Imperfect Clear 3 times in total.", tier: 2 },
  { id: "streak2", name: "Perfect Winning Streak II", text: "Achieve 4 consecutive Perfect Clears.", tier: 2 },
];

function accept(s: RunState, a: (typeof ASSIGNMENTS)[number], reward: string, source: string): RunState {
  const e = s.escapade!;
  const next: Assignment = { ...a, base: { refreshes: s.stats.refreshes, losses: s.stats.losses }, reward, source };
  return record(patch(s, { assignments: [...(e.assignments ?? []), next] }), `accepted "${a.name}" (${a.text} Reward: ${reward}).`);
}

/** Is an assignment met now? `fought` = right after a battle (HP goals are checked then). */
function assignmentMet(s: RunState, a: Assignment, fought: boolean): boolean {
  const key = a.id.replace(/2$/, "");
  const line = deployed(s).filter((u) => !u.npc);
  switch (key) {
    case "encounter": return fought && s.last?.kind === "Encounter" && s.encounter === "hard" && s.last.won;
    case "plot": return line.some((u) => u.stars === 3 && (s.plotArmor?.holders ?? []).some((h) => h.uid === u.uid && !h.disabled));
    case "three": return line.filter((u) => u.stars === 3).length >= 2;
    case "gold80": return s.gold >= 80;
    case "gold100": return s.gold >= 100;
    case "refresh": return s.stats.refreshes - a.base.refreshes >= 30;
    case "healthy": return fought && s.hp > 90;
    case "extreme": return fought && s.hp < 40;
    case "level": return s.level >= ESCAPADE_ASSUMED.levelGoal[a.tier - 1];
    case "stumble": return s.stats.losses - a.base.losses >= 3;
    case "streak": return s.streak >= 4;
    default: return false;
  }
}

/** Pay out finished assignments (once each). */
export function checkAssignments(s: RunState): RunState {
  const e = s.escapade;
  if (!e?.assignments?.length || s.phase === "over") return s;
  const fought = s.phase === "result";
  const done = e.assignments.filter((a) => assignmentMet(s, a, fought));
  if (!done.length) return s;
  let out = patch(s, { assignments: e.assignments.filter((a) => !done.includes(a)), completed: [...(e.completed ?? []), ...done.map((a) => a.name)] });
  for (const a of done) out = note(record({ ...out, bag: [...out.bag, a.reward] }, `assignment "${a.name}" complete: ${a.reward}.`), `Ashwolf: "${a.name}" complete! You got a ${a.reward}.`);
  return out;
}

// --------------------------------------------------------------------------------------------- run start

/** Roll this run's companion and effect, and apply what happens at the start. */
export function startEscapade(s0: RunState, pack: CwPack, companion?: string, variant?: string): RunState {
  const rng = createRng(`${s0.seed}:escapade`);
  const c = (companion && companionOf(companion)) || pickOne(rng, COMPANIONS);
  const v = (variant && c.variants.find((x) => x.id === variant)) || pickOne(rng, c.variants);
  let s: RunState = { ...s0, escapade: { companion: c.name, variant: v.id, revealed: false, history: [], done: [] } };
  s = log(s, `Voyage Companion: ${c.name}. ${v.text}`);
  switch (v.id) {
    case "my-singularity": s = record({ ...s, bag: [...s.bag, "Imploding Singularity"] }, "obtained Imploding Singularity."); s = patch(s, { singularity: 0 }); break;
    case "sd-gift": s = record({ ...s, bag: [...s.bag, oreName("Gold")] }, "brought back a gift: a Gold Crystal Ore."); break;
    case "bw-turbulent": { const got = [randomBasicName(pack, rng), randomBasicName(pack, rng)].filter((x): x is string => !!x); s = record(addBasics(s, got), `hacked in Turbulent Basic Equipment: ${got.join(", ")}.`); break; }
    case "bw-strategy-mod": s = patch(s, { nextPrismatic: true }); break;
    case "wd-plane": s = patch(s, { saveFrom: Math.floor(rng() * 3), savesUsed: [] }); s = record(s, `will turn the first failed combat from Plane ${s.escapade!.saveFrom! + 1} on into a Perfect Clear.`); break;
    case "wd-each": s = patch(s, { savesUsed: [] }); break;
    case "sd-strategy": s = { ...s, layout: [0, 1, 2].map((p) => shiftEarlier(nodeKinds(p, s), "Strategy")) }; s = record(s, "moved each plane's Strategy Node one node earlier."); break;
    case "mb-emblem": {
      const [s2, u] = makeUnit(s, "March Bunny", 0, 1, []);
      s = gain(s2, { ...u, npc: true }) ?? s2;
      s = record(s, "joined the squad (deploy her to use the Emblem she wears).");
      break;
    }
    case "my-talent": case "my-talent2": s = patch(s, { talentSlot: null }); break;
  }
  return s;
}

/** Move the first `kind` node of a plane one node earlier (never past a Boss). */
export function shiftEarlier(kinds: NodeKind[], kind: NodeKind): NodeKind[] {
  const out = [...kinds];
  const i = kind === "Reward" ? out.lastIndexOf("Reward") : out.indexOf(kind);
  if (i > 0 && out[i - 1] !== "Boss") [out[i - 1], out[i]] = [out[i], out[i - 1]];
  return out;
}

/** Basic equipment you get (Mummicat's "mc-box" turns each into a Basic Weapon Box). */
export function addBasics(s: RunState, items: string[]): RunState {
  if (!items.length) return s;
  return { ...s, bag: [...s.bag, ...(hasVariant(s, "mc-box") ? items.map(() => "Basic Weapon Box") : items)] };
}

// --------------------------------------------------------------------------------------------- nodes

const lastRewardIndex = (kinds: NodeKind[]) => { const b = kinds.lastIndexOf("Boss"); return b > 0 && kinds[b - 1] === "Reward" ? b - 1 : kinds.lastIndexOf("Reward"); };

/** "teaBreak" / "treasury" if this node is replaced. */
export function specialNode(s: Pick<RunState, "escapade" | "plane" | "node" | "layout">): "teaBreak" | "treasury" | null {
  const v = s.escapade ? variantOf(s.escapade.variant) : undefined;
  if (!v || s.escapade!.done.includes(s.plane)) return null;
  if (s.node !== lastRewardIndex(nodeKinds(s.plane, s))) return null;
  if (v.teaBreak?.includes(s.plane)) return "teaBreak";
  if (v.treasury?.includes(s.plane)) return "treasury";
  return null;
}

const COFFEES: Record<string, TeaOption> = {
  sparkling: { id: "sparkling", name: "Sparkling Coffee", text: "Obtain a random Emblem and lose 8 HP." },
  cheese: { id: "cheese", name: "Purple Cheese Coffee", text: "Obtain 2 random 4-Cost characters and lose 5 HP." },
  fish: { id: "fish", name: "Golden Flying Fish Coffee", text: "Obtain 2 random 5-cost characters and lose 6 HP." },
  screws: { id: "screws", name: "Screws Coffee", text: "Obtain random advanced equipment and lose 4 HP." },
  wisdom: { id: "wisdom", name: "Wisdom Fruit Coffee", text: "Gain 20 Experience and lose 10 HP." },
  nameless: { id: "nameless", name: "Nameless Coffee", text: "Obtain ??? and lose ? HP. (Reduced to a minimum of 1)" },
  ink: { id: "ink", name: "Ink Black Coffee", text: "Obtain Roller Skates." },
  coins: { id: "coins", name: "Coins Coffee", text: "Gain 5 Gold Coins." },
};

/** The choices a Tea Break (or Treasury) offers now. */
export function teaOptions(s: RunState, pack: CwPack, v: CompanionVariant, kind: "teaBreak" | "treasury", rng: () => number): TeaOption[] {
  if (kind === "treasury") return sample(rng, pack.equipment?.advanced ?? [], 3).map((a) => ({ id: `treasury:${a.name}`, name: a.name, text: a.effect }));
  const p = s.plane;
  const one = (id: string, name: string, text: string): TeaOption[] => [{ id, name, text }];
  switch (v.id) {
    case "mb-photo": return one("photo", "Photo Op, Record This Moment", "Records characters on the field and in the preparation area.");
    case "mb-supplies": return one("supplies", "You Can Pick the Supplies", "In the next 1 to 3 random turns, March Bunny will automatically refresh the Store and purchase items for you.");
    case "mb-three": return one("three", "It Takes Three", "Obtain one 2-star \"March 7th,\" one 1-star \"Trailblazer,\" and one 1-star \"Dan Heng.\"");
    case "wd-affix": return one("affix", "Unleash the World-Cleansing Dragon!", "When entering the next Node, Woof Woof Dan removes 1 random enemy affix.");
    case "wd-difficulty": return one("difficulty", "Unleash the World-Cleansing Dragon!!", `Reduces enemy difficulty (by ${ESCAPADE_ASSUMED.difficultyDown} here).`);
    case "wd-stars": return one("stars", "Unleash the World-Cleansing Dragon!!!", "Reduces the star rating of subsequent enemies.");
    case "hk-coffee": return sample(rng, Object.values(COFFEES).filter((c) => (p === 0 ? c.id !== "fish" : c.id !== "cheese")), ESCAPADE_ASSUMED.coffeeOffers);
    case "hk-strange": return [{ id: "good", name: "\"Surprisingly Good\" Coffee", text: "Restores 99 squad HP." }, { id: "fled", name: "Fled Like Lightning", text: "Obtain 3 Anti-Grav Boots." }];
    case "sd-reward": return one("advance-reward", "Take Flight", "Sundove will advance the Reward Node in subsequent planes.");
    case "sd-supply": return one("advance-supply", "Take Flight", "Sundove will advance the Supply phase in subsequent planes.");
    case "ct-shroom": return one("shroom", "Mushy Shroomy, Mushy Shroomy!", "Cottontail will turn into other companions you know.");
    case "aw-tea": return sample(rng, ASSIGNMENTS.filter((a) => a.tier === 2), ESCAPADE_ASSUMED.assignmentOffers).map((a) => ({ id: `assign:${a.id}`, name: a.name, text: `Assignment Details: ${a.text}` }));
    case "bw-strategy": return one("strategy", p === 0 ? "Golden Finger? Let Me Try!" : "Finders Keepers!", "When entering the next Node, additionally triggers 1 Investment Strategy selection of random quality.");
    case "bw-plot": return one("plot", "System, Activate!", "Powerful Plot Armors are more likely to appear in this run, and they won't increase the enemy difficulty!");
    case "bw-trotters": return one("trotters", "Hack Enemy Data", "Enemies in subsequent Combat Nodes in this run have a chance to turn into Trotters.");
    case "pf-gifts": return p === 0 ? one("gift", "Draw a Few More Sketches.", "Gains 3 \"Intern Projectors.\"") : p === 1 ? one("gift", "Just Do Your Usual.", "Gains 2 \"Staff Projectors.\"") : one("gift", "Carefully Perfect Every Stroke.", "Gains 1 \"Perfect Projector.\"");
    case "pf-copy": {
      const line = deployed(s).filter((u) => !u.npc);
      const best = (score: (u: Unit) => number) => line.reduce<Unit | null>((b, u) => (!b || score(u) > score(b) ? u : b), null);
      return ([["star", "Copy the Companion With the Highest Star Rating", best((u) => u.stars * 10 + u.cost)], ["cost", "Copy the Companion With the Highest Cost.", best((u) => u.cost * 10 + u.stars)], ["gear", "Copy the Companion With the Most Equipment.", best((u) => u.items.length * 10 + u.cost)]] as [string, string, Unit | null][])
        .map(([id, name, u]) => ({ id: `copy:${id}:${u?.name ?? ""}`, name, text: u ? `Obtain 1 "${u.name}."` : "No one on the field to copy." }));
    }
    default: return [];
  }
}

/** Arrive at a replaced node: offer its choices. */
export function enterSpecial(s: RunState, pack: CwPack, kind: "teaBreak" | "treasury", rng: () => number): RunState {
  const v = variantOf(s.escapade!.variant)!;
  const options = teaOptions(s, pack, v, kind, rng);
  return { ...s, phase: "teaBreak", offers: { teaBreak: { kind, options } } };
}

const giveUnit = (s: RunState, pack: CwPack, name: string, stars: 1 | 2 | 3 = 1): [RunState, boolean] => {
  const c = pack.characters.find((x) => x.name === name);
  if (!c) return [s, false];
  const [s2, u] = makeUnit(s, c.name, c.cost, stars);
  const after = gain(s2, u);
  return after ? [after, true] : [s2, false];
};
const giveRandom = (s: RunState, pack: CwPack, cost: number, n: number, rng: () => number): [RunState, string[]] => {
  const pool = shopRosterOf(pack).filter((c) => c.cost === cost);
  let out = s; const got: string[] = [];
  for (let i = 0; i < n && pool.length; i++) { const c = pickOne(rng, pool); const [n2, ok] = giveUnit(out, pack, c.name); out = n2; got.push(ok ? c.name : `${c.name} (bench full)`); }
  return [out, got];
};
const loseHp = (s: RunState, n: number) => ({ ...s, hp: Math.max(1, s.hp - n) });

/** Apply one Tea Break option (also used by Cottontail's transformation). */
function applyTea(s0: RunState, pack: CwPack, v: CompanionVariant, opt: TeaOption, rng: () => number): RunState {
  let s = s0;
  const [kind, arg, extra] = opt.id.split(":");
  switch (kind) {
    case "photo": { const names = [...s.on, ...s.off, ...s.bench].filter((u): u is Unit => !!u && !u.npc).map((u) => u.name); return record(patch(s, { photo: [...(s.escapade!.photo ?? []), ...names] }), `photo recorded ${names.length} characters: copies arrive over the next nodes.`); }
    case "supplies": { const n = 1 + Math.floor(rng() * 3); return record(patch(s, { autoBuy: n }), `will refresh the Store and buy for you on the next ${n} node${n === 1 ? "" : "s"}.`); }
    case "three": {
      const got: string[] = [];
      for (const [name, stars] of [["March 7th (The Hunt)", 2], ["Trailblazer (Elation)", 1], ["Dan Heng • Imbibitor Lunae", 1]] as [string, 1 | 2][]) { const [n2, ok] = giveUnit(s, pack, name, stars); s = n2; if (ok) got.push(`${"★".repeat(stars)} ${name}`); }
      return record(s, `It Takes Three: ${got.join(", ") || "no room on the bench"}.`);
    }
    case "affix": return record({ ...s, extraDifficulty: s.extraDifficulty - 1 }, "removed an enemy affix (enemy difficulty −1).");
    case "difficulty": return record({ ...s, extraDifficulty: s.extraDifficulty - ESCAPADE_ASSUMED.difficultyDown }, `reduced enemy difficulty by ${ESCAPADE_ASSUMED.difficultyDown}.`);
    case "stars": return record(patch(s, { enemyMult: (s.escapade!.enemyMult ?? 1) * ESCAPADE_ASSUMED.enemyStarMult }), "lowered the star rating of later enemies.");
    case "sparkling": { const e = randomEmblemName(pack, rng); return record(loseHp(e ? { ...s, bag: [...s.bag, e] } : s, 8), `Sparkling Coffee: ${e ?? "no Emblem"}, −8 HP.`); }
    case "cheese": { const [n2, got] = giveRandom(s, pack, 4, 2, rng); return record(loseHp(n2, 5), `Purple Cheese Coffee: ${got.join(", ")}, −5 HP.`); }
    case "fish": { const [n2, got] = giveRandom(s, pack, 5, 2, rng); return record(loseHp(n2, 6), `Golden Flying Fish Coffee: ${got.join(", ")}, −6 HP.`); }
    case "screws": { const a = randomAdvancedName(pack, rng); return record(loseHp(a ? { ...s, bag: [...s.bag, a] } : s, 4), `Screws Coffee: ${a ?? "nothing"}, −4 HP.`); }
    case "wisdom": return record(loseHp(levelUp(s, 20), 10), "Wisdom Fruit Coffee: +20 XP, −10 HP.");
    case "nameless": {
      const others = Object.values(COFFEES).filter((c) => !["nameless", s.plane === 0 ? "fish" : "cheese"].includes(c.id));
      const pick = pickOne(rng, others);
      const hp = 1 + Math.floor(rng() * 10);
      return record(loseHp(applyTea(s, pack, v, pick, rng), hp), `Nameless Coffee turned out to be ${pick.name}; −${hp} more HP.`);
    }
    case "ink": return record(addBasics(s, ["Roller Skates"]), "Ink Black Coffee: Roller Skates.");
    case "coins": return record({ ...s, gold: s.gold + 5, stats: { ...s.stats, goldEarned: s.stats.goldEarned + 5 } }, "Coins Coffee: +5 gold.");
    case "good": return record({ ...s, hp: Math.min(100, s.hp + 99) }, "\"Surprisingly Good\" Coffee: squad HP restored.");
    case "fled": return record({ ...s, bag: [...s.bag, "Anti-Grav Boots", "Anti-Grav Boots", "Anti-Grav Boots"] }, "Fled Like Lightning: 3 Anti-Grav Boots.");
    case "advance-reward": case "advance-supply": {
      const k: NodeKind = kind === "advance-reward" ? "Reward" : "Supply";
      const layout = [0, 1, 2].map((p) => (p > s.plane ? shiftEarlier(nodeKinds(p, s), k) : nodeKinds(p, s)));
      return record({ ...s, layout }, `moved the ${k} Node one node earlier in the coming planes.`);
    }
    case "shroom": {
      const pool = COMPANIONS.filter((c) => c.name !== "Cottontail").flatMap((c) => c.variants.filter((x) => x.teaBreak && x.id !== "pf-copy").map((x) => ({ c, x })));
      const { c, x } = pickOne(rng, pool);
      const opts = teaOptions(s, pack, x, "teaBreak", rng);
      if (!opts.length) return s;
      return record(applyTea(s, pack, x, pickOne(rng, opts), rng), `turned into ${c.name}!`);
    }
    case "assign": { const a = ASSIGNMENTS.find((x) => x.id === arg); return a ? accept(s, a, oreName(s.plane === 0 ? "Gold" : "Prismatic"), "Ashwolf (Tea Break)") : s; }
    case "strategy": return record(patch(s, { extraStrategy: true }), "will trigger an extra Investment Strategy selection at the next node.");
    case "plot": return record(patch(s, { powerfulPlot: true }), "System, Activate! Powerful Plot Armor is more likely and adds no enemy difficulty.");
    case "trotters": return record(patch(s, { trotters: true }), "hacked enemy data: Trotters may appear.");
    case "gift": {
      const gift = s.plane === 0 ? Array(3).fill("Intern Projector") : s.plane === 1 ? Array(2).fill("Staff Projector") : ["Perfect Projector"];
      return record({ ...s, bag: [...s.bag, ...gift] }, `gift: ${gift.length} × ${gift[0]}.`);
    }
    case "copy": { if (!extra) return s; const [n2, ok] = giveUnit(s, pack, extra, 1); return record(n2, ok ? `painted a 1-star ${extra}.` : `couldn't paint ${extra} (bench full).`); }
    case "treasury": return record({ ...s, bag: [...s.bag, arg] }, `Treasury: ${arg}.`);
    default: return s;
  }
}

/** Choose a Tea Break / Treasury option; the node is then done (no fight). */
export function chooseTea(s0: RunState, pack: CwPack, index: number): RunState {
  const tb = s0.offers.teaBreak;
  const opt = tb?.options[index];
  if (s0.phase !== "teaBreak" || !tb || !opt || !s0.escapade) return s0;
  const [s1, rng] = step(s0);
  const v = variantOf(s1.escapade!.variant)!;
  let s = patch(s1, { done: [...s1.escapade!.done, s1.plane] });
  s = record(s, `${tb.kind === "treasury" ? "Pearliefin's Treasury" : "Backstage Tea Break"}: ${opt.name}.`);
  s = applyTea(s, pack, v, opt, rng);
  return { ...s, offers: {} };
}

/** Companion effects on entering a node (after the Store has rolled). */
export function onEnterNode(s0: RunState, pack: CwPack, rng: () => number, highestBond: () => string | null): RunState {
  const e = s0.escapade;
  if (!e) return s0;
  let s = s0;
  const v = e.variant;
  // March Bunny re-learns your highest-tier Bond and wears its Emblem.
  if (v === "mb-emblem") {
    const bond = highestBond();
    const emblem = bond ? pack.equipment?.emblems?.find((x) => x.bond === bond || bond.startsWith(`${x.bond}: `))?.name : null;
    if (emblem) {
      for (const zone of ["on", "off", "bench"] as const) {
        const i = s[zone].findIndex((u) => u?.npc && u.name === "March Bunny");
        if (i >= 0 && s[zone][i]!.items[0] !== emblem) { const z = [...s[zone]]; z[i] = { ...z[i]!, items: [emblem] }; s = record({ ...s, [zone]: z }, `learned ${emblemBond(pack, emblem)} and wears its Emblem.`); }
      }
    }
  }
  if (e.photo?.length) {
    const [name, ...rest] = e.photo;
    const [n2, ok] = giveUnit(s, pack, name, 1);
    s = ok ? record(patch(n2, { photo: rest }), `a copy of ${name} from the photo.`) : patch(s, { photo: e.photo });
  }
  if (v === "my-turbulence") {
    const at = e.turbulence;
    if (at !== null && at !== undefined && s.bench[at] && !s.bench[at]!.npc) {
      const old = s.bench[at]!;
      const pool = shopRosterOf(pack).filter((c) => c.cost === old.cost && c.name !== old.name);
      if (pool.length) { const c = pickOne(rng, pool); const bench = [...s.bench]; bench[at] = { ...old, name: c.name }; s = record({ ...s, bench }, `Black Hole Turbulence turned ${old.name} into ${c.name}.`); }
    }
    s = patch(s, { turbulence: Math.floor(rng() * s.bench.length) });
  }
  if ((v === "my-talent" || v === "my-talent2") && !s.locked) s = patch(s, { talentSlot: Math.floor(rng() * s.shop.length) });
  if (v === "aw-plane" && s.node === 0) {
    s = patch(s, { assignments: (s.escapade!.assignments ?? []).filter((a) => a.source !== "Ashwolf") });
    s = accept(s, pickOne(rng, ASSIGNMENTS.filter((a) => a.tier === 1)), oreName("Gold"), "Ashwolf");
  }
  if (v === "ct-malfunction") {
    if (s.escapade!.malfunction) s = patch({ ...s, freeRefreshes: Math.max(0, s.freeRefreshes - ESCAPADE_ASSUMED.malfunctionRefreshes) }, { malfunction: false });
    const kinds = nodeKinds(s.plane, s);
    const supply = kinds.indexOf("Supply");
    if (supply >= 0 && s.node === supply + 1) s = record(patch({ ...s, freeRefreshes: s.freeRefreshes + ESCAPADE_ASSUMED.malfunctionRefreshes }, { malfunction: true }), `Store malfunction! ${ESCAPADE_ASSUMED.malfunctionRefreshes} forced refreshes (free, this node only).`);
  }
  if ((e.autoBuy ?? 0) > 0 && s.phase !== "teaBreak") {
    const owned = new Set(units(s).map((u) => u.name));
    const slots = s.shop.map((x, i) => ({ x, i })).filter((o) => o.x);
    const pick = slots.find((o) => owned.has(o.x!.name)) ?? slots.sort((a, b) => a.x!.cost - b.x!.cost)[0];
    if (pick) {
      const [s2, u] = makeUnit(s, pick.x!.name, pick.x!.cost, pick.x!.stars);
      const after = gain(s2, u);
      if (after) { const shop = [...after.shop]; shop[pick.i] = null; s = record({ ...after, shop }, `refreshed the Store and bought ${pick.x!.name} for you.`); }
    }
    s = patch(s, { autoBuy: (s.escapade!.autoBuy ?? 1) - 1 });
  }
  return s;
}

/** Supply offers after Evanefox / Mummicat. */
export function supplyOffers(s: RunState, pack: CwPack, offers: { name: string; cost: number; item: string; stars?: 1 | 2 | 3; items?: string[] }[], rng: () => number) {
  const v = s.escapade?.variant;
  if (!v) return offers;
  const roster = shopRosterOf(pack);
  const swapCost = (cost: number) => offers.map((o) => { const pool = roster.filter((c) => c.cost === cost); const c = pool.length ? pickOne(rng, pool) : null; return c ? { ...o, name: c.name, cost: c.cost } : o; });
  const p = s.plane;
  switch (v) {
    case "ef-p1-emblem": return p === 0 ? offers.map((o) => ({ ...o, item: randomEmblemName(pack, rng) ?? o.item })) : offers;
    case "ef-p1-2emblem": return p === 0 ? offers.map((o) => { const a = randomEmblemName(pack, rng), b = randomEmblemName(pack, rng); return { ...o, item: a ?? o.item, items: [a, b].filter((x): x is string => !!x) }; }) : offers;
    case "ef-p2-emblem": return p === 1 ? offers.map((o) => ({ ...o, item: randomEmblemName(pack, rng) ?? o.item })) : offers;
    case "ef-2star": return offers.map((o) => ({ ...o, stars: 2 as const }));
    case "ef-3star": return p <= 1 ? swapCost(1).map((o) => ({ ...o, stars: 3 as const })) : offers;
    case "ef-p1-4cost": return p === 0 ? swapCost(4) : offers;
    case "ef-p2-5cost": return p === 1 ? swapCost(5) : offers;
    case "mc-supply-box": return offers.map((o) => ({ ...o, name: "Basic Weapon Box", cost: 0, item: "Basic Weapon Box", items: ["Basic Weapon Box", "Basic Weapon Box"] }));
    default: return offers;
  }
}

/** Enemy strength multiplier for a fight, and whether it's a Trotter fight. */
export function enemyMods(s: RunState, kind: NodeKind, eliteFight: boolean, rng: () => number): { mult: number; trotter: boolean } {
  const e = s.escapade;
  if (!e) return { mult: 1, trotter: false };
  let mult = e.enemyMult ?? 1;
  if (e.variant === "bw-weaken" && eliteFight) mult *= ESCAPADE_ASSUMED.weakenedMult;
  const trotter = !!e.trotters && (kind === "Combat" || kind === "Strategy" || kind === "Encounter") && rng() < ESCAPADE_ASSUMED.trotterChance;
  if (trotter) mult *= ESCAPADE_ASSUMED.trotterMult;
  return { mult, trotter };
}

/** Woof Woof Dan: turn a failed fight into a Perfect Clear (once per plane, or once from a plane on). */
export function woofSave(s: RunState): boolean {
  const e = s.escapade;
  if (!e) return false;
  if (e.variant === "wd-each") return !(e.savesUsed ?? []).includes(s.plane);
  if (e.variant === "wd-plane") return s.plane >= (e.saveFrom ?? 0) && !(e.savesUsed ?? []).length;
  return false;
}
export const spendWoofSave = (s: RunState) => record(patch(s, { savesUsed: [...(s.escapade!.savesUsed ?? []), s.plane] }), "protected you: the failed fight became a Perfect Clear!");

/** Belobog Robot for this fight (Mr. Yang). */
export function robotFor(s: RunState, kind: NodeKind): { spd: number; mult: number } | null {
  const v = s.escapade?.variant;
  if (v === "my-robot" && kind !== "Reward") return { spd: ESCAPADE_ASSUMED.robot.spd, mult: ESCAPADE_ASSUMED.robot.mult };
  if ((v === "my-robot-node" || v === "my-robot-plus") && kind === "Boss") return { spd: ESCAPADE_ASSUMED.robot.spd, mult: v === "my-robot-plus" ? ESCAPADE_ASSUMED.robot.plusMult : ESCAPADE_ASSUMED.robot.mult };
  return null;
}

/** Imploding Singularity: stacks after a fight. */
export function afterFight(s: RunState, won: boolean): RunState {
  const e = s.escapade;
  if (!e || e.singularity === undefined) return s;
  const n = Math.max(0, Math.min(ESCAPADE_ASSUMED.singularity.max, e.singularity + (won ? 1 : -1)));
  return n === e.singularity ? s : patch(s, { singularity: n });
}

/** Mummicat: the first synthesis in each plane refunds one of the basic items used. */
export function synthesisRefund(s: RunState, used: string[]): RunState {
  const e = s.escapade;
  if (e?.variant !== "mc-refund" || (e.refunded ?? []).includes(s.plane) || !used.length) return s;
  return record(patch({ ...s, bag: [...s.bag, used[0]] }, { refunded: [...(e.refunded ?? []), s.plane] }), `refunded ${used[0]} from your first synthesis this plane.`);
}

/** March Bunny: +1 Experience per purchase in the Second/Third Plane. */
export const xpBonus = (s: RunState) => (s.escapade?.variant === "mb-xp" && s.plane >= 1 ? 1 : 0);

/** Mr. Yang's Talent Black Hole Slot: refill the bought slot. */
export function talentRefill(s: RunState, pack: CwPack, slot: number, cost: number, rng: () => number): RunState {
  const e = s.escapade;
  if (!e || e.talentSlot !== slot || (e.variant !== "my-talent" && e.variant !== "my-talent2")) return s;
  const want = e.variant === "my-talent2" ? 3 + Math.min(2, s.plane) : cost;
  const pool = shopRosterOf(pack).filter((c) => c.cost === want);
  if (!pool.length) return s;
  const c = pickOne(rng, pool);
  const shop = [...s.shop]; shop[slot] = { name: c.name, cost: c.cost, stars: 1 };
  return record(patch({ ...s, shop }, { talentSlot: null }), `Talent Black Hole Slot refilled with ${c.name} (${c.cost}-cost).`);
}

/** Open a Basic Weapon Box, choosing the basic equipment. */
export function openBox(s0: RunState, pack: CwPack, bagIndex: number, pick: string): RunState {
  if (s0.bag[bagIndex] !== "Basic Weapon Box" || !pack.equipment?.basic.some((b) => b.name === pick) || s0.phase === "over") return s0;
  const [s] = step(s0);
  const bag = [...s.bag]; bag[bagIndex] = pick;
  return log({ ...s, bag }, `Basic Weapon Box: chose ${pick}.`);
}
