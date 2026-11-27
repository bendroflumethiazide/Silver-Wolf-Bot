/**
 * Every character's Currency Wars kit in combat (Version 4.7), read from their wiki ability table for the
 * position they stand in.
 *
 * A character's own damage is already in their wiki On-/Off-Field Strength, so the kit adds what changes
 * the TEAM or the BATTLE: squad buffs (ATK, DMG, CRIT, SPD), enemy vulnerability and DEF reduction,
 * immediate action / action advance for allies, Energy for allies, shields and healing, named summons,
 * "acts at X% SPD", Follow-Up ATK and extra turns. Each ability sentence is classified so the audit shows
 * what is modelled, what the character's strength already covers, and what isn't modelled.
 * How each stat turns into strength uses combat.ts's weights; the uptime/crit assumptions are in KIT_ASSUMED.
 */
import { groupFor } from "./abilities";
import type { Stats } from "./combat";
import type { CwCharInfo } from "./parse";
import { ELATION_KITS } from "./elation";

export const KIT_ASSUMED = {
  /** Share of a fight a timed buff or debuff is up. */
  uptime: 0.6,
  /** CRIT DMG is worth this share of DMG (about half the hits crit); CRIT Rate at 100% CRIT DMG. */
  critDmgWeight: 0.5,
  critRateWeight: 1,
  /** A named summon adds this share of its owner's strength per star. */
  summonShare: [0.12, 0.16, 0.22, 0.3],
  /** An "immediate action" / action advance for an ally ≈ this much SPD for the squad. */
  actionShare: 0.15,
} as const;

export type Coverage = "modelled" | "elation" | "strength" | "other";
export interface KitLine { ability: string; types: string[]; text: string; status: Coverage; effect?: string }
export interface KitEffect {
  self: Partial<Stats>;
  squad: Partial<Stats>;
  summons: { name: string; share: number; note: string }[];
  lines: KitLine[];
}

/** "100%/125%/180%" → the value for a star (1-based), as a number (percent stays percent). */
export function starValue(text: string, stars: number): number {
  const parts = text.replace(/,/g, "").split("/").map((x) => parseFloat(x));
  return parts[Math.min(stars - 1, parts.length - 1)] ?? parts[0] ?? 0;
}
const NUM = String.raw`(\d[\d,.]*%?(?:\s*\/\s*\d[\d,.]*%?)*)`;
const pctOf = (m: RegExpExecArray, i: number, stars: number) => starValue(m[i], stars) / 100;

const SQUAD = /(ally squad|all allies|all ally|allies'|team|on-field allies|ally characters|other members|teammates)/i;

const CACHE = new WeakMap<object, Map<string, KitEffect>>();
/** Read one character's kit for a position (cached per character data). */
export function kitEffect(info: CwCharInfo | null | undefined, name: string, stars: number, place: "on" | "off" | "bench", cost?: number): KitEffect {
  if (!info) return { self: {}, squad: {}, summons: [], lines: [] };
  const key = `${name}|${stars}|${place}|${cost ?? ""}`;
  let m = CACHE.get(info);
  if (!m) { m = new Map(); CACHE.set(info, m); }
  const hit = m.get(key);
  if (hit) return hit;
  const k = readKit(info, name, stars, place, cost);
  m.set(key, k);
  return k;
}

function readKit(info: CwCharInfo | null | undefined, name: string, stars: number, place: "on" | "off" | "bench", cost?: number): KitEffect {
  const out: KitEffect = { self: {}, squad: {}, summons: [], lines: [] };
  const group = groupFor(info, place, cost);
  if (!group) return out;
  const add = (to: Partial<Stats>, k: keyof Stats, v: number) => { to[k] = (to[k] ?? 0) + v; };
  // Shields and healing count fully once per character (a kit describes them in several lines).
  const seen = new Set<string>();
  const once = (key: string, to: Partial<Stats>, k: keyof Stats, v: number) => { add(to, k, seen.has(key) ? v * 0.15 : v); seen.add(key); };
  for (const a of group.list) {
    for (const sen of a.effect.split(/(?<=[.!])\s+|\n/).map((x) => x.trim()).filter(Boolean)) {
      const line: KitLine = { ability: a.name, types: a.types, text: sen, status: "other" };
      const done = (effect: string) => { line.status = "modelled"; line.effect = line.effect ? `${line.effect}; ${effect}` : effect; };
      let m: RegExpExecArray | null;
      // Who a buff is for, clause by clause ("this unit's CRIT DMG …, and DMG dealt by the ally squad …").
      const clauses = sen.split(/,\s*and\s+|;\s*|\.\s+/);
      const clauseOf = (frag: string) => clauses.find((c) => c.includes(frag)) ?? sen;
      const forSquad = (frag: string) => SQUAD.test(clauseOf(frag)) && !/this unit's|(?:^|\s)(?:its|her|his|their) own/i.test(clauseOf(frag));
      let selfBuff = false;
      // A character's buffs to themselves are part of their wiki strength: noted, not added again.
      const buff = (frag: string, k: keyof Stats, v: number, label: string) => {
        if (forSquad(frag)) { add(out.squad, k, v); done(`squad ${label}`); } else { selfBuff = true; line.effect = line.effect ? `${line.effect}; self ${label}` : `self ${label}`; }
      };
      const toSquad = SQUAD.test(sen);
      // Acts at X% SPD.
      if ((m = new RegExp(`acts at ${NUM} SPD`, "i").exec(sen))) { selfBuff = true; line.effect = `acts at ${Math.round(pctOf(m, 1, stars) * 100)}% SPD`; }
      // Stat buffs.
      if ((m = new RegExp(`ATK (?:increases|increased) by ${NUM}`, "i").exec(sen)) || (m = new RegExp(`increases (?:the )?(?:ally squad's |all allies' )?ATK by ${NUM}`, "i").exec(sen))) buff(m[0], "dmg", pctOf(m, 1, stars) * 0.4 * KIT_ASSUMED.uptime, "ATK");
      if ((m = new RegExp(`(?<!Lucky Strike |Elation |Ultimate |Skill |Basic ATK |Follow-Up ATK |DoT |Break |CRIT )DMG (?:dealt )?(?:Boost |Amplification )?(?:increases|increased) by ${NUM}`, "i").exec(sen)) || (m = new RegExp(`increases (?:their |its )?DMG dealt by ${NUM}`, "i").exec(sen))) buff(m[0], "dmg", pctOf(m, 1, stars) * KIT_ASSUMED.uptime, "DMG");
      if ((m = new RegExp(`CRIT DMG (?:additionally )?(?:increases|increased) by (?:an amount equal to )?${NUM}`, "i").exec(sen))) buff(m[0], "dmg", pctOf(m, 1, stars) * KIT_ASSUMED.critDmgWeight * KIT_ASSUMED.uptime, "CRIT DMG");
      if ((m = new RegExp(`CRIT Rate (?:increases|increased|by) (?:by )?${NUM}`, "i").exec(sen))) buff(m[0], "dmg", pctOf(m, 1, stars) * KIT_ASSUMED.critRateWeight * KIT_ASSUMED.uptime * 0.5, "CRIT Rate");
      if ((m = new RegExp(`SPD (?:increases|increased|is increased) by ${NUM}(?!\\s*points?)`, "i").exec(sen)) && !/Aha/.test(sen)) { const v = /%/.test(m[1]) ? pctOf(m, 1, stars) : starValue(m[1], stars) / 100; buff(m[0], "spd", v * KIT_ASSUMED.uptime, "SPD"); }
      // Enemy debuffs help everyone.
      if ((m = new RegExp(`DMG taken by (?:the )?(?:enemy|enemies|all enemies|enemy targets?)[^.]*? (?:increases|by) (?:by )?${NUM}`, "i").exec(sen)) || (m = new RegExp(`increases DMG taken by (?:the )?(?:enemies|enemy targets?|all enemies|them) by ${NUM}`, "i").exec(sen)) || (m = new RegExp(`DMG received by enemy targets[^.]*? by ${NUM}`, "i").exec(sen)) || (m = new RegExp(`DMG received increases by ${NUM}`, "i").exec(sen)) || (m = new RegExp(`Vulnerability[^.]*?${NUM}`, "i").exec(sen))) { add(out.squad, "dmg", pctOf(m, 1, stars) * KIT_ASSUMED.uptime); done("enemy vulnerability"); }
      if ((m = new RegExp(`DEF (?:gets )?(?:reduced|decreases|is reduced) by ${NUM}`, "i").exec(sen)) || (m = new RegExp(`ignores? ${NUM} of the (?:enemy|target)[^.]*DEF`, "i").exec(sen)) || (m = new RegExp(`reduces? (?:the )?(?:enemy's |enemies' )?DEF by ${NUM}`, "i").exec(sen))) { add(out.squad, "dmg", pctOf(m, 1, stars) * 0.5 * KIT_ASSUMED.uptime); done("DEF reduction"); }
      // Allies act sooner.
      if (/immediately take action|take action immediately|immediately acts?/i.test(sen) && /ally|unit|target|Bondmate|teammate/i.test(sen)) { add(out.squad, "spd", KIT_ASSUMED.actionShare); done("an ally acts immediately"); }
      else if ((m = new RegExp(`(?:action )?advances?(?: [a-z' ]+)? action by ${NUM}`, "i").exec(sen)) || (m = new RegExp(`action advances by ${NUM}`, "i").exec(sen))) { add(toSquad || !/own|their|its|self/i.test(sen) ? out.squad : out.self, "spd", pctOf(m, 1, stars) * 0.5); done("action advance"); }
      if (/extra turn/i.test(sen) && !/(ally|teammate|Archetype|target)/i.test(sen)) { selfBuff = true; line.effect = "extra turn"; }
      else if (/extra turn/i.test(sen)) { add(out.squad, "spd", KIT_ASSUMED.actionShare); done("an ally gets an extra turn"); }
      // Energy for allies.
      if (/regenerates? .*Energy for|Energy (?:to|for) (?:one|designated|all|on-field|an?) ally|regenerates Energy by/i.test(sen)) { add(out.squad, "dmg", 0.05); done("Energy for allies"); }
      // Survival.
      if (/Shield/i.test(sen) && /(provides?|grants?|gains?|applies)/i.test(sen)) { once("shield", toSquad || /allies|on-field/i.test(sen) ? out.squad : out.self, "mit", 0.12); done("shields"); }
      if (/restores? HP|heals?|Healing/i.test(sen) && /(all|on-field|allies|ally)/i.test(sen)) { once("heal", out.squad, "mit", 0.1); done("healing"); }
      if ((m = new RegExp(`DMG taken (?:is )?(?:reduced|decreases?) by ${NUM}`, "i").exec(sen)) || (m = new RegExp(`DMG Mitigation (?:increases )?by ${NUM}`, "i").exec(sen))) buff(m[0], "mit", pctOf(m, 1, stars) * KIT_ASSUMED.uptime, "DMG reduction");
      // Their own Follow-Up ATKs are part of their strength.
      if (/Follow-Up ATK/i.test(sen) && /(launch|uses?|deals?|triggers?)/i.test(sen) && !/considered as/i.test(sen)) { selfBuff = true; line.effect = line.effect ? `${line.effect}; Follow-Up ATK` : "Follow-Up ATK"; }
      // Named summons.
      if ((m = /summons? (?:a |an |the )?"?([A-Z][\w'•★ -]{2,30}?)"?(?: to the field| on the field|[,.]| with| that| and| in| when|$)/.exec(sen)) && !/Aha|Astral Express/.test(m[1])) {
        const nm = m[1].trim();
        if (!out.summons.some((x) => x.name === nm)) out.summons.push({ name: nm, share: KIT_ASSUMED.summonShare[Math.min(3, stars - 1)], note: `${name}'s summon` });
        done(`summons ${nm}`);
      }
      // More team-wide wording.
      if ((m = new RegExp(`(?:ally squad(?:'s| members)?|all allies'?)[^.]*?(?:gain|Lucky Strike Rate (?:increases )?by) ${NUM}(?: Lucky Strike Rate)?`, "i").exec(sen)) && /Lucky Strike Rate/i.test(sen) && !/Aha/i.test(sen)) { add(out.squad, "lucky", pctOf(m, 1, stars) * KIT_ASSUMED.uptime); done("squad Lucky Strike Rate"); }
      if ((m = new RegExp(`Lucky Strike DMG (?:increases )?by \\(?${NUM}`, "i").exec(sen)) && SQUAD.test(sen) && !/Aha/i.test(sen)) { add(out.squad, "luckyDmg", pctOf(m, 1, stars) * KIT_ASSUMED.uptime); done("squad Lucky Strike DMG"); }
      if ((m = new RegExp(`SPD Amplification (?:increases )?by ${NUM}`, "i").exec(sen)) && SQUAD.test(sen) && !/Aha/i.test(sen)) { add(out.squad, "spd", pctOf(m, 1, stars) * KIT_ASSUMED.uptime); done("squad SPD Amplification"); }
      if ((m = new RegExp(`DMG dealt by (?:the )?ally squad(?: in the Zone)? increases by ${NUM}`, "i").exec(sen)) || (m = new RegExp(`increases (?:the )?(?:ally squad's DMG dealt|DMG dealt by the ally squad) by ${NUM}`, "i").exec(sen))) { add(out.squad, "dmg", pctOf(m, 1, stars) * KIT_ASSUMED.uptime); done("squad DMG"); }
      // "all allies' CRIT DMG by 100%/150%/200%" (conditional states count at the usual uptime).
      else if ((m = new RegExp(`all allies' CRIT DMG by ${NUM}`, "i").exec(sen))) { add(out.squad, "dmg", pctOf(m, 1, stars) * KIT_ASSUMED.critDmgWeight * KIT_ASSUMED.uptime); done("squad CRIT DMG"); }
      // Mortenax Blade's "Blade Quenching": one member gets DMG dealt (+ per squad equipment) ≈ a third for the squad.
      if ((m = new RegExp(`team member with the most equipment gains[^.]*?DMG dealt by ${NUM}`, "i").exec(sen))) { add(out.squad, "dmg", (pctOf(m, 1, stars) + 0.3) / 3); done("Blade Quenching on the best-equipped member"); }
      // Energy for the squad after allies act / are attacked / each turn.
      if (/regenerates? \d+ Energy/i.test(sen) && /(on-field ally|ally squad|allies|after an on-field)/i.test(sen) && line.status === "other") { add(out.squad, "energy", 5); done("Energy for the squad"); }
      if ((m = new RegExp(`enemy targets' DMG taken by ${NUM}`, "i").exec(sen)) || (m = new RegExp(`CRIT DMG dealt increases by ${NUM}`, "i").exec(sen))) { add(out.squad, "dmg", pctOf(m, 1, stars) * KIT_ASSUMED.uptime * (/CRIT/.test(m[0]) ? KIT_ASSUMED.critDmgWeight : 1)); done("more DMG on debuffed enemies"); }
      if ((m = new RegExp(`(?:All-Type )?RES PEN (?:increases )?by ${NUM}`, "i").exec(sen)) && SQUAD.test(sen)) { add(out.squad, "dmg", pctOf(m, 1, stars) * 0.8 * KIT_ASSUMED.uptime); done("squad RES PEN"); }
      if ((m = new RegExp(`Max HP by ${NUM}`, "i").exec(sen)) && SQUAD.test(sen)) { add(out.squad, "hp", pctOf(m, 1, stars)); done("squad Max HP"); }
      if ((m = new RegExp(`designated (?:on-field )?ally to gain ${NUM} "?Combo Rate`, "i").exec(sen))) { add(out.squad, "dmg", pctOf(m, 1, stars) * 0.6 / 3); done("a designated ally's Combo Rate"); }
      if ((m = new RegExp(`[Rr]ecords (?:\\()?${NUM}[^.]*?of the non-True DMG dealt by the ally squad`, "i").exec(sen))) { add(out.squad, "dmg", pctOf(m, 1, stars) * 0.5); done("releases recorded squad DMG"); }
      if (/will not take fatal damage|not get knocked down|preventing them from actively attacking|Mind Controls?/i.test(sen)) { add(out.squad, "mit", 0.08); done("protects the squad / disables enemies"); }
      if (/Dispels? \d+ debuff/i.test(sen) && /allies|ally/i.test(sen)) { add(out.squad, "mit", 0.02); done("dispels debuffs"); }
      if ((m = /[Ss]ummon(?:s|ing) (?:the )?(?:memosprite )?"?([A-Z][\w'•★ -]{2,30}?)"?(?: to the field| on the field|[,.]| with| that| and| in| when|$)/.exec(sen)) && !/Aha|Astral Express/.test(m[1]) && !out.summons.some((x) => x.name === m![1].trim())) {
        out.summons.push({ name: m[1].trim(), share: KIT_ASSUMED.summonShare[Math.min(3, stars - 1)], note: `${name}'s summon` }); done(`summons ${m[1].trim()}`);
      }
      // A designated ally ("Debt Collector", "The Beatified", "Bondmate", "Aesthetic Archetype"…): one ally's buff ≈ a third for the squad.
      if (line.status === "other" && (m = new RegExp(`(?:Designates|turns|makes|designated|becomes?)[^.]*?(?:increases|increasing) (?:their |its |the target's )?(SPD|CRIT DMG|ATK|DMG dealt)[^.]*?by ${NUM}`, "i").exec(sen))) {
        const v = /%/.test(m[2]) ? pctOf(m, 2, stars) : starValue(m[2], stars) / 100;
        add(out.squad, m[1].toUpperCase() === "SPD" ? "spd" : "dmg", (v * (m[1] === "CRIT DMG" ? KIT_ASSUMED.critDmgWeight : 1)) / 3);
        done(`a designated ally's ${m[1]}`);
      }
      // Elation mechanics run in the Elation engine (elation.ts).
      if (line.status === "other" && ELATION_KITS[name] && /Punchline|Certified Banger|Aha|Elation|Hidden MMR|Repellency/i.test(sen)) { line.status = "elation"; line.effect = "Elation engine"; }
      // Own damage lines, self buffs and the character's own mechanics are part of their wiki strength.
      if (line.status === "other" && !/(ally|allies|squad|team|teammate|on-field|enem|summon)/i.test(sen)) line.status = "strength";
      if (line.status === "other" && (selfBuff || /(Deals?|dealing) [^.]*DMG equal to|DMG multiplier|deals? .*DMG to/i.test(sen))) line.status = "strength";
      if (line.status === "other" && /^(Use (at|during|when)|Used when|Use when)/i.test(sen)) line.status = "strength";
      out.lines.push(line);
    }
  }
  return out;
}

/** How much of a kit is modelled (for the audit). */
export function kitCoverage(k: KitEffect) {
  const n = k.lines.length || 1;
  const by = (s: Coverage) => k.lines.filter((l) => l.status === s).length;
  return { lines: k.lines.length, modelled: by("modelled"), elation: by("elation"), strength: by("strength"), other: by("other"), share: (by("modelled") + by("elation") + by("strength")) / n };
}
