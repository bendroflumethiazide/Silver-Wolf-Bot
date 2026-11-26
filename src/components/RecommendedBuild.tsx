"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { FRIBBELS } from "@/lib/builds/fribbels";
import { recommendBuild, type Recommendation, type SetPick } from "@/lib/builds/recommend";
import { getDb } from "@/lib/db";
import { characterDisplayName, formatSkillDesc } from "@/lib/gamedata/types";
import { useRelicProfiles } from "@/lib/hooks";
import { charHref } from "@/lib/links";
import { SLOT_LABEL } from "@/lib/relics/stats";
import { useApp } from "@/lib/store";
import { profileFor } from "@/lib/summary";
import { GameImage } from "./GameImage";
import { Badge, Panel, Stars, cx } from "./ui";

/** Compute the recommendation for any character, owned or not (uses your inventory for "owned" marks). */
export function useRecommendation(charId: string): Recommendation | null {
  const { game, profileId } = useApp();
  const profiles = useRelicProfiles(profileId);
  const inventory = useLiveQuery(async () => ({
    relics: await getDb().relics.where("profileId").equals(profileId).toArray(),
    lightCones: await getDb().lightCones.where("profileId").equals(profileId).toArray(),
  }), [profileId]);
  return useMemo(() => (game && inventory && game.characters[charId] ? recommendBuild(game, charId, profileFor(charId, game, profiles), inventory) : null), [game, inventory, charId, profiles]);
}

const Label = ({ children }: { children: React.ReactNode }) => <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">{children}</div>;

function SetCard({ s, best }: { s: SetPick; best: boolean }) {
  const { game } = useApp();
  if (!game) return null;
  const icon = (id: string) => game.relicSets[id]?.icon;
  return (
    <details className={cx("group rounded-xl border bg-white/[0.03] p-2.5", best ? "border-cyan/50" : "border-line")}>
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <div className="flex shrink-0 -space-x-3">
          <GameImage path={icon(s.setId)} alt={s.name} className="h-12 w-12" rounded="rounded-lg" />
          {s.pairWith && <GameImage path={icon(s.pairWith.setId)} alt={s.pairWith.name} className="h-12 w-12 ring-2 ring-[#0b0a18]" rounded="rounded-lg" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-tight">{s.pairWith ? `${s.name} + ${s.pairWith.name}` : s.name}</div>
          <div className="mt-0.5 flex flex-wrap gap-1 text-[11px] text-muted">
            {best && <Badge tone="cyan">best</Badge>}
            <span>{s.pairWith ? "2 + 2 pieces" : Number(s.setId) >= 300 ? "2 pieces" : "4 pieces"}</span>
            {s.ownedPieces > 0 && <span className="text-ok">· you own {s.ownedPieces}</span>}
          </div>
        </div>
        <span className="text-xs text-faint transition group-open:rotate-90">›</span>
      </summary>
      <ul className="mt-2 space-y-1 border-t border-line/50 pt-2 text-xs text-muted">{s.effects.map((e, i) => <li key={i}>{e}</li>)}</ul>
    </details>
  );
}

/** Prydwen-style build box: Light Cones, sets, main stats, substats and teammates, with pictures. */
export function RecommendedBuild({ rec }: { charId?: string; rec: Recommendation }) {
  const { game } = useApp();
  if (!game) return null;
  return (
    <Panel
      title="Recommended build"
      actions={rec.source === "fribbels"
        ? <a href={FRIBBELS.url} target="_blank" rel="noreferrer" className="text-[11px] text-muted hover:text-cyan">Community data · Fribbels ↗</a>
        : <span className="text-[11px] text-muted">Silver Wolf&apos;s stat-match pick</span>}
    >
      <div className="space-y-5">
        {rec.lightCones.length > 0 && (
          <section>
            <Label>Light Cones</Label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {rec.lightCones.map((l, i) => {
                const lc = game.lightCones[l.lcId];
                return (
                  <div key={l.lcId} className={cx("w-[104px] shrink-0 rounded-xl border p-1.5", i === 0 ? "border-gold/60" : "border-line")} title={formatSkillDesc(game.lightConeRanks[l.lcId]?.desc ?? "", game.lightConeRanks[l.lcId]?.params, 1)}>
                    <GameImage path={lc?.preview} alt={l.name} className="aspect-[3/4] w-full" rounded="rounded-lg" />
                    <div className="mt-1 line-clamp-2 text-[11px] leading-tight">{l.name}</div>
                    <div className="flex items-center justify-between"><Stars n={l.rarity} />{l.owned && <span className="text-[10px] text-ok">owned</span>}</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section>
            <Label>Relic sets</Label>
            <div className="space-y-2">{rec.cavern.map((s, i) => <SetCard key={s.setId + (s.pairWith?.setId ?? "")} s={s} best={i === 0} />)}</div>
          </section>
          <section>
            <Label>Planar ornaments</Label>
            <div className="space-y-2">{rec.planar.map((s, i) => <SetCard key={s.setId} s={s} best={i === 0} />)}</div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section>
            <Label>Main stats</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["BODY", "FOOT", "NECK", "OBJECT"] as const).map((slot) => (
                <div key={slot} className="rounded-xl border border-line bg-white/[0.03] p-2.5">
                  <div className="text-[11px] text-faint">{SLOT_LABEL[slot]}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(rec.mainStats[slot] ?? []).map((m, i) => <span key={m} className={cx("rounded-md px-1.5 py-0.5 text-xs", i === 0 ? "bg-cyan/20 text-text" : "bg-white/5 text-muted")}>{m}</span>)}
                    {!(rec.mainStats[slot] ?? []).length && <span className="text-xs text-muted">any</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <Label>Substats (most important first)</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {rec.substatPriority.map((s, i) => (
                <span key={s.key} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-faint">›</span>}
                  <span className={cx("rounded-md px-2 py-1 text-xs", i < 2 ? "bg-violet/25 text-text" : "bg-white/5 text-muted")}>{s.key}</span>
                </span>
              ))}
              {!rec.substatPriority.length && <span className="text-xs text-muted">—</span>}
            </div>
          </section>
        </div>

        {rec.teammates.length > 0 && (
          <section>
            <Label>Best teammates</Label>
            <div className="flex flex-wrap gap-3">
              {rec.teammates.map((t) => {
                const c = game.characters[t.charId];
                return (
                  <Link key={t.charId} href={charHref(t.charId)} className="flex w-[84px] flex-col items-center gap-1 text-center hover:text-cyan">
                    <GameImage path={c.icon} alt={characterDisplayName(c)} className="h-16 w-16" rounded="rounded-full" />
                    <span className="line-clamp-2 text-[11px] leading-tight">{characterDisplayName(c)}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {rec.caveats.length > 0 && <p className="text-[11px] text-faint">{rec.caveats.join(" ")}</p>}
      </div>
    </Panel>
  );
}

/** Build box for a character, computing the recommendation itself. */
export function RecommendedBuildFor({ charId }: { charId: string }) {
  const rec = useRecommendation(charId);
  return rec ? <RecommendedBuild charId={charId} rec={rec} /> : null;
}
