import { describe, expect, it } from "vitest";
import { parseHsrScanner, relicFingerprint } from "../importers/hsrScanner";
import { countDiff, diffByKey } from "../importers/diff";

const scan = {
  source: "HSR-Scanner", build: "v1.6.1", version: 4, metadata: { uid: 600000000, trailblazer: "Stelle" },
  light_cones: [{ id: "20010", name: "Defense", level: 80, ascension: 6, superimposition: 5, location: "1001", lock: true, _uid: "light_cone_1" }],
  relics: [
    { set_id: "102", name: "Musketeer", slot: "Hands", rarity: 5, level: 15, mainstat: "ATK", substats: [{ key: "CRIT Rate_", value: 5.1 }, { key: "SPD", value: 4 }], preview_substats: [], location: "1101", lock: true, discard: false, _uid: "relic_1" },
    { set_id: "102", name: "Bad", slot: "Hands", rarity: 5, level: 0, mainstat: "SPD", substats: [], location: "", lock: false, _uid: "relic_2" },
  ],
  characters: [{ id: "1001", name: "March 7th", path: "Preservation", level: 80, ascension: 6, eidolon: 6, skills: { basic: 1, skill: 10, ult: 4, talent: 2 }, traces: { ability_1: true } }],
};

describe("HSR Scanner importer", () => {
  it("parses a v4 export and reports invalid rows", () => {
    const p = parseHsrScanner(scan, "p1", "2026-01-01T00:00:00Z");
    expect(p.meta.uid).toBe("600000000");
    expect(p.characters[0]).toMatchObject({ charId: "1001", eidolon: 6, skills: { skill: 10 }, source: "hsr-scanner" });
    expect(p.lightCones[0]).toMatchObject({ lcId: "20010", superimposition: 5, location: "1001" });
    expect(p.relics).toHaveLength(1);
    expect(p.relics[0]).toMatchObject({ slot: "HAND", mainStat: "ATK", substats: [{ key: "CRIT Rate", value: 5.1 }, { key: "SPD", value: 4 }] });
    expect(p.issues.some((i) => i.includes("not valid for Hands"))).toBe(true);
    expect(p.issues.some((i) => i.includes("SPD"))).toBe(true);
  });
  it("rejects other files with a readable error", () => {
    expect(() => parseHsrScanner({ hello: 1 }, "p")).toThrow(/Not a valid HSR Scanner export/);
  });
  it("relic fingerprints ignore substat order", () => {
    const a = { setId: "1", slot: "HEAD" as const, rarity: 5 as const, level: 3, mainStat: "HP" as const, substats: [{ key: "SPD" as const, value: 2 }, { key: "CRIT Rate" as const, value: 3 }] };
    expect(relicFingerprint(a)).toBe(relicFingerprint({ ...a, substats: [...a.substats].reverse() }));
  });
});

describe("keyed diff", () => {
  type R = { k: string; v: number; source: "manual" | "hsr-scanner" };
  const keyOf = (r: R) => r.k;
  it("never silently overwrites or removes manual records", () => {
    const existing: R[] = [{ k: "a", v: 1, source: "manual" }, { k: "b", v: 1, source: "hsr-scanner" }, { k: "c", v: 1, source: "manual" }, { k: "d", v: 1, source: "hsr-scanner" }];
    const incoming: R[] = [{ k: "a", v: 2, source: "hsr-scanner" }, { k: "b", v: 2, source: "hsr-scanner" }, { k: "e", v: 1, source: "hsr-scanner" }];
    const rows = diffByKey(existing, incoming, keyOf, ["v"], { removeMissing: true });
    expect(countDiff(rows)).toEqual({ new: 1, changed: 1, unchanged: 0, conflict: 2, removed: 1 });
    expect(rows.find((r) => r.key === "a")!.kind).toBe("conflict");
    expect(rows.find((r) => r.key === "c")!.kind).toBe("conflict");
  });
});
