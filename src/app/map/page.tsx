"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "next/navigation";
import { Download, Crosshair, Minus, Plus, Trash2, Upload, Maximize } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, confirmAction, cx, Empty, ErrorBox, Field, Loading, Modal, Notice, PageHeader, Panel, Progress } from "@/components/ui";
import { fill, pick, SW } from "@/lib/companion/voice";
import { downloadJson } from "@/lib/backup";
import { getDb, newId, nowIso } from "@/lib/db";
import { CATEGORY_COLOR, clampPan, clusterMarkers, completion, zoneTree, type MapPack } from "@/lib/map";
import { useApp } from "@/lib/store";
import { MARKER_CATEGORIES, type MapMarker, type MapZone, type MarkerCategory, type ProgressStatus } from "@/lib/types";

const STATUS: { id: ProgressStatus; label: string }[] = [
  { id: "not-started", label: "Not started" }, { id: "in-progress", label: "In progress" }, { id: "completed", label: "Completed" },
  { id: "skipped", label: "Skipped" }, { id: "investigate", label: "Needs investigation" },
];
const color = (c: MarkerCategory) => CATEGORY_COLOR[c] ?? CATEGORY_COLOR.default;

function ZoneForm({ onClose }: { onClose: (id?: string) => void }) {
  const [z, setZ] = useState({ planet: "", region: "", name: "", floor: "1F" });
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!z.planet.trim() || !z.region.trim() || !z.name.trim()) return setErr("Planet, region and zone name are required.");
    if (!file) return setErr("Upload a map image (for example a screenshot of the in-game map).");
    if (file.size > 15 * 1024 * 1024) return setErr("Image must be under 15 MB.");
    const dims = await new Promise<{ w: number; h: number }>((res, rej) => { const img = new Image(); img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight }); img.onerror = () => rej(new Error("Not a readable image.")); img.src = URL.createObjectURL(file); }).catch((e: Error) => { setErr(e.message); return null; });
    if (!dims) return;
    const zone: MapZone = { id: newId("zone"), planet: z.planet.trim(), region: z.region.trim(), name: z.name.trim(), floor: z.floor.trim() || "1F", image: file, width: dims.w, height: dims.h, createdAt: nowIso() };
    await getDb().mapZones.put(zone);
    onClose(zone.id);
  };
  return (
    <Modal open onClose={() => onClose()} title="Add map zone / floor">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Planet"><input value={z.planet} onChange={(e) => setZ({ ...z, planet: e.target.value })} placeholder="e.g. Penacony" /></Field>
        <Field label="Region"><input value={z.region} onChange={(e) => setZ({ ...z, region: e.target.value })} /></Field>
        <Field label="Zone"><input value={z.name} onChange={(e) => setZ({ ...z, name: e.target.value })} /></Field>
        <Field label="Floor"><input value={z.floor} onChange={(e) => setZ({ ...z, floor: e.target.value })} /></Field>
        <Field label="Map image" className="col-span-2" hint="Your own screenshot. Stored only in this browser."><input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
      </div>
      {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => onClose()}>Cancel</Button><Button variant="primary" onClick={save}>Create</Button></div>
    </Modal>
  );
}

function MarkerForm({ marker, onClose }: { marker: MapMarker; onClose: () => void }) {
  const [m, setM] = useState(marker);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!m.name.trim()) return setErr("Name is required.");
    if (m.guideUrl && !/^https?:\/\//.test(m.guideUrl)) return setErr("Guide link must start with http(s)://");
    await getDb().mapMarkers.put({ ...m, updatedAt: nowIso() });
    onClose();
  };
  const txt = (k: keyof MapMarker, label: string, rows = 0) => (
    <Field label={label} className="col-span-2">{rows ? <textarea rows={rows} value={(m[k] as string) ?? ""} onChange={(e) => setM({ ...m, [k]: e.target.value })} /> : <input value={(m[k] as string) ?? ""} onChange={(e) => setM({ ...m, [k]: e.target.value })} />}</Field>
  );
  return (
    <Modal open onClose={onClose} title={marker.name ? `Marker: ${marker.name}` : "New marker"}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category"><select value={m.category} onChange={(e) => setM({ ...m, category: e.target.value as MarkerCategory })}>{MARKER_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Status"><select value={m.status} onChange={(e) => setM({ ...m, status: e.target.value as ProgressStatus })}>{STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
        {txt("name", "Name")}{txt("description", "Description", 2)}{txt("requirements", "Requirements")}{txt("instructions", "Instructions / puzzle solution", 3)}
        {txt("reward", "Reward")}{txt("achievement", "Associated achievement")}{txt("guideUrl", "Guide / video link")}
      </div>
      {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
      <div className="mt-4 flex justify-between">
        <Button variant="danger" onClick={async () => { if (confirmAction("Delete marker?")) { await getDb().mapMarkers.delete(m.id); onClose(); } }}><Trash2 size={14} /></Button>
        <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></div>
      </div>
    </Modal>
  );
}

function Viewer({ zone, markers, onAdd, onOpen, placing }: { zone: MapZone; markers: MapMarker[]; onAdd: (x: number, y: number) => void; onOpen: (m: MapMarker) => void; placing: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const drag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; scale: number } | null>(null);

  useEffect(() => {
    if (!zone.image) return;
    const u = URL.createObjectURL(zone.image);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [zone.image]);

  const fit = () => {
    const el = box.current; if (!el) return;
    const s = Math.min(el.clientWidth / zone.width, el.clientHeight / zone.height);
    setView({ scale: s, x: (el.clientWidth - zone.width * s) / 2, y: (el.clientHeight - zone.height * s) / 2 });
  };
  useEffect(fit, [zone.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomAt = (factor: number, cx: number, cy: number) => setView((v) => {
    const el = box.current!;
    const scale = Math.min(8, Math.max(0.05, v.scale * factor));
    const k = scale / v.scale;
    const p = clampPan(cx - (cx - v.x) * k, cy - (cy - v.y) * k, zone.width * scale, zone.height * scale, el.clientWidth, el.clientHeight);
    return { scale, ...p };
  });

  useEffect(() => {
    const el = box.current; if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }); // re-bind each render so zoomAt sees current zone

  const down = (e: RPointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale };
      drag.current = null;
    } else drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
  };
  const move = (e: RPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const el = box.current!;
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const r = el.getBoundingClientRect();
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((pinch.current.scale * (d / pinch.current.d)) / view.scale, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      return;
    }
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true;
    setView((v) => ({ ...v, ...clampPan(d.ox + e.clientX - d.sx, d.oy + e.clientY - d.sy, zone.width * v.scale, zone.height * v.scale, el.clientWidth, el.clientHeight) }));
  };
  const up = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && placing) {
      const r = box.current!.getBoundingClientRect();
      const x = (e.clientX - r.left - view.x) / (zone.width * view.scale);
      const y = (e.clientY - r.top - view.y) / (zone.height * view.scale);
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) onAdd(x, y);
    }
  };

  const clusters = clusterMarkers(markers, zone.width, zone.height, view.scale);
  return (
    <div className="relative">
      <div ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        className={cx("pixel-grid relative h-[60dvh] min-h-[320px] touch-none select-none overflow-hidden rounded-xl border border-line bg-black/50", placing ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing")}
        role="application" aria-label={`Map of ${zone.name} ${zone.floor}`}>
        {url && (
                    <img src={url} alt="" draggable={false} className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left"
            style={{ width: zone.width, height: zone.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }} />
        )}
        {clusters.map((c, i) => {
          const left = view.x + c.x * zone.width * view.scale;
          const top = view.y + c.y * zone.height * view.scale;
          if (c.markers.length > 1) return (
            <button key={`c${i}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => zoomAt(2, left, top)} style={{ left, top }}
              className="absolute z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan/60 bg-black/80 font-mono text-[11px] text-cyan" aria-label={`${c.markers.length} markers, zoom in`}>
              {c.markers.length}
            </button>
          );
          const m = c.markers[0];
          return (
            <button key={m.id} onPointerDown={(e) => e.stopPropagation()} onClick={() => onOpen(m)} style={{ left, top, background: color(m.category) }} title={`${m.name} (${m.category})`}
              className={cx("absolute z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow", m.status === "completed" ? "border-ok opacity-50" : m.status === "investigate" ? "border-warn" : "border-black")}
              aria-label={`${m.name}, ${m.category}, ${m.status}`} />
          );
        })}
      </div>
      <div className="absolute right-2 top-2 z-20 flex flex-col gap-1">
        <Button size="sm" variant="subtle" onClick={() => { const el = box.current!; zoomAt(1.3, el.clientWidth / 2, el.clientHeight / 2); }} aria-label="Zoom in"><Plus size={14} /></Button>
        <Button size="sm" variant="subtle" onClick={() => { const el = box.current!; zoomAt(1 / 1.3, el.clientWidth / 2, el.clientHeight / 2); }} aria-label="Zoom out"><Minus size={14} /></Button>
        <Button size="sm" variant="subtle" onClick={fit} aria-label="Fit map"><Maximize size={14} /></Button>
      </div>
    </div>
  );
}

function Inner() {
  const { profileId } = useApp();
  const params = useSearchParams();
  const zones = useLiveQuery(() => getDb().mapZones.toArray(), []);
  const markers = useLiveQuery(() => getDb().mapMarkers.where("profileId").equals(profileId).toArray(), [profileId]);
  const [zoneId, setZoneId] = useState<string | null>(params.get("zone"));
  const [adding, setAdding] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [editing, setEditing] = useState<MapMarker | null>(null);
  const [cats, setCats] = useState<Set<MarkerCategory>>(new Set());
  const [incomplete, setIncomplete] = useState(false);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tree = useMemo(() => zoneTree(zones ?? []), [zones]);

  if (!zones || !markers) return <Loading />;
  const zone = zones.find((z) => z.id === zoneId) ?? zones[0];
  const zoneMarkers = markers.filter((m) => m.zoneId === zone?.id);
  const visible = zoneMarkers.filter((m) => (!cats.size || cats.has(m.category)) && (!incomplete || (m.status !== "completed" && m.status !== "skipped")) && (!q || (m.name + " " + (m.description ?? "")).toLowerCase().includes(q.toLowerCase())));
  const floors = zone ? zones.filter((z) => z.planet === zone.planet && z.region === zone.region && z.name === zone.name) : [];
  const zc = completion(zoneMarkers);
  const comment = !zones.length
    ? { mood: "bored" as const, line: pick(SW.mapEmpty, "map"), facts: ["No zones created yet."] }
    : { mood: zc.pct >= 100 ? ("hyped" as const) : ("neutral" as const), line: fill(pick(SW.mapProgress, `map-${zone.id}-${zc.done}`), { done: zc.done, total: zc.total, pct: zc.pct.toFixed(0) }), facts: [`${zone.planet} › ${zone.region} › ${zone.name} ${zone.floor}: ${zc.done}/${zc.total} (manual tracking).`] };

  const exportPack = async () => {
    const toData = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(b); });
    const pack: MapPack = { app: "astral-companion-map", version: 1, zones: await Promise.all(zones.map(async (z) => ({ ...z, image: z.image ? await toData(z.image) : undefined }))), markers: markers.map((m) => { const { profileId, ...rest } = m; void profileId; return rest; }) };
    downloadJson(`map-pack-${new Date().toISOString().slice(0, 10)}.json`, pack);
  };
  const importPack = async (f: File) => {
    setErr(null);
    try {
      const pack = JSON.parse(await f.text()) as MapPack;
      if (pack.app !== "astral-companion-map" || !Array.isArray(pack.zones) || !Array.isArray(pack.markers)) throw new Error("Not an Astral Companion map pack.");
      const zoneIds = new Map<string, string>();
      const newZones: MapZone[] = [];
      for (const z of pack.zones) {
        const id = newId("zone"); zoneIds.set(z.id, id);
        const image = z.image ? await (await fetch(z.image)).blob() : undefined;
        newZones.push({ ...z, id, image });
      }
      const newMarkers = pack.markers.filter((m) => zoneIds.has(m.zoneId)).map((m) => ({ ...m, id: newId("mk"), zoneId: zoneIds.get(m.zoneId)!, profileId }));
      await getDb().mapZones.bulkPut(newZones);
      await getDb().mapMarkers.bulkPut(newMarkers);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div>
      <PageHeader title="Interactive World Map" subtitle="A data-driven, multi-floor map system. Add your own map images, then place and track every treasure, puzzle and collectible."
        actions={<>
          <Button size="sm" onClick={exportPack} disabled={!zones.length}><Download size={14} /> Export map data</Button>
          <Button size="sm" onClick={() => fileRef.current?.click()}><Upload size={14} /> Import</Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importPack(f); e.target.value = ""; }} />
          <Button size="sm" variant="primary" onClick={() => setAdding(true)}><Plus size={14} /> Add zone</Button>
        </>} />
      <WolfComment comment={comment} className="mb-4" />
      <Notice>Official map data and marker coordinates (HoYoLAB Interactive Map) are not licensed for reuse here, so no markers are preloaded. Everything on this map is yours and labelled as manual tracking. It is never presented as verified account data.</Notice>
      {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
      {!zone ? <div className="mt-5"><Empty title="No zones yet" action={<Button variant="primary" onClick={() => setAdding(true)}>Add your first zone</Button>}>Take a screenshot of an in-game map, upload it here, and start placing markers.</Empty></div> : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[260px_1fr]">
          <Panel title="Zones">
            <nav className="space-y-3 text-sm">
              {[...tree.entries()].map(([planet, regions]) => {
                const pm = markers.filter((m) => zones.find((z) => z.id === m.zoneId)?.planet === planet);
                const pc = completion(pm);
                return (
                  <div key={planet}>
                    <div className="mb-1 flex items-center justify-between"><span className="font-medium">{planet}</span><span className="font-mono text-[10px] text-muted">{pc.pct.toFixed(0)}%</span></div>
                    <Progress value={pc.done} max={pc.total || 1} tone="gold" label={`${planet} completion`} />
                    {[...regions.entries()].map(([region, names]) => (
                      <div key={region} className="mt-2 pl-2">
                        <div className="text-xs text-faint">{region}</div>
                        {[...names.entries()].map(([name, fl]) => (
                          <button key={name} onClick={() => setZoneId(fl[0].id)} className={cx("block w-full truncate rounded px-2 py-1 text-left", fl.some((f) => f.id === zone.id) ? "bg-violet/15 text-text" : "text-muted hover:text-text")}>{name}</button>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </nav>
          </Panel>
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{zone.name}</span>
              {floors.map((f) => <button key={f.id} onClick={() => setZoneId(f.id)} className={cx("rounded border px-2 py-0.5 text-xs", f.id === zone.id ? "border-cyan/50 text-cyan" : "border-line text-muted")}>{f.floor}</button>)}
              <div className="flex-1" />
              <Badge tone="gold">{zc.done}/{zc.total} · {zc.pct.toFixed(0)}%</Badge>
              <Button size="sm" variant={placing ? "primary" : "subtle"} onClick={() => setPlacing(!placing)} aria-pressed={placing}><Crosshair size={14} /> {placing ? "Click map to place" : "Place marker"}</Button>
              <Button size="sm" variant="ghost" onClick={async () => { if (confirmAction(`Delete ${zone.name} ${zone.floor} and its markers?`)) { await getDb().mapMarkers.where("zoneId").equals(zone.id).delete(); await getDb().mapZones.delete(zone.id); setZoneId(null); } }} aria-label="Delete zone"><Trash2 size={14} /></Button>
            </div>
            <Viewer zone={zone} markers={visible} placing={placing} onOpen={setEditing} onAdd={(x, y) => { setPlacing(false); setEditing({ id: newId("mk"), profileId, zoneId: zone.id, x, y, category: "Basic Treasure", name: "", status: "not-started", createdAt: nowIso(), updatedAt: nowIso() }); }} />
            <div className="flex flex-wrap items-center gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search markers" aria-label="Search markers" className="w-48" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={incomplete} onChange={(e) => setIncomplete(e.target.checked)} /> Incomplete only</label>
              {cats.size > 0 && <Button size="sm" variant="ghost" onClick={() => setCats(new Set())}>Clear filters</Button>}
            </div>
            <div className="flex flex-wrap gap-1.5" aria-label="Legend and category filter">
              {MARKER_CATEGORIES.map((c) => {
                const count = zoneMarkers.filter((m) => m.category === c).length;
                const on = cats.has(c);
                return (
                  <button key={c} onClick={() => { const s = new Set(cats); if (on) s.delete(c); else s.add(c); setCats(s); }} aria-pressed={on}
                    className={cx("flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px]", on ? "border-cyan/50 text-text" : "border-line text-muted", !count && !on && "opacity-50")}>
                    <span className="h-2 w-2 rounded-full" style={{ background: color(c) }} />{c} <span className="font-mono text-faint">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {adding && <ZoneForm onClose={(id) => { setAdding(false); if (id) setZoneId(id); }} />}
      {editing && <MarkerForm key={editing.id} marker={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

export default function MapPage() {
  return <Suspense fallback={<Loading />}><Inner /></Suspense>;
}
