import { hitProbability, POOLS, type PoolKind } from "./rules";

export interface WarpState {
  /** Pulls made since the last 5★ in this pool (0 = just got one). */
  pity: number;
  /** True when the next 5★ is guaranteed to be featured (previous 5★ lost the rate-up). */
  guaranteed: boolean;
}

export interface TargetDistribution {
  /** cdf[n] = probability of having obtained `copies` featured 5★ within n pulls. */
  cdf: number[];
  expectedPulls: number;
  worstCasePulls: number;
}

function validate(kind: PoolKind, state: WarpState, copies: number) {
  const r = POOLS[kind].five;
  if (!Number.isInteger(state.pity) || state.pity < 0 || state.pity >= r.hard)
    throw new RangeError(`pity must be an integer in [0, ${r.hard - 1}] for ${POOLS[kind].label}`);
  if (!Number.isInteger(copies) || copies < 1 || copies > 7) throw new RangeError("copies must be an integer in [1, 7]");
}

/** Maximum pulls that could ever be needed (every rate-up lost at hard pity). */
export function worstCasePulls(kind: PoolKind, state: WarpState, copies: number): number {
  validate(kind, state, copies);
  const rules = POOLS[kind];
  const hard = rules.five.hard;
  const loses = rules.fiveFeaturedChance === null || rules.fiveFeaturedChance >= 1 ? 0 : 1;
  const first = hard - state.pity + (state.guaranteed ? 0 : loses * hard);
  return first + (copies - 1) * hard * (1 + loses);
}

/**
 * Exact (dynamic-programming) distribution of pulls needed for `copies` featured 5★ items.
 * For pools without featured items (Stellar Warp) "featured" means any 5★.
 */
export function targetDistribution(kind: PoolKind, state: WarpState, copies: number): TargetDistribution {
  validate(kind, state, copies);
  const rules = POOLS[kind];
  const r = rules.five;
  const fc = rules.fiveFeaturedChance ?? 1;
  const maxPulls = worstCasePulls(kind, state, copies);

  // dist[c][g][pity] = probability mass of being in that state, with c featured copies obtained so far.
  const make = () => Array.from({ length: copies }, () => [new Float64Array(r.hard), new Float64Array(r.hard)]);
  let dist = make();
  dist[0][state.guaranteed ? 1 : 0][state.pity] = 1;
  const cdf: number[] = [0];
  let done = 0;
  let expected = 0;

  for (let n = 1; n <= maxPulls; n++) {
    const next = make();
    let doneNow = 0;
    for (let c = 0; c < copies; c++) {
      for (let g = 0; g < 2; g++) {
        const row = dist[c][g];
        for (let pity = 0; pity < r.hard; pity++) {
          const m = row[pity];
          if (m === 0) continue;
          const p = hitProbability(r, pity + 1);
          if (p < 1) next[c][g][pity + 1] += m * (1 - p);
          const pFeat = g === 1 ? 1 : fc;
          const featured = m * p * pFeat;
          const off = m * p * (1 - pFeat);
          if (c + 1 >= copies) doneNow += featured;
          else next[c + 1][0][0] += featured;
          if (off > 0) next[c][1][0] += off;
        }
      }
    }
    expected += n * doneNow;
    done += doneNow;
    cdf[n] = Math.min(1, done);
    dist = next;
  }
  // All probability mass is absorbed by the worst case; remove floating-point drift.
  cdf[maxPulls] = 1;
  return { cdf, expectedPulls: expected, worstCasePulls: maxPulls };
}

/** Probability of obtaining `copies` featured items within `pulls` pulls. */
export function probabilityWithin(kind: PoolKind, state: WarpState, copies: number, pulls: number): number {
  if (pulls <= 0) return 0;
  const d = targetDistribution(kind, state, copies);
  return pulls >= d.worstCasePulls ? 1 : d.cdf[Math.floor(pulls)];
}

/** Smallest pull count n such that P(success within n) >= q. */
export function pullsForConfidence(d: TargetDistribution, q: number): number {
  for (let n = 1; n < d.cdf.length; n++) if (d.cdf[n] >= q - 1e-12) return n;
  return d.worstCasePulls;
}
