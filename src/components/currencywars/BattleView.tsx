"use client";

import { FastForward, Hourglass, Pause, Play, SkipForward, Skull } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { hpAt, turnOrder, type Timeline, type TlUnit } from "@/lib/currencywars/timeline";
import { Button, cx, Panel } from "../ui";
import { CwImg, Portrait } from "./shared";
import { Verbose } from "./simple";
import { cwIcon } from "@/lib/currencywars/icons";

/** Action Value played per real second at 1× (a 150 AV fight lasts about 12 seconds). */
const AV_PER_SECOND = 12;
const SPEEDS = [1, 2, 4] as const;

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}.${Math.floor((sec % 1) * 10)}`;

function HpBar({ hp, max, tone, phases }: { hp: number; max: number; tone: "ally" | "enemy" | "boss"; phases?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-black/40">
      <div className={cx("h-full rounded-full transition-[width] duration-150", tone === "ally" ? (pct > 0.5 ? "bg-emerald-400" : pct > 0.25 ? "bg-amber-400" : "bg-rose-500") : tone === "boss" ? "bg-gradient-to-r from-rose-600 to-fuchsia-500" : "bg-rose-500")} style={{ width: `${pct * 100}%` }} />
      {phases && phases > 1 && Array.from({ length: phases - 1 }, (_, i) => <span key={i} className="absolute top-0 h-full w-px bg-white/70" style={{ left: `${((i + 1) / phases) * 100}%` }} />)}
    </div>
  );
}

function SummonFace({ u, size }: { u: TlUnit; size: number }) {
  const art = u.name === "Astral Express" ? cwIcon("misc", "Astral Express") : u.name === "Aha" ? cwIcon("character", "Aha") : cwIcon("character", u.name);
  if (art) return <img src={art} alt="" aria-hidden className="inline-block shrink-0 rounded-full bg-violet-500/30 object-contain ring-1 ring-violet-300/70" style={{ width: size, height: size }} />;
  return <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/40 to-cyan-500/30 ring-1 ring-violet-300/70" style={{ width: size, height: size, fontSize: size * 0.55 }}>{u.summon?.emoji ?? "✦"}</span>;
}

function UnitRow({ u, hp, hit, down }: { u: TlUnit; hp: number; hit: boolean; down: boolean }) {
  const isAlly = u.side === "ally";
  if (u.summon) {
    return (
      <li className="flex items-center gap-2 rounded-lg border border-violet-400/40 bg-violet-500/[0.06] px-2 py-1.5" title={u.summon.note}>
        <SummonFace u={u} size={28} />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[11px]">{u.name}</span>
          <span className="block truncate text-[10px] text-muted">Summon · {u.summon.bond}{u.summon.spd ? ` · ${u.summon.spd} SPD` : " · strikes at the start"}</span>
        </div>
      </li>
    );
  }
  return (
    <li className={cx("flex items-center gap-2 rounded-lg border px-2 py-1.5 transition", hit ? "border-rose-400/80 bg-rose-500/10" : "border-line bg-white/[0.02]", down && "opacity-40", u.boss && "py-2.5")}>
      {isAlly ? <Portrait name={u.name} cost={u.cost} size={28} className="!ring-1" /> : <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold", u.boss ? "bg-rose-600/50 text-rose-100" : u.elite ? "bg-amber-500/30 text-amber-100" : "bg-white/10 text-muted")}>{u.boss ? "BOSS" : u.elite ? "ELT" : "—"}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cx("truncate text-[11px]", u.boss ? "font-semibold text-text" : "")}>{isAlly && u.stars ? `${"★".repeat(u.stars)} ` : ""}{u.name}</span>
          <span className="shrink-0 font-mono text-[10px] text-muted">{u.idle ? "IDLE" : `${Math.ceil(hp).toLocaleString()}`}</span>
        </div>
        <HpBar hp={hp} max={u.maxHp} tone={isAlly ? "ally" : u.boss ? "boss" : "enemy"} phases={u.phases} />
      </div>
    </li>
  );
}

function TurnAvatar({ u, size }: { u: TlUnit; size: number }) {
  if (u.summon) return <SummonFace u={u} size={size} />;
  if (u.side === "ally") return <Portrait name={u.name} cost={u.cost} size={size} className="!ring-1" />;
  const initials = u.name.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-1", u.boss ? "bg-rose-700/70 text-rose-100 ring-rose-300/70" : u.elite ? "bg-amber-600/50 text-amber-50 ring-amber-200/60" : "bg-slate-600/60 text-slate-100 ring-white/30")} style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {u.boss ? <Skull size={size * 0.5} aria-hidden /> : initials}
    </span>
  );
}

/** Turn order like the game's left-hand bar: who's acting now, who's next, and Action Value until each turn. */
function TurnOrder({ tl, t, showAv }: { tl: Timeline; t: number; showAv: boolean }) {
  const { current, next } = turnOrder(tl, t, 8);
  const unit = (id: string) => tl.units.find((u) => u.id === id);
  const rows = [...(current ? [{ ...current, av: 0, now: true }] : []), ...next.map((n) => ({ ...n, now: false }))];
  const cycle = Math.floor(t / 100) + 1;
  return (
    <div className="min-w-0" aria-label="Turn order">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Turn order</p>
      <div className="relative overflow-x-auto md:overflow-visible">
        <ol className="flex gap-1.5 pb-1 md:flex-col md:pb-0">
          {rows.map((r, i) => {
            const u = unit(r.id);
            if (!u) return null;
            return (
              <li key={`${r.id}-${r.t}-${i}`} title={`${u.name}${showAv ? ` · ${r.av} AV` : ""}`}
                className={cx("relative flex shrink-0 items-center gap-1.5 rounded-lg border px-1 py-1 md:pr-2", r.now ? "border-cyan bg-cyan/15" : u.summon ? "border-violet-400/40 bg-violet-500/[0.08]" : u.side === "ally" ? "border-sky-400/30 bg-sky-400/[0.06]" : "border-rose-400/30 bg-rose-400/[0.06]", u.boss && "py-1.5")}>
                <TurnAvatar u={u} size={u.boss ? 34 : 28} />
                <span className="hidden min-w-0 flex-1 truncate text-[10px] md:block">{u.name}</span>
                {showAv && <span className={cx("absolute bottom-0 right-0 rounded-tl-md rounded-br-lg px-1 font-mono text-[10px] font-semibold md:static md:rounded md:bg-transparent", r.now ? "bg-cyan text-black md:text-cyan" : "bg-black/70 text-text")}>{r.now ? "▶" : r.av}</span>}
              </li>
            );
          })}
        </ol>
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted"><Hourglass size={12} aria-hidden /> Cycle <b className="text-text">{cycle}</b></p>
    </div>
  );
}

/** Watch a fight play out. The outcome is already decided; this shows how it went. */
export function BattleView({ timeline, title, onDone }: { timeline: Timeline; title: string; onDone: () => void }) {
  const [t, setT] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [playing, setPlaying] = useState(true);
  const [showAv, setShowAv] = useState(true);
  const raf = useRef<number | null>(null);
  const last = useRef<number | null>(null);
  const done = t >= timeline.end;
  const box = useRef<HTMLDivElement>(null);
  // The Battle button sits below the board; bring the fight into view when it starts.
  useEffect(() => { box.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }); }, []);

  useEffect(() => {
    if (!playing || done) { last.current = null; return; }
    const tick = (now: number) => {
      const dt = last.current === null ? 0 : (now - last.current) / 1000;
      last.current = now;
      setT((cur) => Math.min(timeline.end, cur + dt * AV_PER_SECOND * speed));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current !== null) cancelAnimationFrame(raf.current); last.current = null; };
  }, [playing, speed, done, timeline.end]);

  const hp = useMemo(() => hpAt(timeline, t), [timeline, t]);
  const recent = useMemo(() => new Set(timeline.events.filter((e) => e.kind === "hit" && e.t <= t && e.t > t - 3 && e.to).map((e) => e.to!)), [timeline, t]);
  const feed = useMemo(() => timeline.events.filter((e) => e.t <= t && e.text).slice(-5).reverse(), [timeline, t]);
  const name = (id?: string) => timeline.units.find((u) => u.id === id)?.name ?? "";
  const lastHit = useMemo(() => [...timeline.events].reverse().find((e) => e.kind === "hit" && e.t <= t), [timeline, t]);
  const wave = timeline.events.filter((e) => e.kind === "wave" && e.t <= t).length + 1;
  const allies = timeline.units.filter((u) => u.side === "ally" && !u.summon);
  const summons = timeline.units.filter((u) => u.summon);
  const enemies = timeline.units.filter((u) => u.side === "enemy" && (u.wave ?? 1) <= wave);
  const waves = Math.max(1, ...timeline.units.map((u) => u.wave ?? 1));
  const avLeft = timeline.limit === null ? null : Math.max(0, timeline.limit - t);
  // Elation: live Punchline, the Aha Instant banner and who is using an Elation Skill.
  const elationEvents = timeline.events.filter((e) => e.punchline !== undefined && e.t <= t);
  const punchline = elationEvents.length ? elationEvents[elationEvents.length - 1].punchline : undefined;
  const hasElation = timeline.events.some((e) => e.kind === "aha" || e.kind === "elation");
  const instant = [...timeline.events].reverse().find((e) => e.kind === "aha" && e.t <= t && e.t > t - 4);
  const skill = [...timeline.events].reverse().find((e) => e.kind === "elation" && e.t <= t && e.t > t - 2);

  return (
    <div ref={box} className="scroll-mt-20">
    <Panel title={title} actions={
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => setPlaying((p) => !p)} disabled={done} aria-label={playing ? "Pause" : "Play"}>{playing && !done ? <Pause size={13} /> : <Play size={13} />}</Button>
        <button type="button" onClick={() => setShowAv((v) => !v)} aria-pressed={showAv} className={cx("rounded-lg border px-2 py-1 text-xs", showAv ? "border-cyan/60 text-cyan" : "border-line text-muted")}>AV</button>
        <div className="flex rounded-lg border border-line" role="radiogroup" aria-label="Battle speed">
          {SPEEDS.map((x) => <button key={x} type="button" role="radio" aria-checked={speed === x} onClick={() => setSpeed(x)} className={cx("px-2 py-1 text-xs", speed === x ? "bg-cyan/20 text-cyan" : "text-muted")}>{x}×</button>)}
        </div>
        {!done ? <Button size="sm" variant="ghost" onClick={() => setT(timeline.end)}><SkipForward size={13} /> Skip</Button>
          : <Button size="sm" variant="primary" onClick={onDone}>See results →</Button>}
      </div>
    }>
      <div className="mb-3 grid gap-2 text-xs sm:grid-cols-3">
        <span className="flex items-center gap-1.5"><FastForward size={13} className="text-cyan" /> Elapsed <b className="font-mono text-text">{fmt(t / AV_PER_SECOND)}</b></span>
        <span>{avLeft === null ? <>No time limit (Reward node)</> : <>Action Value left <b className="font-mono text-text">{Math.ceil(avLeft)}</b> / {timeline.limit}</>}</span>
        <span>{waves > 1 ? `Wave ${Math.min(wave, waves)} of ${waves}` : enemies.some((e) => e.boss) ? "Boss fight" : " "}</span>
      </div>
      {hasElation && (
        <div className={cx("mb-3 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-1.5 text-xs transition", instant ? "border-[#e8735e] bg-[#e8735e]/15" : "border-white/10 bg-black/20")} aria-label="Elation">
          <span className="flex items-center gap-1"><CwImg kind="misc" name="Punchline" size={18} />Punchline <b className="font-mono text-[#ffb3a5]">{punchline ?? 0}</b></span>
          {instant && <span className="cw-instant flex items-center gap-1 font-semibold text-[#ffb3a5]"><CwImg kind="misc" name="Aha Instant Incoming" size={22} />AHA INSTANT!</span>}
          {skill && <span className="text-text">{skill.text}</span>}
        </div>
      )}
      {timeline.limit !== null && <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-gradient-to-r from-cyan to-violet-400" style={{ width: `${(Math.min(t, timeline.limit) / timeline.limit) * 100}%` }} /></div>}
      <div className="grid gap-3 md:grid-cols-[9.5rem_minmax(0,1fr)_minmax(0,1fr)]">
        <TurnOrder tl={timeline} t={t} showAv={showAv} />
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Your squad</p>
          <ul className="space-y-1">{allies.map((u) => <UnitRow key={u.id} u={u} hp={hp.get(u.id) ?? 0} hit={recent.has(u.id)} down={(hp.get(u.id) ?? 0) <= 0 && !u.idle} />)}</ul>
          {summons.length > 0 && <>
            <p className="mb-1 mt-2 text-[11px] font-semibold uppercase tracking-wider text-violet-300">Summons</p>
            <ul className="space-y-1" aria-label="Summons">{summons.map((u) => <UnitRow key={u.id} u={u} hp={0} hit={false} down={false} />)}</ul>
          </>}
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-rose-300">Enemies</p>
          <ul className="space-y-1">{enemies.map((u) => <UnitRow key={u.id} u={u} hp={hp.get(u.id) ?? 0} hit={recent.has(u.id)} down={(hp.get(u.id) ?? 0) <= 0} />)}</ul>
        </div>
      </div>
      <div className="mt-3 min-h-[5.5rem] rounded-lg border border-line bg-black/20 p-2 text-[11px]" aria-live="polite">
        {lastHit && !done && <p className="text-muted">{name(lastHit.from)} hits {name(lastHit.to)} for <b className="text-text">{lastHit.amount?.toLocaleString()}</b></p>}
        {feed.map((e, i) => <p key={`${e.t}-${i}`} className={cx(e.kind === "end" ? (timeline.won ? "font-semibold text-ok" : "font-semibold text-bad") : e.kind === "fall" ? "text-rose-300" : e.kind === "phase" || e.kind === "ultimate" ? "text-fuchsia-300" : e.lucky ? "font-semibold text-yellow-300" : e.kind === "aha" || e.kind === "elation" ? "font-semibold text-[#ffb3a5]" : e.kind === "punchline" || e.kind === "banger" ? "text-[#f0a597]" : "text-faint")}>{e.text}</p>)}
      </div>
      <Verbose><p className="mt-2 text-[10px] text-faint">A replay of the simulated result, not the game&apos;s real battle engine. Summons act on their own SPD. Revives cost Action Value in the game; the bar here doesn&apos;t move for them.</p></Verbose>
    </Panel>
    </div>
  );
}
