"use client";

import { Lock, RefreshCw, TrainFront, Zap } from "lucide-react";
import { useState } from "react";
import { type RunState } from "@/lib/currencywars/run";
import type { CwPack } from "@/lib/currencywars/sim";
import { goodLock, priceOf, TSR_ASSUMED, TSR_BOND, TSR_GOODS, TSR_RULES, tsrGood, tsrIncome, tsrOf, type TsrGood } from "@/lib/currencywars/trailblazeStore";
import { Badge, Button, cx, Panel } from "../ui";
import { ItemIcon, Portrait } from "./shared";
import { useSimple } from "./simple";

const TYPE_LABEL: Record<TsrGood["type"], string> = { express: "Express", enhancement: "Express Enhancement", stat: "Stat bonus", character: "Character", consumable: "Consumable", component: "Component", other: "Others" };
const EXPRESS_NAME = ["—", "Astral Express, warp!", "Forward II", "Forward III", "Forward IV"];

function GoodCard({ pack, g, price, lock, afford, onBuy, slot }: { pack: CwPack; g: TsrGood; price: number; lock: string | null; afford: boolean; onBuy?: () => void; slot?: number }) {
  return (
    <button type="button" onClick={onBuy} disabled={!onBuy || !!lock || !afford} aria-label={`Buy ${g.name} for ${price} ${g.currency === "tp" ? "Trailblaze Power" : "gold"}${slot !== undefined ? ` (slot ${slot + 1})` : ""}`}
      title={`${g.text}${g.levelVerified ? "" : "\n(Unlock level assumed.)"}${g.costVerified ? "" : "\n(Price assumed: the wiki lists none.)"}`}
      className={cx("flex min-w-0 flex-col gap-1 rounded-lg border p-2 text-left text-[11px] transition", lock ? "border-line/60 opacity-60" : afford ? "border-amber-300/50 bg-amber-300/[0.06] hover:border-amber-300" : "border-line")}>
      <span className="flex items-center gap-1.5">
        {g.character ? <Portrait name={g.character} size={22} className="!ring-1" /> : g.item ? <ItemIcon pack={pack} name={g.item} size={14} /> : g.type === "express" || g.type === "enhancement" ? <TrainFront size={14} className="text-amber-300" /> : <Zap size={14} className="text-amber-300" />}
        <b className="min-w-0 flex-1 truncate text-text">{g.name}</b>
      </span>
      {!useSimple() && <span className="line-clamp-2 text-muted">{g.text}</span>}
      <span className="mt-auto flex flex-wrap items-center justify-between gap-x-1">
        <span className="text-[9px] uppercase tracking-wide text-faint">{TYPE_LABEL[g.type]}</span>
        {lock ? <span className="flex items-center gap-0.5 text-[10px] text-faint"><Lock size={10} className="shrink-0" /> {lock}</span> : <span className={cx("font-semibold", afford ? "text-amber-200" : "text-bad")}>{price} {g.currency === "tp" ? "TP" : "gold"}</span>}
      </span>
    </button>
  );
}

/** Trailblaze Power, the Express and the store (shown once a Trailblaze Silver Rail character is in play). */
export function TrailblazeStorePanel({ run, pack, level, onBuy, onRefresh }: { run: RunState; pack: CwPack; level: number; onBuy: (id: string, slot?: number) => void; onRefresh: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const t = tsrOf(run);
  const bond = pack.bonds.find((b) => b.name === TSR_BOND);
  if (!bond) return null;
  const prep = run.phase === "prep";
  const thresholds = TSR_RULES.income.map(([c]) => c);
  const next = thresholds.find((c) => c > level);
  const afford = (g: TsrGood) => (g.currency === "tp" ? t.tp >= priceOf(t, g) : run.gold >= priceOf(t, g));
  const fixed = TSR_GOODS.filter((g) => g.type === "express" || g.type === "enhancement");
  return (
    <Panel title={<span className="flex items-center gap-2"><TrainFront size={16} className="text-amber-300" /> Trailblaze Store</span>}
      actions={<span className="flex items-center gap-2 text-sm"><Zap size={14} className="text-amber-300" /><b aria-label="Trailblaze Power">{t.tp}</b><span className="text-xs text-muted">TP</span></span>}>
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>Trailblaze Silver Rail <b className="text-text">{level}</b>/10 · {level >= 2 ? <>+{tsrIncome(pack, level)} TP after each combat</> : "opens at 2 members"}{next ? ` · next at ${next} (+${tsrIncome(pack, next)})` : ""}</span>
            <span>Spent {t.consumed}{t.consumed < TSR_RULES.pomPomAfterConsumed ? `/${TSR_RULES.pomPomAfterConsumed} (King Pom-Pom)` : " · King Pom-Pom unlocked"}</span>
          </div>
          <ol className="flex gap-1" aria-label="Bond levels">
            {thresholds.map((c) => <li key={c} className={cx("h-1.5 flex-1 rounded-full", level >= c ? "bg-amber-300" : "bg-white/10")} title={`Level ${c}: ${tsrIncome(pack, c)} TP${c === 4 ? ", goods become better" : c === 6 ? ", Bond-exclusive Components" : c === 10 ? ", +500 TP and Forward IV" : ""}`} />)}
          </ol>
        </div>
        {level < 2 && !t.tp ? <p className="text-xs text-faint">Deploy two of {bond.members.join(", ")} to open the store.</p> : (
          <>
            <div className="rounded-lg border border-amber-300/30 bg-amber-300/[0.04] p-2 text-xs">
              <p className="mb-1.5 flex flex-wrap items-center gap-2"><TrainFront size={13} className="text-amber-300" /> Express: <b>{EXPRESS_NAME[t.express]}</b>
                {t.enh.fuel + t.enh.rail + t.enh.spd > 0 && <span className="text-muted">Fuel ×{t.enh.fuel} · Light Rail ×{t.enh.rail} · SPD Boost ×{t.enh.spd}</span>}
                {t.expressMult && t.expressMult !== 1 ? <Badge tone="gold">DMG ×{t.expressMult}</Badge> : null}</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {fixed.map((g) => <GoodCard key={g.id} pack={pack} g={g} price={priceOf(t, g)} lock={goodLock(t, g, level)} afford={afford(g)} onBuy={prep ? () => onBuy(g.id) : undefined} />)}
              </div>
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span>Goods (new stock after each combat)</span>
                <Button size="sm" variant="ghost" onClick={onRefresh} disabled={!prep || level < 2 || run.gold < TSR_ASSUMED.refreshAllCost}><RefreshCw size={12} /> Refresh All · {TSR_ASSUMED.refreshAllCost} gold</Button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {t.stock.length ? t.stock.map((id, i) => {
                  const g = id ? tsrGood(id) : undefined;
                  return g ? <GoodCard key={i} pack={pack} g={g} slot={i} price={priceOf(t, g)} lock={goodLock(t, g, level)} afford={afford(g)} onBuy={prep ? () => onBuy(g.id, i) : undefined} /> : <span key={i} className="rounded-lg border border-dashed border-line/60 p-2 text-center text-[10px] text-faint">Sold</span>;
                }) : <p className="col-span-full text-xs text-faint">Stock arrives once the store opens.</p>}
              </div>
            </div>
            {Object.keys(t.stats).length > 0 && <p className="text-xs text-muted">Bought stats: {Object.entries(t.stats).map(([k, v]) => `${({ on: "On-Field", off: "Off-Field", dmgAmp: "DMG Amp", mitigation: "DMG Mitigation", lucky: "Lucky Strike Rate", spd: "SPD Amp" } as Record<string, string>)[k]} +${v}%`).join(" · ")}</p>}
            <details open={showAll} onToggle={(e) => setShowAll((e.target as HTMLDetailsElement).open)} className="text-xs">
              <summary className="cursor-pointer text-muted">Every good and its unlock ({TSR_GOODS.length}) · purchases {t.history.length}</summary>
              <ul className="mt-1 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
                {TSR_GOODS.map((g) => <li key={g.id} className="flex justify-between gap-2"><span className="truncate">{g.name}</span><span className="shrink-0 text-faint">{g.cost}{g.costVerified ? "" : "*"} {g.currency === "tp" ? "TP" : "gold"} · Lv {g.minLevel}{g.levelVerified ? "" : "*"}</span></li>)}
              </ul>
              <p className="mt-1 text-faint">* assumed: the wiki gives names, texts and prices, and that level 4/6 improve goods, 6 adds Components and 10 adds Forward IV; the other unlock levels are guesses.</p>
              {t.history.length > 0 && <ol className="mt-1 space-y-0.5 text-muted">{t.history.slice(-10).reverse().map((h, i) => <li key={i}>{h.name}: {h.cost} {h.currency === "tp" ? "TP" : "gold"}</li>)}</ol>}
            </details>
          </>
        )}
      </div>
    </Panel>
  );
}
