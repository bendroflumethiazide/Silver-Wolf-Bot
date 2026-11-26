/**
 * What equipment and Bonds actually do in a fight.
 *
 * Every number is read from the wiki text in the pack (item stat lines and effects, Bond level
 * effects). The wiki text sets *what* an effect does and its size; how a stat turns into the
 * simulator's single "strength" number (the weights in EFFECT_WEIGHTS) and a few unstated values
 * (summons' base SPD, the share of damage a summon deals) are stated assumptions (SUMMON_ASSUMED).
 */
import { parseStatLine, type StatKey } from "./stats";
import { baseItem, isPrivileged } from "./items";
import { specialItem } from "./specialItems";
import type { BondState, CwPack } from "./sim";

export interface Stats {
  /** On-Field / Off-Field Strength (only the one matching the position counts) and both. */
  on: number; off: number; str: number;
  dmg: number; lucky: number; luckyDmg: number; spd: number;
  hp: number; mit: number; brk: number; support: number; energy: number;
  /** "DMG dealt becomes 115%": extra share of damage. */
  dealt: number;
}
export const zeroStats = (): Stats => ({ on: 0, off: 0, str: 0, dmg: 0, lucky: 0, luckyDmg: 0, spd: 0, hp: 0, mit: 0, brk: 0, support: 0, energy: 0, dealt: 0 });
export function addStats(a: Stats, b: Partial<Stats>, k = 1): Stats {
  const out = { ...a };
  for (const key of Object.keys(b) as (keyof Stats)[]) out[key] += (b[key] ?? 0) * k;
  return out;
}

/** How stats turn into strength (assumed weights; Lucky Strike counts at its base 100% DMG). */
export const EFFECT_WEIGHTS = { spd: 0.6, hp: 0.5, mit: 0.5, brk: 0.25, support: 0.25, energyPer: 1 / 200, softCap: 4 } as const;

/** Strength multiplier for a unit in a position. Strength adds up; the rest is soft-capped so stacks don't explode. */
export function powerMult(s: Stats, place: "on" | "off"): number {
  const strength = 1 + (place === "on" ? s.on : s.off) + s.str;
  const extra = s.dmg + s.lucky * (1 + s.luckyDmg) + s.luckyDmg * 0.05 + EFFECT_WEIGHTS.spd * s.spd + EFFECT_WEIGHTS.hp * s.hp + EFFECT_WEIGHTS.mit * s.mit
    + EFFECT_WEIGHTS.brk * s.brk + EFFECT_WEIGHTS.support * s.support + EFFECT_WEIGHTS.energyPer * s.energy;
  const soft = extra >= 0 ? extra / (1 + extra / EFFECT_WEIGHTS.softCap) : extra;
  return Math.max(0, strength) * (1 + soft) * (1 + s.dealt);
}

const KEY: Record<StatKey, keyof Stats> = {
  onField: "on", offField: "off", dmgAmp: "dmg", basicAmp: "dmg", skillAmp: "dmg", ultAmp: "dmg", fuaAmp: "dmg", dotAmp: "dmg", breakAmp: "dmg", elationAmp: "dmg",
  mitigation: "mit", luckyRate: "lucky", luckyDmg: "luckyDmg", spdAmp: "spd", healing: "support", shield: "support", hpAmp: "hp", breakEff: "brk", initialEnergy: "energy",
};
/** Specific DMG types (Basic ATK, DoT, …) count less than plain DMG Amplification. */
const PARTIAL: Partial<Record<StatKey, number>> = { basicAmp: 0.5, skillAmp: 0.5, ultAmp: 0.4, fuaAmp: 0.6, dotAmp: 0.7, breakAmp: 0.6, elationAmp: 0.6 };

/** "On-Field Strength 25%/50%" → stats (privileged = second value). */
export function statLine(line: string, privileged = false): Partial<Stats> {
  const p = parseStatLine(line);
  if (!p) return {};
  const second = /\/([\d.]+)%?\s*$/.exec(line.trim());
  const v = privileged && second ? Number(second[1]) : p.value;
  const out: Partial<Stats> = {};
  for (const k of p.keys) out[KEY[k]] = (out[KEY[k]] ?? 0) + (k === "initialEnergy" ? v : (v / 100) * (PARTIAL[k] ?? 1));
  return out;
}

export interface ItemCtx { place: "on" | "off"; stars: number; boss: boolean; privileged?: boolean }
export interface ItemEffect { self: Partial<Stats>; squad: Partial<Stats>; notes: string[] }

const NUM = String.raw`([\d.]+)%?(?:\/([\d.]+)%?)?`;
/** Average stacks of a "stackable" effect over a fight (assumed). */
export const STACKS = 2;

/** One item's stats and passive. */
export function itemEffect(pack: CwPack, name: string, ctx: ItemCtx): ItemEffect {
  const eq = pack.equipment;
  const out: ItemEffect = { self: {}, squad: {}, notes: [] };
  const add = (to: "self" | "squad", s: Partial<Stats>, k = 1) => { for (const key of Object.keys(s) as (keyof Stats)[]) out[to][key] = (out[to][key] ?? 0) + (s[key] ?? 0) * k; };
  const basic = eq?.basic.find((b) => b.name === name);
  if (basic) { for (const l of basic.stats.split(" · ")) add("self", statLine(l)); return out; }
  const sp = specialItem(name);
  if (sp) { if (sp.stats) add("self", sp.stats); else if (sp.kind === "component" && name !== "Imploding Singularity") add("self", { str: sp.power ?? 0.15 }); return out; }
  // Privileged equipment: the advanced item's second (privileged) values.
  if (isPrivileged(name)) return itemEffect(pack, baseItem(name), { ...ctx, privileged: true });
  const em = eq?.emblems?.find((e) => e.name === name);
  if (em) { for (const l of em.stats) add("self", statLine(l)); return out; }
  const adv = eq?.advanced.find((a) => a.name === name);
  if (!adv) return out;
  for (const l of adv.stats) add("self", statLine(l, ctx.privileged));
  // The passive.
  const t = adv.effect.replace(/\s+/g, " ");
  const v = (m: RegExpExecArray, i = 1) => Number(ctx.privileged && m[i + 1] ? m[i + 1] : m[i]) / 100;
  let m: RegExpExecArray | null;
  const hit = (note: string) => out.notes.push(note);
  if ((m = new RegExp(`ally squad's on-field/off-field strength by ${NUM}`, "i").exec(t))) { add("squad", { str: v(m) }); hit(`squad +${Math.round(v(m) * 100)}% strength`); }
  if ((m = new RegExp(`all allies' SPD Amplification by ${NUM}`, "i").exec(t))) { add("squad", { spd: v(m) }); hit(`squad +${Math.round(v(m) * 100)}% SPD`); }
  if ((m = new RegExp(`ally squad's Lucky Strike Rate by ${NUM}`, "i").exec(t))) { add("squad", { lucky: v(m) }); hit(`squad +${Math.round(v(m) * 100)}% Lucky Strike Rate`); }
  if ((m = new RegExp(`ally squad gains ${NUM} DMG Mitigation`, "i").exec(t))) { add("squad", { mit: v(m) }); hit(`squad +${Math.round(v(m) * 100)}% DMG Mitigation`); }
  if ((m = new RegExp(`ally squad's Max HP by ${NUM}`, "i").exec(t))) { add("squad", { hp: v(m) }); hit(`squad +${Math.round(v(m) * 100)}% HP`); }
  if ((m = new RegExp(`reducing their DMG dealt by ${NUM}`, "i").exec(t))) { add("squad", { mit: v(m) }); hit("enemies Weakened"); }
  if ((m = new RegExp(`"Fragility".*?DMG taken by ${NUM}`, "i").exec(t))) { add("squad", { dmg: v(m) * 0.5 }); hit("Fragility on its targets"); }
  if ((m = new RegExp(`DMG dealt by the wearer becomes ${NUM} of the original`, "i").exec(t))) { add("self", { dealt: v(m) - 1 }); hit(`deals ${Math.round(v(m) * 100)}% DMG`); }
  if (/action advances by 100%/i.test(t)) { add("self", { spd: 0.25 }); hit("acts first"); }
  if ((m = new RegExp(`gains ${NUM} SPD Amplification and ${NUM} DMG Amplification\\. When the wearer is 2/3-star or higher, these amplifications respectively increase to 3/6 times`, "i").exec(t))) {
    const k = ctx.stars >= 3 ? 6 : ctx.stars >= 2 ? 3 : 1;
    add("self", { spd: v(m) * k, dmg: v(m, 3) * k }); hit(`×${k} at ${ctx.stars}★`);
  } else if ((m = new RegExp(`DMG Amplification increases by ${NUM}, and they gain an additional ${NUM} in Encounter and Boss Nodes`, "i").exec(t))) {
    add("self", { dmg: v(m) + (ctx.boss ? v(m, 3) : 0) }); hit(ctx.boss ? "doubled here" : "doubles in Encounter/Boss nodes");
  } else if ((m = new RegExp(`for every 10 SPD the wearer has, they gain ${NUM} On-Field Strength and ${NUM} Off-Field Strength`, "i").exec(t))) {
    add("self", { on: v(m) * 11, off: v(m, 3) * 11 }); hit("about 110 SPD assumed");
  } else if ((m = new RegExp(`if the wearer is (on|off)-field, increases their Lucky Strike DMG by ${NUM}`, "i").exec(t))) {
    if (m[1].toLowerCase() === ctx.place) { add("self", { luckyDmg: v(m, 2) }); hit("position bonus active"); } else hit(`needs ${m[1]}-field`);
  } else if ((m = new RegExp(`Others: ${NUM} DMG Mitigation`, "i").exec(t))) {
    add("self", { mit: v(m) }); hit("Path bonus (other Paths) assumed");
  } else if ((m = new RegExp(`For every 1 Skill Point consumed by the wearer, DMG Amplification increases by ${NUM}`, "i").exec(t))) {
    add("self", { dmg: v(m) * 5 }); hit("about 5 Skill Points per fight assumed");
  } else if ((m = new RegExp(`every 1000 HP increases Lucky Strike Rate by ${NUM}, up to ${NUM}`, "i").exec(t))) {
    add("self", { lucky: v(m, 3) * 0.3 }); hit("part of the cap assumed");
  } else if ((m = new RegExp(`Increases Break Effect by ${NUM}`, "i").exec(t))) {
    add("self", { brk: v(m) }); hit("Break Effect");
  } else if ((m = new RegExp(`increases their On-Field Strength by ${NUM}`, "i").exec(t)) && /ability on an ally/i.test(t)) {
    add("squad", { on: v(m) * 0.3 }); hit("buffs an ally (about a third of the time)");
  } else if (/starts with (\d+) stack/i.test(t) || /stackable|Each time the wearer|After each attack|At the start of the wearer's turn|After the wearer (?:defeats|is attacked)|Every time the wearer uses/i.test(t)) {
    const stacks = STACKS + Number(/starts with (\d+) stack/i.exec(t)?.[1] ?? 0) * 0.5;
    let any = false;
    const STAT = "(SPD Amplification|on-field/off-field strength|On/Off-Field Strength|DMG Amplification|Lucky Strike Rate|Lucky Strike DMG|HP Amplification)";
    const keyOf = (w: string): keyof Stats => (/SPD/i.test(w) ? "spd" : /strength/i.test(w) ? "str" : /Lucky Strike Rate/i.test(w) ? "lucky" : /Lucky Strike DMG/i.test(w) ? "luckyDmg" : /HP/i.test(w) ? "hp" : "dmg");
    // "SPD Amplification increases by 12%/24%" and "gains 6%/12% On/Off-Field Strength".
    for (const mm of t.matchAll(new RegExp(`${STAT}(?: increases)? by ${NUM}`, "gi"))) { add("self", { [keyOf(mm[1])]: (ctx.privileged && mm[3] ? Number(mm[3]) : Number(mm[2])) / 100 * stacks } as Partial<Stats>); any = true; }
    if (!any) for (const mm of t.matchAll(new RegExp(`gains ${NUM} ${STAT}`, "gi"))) { add("self", { [keyOf(mm[3])]: (ctx.privileged && mm[2] ? Number(mm[2]) : Number(mm[1])) / 100 * stacks } as Partial<Stats>); any = true; }
    if (any) hit(`stacks (about ${stacks} on average)`);
  }
  // Effects with no number to read: a fixed share (assumed).
  const fixed: [RegExp, Partial<Stats>, "self" | "squad", string][] = [
    [/provides a Shield .* to all on-field allies/i, { mit: 0.12 }, "squad", "shields the squad"],
    [/provides a Shield equal to .* DEF/i, { mit: 0.08 }, "squad", "emergency shields"],
    [/grants them [\d.]+%(?:\/[\d.]+%)? DMG Mitigation/i, { mit: 0.06 }, "squad", "mitigation on healed allies"],
    [/When ally squad takes action, restore HP/i, { mit: 0.08 }, "squad", "heals the squad"],
    [/deals True DMG to one random target/i, { dmg: 0.06 }, "self", "extra True DMG"],
    [/regenerates [\d/]+ Energy for each action value spent|regenerates a fixed amount of Energy/i, { dmg: 0.08 }, "self", "more Ultimates"],
    [/When entering combat, activates the wearer's Ultimate/i, { dmg: 0.2 }, "self", "Ultimate at the start"],
    [/recovers 1 Skill Point|recovers [\d/]+ Skill Point/i, { dmg: 0.04 }, "squad", "Skill Points"],
  ];
  for (const [re, s, to, note] of fixed) if (re.test(t)) { add(to, s); hit(note); }
  if (/randomly equips the character with two items/i.test(t)) hit("two random items each node");
  return out;
}

// --------------------------------------------------------------------------------------------- Bonds

export interface Summon {
  name: string;
  bond: string;
  emoji: string;
  /** SPD on the action bar. */
  spd: number;
  /** Share of the squad's strength it adds (or a fixed strength when `power` is set). */
  share: number;
  power?: number;
  /** A real character (Dan Heng • Permansor Terrae): shown with a portrait and stars. */
  character?: { name: string; cost: number; stars: 1 | 2 | 3; place: "on" | "off" };
  note: string;
}

export const SUMMON_ASSUMED = {
  crimsonThornsSpd: 200, starskiffSpd: 100, svarogSpd: 90, chimeraSpd: 100, summonSpd: 110, ahaSpd: 100,
  maxChimeras: 5,
} as const;

export interface BondCtx {
  /** Deployed (non-NPC) characters. */
  placed: { uid: number; name: string; cost: number; stars: number; items: string[]; place: "on" | "off"; base: number }[];
  /** Nodes entered so far this run (Chimera Energy, Clara's modifications). */
  nodes: number;
  /** Extra Chimera Energy from Strategies. */
  chimeraEnergy?: number;
  /** AV limit of this fight. */
  av: number;
  boss: boolean;
  storeLevel: number;
  /** Advanced-equipment check (Xianzhou Fleet). */
  isBasic: (item: string) => boolean;
}
export interface BondEffect { bond: string; members: Partial<Stats>; squad: Partial<Stats>; perUnit: Map<number, Partial<Stats>>; summons: Summon[]; notes: string[] }

const pct = (m: RegExpExecArray | null, i = 1) => (m ? Number(m[i].replace(/,/g, "")) / 100 : 0);
/** Stats a Bond level's text grants: [members, squad]. */
export function levelStats(text: string): [Partial<Stats>, Partial<Stats>] {
  const members: Partial<Stats> = {}, squad: Partial<Stats> = {};
  for (const sen of text.split(/(?<=[.!])\s+/)) {
    const to = /ally squad|all allies|squad gains/i.test(sen) ? squad : members;
    const add = (k: keyof Stats, v: number) => { to[k] = (to[k] ?? 0) + v; };
    let m: RegExpExecArray | null;
    if ((m = /([\d.]+)%\s*On(?:-Field)?(?:\/|-\/|\s*\/\s*)Off-Field Strength|([\d.]+)%\s*On-\/Off-Field Strength/i.exec(sen))) add("str", pct(m, m[1] ? 1 : 2));
    if ((m = /([\d.]+)%\s*(?:Break )?DMG Amplification/i.exec(sen))) add("dmg", pct(m));
    if ((m = /([\d.]+)%\s*DoT Amplification/i.exec(sen))) add("dmg", pct(m) * 0.7);
    if ((m = /([\d.]+)%\s*Lucky Strike(?: Rate)?/i.exec(sen))) add("lucky", pct(m));
    if ((m = /([\d.]+)%\s*SPD Amplification/i.exec(sen))) add("spd", pct(m));
    if ((m = /([\d.]+)%\s*DMG Mitigation/i.exec(sen))) add("mit", pct(m));
    if ((m = /([\d.]+)%\s*HP Amplification/i.exec(sen))) add("hp", pct(m));
    if ((m = /Healing Strength increases by ([\d.]+)%|([\d.]+)%\s*Healing Strength|([\d.]+)%\s*Shield Strength/i.exec(sen))) add("support", Number(m[1] ?? m[2] ?? m[3]) / 100);
    if ((m = /DMG taken by the enemy increases by ([\d.]+)%|increases DMG taken by all enemies by ([\d.]+)%/i.exec(sen))) squad.dmg = (squad.dmg ?? 0) + Number(m[1] ?? m[2]) / 100;
    if ((m = /DMG dealt decreases by ([\d.]+)%/i.exec(sen))) squad.mit = (squad.mit ?? 0) + Number(m[1]) / 100;
    if ((m = /([\d.]+)%\s*"?Combo Rate/i.exec(sen))) add("dmg", pct(m) * 0.6);
  }
  return [members, squad];
}

/** The effect of one active Bond in this fight: member/squad stats, per-unit stats and summons. */
export function bondEffect(pack: CwPack, b: BondState, ctx: BondCtx): BondEffect {
  const name = b.bond.name;
  const family = name.replace(/: .*$/, "");
  const lvl = b.active?.count ?? 0;
  const out: BondEffect = { bond: name, members: {}, squad: {}, perUnit: new Map(), summons: [], notes: [] };
  if (!b.active || b.bond.category === "Plot Armor") return out;
  const mine = ctx.placed.filter((u) => b.bond.members.includes(u.name));
  const addTo = (s: Partial<Stats>, more: Partial<Stats>, k = 1) => { for (const key of Object.keys(more) as (keyof Stats)[]) s[key] = (s[key] ?? 0) + (more[key] ?? 0) * k; };
  const unit = (uid: number, more: Partial<Stats>) => { const cur = out.perUnit.get(uid) ?? {}; addTo(cur, more); out.perUnit.set(uid, cur); };
  // Constant effects written in the Bond's summary (e.g. DoT "Ally squad gains 20% DMG Mitigation"), then the highest active level.
  const [sm, ss] = levelStats(b.bond.summary);
  const [lm, ls] = levelStats(b.active.effect);
  addTo(out.members, sm); addTo(out.squad, ss); addTo(out.members, lm); addTo(out.squad, ls);
  const parsed = Object.keys(out.members).length + Object.keys(out.squad).length > 0;
  const av = ctx.av;
  const actions = (spd: number) => Math.max(1, Math.floor((av * spd) / 10000));

  switch (family) {
    case "DoT": {
      const spd = lvl >= 9 ? 500 : lvl >= 5 ? 300 : SUMMON_ASSUMED.crimsonThornsSpd;
      // Its finalization multiplier grows 40% per DoT an ally inflicts (DoT members are the ones inflicting).
      const share = (0.06 + 0.03 * mine.length) * (lvl >= 7 ? 1.5 : 1) * (lvl >= 9 ? 2.5 : 1);
      out.summons.push({ name: "Crimson Thorns", bond: name, emoji: "🌹", spd, share, note: `${spd} SPD; detonates DoT (+40% finalization per DoT inflicted)${lvl >= 7 ? ", extra DoT instance" : ""}` });
      break;
    }
    case "Xianzhou Fleet": {
      const gear = mine.reduce((n, u) => n + u.items.length, 0);
      addTo(out.members, { dmg: 0.04 * gear });
      // Before combat, basic equipment of members temporarily becomes advanced (recommended at 4, privileged at 9).
      const basics = mine.flatMap((u) => u.items.filter(ctx.isBasic).map(() => u.uid));
      const n = lvl >= 6 ? basics.length : lvl >= 4 ? 3 : 1;
      const bump = lvl >= 9 ? 0.45 : lvl >= 4 ? 0.35 : 0.25;
      for (const uid of basics.slice(0, n)) unit(uid, { str: bump });
      if (basics.length) out.notes.push(`${Math.min(n, basics.length)} basic equipment → ${lvl >= 9 ? "privileged" : "advanced"}`);
      out.summons.push({ name: "Starskiff", bond: name, emoji: "🚀", spd: SUMMON_ASSUMED.starskiffSpd + 20 * gear, share: 0.04 + 0.012 * gear + (lvl >= 4 ? 0.1 : 0), note: `+20 SPD per equipment on members (${gear})${lvl >= 4 ? "; True DMG from members' total" : ""}` });
      break;
    }
    case "High-Cloud Quintet": {
      const steps: [number, number, number, number][] = [[2, 200, 300, 0.1], [3, 250, 600, 0.2], [4, 300, 1200, 0.4], [5, 400, 2400, 0.6]];
      const [, spd, mult, amp] = [...steps].reverse().find(([c]) => lvl >= c) ?? steps[0];
      const acts = actions(spd);
      addTo(out.squad, { dmg: amp * Math.min(acts, 6) * 0.5 });
      out.summons.push({ name: "Quintet Joint", bond: name, emoji: "🎐", spd, share: Math.min(1.2, (mult / 100) * acts * 0.01), note: `${mult}% base DMG; squad +${Math.round(amp * 100)}% DMG Amplification per attack (stacks)` });
      break;
    }
    case "AoE ATK": {
      if (ctx.boss) addTo(out.squad, { dmg: 0.5 * [4, 6, 8].filter((c) => lvl >= c).length });
      if (lvl >= 6) out.summons.push({ name: "Soul", bond: name, emoji: "👻", spd: 300, share: lvl >= 8 ? 0.2 : 0.12, note: "records DMG taken by the highest-HP enemy and releases it as True DMG" });
      break;
    }
    case "Elation": {
      const stars = lvl >= 8 ? 4 : lvl >= 6 ? 3 : lvl >= 5 ? 2 : 1;
      addTo(out.squad, { str: 0.03 * stars });
      out.summons.push({ name: "Aha", bond: name, emoji: "🎭", spd: SUMMON_ASSUMED.ahaSpd, share: 0.02 * stars, note: `${stars}★ Aha with ${Math.min(4, stars + 1)} equipment slots buffs the squad` });
      break;
    }
    case "Twin Dragons' Call": {
      const dhil = mine.find((u) => u.name === "Dan Heng • Imbibitor Lunae");
      const pt = pack.characters.find((c) => c.name === "Dan Heng • Permansor Terrae");
      if (dhil && pt && !mine.some((u) => u.name === pt.name)) {
        const stars = Math.min(3, dhil.stars) as 1 | 2 | 3;
        out.summons.push({ name: pt.name, bond: name, emoji: "🐉", spd: 100, share: 0, character: { name: pt.name, cost: pt.cost, stars, place: "off" }, note: `copies ${stars} of Dan Heng • Imbibitor Lunae's equipment` });
      }
      break;
    }
    case "Ingenious Artificer": {
      const clara = mine[0];
      if (clara) {
        const mods = ctx.nodes <= 3 ? ctx.nodes : 3 + Math.floor((ctx.nodes - 3) / 2);
        unit(clara.uid, { dmg: 0.06 * mods });
        out.summons.push({ name: "Svarog", bond: name, emoji: "🤖", spd: SUMMON_ASSUMED.svarogSpd, share: 0, power: clara.base * 0.25 * (1 + 0.06 * mods), note: `${mods} modifications (+${mods * 6}% DMG Amplification for Clara)` });
      }
      break;
    }
    case "Beast Garden": {
      const per = lvl >= 7 ? 2 : lvl >= 5 ? 3 : 4;
      const n = Math.min(SUMMON_ASSUMED.maxChimeras, Math.floor((ctx.nodes + (ctx.chimeraEnergy ?? 0)) / per));
      for (let i = 0; i < n; i++) out.summons.push({ name: `Chimera ${i + 1}`, bond: name, emoji: "🦄", spd: SUMMON_ASSUMED.chimeraSpd + (lvl >= 7 ? 40 : 0), share: 0.025 * (lvl >= 7 ? 2.5 : 1) * (lvl >= 10 ? 2 : 1), note: `recruited with Chimera Energy (1 per node, ${per} per chimera)` });
      break;
    }
    case "Summon": {
      const power = Number(/(\d+) point\(s\) of "Summon Power/i.exec(b.active.effect)?.[1] ?? 1);
      for (const u of mine) out.summons.push({ name: `${u.name}'s summon`, bond: name, emoji: "✨", spd: SUMMON_ASSUMED.summonSpd, share: 0, power: u.base * 0.1 * power, note: `Summon Power ${power}` });
      break;
    }
    case "Astropolis Merchant Guild": {
      const stars = mine.reduce((n, u) => n + u.stars, 0);
      addTo(out.members, { lucky: 0.02 * stars * (lvl >= 3 ? 2 : 1), luckyDmg: 0.02 * stars * (lvl >= 3 ? 2 : 1) });
      break;
    }
    case "Stellaron Hunters": {
      const pieces = lvl >= 5 ? 3 : lvl >= 3 ? 2 : 1;
      const [wear, squad] = lvl >= 7 ? [0.6, 0.24] : lvl >= 5 ? [0.3, 0.12] : [0.2, 0.08];
      out.members = {};
      for (const u of mine.slice(0, pieces)) unit(u.uid, { dmg: wear * 2 });
      addTo(out.squad, { dmg: squad * pieces });
      out.notes.push(`${pieces} Script Equipment`);
      break;
    }
    case "Intertwined Dreamscapes": {
      out.members = {};
      const dancers = [...mine].sort((a, c) => c.base - a.base).slice(0, 2);
      // Level 2 only triggers "Dance of Two" (a joint attack); 3+ adds the listed buffs.
      const [str, spd] = lvl >= 5 ? [1.2, 0.6] : lvl >= 4 ? [0.8, 0.4] : lvl >= 3 ? [0.4, 0.2] : [0.15, 0];
      for (const d of dancers) unit(d.uid, { str, spd, dmg: 0.1 });
      out.notes.push(`dancers: ${dancers.map((d) => d.name).join(" & ")}`);
      break;
    }
    case "Galactic Voyager": {
      const bonus = Number(/([\d.]+)% bonus/i.exec(b.active.effect)?.[1] ?? 100) / 100;
      out.squad = { str: 0.1 * bonus };
      out.members = { str: 0.1 * bonus };
      break;
    }
    case "Girls Band": {
      out.squad = { str: b.count === 4 ? 0.3 : b.count === 1 ? 0.1 : 0 };
      break;
    }
    case "Phantasmoon Games": {
      if (/Roll-Call/.test(name)) {
        out.members = {};
        if (lvl >= 3 && ctx.placed.length) { const top = [...ctx.placed].sort((a, c) => c.base - a.base)[0]; unit(top.uid, { str: 0.3 }); out.notes.push(`${top.name} performs Roll-Call`); }
        if (lvl >= 9) addTo(out.squad, { str: 2 });
      }
      if (/Experience/.test(name)) {
        const each = Number(/additionally increases ([\d.]+)%/i.exec(b.active.effect)?.[1] ?? /For every level, grants ([\d.]+)%/i.exec(b.active.effect)?.[1] ?? 0) / 100;
        addTo(out.members, { str: each * ctx.storeLevel });
      }
      break;
    }
    case "Flame Reaver": addTo(out.members, { dmg: 0.3 }); break;
    case "Galaxy Ranger": {
      // Ashveil appoints an on-field character (here: the strongest other one); its star rating multiplies the bonus.
      const ranger = [...ctx.placed].filter((u) => u.place === "on" && !b.bond.members.includes(u.name)).sort((a, c) => c.base - a.base)[0] ?? mine[0];
      if (ranger) { const k = [1, 2, 4, 8][Math.min(3, ranger.stars - 1)]; unit(ranger.uid, { dmg: 0.12 * k, spd: 0.12 * k }); out.notes.push(`Galaxy Ranger: ${ranger.name}`); }
      out.members = {};
      break;
    }
  }
  // Bonds whose effects aren't stats (store, items): a modest share for members (the old model), so they still count.
  if (!parsed && !out.summons.length && !out.perUnit.size && !Object.keys(out.members).length && !Object.keys(out.squad).length) {
    out.members = { str: ({ bronze: 0.08, silver: 0.12, gold: 0.18, plat: 0.25 } as Record<string, number>)[b.tier ?? "bronze"] ?? 0.08 };
    out.notes.push("non-combat effects (store, items) → small member bonus");
  }
  return out;
}
