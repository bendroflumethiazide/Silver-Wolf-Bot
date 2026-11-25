"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { FileJson, RotateCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, confirmAction, Empty, ErrorBox, Notice, PageHeader, Panel, Stat } from "@/components/ui";
import { importComment } from "@/lib/companion/comments";
import { fill, pick, SW } from "@/lib/companion/voice";
import { getDb } from "@/lib/db";
import { characterDisplayName } from "@/lib/gamedata/types";
import { applyScanPlan, applyWarpImport, planScan, rollbackImport, type ScanPlan } from "@/lib/importers/apply";
import { countDiff, type DiffRow } from "@/lib/importers/diff";
import { parseHsrScanner, type ParsedScan } from "@/lib/importers/hsrScanner";
import { diffWarpRecords, parseWarpCsv, parseWarpJson, type WarpImport } from "@/lib/importers/warp";
import { SLOT_LABEL } from "@/lib/relics/stats";
import { useApp } from "@/lib/store";
import { POOLS } from "@/lib/warp/rules";

type Cat = "characters" | "lightCones" | "relics";
const CAT_LABEL: Record<Cat, string> = { characters: "Characters", lightCones: "Light Cones", relics: "Relics" };

function FilePick({ accept, onFile, label }: { accept: string; onFile: (f: File) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      className={`flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition ${drag ? "border-cyan bg-cyan/5" : "border-line"}`}
    >
      <FileJson className="text-violet" />
      <div className="text-sm text-muted">Drop a file here or</div>
      <Button onClick={() => ref.current?.click()}><Upload size={15} /> {label}</Button>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </div>
  );
}

function ScannerImport() {
  const { profileId, game } = useApp();
  const [file, setFile] = useState<string>();
  const [parsed, setParsed] = useState<ParsedScan | null>(null);
  const [plan, setPlan] = useState<ScanPlan | null>(null);
  const [cats, setCats] = useState({ characters: true, lightCones: true, relics: true });
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = async (f: File) => {
    setErr(null); setDone(null); setPlan(null); setParsed(null); setApproved(new Set());
    try {
      const p = parseHsrScanner(JSON.parse(await f.text()), profileId);
      const db = getDb();
      const existing = {
        characters: await db.characters.where("profileId").equals(profileId).toArray(),
        lightCones: await db.lightCones.where("profileId").equals(profileId).toArray(),
        relics: await db.relics.where("profileId").equals(profileId).toArray(),
      };
      setFile(f.name); setParsed(p); setPlan(planScan(existing, p));
    } catch (e) { setErr(e instanceof SyntaxError ? "File is not valid JSON." : e instanceof Error ? e.message : String(e)); }
  };
  const apply = async () => {
    if (!plan) return;
    const r = await applyScanPlan(plan, { categories: cats, approvedConflicts: approved, fileName: file });
    setDone(fill(pick(SW.importDone, r.historyId), { applied: r.written + r.removed }) + `|${r.written} written, ${r.removed} removed`);
    setPlan(null); setParsed(null);
  };

  const describe = (cat: Cat, r: DiffRow<unknown>): string => {
    const item = (r.after ?? r.before) as Record<string, unknown>;
    if (cat === "characters") { const c = game?.characters[item.charId as string]; return `${c ? characterDisplayName(c) : item.charId} · Lv ${item.level} E${item.eidolon}`; }
    if (cat === "lightCones") return `${game?.lightCones[item.lcId as string]?.name ?? item.lcId} · Lv ${item.level} S${item.superimposition}`;
    return `${game?.relicSets[item.setId as string]?.name ?? item.setId} · ${SLOT_LABEL[item.slot as keyof typeof SLOT_LABEL]} +${item.level} ${item.mainStat}`;
  };

  const totals = plan ? countDiff<unknown>([...(cats.characters ? plan.characters : []), ...(cats.lightCones ? plan.lightCones : []), ...(cats.relics ? plan.relics : [])]) : null;

  return (
    <Panel title="HSR Scanner / Fribbels-compatible inventory (JSON)" hud>
      <p className="mb-3 text-sm text-muted">
        Export from <a className="text-cyan hover:underline" href="https://github.com/kel-z/HSR-Scanner" target="_blank" rel="noreferrer">HSR Scanner</a> (format v3–v4, the same file the Fribbels optimizer imports).
        The scanner reads your screen with OCR on your own PC; this app never touches the game client.
      </p>
      {!plan && <FilePick accept=".json,application/json" onFile={load} label="Choose scan file" />}
      {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
      {done && <WolfComment comment={{ mood: "smug", line: done, facts: ["Recorded in Import history below, with rollback."] }} className="mt-3" />}
      {plan && parsed && totals && (
        <div className="space-y-4">
          <WolfComment comment={importComment(totals)} />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge tone="cyan">{file}</Badge> {parsed.meta.build && <span>scanner {parsed.meta.build}</span>} <span>format v{parsed.meta.version}</span>
            {parsed.meta.uid && <span>UID {parsed.meta.uid}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="New" value={totals.new} tone="cyan" /><Stat label="Changed" value={totals.changed} /><Stat label="Unchanged" value={totals.unchanged} />
            <Stat label="Removed" value={totals.removed} hint="missing from scan" /><Stat label="Conflicts" value={totals.conflict} tone="violet" hint="manual entries" />
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            {(Object.keys(CAT_LABEL) as Cat[]).map((c) => (
              <label key={c} className="flex items-center gap-2"><input type="checkbox" checked={cats[c]} onChange={(e) => setCats({ ...cats, [c]: e.target.checked })} /> {CAT_LABEL[c]} ({plan[c].length})</label>
            ))}
          </div>
          {parsed.issues.length > 0 && <Notice tone="warn"><div className="mb-1 font-medium">Validation notes</div><ul className="list-disc pl-4 text-xs">{parsed.issues.slice(0, 20).map((i) => <li key={i}>{i}</li>)}</ul></Notice>}
          {(Object.keys(CAT_LABEL) as Cat[]).filter((c) => cats[c]).map((c) => {
            const rows = (plan[c] as DiffRow<unknown>[]).filter((r) => r.kind !== "unchanged");
            if (!rows.length) return null;
            return (
              <details key={c} open={rows.some((r) => r.kind === "conflict")} className="rounded-lg border border-line p-3">
                <summary className="cursor-pointer text-sm font-medium">{CAT_LABEL[c]}: {rows.length} change(s)</summary>
                <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto text-xs">
                  {rows.map((r) => (
                    <li key={r.key} className="flex flex-wrap items-center gap-2 border-b border-line/50 py-1">
                      <Badge tone={r.kind === "new" ? "cyan" : r.kind === "removed" ? "bad" : r.kind === "conflict" ? "violet" : "default"}>{r.kind}</Badge>
                      <span className="min-w-0 flex-1 truncate">{describe(c, r)}</span>
                      {r.changes.length > 0 && <span className="text-faint">{r.changes.join(", ")}</span>}
                      {r.kind === "conflict" && (
                        <label className="flex items-center gap-1 text-violet"><input type="checkbox" checked={approved.has(r.key)} onChange={(e) => { const s = new Set(approved); if (e.target.checked) s.add(r.key); else s.delete(r.key); setApproved(s); }} /> {r.after ? "overwrite my manual entry" : "delete my manual entry"}</label>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
          <div className="flex gap-2">
            <Button variant="primary" onClick={apply} disabled={!Object.values(cats).some(Boolean)}>Apply import</Button>
            <Button variant="ghost" onClick={() => { setPlan(null); setParsed(null); }}>Cancel</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function WarpImportPanel() {
  const { profileId } = useApp();
  const [file, setFile] = useState<string>();
  const [data, setData] = useState<WarpImport | null>(null);
  const [account, setAccount] = useState(0);
  const [preview, setPreview] = useState<{ fresh: number; duplicates: number; byPool: Record<string, number> } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const computePreview = async (d: WarpImport, idx: number) => {
    const existing = await getDb().warps.where("profileId").equals(profileId).toArray();
    const { fresh, duplicates } = diffWarpRecords(existing, d.accounts[idx].records);
    const byPool: Record<string, number> = {};
    for (const r of fresh) byPool[r.pool] = (byPool[r.pool] ?? 0) + 1;
    setPreview({ fresh: fresh.length, duplicates, byPool });
  };
  const load = async (f: File) => {
    setErr(null); setDone(null); setData(null); setPreview(null);
    try {
      const text = await f.text();
      const d = f.name.toLowerCase().endsWith(".csv") ? parseWarpCsv(text, profileId) : parseWarpJson(JSON.parse(text), profileId);
      setFile(f.name); setData(d); setAccount(0); await computePreview(d, 0);
    } catch (e) { setErr(e instanceof SyntaxError ? "File is not valid JSON." : e instanceof Error ? e.message : String(e)); }
  };
  const apply = async () => {
    if (!data) return;
    const existing = await getDb().warps.where("profileId").equals(profileId).toArray();
    const { fresh } = diffWarpRecords(existing, data.accounts[account].records);
    const r = await applyWarpImport(fresh, data.format, file);
    setDone(`${r.written} new Warp record(s) imported. Duplicates were skipped.`);
    setData(null); setPreview(null);
  };

  return (
    <Panel title="Warp history (UIGF v4 · SRGF v1 · CSV)">
      <p className="mb-3 text-sm text-muted">Use a file exported by a gacha-log tool that supports the UIGF/SRGF standards. Records are matched by their game record id, so re-importing never creates duplicates. CSV needs the columns time, name, rank and gacha_type.</p>
      {!data && <FilePick accept=".json,.csv,application/json,text/csv" onFile={load} label="Choose Warp file" />}
      {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
      {done && <div className="mt-3"><Notice tone="ok">{done}</Notice></div>}
      {data && preview && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs"><Badge tone="cyan">{data.format.toUpperCase()}</Badge><span className="text-muted">{file}</span></div>
          {data.accounts.length > 1 && (
            <select value={account} onChange={async (e) => { const i = Number(e.target.value); setAccount(i); await computePreview(data, i); }} aria-label="Account in file">
              {data.accounts.map((a, i) => <option key={i} value={i}>UID {a.uid} · {a.records.length} records</option>)}
            </select>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="New records" value={preview.fresh} tone="cyan" /><Stat label="Duplicates skipped" value={preview.duplicates} />
            {Object.entries(preview.byPool).map(([k, v]) => <Stat key={k} label={POOLS[k as keyof typeof POOLS].label} value={v} />)}
          </div>
          {data.issues.length > 0 && <Notice tone="warn"><ul className="list-disc pl-4 text-xs">{data.issues.slice(0, 15).map((i) => <li key={i}>{i}</li>)}</ul></Notice>}
          <div className="flex gap-2"><Button variant="primary" onClick={apply} disabled={!preview.fresh}>Import {preview.fresh} record(s)</Button><Button variant="ghost" onClick={() => setData(null)}>Cancel</Button></div>
        </div>
      )}
    </Panel>
  );
}

function History() {
  const items = useLiveQuery(() => getDb().importHistory.orderBy("importedAt").reverse().toArray(), []);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Panel title="Import history">
      {err && <div className="mb-2"><ErrorBox>{err}</ErrorBox></div>}
      {!items?.length ? <Empty title="No imports yet" /> : (
        <ul className="space-y-2">
          {items.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
              <Badge tone="cyan">{h.kind}</Badge>
              <span className="min-w-0 flex-1 truncate">{h.fileName ?? "—"} · {h.summary}</span>
              <time className="font-mono text-[11px] text-faint">{new Date(h.importedAt).toLocaleString()}</time>
              {h.rolledBack ? <Badge>rolled back</Badge> : (
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (!confirmAction("Roll back this import? Rows it touched return to their previous state.")) return;
                  try { await rollbackImport(h.id); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
                }}><RotateCcw size={13} /> Roll back</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-faint">Roll back newest imports first if a later import touched the same rows.</p>
    </Panel>
  );
}

export default function ImportPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Import Center" subtitle="Parse → validate → preview → detect duplicates and conflicts → approve → apply → report. Manual entries are never silently overwritten." />
      <ScannerImport />
      <WarpImportPanel />
      <Notice>Screenshot OCR inside the app is not implemented: in-browser OCR of HSR relic screens is unreliable without a trained model. HSR Scanner does this on your PC and exports a file this page imports.</Notice>
      <History />
    </div>
  );
}
