/**
 * Build evaluation: grades every relic, rates the whole build, and lists what it lacks.
 * Everything here is derived from the character's scoring profile and their actual gear.
 */
import type { GameData } from "../gamedata/types";
import { scoreRelic, type RelicScore, type ScoringProfile } from "../relics/scoring";
import { RELIC_SLOTS, SLOT_LABEL, type RelicSlot } from "../relics/stats";
import type { OwnedCharacter, OwnedLightCone, Relic } from "../types";
import { grade, type Grade } from "./grade";
import { displayStat, type TotalStats } from "./stats";

export interface SlotResult {
  slot: RelicSlot;
  relic: Relic | null;
  score: RelicScore | null;
  grade: Grade | null;
  /** Score used for the overall rating (wrong main stat halves it, empty slot = 0). */
  effective: number;
}

export interface SetStatus { setId: string; name: string; pieces: number; active: "4pc" | "2pc" | null; planar: boolean }

export interface BuildEvaluation {
  slots: SlotResult[];
  overall: { score: number; grade: Grade };
  lacks: string[];
  strengths: string[];
  sets: SetStatus[];
  equipped: number;
}

export function evaluateBuild(
  game: GameData,
  c: OwnedCharacter,
  relics: Relic[],
  profile: ScoringProfile,
  stats: TotalStats | null,
  lc: OwnedLightCone | null,
): BuildEvaluation {
  const bySlot = new Map<RelicSlot, Relic>();
  for (const r of relics) if (!bySlot.has(r.slot) || (bySlot.get(r.slot)!.level < r.level)) bySlot.set(r.slot, r);

  const slots: SlotResult[] = RELIC_SLOTS.map((slot) => {
    const relic = bySlot.get(slot) ?? null;
    if (!relic) return { slot, relic, score: null, grade: null, effective: 0 };
    const score = scoreRelic(relic, profile);
    // Unfinished relics are judged on their expected score at max level.
    const judged = score.remainingUpgrades ? score.expectedAtMax : score.score;
    const effective = score.mainStatFits ? judged : judged * 0.5;
    return { slot, relic, score, grade: grade(effective), effective };
  });

  const overallScore = slots.reduce((s, x) => s + x.effective, 0) / slots.length;
  const lacks: string[] = [];
  const strengths: string[] = [];

  const missing = slots.filter((s) => !s.relic);
  if (missing.length) lacks.push(`No ${missing.map((m) => SLOT_LABEL[m.slot]).join(", ")} equipped`);
  for (const s of slots) {
    if (s.score && !s.score.mainStatFits) lacks.push(`${SLOT_LABEL[s.slot]} main is ${s.relic!.mainStat}, profile wants ${(profile.mainStats[s.slot] ?? []).join(" or ")}`);
  }
  const weak = slots.filter((s) => s.grade && s.score?.mainStatFits && s.grade.rank <= 7).sort((a, b) => a.effective - b.effective);
  for (const s of weak.slice(0, 2)) lacks.push(`${SLOT_LABEL[s.slot]} is only ${s.grade!.label}: replace it`);
  const underLeveled = slots.filter((s) => s.score && s.score.remainingUpgrades > 0);
  if (underLeveled.length) lacks.push(`${underLeveled.length} relic(s) not at max level`);

  // Set bonuses
  const counts = new Map<string, number>();
  for (const s of slots) if (s.relic) counts.set(s.relic.setId, (counts.get(s.relic.setId) ?? 0) + 1);
  const sets: SetStatus[] = [...counts.entries()].map(([setId, pieces]) => {
    const planar = Number(setId) >= 300;
    const active: SetStatus["active"] = !planar && pieces >= 4 ? "4pc" : pieces >= 2 ? "2pc" : null;
    return { setId, name: game.relicSets[setId]?.name ?? setId, pieces, planar, active };
  }).sort((a, b) => b.pieces - a.pieces);
  const cavern = sets.filter((s) => !s.planar);
  const planar = sets.filter((s) => s.planar);
  const cavernEquipped = slots.filter((s) => s.relic && ["HEAD", "HAND", "BODY", "FOOT"].includes(s.slot)).length;
  if (cavernEquipped >= 2 && !cavern.some((s) => s.active)) lacks.push("No Cavern Relic set bonus active");
  else if (cavernEquipped === 4 && !cavern.some((s) => s.active === "4pc")) lacks.push("No 4-piece Cavern set (running 2+2 or broken)");
  if (slots.filter((s) => s.relic && (s.slot === "NECK" || s.slot === "OBJECT")).length === 2 && !planar.some((s) => s.active)) lacks.push("Planar Ornaments don't match: no 2-piece bonus");

  // Stat targets and crit balance
  if (stats) {
    for (const [k, target] of Object.entries(profile.targets ?? {})) {
      const v = displayStat(stats, k as never);
      if (Number.isFinite(v) && target !== undefined && v < target) lacks.push(`${k} ${k === "SPD" ? v.toFixed(1) : v.toFixed(1) + "%"} (target ${target}${k === "SPD" ? "" : "%"})`);
    }
    const critFocused = (profile.weights["CRIT Rate"] ?? 0) >= 0.75 && (profile.weights["CRIT DMG"] ?? 0) >= 0.75;
    if (critFocused) {
      const ratio = stats.critDmg / Math.max(0.01, stats.critRate);
      if (stats.critRate < 1 && (ratio < 1.4 || ratio > 2.6)) lacks.push(`Crit ratio is 1:${ratio.toFixed(1)} (${(stats.critRate * 100).toFixed(1)}% / ${(stats.critDmg * 100).toFixed(1)}%); aim near 1:2`);
      if (stats.critRate > 1.0) lacks.push(`CRIT Rate is over 100% (${(stats.critRate * 100).toFixed(1)}%): wasted rolls`);
    }
  }
  if (lc && game.characters[c.charId] && game.lightCones[lc.lcId] && game.lightCones[lc.lcId].path !== game.characters[c.charId].path) lacks.push("Light Cone Path doesn't match: passive inactive");
  if (!lc) lacks.push("No Light Cone equipped");
  if (c.level < 80) lacks.push(`Character is Lv ${c.level}, not 80`);
  if (profile.origin === "template") lacks.push(`Graded with the generic "${profile.name}" template; set this character's own weights for a fair rating`);

  const best = [...slots].filter((s) => s.grade).sort((a, b) => b.effective - a.effective)[0];
  if (best) strengths.push(`${SLOT_LABEL[best.slot]} (${best.grade!.label})`);
  for (const s of sets.filter((x) => x.active)) strengths.push(`${s.name} ${s.active}`);

  return { slots, overall: { score: overallScore, grade: grade(overallScore) }, lacks, strengths, sets, equipped: slots.filter((s) => s.relic).length };
}
