"use client";

import Link from "next/link";
import { Codex } from "@/components/Codex";
import { WolfComment } from "@/components/SilverWolf";
import { PageHeader } from "@/components/ui";
import { unsourced } from "@/lib/companion/comments";

export default function GameModesPage() {
  return (
    <div>
      <PageHeader title="Game Modes" subtitle="Memory of Chaos, Pure Fiction, Apocalyptic Shadow, Simulated and Divergent Universe and more: rules, rotations, resets and your status." />
      <WolfComment comment={unsourced("Game Modes")} className="mb-5" />
      <p className="mb-4 text-sm text-muted">Scores and stars per season are logged in <Link href="/teams" className="text-cyan hover:underline">Builds & Teams → Endgame history</Link>. Simulated Universe blessings and curios from game data are in <Link href="/universe" className="text-cyan hover:underline">Simulated Universe</Link>.</p>
      <Codex kinds={["mode"]} />
    </div>
  );
}
