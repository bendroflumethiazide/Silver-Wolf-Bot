"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { fillUnknown } from "@/lib/currencywars/gear";
import { effectCoverage, type EffectCoverage } from "@/lib/currencywars/run";
import type { StrategyRarity } from "@/lib/currencywars/parse";
import type { CwPack } from "@/lib/currencywars/sim";
import { Badge, cx, Empty, Panel } from "../ui";
import { CwImg } from "./shared";
import { Verbose } from "./simple";

const COVER: Record<EffectCoverage["status"], { label: string; tone: string }> = {
  full: { label: "Simulated", tone: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" },
  partial: { label: "Partly simulated", tone: "border-amber-400/40 bg-amber-500/10 text-amber-200" },
  none: { label: "Not simulated", tone: "border-white/15 bg-white/5 text-faint" },
};

/** What the run simulator does with this text. */
function Coverage({ c }: { c: EffectCoverage }) {
  return (
    <div className="mt-1.5 space-y-0.5">
      <span className={cx("inline-block rounded border px-1.5 py-0.5 text-[10px]", COVER[c.status].tone)} title={[...c.applied, ...c.missing.map((m) => `not simulated: ${m}`)].join("\n")}>{COVER[c.status].label}</span>
      <Verbose>
        {c.applied.length > 0 && <p className="text-[10px] text-emerald-300/80">In the simulator: {c.applied.join(" · ")}</p>}
        {c.missing.length > 0 && <p className="text-[10px] text-faint">Not simulated: {c.missing.join(", ")}</p>}
      </Verbose>
    </div>
  );
}

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
  const cover = useMemo(() => new Map([...(pack.environments ?? []), ...(pack.strategies ?? [])].map((x) => [x.name, effectCoverage(pack, x.name, x.effect)])), [pack]);
  const counts = (list: { name: string }[]) => { const c = { full: 0, partial: 0, none: 0 }; for (const x of list) { const k = cover.get(x.name)?.status; if (k) c[k]++; } return `${c.full} simulated · ${c.partial} partly · ${c.none} not`; };
  if (!pack.environments?.length && !pack.strategies?.length) return <Empty title="No investment data">Press Update at the top to download it.</Empty>;
  const chip = (on: boolean) => cx("rounded-full border px-2.5 py-1 text-xs", on ? "border-cyan bg-cyan/15 text-text" : "border-line text-muted");

  return (
    <div className="space-y-5">
      <label className="relative block">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search effects (gold, interest, 5-cost…)" aria-label="Search environments and strategies" className="w-full !pl-8" />
      </label>
      <Panel title={`Investment Environments (${envs.length})`}>
        <p className="mb-3 text-xs text-muted">Pick 1 of 3 at the start of a run. It lasts the whole run. <span className="text-faint">Run simulator: {counts(pack.environments ?? [])}.</span></p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {envs.map((e) => <li key={e.name} className="rounded-lg border border-cyan/25 bg-cyan/[0.03] p-2.5"><span className="flex items-center gap-2"><CwImg kind="environment" name={e.name} size={28} /><b className="block text-sm">{e.name}</b></span><span className="text-xs text-muted">{fillUnknown(e.name, e.effect)}</span>{cover.get(e.name) && <Coverage c={cover.get(e.name)!} />}</li>)}
        </ul>
      </Panel>
      <Panel title={`Investment Strategies (${strats.length})`}>
        <p className="mb-2 text-xs text-muted">Pick 1 of 3 after the first fight of each plane. All three offers share a rarity; Gold and Prismatic make enemies tougher. <span className="text-faint">Run simulator: {counts(pack.strategies ?? [])}.</span></p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(["all", "Silver", "Gold", "Prismatic"] as const).map((r) => <button key={r} type="button" aria-pressed={rarity === r} onClick={() => setRarity(r)} className={chip(rarity === r)}>{r === "all" ? "All rarities" : r}</button>)}
          {(["all", 1, 2, 3] as const).map((p) => <button key={p} type="button" aria-pressed={plane === p} onClick={() => setPlane(p)} className={chip(plane === p)}>{p === "all" ? "Any plane" : `Plane ${p}`}</button>)}
        </div>
        {!strats.length ? <Empty title="No matches" /> : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {strats.map((s) => (
              <li key={`${s.rarity}-${s.name}`} className="rounded-lg border border-line p-2.5">
                <div className="flex items-start justify-between gap-2"><span className="flex items-center gap-2"><CwImg kind="strategy" name={s.name} size={28} /><b className="text-sm">{s.name}</b></span><Badge tone={TONE[s.rarity]}>{s.rarity}</Badge></div>
                <p className="mt-1 text-xs text-muted">{fillUnknown(s.name, s.effect)}</p>
                <p className="mt-1 text-[10px] text-faint">Plane {s.planes.join(", ")}</p>
                {cover.get(s.name) && <Coverage c={cover.get(s.name)!} />}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
