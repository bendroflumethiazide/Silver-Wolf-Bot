"use client";

import { Award, ThumbsUp, Clover, Coins, Crosshair, Flower2, Footprints, Gem, Pickaxe, Shield, Sparkles, Sword, Zap, type LucideIcon } from "lucide-react";
import { bondFamily, bondsOf, membersOf } from "@/lib/currencywars/bonds";
import { emblemBond, oreGold, oreTier } from "@/lib/currencywars/items";
import { useState } from "react";
import { cwCharacterId } from "@/lib/currencywars/names";
import type { BondTier, CwField } from "@/lib/currencywars/parse";
import type { BondState, CwPack } from "@/lib/currencywars/sim";
import { useApp } from "@/lib/store";
import { GameImage } from "../GameImage";
import { cx } from "../ui";
import { TrackMark, useTracked } from "./tracking";

export const COST_RING: Record<number, string> = { 1: "ring-zinc-400", 2: "ring-emerald-400", 3: "ring-sky-400", 4: "ring-violet-400", 5: "ring-amber-400", 7: "ring-rose-400" };
export const COST_TEXT: Record<number, string> = { 1: "text-zinc-300", 2: "text-emerald-300", 3: "text-sky-300", 4: "text-violet-300", 5: "text-amber-300", 7: "text-rose-300" };
/** Card backgrounds by cost, like the in-game shop cards. */
export const COST_CARD: Record<number, string> = {
  1: "from-zinc-500/25 to-zinc-900/40 border-zinc-500/40",
  2: "from-emerald-500/25 to-emerald-950/40 border-emerald-500/40",
  3: "from-sky-500/25 to-sky-950/40 border-sky-500/40",
  4: "from-violet-500/30 to-violet-950/40 border-violet-500/50",
  5: "from-amber-400/30 to-amber-950/40 border-amber-400/60",
  7: "from-rose-500/30 to-rose-950/40 border-rose-400/60",
};
export const COST_BAR: Record<number, string> = { 1: "bg-zinc-400", 2: "bg-emerald-400", 3: "bg-sky-400", 4: "bg-violet-400", 5: "bg-amber-400" };
const TIER_HEX: Record<BondTier, string> = { bronze: "bg-orange-900/70 text-orange-200 ring-orange-400/50", silver: "bg-slate-500/60 text-white ring-slate-200/60", gold: "bg-amber-500/70 text-black ring-amber-200", plat: "bg-gradient-to-br from-fuchsia-400 to-cyan-300 text-black ring-white/70" };
export const TIER_LABEL: Record<BondTier, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", plat: "Prismatic" };

export function Portrait({ name, cost, size = 56, className }: { name: string; cost?: number; size?: number; className?: string }) {
  const game = useApp((s) => s.game);
  const id = cwCharacterId(name, game);
  return (
    <span className={cx("inline-block shrink-0 overflow-hidden rounded-full ring-2", COST_RING[cost ?? 1] ?? "ring-line", className)} style={{ width: size, height: size }}>
      <GameImage path={id ? game?.characters[id]?.icon : undefined} alt={name} fallback={name} className="h-full w-full" rounded="rounded-full" />
    </span>
  );
}

export const FIELD_LABEL: Record<CwField, string> = { on: "On-Field", off: "Off-Field", both: "On/Off" };
export function FieldTag({ field }: { field?: CwField }) {
  if (!field) return null;
  return <span className={cx("rounded px-1 text-[9px] font-semibold uppercase tracking-wide", field === "on" ? "bg-rose-500/20 text-rose-200" : field === "off" ? "bg-sky-500/20 text-sky-200" : "bg-white/10 text-muted")}>{FIELD_LABEL[field]}</span>;
}

export { bondsOf };

/** A Bond's members as small portraits (owned/deployed ones bright), with a Track toggle. */
export function BondMembers({ pack, bond, have, compact }: { pack: CwPack; bond: string; have?: Set<string>; compact?: boolean }) {
  const { tracked, toggle } = useTracked();
  const fam = bondFamily(bond);
  const members = membersOf(pack, fam);
  const on = tracked.includes(fam);
  const costOf = (n: string) => pack.characters.find((c) => c.name === n)?.cost;
  return (
    <div className={cx("space-y-1.5", !compact && "rounded-lg border border-line bg-black/20 p-2")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-text">{fam} · {members.length} member{members.length === 1 ? "" : "s"}</span>
        <button type="button" onClick={() => toggle(fam)} aria-pressed={on} className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]", on ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-100" : "border-line text-muted hover:text-text")}>
          <ThumbsUp size={10} /> {on ? "Tracking" : "Track"}
        </button>
      </div>
      {members.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${fam} members`}>
          {members.map((m) => (
            <li key={m} className={cx("flex w-12 flex-col items-center gap-0.5 text-center", have && !have.has(m) && "opacity-45")} title={`${m}${costOf(m) ? ` · ${costOf(m)} gold` : ""}`}>
              <Portrait name={m} cost={costOf(m)} size={30} className="!ring-1" />
              <span className="line-clamp-2 w-full text-[9px] leading-tight text-muted">{m}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-[10px] text-faint">No native members: it activates through Plot Armor.</p>}
    </div>
  );
}

/** A shop-style character card: portrait, bond tags, name and cost. */
export function CharCard({ pack, name, cost, stars, onClick, disabled, footer, highlight }: {
  pack: CwPack; name: string; cost: number; stars?: number; onClick?: () => void; disabled?: boolean; footer?: React.ReactNode; highlight?: boolean;
}) {
  const bonds = bondsOf(pack, name);
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={name}
      className={cx("relative flex min-w-0 flex-col items-center gap-1 rounded-xl border bg-gradient-to-b p-1.5 pb-2 text-center transition disabled:cursor-not-allowed disabled:opacity-40", COST_CARD[cost] ?? COST_CARD[1], highlight && "ring-2 ring-cyan", onClick && !disabled && "hover:brightness-125")}>
      {stars && stars > 1 && <span className="absolute left-1.5 top-1 text-[10px] text-amber-300">{"★".repeat(stars)}</span>}
      <TrackMark pack={pack} name={name} className="right-1 top-1" />
      <Portrait name={name} cost={cost} size={48} />
      <span className="flex w-full flex-wrap justify-center gap-0.5">{bonds.slice(0, 2).map((b) => <span key={b} className="max-w-full truncate rounded bg-black/30 px-1 text-[9px] text-muted">{b}</span>)}</span>
      <span className="line-clamp-2 w-full text-[11px] font-medium leading-tight">{name}</span>
      <span className={cx("flex items-center gap-0.5 text-[11px] font-semibold", COST_TEXT[cost])}><Coins size={11} />{footer ?? cost}</span>
    </button>
  );
}

/** The shop odds for one level as a coloured bar with labels. */
export function OddsBar({ odds }: { odds: number[] }) {
  return (
    <div className="min-w-0">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/5">{odds.map((p, i) => p > 0 && <span key={i} className={COST_BAR[i + 1]} style={{ width: `${p * 100}%` }} />)}</div>
      <div className="mt-1 flex flex-wrap gap-x-2 text-[10px]">{odds.map((p, i) => <span key={i} className={cx(p > 0 ? COST_TEXT[i + 1] : "text-faint")}>{i + 1}: {Math.round(p * 100)}%</span>)}</div>
    </div>
  );
}

/** Game-style bond list: tier badge with the count, name, and every threshold. */
export function BondList({ pack, states, have, empty = "Bonds light up as you deploy characters." }: { pack: CwPack; states: BondState[]; have?: Set<string>; empty?: string }) {
  const { tracked } = useTracked();
  const [open, setOpen] = useState<string | null>(null);
  if (!states.length) return <p className="text-xs text-muted">{empty}</p>;
  return (
    <ul className="space-y-1">
      {states.map((b) => {
        const isOpen = open === b.bond.name;
        return (
          <li key={b.bond.name}>
            <button type="button" onClick={() => setOpen(isOpen ? null : b.bond.name)} aria-expanded={isOpen}
              className={cx("flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left", b.active ? "bg-white/[0.06]" : "opacity-70 hover:opacity-100")}>
              <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center text-xs font-bold ring-1 [clip-path:polygon(25%_0,75%_0,100%_50%,75%_100%,25%_100%,0_50%)]", b.tier ? TIER_HEX[b.tier] : "bg-white/10 text-muted ring-white/10")}>{b.count}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-xs font-medium">{b.bond.name}{tracked.includes(bondFamily(b.bond.name)) && <ThumbsUp size={10} className="shrink-0 text-emerald-400" aria-label="tracked" />}</span>
                <span className="block text-[10px] text-faint">
                  {b.bond.levels.map((l, i) => <span key={l.count}>{i > 0 && "/"}<span className={b.count >= l.count ? "font-semibold text-cyan" : ""}>{l.count}</span></span>)}
                </span>
              </span>
            </button>
            {isOpen && (
              <div className="mb-1 ml-9 space-y-1 text-[11px] text-muted">
                {b.bond.summary && <p>{b.bond.summary}</p>}
                {b.bond.levels.map((l) => <p key={l.count} className={cx(b.active?.count === l.count && "text-text")}><b className={b.count >= l.count ? "text-cyan" : "text-faint"}>({l.count})</b> {l.effect}</p>)}
                <p className="text-faint">{b.bond.category}</p>
                <BondMembers pack={pack} bond={b.bond.name} have={have} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const BASIC_ICON: Record<string, LucideIcon> = {
  "Roller Skates": Footprints, "Folding Knife": Sword, "Peace Pistol": Crosshair, "Lucky Star": Clover,
  "Flower of Life": Flower2, "Batch Produced Armor": Shield, "Aether Drill": Pickaxe, "Photon Cell": Zap,
};
const BASIC_TONE: Record<string, string> = {
  "Roller Skates": "text-cyan", "Folding Knife": "text-rose-300", "Peace Pistol": "text-sky-300", "Lucky Star": "text-emerald-300",
  "Flower of Life": "text-pink-300", "Batch Produced Armor": "text-amber-200", "Aether Drill": "text-orange-300", "Photon Cell": "text-yellow-300",
};

/** Crystal Ore orbs by tier (White, Blue, Gold, Prismatic). */
const ORE_ORB: Record<string, string> = {
  White: "bg-[radial-gradient(circle_at_35%_30%,#fff,#a1a1aa)] text-zinc-200",
  Blue: "bg-[radial-gradient(circle_at_35%_30%,#e0f2fe,#3b82f6_60%,#1e3a8a)] text-sky-400",
  Gold: "bg-[radial-gradient(circle_at_35%_30%,#fef9c3,#f59e0b_60%,#92400e)] text-amber-400",
  Prismatic: "bg-[conic-gradient(from_0deg,#f472b6,#facc15,#4ade80,#38bdf8,#a78bfa,#f472b6)] text-fuchsia-300",
};

/** Icon for an item: basic items have their own; advanced items show their two parts; ores are orbs. */
export function ItemIcon({ pack, name, size = 16 }: { pack: CwPack; name: string; size?: number }) {
  const Basic = BASIC_ICON[name];
  if (Basic) return <Basic size={size} className={BASIC_TONE[name]} aria-hidden />;
  const tier = oreTier(name) ?? (oreGold(name) !== null ? "Gold" : null);
  if (tier) return <span aria-hidden className={cx("inline-block shrink-0 rounded-full shadow-[0_0_8px_currentColor] ring-1 ring-white/50", ORE_ORB[tier])} style={{ width: size, height: size }} />;
  if (name === "Red Gem" || name === "Blue Gem" || name === "Wealth Gem") return <Gem size={size} className={name === "Red Gem" ? "text-rose-400" : name === "Blue Gem" ? "text-sky-400" : "text-amber-300"} aria-hidden />;
  if (emblemBond(pack, name)) return <Award size={size} className="text-amber-200" aria-hidden />;
  const adv = pack.equipment?.advanced.find((a) => a.name === name);
  if (!adv) return <Sparkles size={size} className="text-violet-300" aria-hidden />;
  const [A, B] = adv.recipe.map((r) => BASIC_ICON[r] ?? Sparkles);
  return (
    <span className="relative inline-flex items-center justify-center rounded bg-violet-500/25 ring-1 ring-violet-300/40" style={{ width: size + 6, height: size + 6 }} aria-hidden>
      <A size={size * 0.62} className={cx("absolute left-0.5 top-0.5", BASIC_TONE[adv.recipe[0]])} />
      <B size={size * 0.62} className={cx("absolute bottom-0.5 right-0.5", BASIC_TONE[adv.recipe[1]])} />
    </span>
  );
}
