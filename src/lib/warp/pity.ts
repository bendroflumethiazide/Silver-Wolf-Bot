/**
 * The user's current pity per Warp pool, typed in by them (e.g. copied from Star Rail Station).
 * Warp history itself is tracked externally; this app only needs the current state for planning.
 */
import { POOLS } from "./rules";

export type PityPool = "character" | "lightcone" | "standard";
export const PITY_POOLS: PityPool[] = ["character", "lightcone", "standard"];

export interface PityState { pity: number; guaranteed: boolean; updatedAt?: string }
export type PityStore = Record<PityPool, PityState>;

export const EMPTY_PITY: PityStore = {
  character: { pity: 0, guaranteed: false },
  lightcone: { pity: 0, guaranteed: false },
  standard: { pity: 0, guaranteed: false },
};

export const pityKey = (profileId: string) => `pity:${profileId}`;

/** Clamp to valid ranges: pity below hard pity; no guarantee on pools without a rate-up. */
export function sanitizePity(pool: PityPool, s: Partial<PityState>): PityState {
  const hard = POOLS[pool].five.hard;
  const pity = Math.max(0, Math.min(hard - 1, Math.floor(Number(s.pity) || 0)));
  return { pity, guaranteed: POOLS[pool].fiveFeaturedChance !== null && !!s.guaranteed, updatedAt: s.updatedAt };
}

/** True once the user has entered anything (so the UI can tell "0" from "never set"). */
export const pityKnown = (s: PityState) => !!s.updatedAt;
