"use client";

import { ExternalLink } from "lucide-react";
import { WolfComment } from "@/components/SilverWolf";
import { ExternalButton, NumberInput, Panel, Progress } from "@/components/ui";
import { pityComment } from "@/lib/companion/comments";
import { savePity, usePity } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import { PITY_POOLS, pityKnown } from "@/lib/warp/pity";
import { POOLS, WARP_TRACKER_URL } from "@/lib/warp/rules";

export function WarpTrackerButton({ size = "md", variant = "primary" }: { size?: "sm" | "md"; variant?: "primary" | "subtle" }) {
  return <ExternalButton href={WARP_TRACKER_URL} size={size} variant={variant}><ExternalLink size={size === "sm" ? 13 : 15} /> Open Warp Tracker (Star Rail Station)</ExternalButton>;
}

/** "My pity" — the only Warp state this app keeps. History and stats live on Star Rail Station. */
export function PityPanel() {
  const { profileId } = useApp();
  const pity = usePity(profileId);
  return (
    <div className="space-y-5">
      <Panel hud title="Warp history">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-muted">Your Warp history, pity and luck stats are tracked on Star Rail Station. Import there, then copy your current pity below so the planner and Silver Wolf can use it.</p>
          <WarpTrackerButton />
        </div>
      </Panel>
      <WolfComment comment={pityComment("character", pity.character)} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PITY_POOLS.map((k) => {
          const st = pity[k];
          const rules = POOLS[k];
          return (
            <Panel key={k} title={rules.label}>
              <div className="flex items-end gap-3">
                <label className="flex-1 text-xs text-muted">
                  <span className="font-mono uppercase tracking-wider">Current pity (0–{rules.five.hard - 1})</span>
                  <NumberInput min={0} max={rules.five.hard - 1} value={st.pity} onChange={(v) => savePity(profileId, k, { pity: v })} aria-label={`${rules.label} pity`} />
                </label>
                <span className="pb-2 font-mono text-sm text-muted">/ {rules.five.hard}</span>
              </div>
              <div className="mt-3"><Progress value={st.pity} max={rules.five.hard} tone={st.pity >= rules.five.softStart ? "gold" : "violet"} label={`${rules.label} pity`} /></div>
              {rules.fiveFeaturedChance !== null ? (
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={st.guaranteed} onChange={(e) => savePity(profileId, k, { guaranteed: e.target.checked })} /> Next 5★ is guaranteed (lost last 50/50)
                </label>
              ) : <p className="mt-3 text-xs text-faint">No rate-up on this Warp.</p>}
              <p className="mt-2 text-[11px] text-faint">{pityKnown(st) ? `Updated ${new Date(st.updatedAt!).toLocaleString()}` : "Not entered yet"}{st.pity >= rules.five.softStart ? " · soft pity zone" : ""}</p>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
