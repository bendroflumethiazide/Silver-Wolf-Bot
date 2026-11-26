/**
 * Investment Environments and Strategies whose wording the general text parser (run.ts applyEffect)
 * can't turn into effects, handled by name.
 *
 * VERIFIED: every rule here implements the HSR Wiki text of "Currency Wars: Voyage Into the Canvas/
 * Investment Strategy" and "/Investment Environment" (Version 4.7), quoted in RULE_INFO.
 * PROVISIONAL (RULE_ASSUMED): how an in-fight condition averages over a fight in this simulator's
 * strength model (e.g. "while stage progress < 50%" counts for half the fight), the size of "base DMG"
 * hits, and the few values the wiki leaves open. Each is named in the rule's `approx` note.
 *
 * This file is pure (no run state): combat rules take a CombatCtx and return stats. Event rules
 * (gold, XP, refreshes, node changes) live in run.ts, keyed by the same names.
 */
import type { Stats } from "./combat";

export const RULE_ASSUMED = {
  /** Enemy strength removed per 100% base DMG hit (Volley of Arrows, Sucker Punch). Unknown scale. */
  baseDmgShare: 0.002,
  /** Cap on the share of enemy strength those hits remove. */
  baseDmgCap: 0.5,
  /** "While stage progress < 50%": the share of a fight that counts. */
  firstHalf: 0.5,
  /** Fragility on the highest-HP target: the share of the fight's damage that target takes. */
  fragileTarget: 0.25,
  /** Eidolon Level +1 as On-Field Strength (the game's Eidolon effects per character aren't on the CW pages). */
  eidolonStr: 0.1,
  /** A "4-star" character (Faster-Than-Light Promotion) as 3-star strength × this (there is no 4-star table). */
  fourStar: 1.5,
  /** Energy from defeating enemies (Tactical Eyepiece) as squad Energy. */
  eyepieceEnergy: 0.2,
  /** "15 initial Energy" as a share of a typical 120-Energy Ultimate. */
  initialEnergy: 15 / 120,
  /** Market Vitality: chance a 1/2-cost shop slot is 2-star, per level above 2. */
  vitalityPerLevel: 0.02,
  /** Economic Hyperheat: Super Warp Trotters drop this many times the Reward node's loot. */
  hyperheatLoot: 2,
  /** Economic Overheat: Warp Trotters "drop more loot". */
  overheatLoot: 1.5,
  /** "Executes" below 16% HP: share of enemy HP skipped. */
  executeAt: 0.16,
  /** Combat Power Level Up/Surge: "a random stat bonus" per node, as strength (size not on the wiki). */
  randomStat: 0.02,
  /** Complete Disassembly: Molecular Solvent's 3 extra DMG instances and %Max HP True DMG, as its holder's DMG dealt. */
  solventDealt: 0.2,
  /** Equipment Liquidation: gold for selling an item (prices not on the wiki). */
  sellItem: { basic: 1, advanced: 3, privileged: 5, emblem: 2, gem: 2 } as Record<string, number>,
} as const;

/** One deployed character as combat rules see it. */
export interface CombatUnit {
  uid: number; name: string; cost: number; stars: number; items: string[]; place: "on" | "off";
  /** Strength before these rules (for "the member ranking first in DMG dealt"). */
  power: number;
  /** Lucky Strike Rate before these rules. */
  lucky: number;
  /** Active non-independent (Faction/School) Bonds this unit is in. */
  sharedBonds: number;
}

export interface CombatCtx {
  units: CombatUnit[];
  /** Fight length in Action Value. */
  av: number;
  boss: boolean;
  /** Active Bonds: all, and non-independent (Faction/School) ones. */
  bonds: number;
  sharedBonds: number;
  /** Memosprites and summons on the field (Strength in Numbers). */
  summons: number;
  /** Average enemy star rating at this node. */
  enemyStar: number;
  /** Nodes entered since a rule was obtained. */
  since: (name: string) => number;
  /** Strength a unit gains from an extra/privileged item (Onboarding Package, Rise Above All). */
  itemGain?: (u: CombatUnit, kind: "recommended" | "privilege") => Partial<Stats>;
  /** A rule counter (e.g. "dae:<uid>" for Diamonds Are Eternal, "cp:<uid>" for Combat Power). */
  num?: (key: string) => number;
  /** Whether a unit holds Diamond (gem) or gem-synthesized equipment, per item. */
  gemItems?: (u: CombatUnit) => number;
}

export interface RuleCombat {
  squad: Partial<Stats>;
  per: Map<number, Partial<Stats>>;
  /** Enemy strength multiplier (executes, Heavy Strike, base DMG hits). */
  enemyMult: number;
  /** Characters that fight at a higher star this combat. */
  starUp: Map<number, { stars: number; mult: number }>;
  /** Action value penalty cut on a killing blow (Trauma Team). */
  reviveCut: number;
  notes: string[];
}

const add = (a: Partial<Stats>, b: Partial<Stats>, k = 1): Partial<Stats> => {
  const out = { ...a };
  for (const key of Object.keys(b) as (keyof Stats)[]) out[key] = (out[key] ?? 0) + (b[key] ?? 0) * k;
  return out;
};

/** Combat effects of the named Environment/Strategies this run owns. */
export function combatRules(names: readonly string[], c: CombatCtx): RuleCombat {
  const out: RuleCombat = { squad: {}, per: new Map(), enemyMult: 1, starUp: new Map(), reviveCut: 0, notes: [] };
  const has = new Set(names);
  const squad = (st: Partial<Stats>) => { out.squad = add(out.squad, st); };
  const unit = (uid: number, st: Partial<Stats>) => out.per.set(uid, add(out.per.get(uid) ?? {}, st));
  const on = c.units.filter((u) => u.place === "on");
  const off = c.units.filter((u) => u.place === "off");
  const baseHit = (pct: number) => { out.enemyMult *= 1 - Math.min(RULE_ASSUMED.baseDmgCap, (pct / 100) * RULE_ASSUMED.baseDmgShare); };
  const top = [...c.units].sort((a, b) => b.power - a.power)[0];

  if (has.has("Hope of the Team") && on[0]) unit(on[0].uid, { dmg: 0.15, hp: 0.15 });
  if (has.has("Fan Club") && off.length >= 4) squad({ spd: 0.15 });
  if (has.has("Positive Energy")) squad({ energy: 0.2 });
  if (has.has("Perfect Start")) squad({ str: 0.4 * RULE_ASSUMED.firstHalf });
  if (has.has("Grassroots Contribution")) for (const u of c.units.filter((x) => x.cost === 1)) squad({ spd: 0.06 * (u.stars === 3 ? 3 : 1), mit: 0.04 * (u.stars === 3 ? 3 : 1) });
  for (const [name, own, others] of [["Role Model: Silver", 0.25, 0], ["Role Model: Gold", 0.4, 0.1], ["Role Model: Prismatic", 0.7, 0]] as const) {
    if (!has.has(name) || !top) continue;
    unit(top.uid, { str: own });
    for (const u of c.units) if (u.uid !== top.uid && others) unit(u.uid, { str: others });
    // Prismatic: other members' attacks deal 1% of the Role Model's accumulated DMG (about half its total on average, ~2.5 attacks each).
    if (name === "Role Model: Prismatic") unit(top.uid, { dealt: 0.01 * 0.5 * 2.5 * Math.max(0, c.units.length - 1) });
  }
  if (has.has("Sucker Punch")) { baseHit(1000 * (c.boss ? 1 : 2)); squad({ dmg: 0.3 * RULE_ASSUMED.fragileTarget }); }
  if (has.has("Volley of Arrows")) baseHit((c.units.reduce((n, u) => n + u.stars, 0) + 8) * 1600);
  if (has.has("Precise Demolition")) out.enemyMult *= c.boss ? 0.5 : 1 - 1 / 5;
  if (has.has("Liquidate")) out.enemyMult *= 1 - RULE_ASSUMED.executeAt;
  if (has.has("Star Rating Suppression")) { squad({ spd: 0.1 }); for (const u of c.units) if (u.stars > c.enemyStar) unit(u.uid, { dealt: 0.2 }); }
  if (has.has("Delayed Returns")) squad({ dmg: 0.4 * Math.max(0, c.av - 60) / Math.max(1, c.av) });
  if (has.has("Lucky One")) { squad({ lucky: 0.25 }); for (const u of c.units) if (u.lucky + 0.25 >= 1) unit(u.uid, { luckyDmg: 0.6 }); }
  if (has.has("Hit Where It Hurts: Gold")) { squad({ lucky: 0.1 }); for (const u of c.units) unit(u.uid, { dmg: 0.3 * Math.min(1, u.lucky + 0.1) * 0.5 }); }
  if (has.has("Lucky Dodge EX")) { squad({ lucky: 0.25 }); const rate = c.units.reduce((n, u) => n + Math.min(1, u.lucky + 0.25), 0) / Math.max(1, c.units.length); squad({ mit: Math.min(0.9, 0.3 * rate) }); }
  if (has.has("Overflowing Luck")) { squad({ lucky: 0.12 }); for (const u of c.units) unit(u.uid, { luckyDmg: 3 * Math.max(0, u.lucky + 0.12 - 1) }); }
  if (has.has("Lucky Spray")) squad({ luckyDmg: 0.25 });
  if (has.has("Faster, Luckier") && c.units.length) {
    // One more holder every 20 AV: average share of the squad holding it over the fight.
    let t = 0, sum = 0; for (; t < c.av; t += 1) sum += Math.min(c.units.length, 1 + Math.floor(t / 20)) / c.units.length;
    const share = sum / Math.max(1, c.av);
    squad({ spd: 0.08 * share, lucky: 0.12 * share });
  }
  if (has.has("In Threes and Fives")) { if (off.length >= 5) squad({ spd: 0.3, str: 0.65 }); else if (off.length >= 3) squad({ spd: 0.05, str: 0.15 }); }
  if (has.has("Supply Chain: Prismatic")) squad({ str: 0.15 + 0.04 * c.since("Supply Chain: Prismatic") });
  if (has.has("Supply Chain Creation: Gold")) squad({ spd: 0.1 + 0.01 * c.since("Supply Chain Creation: Gold") });
  if (has.has("Savage Growth")) {
    for (const u of on) unit(u.uid, { on: Math.min(2, on.length) / on.length });
    for (const u of off) unit(u.uid, { off: Math.min(2, off.length) / off.length });
  }
  if (has.has("Integrated Combat")) squad({ mit: 0.33, dmg: 0.33 });
  if (has.has("Power of Bonds")) squad({ dmg: 0.05 * c.sharedBonds, mit: 0.03 * c.sharedBonds });
  if (has.has("Team Strength: Silver")) squad({ str: 0.03 * c.sharedBonds });
  if (has.has("Team Power: Gold")) squad({ str: 0.06 * c.bonds, hp: 0.04 * c.bonds });
  if (has.has("OOTD: Gold")) { const kinds = new Set(c.units.flatMap((u) => u.items)).size; squad({ hp: 0.03 * kinds, str: 0.06 * kinds }); }
  if (has.has("Onboarding Package") && c.itemGain) for (const u of c.units.filter((x) => x.items.length === 2).slice(0, 4)) unit(u.uid, c.itemGain(u, "recommended"));
  if (has.has("Rise Above All") && c.itemGain) for (const u of c.units.filter((x) => x.items.length >= 3)) unit(u.uid, c.itemGain(u, "privilege"));
  if (has.has("Logistics Overdrive")) { const stars = off.reduce((n, u) => n + u.stars, 0); for (const u of off) unit(u.uid, { off: 0.12 * stars }); }
  if (has.has("Strength in Numbers")) squad({ str: 0.15 + (on.length + c.summons > 8 ? 0.25 : 0) });
  if (has.has("Lone Wolf")) for (const u of c.units) if (!u.sharedBonds) unit(u.uid, { str: 1.2, mit: 0.36 });
  if (has.has("Early Push")) {
    // +60% falling 1% per AV: its average over the fight; a 40% action advance counts as SPD for the fight's length.
    const avg = c.av > 0 ? (Math.min(60, c.av) * (0.6 + Math.max(0, 0.6 - c.av / 100)) / 2) / c.av : 0;
    squad({ str: avg, spd: 0.4 * 100 / Math.max(100, c.av) });
  }
  if (has.has("Triple Threes")) for (const u of c.units) { const k = Number(u.stars === 3) + Number(u.cost === 3) + Number(u.items.length >= 3); if (k) unit(u.uid, { spd: 0.1 * k, str: 0.25 * k }); }
  if (has.has("Trauma Team")) { squad({ dmg: 0.15, hp: -0.3 }); out.reviveCut += 20; }
  if (has.has("Tongue Twister") && on[0] && off[0]) {
    unit(on[0].uid, { on: 0.3 * off[0].power / Math.max(1, on[0].power) });
    unit(off[0].uid, { off: 0.3 * on[0].power / Math.max(1, off[0].power) });
  }
  if (has.has("Elite Talent Investment")) for (const u of c.units.filter((x) => x.cost === 5)) unit(u.uid, { str: 0.15, dmg: 0.15 });
  if (has.has("Intern Development Plan")) for (const u of c.units.filter((x) => x.cost === 1)) unit(u.uid, { str: 0.08 });
  if (has.has("Eidolon Ascension")) for (const u of on) unit(u.uid, { on: RULE_ASSUMED.eidolonStr });
  if (has.has("Tactical Eyepiece") || has.has("Tactical Eyepiece+") || has.has("Tactical Eyepiece++")) squad({ energy: RULE_ASSUMED.eyepieceEnergy * (c.boss ? 1.5 : 1) });
  if (has.has("Middle Class")) { const twos = c.units.filter((u) => u.stars === 2).length; squad({ mit: 0.05 * twos, str: 0.15 * twos }); }
  for (const u of c.units) {
    const dae = c.num?.(`dae:${u.uid}`) ?? 0;
    if (dae) unit(u.uid, { dmg: dae });
    const cp = c.num?.(`cp:${u.uid}`) ?? 0;
    if (cp) unit(u.uid, { str: RULE_ASSUMED.randomStat * cp });
  }
  if (has.has("Complete Disassembly")) for (const u of c.units) { const n = u.items.filter((i) => i === "Molecular Solvent").length; if (n) { squad({ mit: 0.04 * n }); unit(u.uid, { dealt: RULE_ASSUMED.solventDealt * n }); } }
  if (has.has("Folding Knife Blessing")) squad({ on: 0.3, dmg: 0.05 });
  if (has.has("Lucky Star Blessing")) squad({ lucky: 0.15, spd: 0.05 });
  if (has.has("Peace Pistol Blessing")) squad({ off: 0.3, energy: RULE_ASSUMED.initialEnergy });
  if (has.has("Cost of Expansion")) squad({ mit: 0.04 });
  if (has.has("Lifetime Employment")) { const n = c.since("Lifetime Employment"); squad({ str: 0.05 * n, hp: 0.05 * n }); }
  if (has.has("Evolutionary Algorithm")) { const n = c.since("Evolutionary Algorithm"); squad({ str: 0.0004 * n, mit: 0.0002 * n }); }
  if (has.has("Talent Reserve")) for (const u of c.units.filter((x) => x.cost === 3 && x.stars >= 2)) squad(u.stars === 3 ? { spd: 0.0044, dmg: 0.0088 } : { spd: 0.0011, dmg: 0.0022 });
  // Characters that fight at a higher star for this combat: the lowest-star 1-cost character.
  const oneCost = c.units.filter((x) => x.cost === 1).sort((a, b) => a.stars - b.stars)[0];
  if (has.has("Faster-Than-Light Promotion") && oneCost) { out.starUp.set(oneCost.uid, { stars: 3, mult: RULE_ASSUMED.fourStar }); unit(oneCost.uid, { str: 0.05 }); }
  else if (has.has("Star Shifting") && oneCost && oneCost.stars < 3) out.starUp.set(oneCost.uid, { stars: 3, mult: 1 });
  return out;
}

/**
 * What each named rule models. `handled` sentences are taken out of the general parser (so they aren't
 * listed as "not simulated"); `approx` names the simplification, if any.
 */
export interface RuleInfo { label: string; handled?: RegExp[]; approx?: string }
const ALL = [/.*/];
export const RULE_INFO: Record<string, RuleInfo> = {
  // ---- combat
  "Hope of the Team": { label: "first on-field character +15% DMG, +15% HP", handled: ALL },
  "Fan Club": { label: "4+ off-field: squad +15% SPD", handled: ALL },
  "Positive Energy": { label: "squad starts with 20% Energy", handled: ALL },
  "Perfect Start": { label: "+40% strength for the first half of the fight", handled: ALL, approx: "counts for half of each fight" },
  "Grassroots Contribution": { label: "+6% SPD, +4% DMG Reduction per 1-cost character (×3 at 3-star)", handled: ALL },
  "Role Model: Silver": { label: "top damage dealer +25% strength", handled: ALL, approx: "the top dealer is the strongest unit before the fight" },
  "Role Model: Gold": { label: "top damage dealer +40%, others +10% strength", handled: ALL, approx: "the top dealer is the strongest unit before the fight" },
  "Role Model: Prismatic": { label: "top damage dealer +70% strength; others echo 1% of its damage", handled: ALL, approx: "echo averaged over the fight" },
  "Sucker Punch": { label: "1000% base DMG and Fragility on the biggest enemy each wave", handled: ALL, approx: "base DMG size assumed" },
  "Volley of Arrows": { label: "(stars + 8) Wind Arrows of 1600% base DMG at the start", handled: ALL, approx: "base DMG size assumed" },
  "Precise Demolition": { label: "Heavy Strike removes the biggest enemy each wave (Boss: 50% Max HP)", handled: ALL },
  "Liquidate": { label: "executes enemies below 16% HP", handled: ALL },
  "Star Rating Suppression": { label: "+10% SPD; +20% True DMG against lower-star enemies", handled: ALL },
  "Delayed Returns": { label: "+40% DMG after 60 AV", handled: ALL },
  "Lucky One": { label: "+25% Lucky Strike Rate; +60% Lucky Strike DMG at 100% rate", handled: ALL },
  "Hit Where It Hurts: Gold": { label: "+10% Lucky Strike Rate; Lucky Strikes apply 30% Fragility", handled: ALL },
  "Lucky Dodge EX": { label: "+25% Lucky Strike Rate; hits can drop to 1 DMG", handled: ALL },
  "Overflowing Luck": { label: "+12% Lucky Strike Rate; overflow → Lucky Strike DMG", handled: ALL },
  "Lucky Spray": { label: "+25% Lucky Strike DMG", handled: ALL },
  "Faster, Luckier": { label: "+8% SPD, +12% Lucky Strike Rate spreading every 20 AV", handled: ALL },
  "In Threes and Fives": { label: "3/5+ off-field: +5%/30% SPD, +15%/65% strength", handled: ALL },
  "Supply Chain: Prismatic": { label: "+15% strength, +4% per node since", handled: ALL },
  "Supply Chain Creation: Gold": { label: "+10% SPD, +1% per node since", handled: ALL },
  "Savage Growth": { label: "2 on-field and 2 off-field characters +100% strength", handled: ALL, approx: "spread evenly over the position (random in the game)" },
  "Integrated Combat": { label: "+33% DMG Mitigation and as much DMG", handled: ALL },
  "Power of Bonds": { label: "+5% DMG, +3% Mitigation per non-independent Bond", handled: ALL },
  "Team Strength: Silver": { label: "+3% strength per non-independent Bond", handled: ALL },
  "Team Power: Gold": { label: "+6% strength, +4% HP per Bond", handled: ALL },
  "OOTD: Gold": { label: "+3% HP, +6% strength per different item", handled: ALL },
  "Onboarding Package": { label: "characters with 2 items get a recommended advanced item in combat", handled: ALL, approx: "the first recommended item they don't hold" },
  "Rise Above All": { label: "characters with 3 items: one item privileged in combat", handled: ALL, approx: "their first advanced item" },
  "Logistics Overdrive": { label: "off-field +12% Off-Field Strength per off-field star", handled: ALL },
  "Strength in Numbers": { label: "+15% strength (+25% with 9+ on-field units and memosprites)", handled: ALL },
  "Lone Wolf": { label: "characters with no non-independent Bond: +120% strength, +36% Mitigation", handled: ALL },
  "Early Push": { label: "40% action advance; +60% strength falling 1% per AV", handled: ALL, approx: "averaged over the fight" },
  "Triple Threes": { label: "3-star / 3-cost / 3 items: +10% SPD, +25% strength each", handled: ALL },
  "Trauma Team": { label: "+15% DMG, −30% Max HP; killing-blow penalty −20 AV", handled: ALL },
  "Tongue Twister": { label: "leftmost on/off-field characters share 30% of each other's strength", handled: ALL },
  "Elite Talent Investment": { label: "5-cost +15% strength and DMG; +2 XP each node", handled: ALL },
  "Intern Development Plan": { label: "1-cost +8% strength", handled: [/On\/Off-Field Strength of ally 1-Cost/i] },
  "Eidolon Ascension": { label: "on-field characters Eidolon +1", handled: ALL, approx: `counted as +${RULE_ASSUMED.eidolonStr * 100}% On-Field Strength` },
  "Tactical Eyepiece": { label: "Energy on defeating enemies", handled: ALL, approx: "as squad Energy" },
  "Tactical Eyepiece+": { label: "Energy on defeating enemies", handled: [/When ally squad defeats/i], approx: "as squad Energy" },
  "Tactical Eyepiece++": { label: "Energy on defeating enemies", handled: [/When ally squad defeats/i], approx: "as squad Energy" },
  "Middle Class": { label: "+5% Mitigation, +15% strength per 2-star character", handled: [/For each 2-star character/i] },
  "Diamonds Are Eternal": { label: "+3% DMG per node for each Diamond item a character wears", handled: [/For each Diamond/i] },
  "Complete Disassembly": { label: "advanced equipment becomes Molecular Solvent (extra hits, +4% Mitigation each)", handled: [/In this run, all your advanced equipment/i, /It will deal 3 additional/i], approx: "Solvent's extra hits as +20% DMG dealt" },
  "Combat Power Level Up": { label: "the 2-star character gains a random stat each node", handled: [/When entering a new Node, this character permanently/i], approx: `+${RULE_ASSUMED.randomStat * 100}% strength per node` },
  "Combat Power Surge": { label: "the 2-star character gains a random stat each node", handled: [/When entering a new Node, this character permanently/i], approx: `+${RULE_ASSUMED.randomStat * 100}% strength per node` },
  "Heroic Entrance": { label: "perfect victories bring the 5-cost character 1 node sooner", handled: [/After a perfect victory in combat, deployment Node/i] },
  "Rookie Veterans": { label: "a Perfect Projector at two 3-star 1-cost characters", handled: [/The first time you simultaneously have 2 3-star/i] },
  "The Sunken Arena": { label: "a Wealth Gem at the first 5-win streak", handled: ALL },
  "Surplus Capital": { label: "1 free refresh per 10 gold above 50 at each node (up to 3)", handled: [/Each time you enter a new Node, if you have more than 50/i] },
  "Surplus Capital+": { label: "1 free refresh per 10 gold above 50 at each node (up to 3)", handled: [/Each time you enter a new Node, if you have more than 50/i] },
  "IPC Armory Update: Prismatic": { label: "items in your inventory reroll each node", handled: [/When entering a new Node, equipment in the inventory/i] },
  "IPC Armory Update: Gold": { label: "items in your inventory reroll each node", handled: [/When entering a new Node, equipment in the inventory/i] },
  "IPC Armory Update: Silver": { label: "items in your inventory reroll each node", handled: [/When entering a new Node, equipment in the inventory/i] },
  "Resolution: Planet of Entertainment": { label: "double squad DMG taken; at 180 gold the rest of the run becomes Reward nodes", handled: [/Takes double DMG/i, /When entering combat, if you have 180/i] },
  "Value Investing: Prismatic": { label: "a 1-star copy each node, 2 more after each Supply", handled: [/Upon entering a new Node/i] },
  "Value Investing: Gold": { label: "a 1-star copy each node, 2 more after each Supply", handled: [/Upon entering each new Node/i] },
  "Peppy's Cameo": { label: "Peppy joins for 5 nodes, picking up advanced equipment on Perfect Clears", handled: ALL },
  "Fusion Summon": { label: "2 identical advanced items on a character fuse into the privileged one", handled: [/When a character equips 2 identical/i] },
  "Equipment Liquidation": { label: "equipment can be sold; a basic item each plane", handled: [/Equipment can be sold/i, /can be sold\.?$/i], approx: "sale prices assumed" },
  "Equipment Liquidation+": { label: "equipment can be sold; a basic item each plane", handled: [/Equipment can be sold/i, /can be sold\.?$/i], approx: "sale prices assumed" },
  "Sturdy Relay": { label: "a 3-cost character at each node", handled: [/When entering a new Node, obtain 1 more/i] },
  "Batch Recruitment": { label: "3 4-cost characters at the next Boss node", handled: [/Upon entering a Boss Node/i] },
  "Guns Ready": { label: "a basic item after each Boss", handled: [/After the boss battle/i] },
  "Guns Ready+": { label: "a basic item after each Boss", handled: [/After the boss battle/i] },
  "Obstinate": { label: "losses keep the win streak (+5 squad DMG taken)", handled: [/When combat fails/i] },
  "Empty Stock": { label: "+2 XP at a node with no equipment in stock", handled: [/When entering a new Node, if there is no equipment/i] },
  "Empty Stock+": { label: "+2 XP at a node with no equipment in stock", handled: [/When entering a new Node, if there is no equipment/i] },
  "Top 500": { label: "30 gold when a character reaches 500 strength", handled: [/When an ally character first reaches 500/i] },
  "Recycling Program": { label: "sold characters' advanced items break into basics; a basic item after 5 nodes", handled: ALL },
  "Recycling Program+": { label: "sold characters' advanced items break into basics; a basic item after 4 nodes", handled: ALL },
  "Fortune's Favor": { label: "synthesizing advanced equipment gives a Good Fortune Token instead", handled: [/When synthesizing and obtaining/i] },
  "Aha is Amused": { label: "Aha +40% DMG", handled: [/When the "Elation" Bond is activated/i, /Replaces Aha's equipment template/i], approx: "Aha's equipment choice isn't modelled" },
  "Personnel Changes": { label: "rightmost 3 bench characters reroll each node", handled: [/When entering a new Node, the 3 characters/i] },
  "Combine Like Terms": { label: "+1 gold when a refresh shows a pair", handled: [/When refreshing the Store, if 2 identical/i] },
  "Cleared With No DMG Taken": { label: "+1 gold after a fight with no knock-downs", handled: [/After combat, if no character was knocked down/i] },
  "Fortune Puppy": { label: "+1 gold per Peppy after a win", handled: [/After winning a combat without losing/i] },
  "Free Market": { label: "basic equipment arrives as Basic Weapon Boxes", handled: [/Whenever you are about to gain one piece of basic/i] },
  "Stars To Stars": { label: "+5 gold per 3-star merge", handled: [/Upon merging a 3-star character/i] },
  "Diamond Dealer": { label: "a Wealth Gem at level 9", handled: ALL },
  "Folding Knife Blessing": { label: "+30% On-Field Strength, +5% DMG", handled: [/ally squad gains 30% On-Field/i] },
  "Lucky Star Blessing": { label: "+15% Lucky Strike Rate, +5% SPD", handled: [/ally squad gains 15% Lucky/i] },
  "Peace Pistol Blessing": { label: "+30% Off-Field Strength, 15 initial Energy", handled: [/ally squad gains 30% Off-Field/i] },
  "Cost of Expansion": { label: "team size +2, +4% Mitigation, double HP loss on defeat", handled: ALL },
  "Lifetime Employment": { label: "+5% HP and strength per node; deployed characters stay", handled: ALL },
  "Faster-Than-Light Promotion": { label: "a 1-cost character fights at 4-star (+5% strength)", handled: ALL, approx: `4-star = 3-star × ${RULE_ASSUMED.fourStar}` },
  "Star Shifting": { label: "a 1-cost character fights at 3-star", handled: ALL },
  "Evolutionary Algorithm": { label: "+0.04% strength, +0.02% Mitigation per node (as the wiki prints it)", handled: ALL },
  "Talent Reserve": { label: "3 random 3-cost characters; 3-cost star-ups add SPD/DMG", handled: ALL },
  // ---- events (run.ts)
  "Cut Costs & Increase Revenue": { label: "full interest when a node passes without spending", handled: [/When entering a new Node and if you didn't spend/i] },
  "Probability Event": { label: "50% free refresh", handled: ALL },
  "Promotion Quota": { label: "buying XP upgrades a shop character's cost", handled: ALL },
  "Goldgrubber": { label: "+2 XP per paid refresh", handled: ALL },
  "Efficient Decision": { label: "unlimited free refreshes this node", handled: ALL, approx: "50 seconds = the rest of this node" },
  "Struggle Protocol": { label: "XP costs 6 HP; +50 HP after bosses", handled: ALL },
  "Ace in the Hole": { label: "survive at 40 HP once, +30 XP, +80 gold", handled: ALL },
  "Interastral Peace Insurance": { label: "gold = HP lost; +10 HP after combat", handled: ALL },
  "Exclusive Endorsement": { label: "its components become the chosen advanced item", handled: ALL, approx: "the item is picked at random from 3" },
  "Procurement Specialist: Prismatic": { label: "every 5 refreshes: 5 of your leftmost bench character's cost", handled: ALL },
  "Procurement Specialist: Gold": { label: "every 7 refreshes: 5 of your leftmost bench character's cost", handled: ALL },
  "Good Fortune Token: Prismatic": { label: "a Good Fortune Token every 4 nodes", handled: [/Each time after entering 4 Node/i] },
  "Complete Chaos": { label: "leftmost 6 bench characters reroll each node", handled: [/When entering a new node, the 6 character/i] },
  "Complete Chaos +": { label: "leftmost 6 bench characters reroll each node", handled: [/When entering a new node, the 6 character/i] },
  "Inequivalent Exchange": { label: "swap squad HP and gold", handled: ALL },
  "Twin Primes": { label: "XP on the first buy of each cost", handled: ALL },
  "Market Vitality": { label: "2-star 1/2-cost characters in the shop", handled: ALL, approx: `${RULE_ASSUMED.vitalityPerLevel * 100}% per level above 2` },
  "Don't Underestimate Our Bond": { label: "5 Emblems after a fight with 8 Bonds", handled: ALL },
  "Longtermism": { label: "7 gold now and at the next 3 nodes", handled: ALL },
  "Longtermism+": { label: "9 gold now and at the next 3 nodes", handled: ALL },
  "Market Chaos": { label: "7 free refreshes at Reward nodes", handled: ALL, approx: "the forced refreshes are free refreshes for that node" },
  "Hyperinflation": { label: "lose your gold; get it back +70 after 5 nodes", handled: ALL },
  "Surplus Value": { label: "+1 gold per 30 AV left (up to 4)", handled: ALL },
  "Cost Control": { label: "+1 HP per 10 AV left (up to 8)", handled: [/^At the end of combat/i, /Gains up to 8 squad HP/i] },
  "What a Diamond": { label: "Peppy with a Wealth Gem", handled: ALL },
  "Chimera Growth Log": { label: "2 Chimera Energy and 6 gold per level up", handled: [/When the Store levels up/i] },
  "Growth Fund": { label: "36 gold at level 9", handled: ALL },
  "Special Ops Fund": { label: "7 gold at each Boss node", handled: ALL },
  "Special Ops Funds+": { label: "11 gold at each Boss node", handled: ALL },
  "Deposit Returns": { label: "2 free refreshes after a node without spending", handled: ALL },
  "Final Payment": { label: "30 gold at the last Supply node", handled: ALL },
  "Cashback": { label: "3 gold per 3 5-cost characters bought", handled: ALL },
  "Economies of Scale": { label: "Perfect Projector at 8 copies of one character", handled: ALL },
  "Power Refresh": { label: "2 free refreshes per synthesis", handled: ALL },
  "Bare Minimum": { label: "no buying/refreshing for 3 nodes, then 20 gold", handled: ALL },
  "Market Intervention": { label: "every 4th refresh shows 3-cost characters; 5 free refreshes", handled: ALL },
  "Restore Vitality": { label: "+40 HP after the final boss", handled: ALL },
  "Full Promotion": { label: "deployed characters become ones costing 1 more", handled: [/All characters on the field permanently level up/i] },
  "Hype Squad": { label: "+1 XP per 2 characters who dealt no damage", handled: ALL },
  "Easy Mode": { label: "enemy difficulty −3", handled: ALL },
  "Difficulty Modifier": { label: "Encounter/Boss difficulty −4", handled: ALL },
  "The Joy of Growth": { label: "XP costs 1 less from level 8; +4 XP", handled: ALL },
  "Diode": { label: "Encounters are the easy or hard fight (as here)", handled: [/Encounter Nodes will only consist/i] },
  "Complimentary Upgrade": { label: "Encounter rewards one level higher", handled: ALL },
  "\"Get Out of Battle Free\" Card": { label: "skip 2 Combat nodes; +30 XP", handled: ALL },
  // ---- environments
  "Personal Accident Insurance": { label: "a Supply node before every Boss", handled: ALL },
  "Excess Budget": { label: "Supply characters carry two items", handled: ALL },
  "Blue Ocean": { label: "a random Investment Environment and 6 gold", handled: ALL },
  "Shift Rotation": { label: "one random cost twice as common each node", handled: ALL },
  "War Frontier": { label: "Third Plane Combat nodes become Encounters", handled: ALL },
  "Economic Overheat": { label: "Reward nodes drop more", handled: ALL, approx: `${RULE_ASSUMED.overheatLoot}× Reward loot (the wiki says only "more")` },
  "Economic Hyperheat": { label: "Reward nodes drop more", handled: ALL, approx: `${RULE_ASSUMED.hyperheatLoot}× Reward loot (the wiki says only "tons")` },
  "Long-Term Gains": { label: "after 30 paid refreshes: 20 gold, refreshes cost 1", handled: ALL },
  "Success Experience": { label: "from level 8: +12 XP at the next 3 nodes", handled: ALL },
};

/** Sentences of an Environment/Strategy text that a named rule handles (left out of the general parser). */
export function ruleHandled(name: string, text: string): string[] {
  const r = RULE_INFO[name];
  if (!r?.handled) return [];
  const sentences = text.split(/(?<=[.!])\s+/);
  return sentences.filter((sen) => r.handled!.some((re) => re.test(sen)));
}
