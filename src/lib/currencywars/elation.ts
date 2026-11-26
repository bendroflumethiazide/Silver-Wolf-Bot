/**
 * Elation combat (Currency Wars, Version 4.7): Aha, Aha Instant, Punchline, Elation Skills,
 * Certified Banger and Lucky Strike, simulated event by event inside a fight.
 *
 * VERIFIED (HSR Wiki: "Aha Instant", "Punchline", "Certified Banger", "Elation DMG", the 4.7 Elation
 * Bond's "Aha Mechanics", and each character's "(Voyage Into the Canvas)" page):
 *  - Aha acts on THEIR own SPD = 80 + 1st/5 + 2nd/10 + 3rd/20 + 4th/40 of the fastest Elation allies' SPD
 *    (+ Yao Guang's and Aventurine • Waveflair's Aha SPD bonuses, × Aha's SPD Amplification).
 *  - Each Aha turn triggers an Aha Instant: Crowd Control on Elation allies is dispelled, every unit that
 *    can use an Elation Skill uses it once, in Participant ID order (Pearl 104, Yao Guang 116, Sparxie 144,
 *    Aventurine • Waveflair 156, Aha 199, Silver Wolf LV.999 999; Aeon ★ Aha always last). With no Elation
 *    Skill users, Aha uses "Let There Be Laughter" (up to 10 random hits on both sides).
 *  - Punchline is shared by the team; Elation DMG × (1 + 5P / (P + 240)); it can grow during the Instant.
 *    After the Instant, participants gain Certified Banger equal to the Punchline counted (each grant lasts
 *    2 turns, tracked separately), Punchline resets to 0, then +1 per Elation character. Battles start with
 *    1 Punchline per Elation character and 20 Certified Banger per Elation character.
 *  - Aha (Elation Bond) "Interplay of Tragicomedy": 6 hits of 100/125/150/200% to random enemies, then
 *    200/250/300/400% to all, +10/20/40/60 Punchline; 5% chance of a crystal ore (1 per combat). Aha's
 *    base stats by star (On/Off-Field Strength 8/16/24/40%, DMG Amp, Lucky Strike Rate/DMG 4/8/12/20%) and
 *    equipment boost Elation characters during Elation Skills; Silver Wolf LV.999's and Sparxie's Basic ATKs
 *    get 60/70/80(/100)% of it.
 *  - Character numbers (Elation Skill multipliers, Punchline per Basic ATK, Certified Banger effects, Aha
 *    SPD bonuses, extra Aha turns) are copied from their 4.7 pages into ELATION_KITS.
 * PROVISIONAL (ELATION_ASSUMED): characters' base SPD (100 before SPD Amplification), how a 100% Elation
 * multiplier compares with a normal action in the simulator's strength units, the "all enemies" factor,
 * "Let There Be Laughter"'s per-hit multiplier (the wiki leaves it blank), and Elation Skill multipliers
 * the 4.7 pages don't list (Aventurine • Waveflair, Silver Wolf LV.999).
 */
import { createRng } from "../warp/simulator";

export const ELATION_ASSUMED = {
  baseSpd: 100,
  /** Strength units one 100% Elation multiplier is worth, as a share of the attacker's per-action strength. */
  damageScale: 0.012,
  /** "All enemies" hits count this many targets. */
  aoeTargets: 2,
  laughterHits: 10,
  laughterMult: 20,
  /** Turns an Elation character takes over a fight is worked out from SPD; Basic ATK share of turns. */
  basicShare: 1,
} as const;

export const PUNCHLINE = {
  /** Elation DMG multiplier from Punchline (or Certified Banger points). */
  mult: (p: number) => 1 + (5 * p) / (p + 240),
  startPerElation: 1,
  afterPerElation: 1,
  startBanger: 20,
  bangerTurns: 2,
} as const;

type Star4 = [number, number, number, number?];
export interface ElationKit {
  pid: number;
  /** Elation Skill: hits on all enemies and random single hits, % by star. */
  aoe?: Star4; hits?: number; hit?: Star4;
  /** Punchline the character gains per Basic ATK (or per own action). */
  punchOnAction?: Star4;
  /** Punchline gained when any ally attacks (Aventurine • Waveflair). */
  punchPerAllyAttack?: Star4;
  /** Certified Banger gained per ally attack. */
  bangerPerAllyAttack?: Star4;
  /** Extra Elation hit (%) on each own action while holding Certified Banger. */
  bangerHit?: Star4;
  /** "Great Boon": extra Elation hit (%) after every ally attack while holding Certified Banger. */
  greatBoon?: Star4;
  /** Elation stat for self / for the squad (%). */
  elation?: Star4; squadElation?: Star4;
  /** Flat Aha SPD bonus; by Elation-character count for Aventurine • Waveflair. */
  ahaSpd?: Star4; ahaSpdByCount?: Record<number, number>;
  /** Acts at this % SPD (from "acts at X% SPD"). */
  actsAt?: Star4;
  /** Gets Aha's stats during Basic ATK (share by star). */
  basicGetsAha?: Star4;
  /** Ultimate: Punchline gained, and an Aha extra turn with fixed Punchline that isn't consumed. */
  ultPunch?: Star4; ultAhaTurn?: Star4;
  /** Pearl's Elation Skill: after the squad's next attack, extra Elation DMG % by Elation-character count (1/2/3/4+). */
  pearlBuff?: [Star4, Star4, Star4, Star4];
  /** Certified Banger points the character gets on its own actions (Pearl: 15 per Enhanced Basic ATK), cap. */
  bangerOnAction?: number; bangerCap?: number;
  /** Pearl's Repellency: share of DMG offset while holding Certified Banger. */
  repellency?: number;
  /** Aeon ★ Aha: True DMG = share of the Instant's other DMG; always last. */
  trueShare?: number; last?: boolean;
  /** Silver Wolf LV.999: Hidden MMR at the start, DMG Amp at 180 points (by star). */
  hiddenMmrStart?: number; mmrDmgAt180?: Star4;
  /** Gains Punchline once per fight when Aha Instant is on the field (Sparkle's Ultimate). */
  punchOnce?: Star4;
  /** Assumed values (named in the audit). */
  assumed?: string;
  canElationSkill: boolean;
}

/** Elation characters and their Currency Wars kits (4.7 pages). */
export const ELATION_KITS: Record<string, ElationKit> = {
  Pearl: {
    pid: 104, canElationSkill: true, actsAt: [160, 200, 240, 280], bangerHit: [20, 25, 36, 56], bangerOnAction: 15, bangerCap: 50, repellency: 0.6,
    pearlBuff: [[10, 12.5, 18, 28], [15, 18.8, 27, 42], [20, 25, 36, 56], [40, 50, 72, 112]],
  },
  "Yao Guang": {
    pid: 116, canElationSkill: true, aoe: [120, 150, 216], hits: 5, hit: [30, 37, 54], punchOnAction: [3, 4, 6], actsAt: [160, 200, 240],
    greatBoon: [20, 30, 40], elation: [100, 120.5, 150], squadElation: [20, 24, 28], ahaSpd: [10, 20, 30], ultPunch: [5, 7, 10], ultAhaTurn: [20, 30, 40],
  },
  Sparxie: { pid: 144, canElationSkill: true, aoe: [50, 62.5, 90, 140], hits: 20, hit: [25, 31.2, 45, 70], punchOnAction: [2, 4, 8, 12], bangerHit: [60, 75, 108, 168], basicGetsAha: [60, 70, 80, 100], actsAt: [160, 200, 240, 280] },
  "Aventurine • Waveflair": {
    pid: 156, canElationSkill: true, aoe: [100, 125, 180], elation: [80, 160, 240], squadElation: [20, 30, 40], bangerPerAllyAttack: [2, 3, 4], punchPerAllyAttack: [1, 1, 2],
    ahaSpdByCount: { 1: 100, 2: 50, 3: 20 }, assumed: "Elation Skill multiplier (100/125/180%) assumed: the 4.7 page doesn't list it.",
  },
  "Silver Wolf LV.999": {
    pid: 999, canElationSkill: true, aoe: [100, 125, 180], basicGetsAha: [60, 70, 80], bangerHit: [20, 30, 44], hiddenMmrStart: 60, mmrDmgAt180: [15, 20, 25],
    assumed: "Elation Skill multiplier (100/125/180%) assumed; Hidden MMR rises with every Punchline gained (her base kit).",
  },
  "Aeon ★ Aha": { pid: 1000, canElationSkill: true, aoe: [80, 80, 80], trueShare: 0.3, last: true },
  Sparkle: { pid: 0, canElationSkill: false, punchOnce: [10, 20, 30, 40] },
};

/** Aha (Elation Bond): base stats by star and THEIR Elation Skill. */
export const AHA = {
  pid: 199,
  strength: [8, 16, 24, 40], dmg: [4, 8, 12, 20], lucky: [4, 8, 12, 20], luckyDmg: [4, 8, 12, 20],
  hits: 6, hit: [100, 125, 150, 200], aoe: [200, 250, 300, 400], punch: [10, 20, 40, 60], oreChance: 0.05,
} as const;

export const starOf = (v: Star4 | undefined, stars: number) => (v ? v[Math.min(v.length - 1, stars - 1)] ?? v[0] : 0) ?? 0;

export interface ElationUnit { uid: number; name: string; stars: number; place: "on" | "off"; power: number; spdAmp: number; lucky: number; luckyDmg: number; elation: number }
export interface AhaState { star: number; strength: number; dmg: number; lucky: number; luckyDmg: number; spdAmp: number }
export type ElEventKind = "aha" | "dispel" | "elation" | "hit" | "punchline" | "banger" | "lucky" | "laughter" | "ore" | "boon" | "mmr";
export interface ElEvent { t: number; kind: ElEventKind; who?: string; uid?: number; amount?: number; punchline?: number; text: string; lucky?: boolean }
export interface ElationResult {
  active: boolean;
  ahaSpd: number;
  turns: number[];
  events: ElEvent[];
  /** Elation DMG dealt, in strength units (comparable with a normal action's strength). */
  damage: number;
  byUnit: Map<number, number>;
  ahaDamage: number;
  punchlineStart: number;
  punchlinePeak: number;
  instants: number;
  participants: string[];
  luckyStrikes: number;
  ore: boolean;
  /** Share of incoming DMG Pearl's Repellency offsets (survival). */
  repellency: number;
  hiddenMmr?: number;
}

/** Aha's SPD from the Elation allies' SPD (wiki formula), bonuses and Aha's SPD Amplification. */
export function ahaSpeed(elationSpd: number[], flatBonus: number, ahaSpdAmp: number): number {
  const top = [...elationSpd].sort((a, b) => b - a);
  const base = 80 + (top[0] ?? 0) / 5 + (top[1] ?? 0) / 10 + (top[2] ?? 0) / 20 + (top[3] ?? 0) / 40;
  return (base + flatBonus) * (1 + ahaSpdAmp);
}

/**
 * Run the Elation side of a fight. `units` are the deployed fighters; Elation characters are those with a
 * kit. `aha` is present when the Elation Bond is active.
 */
export function simulateElation(units: ElationUnit[], aha: AhaState | null, av: number, seed: string): ElationResult {
  const rng = createRng(`${seed}:elation`);
  const kitOf = (u: ElationUnit) => ELATION_KITS[u.name];
  const elation = units.filter((u) => kitOf(u));
  const empty: ElationResult = { active: false, ahaSpd: 0, turns: [], events: [], damage: 0, byUnit: new Map(), ahaDamage: 0, punchlineStart: 0, punchlinePeak: 0, instants: 0, participants: [], luckyStrikes: 0, ore: false, repellency: 0 };
  const elationPath = elation.filter((u) => u.name !== "Sparkle");
  if (!elation.length && !aha) return empty;
  const events: ElEvent[] = [];
  const byUnit = new Map<number, number>();
  const avgPower = units.length ? units.reduce((n, u) => n + u.power, 0) / units.length : 1;
  const scale = ELATION_ASSUMED.damageScale;
  const count = elationPath.length;
  const spdOf = (u: ElationUnit) => ELATION_ASSUMED.baseSpd * (1 + u.spdAmp) * (starOf(kitOf(u)?.actsAt, u.stars) ? starOf(kitOf(u)?.actsAt, u.stars) / 100 : 1);
  // Squad Elation (Yao Guang's Zone, Aventurine • Waveflair).
  const squadElation = elation.reduce((n, u) => n + starOf(kitOf(u)?.squadElation, u.stars) / 100 * (u.name === "Yao Guang" ? 1 + starOf(kitOf(u)?.elation, u.stars) / 100 : 1), 0);
  const elationOf = (u: ElationUnit) => 1 + u.elation + squadElation + starOf(kitOf(u)?.elation, u.stars) / 100;
  const flat = elation.reduce((n, u) => n + starOf(kitOf(u)?.ahaSpd, u.stars) + (kitOf(u)?.ahaSpdByCount?.[Math.min(3, count)] ?? 0), 0);
  const spd = ahaSpeed(elationPath.map(spdOf), flat, aha?.spdAmp ?? 0);
  let p = count * PUNCHLINE.startPerElation;
  const punchlineStart = p;
  let peak = p;
  let damage = 0, ahaDamage = 0, lucky = 0, ore = false, instants = 0;
  // Certified Banger: per character, grants with their own expiry (in that character's turns).
  const banger = new Map<number, { points: number; left: number }[]>(elationPath.map((u) => [u.uid, [{ points: PUNCHLINE.startBanger, left: PUNCHLINE.bangerTurns }]]));
  const bangerPoints = (uid: number) => (banger.get(uid) ?? []).reduce((n, g) => n + g.points, 0);
  let mmr = elation.find((u) => u.name === "Silver Wolf LV.999") ? ELATION_KITS["Silver Wolf LV.999"].hiddenMmrStart ?? 0 : undefined;
  const gainPunch = (n: number, t: number, who: string) => {
    if (!n) return;
    p += n; peak = Math.max(peak, p);
    events.push({ t, kind: "punchline", who, amount: n, punchline: p, text: `${who}: +${n} Punchline (${p})` });
    if (mmr !== undefined) { mmr += n; }
  };
  const roll = (u: ElationUnit | null, boost: { lucky: number; luckyDmg: number }) => {
    const rate = 0.05 + (u?.lucky ?? 0) + boost.lucky;
    if (rng() < rate) { lucky++; return 1 + 1 + (u?.luckyDmg ?? 0) + boost.luckyDmg; }
    return 1;
  };
  const deal = (t: number, who: ElationUnit | null, name: string, pct: number, pointsForMult: number, boost: { strength: number; dmg: number; lucky: number; luckyDmg: number }, label: string, canLucky = true) => {
    const basePower = who ? who.power : avgPower;
    const l = canLucky ? roll(who, boost) : 1;
    const amount = (pct / 100) * basePower * scale * (who ? elationOf(who) : 1 + squadElation) * PUNCHLINE.mult(pointsForMult) * (1 + boost.strength + boost.dmg) * l;
    damage += amount;
    if (who) byUnit.set(who.uid, (byUnit.get(who.uid) ?? 0) + amount); else ahaDamage += amount;
    events.push({ t, kind: l > 1 ? "lucky" : "hit", who: name, uid: who?.uid, amount, punchline: pointsForMult, lucky: l > 1, text: `${name} · ${label}: ${Math.round(amount * 10) / 10}${l > 1 ? " (Lucky Strike!)" : ""}` });
    return amount;
  };
  const ahaBoost = aha ? { strength: aha.strength, dmg: aha.dmg, lucky: aha.lucky, luckyDmg: aha.luckyDmg } : { strength: 0, dmg: 0, lucky: 0, luckyDmg: 0 };
  const none = { strength: 0, dmg: 0, lucky: 0, luckyDmg: 0 };

  // Each Elation character's own turns (Basic ATKs make Punchline; Certified Banger adds hits).
  const actions: { t: number; u: ElationUnit }[] = [];
  for (const u of elation) { const every = 10000 / spdOf(u); for (let t = every * (0.4 + rng() * 0.3); t < av; t += every) actions.push({ t, u }); }
  // Allies' attacks in general (for Aventurine • Waveflair and Yao Guang's Great Boon), about one per 100 AV each.
  const allyAttacks: number[] = [];
  for (const u of units) { const every = 10000 / (ELATION_ASSUMED.baseSpd * (1 + u.spdAmp)); for (let t = every * (0.3 + rng() * 0.5); t < av; t += every) allyAttacks.push(t); }
  allyAttacks.sort((a, b) => a - b);
  const ahaTurns: number[] = [];
  if (aha || elation.length) { const every = 10000 / spd; for (let t = every; t < av; t += every) ahaTurns.push(t); }
  // Yao Guang's Ultimate: an extra Aha turn with fixed Punchline, at about half the fight.
  const yg = elation.find((u) => u.name === "Yao Guang");
  const extraTurns = yg ? [{ t: av * 0.5, fixed: starOf(ELATION_KITS["Yao Guang"].ultAhaTurn, yg.stars) }] : [];
  const sparkle = elation.find((u) => u.name === "Sparkle");
  const timeline = [
    ...actions.map((a) => ({ t: a.t, kind: "act" as const, u: a.u })),
    ...allyAttacks.map((t) => ({ t, kind: "ally" as const })),
    ...ahaTurns.map((t) => ({ t, kind: "aha" as const, fixed: 0 })),
    ...extraTurns.map((x) => ({ t: x.t, kind: "aha" as const, fixed: x.fixed })),
    ...(sparkle ? [{ t: av * 0.4, kind: "sparkle" as const }] : []),
  ].sort((a, b) => a.t - b.t);
  if (elationPath.length) events.push({ t: 0, kind: "punchline", punchline: p, amount: p, text: `Battle start: ${p} Punchline (1 per Elation character), ${PUNCHLINE.startBanger} Certified Banger each.` });

  const participants = [...elation.filter((u) => kitOf(u)!.canElationSkill)].sort((a, b) => (kitOf(a)!.last ? 1e6 : kitOf(a)!.pid) - (kitOf(b)!.last ? 1e6 : kitOf(b)!.pid));
  for (const step of timeline) {
    if (step.kind === "act") {
      const u = step.u; const k = kitOf(u)!;
      gainPunch(starOf(k.punchOnAction, u.stars), step.t, u.name);
      if (k.bangerOnAction) { const list = banger.get(u.uid) ?? []; const have = bangerPoints(u.uid); if (have < (k.bangerCap ?? 999)) list.push({ points: Math.min(k.bangerOnAction, (k.bangerCap ?? 999) - have), left: PUNCHLINE.bangerTurns }); banger.set(u.uid, list); }
      const pts = bangerPoints(u.uid);
      if (pts > 0 && k.bangerHit) deal(step.t, u, u.name, starOf(k.bangerHit, u.stars), pts, k.basicGetsAha && aha ? { ...ahaBoost, strength: ahaBoost.strength * starOf(k.basicGetsAha, u.stars) / 100, dmg: ahaBoost.dmg * starOf(k.basicGetsAha, u.stars) / 100 } : none, "Certified Banger hit");
      // Each grant lasts 2 of the character's own turns (Pearl's never expire).
      if (!k.bangerCap) banger.set(u.uid, (banger.get(u.uid) ?? []).map((g) => ({ ...g, left: g.left - 1 })).filter((g) => g.left > 0));
      continue;
    }
    if (step.kind === "ally") {
      for (const u of elation) {
        const k = kitOf(u)!;
        gainPunch(starOf(k.punchPerAllyAttack, u.stars), step.t, u.name);
        if (k.bangerPerAllyAttack) banger.set(u.uid, [...(banger.get(u.uid) ?? []), { points: starOf(k.bangerPerAllyAttack, u.stars), left: PUNCHLINE.bangerTurns }]);
        if (k.greatBoon && bangerPoints(u.uid) > 0) deal(step.t, u, u.name, starOf(k.greatBoon, u.stars), bangerPoints(u.uid), none, "Great Boon");
      }
      continue;
    }
    if (step.kind === "sparkle") { gainPunch(starOf(ELATION_KITS.Sparkle.punchOnce, sparkle!.stars), step.t, "Sparkle (Ultimate)"); continue; }
    // Aha's turn: Aha Instant.
    instants++;
    const t0 = step.t;
    const fixed = step.fixed;
    const counted = () => (fixed ? fixed : p);
    events.push({ t: t0, kind: "aha", punchline: counted(), text: `Aha acts (SPD ${Math.round(spd)}): Aha Instant with ${counted()} Punchline${fixed ? " (fixed, Yao Guang's extra turn)" : ""}.` });
    if (participants.length) events.push({ t: t0 + 0.01, kind: "dispel", text: "Crowd Control on Elation allies dispelled." });
    let tt = t0 + 0.02;
    const before = damage;
    if (!participants.length && !aha) {
      for (let i = 0; i < ELATION_ASSUMED.laughterHits; i++) { if (rng() < 0.5) deal(tt += 0.01, null, "Aha", ELATION_ASSUMED.laughterMult, counted(), none, "Let There Be Laughter", false); }
      events.push({ t: tt, kind: "laughter", text: "No Elation Skills to use: Aha uses \"Let There Be Laughter\" (hits on both sides; allies take 1 DMG and regain a little Energy)." });
    }
    const order: ({ u: ElationUnit } | { aha: true })[] = [...participants.filter((u) => !kitOf(u)!.last).map((u) => ({ u }))];
    if (aha) { const i = order.findIndex((o) => "u" in o && kitOf(o.u)!.pid > AHA.pid); order.splice(i < 0 ? order.length : i, 0, { aha: true }); }
    for (const u of participants.filter((x) => kitOf(x)!.last)) order.push({ u });
    for (const o of order) {
      tt += 0.05;
      if ("aha" in o) {
        const st = aha!.star;
        events.push({ t: tt, kind: "elation", who: "Aha", text: "Aha: Interplay of Tragicomedy" });
        for (let i = 0; i < AHA.hits; i++) deal(tt += 0.005, null, "Aha", starOf(AHA.hit as unknown as Star4, st), counted(), ahaBoost, "hit");
        deal(tt += 0.005, null, "Aha", starOf(AHA.aoe as unknown as Star4, st) * ELATION_ASSUMED.aoeTargets, counted(), ahaBoost, "all enemies");
        if (!fixed) gainPunch(starOf(AHA.punch as unknown as Star4, st), tt, "Aha");
        if (!ore && rng() < AHA.oreChance) { ore = true; events.push({ t: tt, kind: "ore", text: "Aha dropped a crystal ore!" }); }
        continue;
      }
      const u = o.u; const k = kitOf(u)!;
      events.push({ t: tt, kind: "elation", who: u.name, uid: u.uid, text: `${u.name}: Elation Skill` });
      const boost = aha ? ahaBoost : none;
      if (k.trueShare) {
        deal(tt += 0.005, u, u.name, starOf(k.aoe, u.stars) * ELATION_ASSUMED.aoeTargets, counted(), boost, "all enemies");
        const tr = (damage - before) * k.trueShare;
        damage += tr; byUnit.set(u.uid, (byUnit.get(u.uid) ?? 0) + tr);
        events.push({ t: tt += 0.005, kind: "hit", who: u.name, uid: u.uid, amount: tr, text: `${u.name} · True DMG (${k.trueShare * 100}% of this Instant's DMG): ${Math.round(tr * 10) / 10}` });
        continue;
      }
      if (k.pearlBuff) {
        const pct = starOf(k.pearlBuff[Math.min(3, Math.max(1, count) - 1)], u.stars);
        // After the squad's next attack: an extra Elation hit per on-field ally.
        for (const a of units.filter((x) => x.place === "on")) deal(tt += 0.005, a, a.name, pct, counted(), none, "Pearl's Elation Skill (next attack)");
        continue;
      }
      if (k.aoe) deal(tt += 0.005, u, u.name, starOf(k.aoe, u.stars) * ELATION_ASSUMED.aoeTargets, counted(), boost, "all enemies");
      for (let i = 0; i < (k.hits ?? 0); i++) deal(tt += 0.002, u, u.name, starOf(k.hit, u.stars), counted(), boost, "hit");
    }
    // End of the Instant: Certified Banger for participants, Punchline consumed (unless it was a fixed extra turn).
    const pts = counted();
    for (const u of participants) banger.set(u.uid, [...(banger.get(u.uid) ?? []), { points: pts, left: PUNCHLINE.bangerTurns }]);
    events.push({ t: tt + 0.01, kind: "banger", punchline: pts, text: `Certified Banger ${pts} → ${participants.map((u) => u.name).join(", ") || "no one"} (2 turns).` });
    if (!fixed) {
      events.push({ t: tt + 0.02, kind: "punchline", punchline: 0, amount: -p, text: `${p} Punchline consumed.` });
      p = 0;
      gainPunch(count * PUNCHLINE.afterPerElation, tt + 0.03, "Elation characters");
    }
  }
  // Silver Wolf LV.999's Hidden MMR threshold.
  const sw = elation.find((u) => u.name === "Silver Wolf LV.999");
  if (sw && mmr !== undefined) events.push({ t: av, kind: "mmr", who: sw.name, text: `Hidden MMR ${mmr}${mmr >= 180 ? ` (≥180: +${starOf(ELATION_KITS["Silver Wolf LV.999"].mmrDmgAt180, sw.stars)}% DMG Amplification)` : ""}` });
  const pearl = elation.find((u) => u.name === "Pearl");
  return {
    active: true, ahaSpd: spd, turns: ahaTurns, events: events.sort((a, b) => a.t - b.t), damage, byUnit, ahaDamage,
    punchlineStart, punchlinePeak: peak, instants, participants: participants.map((u) => u.name), luckyStrikes: lucky, ore,
    repellency: pearl ? ELATION_KITS.Pearl.repellency! * 0.3 : 0, hiddenMmr: mmr,
  };
}
