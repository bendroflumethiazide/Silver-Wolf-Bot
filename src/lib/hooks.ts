"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { getDb, kvGet, kvSet, nowIso } from "./db";
import type { ScoringProfile } from "./relics/scoring";
import { useApp } from "./store";
import { summarizeAccount, type AccountSummary } from "./summary";
import { EMPTY_PITY, pityKey, sanitizePity, type PityPool, type PityState, type PityStore } from "./warp/pity";

/** Current pity per pool (entered by the user), live from IndexedDB. */
export function usePity(profileId: string): PityStore {
  return useLiveQuery(() => kvGet<PityStore>(pityKey(profileId), EMPTY_PITY), [profileId]) ?? EMPTY_PITY;
}

export async function savePity(profileId: string, pool: PityPool, state: Partial<PityState>) {
  const cur = await kvGet<PityStore>(pityKey(profileId), EMPTY_PITY);
  await kvSet(pityKey(profileId), { ...cur, [pool]: sanitizePity(pool, { ...cur[pool], ...state, updatedAt: nowIso() }) });
}

export function useRelicProfiles(profileId: string): Record<string, ScoringProfile> {
  const rows = useLiveQuery(() => getDb().relicProfiles.where("profileId").equals(profileId).toArray(), [profileId]);
  return useMemo(() => Object.fromEntries((rows ?? []).map((r) => [r.charId, r.profile])), [rows]);
}

/** Everything the dashboard and Silver Wolf need, live-updating from IndexedDB. */
export function useAccount(): { loading: boolean; summary: AccountSummary | null } {
  const { game, profileId } = useApp();
  const db = getDb();
  const characters = useLiveQuery(() => db.characters.where("profileId").equals(profileId).toArray(), [profileId]);
  const lightCones = useLiveQuery(() => db.lightCones.where("profileId").equals(profileId).toArray(), [profileId]);
  const relics = useLiveQuery(() => db.relics.where("profileId").equals(profileId).toArray(), [profileId]);
  const achievements = useLiveQuery(() => db.achievements.where("profileId").equals(profileId).toArray(), [profileId]);
  const markers = useLiveQuery(() => db.mapMarkers.where("profileId").equals(profileId).toArray(), [profileId]);
  const banners = useLiveQuery(() => db.banners.toArray(), []);
  const events = useLiveQuery(() => db.events.toArray(), []);
  const pity = usePity(profileId);
  const relicProfiles = useRelicProfiles(profileId);
  const loading = [characters, lightCones, relics, achievements, markers, banners, events].some((x) => x === undefined);
  const summary = useMemo(
    () => (loading ? null : summarizeAccount({
      game, characters: characters!, lightCones: lightCones!, relics: relics!, pity,
      achievements: achievements!, markers: markers!, banners: banners!, events: events!, relicProfiles,
    })),
    [loading, game, characters, lightCones, relics, pity, achievements, markers, banners, events, relicProfiles],
  );
  return { loading, summary };
}

export function useProfile() {
  const profileId = useApp((s) => s.profileId);
  return useLiveQuery(() => getDb().profiles.get(profileId), [profileId]);
}
