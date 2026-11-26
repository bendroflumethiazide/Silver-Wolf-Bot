"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { buildComment } from "@/lib/companion/comments";
import { getDb, kvGet, kvSet, newId, nowIso } from "@/lib/db";
import { evaluateBuild, type SlotResult } from "@/lib/builds/evaluate";
import { recommendBuild, type SavedBuild } from "@/lib/builds/recommend";
import { RecommendedBuild } from "./RecommendedBuild";
import { computeStats, mainStatValue, SLOT_INDEX } from "@/lib/builds/stats";
import { characterDisplayName } from "@/lib/gamedata/types";
import { useRelicProfiles } from "@/lib/hooks";
import { formatStat, isPercentStat, MAIN_STATS_BY_SLOT, SLOT_LABEL, SUBSTAT_MAX_ROLL } from "@/lib/relics/stats";
import { useApp } from "@/lib/store";
import { profileFor } from "@/lib/summary";
import type { OwnedCharacter } from "@/lib/types";
import { GameImage } from "./GameImage";
import { GradeTag } from "./GradeTag";
import { WolfComment } from "./SilverWolf";
import { Badge, Button, confirmAction, Empty, ErrorBox, Field, Modal, Notice, Panel, Stars } from "./ui";

/** Approximate number of rolls a substat received (each roll is 80–100% of the max; 90% average). */
const rollsOf = (key: keyof (typeof SUBSTAT_MAX_ROLL)[5], value: number, rarity: 2 | 3 | 4 | 5) => Math.max(1, Math.round(value / (0.9 * SUBSTAT_MAX_ROLL[rarity][key])));

function RelicSlotCard({ s }: { s: SlotResult }) {
  const { game } = useApp();
  if (!s.relic || !s.score) return (
    <div className="glass flex min-h-[200px] flex-col items-center justify-center gap-1 p-3 text-center text-xs text-muted">
      <span className="font-mono uppercase tracking-wider text-faint">{SLOT_LABEL[s.slot]}</span>Empty slot
    </div>
  );
  const r = s.relic;
  const icon = game ? Object.values(game.relics).find((x) => x.set_id === r.setId && x.type === r.slot && x.rarity === r.rarity)?.icon : undefined;
  const mv = game ? mainStatValue(game, r) : null;
  return (
    <div className={`glass rarity-border rarity-${r.rarity} flex flex-col p-3`}>
      <div className="flex items-center gap-2">
        <GameImage path={icon} alt={`${game?.relicSets[r.setId]?.name ?? r.setId} ${SLOT_LABEL[r.slot]}`} className="h-11 w-11 shrink-0" fallback={SLOT_LABEL[r.slot]} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] text-muted">{game?.relicSets[r.setId]?.name ?? r.setId}</div>
          <div className="text-xs text-faint">{SLOT_LABEL[r.slot]} · +{r.level}</div>
        </div>
      </div>
      <div className={`mt-2 flex justify-between text-sm font-semibold ${s.score.mainStatFits ? "text-text" : "text-bad"}`}>
        <span>{r.mainStat}</span><span className="font-mono">{mv === null ? "—" : formatStat(r.mainStat, isPercentStat(r.mainStat) ? mv * 100 : mv)}</span>
      </div>
      <ul className="mt-2 flex-1 space-y-1 border-t border-line pt-2 text-xs">
        {s.score.breakdown.map((b) => {
          const n = rollsOf(b.key, b.value, r.rarity);
          return (
            <li key={b.key} className="flex items-center justify-between gap-2">
              <span className={b.weight > 0 ? "text-text" : "text-faint"}>{b.key}</span>
              <span className="flex items-center gap-2 font-mono">
                <span className="text-[10px] text-violet" title={`≈${n} roll(s)`}>{"›".repeat(Math.max(0, n - 1))}</span>
                <span className={b.weight > 0 ? "text-text" : "text-muted"}>{formatStat(b.key, b.value)}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-xs">
        <span className="text-muted">Score</span>
        <span className="flex items-baseline gap-1.5"><span className="font-mono text-text">{s.effective.toFixed(1)}</span><GradeTag g={s.grade} /></span>
      </div>
    </div>
  );
}

function SavedBuildForm({ charId, initial, onClose }: { charId: string; initial: SavedBuild | null; onClose: () => void }) {
  const { game, profileId } = useApp();
  const [b, setB] = useState<SavedBuild>(initial ?? { id: newId("build"), name: "", cavernSets: [], mainStats: {}, substats: "", createdAt: nowIso() });
  const [err, setErr] = useState<string | null>(null);
  const key = `savedBuilds:${profileId}:${charId}`;
  const sets = Object.values(game?.relicSets ?? {});
  const save = async () => {
    if (!b.name.trim()) return setErr("Name the build (e.g. “Main DPS — guide name”).");
    if (b.sourceUrl && !/^https?:\/\//.test(b.sourceUrl)) return setErr("Source must be an http(s) link.");
    const list = await kvGet<SavedBuild[]>(key, []);
    await kvSet(key, [...list.filter((x) => x.id !== b.id), b]);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={initial ? "Edit saved build" : "Save a recommended build"} wide>
      <p className="mb-3 text-sm text-muted">Copy a build from a guide you trust. Add the link so you can check it again after patches.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Build name"><input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} /></Field>
        <Field label="Source (guide / creator)"><input value={b.source ?? ""} onChange={(e) => setB({ ...b, source: e.target.value })} /></Field>
        <Field label="Source URL" className="sm:col-span-2"><input type="url" value={b.sourceUrl ?? ""} onChange={(e) => setB({ ...b, sourceUrl: e.target.value || undefined })} /></Field>
        <Field label="Light Cone"><input value={b.lightCone ?? ""} onChange={(e) => setB({ ...b, lightCone: e.target.value })} list="lc-names" /></Field>
        <datalist id="lc-names">{Object.values(game?.lightCones ?? {}).map((l) => <option key={l.id} value={l.name} />)}</datalist>
        <Field label="Planar Ornament set"><select value={b.planarSet ?? ""} onChange={(e) => setB({ ...b, planarSet: e.target.value || undefined })}><option value="">—</option>{sets.filter((s) => Number(s.id) >= 300).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        {[0, 1].map((i) => (
          <Field key={i} label={i ? "Cavern set (2pc, for 2+2)" : "Cavern set (4pc or first 2pc)"}>
            <select value={b.cavernSets[i] ?? ""} onChange={(e) => { const c = [...b.cavernSets]; c[i] = e.target.value; setB({ ...b, cavernSets: c.filter(Boolean) }); }}>
              <option value="">—</option>{sets.filter((s) => Number(s.id) < 300).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        ))}
        {(["BODY", "FOOT", "NECK", "OBJECT"] as const).map((slot) => (
          <Field key={slot} label={`${SLOT_LABEL[slot]} main`}>
            <select value={b.mainStats[slot] ?? ""} onChange={(e) => setB({ ...b, mainStats: { ...b.mainStats, [slot]: e.target.value || undefined } })}>
              <option value="">—</option>{MAIN_STATS_BY_SLOT[slot].map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
        ))}
        <Field label="Substat priority" className="sm:col-span-2"><input value={b.substats} onChange={(e) => setB({ ...b, substats: e.target.value })} placeholder="SPD > CRIT Rate = CRIT DMG > ATK%" /></Field>
        <Field label="Notes" className="sm:col-span-2"><textarea rows={2} value={b.notes ?? ""} onChange={(e) => setB({ ...b, notes: e.target.value })} /></Field>
      </div>
      {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
      <div className="mt-4 flex justify-between">
        {initial ? <Button variant="danger" onClick={async () => { if (!confirmAction("Delete this saved build?")) return; const list = await kvGet<SavedBuild[]>(key, []); await kvSet(key, list.filter((x) => x.id !== b.id)); onClose(); }}><Trash2 size={14} /> Delete</Button> : <span />}
        <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></div>
      </div>
    </Modal>
  );
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export function BuildCard({ charId, owned }: { charId: string; owned: OwnedCharacter }) {
  const { game, profileId } = useApp();
  const relics = useLiveQuery(() => getDb().relics.where("location").equals(charId).filter((r) => r.profileId === profileId).toArray(), [profileId, charId]);
  const lcs = useLiveQuery(() => getDb().lightCones.where("location").equals(charId).filter((l) => l.profileId === profileId).toArray(), [profileId, charId]);
  const inventory = useLiveQuery(async () => ({ relics: await getDb().relics.where("profileId").equals(profileId).toArray(), lightCones: await getDb().lightCones.where("profileId").equals(profileId).toArray() }), [profileId]);
  const saved = useLiveQuery(() => kvGet<SavedBuild[]>(`savedBuilds:${profileId}:${charId}`, []), [profileId, charId]);
  const profiles = useRelicProfiles(profileId);
  const [editing, setEditing] = useState<SavedBuild | null | "new">(null);

  const data = useMemo(() => {
    if (!game || !relics || !lcs) return null;
    const lc = lcs[0] ?? null;
    const profile = profileFor(charId, game, profiles);
    const stats = computeStats(game, owned, lc, relics);
    return { lc, profile, stats, evaluation: evaluateBuild(game, owned, relics, profile, stats, lc) };
  }, [game, relics, lcs, charId, owned, profiles]);
  const rec = useMemo(() => (game && data && inventory ? recommendBuild(game, charId, data.profile, inventory) : null), [game, data, inventory, charId]);

  if (!game || !data || !rec || !saved) return null;
  const { lc, profile, stats, evaluation: e } = data;
  const c = game.characters[charId];
  const lcData = lc ? game.lightCones[lc.lcId] : null;
  const element = c.element === "Thunder" ? "Lightning" : c.element;
  const rows: [string, string][] = [
    ["HP", stats.hp.toFixed(0)], ["ATK", stats.atk.toFixed(0)], ["DEF", stats.def.toFixed(0)], ["SPD", stats.spd.toFixed(1)],
    ["CRIT Rate", pct(stats.critRate)], ["CRIT DMG", pct(stats.critDmg)], ["Effect Hit Rate", pct(stats.ehr)], ["Effect RES", pct(stats.res)],
    ["Break Effect", pct(stats.be)], ["Energy Regen", pct(stats.err)], [`${element} DMG`, pct((stats.dmg[c.element] ?? 0) + (stats.dmg.All ?? 0))],
    ...(stats.ohb ? [["Outgoing Healing", pct(stats.ohb)] as [string, string]] : []),
    ...Object.entries(stats.other).map(([k, v]) => [k.replace(/(AddedRatio|Base|Delta)+$/g, "").replace(/([a-z])([A-Z])/g, "$1 $2") + " (bonus)", pct(v)] as [string, string]),
  ];

  return (
    <div className="space-y-5">
      <WolfComment comment={buildComment(e)} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,280px)_1fr]">
        <div className="glass hud p-4">
          <div className="text-center">
            <Stars n={c.rarity} />
            <div className="mt-1 text-lg font-semibold">{characterDisplayName(c)}</div>
            <div className="text-xs text-muted">Lv{owned.level} · E{owned.eidolon}{lcData ? ` · ${lcData.name} S${lc!.superimposition}` : ""}</div>
          </div>
          <dl className="mt-4 space-y-1.5 text-sm">
            {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-line/40 pb-1"><dt className="text-muted">{k}</dt><dd className="font-mono">{v}</dd></div>)}
          </dl>
          <div className="mt-5 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Silver Wolf rating</div>
            <GradeTag g={e.overall.grade} size="lg" />
            <div className="font-mono text-xs text-muted">{e.overall.score.toFixed(1)} / 100</div>
          </div>
          <p className="mt-3 text-[11px] text-faint">Totals include traces, Light Cone, relic main/sub stats and always-on set bonuses. Conditional buffs aren&apos;t included.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {e.slots.map((s) => <RelicSlotCard key={s.slot} s={s} />)}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <Panel title="What this build lacks">
          {e.lacks.length ? <ol className="list-decimal space-y-1 pl-5 text-sm">{e.lacks.map((l) => <li key={l}>{l}</li>)}</ol> : <p className="text-sm text-ok">Nothing flagged.</p>}
          {e.strengths.length > 0 && <p className="mt-3 text-xs text-muted">Strong points: {e.strengths.join(" · ")}</p>}
          {e.sets.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{e.sets.map((s) => <Badge key={s.setId} tone={s.active ? "cyan" : "default"}>{s.name} ×{s.pieces}{s.active ? ` (${s.active})` : ""}</Badge>)}</div>}
          <p className="mt-3 text-[11px] text-faint">
            Grades: D, C, B, A, S, SS, SSS, WTF, each with −/+. Relic score = weighted rolls vs the best possible piece for this character&apos;s profile
            ({profile.origin === "template" ? <>generic template — <Link className="underline" href={`/relics?char=${charId}`}>set real weights</Link></> : "your weights"}). Wrong main stat halves the score; empty slot counts 0.
          </p>
        </Panel>

      </div>

      <RecommendedBuild charId={charId} rec={rec} />

      <Panel title="Saved builds from guides" actions={<Button size="sm" onClick={() => setEditing("new")}><Plus size={14} /> Save a build</Button>}>
        {!saved.length ? <Empty title="No saved builds">Add the build a guide recommends (with its link) and Silver Wolf checks your gear against it.</Empty> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {saved.map((b) => {
              const wornSets = new Set(e.sets.filter((s) => s.active).map((s) => s.setId));
              const checks: [string, boolean][] = [
                ...b.cavernSets.map((id) => [`${game.relicSets[id]?.name ?? id}`, wornSets.has(id)] as [string, boolean]),
                ...(b.planarSet ? [[game.relicSets[b.planarSet]?.name ?? b.planarSet, wornSets.has(b.planarSet)] as [string, boolean]] : []),
                ...(Object.entries(b.mainStats) as [keyof typeof SLOT_INDEX, string][]).map(([slot, m]) => [`${SLOT_LABEL[slot]}: ${m}`, e.slots.find((s) => s.slot === slot)?.relic?.mainStat === m] as [string, boolean]),
                ...(b.lightCone ? [[b.lightCone, lcData?.name === b.lightCone] as [string, boolean]] : []),
              ];
              const hit = checks.filter(([, ok]) => ok).length;
              return (
                <li key={b.id} className="rounded-xl border border-line p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <button className="text-left font-medium hover:text-cyan" onClick={() => setEditing(b)}>{b.name}</button>
                    <Badge tone={hit === checks.length && checks.length ? "ok" : "warn"}>{hit}/{checks.length} match</Badge>
                  </div>
                  {(b.source || b.sourceUrl) && <div className="text-xs text-muted">{b.source}{b.sourceUrl && <> · <a className="text-cyan hover:underline" href={b.sourceUrl} target="_blank" rel="noreferrer">source ↗</a></>}</div>}
                  <ul className="mt-2 space-y-0.5 text-xs">{checks.map(([label, ok]) => <li key={label} className={ok ? "text-ok" : "text-warn"}>{ok ? "✓" : "✗"} {label}</li>)}</ul>
                  {b.substats && <div className="mt-1 text-xs text-muted">Subs: {b.substats}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      {stats.notes.length > 0 && <Notice tone="warn">{stats.notes.join(" ")}</Notice>}
      {editing && <SavedBuildForm key={editing === "new" ? "new" : editing.id} charId={charId} initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
