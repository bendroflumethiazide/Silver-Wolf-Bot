import { hitProbability, POOLS, type PoolKind } from "./rules";

/** Deterministic, seedable PRNG (sfc32 seeded via splitmix32). Returns floats in [0, 1). */
export function createRng(seed: number | string) {
  let h = typeof seed === "number" ? seed >>> 0 : hashString(seed);
  const split = () => {
    h = (h + 0x9e3779b9) >>> 0;
    let z = h;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  let a = split(), b = split(), c = split(), d = split();
  return function next(): number {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) >>> 0;
    return t / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

export interface SimItem {
  id?: string;
  name: string;
  /** Game-data image paths: card art for result tiles, full art for the 5★ reveal. */
  image?: string;
  art?: string;
}

export interface SimBanner {
  kind: PoolKind;
  featured5: SimItem[];
  offBanner5: SimItem[];
  featured4: SimItem[];
  offBanner4: SimItem[];
  /** 3★ Light Cones. Chosen by pull number (no RNG draw), so results for a seed don't change. */
  three?: SimItem[];
}

export interface SimState {
  pity5: number;
  pity4: number;
  guaranteed5: boolean;
  guaranteed4: boolean;
}

export interface SimPull {
  index: number;
  rarity: 3 | 4 | 5;
  featured: boolean;
  item: SimItem;
  /** Pull count (since previous hit of the same rarity) at which this item was obtained. */
  pityAt: number;
}

export const INITIAL_SIM_STATE: SimState = { pity5: 0, pity4: 0, guaranteed5: false, guaranteed4: false };

const pick = (rng: () => number, list: SimItem[], fallback: string): SimItem =>
  list.length ? list[Math.floor(rng() * list.length)] : { name: fallback };

/** Perform one simulated pull. Pure: returns the new state; never touches real data. */
export function simulatePull(
  banner: SimBanner,
  state: SimState,
  rng: () => number,
  index: number,
): { pull: SimPull; state: SimState } {
  const rules = POOLS[banner.kind];
  const s = { ...state, pity5: state.pity5 + 1, pity4: state.pity4 + 1 };

  if (rng() < hitProbability(rules.five, s.pity5)) {
    const fc = rules.fiveFeaturedChance;
    const featured = fc === null ? false : s.guaranteed5 || rng() < fc;
    const item = featured
      ? pick(rng, banner.featured5, "Featured 5★")
      : pick(rng, banner.offBanner5, fc === null ? "5★ item" : "Off-banner 5★");
    const pull: SimPull = { index, rarity: 5, featured, item, pityAt: s.pity5 };
    // 4★ pity is not reset by a 5★; the 4★ guarantee carries to the following pull.
    return { pull, state: { ...s, pity5: 0, guaranteed5: fc !== null && !featured } };
  }

  if (rng() < hitProbability(rules.four, Math.min(s.pity4, rules.four.hard))) {
    const fc = rules.fourFeaturedChance;
    const featured = fc === null ? false : s.guaranteed4 || rng() < fc;
    const item = featured
      ? pick(rng, banner.featured4, "Featured 4★")
      : pick(rng, banner.offBanner4, fc === null ? "4★ item" : "Off-banner 4★");
    const pull: SimPull = { index, rarity: 4, featured, item, pityAt: s.pity4 };
    return { pull, state: { ...s, pity4: 0, guaranteed4: fc !== null && !featured } };
  }

  const three = banner.three?.length ? banner.three[(index * 7919) % banner.three.length] : { name: "3★ Light Cone" };
  return { pull: { index, rarity: 3, featured: false, item: three, pityAt: 0 }, state: s };
}

export function simulatePulls(banner: SimBanner, state: SimState, rng: () => number, count: number, startIndex = 0) {
  const pulls: SimPull[] = [];
  let st = state;
  for (let i = 0; i < count; i++) {
    const r = simulatePull(banner, st, rng, startIndex + i);
    pulls.push(r.pull);
    st = r.state;
  }
  return { pulls, state: st };
}

export interface MonteCarloResult {
  sessions: number;
  /** Fraction of sessions that reached the target within the budget. */
  successRate: number;
  /** histogram[n] = number of sessions that reached the target on exactly pull n (only within budget). */
  histogram: number[];
  meanPullsWhenSuccessful: number;
  /** Standard error of the success rate estimate. */
  standardError: number;
}

/** Monte Carlo: probability of getting `copies` featured 5★ within `budget` pulls. */
export function monteCarlo(
  kind: PoolKind,
  start: { pity: number; guaranteed: boolean },
  copies: number,
  budget: number,
  sessions: number,
  seed: number | string,
): MonteCarloResult {
  const rules = POOLS[kind];
  const rng = createRng(seed);
  const fc = rules.fiveFeaturedChance;
  const histogram = new Array<number>(budget + 1).fill(0);
  let success = 0;
  let pullSum = 0;
  for (let s = 0; s < sessions; s++) {
    let pity = start.pity;
    let g = start.guaranteed;
    let got = 0;
    for (let n = 1; n <= budget; n++) {
      pity++;
      if (rng() < hitProbability(rules.five, pity)) {
        pity = 0;
        const featured = fc === null || g || rng() < fc;
        if (featured) {
          got++;
          g = false;
          if (got >= copies) {
            success++;
            histogram[n]++;
            pullSum += n;
            break;
          }
        } else g = true;
      }
    }
  }
  const p = success / sessions;
  return {
    sessions,
    successRate: p,
    histogram,
    meanPullsWhenSuccessful: success ? pullSum / success : NaN,
    standardError: Math.sqrt((p * (1 - p)) / sessions),
  };
}
