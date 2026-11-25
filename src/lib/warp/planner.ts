import { POOLS, type PoolKind } from "./rules";
import { pullsForConfidence, targetDistribution, type WarpState } from "./probability";

export interface PlannerInput {
  pool: PoolKind;
  stellarJade: number;
  /** Star Rail Special Passes (event Warps) or Star Rail Passes (Stellar Warp), depending on the pool. */
  passes: number;
  /** 20 Undying Starlight can be exchanged for 1 pass (published shop rate). */
  undyingStarlight: number;
  /** Extra Jade the user expects to earn before the target banner (user estimate). */
  expectedFutureJade: number;
  /** Extra passes the user expects to earn before the target banner (user estimate). */
  expectedFuturePasses: number;
  state: WarpState;
  /** Number of featured copies wanted (1 = E0 / S1). */
  copies: number;
}

export interface PlannerResult {
  currentPulls: number;
  futurePulls: number;
  totalPulls: number;
  probability: number;
  expectedPulls: number;
  median: number;
  p90: number;
  worstCase: number;
  /** Extra pulls needed to make the target certain (0 if already covered). */
  shortfallForCertainty: number;
  /** Stellar Jade equivalent of that shortfall. */
  jadeShortfallForCertainty: number;
  assumptions: string[];
}

export const JADE_PER_PULL = 160;
export const STARLIGHT_PER_PASS = 20;

export function pullsFromResources(jade: number, passes: number, starlight: number): number {
  for (const [n, v] of [["Stellar Jade", jade], ["passes", passes], ["Undying Starlight", starlight]] as const)
    if (!Number.isFinite(v) || v < 0) throw new RangeError(`${n} must be a non-negative number`);
  return Math.floor(jade / JADE_PER_PULL) + Math.floor(passes) + Math.floor(starlight / STARLIGHT_PER_PASS);
}

export function planWarps(input: PlannerInput): PlannerResult {
  const currentPulls = pullsFromResources(input.stellarJade, input.passes, input.undyingStarlight);
  const futurePulls = pullsFromResources(input.expectedFutureJade, input.expectedFuturePasses, 0);
  // Jade combines before division: 100 + 100 Jade from two sources is one more pull together.
  const totalPulls = pullsFromResources(
    input.stellarJade + input.expectedFutureJade,
    input.passes + input.expectedFuturePasses,
    input.undyingStarlight,
  );
  const d = targetDistribution(input.pool, input.state, input.copies);
  const probability = totalPulls >= d.worstCasePulls ? 1 : d.cdf[totalPulls] ?? 0;
  const shortfall = Math.max(0, d.worstCasePulls - totalPulls);
  const rules = POOLS[input.pool];
  return {
    currentPulls,
    futurePulls,
    totalPulls,
    probability,
    expectedPulls: d.expectedPulls,
    median: pullsForConfidence(d, 0.5),
    p90: pullsForConfidence(d, 0.9),
    worstCase: d.worstCasePulls,
    shortfallForCertainty: shortfall,
    jadeShortfallForCertainty: shortfall * JADE_PER_PULL,
    assumptions: [
      `${rules.label}: 5★ base rate ${(rules.five.base * 100).toFixed(1)}%, hard pity ${rules.five.hard} (published).`,
      rules.fiveFeaturedChance === null
        ? "No featured item; any 5★ counts as a success."
        : `${rules.fiveFeaturedChance * 100}% chance a 5★ is featured; a lost rate-up guarantees the next 5★ (published).`,
      `Soft pity from pull ${rules.five.softStart} (+${(rules.five.increment * 100).toFixed(0)}% per pull) is a community model fitted to the published consolidated rate; it is not official.`,
      "Every pull costs 160 Stellar Jade or 1 pass; 20 Undying Starlight = 1 pass.",
      "Undying Starlight earned from future pulls is not counted.",
      "Future income is your own estimate and is not verified.",
    ],
  };
}
