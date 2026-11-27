"use client";

import { Lock, RotateCcw, Sparkle } from "lucide-react";
import { useEffect, useState } from "react";
import { kvGet, kvSet } from "@/lib/db";
import { ADVANTAGE_ASSUMED, ADVANTAGE_NODES, emptyLayout, lockReason, resetLayout, syncSeason, unlockNode, type AdvantageLayout as Layout, type AdvantageNode } from "@/lib/currencywars/advantage";
import { Button, cx, Panel } from "../ui";
import { CwImg } from "./shared";
import { Verbose } from "./simple";

export const ADVANTAGE_KEY = "cwAdvantage";

/** The saved layout for this season (seasonal nodes from an older season are refunded). */
export async function loadLayout(season: string): Promise<Layout> {
  const l = await kvGet<Layout | null>(ADVANTAGE_KEY, null);
  const synced = syncSeason(l ?? emptyLayout(season), season);
  if (synced !== l) await kvSet(ADVANTAGE_KEY, synced);
  return synced;
}

const GROUPS: { kind: AdvantageNode["kind"]; title: string }[] = [
  { kind: "permanent", title: "Permanent Advantage" },
  { kind: "boost-permanent", title: "Combat Ability Boosts · Permanent" },
  { kind: "seasonal", title: "Seasonal Advantage" },
  { kind: "boost-seasonal", title: "Combat Ability Boosts · Seasonal" },
];

export function AdvantageLayoutPanel({ season }: { season: string }) {
  const [layout, setLayout] = useState<Layout | null>(null);
  useEffect(() => { let live = true; void loadLayout(season).then((l) => { if (live) setLayout(l); }); return () => { live = false; }; }, [season]);
  if (!layout) return null;
  const save = (l: Layout) => { setLayout(l); void kvSet(ADVANTAGE_KEY, l); };
  const spent = layout.unlocked.length;
  return (
    <Panel title={<span className="flex items-center gap-2"><Sparkle size={15} className="text-violet-300" /> Advantage Layout</span>}
      actions={<span className="flex items-center gap-2 text-sm"><CwImg kind="resource" name="Phantasmal Orb" size={22} /><b aria-label="Phantasmal Orbs">{layout.orbs}</b><span className="text-xs text-muted">Phantasmal Orbs</span>
        <Button size="sm" variant="ghost" onClick={() => save(resetLayout(layout))} disabled={!spent}><RotateCcw size={12} /> Reset</Button></span>}>
      <Verbose>
        <p className="mb-2 text-xs text-muted">Unlocked nodes apply to runs you start afterwards. Seasonal nodes open after every Permanent one; resetting refunds every Orb. Combat Ability Boosts cost 20 Orbs (wiki); other node costs ({ADVANTAGE_ASSUMED.permanentCost} permanent, {ADVANTAGE_ASSUMED.seasonalCost} seasonal) and Orbs per run ({ADVANTAGE_ASSUMED.orbsPerRankStep} per rank step, +{ADVANTAGE_ASSUMED.orbsForClear} for a clear, {ADVANTAGE_ASSUMED.orbsPerPlane} per plane reached) are assumed.</p>
      </Verbose>
      <div className="space-y-3">
        {GROUPS.map((g) => (
          <div key={g.kind}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.title}</p>
            <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {ADVANTAGE_NODES.filter((n) => n.kind === g.kind).map((n) => {
                const why = lockReason(layout, n);
                const on = layout.unlocked.includes(n.id);
                return (
                  <li key={n.id} className={cx("flex flex-col gap-1 rounded-md border p-2 text-xs", on ? "border-violet-300/60 bg-violet-500/15" : "border-white/10 bg-black/20")}>
                    <span className="flex items-center justify-between gap-2"><b className="text-text">{n.name}</b><span className="shrink-0 text-faint">{n.cost} Orbs</span></span>
                    {n.text !== n.name && <span className="text-muted">{n.text}</span>}
                    {on ? <span className="mt-auto text-violet-200">Unlocked</span>
                      : <Button size="sm" variant="ghost" className="mt-auto self-start" disabled={!!why} onClick={() => save(unlockNode(layout, n.id))} aria-label={`Unlock ${n.name}`}>{why ? <><Lock size={11} /> {why}</> : "Unlock"}</Button>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}
