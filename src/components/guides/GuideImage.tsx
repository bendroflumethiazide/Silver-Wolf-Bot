"use client";

import { BookOpen } from "lucide-react";
import type { GuideMeta } from "@/lib/guides";
import { useApp } from "@/lib/store";
import { GameImage } from "../GameImage";

export function GuideImage({ g }: { g: GuideMeta }) {
  const game = useApp((s) => s.game);
  const i = g.image;
  const path = !game ? undefined
    : i.kind === "item" ? game.items[i.id]?.icon
    : i.kind === "character" ? game.characters[i.id]?.icon
    : i.kind === "relicSet" ? game.relicSets[i.id]?.icon
    : i.kind === "element" ? Object.values(game.elements)[0]?.icon
    : Object.values(game.paths)[0]?.icon;
  if (!path) return <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-900/50 to-cyan-900/30"><BookOpen size={30} className="text-cyan/80" /></div>;
  return <GameImage path={path} alt="" className={`h-full w-full ${i.kind === "character" ? "object-cover" : "object-contain p-2"}`} rounded="rounded-none" />;
}
