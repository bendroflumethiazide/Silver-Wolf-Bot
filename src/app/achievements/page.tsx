"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Eye } from "lucide-react";
import { useMemo, useState } from "react";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, confirmAction, cx, Empty, PageHeader, Panel, Progress } from "@/components/ui";
import { achievementComment, noGameData } from "@/lib/companion/comments";
import { getDb, nowIso } from "@/lib/db";
import { stripMarkup } from "@/lib/gamedata/types";
import { useApp } from "@/lib/store";
import type { ProgressStatus } from "@/lib/types";

const STATUSES: { id: ProgressStatus; label: string }[] = [
  { id: "not-started", label: "Not started" }, { id: "in-progress", label: "In progress" }, { id: "completed", label: "Completed" },
];

export default function AchievementsPage() {
  const { game, profileId, settings } = useApp();
  const rows = useLiveQuery(() => getDb().achievements.where("profileId").equals(profileId).toArray(), [profileId]);
  const [q, setQ] = useState("");
  const [series, setSeries] = useState("");
  const [status, setStatus] = useState<"" | ProgressStatus>("");
  const [hiddenOnly, setHiddenOnly] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(100);
  const map = useMemo(() => new Map((rows ?? []).map((r) => [r.achievementId, r.status])), [rows]);

  const all = useMemo(() => (game ? Object.values(game.achievements) : []), [game]);
  const bySeries = useMemo(() => {
    const m = new Map<string, { total: number; done: number; sample: string }>();
    for (const a of all) {
      const s = m.get(a.series_id) ?? { total: 0, done: 0, sample: a.title };
      s.total++;
      if (map.get(a.id) === "completed") s.done++;
      m.set(a.series_id, s);
    }
    return [...m.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [all, map]);

  if (!game) return (<><PageHeader title="Achievements" /><WolfComment comment={noGameData()} /></>);
  const done = (rows ?? []).filter((r) => r.status === "completed").length;
  const needle = q.toLowerCase();
  const list = all
    .filter((a) => !series || a.series_id === series)
    .filter((a) => !hiddenOnly || a.hide)
    .filter((a) => !status || (map.get(a.id) ?? "not-started") === status)
    .filter((a) => !needle || (!(a.hide && settings.spoilerFree && !revealed.has(a.id)) && (a.title + " " + a.desc).toLowerCase().includes(needle)));

  const setOne = (id: string, s: ProgressStatus) => getDb().achievements.put({ key: `${profileId}:${id}`, profileId, achievementId: id, status: s, updatedAt: nowIso() });
  const bulk = async (s: ProgressStatus) => {
    if (!confirmAction(`Mark all ${list.length} listed achievements as "${s}"?`)) return;
    await getDb().achievements.bulkPut(list.map((a) => ({ key: `${profileId}:${a.id}`, profileId, achievementId: a.id, status: s, updatedAt: nowIso() })));
  };

  return (
    <div>
      <PageHeader title="Achievements" subtitle={`${all.length} achievements in game data v${game.version}. Progress is tracked manually: no connected source exposes per-achievement completion.`} />
      <WolfComment comment={achievementComment(done, all.length)} className="mb-5" />
      <Panel title="Series progress" className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bySeries.map(([id, s]) => (
            <button key={id} onClick={() => setSeries(series === id ? "" : id)} className={cx("rounded-lg border p-2.5 text-left", series === id ? "border-cyan/50" : "border-line hover:border-violet/40")} aria-pressed={series === id}>
              <div className="flex justify-between text-sm"><span>Series {id}</span><span className="font-mono text-xs text-muted">{s.done}/{s.total}</span></div>
              <div className="mb-1.5 truncate text-[11px] text-faint">e.g. “{s.sample}”</div>
              <Progress value={s.done} max={s.total} tone={s.done === s.total ? "gold" : "violet"} />
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-faint">Series names are not in the data source, so series are shown by number with an example title.</p>
      </Panel>
      <Panel className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search achievements" aria-label="Search achievements" className="min-w-0 flex-1 sm:max-w-xs" />
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status"><option value="">Any status</option>{STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hiddenOnly} onChange={(e) => setHiddenOnly(e.target.checked)} /> Hidden only</label>
          <div className="flex-1" />
          <Button size="sm" onClick={() => bulk("completed")} disabled={!list.length}>Mark listed complete</Button>
          <Button size="sm" variant="ghost" onClick={() => bulk("not-started")} disabled={!list.length}>Reset listed</Button>
        </div>
      </Panel>
      {!list.length ? <Empty title="No matches" /> : (
        <ul className="space-y-1.5">
          {list.slice(0, limit).map((a) => {
            const st = map.get(a.id) ?? "not-started";
            const masked = a.hide && settings.spoilerFree && !revealed.has(a.id);
            return (
              <li key={a.id} className={cx("glass flex flex-wrap items-center gap-3 px-3 py-2", st === "completed" && "border-gold/30")}>
                <input type="checkbox" checked={st === "completed"} onChange={(e) => setOne(a.id, e.target.checked ? "completed" : "not-started")} aria-label={`Completed: ${masked ? "hidden achievement" : a.title}`} />
                <div className="min-w-0 flex-1">
                  <div className={cx("text-sm", st === "completed" && "text-gold")}>{masked ? "Hidden achievement" : a.title} {a.hide && <Badge>hidden</Badge>}</div>
                  <div className="text-xs text-muted">{masked ? "Spoiler-free mode is on." : stripMarkup(a.desc || a.hide_desc)}</div>
                </div>
                {masked && <Button size="sm" variant="ghost" onClick={() => setRevealed(new Set(revealed).add(a.id))}><Eye size={13} /> Reveal</Button>}
                <select value={st} onChange={(e) => setOne(a.id, e.target.value as ProgressStatus)} aria-label="Status" className="py-1 text-xs">{STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > limit && <div className="mt-3 text-center"><Button onClick={() => setLimit(limit + 200)}>Show more ({list.length - limit} left)</Button></div>}
    </div>
  );
}
