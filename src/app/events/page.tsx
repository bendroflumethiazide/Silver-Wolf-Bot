"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Countdown, useNow } from "@/components/Countdown";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, confirmAction, Empty, ErrorBox, Field, Modal, Notice, PageHeader, Panel } from "@/components/ui";
import { fill, pick, SW } from "@/lib/companion/voice";
import { getDb, newId, nowIso } from "@/lib/db";
import { formatDuration } from "@/lib/time";
import type { EventEntry, InfoStatus, ProgressStatus } from "@/lib/types";

const toLocal = (iso?: string) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

function EventForm({ initial, onClose }: { initial: EventEntry; onClose: () => void }) {
  const [e, setE] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!e.name.trim()) return setErr("Name is required.");
    if (!e.permanent && (!e.end || (e.start && Date.parse(e.end) <= Date.parse(e.start)))) return setErr("Limited events need an end after the start.");
    if (e.status === "official" && !e.sourceUrl) return setErr("Official entries need a source link.");
    await getDb().events.put(e);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={initial.name ? "Edit event" : "Add event"}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" className="col-span-2"><input value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} /></Field>
        <Field label="Version"><input value={e.version} onChange={(x) => setE({ ...e, version: x.target.value })} /></Field>
        <label className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={e.permanent} onChange={(x) => setE({ ...e, permanent: x.target.checked })} /> Permanent</label>
        <Field label="Start"><input type="datetime-local" value={toLocal(e.start)} onChange={(x) => setE({ ...e, start: x.target.value ? new Date(x.target.value).toISOString() : undefined })} /></Field>
        <Field label="End"><input type="datetime-local" value={toLocal(e.end)} disabled={e.permanent} onChange={(x) => setE({ ...e, end: x.target.value ? new Date(x.target.value).toISOString() : undefined })} /></Field>
        <Field label="Rewards" className="col-span-2"><input value={e.rewards ?? ""} onChange={(x) => setE({ ...e, rewards: x.target.value })} /></Field>
        <Field label="Description / guide notes" className="col-span-2"><textarea rows={3} value={e.description ?? ""} onChange={(x) => setE({ ...e, description: x.target.value })} /></Field>
        <Field label="Status"><select value={e.status} onChange={(x) => setE({ ...e, status: x.target.value as InfoStatus })}><option value="official">Official</option><option value="speculation">Speculation</option><option value="leak">Leak</option></select></Field>
        <Field label="My completion"><select value={e.completion} onChange={(x) => setE({ ...e, completion: x.target.value as ProgressStatus })}><option value="not-started">Not started</option><option value="in-progress">In progress</option><option value="completed">Completed</option></select></Field>
        <Field label="Source URL" className="col-span-2"><input type="url" value={e.sourceUrl ?? ""} onChange={(x) => setE({ ...e, sourceUrl: x.target.value || undefined })} /></Field>
      </div>
      {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
      <div className="mt-4 flex justify-between">
        {initial.name ? <Button variant="danger" onClick={async () => { if (confirmAction("Delete event?")) { await getDb().events.delete(e.id); onClose(); } }}>Delete</Button> : <span />}
        <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></div>
      </div>
    </Modal>
  );
}

export default function EventsPage() {
  const events = useLiveQuery(() => getDb().events.toArray(), []);
  const now = useNow(30_000);
  const [editing, setEditing] = useState<EventEntry | null>(null);
  if (!events) return null;
  const current = events.filter((e) => !e.permanent && e.end && Date.parse(e.end) > now && (!e.start || Date.parse(e.start) <= now)).sort((a, b) => Date.parse(a.end!) - Date.parse(b.end!));
  const upcoming = events.filter((e) => !e.permanent && e.start && Date.parse(e.start) > now);
  const permanent = events.filter((e) => e.permanent);
  const archive = events.filter((e) => !e.permanent && e.end && Date.parse(e.end) <= now).sort((a, b) => Date.parse(b.end!) - Date.parse(a.end!));
  const urgent = current.find((e) => e.completion !== "completed");
  const comment = urgent
    ? { mood: "alert" as const, line: fill(pick(SW.eventsExpiring, urgent.id), { name: urgent.name, left: formatDuration(Date.parse(urgent.end!) - now) }), facts: [`${current.length} active event(s) tracked; ${current.filter((e) => e.completion !== "completed").length} unfinished.`] }
    : { mood: "bored" as const, line: pick(SW.eventsNone, "ev"), facts: [`${events.length} event(s) tracked.`] };
  const blank = (): EventEntry => ({ id: newId("event"), name: "", version: "", permanent: false, status: "official", completion: "not-started", createdAt: nowIso() });
  const section = (title: string, list: EventEntry[], mode: "current" | "upcoming" | "permanent" | "archive") => list.length > 0 && (
    <Panel title={`${title} (${list.length})`}>
      <ul className="space-y-2">
        {list.map((e) => (
          <li key={e.id}><button onClick={() => setEditing(e)} className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-violet/50">
            <span className="min-w-0 flex-1 truncate font-medium">{e.name} <span className="text-xs text-muted">v{e.version}</span></span>
            {e.status !== "official" && <Badge tone="warn">{e.status}</Badge>}
            <Badge tone={e.completion === "completed" ? "gold" : e.completion === "in-progress" ? "cyan" : "default"}>{e.completion}</Badge>
            <span className="text-xs text-muted">{mode === "current" ? <Countdown to={Date.parse(e.end!)} prefix="ends in " /> : mode === "upcoming" ? <Countdown to={Date.parse(e.start!)} prefix="starts in " /> : mode === "archive" ? `ended ${new Date(e.end!).toLocaleDateString()}${e.completion !== "completed" ? " · missed" : ""}` : "permanent"}</span>
          </button></li>
        ))}
      </ul>
    </Panel>
  );
  return (
    <div className="space-y-5">
      <PageHeader title="Events" subtitle="Current, upcoming and permanent events, plus your historical archive. Expiry alerts appear in notifications 72 hours before the end." actions={<Button variant="primary" size="sm" onClick={() => setEditing(blank())}><Plus size={14} /> Add event</Button>} />
      <WolfComment comment={comment} />
      <Notice>Event schedules are not available from a licensed feed, so add events from the in-game Events page or official notices. Times are entered in your local time zone.</Notice>
      {!events.length && <Empty title="No events tracked" />}
      {section("Active", current, "current")}{section("Upcoming", upcoming, "upcoming")}{section("Permanent", permanent, "permanent")}{section("Archive", archive, "archive")}
      {editing && <EventForm key={editing.id} initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
