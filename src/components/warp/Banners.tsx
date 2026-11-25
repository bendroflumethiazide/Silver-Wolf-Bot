"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Countdown, useNow } from "@/components/Countdown";
import { Badge, Button, confirmAction, Empty, ErrorBox, Field, Modal, Notice, Panel } from "@/components/ui";
import { getDb, newId, nowIso } from "@/lib/db";
import type { BannerEntry, InfoStatus } from "@/lib/types";

const STATUS_TONE: Record<InfoStatus, "ok" | "warn" | "bad"> = { official: "ok", speculation: "warn", leak: "bad" };
const STATUS_LABEL: Record<InfoStatus, string> = { official: "Officially confirmed", speculation: "Community speculation", leak: "Unverified leak" };

const toLocalInput = (iso: string) => { const d = new Date(iso); return isNaN(+d) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

function BannerForm({ initial, onClose }: { initial: BannerEntry | null; onClose: () => void }) {
  const [b, setB] = useState<BannerEntry>(initial ?? { id: newId("banner"), pool: "character", version: "", featured5: [], featured4: [], start: "", end: "", status: "official", createdAt: nowIso() });
  const [f5, setF5] = useState(b.featured5.join(", "));
  const [f4, setF4] = useState(b.featured4.join(", "));
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    const start = Date.parse(b.start), end = Date.parse(b.end);
    if (!b.version.trim()) return setErr("Version is required (e.g. 4.7).");
    if (isNaN(start) || isNaN(end)) return setErr("Start and end are required.");
    if (end <= start) return setErr("End must be after start.");
    if (b.status === "official" && !b.sourceUrl?.trim()) return setErr("Official entries need a source link (e.g. the HoYoLAB notice), so they can be verified later.");
    const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
    await getDb().banners.put({ ...b, featured5: split(f5), featured4: split(f4), verifiedAt: b.status === "official" ? nowIso() : undefined });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={initial ? "Edit banner" : "Add banner"}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><select value={b.pool} onChange={(e) => setB({ ...b, pool: e.target.value as BannerEntry["pool"] })}><option value="character">Character Event Warp</option><option value="lightcone">Light Cone Event Warp</option></select></Field>
        <Field label="Version / phase"><input value={b.version} onChange={(e) => setB({ ...b, version: e.target.value })} placeholder="4.7 phase 1" /></Field>
        <Field label="Featured 5★ (comma separated)" className="col-span-2"><input value={f5} onChange={(e) => setF5(e.target.value)} /></Field>
        <Field label="Featured 4★ (comma separated)" className="col-span-2"><input value={f4} onChange={(e) => setF4(e.target.value)} /></Field>
        <Field label="Start (your local time)"><input type="datetime-local" value={toLocalInput(b.start)} onChange={(e) => setB({ ...b, start: new Date(e.target.value).toISOString() })} /></Field>
        <Field label="End (your local time)"><input type="datetime-local" value={toLocalInput(b.end)} onChange={(e) => setB({ ...b, end: new Date(e.target.value).toISOString() })} /></Field>
        <Field label="Information status" className="col-span-2">
          <select value={b.status} onChange={(e) => setB({ ...b, status: e.target.value as InfoStatus })}>
            {(Object.keys(STATUS_LABEL) as InfoStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Source URL" className="col-span-2"><input type="url" value={b.sourceUrl ?? ""} onChange={(e) => setB({ ...b, sourceUrl: e.target.value })} placeholder="https://www.hoyolab.com/article/…" /></Field>
        <Field label="Server note" className="col-span-2" hint="Version updates start at the same moment worldwide; mid-version banners use each server's local time."><input value={b.serverNote ?? ""} onChange={(e) => setB({ ...b, serverNote: e.target.value })} /></Field>
      </div>
      {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></div>
    </Modal>
  );
}

export function WarpBanners() {
  const banners = useLiveQuery(() => getDb().banners.orderBy("start").toArray(), []);
  const now = useNow(30_000);
  const [editing, setEditing] = useState<BannerEntry | null | "new">(null);
  const groups = {
    Active: (banners ?? []).filter((b) => Date.parse(b.start) <= now && Date.parse(b.end) > now),
    Upcoming: (banners ?? []).filter((b) => Date.parse(b.start) > now),
    Past: (banners ?? []).filter((b) => Date.parse(b.end) <= now).reverse(),
  };
  return (
    <div className="space-y-5">
      <Notice>No connected source publishes banner schedules under a usable license, so banners are entered by you from official notices. Every entry shows whether it is confirmed, speculation, or a leak. Rumours are never shown as confirmed.</Notice>
      <div className="flex justify-end"><Button variant="primary" onClick={() => setEditing("new")}><Plus size={15} /> Add banner</Button></div>
      {!banners?.length ? <Empty title="No banners tracked">Add the current banners from the in-game Warp page or the official HoYoLAB notice.</Empty> : (
        Object.entries(groups).map(([label, list]) => list.length > 0 && (
          <Panel key={label} title={label}>
            <ul className="grid gap-3 md:grid-cols-2">
              {list.map((b) => (
                <li key={b.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-gold">{b.featured5.join(", ") || "(featured 5★ not set)"}</div>
                      <div className="truncate text-xs text-[var(--purple4)]">{b.featured4.join(" · ")}</div>
                    </div>
                    <Badge tone={STATUS_TONE[b.status]}>{b.status}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span>{b.pool === "character" ? "Character" : "Light Cone"} · v{b.version}</span>
                    {label === "Upcoming" ? <Countdown to={Date.parse(b.start)} prefix="starts in " /> : label === "Active" ? <Countdown to={Date.parse(b.end)} prefix="ends in " /> : <span>ended {new Date(b.end).toLocaleDateString()}</span>}
                    {b.sourceUrl && <a href={b.sourceUrl} target="_blank" rel="noreferrer" className="text-cyan hover:underline">source</a>}
                  </div>
                  {b.serverNote && <p className="mt-1 text-[11px] text-faint">{b.serverNote}</p>}
                  <div className="mt-2 flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(b)}><Pencil size={13} /> Edit</Button>
                    <Button size="sm" variant="ghost" onClick={async () => { if (confirmAction("Delete this banner?")) await getDb().banners.delete(b.id); }}><Trash2 size={13} /></Button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        ))
      )}
      {editing && <BannerForm initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
