"use client";

import type { LucideIcon } from "lucide-react";
import type { GameData } from "@/lib/gamedata/types";
import { NAV } from "@/lib/nav";
import { useApp } from "@/lib/store";
import { GameImage } from "./GameImage";
import { cx } from "./ui";

/** A picture from game data for each hub card (falls back to the menu icon before data is downloaded). */
function pathFor(id: string, game: GameData): { path?: string; contain?: boolean } {
  const item = (iid: string) => game.items[iid]?.icon;
  const firstOf = <T extends { icon?: string }>(o: Record<string, T>) => Object.values(o)[0]?.icon;
  switch (id) {
    case "wolf": return { path: game.characters["1006"]?.icon };
    case "account": return { path: game.characters["8001"]?.icon ?? game.characters["8002"]?.icon };
    case "characters": return { path: game.characters["1308"]?.icon ?? game.characters["1006"]?.icon };
    case "light-cones": return { path: game.lightCones["23007"]?.icon ?? firstOf(game.lightCones), contain: true };
    case "relics": return { path: game.relicSets["114"]?.icon ?? firstOf(game.relicSets), contain: true };
    case "npcs": return { path: Object.values(game.contacts)[0]?.icon };
    case "banners": return { path: item("102"), contain: true };
    case "codes": return { path: item("1"), contain: true };
    case "warp": return { path: item("101"), contain: true };
    case "materials": return { path: item("2"), contain: true };
    case "teams": return { path: game.characters["1303"]?.icon ?? game.characters["1006"]?.icon };
    case "universe": return { path: item("33") ?? firstOf(game.curios), contain: true };
    case "currency-wars": return { path: item("252"), contain: true };
    case "endgame": return { path: item("241"), contain: true };
    case "guides": return { path: item("213"), contain: true };
    case "modes": return { path: item("11"), contain: true };
    case "events": return { path: item("3"), contain: true };
    case "achievements": return { path: item("22"), contain: true };
    case "import": return { path: item("235"), contain: true };
    case "bosses": return {};
    default: return {};
  }
}

export function HubImage({ id, override }: { id: string; override?: string | null }) {
  const game = useApp((s) => s.game);
  const nav = NAV.find((n) => n.id === id);
  const Icon: LucideIcon | undefined = nav?.icon;
  const pick = override ? { path: override, contain: false } : game ? pathFor(id, game) : {};
  if (pick.path) return <GameImage path={pick.path} alt="" className={cx("h-full w-full", pick.contain ? "object-contain p-2" : "object-cover")} rounded="rounded-none" />;
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-900/50 to-cyan-900/30">
      {Icon && <Icon size={34} className="text-cyan/80" />}
    </div>
  );
}
