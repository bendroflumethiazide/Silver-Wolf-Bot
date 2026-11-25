"use client";

import { Codex } from "@/components/Codex";
import { WolfComment } from "@/components/SilverWolf";
import { PageHeader } from "@/components/ui";
import { unsourced } from "@/lib/companion/comments";

export default function BossesPage() {
  return (
    <div>
      <PageHeader title="Bosses & Enemies" subtitle="Weaknesses, resistances, mechanics, drops and strategies, recorded with sources." />
      <WolfComment comment={unsourced("Bosses & Enemies")} className="mb-5" />
      <Codex kinds={["boss", "enemy"]} />
    </div>
  );
}
