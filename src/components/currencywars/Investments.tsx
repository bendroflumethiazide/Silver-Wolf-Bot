"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import type { StrategyRarity } from "@/lib/currencywars/parse";
import type { CwPack } from "@/lib/currencywars/sim";
import { Badge, cx, Empty, Panel } from "../ui";

const TONE: Record<StrategyRarity, "default" | "gold" | "violet"> = { Silver: "default", Gold: "gold", Prismatic: "violet" };

/** Browse every Investment Environment and Investment Strategy of the season. */
export function Investments({ pack }: { pack: CwPack }) {
  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState<StrategyRarity | "all">("all");
  const [plane, setPlane] = useState<number | "all">("all");
  const needle = q.trim().toLowerCase();
  const match = (x: { name: string; effect: string }) => !needle || `${x.name} ${x.effect}`.toLowerCase().includes(needle);
  const envs = (pack.environments ?? []).filter(match);
  const strats = (pack.strategies ?? []).filter((s) => match(s) && (rarity === "all" || s.rarity === rarity) && (plane === "all" || s.planes.includes(plane)));
  if (!pack.environments?.length && !pack.strategies?.length) return <Empty title="No investment data">Press Update at the top to download it.</Empty>;
  const chip = (on: boolean) => cx("rounded-full border px-2.5 py-1 text-xs", on ? "border-cyan bg-cyan/15 text-text" : "border-line text-muted");

  return (
    <div className="space-y-5">
      <label className="relative block">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search effects (gold, interest, 5-cost…)" aria-label="Search environments and strategies" className="w-full !pl-8" />
      </label>
      <Panel title={`Investment Environments (${envs.length})`}>
        <p className="mb-3 text-xs text-muted">Pick 1 of 3 at the start of a run. It lasts the whole run.</p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {envs.map((e) => <li key={e.name} className="rounded-lg border border-cyan/25 bg-cyan/[0.03] p-2.5"><b className="block text-sm">{e.name}</b><span className="text-xs text-muted">{e.effect}</span></li>)}
        </ul>
      </Panel>
      <Panel title={`Investment Strategies (${strats.length})`}>
        <p className="mb-2 text-xs text-muted">Pick 1 of 3 after the first fight of each plane. All three offers share a rarity; Gold and Prismatic make enemies tougher.</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(["all", "Silver", "Gold", "Prismatic"] as const).map((r) => <button key={r} type="button" aria-pressed={rarity === r} onClick={() => setRarity(r)} className={chip(rarity === r)}>{r === "all" ? "All rarities" : r}</button>)}
          {(["all", 1, 2, 3] as const).map((p) => <button key={p} type="button" aria-pressed={plane === p} onClick={() => setPlane(p)} className={chip(plane === p)}>{p === "all" ? "Any plane" : `Plane ${p}`}</button>)}
        </div>
        {!strats.length ? <Empty title="No matches" /> : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {strats.map((s) => (
              <li key={`${s.rarity}-${s.name}`} className="rounded-lg border border-line p-2.5">
                <div className="flex items-start justify-between gap-2"><b className="text-sm">{s.name}</b><Badge tone={TONE[s.rarity]}>{s.rarity}</Badge></div>
                <p className="mt-1 text-xs text-muted">{s.effect}</p>
                <p className="mt-1 text-[10px] text-faint">Plane {s.planes.join(", ")}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
