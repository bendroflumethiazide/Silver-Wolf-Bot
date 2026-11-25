"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { GameImage } from "@/components/GameImage";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, cx, Empty, Notice, PageHeader, Progress, Tabs } from "@/components/ui";
import { noGameData } from "@/lib/companion/comments";
import { fill, pick, SW } from "@/lib/companion/voice";
import { kvGet, kvSet } from "@/lib/db";
import { stripMarkup } from "@/lib/gamedata/types";
import { useApp } from "@/lib/store";

type Tab = "blessings" | "curios" | "events";

export default function UniversePage() {
  const { game, profileId } = useApp();
  const [tab, setTab] = useState<Tab>("blessings");
  const [q, setQ] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [limit, setLimit] = useState(120);
  const key = `suCollected:${profileId}`;
  const collected = useLiveQuery(() => kvGet<string[]>(key, []), [key]);
  const set = useMemo(() => new Set(collected ?? []), [collected]);
  if (!game) return (<><PageHeader title="Simulated Universe" /><WolfComment comment={noGameData()} /></>);
  const toggle = (id: string) => { const s = new Set(set); if (s.has(id)) s.delete(id); else s.add(id); void kvSet(key, [...s]); };

  const needle = q.toLowerCase();
  const blessings = Object.values(game.blessings).filter((b) => b.name && (!needle || (b.name + b.desc).toLowerCase().includes(needle)));
  const curios = Object.values(game.curios).filter((c) => c.name && (!needle || (c.name + c.desc).toLowerCase().includes(needle)));
  const events = Object.values(game.simEvents).filter((e) => e.name && (!needle || (e.name + e.type).toLowerCase().includes(needle)));
  const tracked = (prefix: string, ids: string[]) => ids.filter((id) => set.has(`${prefix}:${id}`)).length;
  const items = tab === "blessings" ? blessings.map((b) => ({ id: `b:${b.id}`, name: b.name, desc: b.desc, extra: b.enhanced_desc ? `Enhanced: ${b.enhanced_desc}` : "", icon: undefined as string | undefined }))
    : tab === "curios" ? curios.map((c) => ({ id: `c:${c.id}`, name: c.name, desc: c.desc, extra: c.bg_desc, icon: c.icon }))
    : events.map((e) => ({ id: `e:${e.id}`, name: e.name, desc: e.type, extra: "", icon: e.image }));
  const list = items.filter((i) => !onlyMissing || !set.has(i.id));
  const totals = { blessings: tracked("b", Object.keys(game.blessings)), curios: tracked("c", Object.keys(game.curios)) };

  return (
    <div>
      <PageHeader title="Simulated Universe" subtitle="Blessings, Curios and Occurrence images from game data, with your personal collection tracking." />
      <WolfComment comment={{ mood: "neutral", line: fill(pick(SW.universe, "su"), { curios: totals.curios, blessings: totals.blessings }), facts: [`${Object.keys(game.blessings).length} blessings, ${Object.keys(game.curios).length} curios, ${Object.keys(game.simEvents).length} occurrence entries in game data v${game.version}.`, "Collection status is tracked manually."] }} className="mb-5" />
      <Notice>Equations, Paths/Resonances by mode, domain types, difficulty modifiers and rewards are not in the downloaded data source, so they are not listed. Blessing entries cover all Universe variants and include duplicates across modes.</Notice>
      <div className="my-4 grid gap-3 sm:grid-cols-2">
        <div><div className="mb-1 flex justify-between text-xs text-muted"><span>Curios</span><span>{totals.curios}/{Object.keys(game.curios).length}</span></div><Progress value={totals.curios} max={Object.keys(game.curios).length} tone="gold" /></div>
        <div><div className="mb-1 flex justify-between text-xs text-muted"><span>Blessings</span><span>{totals.blessings}/{Object.keys(game.blessings).length}</span></div><Progress value={totals.blessings} max={Object.keys(game.blessings).length} tone="violet" /></div>
      </div>
      <Tabs<Tab> value={tab} onChange={(t) => { setTab(t); setLimit(120); }} tabs={[{ id: "blessings", label: `Blessings (${blessings.length})` }, { id: "curios", label: `Curios (${curios.length})` }, { id: "events", label: `Occurrences (${events.length})` }]} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search" className="w-full sm:w-72" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> Not yet collected</label>
      </div>
      {!list.length ? <Empty title="No matches" /> : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.slice(0, limit).map((i) => (
            <li key={i.id} className={cx("glass p-3", set.has(i.id) && "border-gold/40")}>
              <div className="flex gap-3">
                {i.icon && <GameImage path={i.icon} alt={i.name} className="h-12 w-12 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><span className="font-medium">{i.name}</span>
                    <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted"><input type="checkbox" checked={set.has(i.id)} onChange={() => toggle(i.id)} /> got it</label></div>
                  {tab === "events" ? <Badge tone="violet">{i.desc}</Badge> : <p className="mt-1 text-xs text-muted">{stripMarkup(i.desc)}</p>}
                  {i.extra && <p className="mt-1 text-[11px] italic text-faint">{stripMarkup(i.extra)}</p>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.length > limit && <div className="mt-3 text-center"><button className="text-sm text-cyan" onClick={() => setLimit(limit + 200)}>Show more ({list.length - limit})</button></div>}
    </div>
  );
}
