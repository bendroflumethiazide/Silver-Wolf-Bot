"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Eye, Plus } from "lucide-react";
import { useState } from "react";
import { getDb, newId, nowIso } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { useApp } from "@/lib/store";
import type { CodexEntry, CodexKind, ProgressStatus } from "@/lib/types";
import { Badge, Button, confirmAction, Empty, ErrorBox, Field, Loading, Modal } from "./ui";

export const CODEX_FIELDS: Record<CodexKind, string[]> = {
  boss: ["Location", "Region", "Weaknesses", "Resistances", "Mechanics", "Phases", "Drops", "Recommended teams", "Related achievements", "Related missions"],
  enemy: ["Type", "Weaknesses", "Resistances", "Abilities", "Locations", "Drops", "Combat advice"],
  npc: ["Location", "Affiliation", "Related quests", "Dialogue references", "Lore connections", "Associated achievements"],
  lore: ["Category", "Connections"],
  mission: ["Type", "Region", "Prerequisites", "Characters involved", "Rewards", "Related achievements", "Puzzle solutions", "Availability"],
  mode: ["Requirements", "Difficulty", "Mechanics", "Rewards", "Reset schedule", "Current rotation", "Recommended teams", "Personal best"],
};
export const KIND_LABEL: Record<CodexKind, string> = { boss: "Boss", enemy: "Enemy", npc: "NPC", lore: "Lore", mission: "Mission", mode: "Game mode" };
const STATUS_TONE = { official: "ok", speculation: "warn", leak: "bad", "fan-theory": "violet" } as const;
const STATUS_LABEL = { official: "Confirmed in game / official", speculation: "Community speculation", leak: "Unverified leak", "fan-theory": "Fan theory" } as const;
const PROGRESS: ProgressStatus[] = ["not-started", "in-progress", "completed"];

function EntryForm({ initial, kinds, onClose }: { initial: CodexEntry; kinds: CodexKind[]; onClose: () => void }) {
  const [e, setE] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!e.name.trim()) return setErr("Name is required.");
    if (e.status === "official" && !e.sourceUrl) return setErr("Confirmed entries need a source link (official notice, in-game screenshot location, wiki page).");
    if (e.sourceUrl && !/^https?:\/\//.test(e.sourceUrl)) return setErr("Source must be an http(s) link.");
    await getDb().codex.put({ ...e, name: e.name.trim(), updatedAt: nowIso() });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={initial.name ? `Edit ${initial.name}` : `New ${KIND_LABEL[e.kind]}`} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} /></Field>
        {kinds.length > 1 && <Field label="Type"><select value={e.kind} onChange={(x) => setE({ ...e, kind: x.target.value as CodexKind })}>{kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></Field>}
        {CODEX_FIELDS[e.kind].map((f) => <Field key={f} label={f}><input value={e.fields[f] ?? ""} onChange={(x) => setE({ ...e, fields: { ...e.fields, [f]: x.target.value } })} /></Field>)}
        <Field label="Notes / strategy / summary (Markdown)" className="sm:col-span-2"><textarea rows={5} value={e.body} onChange={(x) => setE({ ...e, body: x.target.value })} /></Field>
        <Field label="Information status"><select value={e.status} onChange={(x) => setE({ ...e, status: x.target.value as CodexEntry["status"] })}>{(Object.keys(STATUS_LABEL) as CodexEntry["status"][]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></Field>
        <Field label="Source URL"><input type="url" value={e.sourceUrl ?? ""} onChange={(x) => setE({ ...e, sourceUrl: x.target.value || undefined })} /></Field>
        <Field label="Game version"><input value={e.version ?? ""} onChange={(x) => setE({ ...e, version: x.target.value || undefined })} placeholder="e.g. 2.0" /></Field>
        {(e.kind === "mission" || e.kind === "mode" || e.kind === "boss") && <Field label="My progress"><select value={e.progress ?? "not-started"} onChange={(x) => setE({ ...e, progress: x.target.value as ProgressStatus })}>{PROGRESS.map((p) => <option key={p}>{p}</option>)}</select></Field>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!e.spoiler} onChange={(x) => setE({ ...e, spoiler: x.target.checked })} /> Contains story spoilers</label>
      </div>
      {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
      <div className="mt-4 flex justify-between">
        {initial.name ? <Button variant="danger" onClick={async () => { if (confirmAction("Delete this entry?")) { await getDb().codex.delete(e.id); onClose(); } }}>Delete</Button> : <span />}
        <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></div>
      </div>
    </Modal>
  );
}

export function Codex({ kinds }: { kinds: CodexKind[] }) {
  const spoilerFree = useApp((s) => s.settings.spoilerFree);
  const entries = useLiveQuery(() => getDb().codex.where("kind").anyOf(kinds).toArray(), [kinds.join()]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"" | CodexKind>("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<CodexEntry | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  if (!entries) return <Loading />;
  const list = entries
    .filter((e) => !kind || e.kind === kind)
    .filter((e) => !status || e.status === status || e.progress === status)
    .filter((e) => !q || (e.name + " " + Object.values(e.fields).join(" ") + " " + e.body).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const blank = (): CodexEntry => ({ id: newId("codex"), kind: kind || kinds[0], name: "", fields: {}, body: "", status: "official", createdAt: nowIso(), updatedAt: nowIso() });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entries" aria-label="Search entries" className="min-w-0 flex-1 sm:max-w-xs" />
        {kinds.length > 1 && <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Type"><option value="">All types</option>{kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>}
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Any status</option>{Object.keys(STATUS_LABEL).map((s) => <option key={s}>{s}</option>)}{PROGRESS.map((p) => <option key={p}>{p}</option>)}</select>
        <div className="flex-1" />
        <Button variant="primary" size="sm" onClick={() => setEditing(blank())}><Plus size={14} /> Add entry</Button>
      </div>
      {!list.length ? <Empty title={entries.length ? "No matches" : "Empty codex"}>Record what you learn from in-game text, official notices or guides, with a source link. Every entry shows whether it is confirmed, speculation or a fan theory.</Empty> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((e) => {
            const hidden = e.spoiler && spoilerFree && !revealed.has(e.id);
            return (
              <li key={e.id} className="glass p-3">
                <div className="flex items-start justify-between gap-2">
                  <button className="min-w-0 text-left" onClick={() => setEditing(e)}>
                    <div className="truncate font-medium hover:text-cyan">{e.name}</div>
                    <div className="text-xs text-muted">{KIND_LABEL[e.kind]}{e.version && ` · v${e.version}`}{e.fields.Type && ` · ${e.fields.Type}`}</div>
                  </button>
                  <div className="flex flex-col items-end gap-1"><Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>{e.progress && <Badge tone={e.progress === "completed" ? "gold" : "default"}>{e.progress}</Badge>}</div>
                </div>
                {hidden ? (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted">Spoiler hidden. <Button size="sm" variant="ghost" onClick={() => setRevealed(new Set(revealed).add(e.id))}><Eye size={13} /> Reveal</Button></div>
                ) : (
                  <>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                      {Object.entries(e.fields).filter(([, v]) => v).slice(0, 6).map(([k, v]) => <div key={k} className="contents"><dt className="text-faint">{k}</dt><dd className="truncate text-muted">{v}</dd></div>)}
                    </dl>
                    {e.body && <div className="prose-sw mt-2 line-clamp-4 text-xs text-muted" dangerouslySetInnerHTML={{ __html: renderMarkdown(e.body) }} />}
                  </>
                )}
                {e.sourceUrl && <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11px] text-cyan hover:underline">source ↗</a>}
              </li>
            );
          })}
        </ul>
      )}
      {editing && <EntryForm key={editing.id} initial={editing} kinds={kinds} onClose={() => setEditing(null)} />}
    </div>
  );
}
