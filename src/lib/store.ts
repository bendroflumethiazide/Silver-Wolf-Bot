"use client";

import { create } from "zustand";
import { getDb, kvGet, kvSet, newId, nowIso } from "./db";
import { loadActiveGameData } from "./gamedata/source";
import type { GameData } from "./gamedata/types";
import type { Profile } from "./types";

export type Server = "America" | "Europe" | "Asia" | "TW/HK/MO";
/** Server UTC offsets in hours (daily reset is 04:00 server time). */
export const SERVER_OFFSET: Record<Server, number> = { America: -5, Europe: 1, Asia: 8, "TW/HK/MO": 8 };

export interface Settings {
  companion: "full" | "brief" | "off";
  spoilerFree: boolean;
  server: Server;
  language: string;
  cacheImages: boolean;
  enkaEnabled: boolean;
  hoyolabEnabled: boolean;
  aiChat: boolean;
  reducedMotion: boolean;
  sidebarCollapsed: boolean;
  hiddenNav: string[];
  dashboardHidden: string[];
  dashboardOrder: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  companion: "full",
  spoilerFree: true,
  server: "America",
  language: "en",
  cacheImages: true,
  enkaEnabled: false,
  hoyolabEnabled: false,
  aiChat: false,
  reducedMotion: false,
  sidebarCollapsed: false,
  hiddenNav: [],
  dashboardHidden: [],
  dashboardOrder: [],
};

interface AppState {
  ready: boolean;
  error: string | null;
  game: GameData | null;
  settings: Settings;
  profileId: string;
  init: () => Promise<void>;
  reloadGame: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  setProfile: (id: string) => Promise<void>;
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  error: null,
  game: null,
  settings: DEFAULT_SETTINGS,
  profileId: "",
  init: async () => {
    if (get().ready) return;
    try {
      const db = getDb();
      const settings = { ...DEFAULT_SETTINGS, ...(await kvGet<Partial<Settings>>("settings", {})) };
      let profileId = await kvGet<string>("activeProfile", "");
      if (!profileId || !(await db.profiles.get(profileId))) {
        const first = await db.profiles.toCollection().first();
        if (first) profileId = first.id;
        else {
          const p: Profile = { id: newId("profile"), name: "Trailblazer", source: "manual", createdAt: nowIso(), updatedAt: nowIso() };
          await db.profiles.put(p);
          profileId = p.id;
        }
        await kvSet("activeProfile", profileId);
      }
      const game = await loadActiveGameData();
      set({ ready: true, settings, profileId, game, error: null });
    } catch (e) {
      set({ ready: true, error: e instanceof Error ? e.message : String(e) });
    }
  },
  reloadGame: async () => set({ game: await loadActiveGameData() }),
  updateSettings: async (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    await kvSet("settings", settings);
  },
  setProfile: async (id) => {
    await kvSet("activeProfile", id);
    set({ profileId: id });
  },
}));
