"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "next/navigation";
import { Bookmark, Trash2 } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { GameImage } from "@/components/GameImage";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, confirmAction, Empty, Field, Loading, Notice, NumberInput, PageHeader, Panel, Tabs } from "@/components/ui";
import { materialsComment, noGameData } from "@/lib/companion/comments";
import { getDb, kvGet, kvSet, newId, nowIso } from "@/lib/db";
import { characterDisplayName } from "@/lib/gamedata/types";
import { compareWithInventory, mergeTotals, type MaterialTotals } from "@/lib/materials/calculator";
import { FULL_TARGET, planCharacter, planLightCone, type CharacterTarget } from "@/lib/materials/plan";
import { useApp } from "@/lib/store";
import { playableCharacters } from "@/lib/summary";

interface SavedPlan { id: string; kind: "character" | "lightcone"; targetId: string; label: string; target?: CharacterTarget; lcFrom?: number; lcTo?: number; priority: number; createdAt: string }
type Tab = "calculator" | "planner" | "inventory";
const PRIORITY_LABEL = ["Limited-time rewards", "Character progression", "Trace upgrades", "Light Cone upgrades", "Relic farming", "General resources"];

function useInventory(profileId: string) {
  const rows = useLiveQuery(() => getDb().materials.where("profileId").equals(profileId).toArray(), [profileId]);
  return useMemo(() => Object.fromEntries((rows ?? []).map((r) => [r.itemId, r.count])), [rows]);
}
const setStock = (profileId: string, itemId: string, count: number) =>
  getDb().materials.put({ key: `${profileId}:${itemId}`, profileId, itemId, count: Math.max(0, Math.floor(count)), updatedAt: nowIso() });

function MaterialTable({ totals }: { totals: MaterialTotals }) {
  const { game, profileId } = useApp();
  const inv = useInventory(profileId);
  const rows = compareWithInventory(totals, inv);
  if (!rows.length) return <Empty title="Nothing required">Already at or above the target.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead><tr className="text-left font-mono text-[10px] uppercase tracking-wider text-faint"><th className="py-2">Material</th><th>Need</th><th>Have</th><th>Missing</th><th>Sources (game data)</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const it = game?.items[r.id];
            return (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="py-2"><div className="flex items-center gap-2"><GameImage path={it?.icon} alt={it?.name ?? r.id} className="h-8 w-8 shrink-0" /><span className={it?.rarity === 5 ? "text-gold" : it?.rarity === 4 ? "text-[var(--purple4)]" : ""}>{it?.name ?? r.id}</span></div></td>
                <td className="font-mono">{r.required.toLocaleString()}</td>
                <td><NumberInput min={0} value={r.owned} onChange={(v) => setStock(profileId, r.id, v)} aria-label={`Owned ${it?.name ?? r.id}`} /></td>
                <td className={`font-mono ${r.missing ? "text-warn" : "text-ok"}`}>{r.missing ? r.missing.toLocaleString() : "✓"}</td>
                <td className="max-w-[260px] text-xs text-muted">{it?.come_from?.slice(0, 3).join(" · ") || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Inner() {
  const params = useSearchParams();
  const { game, profileId } = useApp();
  const [tab, setTab] = useState<Tab>("calculator");
  const [mode, setMode] = useState<"character" | "lightcone">("character");
  const [charId, setCharId] = useState(params.get("char") ?? "");
  const [target, setTarget] = useState<CharacterTarget>(FULL_TARGET);
  const [lcUid, setLcUid] = useState("");
  const [lcTo, setLcTo] = useState(6);
  const [priority, setPriority] = useState(1);
  const owned = useLiveQuery(() => getDb().characters.where("profileId").equals(profileId).toArray(), [profileId]);
  const lcs = useLiveQuery(() => getDb().lightCones.where("profileId").equals(profileId).toArray(), [profileId]);
  const plans = useLiveQuery(() => kvGet<SavedPlan[]>(`materialPlans:${profileId}`, []), [profileId]);
  const inv = useInventory(profileId);

  const result = useMemo(() => {
    if (!game) return null;
    try {
      if (mode === "character" && charId) return { ...planCharacter(game, charId, owned?.find((o) => o.charId === charId) ?? null, target), label: characterDisplayName(game.characters[charId]) };
      const lc = lcs?.find((l) => l.uid === lcUid);
      if (mode === "lightcone" && lc) return { totals: planLightCone(game, lc.lcId, lc.ascension, Math.max(lc.ascension, lcTo)), blocked: [], notes: ["Light Cone EXP materials are not included."], label: game.lightCones[lc.lcId]?.name ?? lc.lcId };
    } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
    return null;
  }, [game, mode, charId, owned, target, lcs, lcUid, lcTo]);

  const planTotals = useMemo(() => {
    if (!game || !plans) return [] as { plan: SavedPlan; totals: MaterialTotals }[];
    return plans.map((p) => {
      try {
        if (p.kind === "character") return { plan: p, totals: planCharacter(game, p.targetId, owned?.find((o) => o.charId === p.targetId) ?? null, p.target ?? FULL_TARGET).totals };
        const lc = lcs?.find((l) => l.uid === p.targetId);
        return { plan: p, totals: lc ? planLightCone(game, lc.lcId, lc.ascension, Math.max(lc.ascension, p.lcTo ?? 6)) : new Map() };
      } catch { return { plan: p, totals: new Map() }; }
    });
  }, [game, plans, owned, lcs]);

  if (!game) return (<><PageHeader title="Materials & Farming" /><WolfComment comment={noGameData()} /></>);
  if (!owned || !lcs || !plans) return <Loading />;

  const savePlan = async () => {
    if (!result || "error" in result) return;
    const p: SavedPlan = mode === "character"
      ? { id: newId("plan"), kind: "character", targetId: charId, label: result.label, target, priority, createdAt: nowIso() }
      : { id: newId("plan"), kind: "lightcone", targetId: lcUid, label: result.label, lcTo, priority, createdAt: nowIso() };
    await kvSet(`materialPlans:${profileId}`, [...plans, p]);
    setTab("planner");
  };
  const all = mergeTotals(...planTotals.map((p) => p.totals));
  const allRows = compareWithInventory(all, inv);
  const wolf = materialsComment(compareWithInventory(result && !("error" in result) ? result.totals : all, inv).map((r) => ({ name: game.items[r.id]?.name ?? r.id, missing: r.missing })));

  return (
    <div>
      <PageHeader title="Materials & Farming" subtitle="Ascension and trace costs from the game's own tables, compared with your inventory." />
      <WolfComment comment={wolf} className="mb-5" />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "calculator", label: "Calculator" }, { id: "planner", label: `Farming plan (${plans.length})` }, { id: "inventory", label: "Inventory" }]} />

      {tab === "calculator" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
          <Panel title="Target">
            <div className="grid gap-3">
              <Field label="Upgrade"><select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="character">Character</option><option value="lightcone">Owned Light Cone</option></select></Field>
              {mode === "character" ? (
                <>
                  <Field label="Character" hint="Owned characters start from their recorded progress."><select value={charId} onChange={(e) => setCharId(e.target.value)}>
                    <option value="">Choose…</option>
                    <optgroup label="Owned">{owned.map((o) => <option key={o.charId} value={o.charId}>{game.characters[o.charId] ? characterDisplayName(game.characters[o.charId]) : o.charId}</option>)}</optgroup>
                    <optgroup label="All">{playableCharacters(game).filter((c) => !owned.some((o) => o.charId === c.id)).map((c) => <option key={c.id} value={c.id}>{characterDisplayName(c)}</option>)}</optgroup>
                  </select></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Ascension"><NumberInput min={0} max={6} value={target.ascension} onChange={(v) => setTarget({ ...target, ascension: v })} /></Field>
                    <Field label="Basic ATK"><NumberInput min={1} max={6} value={target.basic} onChange={(v) => setTarget({ ...target, basic: v })} /></Field>
                    <Field label="Skill"><NumberInput min={1} max={10} value={target.skill} onChange={(v) => setTarget({ ...target, skill: v })} /></Field>
                    <Field label="Ultimate"><NumberInput min={1} max={10} value={target.ult} onChange={(v) => setTarget({ ...target, ult: v })} /></Field>
                    <Field label="Talent"><NumberInput min={1} max={10} value={target.talent} onChange={(v) => setTarget({ ...target, talent: v })} /></Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={target.unlockAllTraces} onChange={(e) => setTarget({ ...target, unlockAllTraces: e.target.checked })} /> Unlock all major & stat traces</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={target.extrasMax} onChange={(e) => setTarget({ ...target, extrasMax: e.target.checked })} /> Max extra skills (memosprite / Elation)</label>
                </>
              ) : (
                <>
                  <Field label="Light Cone"><select value={lcUid} onChange={(e) => setLcUid(e.target.value)}><option value="">Choose…</option>{lcs.map((l) => <option key={l.uid} value={l.uid}>{game.lightCones[l.lcId]?.name ?? l.lcId} · A{l.ascension}</option>)}</select></Field>
                  <Field label="Target ascension"><NumberInput min={0} max={6} value={lcTo} onChange={setLcTo} /></Field>
                </>
              )}
              <Field label="Plan priority"><select value={priority} onChange={(e) => setPriority(Number(e.target.value))}>{PRIORITY_LABEL.map((l, i) => <option key={l} value={i}>{i + 1}. {l}</option>)}</select></Field>
              <Button variant="primary" onClick={savePlan} disabled={!result || "error" in result}><Bookmark size={15} /> Add to farming plan</Button>
            </div>
          </Panel>
          <Panel title={result && !("error" in result) ? `Requirements — ${result.label}` : "Requirements"}>
            {!result ? <Empty title="Choose a target" /> : "error" in result ? <Notice tone="warn">{result.error}</Notice> : (
              <div className="space-y-3">
                {result.blocked.length > 0 && <Notice tone="warn">Some traces need a higher ascension than the target: {result.blocked.map((b) => `${b.name} (A${b.needsAscension})`).join(", ")}.</Notice>}
                <MaterialTable totals={result.totals} />
                <ul className="list-disc pl-4 text-xs text-muted">{result.notes.map((n) => <li key={n}>{n}</li>)}<li>Trailblaze Power per material is not calculated: drop rates are not in the data source.</li></ul>
              </div>
            )}
          </Panel>
        </div>
      )}

      {tab === "planner" && (
        <div className="space-y-5">
          {!plans.length ? <Empty title="No saved plans">Use the calculator and “Add to farming plan”.</Empty> : (
            <>
              <Panel title="Plan queue (priority order)">
                <ul className="space-y-2">
                  {[...planTotals].sort((a, b) => a.plan.priority - b.plan.priority).map(({ plan, totals }) => {
                    const missing = compareWithInventory(totals, inv).filter((r) => r.missing > 0);
                    return (
                      <li key={plan.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                        <Badge tone="violet">P{plan.priority + 1}</Badge>
                        <span className="min-w-0 flex-1 truncate">{plan.label} <span className="text-xs text-muted">· {PRIORITY_LABEL[plan.priority]}</span></span>
                        <Badge tone={missing.length ? "warn" : "ok"}>{missing.length ? `${missing.length} short` : "ready"}</Badge>
                        <Button size="sm" variant="ghost" onClick={async () => { if (confirmAction(`Remove plan "${plan.label}"?`)) await kvSet(`materialPlans:${profileId}`, plans.filter((p) => p.id !== plan.id)); }} aria-label="Remove plan"><Trash2 size={13} /></Button>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
              <Panel title="What to farm (all plans combined)">
                <MaterialTable totals={all} />
              </Panel>
              <Panel title="Weekly rhythm">
                <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
                  <li>Daily: spend Trailblaze Power on the first plan in the queue with missing materials ({allRows.find((r) => r.missing) ? game.items[allRows.find((r) => r.missing)!.id]?.name : "none missing"}).</li>
                  <li>Weekly: Echo of War has a limited number of discounted runs per week; use them for boss materials in your queue.</li>
                  <li>Limited-time events marked in Events take priority over everything else (priority 1).</li>
                </ul>
                <p className="mt-2 text-xs text-faint">A day-by-day calendar needs stage drop rates, which no connected source provides.</p>
              </Panel>
            </>
          )}
        </div>
      )}

      {tab === "inventory" && (
        <Panel title="Material inventory">
          <p className="mb-3 text-sm text-muted">Counts you enter are used by every calculator. Only materials used for upgrades are listed; search to find others.</p>
          <InventoryEditor inv={inv} />
        </Panel>
      )}
    </div>
  );
}

function InventoryEditor({ inv }: { inv: Record<string, number> }) {
  const { game, profileId } = useApp();
  const [q, setQ] = useState("");
  if (!game) return null;
  const items = Object.values(game.items).filter((i) => i.type === "Material" && ["Material", "TracePath", "CommonMonsterDrop", "AvatarRank", "Eidolon"].includes(i.sub_type) || i.id === "2");
  const list = items.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (inv[b.id] ?? 0) - (inv[a.id] ?? 0) || b.rarity - a.rarity).slice(0, 120);
  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search materials" aria-label="Search materials" className="mb-3 w-full sm:w-72" />
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((i) => (
          <li key={i.id} className="flex items-center gap-2 rounded-lg border border-line p-2">
            <GameImage path={i.icon} alt={i.name} className="h-8 w-8 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm">{i.name}</span>
            <div className="w-24"><NumberInput min={0} value={inv[i.id] ?? 0} onChange={(v) => setStock(profileId, i.id, v)} aria-label={`Owned ${i.name}`} /></div>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function MaterialsPage() {
  return <Suspense fallback={<Loading />}><Inner /></Suspense>;
}
