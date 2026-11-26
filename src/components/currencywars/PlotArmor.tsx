"use client";

import { Coins, Crown, RefreshCw, Repeat, Shuffle } from "lucide-react";
import { useState } from "react";
import { deployed, type RunState } from "@/lib/currencywars/run";
import { eligible, freeLeft, optionById, PLOT_ARMOR_CONFIG, plotOf, refreshPrice, selectionNode, type PlotCategory } from "@/lib/currencywars/plotArmor";
import type { CwPack } from "@/lib/currencywars/sim";
import { Badge, Button, cx, Panel } from "../ui";
import { Portrait } from "./shared";
import { useSimple } from "./simple";

const CAT: Record<PlotCategory, { label: string; tone: "violet" | "cyan" | "gold" }> = { character: { label: "Character", tone: "violet" }, bond: { label: "Bond", tone: "cyan" }, resource: { label: "Resource", tone: "gold" } };
const STAGE = { protagonist: "Protagonist", imagenae: "Imagenae: Plot Armor", swap: "Swap (It's A Wrap)" } as const;

/** The selection screen: who gets Plot Armor, then one of two options, with refreshes. */
export function PlotArmorPanel({ run, pack, onProtagonist, onRefresh, onChoose }: { run: RunState; pack: CwPack; onProtagonist: (uid: number) => void; onRefresh: () => void; onChoose: (i: number) => void }) {
  const simple = useSimple();
  const p = plotOf(run);
  const cur = p.current;
  if (!cur) return null;
  const who = cur.uid !== undefined ? deployed(run).find((u) => u.uid === cur.uid) ?? run.bench.find((u) => u?.uid === cur.uid) : null;
  const free = freeLeft(p);
  const price = refreshPrice(p);
  const n = p.done.length + 1;
  return (
    <Panel title={<span className="flex items-center gap-2"><Crown size={16} className="text-fuchsia-300" /> Plot Armor · {cur.stage === "protagonist" ? `Protagonist ${n} of 2` : STAGE[cur.stage]}</span>}
      actions={<span className="text-xs text-muted">Plane {cur.plane + 1}, node {run.node + 1}</span>}>
      {cur.uid === undefined ? (
        <>
          <p className="mb-2 text-sm text-muted">Choose the protagonist from your deployed characters. They keep the Plot Armor you pick for the rest of the run.</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {eligible(run).map((u) => (
              <button key={u.uid} type="button" onClick={() => onProtagonist(u.uid)} aria-label={`Make ${u.name} the protagonist`} className="flex flex-col items-center gap-1 rounded-lg border border-fuchsia-300/40 p-2 text-[11px] hover:border-fuchsia-300">
                <Portrait name={u.name} cost={u.cost} size={40} />
                <span className="text-amber-300">{"★".repeat(u.stars)}</span>
                <span className="w-full truncate text-center">{u.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="mb-2 flex items-center gap-2 text-sm">{who && <Portrait name={who.name} cost={who.cost} size={28} />}<span>Plot Armor for <b>{who?.name}</b>: pick one of {PLOT_ARMOR_CONFIG.options}.</span></p>
          <div className="grid gap-3 sm:grid-cols-2">
            {cur.options.map((id, i) => {
              const o = optionById(pack, id);
              if (!o) return null;
              const freeDiff = !!run.escapade?.powerfulPlot;
              return (
                <button key={`${id}-${i}`} type="button" onClick={() => onChoose(i)} className={cx("rounded-xl border bg-gradient-to-b to-transparent p-4 text-left hover:brightness-125", o.powerful ? "border-fuchsia-300/70 from-fuchsia-400/20" : "border-violet-300/40 from-violet-400/10")}>
                  <span className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
                    <Badge tone={CAT[o.category].tone}>{CAT[o.category].label}</Badge>
                    {o.powerful && <Badge tone="violet">Powerful</Badge>}
                    <span>{o.target === "protagonist" ? "Target: protagonist" : "Target: squad"} · {o.duration === "run" ? "lasts the run" : "instant"}</span>
                  </span>
                  <b className="mt-1 block">{o.name}</b>
                  <span className="mt-1 block text-xs text-muted">{o.text}</span>
                  {o.difficulty > 0 && <span className={cx("mt-1 block text-xs", freeDiff ? "text-ok line-through" : "text-bad")}>Enemy difficulty +{o.difficulty}{freeDiff ? " (waived: Bubble Wolf)" : ""}</span>}
                  {!o.verified && !simple && <span className="mt-1 block text-[10px] text-faint">Stand-in option (the wiki has no list of Plot Armor effects).</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <Button onClick={onRefresh} disabled={!free && run.gold < price}><RefreshCw size={13} /> {free ? `Refresh · free (${free} left)` : <>Refresh · <Coins size={11} className="text-amber-300" /> {price}</>}</Button>
            {!simple && <span className="text-muted">{free ? `Free refreshes: ${p.free.filter((f) => f.left).map((f) => `${f.left} from ${f.source}`).join(", ")}. ` : ""}Paid price {p.fixedCost !== undefined ? `fixed at ${p.fixedCost} (Plot Armor Procurement)` : `${price} gold next (first ${PLOT_ARMOR_CONFIG.cheapRefreshes} paid cost 1, then +${PLOT_ARMOR_CONFIG.escalation} each)`}.{p.storeChain ? ` Each refresh: +${p.storeChain} free Store refresh.` : ""} Refreshed {cur.refreshes}×.</span>}
            {simple && <span className="text-muted">Refreshed {cur.refreshes}×</span>}
          </div>
        </>
      )}
    </Panel>
  );
}

/** Holders, refresh sources, investments' chances, and the history. */
export function PlotArmorStatus({ run, pack, onSwap, onChange }: { run: RunState; pack: CwPack; onSwap: () => void; onChange: (from: number, to: number) => void }) {
  const p = plotOf(run);
  const [changing, setChanging] = useState<number | null>(null);
  const prep = run.phase === "prep";
  const plan = [0, 1].map((pl) => `Plane ${pl + 1} node ${selectionNode(run, pl) + 1}${p.done.includes(pl) ? " ✓" : ""}`).join(" · ");
  return (
    <Panel title={<span className="flex items-center gap-2"><Crown size={15} className="text-fuchsia-300" /> Plot Armor</span>}>
      <div className="space-y-2 text-xs">
        <p className="text-muted">Protagonists chosen at: {plan}{p.early ? " (Early Entrance)" : ""}.</p>
        {p.holders.length ? (
          <ul className="space-y-1.5">
            {p.holders.map((h, i) => {
              const o = optionById(pack, h.option);
              return (
                <li key={i} className={cx("flex flex-wrap items-center gap-2 rounded-lg border p-1.5", h.disabled ? "border-line opacity-50" : "border-fuchsia-300/40")}>
                  <Portrait name={h.name} size={26} />
                  <span className="min-w-0 flex-1"><b className="text-text">{h.name}</b> · {o?.name ?? h.option} <span className="text-faint">({h.source === "protagonist" ? `Protagonist, Plane ${h.plane + 1}` : h.source === "imagenae" ? "Imagenae: Plot Armor" : "swapped in"}{h.disabled ? ", disabled" : ""})</span></span>
                  {prep && p.changes > 0 && !h.disabled && h.source !== "imagenae" && <Button size="sm" variant="ghost" onClick={() => setChanging(changing === h.uid ? null : h.uid)}><Repeat size={12} /> Change</Button>}
                  {changing === h.uid && (
                    <span className="flex w-full flex-wrap gap-1">{eligible(run).map((u) => <button key={u.uid} type="button" onClick={() => { onChange(h.uid, u.uid); setChanging(null); }} className="rounded border border-line px-1.5 py-0.5 hover:border-fuchsia-300">{u.name}</button>)}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <p className="text-faint">No Plot Armor yet.</p>}
        <p className="text-muted">Free refreshes {freeLeft(p)}{p.free.length ? ` (${p.free.map((f) => `${f.source}: ${f.left}`).join(", ")})` : ""} · paid so far {p.paid} · next paid {refreshPrice(p)} gold{p.storeChain ? ` · Refresh Chain +${p.storeChain} Store refresh each` : ""}</p>
        {(p.changes > 0 || p.swaps > 0) && (
          <p className="flex flex-wrap items-center gap-2">
            {p.changes > 0 && <Badge tone="cyan">{p.changes} protagonist change{p.changes === 1 ? "" : "s"} (New Cast Performance)</Badge>}
            {p.swaps > 0 && <Button size="sm" onClick={onSwap} disabled={!prep}><Shuffle size={12} /> Use a swap ({p.swaps})</Button>}
          </p>
        )}
        {p.history.length > 0 && (
          <details><summary className="cursor-pointer text-muted">History ({p.history.length})</summary>
            <ol className="mt-1 space-y-0.5 text-muted">{p.history.map((h, i) => <li key={i}>P{h.plane + 1}: {h.text}</li>)}</ol>
          </details>
        )}
      </div>
    </Panel>
  );
}
