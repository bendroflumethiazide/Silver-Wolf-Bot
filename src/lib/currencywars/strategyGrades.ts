/**
 * Investment Strategy grades (Version 4.7): Silver < Gold < Prismatic ("Prism").
 *
 * Every Strategy offer's grade comes from ONE function, `offerGrades`, so the offer the player sees,
 * the Strategy they pick, the difficulty it adds and the saved run all use the same grade.
 *
 * VERIFIED rules (HSR Wiki Investment texts):
 *  - The Rainbow/Golden/Silver Age: every Strategy is Prismatic/Gold/Silver ("fixed").
 *  - Jackpot / Last Chance: the first / third Investment Strategy is Prismatic ("guarantee" by selection).
 *  - Silver • Gold • Iridescence: at fixed Strategy Nodes, left/middle/right are Silver/Gold/Prismatic;
 *    Strategy refresh count +2.
 *  - Investment Level Up: the next Strategy's quality +1.
 *  - Gold/Silver Investment: immediately choose 1 of 3 Gold/Silver Strategies with 3 refreshes; after 3 Nodes, +1 refresh.
 *  - Gold/Prismatic Futures(+), Renegotiation: after N Nodes, a non-refreshable Gold/Prismatic choice.
 *  - Visionary: later Strategy Nodes grant 1 random Prismatic Strategy (not refreshable, no extra difficulty).
 *  - Joint Decision / Strategy Master: an extra choice at Node 2-6 / an extra Strategy at Node 3-5.
 *  - Advantage Layout "Strategy Refresh": each option can be refreshed 1 time.
 *  - Cottontail: the first Strategy refresh in each plane gives a higher-quality Strategy.
 * PROVISIONAL: with no Advantage Layout, a selection has no refreshes (STRATEGY_ASSUMED.baseRefreshes);
 * when a "fixed" rule and a one-shot +1 meet, the fixed rule wins (the Age is a rule for the whole round).
 */
import type { StrategyRarity } from "./parse";

export const GRADES: StrategyRarity[] = ["Silver", "Gold", "Prismatic"];
export type Grade = StrategyRarity;

export const STRATEGY_ASSUMED = { baseRefreshes: 0 } as const;

/** Move a grade up or down, clamped to Silver..Prismatic. */
export function shiftGrade(g: Grade, by: number): Grade {
  const i = Math.max(0, Math.min(GRADES.length - 1, GRADES.indexOf(g) + by));
  return GRADES[i];
}

export interface GradeRules {
  /** Every Strategy is this grade (The Rainbow/Golden/Silver Age). */
  fixed?: Grade;
  /** Grades by option position at fixed Strategy Nodes (Silver • Gold • Iridescence). */
  positions?: Grade[];
  /** Fixed-Node selection number (1-based) → grade (Jackpot = 1, Last Chance = 3). */
  guarantees?: Record<number, Grade>;
  /** One-shot change to the next selection (Investment Level Up = +1). */
  nextShift?: number;
  /** Extra refreshes per selection (Silver • Gold • Iridescence +2). */
  refreshBonus?: number;
  /** Advantage Layout "Strategy Refresh": each option can be refreshed once. */
  perOptionRefresh?: boolean;
  /** Visionary: Strategy Nodes grant 1 random Prismatic Strategy, not refreshable, no difficulty. */
  visionary?: boolean;
  /** Where each rule came from (shown on the cards). */
  sources?: Partial<Record<"fixed" | "positions" | "guarantee" | "shift" | "visionary" | "refresh", string>>;
}

/** An extra selection waiting for a node (Futures, Gold Investment, Joint Decision…). */
export interface PendingSelection {
  /** Global node index (0-based across the run) from which it's offered; undefined = now. */
  at?: number;
  /** Forced grade (Gold Futures = Gold); undefined = rolled with the normal rules. */
  grade?: Grade;
  refreshes: number;
  refreshable: boolean;
  /** No enemy difficulty for this pick. */
  free?: boolean;
  source: string;
}

/** Why an offered option has its grade. */
export type GradeWhy = "rolled" | "fixed" | "position" | "guarantee" | "shift" | "selection" | "visionary" | "refresh-up";

export interface OfferMeta {
  grades: Grade[];
  why: GradeWhy[];
  /** Refreshes left for this selection (shared), and per-option refresh used (Advantage Layout). */
  refreshes: number;
  perOption?: boolean[];
  refreshable: boolean;
  /** "node" = a fixed Strategy Node; otherwise an extra selection. */
  kind: "node" | "extra";
  source?: string;
  free?: boolean;
}

/**
 * The grades of the three options of one selection.
 * Order: a forced grade for an extra selection wins; at fixed Nodes, position rules, then a fixed
 * (Age) rule, then a guarantee for this selection number; the one-shot shift applies last except over
 * fixed or position rules (those stay as written).
 */
export function offerGrades(rules: GradeRules, opts: { rolled: Grade; kind: "node" | "extra"; selection: number; count: number; forced?: Grade }): { grades: Grade[]; why: GradeWhy[]; usedShift: boolean } {
  const n = opts.count;
  if (opts.forced) return { grades: Array(n).fill(opts.forced), why: Array(n).fill("selection"), usedShift: false };
  if (opts.kind === "node" && rules.positions?.length) {
    return { grades: Array.from({ length: n }, (_, i) => rules.positions![Math.min(i, rules.positions!.length - 1)]), why: Array(n).fill("position"), usedShift: false };
  }
  if (rules.fixed) return { grades: Array(n).fill(rules.fixed), why: Array(n).fill("fixed"), usedShift: false };
  let g = opts.rolled;
  let why: GradeWhy = "rolled";
  const guaranteed = opts.kind === "node" ? rules.guarantees?.[opts.selection] : undefined;
  if (guaranteed) { g = guaranteed; why = "guarantee"; }
  let usedShift = false;
  if (rules.nextShift) { const up = shiftGrade(g, rules.nextShift); if (up !== g) why = "shift"; g = up; usedShift = true; }
  return { grades: Array(n).fill(g), why: Array(n).fill(why), usedShift };
}

/** Refreshes a selection starts with. */
export function startingRefreshes(rules: GradeRules, pending?: PendingSelection): number {
  if (pending && !pending.refreshable) return 0;
  return (pending?.refreshes ?? STRATEGY_ASSUMED.baseRefreshes) + (rules.refreshBonus ?? 0);
}

export const GRADE_LABEL: Record<GradeWhy, string> = {
  rolled: "", fixed: "Fixed", position: "By position", guarantee: "Guaranteed", shift: "Upgraded", selection: "Fixed for this pick", visionary: "Visionary", "refresh-up": "Upgraded on refresh",
};
