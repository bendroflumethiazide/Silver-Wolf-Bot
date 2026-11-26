"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { BuildCard } from "@/components/BuildCard";
import { RecommendedBuildFor } from "@/components/RecommendedBuild";
import { blankOwned, CharacterEditor } from "@/components/CharacterEditor";
import { GameImage } from "@/components/GameImage";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, Empty, PageHeader, Panel, SourceBadge, Stars, Stat, Tabs } from "@/components/ui";
import { characterDetailComment, noGameData } from "@/lib/companion/comments";
import { getDb } from "@/lib/db";
import { statAt } from "@/lib/gamedata/stats";
import { characterDisplayName, elementName, formatSkillDesc, hasEnhancedKit, kitSkills, kitTrees, pathName, stripMarkup, type KitVariant } from "@/lib/gamedata/types";
import { ascensionForLevel } from "@/lib/materials/calculator";
import { useApp } from "@/lib/store";

type Tab = "build" | "overview" | "abilities" | "traces" | "eidolons";

/** Character detail (shared by /characters/view?id=… and the legacy /characters/[id] route). */
export function CharacterDetail({ id }: { id: string }) {
  const { game, profileId } = useApp();
  const [tab, setTab] = useState<Tab>("build");
  const [editing, setEditing] = useState(false);
  const [previewLevel, setPreviewLevel] = useState(80);
  const [kit, setKit] = useState<KitVariant>("original");
  const owned = useLiveQuery(() => getDb().characters.get(`${profileId}:${id}`), [profileId, id]);
  const equippedLc = useLiveQuery(() => getDb().lightCones.where("location").equals(id).filter((l) => l.profileId === profileId).toArray(), [profileId, id]);
  const equippedRelics = useLiveQuery(() => getDb().relics.where("location").equals(id).filter((r) => r.profileId === profileId).toArray(), [profileId, id]);
  const notes = useLiveQuery(() => getDb().notes.filter((n) => n.links.some((l) => l.type === "character" && l.id === id)).toArray(), [id]);
  const c = game?.characters[id];

  const skills = useMemo(() => (c && game ? kitSkills(c, kit).map((s) => game.characterSkills[s]).filter(Boolean) : []), [c, game, kit]);
  const trees = useMemo(() => (c && game ? kitTrees(c, kit).map((t) => game.characterSkillTrees[t]).filter(Boolean) : []), [c, game, kit]);
  const ranks = useMemo(() => (c && game ? c.ranks.map((r) => game.characterRanks[r]).filter(Boolean) : []), [c, game]);

  if (!game) return (<><PageHeader title="Character" /><WolfComment comment={noGameData()} /></>);
  if (!c) return (<><PageHeader title="Character not found" /><Empty title="Not in your game data">No character with id {id} in game data v{game.version}. It may be from a newer patch: update game data in Settings. <Link href="/characters" className="text-cyan">Back to Characters</Link></Empty></>);

  const name = characterDisplayName(c);
  const promo = game.characterPromotions[id]?.values;
  const level = owned?.level ?? previewLevel;
  const asc = owned?.ascension ?? ascensionForLevel(previewLevel);
  const stat = (k: string) => statAt(promo, k, level, asc);
  const lc = equippedLc?.[0];
  const lcData = lc ? game.lightCones[lc.lcId] : null;
  const lcPromo = lc ? game.lightConePromotions[lc.lcId]?.values : undefined;
  const lcStat = (k: string) => (lc ? statAt(lcPromo, k, lc.level, lc.ascension) : null);
  const skillLevel = (type: string) => {
    if (!owned) return previewLevel >= 80 ? (type === "Normal" ? 6 : 10) : 1;
    if (type === "Normal") return owned.skills.basic;
    if (type === "BPSkill") return owned.skills.skill;
    if (type === "Ultra") return owned.skills.ult;
    if (type === "Talent") return owned.skills.talent;
    return 1;
  };

  return (
    <div>
      <Link href="/characters" className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-text"><ArrowLeft size={14} /> Characters</Link>
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        <div className={`glass hud relative overflow-hidden rarity-border rarity-${c.rarity}`}>
          <GameImage path={c.portrait} alt={`${name} portrait`} className="aspect-[3/4] w-full" rounded="rounded-[13px]" fallback={name} />
        </div>
        <div className="min-w-0 space-y-4">
          <PageHeader
            title={name}
            subtitle={<span className="flex flex-wrap items-center gap-2"><Stars n={c.rarity} /> {pathName(c.path)} · {elementName(c.element)} · Energy {c.max_sp}</span>}
            actions={owned
              ? <><SourceBadge source={owned.source} /><Button size="sm" onClick={() => setEditing(true)}><Pencil size={14} /> Edit progress</Button></>
              : <Button size="sm" variant="primary" onClick={() => getDb().characters.put(blankOwned(profileId, id))}><Plus size={14} /> Mark owned</Button>}
          />
          <WolfComment comment={characterDetailComment(id, owned ?? null)} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Level" value={owned ? `${owned.level}/80` : "—"} hint={owned ? `Ascension ${owned.ascension}` : "not owned"} />
            <Stat label="Eidolon" value={owned ? `E${owned.eidolon}` : "—"} tone="gold" />
            <Stat label="Light Cone" value={lcData?.name ?? "—"} hint={lc ? `Lv ${lc.level} · S${lc.superimposition}` : undefined} />
            <Stat label="Relics equipped" value={equippedRelics?.length ?? 0} hint="from inventory" />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link className="text-cyan hover:underline" href={`/materials?char=${id}`}>Material plan →</Link>
            <Link className="text-cyan hover:underline" href={`/relics?char=${id}`}>Relic profile →</Link>
            <Link className="text-cyan hover:underline" href={`/teams?with=${id}`}>Build a team →</Link>
            <Link className="text-cyan hover:underline" href={`/journal?new=character:${id}`}>Write a note ({notes?.length ?? 0}) →</Link>
          </div>
        </div>
      </div>

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: "build", label: "Build & rating" }, { id: "overview", label: "Base stats" }, { id: "abilities", label: "Abilities" },
        { id: "traces", label: "Traces" }, { id: "eidolons", label: "Eidolons" },
      ]} />

      {tab === "overview" && (
        <Panel title={owned ? `Base stats at your level (${level}, A${asc})` : "Base stats"} actions={!owned && (
          <label className="flex items-center gap-2 text-xs text-muted">Preview level
            <input type="range" min={1} max={80} value={previewLevel} onChange={(e) => setPreviewLevel(Number(e.target.value))} aria-label="Preview level" />
            <span className="w-6 font-mono">{previewLevel}</span>
          </label>
        )}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["hp", "atk", "def", "spd"] as const).map((k) => (
              <Stat key={k} label={k.toUpperCase()} value={stat(k)?.toFixed(k === "spd" ? 0 : 0) ?? "—"} hint={lcStat(k) ? `+${lcStat(k)!.toFixed(0)} Light Cone` : "character only"} />
            ))}
            <Stat label="CRIT Rate" value={`${((stat("crit_rate") ?? 0) * 100).toFixed(1)}%`} />
            <Stat label="CRIT DMG" value={`${((stat("crit_dmg") ?? 0) * 100).toFixed(1)}%`} />
            <Stat label="Aggro" value={stat("taunt") ?? "—"} />
            <Stat label="Max Energy" value={c.max_sp} />
          </div>
          <p className="mt-3 text-xs text-muted">Character + Light Cone base values from the ascension tables. Relic, trace and set bonuses are not added here; an exact total-stat calculation needs a validated stat engine, which is planned.</p>
        </Panel>
      )}

      {(tab === "abilities" || tab === "traces") && hasEnhancedKit(c) && (
        <div className="mb-3 flex items-center gap-2 text-xs text-muted">
          Kit:
          {(["original", "enhanced"] as KitVariant[]).map((v) => (
            <button key={v} onClick={() => setKit(v)} aria-pressed={kit === v} className={`rounded-md border px-2 py-0.5 ${kit === v ? "border-cyan/50 text-cyan" : "border-line"}`}>{v === "original" ? "Original" : "Enhanced"}</button>
          ))}
          <span className="text-faint">This character has an enhanced kit in the game data.</span>
        </div>
      )}

      {tab === "abilities" && (
        <div className="grid gap-3 md:grid-cols-2">
          {skills.map((s) => {
            const lv = Math.min(s.max_level, skillLevel(s.type));
            return (
              <Panel key={s.id} title={`${s.type_text || s.type} · ${s.effect_text}`}>
                <div className="flex gap-3">
                  <GameImage path={s.icon} alt={s.name} className="h-12 w-12 shrink-0" rounded="rounded-full" />
                  <div className="min-w-0">
                    <div className="font-medium">{s.name} <Badge tone="cyan">Lv {lv}/{s.max_level}</Badge></div>
                    <p className="mt-1 whitespace-pre-line text-sm text-muted">{formatSkillDesc(s.desc, s.params, lv)}</p>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {tab === "traces" && (
        <Panel title="Trace nodes">
          <ul className="grid gap-2 md:grid-cols-2">
            {trees.filter((t) => t.max_level === 1 && (t.name || t.levels[0]?.properties.length)).map((t) => {
              const props = t.levels[0]?.properties ?? [];
              return (
                <li key={t.id} className="flex gap-3 rounded-lg border border-line p-2.5">
                  <GameImage path={t.icon} alt={t.name || "Trace"} className="h-9 w-9 shrink-0" rounded="rounded-full" />
                  <div className="min-w-0 text-sm">
                    <div className="font-medium">{t.name || "Stat bonus"} <span className="font-mono text-[10px] text-faint">A{t.levels[0]?.promotion ?? 0}</span></div>
                    {t.desc ? <p className="text-xs text-muted">{formatSkillDesc(t.desc, t.params, 1)}</p> : (
                      <p className="text-xs text-muted">{props.map((p) => `${p.type.replace(/(AddedRatio|Base|Delta)$/, "")} +${p.value < 1 ? (p.value * 100).toFixed(1) + "%" : p.value}`).join(", ")}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {tab === "eidolons" && (
        <div className="grid gap-3 md:grid-cols-2">
          {ranks.map((r) => (
            <Panel key={r.id} className={owned && owned.eidolon >= r.rank ? "border-gold/40" : ""}>
              <div className="flex gap-3">
                <GameImage path={r.icon} alt={r.name} className="h-12 w-12 shrink-0" rounded="rounded-full" />
                <div className="min-w-0">
                  <div className="font-medium">E{r.rank} · {r.name} {owned && owned.eidolon >= r.rank && <Badge tone="gold">active</Badge>}</div>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted">{stripMarkup(r.desc)}</p>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {tab === "build" && (owned
        ? <BuildCard charId={id} owned={owned} />
        : <div className="space-y-4"><RecommendedBuildFor charId={id} /><p className="text-center text-xs text-muted">Own this character? Mark them as owned to get Silver Wolf&apos;s rating of your build.</p></div>)}

      {owned && editing && <CharacterEditor key={owned.updatedAt} open={editing} onClose={() => setEditing(false)} initial={owned} name={name} />}
    </div>
  );
}
