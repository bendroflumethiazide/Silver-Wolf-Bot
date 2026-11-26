"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ThumbsUp, X } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { kvGet, kvSet } from "@/lib/db";
import { bondNames, trackedMatches } from "@/lib/currencywars/bonds";
import type { CwPack } from "@/lib/currencywars/sim";
import { cx } from "../ui";

const TRACK_KEY = "cwTracked";
const Ctx = createContext<{ tracked: string[]; toggle: (bond: string) => void }>({ tracked: [], toggle: () => {} });

/** Bond Tracking, shared by every Currency Wars tab and saved on this device. */
export function TrackedProvider({ children }: { children: ReactNode }) {
  const saved = useLiveQuery(() => kvGet<string[]>(TRACK_KEY, []), []);
  const tracked = saved ?? [];
  const toggle = (bond: string) => { void kvSet(TRACK_KEY, tracked.includes(bond) ? tracked.filter((b) => b !== bond) : [...tracked, bond]); };
  return <Ctx.Provider value={{ tracked, toggle }}>{children}</Ctx.Provider>;
}
export const useTracked = () => useContext(Ctx);

/** Thumbs-up on a character who has a tracked Bond (or wears its Emblem). */
export function TrackMark({ pack, name, items, className }: { pack: CwPack; name: string; items?: string[]; className?: string }) {
  const { tracked } = useTracked();
  const hits = trackedMatches(pack, name, tracked, items);
  if (!hits.length) return null;
  return (
    <span className={cx("absolute z-10 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-black shadow ring-1 ring-black/40", className ?? "right-0.5 top-0.5")} title={`Tracked: ${hits.join(", ")}`} role="img" aria-label={`Tracked bond: ${hits.join(", ")}`}>
      <ThumbsUp size={10} strokeWidth={2.5} aria-hidden />
    </span>
  );
}

/** Pick Bonds to track; matching characters get a thumbs-up everywhere. */
export function BondTracker({ pack }: { pack: CwPack }) {
  const { tracked, toggle } = useTracked();
  const options = bondNames(pack).filter((b) => !tracked.includes(b));
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="flex items-center gap-1 text-muted"><ThumbsUp size={12} className="text-emerald-400" /> Tracking:</span>
      {tracked.map((b) => (
        <span key={b} className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-400/10 py-0.5 pl-2 pr-1 text-emerald-100">
          {b}
          <button type="button" onClick={() => toggle(b)} aria-label={`Stop tracking ${b}`} className="rounded-full p-0.5 hover:bg-white/10"><X size={11} /></button>
        </span>
      ))}
      {options.length > 0 && (
        <select value="" onChange={(e) => { if (e.target.value) toggle(e.target.value); }} aria-label="Track a bond" className="min-w-0 max-w-[11rem] !py-0.5 text-xs">
          <option value="">{tracked.length ? "+ add" : "+ track a bond"}</option>
          {options.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      )}
    </div>
  );
}
