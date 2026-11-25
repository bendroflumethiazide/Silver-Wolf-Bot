import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db";
import { parseHsrScanner } from "../importers/hsrScanner";
import { applyScanPlan, applyWarpImport, planScan, rollbackImport } from "../importers/apply";
import { createBackup, deleteAllPersonalData, restoreBackup, validateBackup } from "../backup";

const scan = (level: number, relicLevel: number) => ({
  source: "HSR-Scanner", version: 4,
  characters: [{ id: "1006", level, ascension: 6, eidolon: 0, skills: { basic: 1, skill: 1, ult: 1, talent: 1 }, traces: {} }],
  light_cones: [{ id: "23000", level: 80, ascension: 6, superimposition: 1, location: "1006", lock: true }],
  relics: [
    { set_id: "101", slot: "Head", rarity: 5, level: relicLevel, mainstat: "HP", substats: [{ key: "SPD", value: 2 }], location: "1006", lock: true },
    { set_id: "101", slot: "Head", rarity: 5, level: 0, mainstat: "HP", substats: [{ key: "SPD", value: 2 }], location: "", lock: false },
  ],
});

const all = async () => ({
  characters: await getDb().characters.toArray(),
  lightCones: await getDb().lightCones.toArray(),
  relics: await getDb().relics.toArray(),
});

describe("scan import → apply → rollback", () => {
  beforeEach(async () => { await deleteAllPersonalData({ includeGameData: true }); });

  it("applies, detects unchanged on re-import, and rolls back exactly", async () => {
    const first = planScan(await all(), parseHsrScanner(scan(70, 15), "p"));
    expect(first.characters.map((r) => r.kind)).toEqual(["new"]);
    expect(first.relics.map((r) => r.kind)).toEqual(["new", "new"]);
    const a = await applyScanPlan(first, { categories: { characters: true, lightCones: true, relics: true }, approvedConflicts: new Set() });
    expect(a.written).toBe(4);

    const again = planScan(await all(), parseHsrScanner(scan(70, 15), "p"));
    expect([...again.characters, ...again.lightCones, ...again.relics].every((r) => r.kind === "unchanged")).toBe(true);

    // Manual edit, then a scan that changes the same character → conflict, not silent overwrite.
    await getDb().characters.update("p:1006", { source: "manual", favorite: true });
    const second = planScan(await all(), parseHsrScanner(scan(80, 0), "p"));
    expect(second.characters[0].kind).toBe("conflict");
    // The +15 relic disappeared (upgraded/fed); two identical +0 relics are told apart by occurrence.
    expect(second.relics.map((r) => r.kind).sort()).toEqual(["changed", "new", "removed"]);
    const b = await applyScanPlan(second, { categories: { characters: true, lightCones: true, relics: true }, approvedConflicts: new Set() });
    expect((await getDb().characters.get("p:1006"))!.level).toBe(70); // conflict not approved
    expect(b.removed).toBe(1);
    expect(await getDb().relics.count()).toBe(2);

    const c = await applyScanPlan(second, { categories: { characters: true, lightCones: false, relics: false }, approvedConflicts: new Set(["1006"]) });
    const ch = (await getDb().characters.get("p:1006"))!;
    expect(ch.level).toBe(80);
    expect(ch.favorite).toBe(true); // user-only fields preserved

    await rollbackImport(c.historyId);
    expect((await getDb().characters.get("p:1006"))!.level).toBe(70);
    await rollbackImport(b.historyId);
    expect(await getDb().relics.count()).toBe(2);
    await expect(rollbackImport(b.historyId)).rejects.toThrow(/already/);
    await rollbackImport(a.historyId);
    expect(await getDb().characters.count()).toBe(0);
    expect(await getDb().relics.count()).toBe(0);
  });

  it("warp import can be rolled back", async () => {
    const r = await applyWarpImport([{ id: "1", profileId: "p", pool: "character", gachaType: "11", name: "x", itemType: "", rank: 3, time: "2026-01-01 00:00:00", source: "uigf" }], "uigf");
    expect(await getDb().warps.count()).toBe(1);
    await rollbackImport(r.historyId);
    expect(await getDb().warps.count()).toBe(0);
  });
});

describe("backup", () => {
  it("round-trips personal data and keeps the device's game-data pointer", async () => {
    await deleteAllPersonalData({ includeGameData: true });
    await getDb().kv.put({ key: "activeSnapshot", value: "snap-A" });
    await getDb().notes.put({ id: "n1", title: "t", body: "b", tags: ["x"], favorite: false, links: [], createdAt: "", updatedAt: "" });
    const b = validateBackup(JSON.parse(JSON.stringify(await createBackup())));
    await deleteAllPersonalData({ includeGameData: false });
    expect(await getDb().notes.count()).toBe(0);
    expect((await getDb().kv.get("activeSnapshot"))?.value).toBe("snap-A");
    await getDb().kv.put({ key: "activeSnapshot", value: "snap-B" });
    await restoreBackup(b);
    expect(await getDb().notes.count()).toBe(1);
    expect((await getDb().kv.get("activeSnapshot"))?.value).toBe("snap-B");
    expect(() => validateBackup({ app: "other" })).toThrow();
  });
});
