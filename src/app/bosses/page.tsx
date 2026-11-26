"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Download, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Codex } from "@/components/Codex";
import { ElementIcon } from "@/components/enemies/ElementIcon";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, cx, ErrorBox, Notice, PageHeader, Panel, Tabs } from "@/components/ui";
import { kvGet, kvSet } from "@/lib/db";
import { downloadEnemyPack, ELEMENTS, type EnemyPack, type EnemyType } from "@/lib/wiki/enemies";
import { WIKI } from "@/lib/wiki/fandom";
import { ENEMY_PACK_KEY } from "@/lib/wiki/enemies";

const TYPES: (EnemyType | "All")[] = ["All", "Boss", "Echo of War", "Elite", "Normal"];
const TYPE_TONE: Record<EnemyType, "bad" | "gold" | "violet" | "default"> = { Boss: "bad", "Echo of War": "gold", Elite: "violet", Normal: "default", Other: "default" };
const TYPE_BG: Record<EnemyType, string> = { Boss: "from-rose-950/70 to-black/40", "Echo of War": "from-amber-900/50 to-black/40", Elite: "from-violet-950/70 to-black/40", Normal: "from-slate-800/50 to-black/40", Other: "from-slate-800/40 to-black/40" };

function EnemyGrid({ pack }: { pack: EnemyPack }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<EnemyType | "All">("All");
  const [weak, setWeak] = useState<string[]>([]);
  const list = useMemo(() => pack.enemies.filter((e) =>
    (type === "All" || e.type === type) &&
    weak.every((w) => e.weak.includes(w as never)) &&
    (!q || e.title.toLowerCase().includes(q.toLowerCase()))), [pack, q, type, weak]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 sm:max-w-xs"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search enemies" aria-label="Search enemies" className="w-full !pl-8" /></label>
        <div className="flex flex-wrap gap-1">{TYPES.map((t) => <button key={t} onClick={() => setType(t)} className={cx("rounded-full border px-2.5 py-1 text-xs", type === t ? "border-cyan bg-cyan/15 text-text" : "border-line text-muted hover:text-text")}>{t}</button>)}</div>
        <div className="flex gap-1" role="group" aria-label="Weak to">
          {ELEMENTS.map((el) => (
            <button key={el} onClick={() => setWeak((w) => (w.includes(el) ? w.filter((x) => x !== el) : [...w, el]))} aria-pressed={weak.includes(el)} aria-label={`Weak to ${el}`} title={`Weak to ${el}`}
              className={cx("rounded-lg border p-1", weak.includes(el) ? "border-cyan bg-cyan/15" : "border-line opacity-60 hover:opacity-100")}><ElementIcon name={el} size={20} /></button>
          ))}
        </div>
      </div>
      <div className="text-xs text-muted">{list.length} of {pack.enemies.length}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {list.map((e) => (
          <a key={e.title} href={e.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-line bg-white/[0.03] transition hover:border-cyan/50">
            <div className={cx("flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-gradient-to-br p-2", TYPE_BG[e.type])}>
              <div className="flex flex-wrap justify-center gap-1.5">{e.weak.length ? e.weak.map((w) => <ElementIcon key={w} name={w} size={28} />) : <span className="text-xs text-faint">weakness unknown</span>}</div>
              {e.type !== "Other" && <Badge tone={TYPE_TONE[e.type]}>{e.type}</Badge>}
            </div>
            <div className="flex items-start justify-between gap-1 p-2">
              <div className="line-clamp-2 text-xs font-medium leading-tight">{e.title}</div>
              <span className="text-[11px] text-faint transition group-hover:text-cyan">↗</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function BossesPage() {
  const pack = useLiveQuery(() => kvGet<EnemyPack | null>(ENEMY_PACK_KEY, null), []);
  const [tab, setTab] = useState<"enemies" | "notes">("enemies");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const get = async () => {
    setBusy(true); setErr(null);
    try { await kvSet(ENEMY_PACK_KEY, await downloadEnemyPack()); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const bosses = pack?.enemies.filter((e) => e.type === "Boss" || e.type === "Echo of War").length ?? 0;
  return (
    <div className="space-y-4">
      <PageHeader title="Enemies" subtitle="Bosses and enemies with their weaknesses. Tap one for its wiki page and picture."
        actions={pack ? <Button size="sm" variant="ghost" onClick={get} disabled={busy}><RefreshCw size={14} className={busy ? "animate-spin" : ""} /> Update</Button> : undefined} />
      <WolfComment comment={pack
        ? { mood: "smug", line: `${pack.enemies.length} enemies on file|${bosses} of them are bosses|Filter by weakness, plan ur team`, facts: [`Enemy pack from ${pack.source}, ${pack.fetchedAt.slice(0, 10)}.`] }
        : { mood: "neutral", line: "No enemy files yet|One tap and I'll pull them off the wiki", facts: [] }} />
      <Tabs<"enemies" | "notes"> value={tab} onChange={setTab} tabs={[{ id: "enemies", label: "Enemies" }, { id: "notes", label: "Your notes" }]} />
      {tab === "enemies" && (pack ? (
        <>
          <EnemyGrid pack={pack} />
          <p className="text-[11px] text-faint">Names and weaknesses from the <a className="underline" href="https://honkai-star-rail.fandom.com/wiki/Category:Enemies" target="_blank" rel="noreferrer">{WIKI.name}</a> ({WIKI.license}); game content © HoYoverse. Downloaded {pack.fetchedAt.slice(0, 10)}. Tap an enemy for its wiki page and picture.</p>
        </>
      ) : (
        <Panel>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="max-w-md text-sm text-muted">Download the enemy list from the Honkai: Star Rail Wiki: about 270 enemies with their type and weaknesses.</p>
            <Button variant="primary" onClick={get} disabled={busy}><Download size={15} /> {busy ? "Downloading…" : "Download enemies"}</Button>
            {err && <ErrorBox>{err}</ErrorBox>}
          </div>
          <Notice>The app asks the wiki&apos;s public API for its enemy category (names, type, weaknesses). Nothing about you is sent. Text is {WIKI.license}. Pictures stay on the wiki: it doesn&apos;t allow other sites to show its images, so tap an enemy to see it there.</Notice>
        </Panel>
      ))}
      {tab === "notes" && <Codex kinds={["boss", "enemy"]} />}
    </div>
  );
}
