"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Scale, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { GameImage } from "@/components/GameImage";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, confirmAction, cx, Empty, Field, Modal, NumberInput, PageHeader, Panel, SourceBadge, Stars, Tabs } from "@/components/ui";
import { noGameData } from "@/lib/companion/comments";
import { fill, pick, SW } from "@/lib/companion/voice";
import { getDb, newId, nowIso } from "@/lib/db";
import { statAt } from "@/lib/gamedata/stats";
import { characterDisplayName, formatSkillDesc, pathName, type SrrLightCone } from "@/lib/gamedata/types";
import { ascensionForLevel } from "@/lib/materials/calculator";
import { useApp } from "@/lib/store";
import type { OwnedLightCone } from "@/lib/types";

type Tab = "database" | "owned" | "compare";

function OwnForm({ lc, initial, onClose }: { lc: SrrLightCone; initial: OwnedLightCone | null; onClose: () => void }) {
  const { game, profileId } = useApp();
  const owned = useLiveQuery(() => getDb().characters.where("profileId").equals(profileId).toArray(), [profileId]);
  const [o, setO] = useState<OwnedLightCone>(initial ?? { uid: newId("lc"), profileId, lcId: lc.id, level: 1, ascension: 0, superimposition: 1, location: "", lock: false, source: "manual", updatedAt: nowIso() });
  return (
    <Modal open onClose={onClose} title={lc.name}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Level"><NumberInput min={1} max={80} value={o.level} onChange={(v) => setO({ ...o, level: v, ascension: Math.max(ascensionForLevel(v), Math.min(o.ascension, 6)) })} /></Field>
        <Field label="Ascension"><NumberInput min={0} max={6} value={o.ascension} onChange={(v) => setO({ ...o, ascension: v })} /></Field>
        <Field label="Superimposition"><NumberInput min={1} max={5} value={o.superimposition} onChange={(v) => setO({ ...o, superimposition: v })} /></Field>
        <Field label="Equipped by" className="col-span-3"><select value={o.location} onChange={(e) => setO({ ...o, location: e.target.value })}><option value="">Nobody</option>{(owned ?? []).map((c) => <option key={c.charId} value={c.charId}>{game?.characters[c.charId] ? characterDisplayName(game.characters[c.charId]) : c.charId}</option>)}</select></Field>
      </div>
      <div className="mt-4 flex justify-between">
        {initial ? <Button variant="danger" onClick={async () => { if (confirmAction("Remove this Light Cone?")) { await getDb().lightCones.delete(o.uid); onClose(); } }}><Trash2 size={14} /> Remove</Button> : <span />}
        <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={async () => { await getDb().lightCones.put({ ...o, source: "manual", updatedAt: nowIso() }); onClose(); }}>Save</Button></div>
      </div>
    </Modal>
  );
}

export default function LightConesPage() {
  const { game, profileId } = useApp();
  const owned = useLiveQuery(() => getDb().lightCones.where("profileId").equals(profileId).toArray(), [profileId]);
  const [tab, setTab] = useState<Tab>("database");
  const [q, setQ] = useState("");
  const [path, setPath] = useState("");
  const [rarity, setRarity] = useState(0);
  const [compare, setCompare] = useState<string[]>([]);
  const [compareLevel, setCompareLevel] = useState(80);
  const [compareS, setCompareS] = useState(1);
  const [editing, setEditing] = useState<{ lc: SrrLightCone; o: OwnedLightCone | null } | null>(null);
  const ownedCount = useMemo(() => { const m = new Map<string, number>(); for (const o of owned ?? []) m.set(o.lcId, (m.get(o.lcId) ?? 0) + 1); return m; }, [owned]);

  if (!game) return (<><PageHeader title="Light Cones" /><WolfComment comment={noGameData()} /></>);
  const list = Object.values(game.lightCones)
    .filter((l) => !q || l.name.toLowerCase().includes(q.toLowerCase()))
    .filter((l) => !path || l.path === path)
    .filter((l) => !rarity || l.rarity === rarity)
    .sort((a, b) => b.rarity - a.rarity || Number(b.id) - Number(a.id));
  const five = (owned ?? []).filter((o) => game.lightCones[o.lcId]?.rarity === 5).length;
  const name = (id: string) => (game.characters[id] ? characterDisplayName(game.characters[id]) : id);
  const toggleCompare = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 4 ? c : [...c, id]));
  const comment = owned?.length
    ? { mood: "neutral" as const, line: fill(pick(SW.lcCollection, `lc-${owned.length}`), { owned: owned.length, five }), facts: [`${owned.length} Light Cones owned, ${five} of them 5★.`, `${(owned ?? []).filter((o) => !o.location).length} unequipped.`] }
    : { mood: "bored" as const, line: pick(SW.emptyPersonal, "lc-empty"), facts: ["No Light Cones recorded on this profile."], action: { label: "Import inventory", href: "/import" } };

  return (
    <div>
      <PageHeader title="Light Cones" subtitle={`${Object.keys(game.lightCones).length} Light Cones in game data v${game.version}.`} />
      <WolfComment comment={comment} className="mb-5" />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "database", label: "Database" }, { id: "owned", label: `Owned (${owned?.length ?? 0})` }, { id: "compare", label: `Compare (${compare.length})` }]} />

      {tab === "database" && (
        <>
          <Panel className="mb-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <input className="col-span-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Light Cones" aria-label="Search Light Cones" />
              <select value={path} onChange={(e) => setPath(e.target.value)} aria-label="Path"><option value="">All Paths</option>{Object.keys(game.paths).map((p) => <option key={p} value={p}>{pathName(p)}</option>)}</select>
              <select value={rarity} onChange={(e) => setRarity(Number(e.target.value))} aria-label="Rarity"><option value={0}>All rarities</option>{[5, 4, 3].map((r) => <option key={r} value={r}>{r}★</option>)}</select>
            </div>
          </Panel>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((l) => {
              const rank = game.lightConeRanks[l.id];
              const n = ownedCount.get(l.id) ?? 0;
              return (
                <li key={l.id} className={cx("glass rarity-border p-3", `rarity-${l.rarity}`)}>
                  <div className="flex gap-3">
                    <GameImage path={l.icon} alt={l.name} className="h-16 w-16 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{l.name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted"><Stars n={l.rarity} /> {pathName(l.path)} {n > 0 && <Badge tone="ok">owned ×{n}</Badge>}</div>
                      {rank && <div className="mt-1 text-xs text-violet">{rank.skill}</div>}
                    </div>
                  </div>
                  {rank && <p className="mt-2 line-clamp-3 text-xs text-muted">{formatSkillDesc(rank.desc, rank.params, 1)}</p>}
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => setEditing({ lc: l, o: null })}><Plus size={13} /> Add owned</Button>
                    <Button size="sm" variant={compare.includes(l.id) ? "primary" : "ghost"} onClick={() => toggleCompare(l.id)} aria-pressed={compare.includes(l.id)}><Scale size={13} /> Compare</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {tab === "owned" && (!owned?.length ? <Empty title="No Light Cones">Add them from the database tab or import an HSR Scanner file.</Empty> : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {owned.map((o) => {
            const l = game.lightCones[o.lcId];
            if (!l) return <li key={o.uid} className="glass p-3 text-sm text-warn">Unknown Light Cone id {o.lcId} (not in game data v{game.version}).</li>;
            const wearer = o.location ? game.characters[o.location] : null;
            return (
              <li key={o.uid}>
                <button onClick={() => setEditing({ lc: l, o })} className={cx("glass flex w-full gap-3 rarity-border p-3 text-left hover:border-violet/50", `rarity-${l.rarity}`)}>
                  <GameImage path={l.icon} alt={l.name} className="h-14 w-14 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{l.name}</div>
                    <div className="text-xs text-muted">Lv {o.level} · S{o.superimposition} · {o.location ? `on ${name(o.location)}` : "unequipped"}</div>
                    <div className="mt-1 flex gap-1"><SourceBadge source={o.source} />{wearer && wearer.path !== l.path && <Badge tone="warn">path mismatch</Badge>}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ))}

      {tab === "compare" && (!compare.length ? <Empty title="Nothing selected">Pick up to four Light Cones with “Compare” in the database tab.</Empty> : (
        <Panel actions={
          <div className="flex items-center gap-3 text-xs text-muted">
            <label className="flex items-center gap-1">Level <NumberInput min={1} max={80} value={compareLevel} onChange={setCompareLevel} aria-label="Comparison level" /></label>
            <label className="flex items-center gap-1">S <NumberInput min={1} max={5} value={compareS} onChange={setCompareS} aria-label="Comparison superimposition" /></label>
          </div>
        }>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {compare.map((id) => {
              const l = game.lightCones[id];
              const v = game.lightConePromotions[id]?.values;
              const asc = ascensionForLevel(compareLevel);
              const rank = game.lightConeRanks[id];
              return (
                <div key={id} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{l.name}</span><button className="text-xs text-muted hover:text-bad" onClick={() => toggleCompare(id)}>remove</button></div>
                  <div className="text-xs text-muted"><Stars n={l.rarity} /> {pathName(l.path)}</div>
                  <dl className="mt-2 grid grid-cols-3 gap-1 text-center text-xs">
                    {(["hp", "atk", "def"] as const).map((k) => <div key={k} className="rounded bg-black/30 p-1"><dt className="text-faint">{k.toUpperCase()}</dt><dd className="font-mono">{statAt(v, k, compareLevel, asc)?.toFixed(0) ?? "—"}</dd></div>)}
                  </dl>
                  {rank && <p className="mt-2 text-xs text-muted"><span className="text-violet">{rank.skill}:</span> {formatSkillDesc(rank.desc, rank.params, compareS)}</p>}
                </div>
              );
            })}
          </div>
        </Panel>
      ))}
      {editing && <OwnForm key={editing.o?.uid ?? editing.lc.id} lc={editing.lc} initial={editing.o} onClose={() => setEditing(null)} />}
    </div>
  );
}
