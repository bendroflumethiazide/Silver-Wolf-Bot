import { describe, expect, it } from "vitest";
import { parseHsrScanner, relicFingerprint } from "../importers/hsrScanner";
import { diffWarpRecords, parseCsv, parseWarpCsv, parseWarpJson, warpRecordsToCsv } from "../importers/warp";
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

const item = (id: string, gt: string, rank: string, t = "2026-01-01 10:00:00") => ({ gacha_id: "2001", gacha_type: gt, item_id: "1308", count: "1", time: t, name: "Acheron", item_type: "Character", rank_type: rank, id });

describe("warp importers", () => {
  it("parses UIGF v4 hkrpg sections", () => {
    const r = parseWarpJson({ info: { export_timestamp: 1, export_app: "x", export_app_version: "1", version: "v4.0" }, hkrpg: [{ uid: "1", timezone: 8, list: [item("1", "11", "5"), item("2", "12", "4"), item("3", "77", "3")] }] }, "p");
    expect(r.format).toBe("uigf");
    expect(r.accounts[0].records.map((x) => x.pool)).toEqual(["character", "lightcone"]);
    expect(r.issues[0]).toMatch(/unknown gacha_type 77/);
  });
  it("parses SRGF v1", () => {
    const r = parseWarpJson({ info: { uid: "1", lang: "en-us", srgf_version: "v1.0", region_time_zone: 8 }, list: [item("9", "1", "3")] }, "p");
    expect(r.format).toBe("srgf");
    expect(r.accounts[0].records[0].pool).toBe("standard");
  });
  it("rejects malformed times and unknown formats", () => {
    expect(() => parseWarpJson({ nope: true }, "p")).toThrow(/neither UIGF v4/);
    const r = parseWarpJson({ info: { uid: "1", srgf_version: "v1.0" }, list: [item("9", "1", "3")] }, "p");
    expect(r.accounts[0].records).toHaveLength(1);
  });
  it("CSV round-trips and handles quoting", () => {
    expect(parseCsv('a,"b,c","d""e"\r\n1,2,3')).toEqual([["a", "b,c", 'd"e'], ["1", "2", "3"]]);
    const csv = parseWarpCsv("time,name,rank,gacha_type,id\n2026-01-01 00:00:00,\"Acheron, the\",5,11,123\n2026-13-01,bad,5,11,124\n", "p");
    expect(csv.accounts[0].records).toHaveLength(1);
    expect(csv.accounts[0].records[0].name).toBe("Acheron, the");
    expect(csv.issues).toHaveLength(1);
    const back = parseWarpCsv(warpRecordsToCsv(csv.accounts[0].records), "p");
    expect(back.accounts[0].records[0]).toMatchObject({ id: "123", name: "Acheron, the", rank: 5 });
  });
  it("detects duplicate warp records", () => {
    const a = parseWarpJson({ info: { uid: "1", srgf_version: "v1.0" }, list: [item("1", "11", "5"), item("2", "11", "3"), item("2", "11", "3")] }, "p").accounts[0].records;
    const { fresh, duplicates } = diffWarpRecords(a.slice(0, 1), a);
    expect(fresh.map((r) => r.id)).toEqual(["2"]);
    expect(duplicates).toBe(2);
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
