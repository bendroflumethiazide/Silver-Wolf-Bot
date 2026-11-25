"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Paperclip, Plus, Star, Trash2, X } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, confirmAction, cx, Empty, ErrorBox, Field, Loading, PageHeader, Panel } from "@/components/ui";
import { journalComment } from "@/lib/companion/comments";
import { downloadText } from "@/lib/backup";
import { getDb, newId, nowIso } from "@/lib/db";
import { characterDisplayName } from "@/lib/gamedata/types";
import { renderMarkdown } from "@/lib/markdown";
import { useApp } from "@/lib/store";
import type { JournalNote } from "@/lib/types";

const LINK_TYPES: JournalNote["links"][number]["type"][] = ["character", "lightcone", "relicSet", "team", "event", "warp", "achievement", "zone"];
const MAX_ATTACHMENT = 2 * 1024 * 1024;

const blank = (): JournalNote => ({ id: newId("note"), title: "", body: "", tags: [], favorite: false, links: [], createdAt: nowIso(), updatedAt: nowIso() });

function Editor({ note, onDone }: { note: JournalNote; onDone: () => void }) {
  const { game } = useApp();
  const [n, setN] = useState(note);
  const [preview, setPreview] = useState(false);
  const [tag, setTag] = useState("");
  const [linkType, setLinkType] = useState<JournalNote["links"][number]["type"]>("character");
  const [linkId, setLinkId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const save = async () => {
    if (!n.title.trim() && !n.body.trim()) return setErr("Write a title or some text first.");
    await getDb().notes.put({ ...n, updatedAt: nowIso() });
    setErr(null); setSavedAt(new Date().toLocaleTimeString());
  };
  const options = linkType === "character" ? Object.values(game?.characters ?? {}).map((c) => ({ id: c.id, label: characterDisplayName(c) }))
    : linkType === "lightcone" ? Object.values(game?.lightCones ?? {}).map((l) => ({ id: l.id, label: l.name }))
    : linkType === "relicSet" ? Object.values(game?.relicSets ?? {}).map((s) => ({ id: s.id, label: s.name })) : null;
  const attach = async (f: File) => {
    if (f.size > MAX_ATTACHMENT) return setErr("Attachments are limited to 2 MB each (they are stored inside your local database and backups).");
    const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
    setN({ ...n, attachments: [...(n.attachments ?? []), { name: f.name, type: f.type, dataUrl }] });
  };
  return (
    <Panel title={note.title ? "Edit note" : "New note"} actions={<Button size="sm" variant="ghost" onClick={onDone} aria-label="Close editor"><X size={14} /></Button>}>
      <div className="grid gap-3">
        <Field label="Title"><input value={n.title} onChange={(e) => setN({ ...n, title: e.target.value })} /></Field>
        <div className="flex gap-2 text-xs"><button className={cx(!preview && "text-cyan")} onClick={() => setPreview(false)}>Write</button><button className={cx(preview && "text-cyan")} onClick={() => setPreview(true)}>Preview</button><span className="text-faint">Markdown: # heading, **bold**, *italic*, - list, - [x] task, [link](https://…)</span></div>
        {preview ? <div className="prose-sw min-h-[180px] rounded-lg border border-line p-3 text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(n.body) }} /> : (
          <textarea aria-label="Note text" rows={10} value={n.body} onChange={(e) => setN({ ...n, body: e.target.value })} className="font-mono text-[13px]" />
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {n.tags.map((t) => <Badge key={t} tone="violet">#{t} <button onClick={() => setN({ ...n, tags: n.tags.filter((x) => x !== t) })} aria-label={`Remove tag ${t}`}>×</button></Badge>)}
          <input value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && tag.trim()) { e.preventDefault(); setN({ ...n, tags: [...new Set([...n.tags, tag.trim().toLowerCase()])] }); setTag(""); } }} placeholder="add tag + Enter" aria-label="Add tag" className="w-36 py-1 text-xs" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={linkType} onChange={(e) => { setLinkType(e.target.value as typeof linkType); setLinkId(""); }} aria-label="Link type" className="py-1 text-xs">{LINK_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          {options ? <select value={linkId} onChange={(e) => setLinkId(e.target.value)} aria-label="Link target" className="max-w-[14rem] py-1 text-xs"><option value="">Choose…</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
            : <input value={linkId} onChange={(e) => setLinkId(e.target.value)} placeholder="label or id" aria-label="Link label" className="w-40 py-1 text-xs" />}
          <Button size="sm" disabled={!linkId} onClick={() => { const label = options?.find((o) => o.id === linkId)?.label ?? linkId; setN({ ...n, links: [...n.links.filter((l) => !(l.type === linkType && l.id === linkId)), { type: linkType, id: linkId, label }] }); setLinkId(""); }}>Link</Button>
          {n.links.map((l) => <Badge key={`${l.type}:${l.id}`} tone="cyan">{l.type}: {l.label} <button onClick={() => setN({ ...n, links: n.links.filter((x) => x !== l) })} aria-label={`Unlink ${l.label}`}>×</button></Badge>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Reminder" hint="Appears in notifications when due."><input type="datetime-local" value={n.remindAt ? new Date(new Date(n.remindAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} onChange={(e) => setN({ ...n, remindAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /></Field>
          <div className="flex flex-col gap-1 text-xs text-muted">
            <span className="font-mono uppercase tracking-wider">Attachments</span>
            <label className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 hover:border-violet/50"><Paperclip size={13} /> Add file (≤2 MB)<input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void attach(f); e.target.value = ""; }} /></label>
            <ul className="flex flex-wrap gap-2">{(n.attachments ?? []).map((a, i) => (
              <li key={i} className="flex items-center gap-1">
                {a.type.startsWith("image/") ? <img src={a.dataUrl} alt={a.name} className="h-10 w-10 rounded object-cover" /> : <a href={a.dataUrl} download={a.name} className="text-cyan">{a.name}</a>}
                <button onClick={() => setN({ ...n, attachments: n.attachments!.filter((_, j) => j !== i) })} aria-label={`Remove ${a.name}`}>×</button>
              </li>
            ))}</ul>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={n.favorite} onChange={(e) => setN({ ...n, favorite: e.target.checked })} /> Favourite</label>
        {err && <ErrorBox>{err}</ErrorBox>}
        <div className="flex items-center justify-between gap-2">
          <Button variant="danger" size="sm" onClick={async () => { if (confirmAction("Delete this note?")) { await getDb().notes.delete(n.id); onDone(); } }}><Trash2 size={13} /> Delete</Button>
          <div className="flex items-center gap-2">{savedAt && <span className="text-xs text-ok">saved {savedAt}</span>}<Button variant="primary" onClick={save}>Save</Button></div>
        </div>
      </div>
    </Panel>
  );
}

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const { game } = useApp();
  const notes = useLiveQuery(() => getDb().notes.orderBy("updatedAt").reverse().toArray(), []);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [editing, setEditing] = useState<JournalNote | null>(null);

  useEffect(() => {
    if (!notes) return;
    const id = params.get("note");
    const nw = params.get("new");
    if (id) { const n = notes.find((x) => x.id === id); if (n) setEditing(n); }
    else if (nw) {
      const [type, target] = nw.split(":");
      const n = blank();
      const label = type === "character" && game?.characters[target] ? characterDisplayName(game.characters[target]) : target;
      setEditing({ ...n, title: label ? `${label} notes` : "", links: target ? [{ type: type as JournalNote["links"][number]["type"], id: target, label }] : [] });
    }
    if (id || nw) router.replace("/journal", { scroll: false });
  }, [notes, params, router, game]);

  const tags = useMemo(() => [...new Set((notes ?? []).flatMap((n) => n.tags))].sort(), [notes]);
  if (!notes) return <Loading />;
  const needle = q.toLowerCase();
  const list = notes.filter((n) => (!favOnly || n.favorite) && (!tag || n.tags.includes(tag)) && (!needle || (n.title + " " + n.body + " " + n.links.map((l) => l.label).join(" ")).toLowerCase().includes(needle)));
  const exportAll = () => downloadText(`journal-${new Date().toISOString().slice(0, 10)}.md`, notes.map((n) => `# ${n.title || "Untitled"}\n\n${n.tags.map((t) => `#${t}`).join(" ")}\n\n${n.body}\n`).join("\n---\n\n"), "text/markdown");

  return (
    <div>
      <PageHeader title="Personal Journal" subtitle="Notes on characters, builds, teams, bosses, events and Warp plans. Stored locally and included in backups."
        actions={<><Button size="sm" onClick={exportAll} disabled={!notes.length}><Download size={14} /> Export .md</Button><Button size="sm" variant="primary" onClick={() => setEditing(blank())}><Plus size={14} /> New note</Button></>} />
      <WolfComment comment={journalComment(notes.length)} className="mb-5" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" aria-label="Search notes" className="min-w-0 flex-1" />
            <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag"><option value="">All tags</option>{tags.map((t) => <option key={t} value={t}>#{t}</option>)}</select>
            <Button size="sm" variant={favOnly ? "primary" : "ghost"} onClick={() => setFavOnly(!favOnly)} aria-pressed={favOnly}><Star size={14} /></Button>
          </div>
          {!list.length ? <Empty title={notes.length ? "No matches" : "No notes yet"} /> : (
            <ul className="space-y-2">
              {list.map((n) => (
                <li key={n.id}><button onClick={() => setEditing(n)} className={cx("glass w-full p-3 text-left hover:border-violet/50", editing?.id === n.id && "border-cyan/50")}>
                  <div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate font-medium">{n.title || "Untitled"}</span>{n.favorite && <Star size={13} className="fill-gold text-gold" />}{n.remindAt && <Badge tone="warn">reminder</Badge>}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{n.body}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">{n.tags.map((t) => <Badge key={t} tone="violet">#{t}</Badge>)}{n.links.slice(0, 3).map((l) => <Badge key={l.type + l.id} tone="cyan">{l.label}</Badge>)}</div>
                </button></li>
              ))}
            </ul>
          )}
        </div>
        <div>{editing ? <Editor key={editing.id} note={editing} onDone={() => setEditing(null)} /> : <Empty title="Select or create a note" />}</div>
      </div>
    </div>
  );
}

export default function JournalPage() {
  return <Suspense fallback={<Loading />}><Inner /></Suspense>;
}
