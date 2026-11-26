"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { GameImage } from "@/components/GameImage";
import { RelicCard, VERDICT_TONE } from "@/components/RelicCard";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, confirmAction, Empty, ErrorBox, Field, Loading, Modal, Notice, NumberInput, PageHeader, Panel, Tabs } from "@/components/ui";
import { noGameData, relicComment, relicInventoryComment } from "@/lib/companion/comments";
import { pick, SW } from "@/lib/companion/voice";
import { getDb, newId, nowIso } from "@/lib/db";
import { characterDisplayName, stripMarkup } from "@/lib/gamedata/types";
import { useRelicProfiles } from "@/lib/hooks";
import { PROFILE_TEMPLATES, scoreRelic, type ScoringProfile } from "@/lib/relics/scoring";
import { MAIN_STATS_BY_SLOT, RELIC_SLOTS, SLOT_LABEL, SUB_STATS, type MainStatKey, type RelicSlot, type SubStatKey } from "@/lib/relics/stats";
import { useApp } from "@/lib/store";
import { profileFor } from "@/lib/summary";
import type { Relic } from "@/lib/types";
import { fribbelsBuild } from "@/lib/builds/fribbels";
import { charHref } from "@/lib/links";

type Tab = "inventory" | "best" | "profiles" | "sets";
const isPlanar = (setId: string) => Number(setId) >= 300;

function RelicForm({ initial, onClose }: { initial: Relic | null; onClose: () => void }) {
  const { game, profileId } = useApp();
  const owned = useLiveQuery(() => getDb().characters.where("profileId").equals(profileId).toArray(), [profileId]);
  const [r, setR] = useState<Relic>(initial ?? { uid: newId("relic"), profileId, setId: Object.keys(game?.relicSets ?? {})[0] ?? "", slot: "HEAD", rarity: 5, level: 0, mainStat: "HP", substats: [], location: "", lock: false, source: "manual", updatedAt: nowIso() });
  const [err, setErr] = useState<string | null>(null);
  const sets = Object.values(game?.relicSets ?? {}).filter((s) => (r.slot === "NECK" || r.slot === "OBJECT") === isPlanar(s.id));
  const save = async () => {
    if (!MAIN_STATS_BY_SLOT[r.slot].includes(r.mainStat)) return setErr(`${r.mainStat} is not a valid main stat for ${SLOT_LABEL[r.slot]}.`);
    if (r.substats.length > 4) return setErr("At most 4 substats.");
    if (new Set(r.substats.map((s) => s.key)).size !== r.substats.length) return setErr("Substats must be different.");
    if (r.substats.some((s) => s.key === r.mainStat)) return setErr("A substat cannot repeat the main stat.");
    if (r.substats.some((s) => !(s.value > 0))) return setErr("Substat values must be positive.");
    await getDb().relics.put({ ...r, source: "manual", updatedAt: nowIso() });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={initial ? "Edit relic" : "Add relic"}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Slot"><select value={r.slot} onChange={(e) => { const slot = e.target.value as RelicSlot; setR({ ...r, slot, mainStat: MAIN_STATS_BY_SLOT[slot][0], setId: "" }); }}>{RELIC_SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}</select></Field>
        <Field label="Set"><select value={r.setId} onChange={(e) => setR({ ...r, setId: e.target.value })}><option value="">Choose…</option>{sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Rarity"><select value={r.rarity} onChange={(e) => setR({ ...r, rarity: Number(e.target.value) as Relic["rarity"] })}>{[5, 4, 3, 2].map((n) => <option key={n} value={n}>{n}★</option>)}</select></Field>
        <Field label="Level"><NumberInput min={0} max={15} value={r.level} onChange={(v) => setR({ ...r, level: v })} /></Field>
        <Field label="Main stat" className="col-span-2"><select value={r.mainStat} onChange={(e) => setR({ ...r, mainStat: e.target.value as MainStatKey })}>{MAIN_STATS_BY_SLOT[r.slot].map((m) => <option key={m}>{m}</option>)}</select></Field>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="col-span-2 grid grid-cols-[1fr_100px] gap-2">
            <select aria-label={`Substat ${i + 1}`} value={r.substats[i]?.key ?? ""} onChange={(e) => {
              const subs = [...r.substats];
              if (!e.target.value) subs.splice(i, 1); else subs[i] = { key: e.target.value as SubStatKey, value: subs[i]?.value ?? 0 };
              setR({ ...r, substats: subs.filter(Boolean) });
            }}>
              <option value="">(none)</option>{SUB_STATS.map((s) => <option key={s}>{s}</option>)}
            </select>
            <input aria-label={`Substat ${i + 1} value`} type="number" step="0.1" value={r.substats[i]?.value ?? ""} disabled={!r.substats[i]} onChange={(e) => { const subs = [...r.substats]; subs[i] = { ...subs[i], value: Number(e.target.value) }; setR({ ...r, substats: subs }); }} />
          </div>
        ))}
        <Field label="Equipped by" className="col-span-2"><select value={r.location} onChange={(e) => setR({ ...r, location: e.target.value })}><option value="">Nobody</option>{(owned ?? []).map((o) => <option key={o.charId} value={o.charId}>{game?.characters[o.charId] ? characterDisplayName(game.characters[o.charId]) : o.charId}</option>)}</select></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={r.lock} onChange={(e) => setR({ ...r, lock: e.target.checked })} /> Locked</label>
      </div>
      <p className="mt-2 text-[11px] text-faint">Percent values as shown in game (5.8 = 5.8%).</p>
      {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
      <div className="mt-4 flex justify-between">
        {initial ? <Button variant="danger" onClick={async () => { if (confirmAction("Delete this relic?")) { await getDb().relics.delete(r.uid); onClose(); } }}><Trash2 size={14} /> Delete</Button> : <span />}
        <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={!r.setId}>Save</Button></div>
      </div>
    </Modal>
  );
}

function ProfileEditor({ charId }: { charId: string }) {
  const { game, profileId } = useApp();
  const saved = useRelicProfiles(profileId);
  const current = profileFor(charId, game, saved);
  const [p, setP] = useState<ScoringProfile>(current);
  const [dirty, setDirty] = useState(false);
  const update = (patch: Partial<ScoringProfile>) => { setP({ ...p, ...patch, origin: "user" }); setDirty(true); };
  const save = async () => { await getDb().relicProfiles.put({ key: `${profileId}:${charId}`, profileId, charId, profile: { ...p, origin: "user" } }); setDirty(false); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Start from template">
          <select value="" onChange={(e) => { const t = PROFILE_TEMPLATES.find((x) => x.id === e.target.value); if (t) { setP({ ...t, id: `user-${charId}`, origin: "user", templateId: t.id }); setDirty(true); } }}>
            <option value="">Choose…</option>{PROFILE_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Badge tone={p.origin === "template" ? "warn" : "ok"}>{p.origin === "template" ? "template — not character-specific" : "your profile"}</Badge>
        <Button variant="primary" size="sm" onClick={save} disabled={!dirty}>Save profile</Button>
        {saved[charId] && <Button size="sm" variant="ghost" onClick={async () => { await getDb().relicProfiles.delete(`${profileId}:${charId}`); setP(profileFor(charId, game, {})); }}>Reset</Button>}
      </div>
      {p.origin === "template" && <WolfComment comment={{ mood: "alert", line: pick(SW.relicTemplate, charId), facts: [`Using "${p.name}", suggested from this character's Path. Check a build guide and adjust.`] }} />}
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {SUB_STATS.map((k) => (
          <label key={k} className="grid grid-cols-[110px_1fr_36px] items-center gap-2 text-sm">
            <span className="truncate text-muted">{k}</span>
            <input type="range" min={0} max={1} step={0.05} value={p.weights[k] ?? 0} onChange={(e) => update({ weights: { ...p.weights, [k]: Number(e.target.value) } })} aria-label={`${k} weight`} />
            <span className="font-mono text-xs">{(p.weights[k] ?? 0).toFixed(2)}</span>
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(["BODY", "FOOT", "NECK", "OBJECT"] as RelicSlot[]).map((slot) => (
          <fieldset key={slot} className="rounded-lg border border-line p-2.5">
            <legend className="px-1 font-mono text-[10px] uppercase tracking-wider text-faint">{SLOT_LABEL[slot]} main stats</legend>
            {MAIN_STATS_BY_SLOT[slot].map((m) => {
              const list = p.mainStats[slot] ?? [];
              return (
                <label key={m} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={list.includes(m)} onChange={(e) => update({ mainStats: { ...p.mainStats, [slot]: e.target.checked ? [...list, m] : list.filter((x) => x !== m) } })} /> {m}
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
      <Notice>
        <strong>How scores work:</strong> each substat is converted to <em>rolls</em> (value ÷ the maximum single roll for that rarity), multiplied by your weight, and summed.
        The score is that sum ÷ the best possible sum for the slot (4 best-weighted lines + every upgrade on the top stat) × 100.
        Relics below +15 are judged on their expected score at +15 (average roll 90%, upgrades spread evenly). A main stat not ticked above marks the relic as fodder.
      </Notice>
    </div>
  );
}

function Inner() {
  const params = useSearchParams();
  const { game, profileId } = useApp();
  const [tab, setTab] = useState<Tab>(() => {
    const t = params.get("tab");
    if (t === "inventory" || t === "best" || t === "profiles" || t === "sets") return t;
    return params.get("char") ? "profiles" : "inventory";
  });
  const relics = useLiveQuery(() => getDb().relics.where("profileId").equals(profileId).toArray(), [profileId]);
  const owned = useLiveQuery(() => getDb().characters.where("profileId").equals(profileId).toArray(), [profileId]);
  const saved = useRelicProfiles(profileId);
  const [charId, setCharId] = useState(params.get("char") ?? "");
  const [slot, setSlot] = useState<RelicSlot | "">("");
  const [setFilter, setSetFilter] = useState("");
  const [verdict, setVerdict] = useState("");
  const [equip, setEquip] = useState<"" | "equipped" | "free">("");
  const [editing, setEditing] = useState<Relic | null | "new">(null);
  const [setQuery, setSetQuery] = useState("");
  // No relics yet? Open on the set database instead of an empty inventory.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !relics) return;
    opened.current = true;
    if (!relics.length && !params.get("char") && !params.get("tab")) setTab("sets");
  }, [relics, params]);
  const usersOfSet = useMemo(() => {
    const m = new Map<string, string[]>();
    if (!game) return m;
    for (const c of Object.values(game.characters)) {
      const b = fribbelsBuild(c.id);
      if (!b) continue;
      for (const name of [...(b.relicSets ?? []).flat(), ...(b.ornamentSets ?? [])]) {
        const set = Object.values(game.relicSets).find((x) => x.name === name);
        if (set && !(m.get(set.id) ?? []).includes(c.id)) m.set(set.id, [...(m.get(set.id) ?? []), c.id]);
      }
    }
    return m;
  }, [game]);

  const name = (id: string) => (game?.characters[id] ? characterDisplayName(game.characters[id]) : id);
  const scored = useMemo(() => (relics ?? []).map((r) => {
    const target = charId || r.location;
    const profile = target ? profileFor(target, game, saved) : PROFILE_TEMPLATES[0];
    return { r, s: scoreRelic(r, profile), profile };
  }), [relics, charId, game, saved]);

  if (!game) return (<><PageHeader title="Relic Sets" /><WolfComment comment={noGameData()} /></>);
  if (!relics || !owned) return <Loading />;

  const filtered = scored
    .filter(({ r }) => !slot || r.slot === slot)
    .filter(({ r }) => !setFilter || r.setId === setFilter)
    .filter(({ s }) => !verdict || s.verdict === verdict)
    .filter(({ r }) => !equip || (equip === "equipped") === !!r.location)
    .sort((a, b) => b.s.score - a.s.score);
  const keep = scored.filter((x) => x.s.verdict === "keep").length;
  const fodder = scored.filter((x) => x.s.verdict === "fodder").length;

  const charSelect = (
    <select value={charId} onChange={(e) => setCharId(e.target.value)} aria-label="Grade for character">
      <option value="">{tab === "inventory" ? "Grade each relic for its wearer" : "Choose a character"}</option>
      {owned.map((o) => <option key={o.charId} value={o.charId}>{name(o.charId)}</option>)}
    </select>
  );

  return (
    <div>
      <PageHeader title="Relic Sets" subtitle="Every set, your relics and their grades." actions={<Button variant="primary" size="sm" onClick={() => setEditing("new")}><Plus size={14} /> Add relic</Button>} />
      <WolfComment comment={relicInventoryComment(relics.length, keep, fodder)} className="mb-5" />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "inventory", label: `Inventory (${relics.length})` }, { id: "best", label: "Best available" }, { id: "profiles", label: "Scoring profiles" }, { id: "sets", label: `Sets (${Object.keys(game.relicSets).length})` }]} />

      {tab === "inventory" && (
        <>
          <Panel className="mb-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {charSelect}
              <select value={slot} onChange={(e) => setSlot(e.target.value as RelicSlot | "")} aria-label="Slot"><option value="">All slots</option>{RELIC_SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}</select>
              <select value={setFilter} onChange={(e) => setSetFilter(e.target.value)} aria-label="Set"><option value="">All sets</option>{Object.values(game.relicSets).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <select value={verdict} onChange={(e) => setVerdict(e.target.value)} aria-label="Verdict"><option value="">Any verdict</option>{Object.keys(VERDICT_TONE).map((v) => <option key={v}>{v}</option>)}</select>
              <select value={equip} onChange={(e) => setEquip(e.target.value as typeof equip)} aria-label="Equipped"><option value="">Equipped & free</option><option value="equipped">Equipped</option><option value="free">Unequipped</option></select>
            </div>
          </Panel>
          {!relics.length ? <Empty title="No relics">Import an HSR Scanner file in the Import Center, or add relics by hand.</Empty> : !filtered.length ? <Empty title="No matches" /> : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.slice(0, 200).map(({ r, s }) => <li key={r.uid}><RelicCard relic={r} setName={game.relicSets[r.setId]?.name ?? r.setId} ownerName={r.location ? name(r.location) : undefined} score={s} onClick={() => setEditing(r)} /></li>)}
            </ul>
          )}
          {filtered.length > 200 && <p className="mt-2 text-xs text-muted">Showing the top 200 of {filtered.length}. Narrow the filters to see more.</p>}
        </>
      )}

      {tab === "best" && (
        <div className="space-y-4">
          <Panel>{charSelect}</Panel>
          {!charId ? <Empty title="Choose a character">The best relic in each slot is picked from your whole inventory using that character&apos;s profile.</Empty> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {RELIC_SLOTS.map((sl) => {
                const best = scored.filter(({ r, s }) => r.slot === sl && s.mainStatFits).sort((a, b) => b.s.expectedAtMax - a.s.expectedAtMax).slice(0, 3);
                return (
                  <Panel key={sl} title={SLOT_LABEL[sl]}>
                    {!best.length ? <p className="text-sm text-muted">No relic with a fitting main stat.</p> : (
                      <ol className="space-y-2">
                        {best.map(({ r, s }, i) => (
                          <li key={r.uid} className="rounded-lg border border-line p-2 text-xs">
                            <div className="flex justify-between gap-2"><span className="truncate">{i + 1}. {game.relicSets[r.setId]?.name}</span><Badge tone={VERDICT_TONE[s.verdict]}>{s.score.toFixed(0)}</Badge></div>
                            <div className="text-muted">+{r.level} {r.mainStat} · {r.location ? (r.location === charId ? "already equipped" : `on ${name(r.location)}`) : "free"}</div>
                          </li>
                        ))}
                      </ol>
                    )}
                    {best[0] && <WolfComment comment={relicComment(best[0].s, best[0].profile.origin === "template")} className="mt-3 !p-2" />}
                  </Panel>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted">Set bonuses are not optimised jointly yet: picks are per slot. Use the set filter in Inventory to compare a specific 4-piece.</p>
        </div>
      )}

      {tab === "profiles" && (
        <Panel title="Character scoring profile" actions={charSelect}>
          {charId ? <ProfileEditor key={charId} charId={charId} /> : <Empty title="Choose a character">Each character gets their own weights. A single universal formula would grade a Break DPS and a healer the same way, so none is used.</Empty>}
        </Panel>
      )}

      {tab === "sets" && (
        <>
          <input value={setQuery} onChange={(e) => setSetQuery(e.target.value)} placeholder="Search sets or effects" aria-label="Search sets" className="mb-4 w-full sm:w-80" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Object.values(game.relicSets).filter((s) => !setQuery || (s.name + s.desc.join(" ")).toLowerCase().includes(setQuery.toLowerCase())).map((s) => {
              const users = [...new Set(relics.filter((r) => r.setId === s.id && r.location).map((r) => r.location))];
              return (
                <Panel key={s.id}>
                  <div className="flex gap-3">
                    <GameImage path={s.icon} alt={s.name} className="h-12 w-12 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium">{s.name}</div>
                      <Badge tone={isPlanar(s.id) ? "cyan" : "violet"}>{isPlanar(s.id) ? "Planar Ornament" : "Cavern Relic"}</Badge>
                    </div>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-muted">
                    {s.desc.map((d, i) => <li key={i}><span className="font-mono text-[11px] text-cyan">{i === 0 ? "2pc" : "4pc"}</span> {stripMarkup(d)}</li>)}
                  </ul>
                  {(usersOfSet.get(s.id) ?? []).length > 0 && (
                    <div className="mt-2">
                      <div className="mb-1 text-[11px] text-faint">Recommended for (Fribbels)</div>
                      <div className="flex flex-wrap gap-1">{(usersOfSet.get(s.id) ?? []).slice(0, 10).map((id) => (
                        <Link key={id} href={charHref(id)} title={name(id)}><GameImage path={game.characters[id]?.icon} alt={name(id)} className="h-8 w-8" rounded="rounded-full" /></Link>
                      ))}</div>
                    </div>
                  )}
                  <div className="mt-2 text-xs text-faint">{users.length ? `Worn by: ${users.map(name).join(", ")}` : `Owned pieces: ${relics.filter((r) => r.setId === s.id).length}`}</div>
                </Panel>
              );
            })}
          </div>
        </>
      )}
      {editing && <RelicForm initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

export default function RelicsPage() {
  return <Suspense fallback={<Loading />}><Inner /></Suspense>;
}
