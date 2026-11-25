import { fill, pick, SW, type Comment, type Mood } from "./voice";
import { POOLS, type PoolKind } from "../warp/rules";
import type { PoolSummary } from "../warp/history";
import type { PlannerResult } from "../warp/planner";
import type { RelicScore } from "../relics/scoring";
import type { AccountSummary } from "../summary";

const pct = (x: number, d = 1) => (x * 100).toFixed(d);
const say = (mood: Mood, bank: readonly string[], key: string, vars: Record<string, string | number> = {}, facts: string[] = [], action?: Comment["action"]): Comment => ({
  mood, line: fill(pick(bank, key), vars), facts, action,
});

export const noGameData = (): Comment =>
  say("bored", SW.noGameData, "nogame", {}, ["No game data snapshot is installed on this device."], { label: "Download game data", href: "/settings#game-data" });

export const emptyPersonal = (what: string, href: string, label: string): Comment =>
  say("bored", SW.emptyPersonal, `empty-${what}`, {}, [`No ${what} recorded for this profile.`], { label, href });

export const unsourced = (module: string): Comment =>
  say("neutral", SW.unsourced, `unsourced-${module}`, {}, [`${module}: no verified or permitted data source is connected. Entries are manual.`]);

export function warpPoolComment(s: PoolSummary): Comment {
  const rules = POOLS[s.pool];
  const facts = [
    `${rules.label}: pity ${s.pity5}/${rules.five.hard}, ${s.total} pulls recorded.`,
  ];
  if (rules.fiveFeaturedChance !== null) facts.push(s.guaranteed5 ? "Next 5★ is guaranteed featured." : `Next 5★: ${rules.fiveFeaturedChance * 100}% featured.`);
  if (!s.historyComplete) facts.push("History may be incomplete (pulls before the first record are unknown).");
  if (s.total === 0) return say("bored", SW.historyEmpty, "hist-empty", {}, facts, { label: "Import Warp history", href: "/import" });
  const vars = { pity: s.pity5, rate: pct(rules.five.base), chance: (rules.fiveFeaturedChance ?? 1) * 100 };
  if (s.guaranteed5) return say("smug", SW.guaranteed, `g-${s.pool}`, vars, facts);
  if (s.pity5 >= rules.five.softStart) return say("hyped", SW.pitySoft, `soft-${s.pool}-${s.pity5}`, vars, facts);
  if (s.pity5 >= 20) return say("neutral", SW.pityMid, `mid-${s.pool}-${s.pity5}`, vars, facts);
  return say("neutral", SW.pityLow, `low-${s.pool}-${s.pity5}`, vars, facts);
}

export function plannerComment(r: PlannerResult, pool: PoolKind): Comment {
  const vars = { prob: pct(r.probability), pulls: r.totalPulls, worst: r.worstCase, median: r.median };
  const facts = [
    `${r.totalPulls} pulls available (${r.currentPulls} now + ${r.futurePulls} expected).`,
    `P(success) = ${pct(r.probability, 2)}% (exact calculation, ${POOLS[pool].label}).`,
    `Median ${r.median}, 90% at ${r.p90}, worst case ${r.worstCase} pulls.`,
  ];
  if (r.probability >= 1) return say("smug", SW.planCertain, "cert", vars, facts);
  if (r.probability >= 0.75) return say("hyped", SW.planGood, `good-${r.totalPulls}`, vars, facts);
  if (r.probability >= 0.4) return say("alert", SW.planRisky, `risky-${r.totalPulls}`, vars, facts);
  return say("alert", SW.planBad, `bad-${r.totalPulls}`, vars, facts);
}

export function relicComment(s: RelicScore, templateOrigin: boolean): Comment {
  const facts = [
    `Score ${s.score.toFixed(0)}/100 (${s.weightedRolls.toFixed(2)} of ${s.idealRolls.toFixed(2)} ideal weighted rolls).`,
    s.remainingUpgrades ? `${s.remainingUpgrades} upgrade(s) left: expected ${s.expectedAtMax.toFixed(0)}, best case ${s.bestCaseAtMax.toFixed(0)}.` : "Fully upgraded.",
  ];
  if (templateOrigin) facts.push("Weights come from a generic template — not character-specific.");
  const vars = { score: s.score.toFixed(0) };
  if (!s.mainStatFits) return say("bored", SW.relicMainMismatch, "main", vars, facts);
  const bank = s.verdict === "keep" ? SW.relicKeep : s.verdict === "good" ? SW.relicGood : s.verdict === "usable" ? SW.relicUsable : SW.relicFodder;
  const mood: Mood = s.verdict === "keep" ? "hyped" : s.verdict === "fodder" ? "bored" : "neutral";
  return say(mood, bank, `relic-${s.verdict}-${s.score.toFixed(0)}`, vars, facts);
}

export function characterCollectionComment(owned: number, total: number, belowMax: number): Comment {
  const facts = [`${owned} of ${total} playable characters owned.`, `${belowMax} owned character(s) below level 80.`];
  if (!owned) return emptyPersonal("characters", "/import", "Import characters");
  if (belowMax >= 3) return say("bored", SW.charUnbuilt, `unbuilt-${belowMax}`, { count: belowMax }, facts);
  return say("neutral", SW.charCollection, `coll-${owned}`, { owned, total, pct: total ? ((owned / total) * 100).toFixed(0) : 0 }, facts);
}

export function characterDetailComment(charId: string, owned: { level: number; ascension: number; eidolon: number } | null): Comment {
  if (charId === "1006") return say("smug", SW.charSelf, "self", {}, ["Silver Wolf — Nihility, Quantum (game data)."]);
  if (charId === "1506") return say("smug", SW.charSelf999, "self999", {}, ["Silver Wolf LV.999 — Elation, Imaginary (game data)."]);
  if (!owned) return say("neutral", SW.charNotOwned, `no-${charId}`, {}, ["Not marked as owned on this profile."], { label: "Plan materials", href: `/materials?char=${charId}` });
  const facts = [`Level ${owned.level}, Ascension ${owned.ascension}, Eidolon ${owned.eidolon}.`];
  if (owned.level >= 80) return say("neutral", SW.charMaxed, `max-${charId}`, {}, facts, { label: "Check relics", href: `/relics?char=${charId}` });
  return say("bored", SW.charLowLevel, `low-${charId}`, { level: owned.level, asc: owned.ascension }, facts, { label: "Material plan", href: `/materials?char=${charId}` });
}

export function achievementComment(done: number, total: number): Comment {
  const facts = [`${done} of ${total} achievements marked complete on this profile (manual tracking).`];
  if (!done) return say("bored", SW.achievementsZero, "ach0", {}, facts);
  return say(done / total > 0.8 ? "hyped" : "neutral", SW.achievements, `ach-${done}`, { done, total, pct: ((done / total) * 100).toFixed(1), left: total - done }, facts);
}

const SUSTAIN = new Set(["Knight", "Priest"]);
const SUPPORT = new Set(["Shaman", "Warlock"]);
export function teamComment(paths: (string | null)[], pathLabel: (p: string) => string): Comment {
  const filled = paths.filter((p): p is string => !!p);
  const facts = [`${filled.length}/4 slots filled. Paths: ${filled.map(pathLabel).join(", ") || "none"}.`];
  if (filled.length < 4) return say("bored", SW.teamEmpty, `team-empty-${filled.length}`, {}, facts);
  if (!filled.some((p) => SUSTAIN.has(p))) return say("alert", SW.teamNoSustain, "nosus", {}, [...facts, "No Preservation/Abundance unit."]);
  if (!filled.some((p) => SUPPORT.has(p))) return say("alert", SW.teamNoSupport, "nosup", {}, [...facts, "No Harmony/Nihility unit."]);
  return say("smug", SW.teamSolid, `solid-${filled.join()}`, { roles: [...new Set(filled.map(pathLabel))].join(", ") }, facts);
}

export function materialsComment(missing: { name: string; missing: number }[]): Comment {
  const short = missing.filter((m) => m.missing > 0);
  const facts = [`${short.length} material type(s) short.`, "Excludes level-up EXP materials (not in the data source)."];
  if (!short.length) return say("hyped", SW.materialsDone, "mdone", {}, facts);
  const top = [...short].sort((a, b) => b.missing - a.missing)[0];
  return say("alert", SW.materialsMissing, `miss-${short.length}`, { count: short.length, top: `${top.name} (×${top.missing.toLocaleString()})` }, facts);
}

export function importComment(c: { new: number; changed: number; conflict: number }): Comment {
  return say(c.conflict ? "alert" : "neutral", SW.importPreview, `imp-${c.new}-${c.changed}`, c, [`Preview only — nothing is written until you apply.`]);
}

export function journalComment(count: number): Comment {
  return count ? say("neutral", SW.journal, `j-${count}`, { count }, [`${count} note(s) stored locally.`]) : say("bored", SW.journalEmpty, "j0", {}, ["No notes yet."]);
}

export function relicInventoryComment(count: number, keep: number, fodder: number): Comment {
  if (!count) return emptyPersonal("relics", "/import", "Import relics");
  return say(fodder > count / 2 ? "bored" : "neutral", SW.relicInventory, `inv-${count}`, { count, keep, fodder }, [
    `${count} relics; ${keep} rated "keep", ${fodder} rated "fodder" by their character's profile.`,
    "Relics not equipped are graded with the profile you select.",
  ]);
}

export function dataVersionComment(local: string | null, remote: string | null): Comment {
  if (!local) return noGameData();
  if (remote && remote !== local) return say("alert", SW.dataUpdate, `upd-${remote}`, { local, remote }, [`Installed ${local}; source reports ${remote}.`], { label: "Update", href: "/settings#game-data" });
  return say("neutral", SW.dataCurrent, `cur-${local}`, { local }, [`Installed game data version ${local}.`]);
}

export function dashboardComment(s: AccountSummary | null, hasGame: boolean): Comment {
  if (!hasGame) return noGameData();
  if (!s) return { mood: "neutral", line: "Loading your save file…", facts: [] };
  const top = s.objectives[0];
  const facts = [`${s.objectives.length} objective(s) derived from your data.`, `${s.owned}/${s.totalPlayable} characters owned.`];
  if (!top) return say("bored", SW.dashClear, "dash-clear", {}, facts);
  return say(top.category === "event" || top.category === "banner" ? "alert" : "neutral", SW.dashTop, `dash-${top.id}`, { title: top.title, reason: top.reason }, [top.reason, ...facts], { label: "Go", href: top.href });
}
