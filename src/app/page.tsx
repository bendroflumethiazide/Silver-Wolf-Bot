"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowDown, ArrowUp, ChevronRight, Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Countdown, useNow } from "@/components/Countdown";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, Empty, Loading, NumberInput, PageHeader, Panel, Progress, Stat } from "@/components/ui";
import { dashboardComment } from "@/lib/companion/comments";
import { getDb, nowIso } from "@/lib/db";
import { useAccount, useProfile } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import type { AccountSummary } from "@/lib/summary";
import { nextDailyReset, nextWeeklyReset, trailblazePowerAt } from "@/lib/time";
import { pullsFromResources } from "@/lib/warp/planner";
import { POOLS } from "@/lib/warp/rules";

type WidgetId = "objectives" | "account" | "warp" | "resources" | "resets" | "timeline";
const WIDGETS: { id: WidgetId; title: string }[] = [
  { id: "objectives", title: "Your Next Trailblazing Objectives" },
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
      <Stat label="Warps logged" value={s.pools.character.total + s.pools.lightcone.total + s.pools.standard.total} />
    </div>
  );
}

function WarpStatus({ s }: { s: AccountSummary }) {
  return (
    <div className="space-y-3">
      {(["character", "lightcone", "standard"] as const).map((k) => {
        const p = s.pools[k];
        const hard = POOLS[k].five.hard;
        return (
          <div key={k}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-muted">{POOLS[k].label}</span>
              <span className="flex items-center gap-2 font-mono text-xs">
                {p.total ? <>{p.pity5}/{hard}</> : <span className="text-faint">no data</span>}
                {p.guaranteed5 && <Badge tone="gold">guaranteed</Badge>}
              </span>
            </div>
            <Progress value={p.pity5} max={hard} tone={p.pity5 >= POOLS[k].five.softStart ? "gold" : "violet"} label={`${POOLS[k].label} pity`} />
          </div>
        );
      })}
      <Link href="/warp" className="inline-block text-xs text-cyan hover:underline">Open Warp Observatory →</Link>
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
  const now = useNow(60_000);
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat label="Daily reset" value={<Countdown to={nextDailyReset(server, now)} />} hint={`04:00 ${server} server`} />
      <Stat label="Weekly reset" value={<Countdown to={nextWeeklyReset(server, now)} />} hint="Monday 04:00" />
      <div className="col-span-2 text-xs text-muted">Daily Training and weekly objectives are not exposed by any connected source, so they are not tracked automatically. Use the Journal&apos;s reminders for routines.</div>
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
  if (!items.length) return <Empty title="Nothing tracked">Add banners and events from official notices in the Warp Observatory and Events pages.</Empty>;
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

  return (
    <div>
      <PageHeader
        title="Express Terminal"
        subtitle={<>Welcome back, {profile?.name ?? "Trailblazer"}{game ? <> · game data v{game.version}</> : null}.</>}
        actions={<Button size="sm" onClick={() => setCustomize((v) => !v)}><SlidersHorizontal size={14} /> {customize ? "Done" : "Customize"}</Button>}
      />
      <WolfComment comment={dashboardComment(summary, !!game)} className="mb-5" />
      <div className="grid gap-5 lg:grid-cols-2">
        {order.filter((id) => customize || !settings.dashboardHidden.includes(id)).map((id) => {
          const w = WIDGETS.find((x) => x.id === id)!;
          const hidden = settings.dashboardHidden.includes(id);
          return (
            <Panel key={id} title={w.title} hud={id === "objectives"} className={`${id === "objectives" ? "lg:col-span-2" : ""} ${hidden ? "opacity-40" : ""}`}
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
    </div>
  );
}
