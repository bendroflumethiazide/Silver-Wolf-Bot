import { fill, pick, SW, type Comment, type Mood } from "./voice";
import { POOLS, WARP_TRACKER_URL, type PoolKind } from "../warp/rules";
import { pityKnown, type PityPool, type PityState } from "../warp/pity";
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

/** Silver Wolf on the pity you entered for one pool. */
export function pityComment(pool: PityPool, st: PityState): Comment {
  const rules = POOLS[pool];
  const facts = [`${rules.label}: pity ${st.pity}/${rules.five.hard} (entered by you${st.updatedAt ? `, ${new Date(st.updatedAt).toLocaleDateString()}` : ""}).`];
  if (rules.fiveFeaturedChance !== null) facts.push(st.guaranteed ? "Next 5★ is guaranteed featured." : `Next 5★: ${rules.fiveFeaturedChance * 100}% featured.`);
  if (!pityKnown(st)) return say("bored", SW.historyEmpty, "pity-unknown", {}, ["No pity entered yet."], { label: "Open Star Rail Station", href: WARP_TRACKER_URL });
  const vars = { pity: st.pity, rate: pct(rules.five.base), chance: (rules.fiveFeaturedChance ?? 1) * 100 };
  if (st.guaranteed) return say("smug", SW.guaranteed, `g-${pool}`, vars, facts);
  if (st.pity >= rules.five.softStart) return say("hyped", SW.pitySoft, `soft-${pool}-${st.pity}`, vars, facts);
  if (st.pity >= 20) return say("neutral", SW.pityMid, `mid-${pool}-${st.pity}`, vars, facts);
  return say("neutral", SW.pityLow, `low-${pool}-${st.pity}`, vars, facts);
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

/** The newest app update. Silver Wolf announces it on the home page only. */
export const LATEST_UPDATE = { version: "1.12.0", title: "Currency Wars 2.0 Rework", href: "/currency-wars" } as const;

export function latestUpdateComment(): Comment {
  return {
    mood: "hyped",
    line: `Latest update: ${LATEST_UPDATE.title}|Every Investment Environment and Strategy actually does what it says now. I checked all of them|Elation's in. Aha Instants, Punchline, Certified Banger, Lucky Strikes|Advantage Layout, Phantasmal Orbs, Wrenches, Smelting Furnace, privileged gear|Real pictures for everything now. Items, characters, Bonds. Finally looks like the game|Turns run on Action Value. Fast people act more, nobody just stands there|The few the wiki won't explain are tagged, not made up|Go break it. I already did`,
    facts: [
      `Version ${LATEST_UPDATE.version}: ${LATEST_UPDATE.title}.`,
      "Investment Environments 70/72 and Strategies 285/298 fully simulated; the rest are tagged in the Investments tab.",
      "Strategy grades fixed (Silver < Gold < Prismatic), Strategy refresh keeps the grade.",
      "All 58 characters' kits audited; ability labels like the game's.",
      "Elation engine, Advantage Layout with Phantasmal Orbs, Aeon ★ Aha, consumables and privileged equipment.",
      "Pictures for items, characters, Bonds and Investments; Weapon Boxes; battle turns by Action Value.",
    ],
    action: { label: "Play Currency Wars", href: LATEST_UPDATE.href },
  };
}

export function dashboardComment(s: AccountSummary | null, hasGame: boolean): Comment {
  if (!hasGame) return noGameData();
  if (!s) return { mood: "neutral", line: "Loading your save file…", facts: [] };
  const top = s.objectives[0];
  const facts = [`${s.objectives.length} objective(s) derived from your data.`, `${s.owned}/${s.totalPlayable} characters owned.`];
  if (!top) return say("bored", SW.dashClear, "dash-clear", {}, facts);
  return say(top.category === "event" || top.category === "banner" ? "alert" : "neutral", SW.dashTop, `dash-${top.id}`, { title: top.title, reason: top.reason }, [top.reason, ...facts], { label: "Go", href: top.href });
}

export function buildComment(e: import("../builds/evaluate").BuildEvaluation): Comment {
  const facts = [
    `Overall ${e.overall.grade.label} (${e.overall.score.toFixed(1)}/100), ${e.equipped}/6 relics equipped.`,
    ...e.slots.filter((s) => s.grade).map((s) => `${s.slot}: ${s.grade!.label} (${s.effective.toFixed(1)})${s.score && !s.score.mainStatFits ? " — wrong main stat" : ""}`),
  ];
  if (!e.equipped) return say("bored", SW.buildEmpty, "build-empty", {}, facts, { label: "Import a scan", href: "/import" });
  const lack = e.lacks[0] ?? "Nothing major missing";
  const best = e.strengths[0] ?? "Nothing";
  const vars = { grade: e.overall.grade.label, lack, best };
  if (e.overall.grade.rank >= 15) return say("hyped", SW.buildGreat, `build-${e.overall.grade.label}`, vars, facts);
  return say(e.overall.grade.rank <= 6 ? "bored" : "neutral", SW.buildTop, `build-${e.overall.grade.label}-${lack}`, vars, facts);
}
