import { POOLS, type PoolKind } from "./rules";

export interface WarpRecord {
  /** Game record id (19-digit numeric string) or a generated id for manual entries. */
  id: string;
  profileId: string;
  pool: PoolKind;
  gachaType: string;
  gachaId?: string;
  itemId?: string;
  name: string;
  itemType: string;
  rank: 3 | 4 | 5;
  /** Server-local time string "YYYY-MM-DD HH:mm:ss", kept exactly as exported. */
  time: string;
  source: "manual" | "uigf" | "srgf" | "csv";
  /** Lets the user correct featured detection for a specific 5★/4★. */
  featuredOverride?: "featured" | "off-banner";
  /** Monotonic order used for manual records that have no game id. */
  seq?: number;
}

/**
 * Standard (Stellar Warp) 5★ pool, used to detect lost 50/50s on event Warps.
 * Source: in-game Stellar Warp details (game 1.0 – 4.7). Users can override per record.
 */
export const STANDARD_5STAR_IDS = new Set([
  "1003", "1004", "1101", "1104", "1107", "1209", "1211", // Himeko, Welt, Bronya, Gepard, Clara, Yanqing, Bailu
  "23000", "23002", "23003", "23004", "23005", "23012", "23013", // standard 5★ Light Cones
]);

export type FiftyFiftyResult = "won" | "lost" | "guaranteed" | "n/a";

export interface FiveStarEntry {
  record: WarpRecord;
  pityAt: number;
  featured: boolean;
  fiftyFifty: FiftyFiftyResult;
  /** True when pulls before the first known record may be missing from this 5★'s pity count. */
  pityUncertain: boolean;
}

export interface PoolOffset {
  /** Pulls made since the last 5★ before the first imported record (if known). */
  pity5Before: number;
  pity4Before: number;
  guaranteedBefore: boolean;
  /** User confirms the history starts at account creation (nothing missing). */
  complete: boolean;
}

export const DEFAULT_OFFSET: PoolOffset = { pity5Before: 0, pity4Before: 0, guaranteedBefore: false, complete: false };

export interface PoolSummary {
  pool: PoolKind;
  total: number;
  fiveStars: FiveStarEntry[];
  fourStarCount: number;
  threeStarCount: number;
  pity5: number;
  pity4: number;
  guaranteed5: boolean;
  wonFiftyFifty: number;
  lostFiftyFifty: number;
  averagePullsPerFiveStar: number | null;
  firstTime: string | null;
  lastTime: string | null;
  historyComplete: boolean;
  warnings: string[];
}

/** Chronological comparison: game ids are increasing numeric strings; manual entries use seq. */
export function compareRecords(a: WarpRecord, b: WarpRecord): number {
  if (a.time !== b.time) return a.time < b.time ? -1 : 1;
  const ai = /^\d+$/.test(a.id) ? a.id : "";
  const bi = /^\d+$/.test(b.id) ? b.id : "";
  if (ai && bi && ai !== bi) return ai.length !== bi.length ? ai.length - bi.length : ai < bi ? -1 : 1;
  return (a.seq ?? 0) - (b.seq ?? 0);
}

export function isFeatured(rec: WarpRecord): boolean {
  if (rec.featuredOverride) return rec.featuredOverride === "featured";
  if (POOLS[rec.pool].fiveFeaturedChance === null) return false;
  return !(rec.itemId && STANDARD_5STAR_IDS.has(rec.itemId));
}

export function summarizePool(pool: PoolKind, records: WarpRecord[], offset: PoolOffset = DEFAULT_OFFSET): PoolSummary {
  const rules = POOLS[pool];
  const list = records.filter((r) => r.pool === pool).sort(compareRecords);
  let pity5 = offset.pity5Before;
  let pity4 = offset.pity4Before;
  let guaranteed = offset.guaranteedBefore;
  let uncertain = !offset.complete && offset.pity5Before === 0;
  const fiveStars: FiveStarEntry[] = [];
  let four = 0;
  let three = 0;
  let won = 0;
  let lost = 0;
  const warnings: string[] = [];

  for (const rec of list) {
    pity5++;
    pity4++;
    if (rec.rank === 5) {
      const featured = isFeatured(rec);
      let fiftyFifty: FiftyFiftyResult = "n/a";
      if (rules.fiveFeaturedChance !== null) {
        if (guaranteed) fiftyFifty = featured ? "guaranteed" : "lost";
        else fiftyFifty = featured ? "won" : "lost";
        if (guaranteed && !featured)
          warnings.push(`${rec.name} (${rec.time}) is off-banner although the guarantee was active. Check the featured override for this record or for the previous 5★.`);
        if (fiftyFifty === "won") won++;
        if (fiftyFifty === "lost") lost++;
        guaranteed = !featured;
      }
      if (pity5 > rules.five.hard)
        warnings.push(`${rec.name} (${rec.time}) appears after ${pity5} pulls, above hard pity ${rules.five.hard}. Records may be missing or assigned to the wrong pool.`);
      fiveStars.push({ record: rec, pityAt: pity5, featured, fiftyFifty, pityUncertain: uncertain });
      uncertain = false;
      pity5 = 0;
    } else if (rec.rank === 4) {
      four++;
      pity4 = 0;
    } else three++;
  }

  const counted = fiveStars.filter((f) => !f.pityUncertain);
  if (!offset.complete && list.length > 0)
    warnings.push("History may be incomplete: the game only shows recent Warp records, so pulls before the first imported record are unknown unless you set them.");
  if (pity5 >= rules.five.hard) warnings.push(`Current pity ${pity5} is at or above hard pity ${rules.five.hard}; data is inconsistent.`);

  return {
    pool,
    total: list.length,
    fiveStars,
    fourStarCount: four,
    threeStarCount: three,
    pity5: Math.min(pity5, rules.five.hard - 1),
    pity4,
    guaranteed5: rules.fiveFeaturedChance !== null && guaranteed,
    wonFiftyFifty: won,
    lostFiftyFifty: lost,
    averagePullsPerFiveStar: counted.length ? counted.reduce((s, f) => s + f.pityAt, 0) / counted.length : null,
    firstTime: list[0]?.time ?? null,
    lastTime: list[list.length - 1]?.time ?? null,
    historyComplete: offset.complete,
    warnings,
  };
}

/** Pity distribution data for charts: count of 5★ by pity bucket. */
export function pityHistogram(fiveStars: FiveStarEntry[], bucket = 10, hard = 90): { range: string; count: number }[] {
  const out: { range: string; count: number }[] = [];
  for (let lo = 1; lo <= hard; lo += bucket) {
    const hi = Math.min(hard, lo + bucket - 1);
    out.push({ range: `${lo}–${hi}`, count: fiveStars.filter((f) => f.pityAt >= lo && f.pityAt <= hi).length });
  }
  return out;
}
