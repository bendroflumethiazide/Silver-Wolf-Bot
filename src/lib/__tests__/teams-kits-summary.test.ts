import { describe, expect, it } from "vitest";
import { analyzeTeam, investment, suggestTeams } from "../teams";
import { hasEnhancedKit, kitSkills, kitTrees, formatSkillDesc, type SrrCharacter } from "../gamedata/types";
import { summarizeAccount } from "../summary";
import { nextDailyReset, nextWeeklyReset, formatDuration, trailblazePowerAt } from "../time";
import { characterDetailComment, pityComment, plannerComment } from "../companion/comments";
import { pick, fill } from "../companion/voice";
import { planWarps } from "../warp/planner";

const info = (id: string, path: string, element = "Fire") => ({ id, path, element, rarity: 5 });

describe("team analysis", () => {
  it("flags missing roles and weakness coverage", () => {
    const a = analyzeTeam([info("1", "Mage"), info("2", "Rogue", "Ice"), null, null], ["Ice"]);
    expect(a.missing).toContain("2 empty slot(s)");
    expect(a.missing).toContain("no sustain (Preservation/Abundance)");
    expect(a.weaknessHits).toEqual(["Ice"]);
  });
  it("builds non-overlapping teams with explained reasons", () => {
    const pool = [info("a", "Knight"), info("b", "Priest"), info("c", "Mage"), info("d", "Rogue"), info("e", "Shaman"), info("f", "Warlock"), info("g", "Warrior"), info("h", "Shaman")].map((x, i) => ({ info: x, invest: 90 - i }));
    const t = suggestTeams(pool, 2);
    expect(t).toHaveLength(2);
    const all = t.flatMap((x) => x.members);
    expect(new Set(all).size).toBe(all.length);
    expect(t[0].members[0]).toBe("a");
    expect(t[1].members[0]).toBe("b");
    expect(t[0].reasons.length).toBeGreaterThan(0);
  });
  it("investment is bounded", () => {
    const max = investment({ key: "", profileId: "", charId: "", level: 80, ascension: 6, eidolon: 6, skills: { basic: 6, skill: 10, ult: 10, talent: 10 }, traces: {}, source: "manual", updatedAt: "" }, 5);
    expect(max).toBe(100);
  });
});

describe("enhanced kits", () => {
  const c = { id: "1006", skills: ["100601", "100602", "1100601"], skill_trees: ["1006001", "1006201", "11006001"] } as SrrCharacter;
  it("separates original and enhanced ids", () => {
    expect(hasEnhancedKit(c)).toBe(true);
    expect(kitTrees(c, "original")).toEqual(["1006001", "1006201"]);
    expect(kitTrees(c, "enhanced")).toEqual(["11006001"]);
    expect(kitSkills(c, "original")).toEqual(["100601", "100602"]);
    const plain = { id: "1001", skills: ["100101"], skill_trees: ["1001001"] } as SrrCharacter;
    expect(hasEnhancedKit(plain)).toBe(false);
    expect(kitTrees(plain, "enhanced")).toEqual(["1001001"]);
  });
  it("fills skill parameters", () => {
    expect(formatSkillDesc("Deals DMG equal to #1[i]% of ATK for #2[i] turn(s).", [[0.5, 2], [0.6, 2]], 2)).toBe("Deals DMG equal to 60% of ATK for 2 turn(s).");
    expect(formatSkillDesc("<color=#f29e38ff>x #1[f1]%</color>", [[0.123]], 1)).toBe("x 12.3%");
  });
});

describe("time", () => {
  it("daily reset is 04:00 server time", () => {
    const now = Date.UTC(2026, 10, 25, 2, 0); // 02:00 UTC = 10:00 Asia
    expect(new Date(nextDailyReset("Asia", now)).toISOString()).toBe("2026-11-25T20:00:00.000Z");
    expect(new Date(nextDailyReset("Europe", now)).toISOString()).toBe("2026-11-25T03:00:00.000Z");
    expect(new Date(nextDailyReset("America", now)).toISOString()).toBe("2026-11-25T09:00:00.000Z");
  });
  it("weekly reset is Monday 04:00", () => {
    const t = nextWeeklyReset("Europe", Date.UTC(2026, 10, 25, 12)); // Wed
    expect(new Date(t).toISOString()).toBe("2026-11-30T03:00:00.000Z");
    expect(new Date(t + 3600_000).getUTCDay()).toBe(1);
  });
  it("formats durations and regenerates Trailblaze Power", () => {
    expect(formatDuration(90_061_000)).toBe("1d 1h");
    expect(formatDuration(0)).toBe("now");
    expect(trailblazePowerAt(100, 0, 300, 60 * 60_000)).toBe(110);
    expect(trailblazePowerAt(295, 0, 300, 600 * 60_000)).toBe(300);
  });
});

describe("Silver Wolf commentary", () => {
  it("is deterministic per day and fills placeholders only from data", () => {
    expect(pick(["a", "b", "c"], "k", "2026-01-01")).toBe(pick(["a", "b", "c"], "k", "2026-01-01"));
    expect(fill("pity {pity} {x}", { pity: 3 })).toBe("pity 3 {x}");
  });
  it("speaks about the real pity number and guarantee", () => {
    const c = pityComment("character", { pity: 76, guaranteed: false, updatedAt: "2026-11-25T00:00:00Z" });
    expect(c.line).toMatch(/76/);
    expect(c.facts[0]).toMatch(/pity 76\/90/);
    const g = pityComment("character", { pity: 76, guaranteed: true, updatedAt: "2026-11-25T00:00:00Z" });
    expect(g.facts.join(" ")).toMatch(/guaranteed/);
    const unknown = pityComment("character", { pity: 0, guaranteed: false });
    expect(unknown.action?.href).toMatch(/starrailstation\.com/);
  });
  it("planner comment quotes the computed probability", () => {
    const r = planWarps({ pool: "character", stellarJade: 0, passes: 180, undyingStarlight: 0, expectedFutureJade: 0, expectedFuturePasses: 0, state: { pity: 0, guaranteed: false }, copies: 1 });
    const c = plannerComment(r, "character");
    expect(c.facts.join(" ")).toMatch(/100\.00%/);
  });
  it("recognises herself", () => {
    expect(characterDetailComment("1006", null).mood).toBe("smug");
    expect(characterDetailComment("1506", null).facts[0]).toMatch(/LV\.999/);
  });
});

describe("account summary", () => {
  it("derives objectives only from provided data", () => {
    const now = Date.UTC(2026, 10, 25);
    const s = summarizeAccount({
      game: null, characters: [], lightCones: [], relics: [], achievements: [], markers: [], banners: [],
      events: [{ id: "e", name: "Event X", version: "4.7", end: new Date(now + 2 * 86400_000).toISOString(), permanent: false, status: "official", completion: "in-progress", createdAt: "" }],
      relicProfiles: {}, now,
    });
    expect(s.objectives.map((o) => o.id)).toEqual(["data", "ev-e"]);
  });
});

import { renderMarkdown } from "../markdown";
describe("markdown", () => {
  it("escapes HTML and renders a safe subset", () => {
    expect(renderMarkdown("<script>x</script>")).toBe("<p>&lt;script&gt;x&lt;/script&gt;</p>");
    expect(renderMarkdown("# T\n- **a**\n- [x] done\n\n[l](https://x.y) [bad](javascript:alert(1))")).toBe('<h3>T</h3><ul><li><strong>a</strong></li><li>☑ done</li></ul><p><a href="https://x.y" target="_blank" rel="noreferrer noopener">l</a> [bad](javascript:alert(1))</p>');
  });
});
