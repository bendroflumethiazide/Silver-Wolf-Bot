"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "next/navigation";
import { Plus, Save, Trash2, X } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GameImage } from "@/components/GameImage";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, confirmAction, Empty, ErrorBox, Field, Loading, Modal, Notice, NumberInput, PageHeader, Panel, Tabs } from "@/components/ui";
import { noGameData, teamComment } from "@/lib/companion/comments";
import { fill, pick, SW } from "@/lib/companion/voice";
import { getDb, newId, nowIso } from "@/lib/db";
import { characterDisplayName, elementName, pathName } from "@/lib/gamedata/types";
import { useApp } from "@/lib/store";
import { playableCharacters } from "@/lib/summary";
import { analyzeTeam, investment, roleOfPath, suggestTeams, type TeamMemberInfo } from "@/lib/teams";
import type { EndgameRecord, Team } from "@/lib/types";

type Tab = "builder" | "saved" | "optimizer" | "endgame";
const MODES = ["General", "Memory of Chaos", "Pure Fiction", "Apocalyptic Shadow", "Anomaly Arbitration", "Simulated Universe", "Divergent Universe", "Boss"];
const ENDGAME: EndgameRecord["mode"][] = ["Memory of Chaos", "Pure Fiction", "Apocalyptic Shadow", "Anomaly Arbitration", "Other"];

function useInfo() {
  const { game } = useApp();
  return (id: string | null): TeamMemberInfo | null => {
    const c = id ? game?.characters[id] : null;
    return c ? { id: c.id, path: c.path, element: c.element, rarity: c.rarity } : null;
  };
}

function Slot({ id, onClear, onPick }: { id: string | null; onClear: () => void; onPick: () => void }) {
  const { game } = useApp();
  const c = id ? game?.characters[id] : null;
  return (
    <div className={`glass relative flex aspect-[3/4] flex-col overflow-hidden rarity-border ${c ? `rarity-${c.rarity}` : ""}`}>
      {c ? (
        <>
          <GameImage path={c.icon} alt={characterDisplayName(c)} className="w-full flex-1" rounded="rounded-t-[13px]" />
          <div className="p-2 text-center text-xs"><div className="truncate font-medium">{characterDisplayName(c)}</div><div className="text-muted">{pathName(c.path)} · {roleOfPath(c.path)}</div></div>
          <button onClick={onClear} className="absolute right-1 top-1 rounded bg-black/60 p-1 text-muted hover:text-bad" aria-label={`Remove ${characterDisplayName(c)}`}><X size={12} /></button>
        </>
      ) : (
        <button onClick={onPick} className="flex flex-1 flex-col items-center justify-center gap-1 text-muted hover:text-cyan"><Plus /> <span className="text-xs">Add</span></button>
      )}
    </div>
  );
}

function Picker({ onPick, onClose, ownedOnly, exclude }: { onPick: (id: string) => void; onClose: () => void; ownedOnly: boolean; exclude: string[] }) {
  const { game, profileId } = useApp();
  const owned = useLiveQuery(() => getDb().characters.where("profileId").equals(profileId).toArray(), [profileId]);
  const [q, setQ] = useState("");
  const ids = new Set((owned ?? []).map((o) => o.charId));
  const list = playableCharacters(game).filter((c) => (!ownedOnly || ids.has(c.id)) && !exclude.includes(c.id) && characterDisplayName(c).toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal open onClose={onClose} title="Choose character" wide>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search characters" className="mb-3 w-full" />
      {!list.length ? <Empty title={ownedOnly ? "No owned characters match" : "No matches"}>{ownedOnly && "Turn off “owned only” or mark characters as owned."}</Empty> : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
          {list.map((c) => (
            <li key={c.id}><button onClick={() => onPick(c.id)} className={`glass w-full overflow-hidden rarity-border rarity-${c.rarity} text-left hover:border-violet/50`}>
              <GameImage path={c.icon} alt={characterDisplayName(c)} className="aspect-square w-full" rounded="rounded-t-[13px]" />
              <div className="truncate p-1.5 text-[11px]">{characterDisplayName(c)}</div>
            </button></li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function Builder({ initial }: { initial?: Team }) {
  const { game, profileId } = useApp();
  const info = useInfo();
  const params = useSearchParams();
  const withId = params.get("with");
  const [members, setMembers] = useState<(string | null)[]>(() => initial?.members ?? (withId && game?.characters[withId] ? [withId, null, null, null] : [null, null, null, null]));
  const [name, setName] = useState(initial?.name ?? "");
  const [mode, setMode] = useState(initial?.mode ?? "General");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [picking, setPicking] = useState<number | null>(null);
  const [ownedOnly, setOwnedOnly] = useState(true);
  const [weak, setWeak] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const owned = useLiveQuery(() => getDb().characters.where("profileId").equals(profileId).toArray(), [profileId]);

  const a = analyzeTeam(members.map(info), weak);
  const free = (owned ?? []).filter((o) => !members.includes(o.charId));
  const alternatives = a.missing.filter((m) => m.startsWith("no ")).map((m) => {
    const role = m.includes("sustain") ? "sustain" : m.includes("support") ? "support" : "damage";
    return { role, options: free.filter((o) => game?.characters[o.charId] && roleOfPath(game.characters[o.charId].path) === role).slice(0, 5) };
  });
  const save = async () => {
    if (!name.trim()) return setErr("Name the team.");
    if (members.every((m) => !m)) return setErr("Add at least one character.");
    const t: Team = { id: initial?.id ?? newId("team"), profileId, name: name.trim(), members, mode, notes, createdAt: initial?.createdAt ?? nowIso(), updatedAt: nowIso() };
    await getDb().teams.put(t);
    setErr(null); setSaved(true);
  };
  if (!game) return null;
  return (
    <div className="space-y-5">
      <WolfComment comment={teamComment(members.map((m) => (m ? game.characters[m]?.path ?? null : null)), pathName)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {members.map((m, i) => <Slot key={i} id={m} onPick={() => setPicking(i)} onClear={() => setMembers(members.map((x, j) => (j === i ? null : x)))} />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Analysis">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <Badge tone="ok">sustain {a.roles.sustain}</Badge><Badge tone="violet">support {a.roles.support}</Badge><Badge tone="gold">damage {a.roles.damage}</Badge>
            {a.elements.map((e) => <Badge key={e} tone={a.weaknessHits.includes(e) ? "cyan" : "default"}>{elementName(e)}</Badge>)}
          </div>
          {a.missing.length ? <ul className="list-disc pl-4 text-sm text-warn">{a.missing.map((m) => <li key={m}>{m}</li>)}</ul> : <p className="text-sm text-ok">All roles covered.</p>}
          {a.notes.map((n) => <p key={n} className="mt-1 text-sm text-muted">{n}</p>)}
          <div className="mt-3">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-faint">Enemy weaknesses (optional)</div>
            <div className="flex flex-wrap gap-1.5">{Object.keys(game.elements).map((e) => (
              <button key={e} onClick={() => setWeak(weak.includes(e) ? weak.filter((x) => x !== e) : [...weak, e])} aria-pressed={weak.includes(e)} className={`rounded border px-2 py-0.5 text-xs ${weak.includes(e) ? "border-cyan/50 text-cyan" : "border-line text-muted"}`}>{elementName(e)}</button>
            ))}</div>
          </div>
          {alternatives.map((alt) => alt.options.length > 0 && (
            <div key={alt.role} className="mt-3 text-sm">
              <span className="text-muted">Owned {alt.role} options: </span>
              {alt.options.map((o) => <button key={o.charId} className="mr-2 text-cyan hover:underline" onClick={() => { const i = members.indexOf(null); if (i >= 0) setMembers(members.map((x, j) => (j === i ? o.charId : x))); }}>{characterDisplayName(game.characters[o.charId])}</button>)}
            </div>
          ))}
          <p className="mt-3 text-[11px] text-faint">Roles are inferred from Path; some characters play differently. Rotations are not shown: no verified rotation data is connected.</p>
        </Panel>
        <Panel title="Save">
          <div className="grid gap-3">
            <Field label="Team name"><input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} /></Field>
            <Field label="Game mode"><select value={mode} onChange={(e) => setMode(e.target.value)}>{MODES.map((m) => <option key={m}>{m}</option>)}</select></Field>
            <Field label="Notes"><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} /> Pick from owned characters only</label>
            {err && <ErrorBox>{err}</ErrorBox>}
            <Button variant="primary" onClick={save}><Save size={15} /> {saved ? "Saved" : "Save team"}</Button>
          </div>
        </Panel>
      </div>
      {picking !== null && <Picker ownedOnly={ownedOnly} exclude={members.filter((m): m is string => !!m)} onClose={() => setPicking(null)} onPick={(id) => { setMembers(members.map((x, j) => (j === picking ? id : x))); setPicking(null); setSaved(false); }} />}
    </div>
  );
}

function Saved({ onEdit }: { onEdit: (t: Team) => void }) {
  const { game, profileId } = useApp();
  const teams = useLiveQuery(() => getDb().teams.where("profileId").equals(profileId).reverse().sortBy("updatedAt"), [profileId]);
  const info = useInfo();
  const [cmp, setCmp] = useState<string[]>([]);
  if (!teams || !game) return <Loading />;
  if (!teams.length) return <Empty title="No saved teams">Build one in the Builder tab.</Empty>;
  const picked = teams.filter((t) => cmp.includes(t.id));
  return (
    <div className="space-y-4">
      <ul className="grid gap-3 md:grid-cols-2">
        {teams.map((t) => {
          const a = analyzeTeam(t.members.map(info));
          return (
            <li key={t.id} className="glass p-3">
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-medium">{t.name}</div><div className="text-xs text-muted">{t.mode}</div></div>
                <div className="flex gap-1">
                  <Button size="sm" variant={cmp.includes(t.id) ? "primary" : "ghost"} onClick={() => setCmp(cmp.includes(t.id) ? cmp.filter((x) => x !== t.id) : [...cmp.slice(-1), t.id])}>Compare</Button>
                  <Button size="sm" variant="ghost" onClick={() => onEdit(t)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={async () => { if (confirmAction(`Delete team "${t.name}"?`)) await getDb().teams.delete(t.id); }} aria-label="Delete team"><Trash2 size={13} /></Button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {t.members.map((m, i) => { const c = m ? game.characters[m] : null; return c ? <GameImage key={i} path={c.icon} alt={characterDisplayName(c)} className="aspect-square w-full" /> : <div key={i} className="aspect-square rounded-lg border border-dashed border-line" />; })}
              </div>
              <div className="mt-2 text-xs text-muted">{a.missing.length ? a.missing.join(" · ") : "All roles covered"}</div>
            </li>
          );
        })}
      </ul>
      {picked.length === 2 && (
        <Panel title="Comparison">
          <div className="grid gap-3 sm:grid-cols-2">
            {picked.map((t) => { const a = analyzeTeam(t.members.map(info)); return (
              <div key={t.id} className="text-sm">
                <div className="font-medium">{t.name}</div>
                <div className="text-muted">Sustain {a.roles.sustain} · Support {a.roles.support} · Damage {a.roles.damage}</div>
                <div className="text-muted">Elements: {a.elements.map(elementName).join(", ")}</div>
                <div className="text-muted">Shared members: {t.members.filter((m) => m && picked.find((p) => p.id !== t.id)?.members.includes(m)).map((m) => characterDisplayName(game.characters[m!])).join(", ") || "none"}</div>
              </div>
            ); })}
          </div>
        </Panel>
      )}
    </div>
  );
}

function Optimizer() {
  const { game, profileId } = useApp();
  const owned = useLiveQuery(() => getDb().characters.where("profileId").equals(profileId).toArray(), [profileId]);
  const [mode, setMode] = useState("Memory of Chaos");
  const count = mode === "Memory of Chaos" || mode === "Pure Fiction" || mode === "Apocalyptic Shadow" ? 2 : 1;
  const pool = useMemo(() => (owned ?? []).filter((o) => game?.characters[o.charId]).map((o) => {
    const c = game!.characters[o.charId];
    return { info: { id: c.id, path: c.path, element: c.element, rarity: c.rarity }, invest: investment(o, c.rarity) };
  }), [owned, game]);
  if (!game || !owned) return <Loading />;
  if (pool.length < 4) return <Empty title="Not enough characters">The optimizer needs at least four owned characters with recorded progress.</Empty>;
  const teams = suggestTeams(pool, count);
  return (
    <div className="space-y-4">
      <Notice>Rule-based: role coverage plus your recorded investment (level, skill levels, Eidolons, rarity). It does not predict damage. No validated combat simulator exists, so no damage numbers are given.</Notice>
      <Field label="Game mode" className="max-w-xs"><select value={mode} onChange={(e) => setMode(e.target.value)}>{MODES.map((m) => <option key={m}>{m}</option>)}</select></Field>
      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((t, i) => (
          <Panel key={i} title={count > 1 ? `Team ${i + 1} (${i === 0 ? "first half" : "second half"})` : "Suggested team"}>
            <div className="mb-2 grid grid-cols-4 gap-2">{t.members.map((m) => <GameImage key={m} path={game.characters[m]?.icon} alt={characterDisplayName(game.characters[m])} className="aspect-square w-full" />)}</div>
            <div className="mb-2 text-sm">{t.members.map((m) => characterDisplayName(game.characters[m])).join(" · ")}</div>
            <ul className="list-disc pl-4 text-xs text-muted">{t.reasons.map((r, j) => <li key={j}>{r}</li>)}</ul>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function Endgame() {
  const { game, profileId } = useApp();
  const records = useLiveQuery(() => getDb().endgame.where("profileId").equals(profileId).sortBy("date"), [profileId]);
  const [form, setForm] = useState<EndgameRecord | null>(null);
  const [mode, setMode] = useState<EndgameRecord["mode"]>("Memory of Chaos");
  if (!records) return <Loading />;
  const list = records.filter((r) => r.mode === mode);
  const best = list.reduce<EndgameRecord | null>((b, r) => ((r.score ?? r.stars ?? 0) > (b?.score ?? b?.stars ?? -1) ? r : b), null);
  const comment = best
    ? { mood: "smug" as const, line: fill(pick(SW.endgameBest, mode), { mode, score: best.score ?? `${best.stars}★` }), facts: [`${list.length} ${mode} run(s) logged manually.`] }
    : { mood: "bored" as const, line: pick(SW.endgameEmpty, mode), facts: ["No runs recorded for this mode."] };
  return (
    <div className="space-y-4">
      <WolfComment comment={comment} />
      <div className="flex flex-wrap items-center gap-2">
        <select value={mode} onChange={(e) => setMode(e.target.value as EndgameRecord["mode"])} aria-label="Mode">{ENDGAME.map((m) => <option key={m}>{m}</option>)}</select>
        <Button variant="primary" size="sm" onClick={() => setForm({ id: newId("run"), profileId, mode, season: "", date: new Date().toISOString().slice(0, 10), teams: [[], []] })}><Plus size={14} /> Log run</Button>
      </div>
      {list.length > 1 && (
        <Panel title="History">
          <div className="h-52"><ResponsiveContainer>
            <LineChart data={list.map((r) => ({ season: r.season || r.date, score: r.score ?? null, stars: r.stars ?? null }))}>
              <CartesianGrid stroke="rgba(167,139,250,.1)" />
              <XAxis dataKey="season" tick={{ fill: "#9b98b8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#9b98b8", fontSize: 10 }} width={40} />
              <Tooltip contentStyle={{ background: "#0b0a18", border: "1px solid rgba(167,139,250,.3)", borderRadius: 8 }} />
              <Line dataKey="score" stroke="#e9c46a" dot connectNulls /><Line dataKey="stars" stroke="#5ee6f0" dot connectNulls />
            </LineChart>
          </ResponsiveContainer></div>
        </Panel>
      )}
      {!list.length ? <Empty title="No runs">Automatic sync of endgame records is not available, so log your results here.</Empty> : (
        <ul className="space-y-2">
          {[...list].reverse().map((r) => (
            <li key={r.id} className="glass flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <span className="font-medium">{r.season || "—"}</span><span className="text-muted">{r.date}</span>
              {r.stars !== undefined && <Badge tone="gold">{r.stars}★</Badge>}{r.score !== undefined && <Badge tone="cyan">{r.score}</Badge>}{r.cycles !== undefined && <Badge>{r.cycles} cycles</Badge>}
              {best?.id === r.id && <Badge tone="ok">best</Badge>}
              <span className="min-w-0 flex-1 truncate text-xs text-muted">{r.teams.map((t) => t.map((id) => game?.characters[id] ? characterDisplayName(game.characters[id]) : id).join(", ")).filter(Boolean).join(" | ")}</span>
              <Button size="sm" variant="ghost" onClick={() => setForm(r)}>Edit</Button>
            </li>
          ))}
        </ul>
      )}
      {form && <EndgameForm initial={form} onClose={() => setForm(null)} />}
    </div>
  );
}

function EndgameForm({ initial, onClose }: { initial: EndgameRecord; onClose: () => void }) {
  const { profileId } = useApp();
  const teams = useLiveQuery(() => getDb().teams.where("profileId").equals(profileId).toArray(), [profileId]);
  const [r, setR] = useState(initial);
  const num = (v: number) => (Number.isFinite(v) ? v : undefined);
  return (
    <Modal open onClose={onClose} title={`${r.mode} run`}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Season / version"><input value={r.season} onChange={(e) => setR({ ...r, season: e.target.value })} placeholder="4.7 cycle 1" /></Field>
        <Field label="Date"><input type="date" value={r.date} onChange={(e) => setR({ ...r, date: e.target.value })} /></Field>
        <Field label="Stars"><NumberInput min={0} max={36} value={r.stars ?? 0} onChange={(v) => setR({ ...r, stars: num(v) })} /></Field>
        <Field label="Score"><NumberInput min={0} value={r.score ?? 0} onChange={(v) => setR({ ...r, score: num(v) })} /></Field>
        <Field label="Cycles"><NumberInput min={0} value={r.cycles ?? 0} onChange={(v) => setR({ ...r, cycles: num(v) })} /></Field>
        {[0, 1].map((i) => (
          <Field key={i} label={`Team ${i + 1} (saved team)`}><select value="" onChange={(e) => { const t = teams?.find((x) => x.id === e.target.value); if (t) { const tt = [...r.teams]; tt[i] = t.members.filter((m): m is string => !!m); setR({ ...r, teams: tt }); } }}>
            <option value="">{r.teams[i]?.length ? `${r.teams[i].length} members set` : "Choose…"}</option>{teams?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></Field>
        ))}
        <Field label="Notes" className="col-span-2"><textarea rows={2} value={r.notes ?? ""} onChange={(e) => setR({ ...r, notes: e.target.value })} /></Field>
      </div>
      <div className="mt-4 flex justify-between">
        <Button variant="danger" onClick={async () => { if (confirmAction("Delete this run?")) { await getDb().endgame.delete(r.id); onClose(); } }}>Delete</Button>
        <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={async () => { await getDb().endgame.put(r); onClose(); }}>Save</Button></div>
      </div>
    </Modal>
  );
}

function Inner() {
  const { game } = useApp();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("builder");
  const [editing, setEditing] = useState<Team | undefined>();
  if (!game) return (<><PageHeader title="Builds & Teams" /><WolfComment comment={noGameData()} /></>);
  return (
    <div>
      <PageHeader title="Builds & Teams" subtitle="Team builder, saved teams, an explainable account-wide optimizer, and endgame history." />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "builder", label: "Builder" }, { id: "saved", label: "Saved teams" }, { id: "optimizer", label: "Optimizer" }, { id: "endgame", label: "Endgame history" }]} />
      {tab === "builder" && <Builder key={editing?.id ?? params.get("with") ?? "new"} initial={editing} />}
      {tab === "saved" && <Saved onEdit={(t) => { setEditing(t); setTab("builder"); }} />}
      {tab === "optimizer" && <Optimizer />}
      {tab === "endgame" && <Endgame />}
      <p className="mt-6 text-xs text-faint">Community build recommendations (Prydwen and others) are not shown: their content is not licensed for reuse and their sites are not reachable from this environment. Your notes and scoring profiles are the source of build guidance.</p>
    </div>
  );
}

export default function TeamsPage() {
  return <Suspense fallback={<Loading />}><Inner /></Suspense>;
}
