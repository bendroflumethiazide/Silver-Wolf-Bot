"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowDown, ArrowUp, ChevronRight, Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Countdown, useNow } from "@/components/Countdown";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, CardGrid, Empty, ImageCard, Loading, NumberInput, Panel, Progress, SectionTitle, Stat } from "@/components/ui";
import { GameImage } from "@/components/GameImage";
import { HubImage } from "@/components/HubImage";
import { navItem } from "@/lib/nav";
import { dashboardComment, latestUpdateComment } from "@/lib/companion/comments";
import { getDb, kvGet, nowIso } from "@/lib/db";
import type { DailyNote } from "@/lib/connectors/hoyolab";
import { useAccount, useProfile } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import type { AccountSummary } from "@/lib/summary";
import { nextDailyReset, nextWeeklyReset, trailblazePowerAt } from "@/lib/time";
import { pullsFromResources } from "@/lib/warp/planner";
import { POOLS } from "@/lib/warp/rules";
import { pityKnown } from "@/lib/warp/pity";
import { WarpTrackerButton } from "@/components/warp/Pity";

type WidgetId = "objectives" | "account" | "warp" | "resources" | "resets" | "timeline";
const WIDGETS: { id: WidgetId; title: string }[] = [
  { id: "objectives", title: "All objectives" },
  { id: "account", title: "Account statistics" },
  { id: "warp", title: "Warp status" },
  { id: "resources", title: "Resources" },
  { id: "resets", title: "Daily & weekly" },
  { id: "timeline", title: "Banners & events" },
];

function Objectives({ s }: { s: AccountSummary }) {
  if (!s.objectives.length) return <Empty title="All clear">Import your inventory or track events, and objectives derived from your data will appear here.</Empty>;
  return (
    <ul className="divide-y divide-line">
      {s.objectives.slice(0, 8).map((o) => (
        <li key={o.id}>
          <Link href={o.href} className="group flex items-center gap-3 py-2.5">
            <Badge tone={o.category === "event" || o.category === "banner" ? "warn" : o.category === "relic" ? "violet" : "cyan"}>{o.category}</Badge>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-text group-hover:text-cyan">{o.title}</div>
              <div className="truncate text-xs text-muted">{o.reason}</div>
            </div>
            <ChevronRight size={16} className="text-faint group-hover:text-cyan" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AccountStats({ s }: { s: AccountSummary }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Stat label="Characters" value={`${s.owned}/${s.totalPlayable || "—"}`} hint={s.totalPlayable ? `${((s.owned / s.totalPlayable) * 100).toFixed(0)}% collected` : "game data needed"} />
      <Stat label="5★ / 4★" value={<><span className="text-gold">{s.owned5}</span> / <span className="text-[var(--purple4)]">{s.owned4}</span></>} />
      <Stat label="Light Cones" value={s.lightConesOwned} hint={s.lightConesTotal ? `${s.lightConesTotal} in database` : undefined} />
      <Stat label="Achievements" value={`${s.achievementsDone}/${s.achievementsTotal || "—"}`} hint="manually tracked" />
      <Stat label="Map markers" value={`${s.markersDone}/${s.markersTotal}`} hint="manually tracked" />
      <Stat label="Character pity" value={pityKnown(s.pity.character) ? `${s.pity.character.pity}/90` : "—"} hint={s.pity.character.guaranteed ? "guaranteed" : "entered by you"} />
    </div>
  );
}

function WarpStatus({ s }: { s: AccountSummary }) {
  return (
    <div className="space-y-3">
      {(["character", "lightcone", "standard"] as const).map((k) => {
        const p = s.pity[k];
        const hard = POOLS[k].five.hard;
        return (
          <div key={k}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-muted">{POOLS[k].label}</span>
              <span className="flex items-center gap-2 font-mono text-xs">
                {pityKnown(p) ? <>{p.pity}/{hard}</> : <span className="text-faint">not entered</span>}
                {p.guaranteed && <Badge tone="gold">guaranteed</Badge>}
              </span>
            </div>
            <Progress value={p.pity} max={hard} tone={p.pity >= POOLS[k].five.softStart ? "gold" : "violet"} label={`${POOLS[k].label} pity`} />
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <WarpTrackerButton size="sm" />
        <Link href="/warp" className="text-xs text-cyan hover:underline">Update pity / plan pulls →</Link>
      </div>
    </div>
  );
}

function Resources() {
  const profile = useProfile();
  const now = useNow(30_000);
  if (!profile) return <Loading />;
  const r = profile.resources ?? {};
  const set = (patch: Partial<NonNullable<typeof profile.resources>>, tbRecorded = false) =>
    getDb().profiles.update(profile.id, { resources: { ...r, ...patch, ...(tbRecorded ? { trailblazePowerRecordedAt: Date.now() } : {}) }, updatedAt: nowIso() });
  const tbRecordedAt = r.trailblazePowerRecordedAt;
  const pulls = pullsFromResources(r.stellarJade ?? 0, r.specialPasses ?? 0, r.undyingStarlight ?? 0);
  const tbNow = r.trailblazePower !== undefined && tbRecordedAt ? trailblazePowerAt(r.trailblazePower, tbRecordedAt, 300, now) : r.trailblazePower;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Entered by you (not synced). Used by the Warp planner and Silver Wolf.</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">Stellar Jade<NumberInput min={0} value={r.stellarJade ?? 0} onChange={(v) => set({ stellarJade: v })} aria-label="Stellar Jade" /></label>
        <label className="text-xs text-muted">Special Passes<NumberInput min={0} value={r.specialPasses ?? 0} onChange={(v) => set({ specialPasses: v })} aria-label="Star Rail Special Passes" /></label>
        <label className="text-xs text-muted">Star Rail Passes<NumberInput min={0} value={r.starRailPasses ?? 0} onChange={(v) => set({ starRailPasses: v })} aria-label="Star Rail Passes" /></label>
        <label className="text-xs text-muted">Undying Starlight<NumberInput min={0} value={r.undyingStarlight ?? 0} onChange={(v) => set({ undyingStarlight: v })} aria-label="Undying Starlight" /></label>
        <label className="col-span-2 text-xs text-muted">Trailblaze Power (now)<NumberInput min={0} max={2400} value={r.trailblazePower ?? 0} onChange={(v) => set({ trailblazePower: v }, true)} aria-label="Trailblaze Power" /></label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Event pulls" value={pulls} tone="gold" hint="Jade + Special Passes + Starlight" />
        <Stat label="TB Power est." value={tbNow ?? "—"} hint="+1 per 6 min, cap 300" tone="cyan" />
      </div>
    </div>
  );
}

function Resets() {
  const server = useApp((s) => s.settings.server);
  const profileId = useApp((s) => s.profileId);
  const note = useLiveQuery(() => kvGet<DailyNote | null>(`dailyNote:${profileId}`, null), [profileId]);
  const now = useNow(60_000);
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat label="Daily reset" value={<Countdown to={nextDailyReset(server, now)} />} hint={`04:00 ${server} server`} />
      <Stat label="Weekly reset" value={<Countdown to={nextWeeklyReset(server, now)} />} hint="Monday 04:00" />
      {note ? (
        <>
          <Stat label="Daily Training" value={`${note.dailyTraining[0]}/${note.dailyTraining[1]}`} tone={note.dailyTraining[0] >= note.dailyTraining[1] ? "cyan" : undefined} hint="HoYoLAB (verified)" />
          <Stat label="SU weekly points" value={`${note.universeWeekly[0]}/${note.universeWeekly[1]}`} hint="HoYoLAB (verified)" />
          <Stat label="Echo of War" value={`${note.echoOfWar[0]}/${note.echoOfWar[1]}`} hint="weekly runs used" />
          <Stat label="Assignments" value={`${note.assignments[0]}/${note.assignments[1]}`} hint={`synced ${new Date(note.fetchedAt).toLocaleTimeString()}`} />
        </>
      ) : <div className="col-span-2 text-xs text-muted">Daily Training, Simulated Universe weekly points and Echo of War runs appear here after a HoYoLAB sync (My Account).</div>}
    </div>
  );
}

function Timeline() {
  const now = useNow(60_000);
  const banners = useLiveQuery(() => getDb().banners.toArray(), []);
  const events = useLiveQuery(() => getDb().events.toArray(), []);
  if (!banners || !events) return <Loading />;
  const items = [
    ...banners.map((b) => ({ id: b.id, label: `${b.featured5.join(", ") || "Banner"} (${b.pool === "character" ? "Character" : "Light Cone"})`, start: Date.parse(b.start), end: Date.parse(b.end), status: b.status, href: "/warp?tab=banners" })),
    ...events.filter((e) => !e.permanent && e.end).map((e) => ({ id: e.id, label: e.name, start: e.start ? Date.parse(e.start) : 0, end: Date.parse(e.end!), status: e.status, href: "/events" })),
  ].filter((x) => x.end > now).sort((a, b) => a.end - b.end).slice(0, 6);
  if (!items.length) return <Empty title="Nothing tracked">Add banners and events from official notices in the Warp Planner and Events pages.</Empty>;
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.id}><Link href={i.href} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:border-violet/50">
          <span className="min-w-0 truncate">{i.label}</span>
          <span className="flex shrink-0 items-center gap-2 text-xs">
            {i.status !== "official" && <Badge tone="warn">{i.status}</Badge>}
            {i.start > now ? <Countdown to={i.start} prefix="starts " /> : <Countdown to={i.end} prefix="ends " />}
          </span>
        </Link></li>
      ))}
    </ul>
  );
}

function NextSteps({ s }: { s: AccountSummary }) {
  const top = s.objectives.slice(0, 3);
  if (!top.length) return null;
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      {top.map((o, i) => (
        <Link key={o.id} href={o.href} className="group flex items-center gap-3 rounded-lg border border-line bg-black/30 p-3 transition hover:border-cyan/50">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan/15 font-mono text-xs text-cyan">{i + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-text group-hover:text-cyan">{o.title}</span>
            <span className="block truncate text-xs text-muted">{o.reason}</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-faint group-hover:text-cyan" />
        </Link>
      ))}
    </div>
  );
}

const HUB: { title: string; ids: string[] }[] = [
  { title: "Database", ids: ["characters", "light-cones", "relics", "bosses", "banners", "codes"] },
  { title: "Endgame", ids: ["endgame", "universe", "currency-wars"] },
  { title: "Tools", ids: ["warp", "teams", "materials", "import", "map", "wolf"] },
  { title: "Guides", ids: ["guides", "modes", "events"] },
];

export default function Home() {
  const { game, settings, updateSettings } = useApp();
  const { summary } = useAccount();
  const profile = useProfile();
  const [customize, setCustomize] = useState(false);
  const order = [...settings.dashboardOrder.filter((id) => WIDGETS.some((w) => w.id === id)), ...WIDGETS.map((w) => w.id).filter((id) => !settings.dashboardOrder.includes(id))] as WidgetId[];
  const move = (id: WidgetId, d: -1 | 1) => {
    const o = [...order];
    const i = o.indexOf(id);
    const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    void updateSettings({ dashboardOrder: o });
  };
  const toggle = (id: WidgetId) => updateSettings({ dashboardHidden: settings.dashboardHidden.includes(id) ? settings.dashboardHidden.filter((x) => x !== id) : [...settings.dashboardHidden, id] });

  const render = (id: WidgetId): ReactNode => {
    if (id === "resources") return <Resources />;
    if (id === "resets") return <Resets />;
    if (id === "timeline") return <Timeline />;
    if (!summary) return <Loading />;
    if (id === "objectives") return <Objectives s={summary} />;
    if (id === "account") return <AccountStats s={summary} />;
    return <WarpStatus s={summary} />;
  };
  const portrait = game?.characters["1006"]?.portrait;

  return (
    <div className="space-y-8">
      <section className="glass hud relative overflow-hidden p-5 sm:p-7">
        {portrait && <div className="pointer-events-none absolute -right-16 -top-10 hidden h-[130%] w-[46%] opacity-40 [mask-image:linear-gradient(to_left,black,transparent)] md:block"><GameImage path={portrait} alt="" className="h-full w-full object-cover object-top" rounded="rounded-none" /></div>}
        <div className="relative max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-gradient sm:text-3xl">Welcome back, {profile?.name ?? "Trailblazer"}</h1>
          <p className="mt-1 text-sm text-muted">{game ? <>Game data v{game.version} · everything stays on this device</> : "Start by downloading the game data (about 5 MB)."}</p>
          <WolfComment comment={latestUpdateComment()} className="mt-4 !border-0 !bg-transparent !p-0" />
          <WolfComment comment={dashboardComment(summary, !!game)} className="mt-3 !border-0 !bg-transparent !p-0" />
          <div className="mt-4 flex flex-wrap gap-2">
            {!game
              ? <Link href="/settings#game-data" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white">Download game data</Link>
              : <Link href="/terminal" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white">Ask Silver Wolf what to do</Link>}
            <Link href="/guides" className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-text">New here? Guides</Link>
          </div>
        </div>
        {summary && <div className="relative mt-5"><NextSteps s={summary} /></div>}
      </section>

      {HUB.map((g) => (
        <section key={g.title}>
          <SectionTitle>{g.title}</SectionTitle>
          <CardGrid>
            {g.ids.map((id) => { const n = navItem(id); return <ImageCard key={id} href={n.href} title={n.label} sub={n.blurb} image={<HubImage id={id} />} />; })}
          </CardGrid>
        </section>
      ))}

      <section>
        <SectionTitle action={<Button size="sm" variant="ghost" onClick={() => setCustomize((v) => !v)}><SlidersHorizontal size={14} /> {customize ? "Done" : "Customize"}</Button>}>Your account</SectionTitle>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {order.filter((id) => customize || !settings.dashboardHidden.includes(id)).map((id) => {
            const w = WIDGETS.find((x) => x.id === id)!;
            const hidden = settings.dashboardHidden.includes(id);
            return (
              <Panel key={id} title={w.title} className={`${id === "objectives" ? "lg:col-span-2" : ""} ${hidden ? "opacity-40" : ""}`}
                actions={customize && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => move(id, -1)} aria-label={`Move ${w.title} up`}><ArrowUp size={14} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => move(id, 1)} aria-label={`Move ${w.title} down`}><ArrowDown size={14} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => toggle(id)} aria-label={hidden ? `Show ${w.title}` : `Hide ${w.title}`}>{hidden ? <EyeOff size={14} /> : <Eye size={14} />}</Button>
                  </>
                )}>
                {render(id)}
              </Panel>
            );
          })}
        </div>
      </section>
    </div>
  );
}
