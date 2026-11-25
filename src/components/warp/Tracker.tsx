"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, confirmAction, Empty, ErrorBox, Field, Modal, Notice, NumberInput, Panel, Stat } from "@/components/ui";
import { warpPoolComment } from "@/lib/companion/comments";
import { fill, pick, SW } from "@/lib/companion/voice";
import { downloadText } from "@/lib/backup";
import { getDb, kvSet, newId } from "@/lib/db";
import { useOffsets } from "@/lib/hooks";
import { warpRecordsToCsv } from "@/lib/importers/warp";
import { useApp } from "@/lib/store";
import { DEFAULT_OFFSET, pityHistogram, summarizePool, type PoolOffset, type WarpRecord } from "@/lib/warp/history";
import { POOLS, type PoolKind } from "@/lib/warp/rules";

const TRACKED: PoolKind[] = ["character", "lightcone", "standard", "collab-character", "collab-lightcone", "departure"];

function ManualEntry({ pool, onClose }: { pool: PoolKind; onClose: () => void }) {
  const { profileId } = useApp();
  const [count, setCount] = useState(1);
  const [rank, setRank] = useState<3 | 4 | 5>(3);
  const [name, setName] = useState("");
  const [featured, setFeatured] = useState<"auto" | "featured" | "off-banner">("auto");
  const [time, setTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (rank !== 3 && !name.trim()) return setErr("Name the 4★/5★ item.");
    if (count < 1 || count > 100) return setErr("Add between 1 and 100 pulls at a time.");
    const base = time.replace("T", " ") + ":00";
    const last = await getDb().warps.where({ profileId, pool }).toArray();
    let seq = Math.max(0, ...last.map((r) => r.seq ?? 0));
    const rows = Array.from({ length: count }, (_, i): WarpRecord & { key: string } => {
      const id = newId("manual");
      const isLast = i === count - 1;
      return {
        key: `${profileId}:${id}`, id, profileId, pool, gachaType: POOLS[pool].gachaTypes[0], name: isLast ? name.trim() || "3★ Light Cone" : "3★ Light Cone",
        itemType: "", rank: isLast ? rank : 3, time: base, source: "manual", seq: ++seq,
        ...(isLast && rank === 5 && featured !== "auto" ? { featuredOverride: featured } : {}),
      };
    });
    await getDb().warps.bulkPut(rows);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={`Add pulls — ${POOLS[pool].label}`}>
      <p className="mb-3 text-sm text-muted">Adds a batch: {count - 1} × 3★ followed by the item below. Use this to log pulls between imports.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pulls in batch"><NumberInput min={1} max={100} value={count} onChange={setCount} /></Field>
        <Field label="Last pull rarity"><select value={rank} onChange={(e) => setRank(Number(e.target.value) as 3 | 4 | 5)}><option value={3}>3★</option><option value={4}>4★</option><option value={5}>5★</option></select></Field>
        <Field label="Item name" className="col-span-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder={rank === 3 ? "optional" : "e.g. Silver Wolf"} /></Field>
        {rank === 5 && POOLS[pool].fiveFeaturedChance !== null && (
          <Field label="Featured?" className="col-span-2"><select value={featured} onChange={(e) => setFeatured(e.target.value as typeof featured)}>
            <option value="featured">Featured (won / guaranteed)</option><option value="off-banner">Off-banner (lost 50/50)</option>
          </select></Field>
        )}
        <Field label="Time (server local)" className="col-span-2"><input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Add</Button></div>
    </Modal>
  );
}

function OffsetEditor({ pool, offset, onClose }: { pool: PoolKind; offset: PoolOffset; onClose: () => void }) {
  const { profileId } = useApp();
  const offsets = useOffsets(profileId);
  const [o, setO] = useState(offset);
  const hard = POOLS[pool].five.hard;
  const save = async () => { await kvSet(`warpOffsets:${profileId}`, { ...offsets, [pool]: o }); onClose(); };
  return (
    <Modal open onClose={onClose} title={`History start — ${POOLS[pool].label}`}>
      <p className="mb-3 text-sm text-muted">The game only shows recent records. If you know your pity and guarantee as of the first imported record, enter them so pity math is exact.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="5★ pity before first record"><NumberInput min={0} max={hard - 1} value={o.pity5Before} onChange={(v) => setO({ ...o, pity5Before: v })} /></Field>
        <Field label="4★ pity before first record"><NumberInput min={0} max={9} value={o.pity4Before} onChange={(v) => setO({ ...o, pity4Before: v })} /></Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={o.guaranteedBefore} onChange={(e) => setO({ ...o, guaranteedBefore: e.target.checked })} /> Guarantee was active before the first record</label>
      <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={o.complete} onChange={(e) => setO({ ...o, complete: e.target.checked })} /> My history is complete (nothing missing)</label>
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></div>
    </Modal>
  );
}

export function WarpTracker() {
  const { profileId } = useApp();
  const [pool, setPool] = useState<PoolKind>("character");
  const [adding, setAdding] = useState(false);
  const [editingOffset, setEditingOffset] = useState(false);
  const records = useLiveQuery(() => getDb().warps.where({ profileId, pool }).toArray(), [profileId, pool]);
  const offsets = useOffsets(profileId);
  const offset = offsets[pool] ?? DEFAULT_OFFSET;
  const s = useMemo(() => (records ? summarizePool(pool, records, offset) : null), [records, pool, offset]);
  const rules = POOLS[pool];

  const setOverride = async (r: WarpRecord, v: WarpRecord["featuredOverride"] | "") => {
    await getDb().warps.update(`${profileId}:${r.id}`, { featuredOverride: v || undefined });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <select value={pool} onChange={(e) => setPool(e.target.value as PoolKind)} aria-label="Warp pool">
          {TRACKED.map((k) => <option key={k} value={k}>{POOLS[k].label}</option>)}
        </select>
        <Button size="sm" onClick={() => setAdding(true)}><Plus size={14} /> Add pulls</Button>
        <Link href="/import" className="text-xs text-cyan hover:underline">Import UIGF / SRGF / CSV →</Link>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" disabled={!records?.length} onClick={() => downloadText(`warps-${pool}.csv`, warpRecordsToCsv(records ?? []), "text/csv")}><Download size={14} /> CSV</Button>
        <Button size="sm" variant="ghost" disabled={!records?.length} onClick={async () => {
          if (confirmAction(`Delete all ${records?.length} ${rules.label} records for this profile?`)) await getDb().warps.where({ profileId, pool }).delete();
        }}><Trash2 size={14} /> Clear pool</Button>
      </div>
      {s && <WolfComment comment={warpPoolComment(s)} />}
      {!s ? null : s.total === 0 ? (
        <Empty title="No pulls recorded">Import a UIGF v4 or SRGF export, or add pulls manually. Each banner type keeps its own pity.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Total pulls" value={s.total} hint={`${(s.total * 160).toLocaleString()} Jade equiv.`} />
            <Stat label="5★ pity" value={`${s.pity5}/${rules.five.hard}`} tone={s.pity5 >= rules.five.softStart ? "gold" : undefined} hint={s.guaranteed5 ? "guaranteed next" : rules.fiveFeaturedChance !== null ? `${rules.fiveFeaturedChance * 100}% rate-up` : undefined} />
            <Stat label="4★ pity" value={`${s.pity4}/10`} />
            <Stat label="5★ / 4★" value={<><span className="text-gold">{s.fiveStars.length}</span> / <span className="text-[var(--purple4)]">{s.fourStarCount}</span></>} />
            <Stat label="Avg per 5★" value={s.averagePullsPerFiveStar?.toFixed(1) ?? "—"} hint="excludes uncertain pity" />
            <Stat label="50/50 won · lost" value={rules.fiveFeaturedChance === null ? "n/a" : `${s.wonFiftyFifty} · ${s.lostFiftyFifty}`} />
          </div>
          {s.warnings.length > 0 && (
            <Notice tone="warn">
              <ul className="list-disc space-y-0.5 pl-4">{s.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              <button className="mt-1 underline" onClick={() => setEditingOffset(true)}>Set history start</button>
            </Notice>
          )}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Panel title="5★ pity distribution">
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={pityHistogram(s.fiveStars, 10, rules.five.hard)}>
                    <CartesianGrid stroke="rgba(167,139,250,.1)" vertical={false} />
                    <XAxis dataKey="range" tick={{ fill: "#9b98b8", fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "#9b98b8", fontSize: 10 }} width={24} />
                    <Tooltip contentStyle={{ background: "#0b0a18", border: "1px solid rgba(167,139,250,.3)", borderRadius: 8 }} />
                    <Bar dataKey="count" name="5★ obtained" fill="#e9c46a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="5★ history" actions={<Button size="sm" variant="ghost" onClick={() => setEditingOffset(true)}>History start</Button>}>
              <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {[...s.fiveStars].reverse().map((f) => (
                  <li key={f.record.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate text-gold">{f.record.name}</span>
                    <Badge tone={f.pityAt >= rules.five.softStart ? "warn" : "cyan"}>{f.pityUncertain ? "≥" : ""}{f.pityAt}</Badge>
                    {f.fiftyFifty !== "n/a" && <Badge tone={f.fiftyFifty === "lost" ? "bad" : f.fiftyFifty === "won" ? "ok" : "gold"}>{f.fiftyFifty}</Badge>}
                    {rules.fiveFeaturedChance !== null && (
                      <select aria-label={`Featured override for ${f.record.name}`} value={f.record.featuredOverride ?? ""} onChange={(e) => setOverride(f.record, e.target.value as WarpRecord["featuredOverride"] | "")} className="py-0.5 text-[11px]">
                        <option value="">auto</option><option value="featured">featured</option><option value="off-banner">off-banner</option>
                      </select>
                    )}
                    <time className="w-full font-mono text-[10px] text-faint">{f.record.time} · {f.record.source}</time>
                  </li>
                ))}
              </ul>
              {s.fiveStars.length === 0 && <p className="text-sm text-muted">{fill(pick(SW.simDry, `dry-${s.total}`), { count: s.total })}</p>}
            </Panel>
          </div>
          <p className="text-xs text-muted">Featured detection treats the standard pool (Himeko, Welt, Bronya, Gepard, Clara, Yanqing, Bailu and the standard 5★ Light Cones) as off-banner. Use the override if a banner differs. {rules.pityNote}</p>
        </>
      )}
      {adding && <ManualEntry pool={pool} onClose={() => setAdding(false)} />}
      {editingOffset && <OffsetEditor pool={pool} offset={offset} onClose={() => setEditingOffset(false)} />}
    </div>
  );
}
