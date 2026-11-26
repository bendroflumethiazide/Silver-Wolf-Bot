"use client";

import { Coins, Crown, Shield, Swords, ThumbsUp, X } from "lucide-react";
import { abilityCard } from "@/lib/currencywars/abilities";
import { bondsOf } from "@/lib/currencywars/bonds";
import type { CwPack } from "@/lib/currencywars/sim";
import { cx } from "../ui";
import { ItemIcon, Portrait } from "./shared";
import { useSimple } from "./simple";

/** Category label colours (the same everywhere in the app). */
export const LABEL_TONE: Record<string, string> = {
  "Basic ATK": "bg-[#3f5a9e] text-white", "Enhanced Basic ATK": "bg-[#3f5a9e] text-white",
  Skill: "bg-[#2f7a8c] text-white", Ultimate: "bg-[#6b4aa8] text-white", "Elation Skill": "bg-[#e8735e] text-white",
  Talent: "bg-[#3f8f7f] text-white", "Innate Trace": "bg-[#a3302a] text-white", "Follow-Up ATK": "bg-[#4e6fb8] text-white",
  "Memosprite Skill": "bg-[#a04a86] text-white", "Memosprite Talent": "bg-[#a04a86] text-white", Summon: "bg-[#8a6d2f] text-white",
  Technique: "bg-[#5a5f73] text-white",
};

export function AbilityTags({ labels, size = "md" }: { labels: string[]; size?: "sm" | "md" }) {
  return (
    <span className="flex flex-wrap gap-1" aria-label={`Ability types: ${labels.join(", ")}`}>
      {labels.map((l) => <span key={l} className={cx("rounded-sm font-medium leading-none", size === "sm" ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-1 text-[11px]", LABEL_TONE[l] ?? "bg-slate-600 text-white")}>{l}</span>)}
    </span>
  );
}

const POSITION = { on: "On-Field", off: "Off-Field", both: "On/Off-Field" } as const;

/**
 * The in-game character card: portrait, cost, position, roles, Bonds, the ability box with its
 * category labels and summary, equipment slots and actions.
 */
export function CharacterCard({ pack, name, cost, stars, items, place, plotArmor, onBond, bondOpen, onItem, actions, onClose, extra }: {
  pack: CwPack; name: string; cost: number; stars: number; items: string[]; place: "on" | "off" | "bench";
  plotArmor?: string | null; onBond?: (b: string) => void; bondOpen?: string | null; onItem?: (item: string) => void;
  actions?: React.ReactNode; onClose?: () => void; extra?: React.ReactNode;
}) {
  const simple = useSimple();
  const info = pack.info?.[name];
  const card = abilityCard(info, place, cost);
  const bonds = bondsOf(pack, name);
  const slots = Math.max(3, items.length);
  return (
    <section aria-label={`${name} card`} className="cw-card relative overflow-hidden rounded-lg border border-white/15 bg-gradient-to-b from-[#26233f] to-[#15131f] text-sm shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
      <div className="flex justify-center"><span className="-mt-px rounded-b-md border-x border-b border-white/15 bg-black/40 px-4 py-0.5 text-xs tracking-widest text-amber-300" aria-label={`${stars} star`}>{"✦".repeat(stars)}</span></div>
      {onClose && <button type="button" onClick={onClose} aria-label="Close card" className="absolute right-1.5 top-1.5 rounded p-1 text-faint hover:text-text"><X size={14} /></button>}
      <div className="flex gap-3 px-3 pt-2">
        <div className="relative shrink-0">
          <Portrait name={name} cost={cost} size={64} className="!rounded-md" />
          {plotArmor && <Crown size={14} className="absolute -left-1 -top-1 text-fuchsia-300" aria-label={`Plot Armor: ${plotArmor}`} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-1">
            <b className="truncate text-base text-text">{name}</b>
            <span className="flex shrink-0 items-center gap-1 text-amber-200" title="Cost"><Coins size={14} />{cost}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-1.5">
            <span className="flex items-center gap-1 text-xs text-muted"><Shield size={12} aria-hidden />{info ? POSITION[info.field] : "—"}</span>
            <span className="flex flex-wrap gap-1">{(info?.roles ?? []).map((r) => <span key={r} className="rounded-sm bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">{r}</span>)}</span>
          </div>
        </div>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5 px-3" aria-label={`${name}'s Bonds`}>
        {bonds.map((b) => (
          <li key={b}><button type="button" onClick={() => onBond?.(b)} aria-expanded={bondOpen === b} className={cx("rounded-sm border px-2 py-0.5 text-xs", bondOpen === b ? "border-cyan text-cyan" : "border-white/25 text-text hover:border-white/50")}>{b}</button></li>
        ))}
      </ul>
      {card && (
        <div className="mx-3 mt-2 rounded-md border border-white/10 bg-black/25 p-2.5">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-faint" aria-hidden><Swords size={16} /></span>
            <div className="min-w-0 flex-1">
              <b className="block text-text">{card.name}</b>
              <div className="mt-1"><AbilityTags labels={card.labels} /></div>
            </div>
          </div>
          {card.desc && <p className={cx("mt-2 text-[13px] leading-snug text-text/90", simple && "line-clamp-3")}>{card.desc}</p>}
          {!simple && card.energy ? <p className="mt-1 text-[11px] text-faint">{card.energy} Energy</p> : null}
        </div>
      )}
      {extra && <div className="mx-3 mt-2">{extra}</div>}
      <div className="mt-2 flex items-center gap-2 border-t border-white/10 px-3 py-2">
        <span className="flex items-center gap-1 rounded-full border border-white/20 px-2 py-1 text-[11px] text-muted"><ThumbsUp size={11} /> Recommended</span>
        <div className="ml-auto flex gap-1.5">
          {Array.from({ length: slots }, (_, i) => {
            const it = items[i];
            return it
              ? <button key={i} type="button" onClick={() => onItem?.(it)} title={it} aria-label={`Equipment: ${it}`} className="flex h-9 w-9 items-center justify-center rounded border border-violet-300/50 bg-violet-500/15 hover:border-cyan"><ItemIcon pack={pack} name={it} size={18} /></button>
              : <span key={i} className="flex h-9 w-9 items-center justify-center rounded border border-white/15 bg-black/30 text-white/20" aria-label="Empty equipment slot"><Shield size={14} /></span>;
          })}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-1.5 border-t border-white/10 bg-black/20 px-3 py-2">{actions}</div>}
    </section>
  );
}

