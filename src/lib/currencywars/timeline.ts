/**
 * Play-by-play for a simulated Currency Wars fight, for the battle viewer. The fight's outcome is
 * decided first (see run.ts); this builds a matching timeline in Action Value (AV): allies and
 * enemies act on their own schedules, waves arrive, boss phases break, characters fall and revive.
 * Damage is scaled so the enemy is fully cleared on a win, or cleared to the same share on a loss.
 */

export interface TlUnit {
  id: string;
  name: string;
  side: "ally" | "enemy";
  maxHp: number;
  cost?: number;
  stars?: number;
  place?: "on" | "off";
  idle?: boolean;
  boss?: boolean;
  elite?: boolean;
  phases?: number;
  wave?: number;
  /** A Bond summon or helper (Crimson Thorns, Astral Express…): acts on its own SPD, isn't targeted. */
  summon?: { emoji: string; bond: string; spd: number; note?: string; scripted?: boolean };
}
export type TlKind = "hit" | "fall" | "revive" | "kill" | "phase" | "wave" | "ultimate" | "end" | "aha" | "elation" | "punchline" | "banger" | "dispel" | "laughter" | "ore" | "boon" | "mmr";
export interface TlEvent { t: number; kind: TlKind; from?: string; to?: string; amount?: number; text?: string; lucky?: boolean; punchline?: number }
export interface Timeline {
  units: TlUnit[];
  events: TlEvent[];
  /** AV when the fight ends. */
  end: number;
  /** AV limit (null for Reward nodes, which have none). */
  limit: number | null;
  won: boolean;
  kills: number;
  /** Every turn taken (who acted, at what AV), for the turn-order bar. */
  turns?: { t: number; id: string }[];
}

export interface TimelineInput {
  allies: { name: string; cost: number; stars: 1 | 2 | 3; power: number; place: "on" | "off"; /** SPD Amplification in percent (wiki). */ spd?: number;
    /** Summons act at their own SPD (10000 / SPD AV per turn; 0 = once at the start). */
    summon?: { emoji: string; bond: string; spd: number; note?: string; scripted?: boolean } }[];
  enemies: { name: string; elite?: boolean; boss?: boolean }[];
  /** Number of waves the normal enemies come in (the boss fight has one). */
  waves: number;
  won: boolean;
  /** Share of enemy HP cleared (1 on a win). */
  cleared: number;
  /** Your strength ÷ enemy strength. */
  ratio: number;
  limit: number | null;
  bossPhases: number;
  /** AV a revive costs (15, or 35 from Cobalt Silver). */
  reviveCost: number;
  /** Extra hits with their own weight (Elation Skills, Aha): ally index, AV time on the `limit` scale. */
  scripted?: { t: number; ally: number; weight: number; text?: string; lucky?: boolean }[];
  /** Text events (Aha acts, Punchline, Certified Banger…) on the `limit` scale; `turn` marks an ally's turn. */
  notes?: { t: number; kind: TlKind; text: string; punchline?: number; turn?: number }[];
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export function buildTimeline(input: TimelineInput, rng: () => number): Timeline {
  const { won, ratio, limit } = input;
  const units: TlUnit[] = [];
  const events: TlEvent[] = [];
  const spdOf = new Map(input.allies.map((a, i) => [`a${i}`, a.spd ?? 0]));
  const allies = input.allies.map((a, i) => {
    const u: TlUnit = { id: `a${i}`, name: a.name, side: "ally", maxHp: Math.round((900 + 350 * a.cost) * (1 + 0.6 * (a.stars - 1))), cost: a.cost, stars: a.stars, place: a.place, idle: a.power <= 0, summon: a.summon };
    units.push(u);
    return { u, power: a.power };
  });
  const perWave = Math.max(1, Math.ceil(input.enemies.filter((e) => !e.boss).length / Math.max(1, input.waves)));
  const enemies = input.enemies.map((e, i) => {
    const wave = e.boss ? 1 : Math.min(input.waves, Math.floor(i / perWave) + 1);
    const base = e.boss ? 60000 * input.bossPhases : e.elite ? 18000 : 7000;
    const u: TlUnit = { id: `e${i}`, name: e.name, side: "enemy", maxHp: Math.round(base * (0.85 + rng() * 0.3)), boss: e.boss, elite: e.elite, phases: e.boss ? input.bossPhases : undefined, wave };
    units.push(u);
    return u;
  });
  const total = enemies.reduce((n, e) => n + e.maxHp, 0);
  const target = won ? total : Math.floor(total * clamp(input.cleared, 0, 0.99));
  const end = limit === null ? 40 + 12 * enemies.length + rng() * 20 : won ? limit * clamp(0.92 - 0.45 * (ratio - 1), 0.3, 0.92) : limit;

  // Ally actions: each active ally acts on its own rhythm; damage per action follows strength.
  const acts: { t: number; ally: (typeof allies)[number]; w?: number; text?: string; lucky?: boolean }[] = [];
  for (const a of allies) {
    if (a.u.idle) continue;
    if (a.u.summon?.scripted) continue;
    if (a.u.summon) {
      // Summons keep their own SPD: one turn every 10000 / SPD AV (SPD 0 = a single strike at the start).
      if (!a.u.summon.spd) { acts.push({ t: 1, ally: a }); continue; }
      const every = 10000 / a.u.summon.spd;
      const first = Math.min(every * (0.2 + rng() * 0.25), Math.max(1, end - 1.5));
      // Every summon gets at least one turn, even in a quick fight.
      for (let t = first; t < end - 0.5; t += every * (0.95 + rng() * 0.1)) acts.push({ t, ally: a });
      continue;
    }
    // Faster characters (higher SPD Amplification) take more turns; dampened so 300% isn't 4× the turns.
    const interval = 100 / ((0.85 + 0.1 * (a.u.stars ?? 1) + rng() * 0.35) * Math.sqrt(1 + (spdOf.get(a.u.id) ?? 0) / 100));
    for (let t = rng() * interval * 0.6 + 2; t < end - 0.5; t += interval * (0.9 + rng() * 0.2)) acts.push({ t, ally: a });
  }
  // Scripted hits (Elation Skills, Aha) happen at their own times, squeezed into this fight's length.
  const span = limit ?? 150;
  const squeeze = (t: number) => Math.min(end - 0.6, Math.max(0.5, (t / span) * end));
  for (const x of input.scripted ?? []) { const a = allies[x.ally]; if (a && x.weight > 0) acts.push({ t: squeeze(x.t), ally: a, w: x.weight, text: x.text, lucky: x.lucky }); }
  acts.sort((x, y) => x.t - y.t);
  if (won && acts.length) acts[acts.length - 1].t = Math.max(acts[acts.length - 1].t, end - 1);
  const weight = acts.reduce((n, x) => n + (x.w ?? x.ally.power), 0) || 1;
  for (const nt of input.notes ?? []) {
    events.push({ t: squeeze(nt.t), kind: nt.kind, text: nt.text, punchline: nt.punchline });
  }

  const hp = new Map(units.map((u) => [u.id, u.maxHp]));
  // One turn per act (several scripted hits at the same moment are one turn).
  const turns: { t: number; id: string }[] = [];
  for (const a of acts) { const last = turns[turns.length - 1]; if (!(a.w !== undefined && last && last.id === a.ally.u.id && Math.abs(last.t - a.t) < 0.5)) turns.push({ t: a.t, id: a.ally.u.id }); }
  for (const nt of input.notes ?? []) if (nt.turn !== undefined && allies[nt.turn]) turns.push({ t: squeeze(nt.t), id: allies[nt.turn].u.id });
  let dealt = 0, kills = 0, wave = 1;
  const phaseMarks = new Map<string, number>();
  const alive = (w: number) => enemies.filter((e) => e.wave === w && (hp.get(e.id) ?? 0) > 0);
  // Enemy attack schedule, worked out alongside ally hits.
  const pressure = clamp(1.15 / Math.max(0.2, ratio) - 0.35, 0.1, 1.3);
  let nextEnemyAct = 25 + rng() * 20;
  const ultimateAt = enemies.some((e) => e.boss) && limit !== null ? limit - 100 : Infinity;
  let ultimateShown = false;

  const enemyTurns = (until: number) => {
    while (nextEnemyAct < until) {
      const t = nextEnemyAct;
      const attackers = alive(wave);
      const victims = allies.filter((a) => !a.u.idle && !a.u.summon);
      if (attackers.length && victims.length) {
        const from = attackers[Math.floor(rng() * attackers.length)];
        const to = victims[Math.floor(rng() * victims.length)].u;
        turns.push({ t, id: from.id });
        const amount = Math.round(to.maxHp * pressure * (from.boss ? 0.32 : from.elite ? 0.22 : 0.14) * (0.8 + rng() * 0.4));
        const left = (hp.get(to.id) ?? 0) - amount;
        events.push({ t, kind: "hit", from: from.id, to: to.id, amount });
        if (left <= 0) {
          hp.set(to.id, 0);
          events.push({ t: t + 0.01, kind: "fall", to: to.id, text: `${to.name} falls` });
          events.push({ t: t + 4, kind: "revive", to: to.id, amount: to.maxHp, text: `${to.name} revives at full HP (−${input.reviveCost} AV)` });
          hp.set(to.id, to.maxHp);
        } else hp.set(to.id, left);
      }
      nextEnemyAct += (36 + rng() * 24) / Math.max(1, attackers.length * 0.6);
    }
  };

  acts.forEach((act, i) => {
    enemyTurns(act.t);
    if (!ultimateShown && act.t >= ultimateAt) { events.push({ t: ultimateAt, kind: "ultimate", text: "Ultimate Instant: the squad deals 200% DMG" }); ultimateShown = true; }
    // The last action finishes the job exactly (rounding would leave a sliver of HP).
    let amount = i === acts.length - 1 ? target - dealt : Math.round((target * (act.w ?? act.ally.power)) / weight);
    while (amount > 0 && dealt < target) {
      let pool = alive(wave);
      if (!pool.length) {
        if (wave < input.waves && enemies.some((e) => e.wave === wave + 1)) { wave++; events.push({ t: act.t, kind: "wave", text: `Wave ${wave}` }); pool = alive(wave); }
        if (!pool.length) break;
      }
      const to = pool.reduce((lo, e) => ((hp.get(e.id) ?? 0) < (hp.get(lo.id) ?? 0) ? e : lo), pool[0]);
      const left = hp.get(to.id) ?? 0;
      const hit = Math.min(amount, left, target - dealt);
      if (hit <= 0) break;
      hp.set(to.id, left - hit);
      dealt += hit;
      amount -= hit;
      events.push({ t: act.t, kind: "hit", from: act.ally.u.id, to: to.id, amount: hit, lucky: act.lucky, text: act.lucky ? `${act.ally.u.name}: Lucky Strike! ${hit.toLocaleString()}` : undefined });
      if (to.boss && to.phases && to.phases > 1) {
        const broken = Math.floor(((to.maxHp - (left - hit)) / to.maxHp) * to.phases + 1e-9);
        const shown = phaseMarks.get(to.id) ?? 0;
        // One event per phase line crossed (a big hit can cross two).
        for (let k = shown + 1; k <= Math.min(broken, to.phases - 1); k++) events.push({ t: act.t + 0.01 * k, kind: "phase", to: to.id, text: `${to.name}: phase ${k + 1}` });
        if (broken > shown) phaseMarks.set(to.id, broken);
      }
      if (left - hit <= 0) { kills++; events.push({ t: act.t + 0.01, kind: "kill", to: to.id, text: `${to.name} defeated` }); }
    }
  });
  enemyTurns(end);
  events.push({ t: end, kind: "end", text: won ? "All enemies defeated" : limit === null ? "Fight over" : "Out of Action Value" });
  events.sort((a, b) => a.t - b.t);
  turns.sort((a, b) => a.t - b.t);
  return { units, events, end, limit, won, kills, turns };
}

/** HP of every unit at AV time `t`. */
export function hpAt(tl: Timeline, t: number): Map<string, number> {
  const hp = new Map(tl.units.map((u) => [u.id, u.maxHp]));
  for (const e of tl.events) {
    if (e.t > t) break;
    if (!e.to) continue;
    if (e.kind === "hit") hp.set(e.to, Math.max(0, (hp.get(e.to) ?? 0) - (e.amount ?? 0)));
    else if (e.kind === "fall" || e.kind === "kill") hp.set(e.to, 0);
    else if (e.kind === "revive") hp.set(e.to, e.amount ?? 0);
  }
  return hp;
}

/** Turns from the timeline (older saved fights have none recorded: rebuild them from hits). */
export function turnsOf(tl: Timeline): { t: number; id: string }[] {
  if (tl.turns?.length) return tl.turns;
  const seen = new Set<string>();
  return tl.events.filter((e) => e.kind === "hit" && e.from && !seen.has(`${e.from}@${e.t}`) && seen.add(`${e.from}@${e.t}`)).map((e) => ({ t: e.t, id: e.from! }));
}

/** Who acts next from AV `t`: the current actor (if one just acted) and the upcoming turns. */
export function turnOrder(tl: Timeline, t: number, count = 8): { current: { t: number; id: string } | null; next: { t: number; id: string; av: number }[] } {
  const all = turnsOf(tl);
  const hp = hpAt(tl, t);
  const current = [...all].reverse().find((x) => x.t <= t && x.t > t - 6) ?? null;
  const next = all.filter((x) => x.t > t && x.t <= tl.end && (hp.get(x.id) ?? 1) > 0).slice(0, count).map((x) => ({ ...x, av: Math.max(0, Math.round(x.t - t)) }));
  return { current, next };
}
