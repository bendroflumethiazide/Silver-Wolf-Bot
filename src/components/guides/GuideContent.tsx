"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PATH_DISPLAY, stripMarkup } from "@/lib/gamedata/types";
import { MAIN_STATS_BY_SLOT, RELIC_SLOTS, SLOT_LABEL, SUB_STATS, SUBSTAT_MAX_ROLL } from "@/lib/relics/stats";
import { useApp } from "@/lib/store";
import { POOLS } from "@/lib/warp/rules";
import { GameImage } from "../GameImage";
import { Panel } from "../ui";

const H = ({ children }: { children: ReactNode }) => <h2 className="mb-2 mt-5 text-base font-semibold text-text first:mt-0">{children}</h2>;
const List = ({ items }: { items: ReactNode[] }) => <ul className="space-y-1.5 text-sm text-muted">{items.map((x, i) => <li key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" /><span>{x}</span></li>)}</ul>;
const Try = ({ href, children }: { href: string; children: ReactNode }) => <Link href={href} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan/15 px-3 py-2 text-sm text-cyan hover:bg-cyan/25">Try it: {children} →</Link>;
const pct = (x: number) => `${(x * 100).toFixed(1).replace(/\.0$/, "")}%`;

function StartHere() {
  return (
    <>
      <H>1. Download the game data</H>
      <List items={["Settings → Game data → Download. About 5 MB, once. It fills the Characters, Light Cones, Relic Sets and the rest."]} />
      <H>2. Tell the app what you own</H>
      <List items={[
        <>Fastest: scan your game with HSR Scanner and import the file in the <Link className="text-cyan" href="/import">Import Center</Link>.</>,
        <>Already use Fribbels&apos; optimizer? Import its save file there too.</>,
        <>Or mark characters as owned one by one in <Link className="text-cyan" href="/characters">Characters</Link>.</>,
      ]} />
      <H>3. Enter your pity</H>
      <List items={[<>Open the Warp Tracker (Star Rail Station), read your pity, and type it into <Link className="text-cyan" href="/warp">Warp Planner → My pity</Link>.</>]} />
      <H>4. Ask Silver Wolf</H>
      <List items={["Tap her button in the bottom-right corner and ask “what should I do today?”, “rate my builds” or “should I pull?”."]} />
      <Try href="/settings#game-data">download game data</Try>
    </>
  );
}

function Warps() {
  const c = POOLS.character, l = POOLS.lightcone;
  return (
    <>
      <H>The basics</H>
      <List items={[
        <>Every 10 pulls guarantees at least one 4★.</>,
        <>Character Event Warp: {pct(c.five.base)} base 5★ rate, guaranteed by pull <b className="text-text">{c.five.hard}</b>. Odds climb from about pull {c.five.softStart} (“soft pity”).</>,
        <>Light Cone Event Warp: {pct(l.five.base)} base, guaranteed by pull <b className="text-text">{l.five.hard}</b>, climbing from about pull {l.five.softStart}.</>,
        <>Pity carries over to the next banner of the same type.</>,
      ]} />
      <H>50/50 and the guarantee</H>
      <List items={[
        <>Your 5★ on a character banner is the featured character {pct(c.fiveFeaturedChance ?? 0)} of the time (Light Cones: {pct(l.fiveFeaturedChance ?? 0)}).</>,
        <>Lose it, and your next 5★ on that banner type is guaranteed featured.</>,
        <>So the worst case for one featured character is {c.five.hard * 2} pulls.</>,
      ]} />
      <Try href="/warp?tab=planner">see your odds in the Warp Planner</Try>
    </>
  );
}

function Leveling() {
  return (
    <>
      <H>Four things make a character stronger</H>
      <List items={[
        <><b className="text-text">Level</b> up to 80. Every 10 levels from 20 you need to ascend with boss materials first.</>,
        <><b className="text-text">Traces</b>: abilities and stat nodes. Some unlock only at certain ascensions.</>,
        <><b className="text-text">Light Cone</b>: matching the character&apos;s Path activates its passive.</>,
        <><b className="text-text">Relics</b>: usually the biggest jump once levels are done.</>,
      ]} />
      <H>Eidolons</H>
      <List items={["Extra copies of a character unlock Eidolons (E1–E6). Nice to have, rarely needed."]} />
      <Try href="/materials">plan materials for a character</Try>
    </>
  );
}

function Daily() {
  return (
    <>
      <H>Every day</H>
      <List items={[
        "Finish Daily Training for its Stellar Jade.",
        <>Spend Trailblaze Power before it caps (300). It refills one point every six minutes.</>,
        "Assignments: collect and resend.",
      ]} />
      <H>Where to spend Trailblaze Power</H>
      <List items={["Early on: character and trace materials.", "Later: relics (Caverns of Corrosion) and ornaments (Simulated Universe)."]} />
      <Try href="/">see your reset timers on Home</Try>
    </>
  );
}

function Elements() {
  const game = useApp((s) => s.game);
  if (!game) return <p className="text-sm text-muted">Download game data to see the elements.</p>;
  return (
    <>
      <List items={["Enemies show weakness icons. Hitting a weakness drains their Toughness bar; emptying it Breaks them for extra damage and a delay.", "Each element's Break adds its own effect, described below."]} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {Object.values(game.elements).map((e) => (
          <div key={e.id} className="flex gap-3 rounded-lg border border-line p-3">
            <GameImage path={e.icon} alt={e.name} className="h-10 w-10 shrink-0 object-contain" rounded="rounded-none" />
            <div><div className="font-medium" style={{ color: e.color }}>{e.name}</div><div className="text-xs text-muted">{stripMarkup(e.desc)}</div></div>
          </div>
        ))}
      </div>
    </>
  );
}

function Paths() {
  const game = useApp((s) => s.game);
  if (!game) return <p className="text-sm text-muted">Download game data to see the Paths.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Object.values(game.paths).map((p) => (
        <div key={p.id} className="flex gap-3 rounded-lg border border-line p-3">
          <GameImage path={p.icon} alt={p.name} className="h-10 w-10 shrink-0 object-contain" rounded="rounded-none" />
          <div><div className="font-medium text-text">{p.name || PATH_DISPLAY[p.id]}</div><div className="text-xs text-muted">{stripMarkup(p.desc)}</div></div>
        </div>
      ))}
    </div>
  );
}

function Relics101() {
  return (
    <>
      <H>Six slots</H>
      <List items={[
        "Head, Hands, Body, Feet come from Caverns of Corrosion and form 4-piece sets.",
        "Planar Sphere and Link Rope are Planar Ornaments and form 2-piece sets.",
        "Head is always HP and Hands always ATK; the other slots roll a main stat.",
      ]} />
      <H>Possible main stats</H>
      <div className="grid gap-2 sm:grid-cols-2">
        {RELIC_SLOTS.map((s) => (
          <div key={s} className="rounded-lg border border-line p-2.5 text-sm"><div className="text-xs text-faint">{SLOT_LABEL[s]}</div><div className="mt-1 flex flex-wrap gap-1">{MAIN_STATS_BY_SLOT[s].map((m) => <span key={m} className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-muted">{m}</span>)}</div></div>
        ))}
      </div>
      <Try href="/characters">see each character&apos;s recommended build</Try>
    </>
  );
}

function Substats() {
  return (
    <>
      <List items={[
        "A 5★ relic has up to four substats. Each upgrade at +3, +6, +9, +12 and +15 adds a new substat or raises one.",
        "Good relics have the substats your character wants (the build page shows them in order) with several rolls in them.",
        "Silver Wolf grades every relic D to WTF from those rolls.",
      ]} />
      <H>Biggest possible single roll (5★)</H>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SUB_STATS.map((k) => <div key={k} className="rounded-lg border border-line p-2 text-center text-xs"><div className="text-muted">{k}</div><div className="font-mono text-text">{SUBSTAT_MAX_ROLL[5][k].toFixed(k === "SPD" ? 1 : 2)}{["HP", "ATK", "DEF", "SPD"].includes(k) ? "" : "%"}</div></div>)}
      </div>
      <Try href="/relics">rate your relics</Try>
    </>
  );
}

function Farming() {
  return (
    <List items={[
      "4-piece relic sets: Caverns of Corrosion. Each cavern drops two sets, so pick one with two sets you want.",
      "Planar Ornaments: Simulated Universe (Planar Fissure / Divergent Universe rewards).",
      "Self-Modeling Resin lets you craft a relic with the main stat you choose: save it for Body and Feet.",
      "Turn unwanted relics into Relic Remains (salvage) rather than leveling them.",
    ]} />
  );
}

function Saving() {
  return (
    <>
      <List items={[
        "160 Stellar Jade = 1 pull. The planner counts Jade, passes and Undying Starlight together.",
        "Check your pity and guarantee first: they change how many pulls you need a lot.",
        "Set a target (one copy, signature Light Cone…) and see the chance of getting it with what you have.",
      ]} />
      <Try href="/warp?tab=planner">open the Warp Planner</Try>
    </>
  );
}

function Importing() {
  return (
    <>
      <List items={[
        <><b className="text-text">HSR Scanner</b>: reads your characters, Light Cones and relics from the game screen. The most complete.</>,
        <><b className="text-text">Fribbels optimizer save</b>: if you already use Fribbels, bring its relics and characters over.</>,
        <><b className="text-text">Enka.Network</b>: your public showcase characters, from just your UID.</>,
        "Every import shows a preview first and can be undone.",
      ]} />
      <Try href="/import">open the Import Center</Try>
    </>
  );
}

const BODY: Record<string, () => ReactNode> = {
  "start-here": StartHere, warps: Warps, leveling: Leveling, daily: Daily, elements: Elements, paths: Paths,
  "relics-101": Relics101, substats: Substats, farming: Farming, saving: Saving, import: Importing,
};

export function GuideContent({ slug }: { slug: string }) {
  const Body = BODY[slug];
  return <Panel>{Body ? <Body /> : <p className="text-sm text-muted">Guide not found.</p>}</Panel>;
}
