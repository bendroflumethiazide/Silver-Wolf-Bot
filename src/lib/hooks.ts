"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { getDb, kvGet } from "./db";
import type { ScoringProfile } from "./relics/scoring";
import { useApp } from "./store";
import { summarizeAccount, type AccountSummary } from "./summary";
import type { PoolOffset } from "./warp/history";
import type { PoolKind } from "./warp/rules";

export function useOffsets(profileId: string) {
  return useLiveQuery(() => kvGet<Partial<Record<PoolKind, PoolOffset>>>(`warpOffsets:${profileId}`, {}), [profileId]) ?? {};
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
  const warps = useLiveQuery(() => db.warps.where("profileId").equals(profileId).toArray(), [profileId]);
  const achievements = useLiveQuery(() => db.achievements.where("profileId").equals(profileId).toArray(), [profileId]);
  const markers = useLiveQuery(() => db.mapMarkers.where("profileId").equals(profileId).toArray(), [profileId]);
  const banners = useLiveQuery(() => db.banners.toArray(), []);
  const events = useLiveQuery(() => db.events.toArray(), []);
  const offsets = useOffsets(profileId);
  const relicProfiles = useRelicProfiles(profileId);
  const loading = [characters, lightCones, relics, warps, achievements, markers, banners, events].some((x) => x === undefined);
  const summary = useMemo(
    () => (loading ? null : summarizeAccount({
      game, characters: characters!, lightCones: lightCones!, relics: relics!, warps: warps!, offsets,
      achievements: achievements!, markers: markers!, banners: banners!, events: events!, relicProfiles,
    })),
    [loading, game, characters, lightCones, relics, warps, offsets, achievements, markers, banners, events, relicProfiles],
  );
  return { loading, summary };
}

export function useProfile() {
  const profileId = useApp((s) => s.profileId);
  return useLiveQuery(() => getDb().profiles.get(profileId), [profileId]);
}
