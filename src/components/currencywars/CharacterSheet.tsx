"use client";

import { ThumbsUp, ChevronDown, Coins, Crown, Crosshair, Heart, Hexagon, PlusCircle, ShieldHalf, Sparkle, Sword, Wind, Zap, type LucideIcon } from "lucide-react";
import { Fragment, useState } from "react";
import { bondsOf } from "@/lib/currencywars/bonds";
import { characterStats, maxStars, STAR_VALUES, type StatKey } from "@/lib/currencywars/stats";
import type { CwPack } from "@/lib/currencywars/sim";
import { Badge, cx } from "../ui";
import { RecommendedGear } from "./RecommendedGear";
import { BondMembers, COST_TEXT, FieldTag, Portrait } from "./shared";
import { useTracked } from "./tracking";

const ICON: Partial<Record<StatKey, [LucideIcon, string]>> = {
  onField: [Sword, "text-amber-400"], offField: [Crosshair, "text-sky-400"], dmgAmp: [Crown, "text-violet-400"], mitigation: [ShieldHalf, "text-cyan"],
  luckyRate: [Sparkle, "text-yellow-300"], luckyDmg: [Zap, "text-rose-400"], spdAmp: [Wind, "text-fuchsia-400"], healing: [PlusCircle, "text-emerald-400"],
  shield: [Hexagon, "text-teal-300"], hpAmp: [Heart, "text-pink-400"], breakEff: [Zap, "text-orange-300"], initialEnergy: [Zap, "text-yellow-200"],
};
const fmt = (v: number, percent: boolean, signed = false) => `${signed && v >= 0 ? "+" : ""}${Number.isInteger(v) ? v : v.toFixed(1)}${percent ? "%" : ""}`;

/** Effect text with "a/b/c" star values: the selected star's value is highlighted. */
function StarText({ text, star }: { text: string; star: number }) {
  const parts = text.split(STAR_VALUES);
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{p.split("\n").map((line, j) => <Fragment key={j}>{j > 0 && <br />}{line}</Fragment>)}</Fragment>;
        const vals = p.split("/");
        // Five values are Light Cone superimpositions, not stars: show them plainly.
        if (vals.length === 5) return <span key={i} className="text-text">{p}</span>;
        const pick = Math.min(star - 1, vals.length - 1);
        return <span key={i}>{vals.map((v, k) => <Fragment key={k}>{k > 0 && <span className="text-faint">/</span>}<span className={k === pick ? "font-semibold text-cyan" : "text-faint"}>{v}</span></Fragment>)}</span>;
      })}
    </>
  );
}

/** Everything about one Currency Wars character: stats like the game's Stats Details, abilities, Eidolons, Light Cone, equipment. */
export function CharacterSheet({ pack, name, stars: initialStars = 1, items = [], bag = [], place }: { pack: CwPack; name: string; stars?: number; items?: string[]; bag?: string[]; place?: "on" | "off" | "bench" }) {
  const info = pack.info?.[name];
  const cost = info?.cost ?? pack.characters.find((c) => c.name === name)?.cost ?? 1;
  const top = maxStars(pack, name);
  const [stars, setStars] = useState(Math.min(initialStars, top));
  const groups = info?.abilities ?? [];
  const preferred = place === "off" ? groups.findIndex((g) => /off/i.test(g.group)) : groups.findIndex((g) => /on/i.test(g.group) && !/off/i.test(g.group));
  const [tab, setTab] = useState(Math.max(0, preferred));
  const [bond, setBond] = useState<string | null>(null);
  const { gear, toggleGear } = useTracked();
  const rows = characterStats(pack, name, stars, items);
  const quick: StatKey[] = ["onField", "offField", "dmgAmp", "mitigation", "luckyRate", "luckyDmg", "spdAmp", "healing"];

  if (!info) return <p className="text-sm text-muted">No character page data for {name}. Press Update on the Currency Wars page to download it.</p>;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start gap-3">
        <Portrait name={name} cost={cost} size={60} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-base font-semibold">{name}</h3>
            <span className={cx("flex items-center gap-1 font-semibold", COST_TEXT[cost])}><Coins size={14} />{cost}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1"><FieldTag field={info.field} />{info.roles.map((r) => <Badge key={r} tone="gold">{r}</Badge>)}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {bondsOf(pack, name).map((b) => <button key={b} type="button" onClick={() => setBond(bond === b ? null : b)} aria-expanded={bond === b} className={cx("rounded border px-1.5 py-0.5 text-[11px]", bond === b ? "border-cyan text-cyan" : "border-line text-muted hover:text-text")}>{b}</button>)}
          </div>
        </div>
      </div>
      {bond && <BondMembers pack={pack} bond={bond} />}

      <div className="flex items-center gap-2 text-xs text-muted">
        Star level
        <div className="flex rounded-md border border-line" role="radiogroup" aria-label="Star level">
          {Array.from({ length: top }, (_, k) => k + 1).map((s) => <button key={s} type="button" role="radio" aria-checked={stars === s} onClick={() => setStars(s)} className={cx("px-2 py-0.5", stars === s ? "bg-amber-400/20 text-amber-300" : "text-faint")}>{s}★</button>)}
        </div>
        {items.length > 0 && <span className="text-faint">· with {items.length} item{items.length === 1 ? "" : "s"}</span>}
      </div>

      <div className="grid grid-cols-4 gap-1.5" aria-label="Stats">
        {quick.map((k) => {
          const r = rows.find((x) => x.key === k)!;
          const [Icon, tone] = ICON[k]!;
          return <div key={k} title={r.label} className="flex items-center gap-1.5 rounded-md border border-line bg-white/[0.03] px-2 py-1.5"><Icon size={14} className={tone} aria-hidden /><span className="font-mono text-xs">{fmt(r.total, r.percent)}</span><span className="sr-only">{r.label}</span></div>;
        })}
      </div>

      {(info.recommended?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-line p-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-xs font-medium">Recommended equipment</p>
            <button type="button" onClick={() => toggleGear(name)} aria-pressed={gear.includes(name)} className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]", gear.includes(name) ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-100" : "border-line text-muted hover:text-text")}><ThumbsUp size={10} /> {gear.includes(name) ? "Tracking gear" : "Track gear"}</button>
          </div>
          <RecommendedGear pack={pack} name={name} place={place} held={items} bag={bag} />
        </div>
      )}

      <details className="rounded-lg border border-line" open>
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 font-medium">Stats Details <ChevronDown size={14} className="text-faint" /></summary>
        <div className="space-y-2 border-t border-line px-3 py-2">
          {rows.map((r) => {
            const [Icon, tone] = ICON[r.key] ?? [Zap, "text-muted"];
            return (
              <div key={r.key}>
                <div className="flex items-center justify-between gap-2 border-b border-line/60 pb-1"><span className="flex items-center gap-1.5"><Icon size={14} className={tone} aria-hidden />{r.label}</span><span className="font-mono">{fmt(r.total, r.percent)}</span></div>
                <ul className="mt-0.5 space-y-0.5 pl-6 text-xs text-muted">
                  {r.parts.map((p) => <li key={p.label} className="flex justify-between gap-2"><span>{p.label}</span><span className={cx("font-mono", p.boost && "text-cyan")}>{fmt(p.value, p.percent, p.boost)}</span></li>)}
                </ul>
              </div>
            );
          })}
          <p className="text-[11px] text-faint">Hidden damage multipliers (wiki damage formula): base DMG Amplification {info.baseDmgAmp ?? 0}%, plus {info.eidolonAmp ?? 0}% per Eidolon level. Boosts here come from equipment only; Bond and Plot Armor effects aren&apos;t added. The game also uses your own build&apos;s SPD, which isn&apos;t on the wiki.</p>
        </div>
      </details>

      {info.summaries && info.summaries.length > 0 && (
        <div className="space-y-1.5">
          {info.summaries.map((a, i) => (
            <div key={i} className="rounded-lg border border-line bg-white/[0.02] p-2.5">
              <div className="flex flex-wrap items-center gap-1.5"><b>{a.name}</b>{a.types.map((t) => <Badge key={t} tone={/talent/i.test(t) ? "ok" : "cyan"}>{t}</Badge>)}{a.energy && <span className="text-[11px] text-faint">{a.energy} Energy</span>}</div>
              <p className="mt-1 text-xs text-muted">{a.desc}</p>
            </div>
          ))}
        </div>
      )}

      {groups.length > 0 && (
        <div>
          <div className="mb-2 flex flex-wrap gap-1" role="tablist" aria-label="Abilities">
            {groups.map((g, i) => <button key={g.group} type="button" role="tab" aria-selected={tab === i} onClick={() => setTab(i)} className={cx("rounded-full border px-2.5 py-1 text-xs", tab === i ? "border-cyan bg-cyan/15 text-text" : "border-line text-muted")}>{g.group}</button>)}
          </div>
          <ul className="space-y-2">
            {groups[Math.min(tab, groups.length - 1)].list.map((a) => (
              <li key={a.name + a.types.join()} className="rounded-lg border border-line p-2.5">
                <div className="flex flex-wrap items-center gap-1.5"><b>{a.name}</b>{a.types.map((t) => <Badge key={t} tone={/talent/i.test(t) ? "ok" : /ultimate/i.test(t) ? "gold" : "cyan"}>{t}</Badge>)}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted"><StarText text={a.effect} star={stars} /></p>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-faint">Values read 1★/2★/3★{top > 3 ? "/4★" : ""}; the highlighted one is the star level picked above.</p>
        </div>
      )}

      {(info.eidolons?.length || info.lightCone) && (
        <details className="rounded-lg border border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 font-medium">Off-Field Eidolons and Light Cone <ChevronDown size={14} className="text-faint" /></summary>
          <div className="space-y-2 border-t border-line px-3 py-2 text-xs">
            {info.eidolons?.map((e, i) => <p key={i}><b className="text-text">E{i + 1} {e.name}:</b> <span className="text-muted">{e.desc}</span></p>)}
            {info.lightCone && <p><b className="text-text">Light Cone · {info.lightCone.name}:</b> <span className="text-muted"><StarText text={info.lightCone.desc} star={1} /></span></p>}
          </div>
        </details>
      )}

      {items.length > 0 && <p className="text-xs text-muted">Holding: {items.join(", ")}</p>}
      {info.notes && info.notes.length > 0 && <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-faint">{info.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
    </div>
  );
}
