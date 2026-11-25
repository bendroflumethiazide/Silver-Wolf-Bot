/**
 * Warp (gacha) rules for Honkai: Star Rail.
 *
 * PUBLISHED (in-game "Details" page of each Warp, verified against game version 4.7):
 *   - base rates, consolidated rates, hard pity, featured (rate-up) chances, guarantee rules.
 * COMMUNITY MODEL (NOT officially published):
 *   - soft pity start + per-pull increment. Parameters are chosen so that the model's
 *     consolidated rate reproduces the published consolidated rate. This is enforced by
 *     unit tests (src/lib/warp/__tests__/model.test.ts).
 */

export type PoolKind =
  | "character"
  | "lightcone"
  | "standard"
  | "departure"
  | "collab-character"
  | "collab-lightcone";

export interface RarityPity {
  /** Probability per pull before soft pity (published). */
  base: number;
  /** First pull number (1-indexed since last hit) at which soft pity applies (community model). */
  softStart: number;
  /** Added probability per pull from softStart onward (community model). */
  increment: number;
  /** Pull number at which the hit is guaranteed (published). */
  hard: number;
  /** Published consolidated rate including guarantees. */
  publishedConsolidated: number;
}

export interface PoolRules {
  kind: PoolKind;
  label: string;
  /** UIGF / game `gacha_type` values that belong to this pity pool. */
  gachaTypes: string[];
  five: RarityPity;
  four: RarityPity;
  /** Chance a 5★ is the featured item when not guaranteed. null = no featured items. */
  fiveFeaturedChance: number | null;
  /** Chance a 4★ is one of the featured items when not guaranteed. */
  fourFeaturedChance: number | null;
  /** Stellar Jade per pull (one Special/regular Pass = 160 Jade). */
  jadePerPull: number;
  /** Whether this pool's pity is verified as independent from others. */
  pityNote: string;
  verification: "published" | "community";
}

const CHAR5: RarityPity = { base: 0.006, softStart: 74, increment: 0.06, hard: 90, publishedConsolidated: 0.016 };
const CHAR4: RarityPity = { base: 0.051, softStart: 9, increment: 0.51, hard: 10, publishedConsolidated: 0.13 };
const LC5: RarityPity = { base: 0.008, softStart: 66, increment: 0.07, hard: 80, publishedConsolidated: 0.0187 };
const LC4: RarityPity = { base: 0.066, softStart: 8, increment: 0.4, hard: 10, publishedConsolidated: 0.148 };

export const POOLS: Record<PoolKind, PoolRules> = {
  character: {
    kind: "character",
    label: "Character Event Warp",
    gachaTypes: ["11"],
    five: CHAR5,
    four: CHAR4,
    fiveFeaturedChance: 0.5,
    fourFeaturedChance: 0.5,
    jadePerPull: 160,
    pityNote: "Pity and guarantee carry over between Character Event Warps (published).",
    verification: "published",
  },
  lightcone: {
    kind: "lightcone",
    label: "Light Cone Event Warp",
    gachaTypes: ["12"],
    five: LC5,
    four: LC4,
    fiveFeaturedChance: 0.75,
    fourFeaturedChance: 0.75,
    jadePerPull: 160,
    pityNote: "Pity and guarantee carry over between Light Cone Event Warps (published).",
    verification: "published",
  },
  standard: {
    kind: "standard",
    label: "Stellar Warp",
    gachaTypes: ["1"],
    five: CHAR5,
    four: CHAR4,
    fiveFeaturedChance: null,
    fourFeaturedChance: null,
    jadePerPull: 160,
    pityNote: "Independent pity. Uses Star Rail Passes, not Special Passes.",
    verification: "published",
  },
  departure: {
    kind: "departure",
    label: "Departure Warp",
    gachaTypes: ["2"],
    // Departure guarantees a 5★ character within 50 Warps. Soft pity is not modelled.
    five: { base: 0.006, softStart: 51, increment: 0, hard: 50, publishedConsolidated: NaN },
    four: CHAR4,
    fiveFeaturedChance: null,
    fourFeaturedChance: null,
    jadePerPull: 128, // 20% discount on 10-pulls (8 passes per 10-pull)
    pityNote: "One-time beginner Warp, 50 pulls total. 5★ guaranteed within 50.",
    verification: "published",
  },
  "collab-character": {
    kind: "collab-character",
    label: "Collaboration Character Warp",
    gachaTypes: ["21"],
    five: CHAR5,
    four: CHAR4,
    fiveFeaturedChance: 0.5,
    fourFeaturedChance: 0.5,
    jadePerPull: 160,
    pityNote:
      "Treated as an independent pity pool. Community-reported; confirm in the in-game Details page of the collaboration Warp.",
    verification: "community",
  },
  "collab-lightcone": {
    kind: "collab-lightcone",
    label: "Collaboration Light Cone Warp",
    gachaTypes: ["22"],
    five: LC5,
    four: LC4,
    fiveFeaturedChance: 0.75,
    fourFeaturedChance: 0.75,
    jadePerPull: 160,
    pityNote:
      "Treated as an independent pity pool. Community-reported; confirm in the in-game Details page of the collaboration Warp.",
    verification: "community",
  },
};

export const POOL_KINDS = Object.keys(POOLS) as PoolKind[];

export function poolForGachaType(gachaType: string): PoolKind | null {
  for (const k of POOL_KINDS) if (POOLS[k].gachaTypes.includes(String(gachaType))) return k;
  return null;
}

/** Probability of a hit on pull number `n` (1-indexed since the last hit). */
export function hitProbability(r: RarityPity, n: number): number {
  if (n >= r.hard) return 1;
  if (n < 1) throw new RangeError("pull number must be >= 1");
  return Math.min(1, r.base + Math.max(0, n - r.softStart + 1) * r.increment);
}

/** Expected number of pulls per hit, and the resulting consolidated rate. */
export function consolidated(r: RarityPity): { expectedPulls: number; rate: number } {
  let survive = 1;
  let expected = 0;
  for (let n = 1; n <= r.hard; n++) {
    const p = hitProbability(r, n);
    expected += n * survive * p;
    survive *= 1 - p;
  }
  return { expectedPulls: expected, rate: 1 / expected };
}

/**
 * Distribution of the pull number on which the next hit occurs, given `pity` pulls already made
 * since the last hit. Returns array d where d[k] = P(next hit after exactly k more pulls), k>=1.
 */
export function nextHitDistribution(r: RarityPity, pity: number): number[] {
  if (pity < 0 || pity >= r.hard) throw new RangeError(`pity must be in [0, ${r.hard - 1}]`);
  const d: number[] = [0];
  let survive = 1;
  for (let k = 1; pity + k <= r.hard; k++) {
    const p = hitProbability(r, pity + k);
    d[k] = survive * p;
    survive *= 1 - p;
  }
  return d;
}

/**
 * Standard (Stellar Warp) 5★ pool. Used by the simulator for off-banner results.
 * Source: in-game Stellar Warp details (game 1.0 – 4.7).
 */
export const STANDARD_5STAR_IDS = new Set([
  "1003", "1004", "1101", "1104", "1107", "1209", "1211", // Himeko, Welt, Bronya, Gepard, Clara, Yanqing, Bailu
  "23000", "23002", "23003", "23004", "23005", "23012", "23013", // standard 5★ Light Cones
]);

/** External Warp tracker (history import, pity, statistics). */
export const WARP_TRACKER_URL = "https://starrailstation.com/en/warp#import";
