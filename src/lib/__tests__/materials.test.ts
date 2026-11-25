import { describe, expect, it } from "vitest";
import { ascensionCost, ascensionForLevel, compareWithInventory, freshTraces, maxedTraces, traceCost, type SkillTreeNode } from "../materials/calculator";

const promo = [
  [{ id: "2", num: 3200 }, { id: "a1", num: 4 }],
  [{ id: "2", num: 6400 }, { id: "a1", num: 8 }],
  [{ id: "2", num: 12800 }, { id: "a2", num: 5 }, { id: "b", num: 2 }],
  [], [], [], [],
];
const nodes: SkillTreeNode[] = [
  { id: "n1", name: "Basic", max_level: 3, anchor: "Point01", pre_points: [], levels: [
    { promotion: 0, level: 0, materials: [] },
    { promotion: 2, level: 0, materials: [{ id: "2", num: 4000 }, { id: "t1", num: 2 }] },
    { promotion: 3, level: 0, materials: [{ id: "2", num: 8000 }, { id: "t2", num: 2 }] },
  ] },
  { id: "n2", name: "Stat", max_level: 1, anchor: "Point09", pre_points: [], levels: [{ promotion: 0, level: 1, materials: [{ id: "2", num: 2000 }] }] },
];

describe("materials calculator", () => {
  it("level caps map to ascension phases", () => {
    expect(ascensionForLevel(1)).toBe(0);
    expect(ascensionForLevel(20)).toBe(0);
    expect(ascensionForLevel(21)).toBe(1);
    expect(ascensionForLevel(80)).toBe(6);
  });
  it("sums ascension costs over a range", () => {
    const t = ascensionCost(promo, 0, 3);
    expect(t.get("2")).toBe(22400);
    expect(t.get("a1")).toBe(12);
    expect(t.get("a2")).toBe(5);
    expect(ascensionCost(promo, 1, 2).get("2")).toBe(6400);
    expect(() => ascensionCost(promo, 3, 2)).toThrow();
  });
  it("trace cost respects free level 1 and ascension gates", () => {
    const res = traceCost(nodes, freshTraces(nodes), maxedTraces(nodes), 6);
    expect(res.totals.get("2")).toBe(14000);
    expect(res.blocked).toHaveLength(0);
    const gated = traceCost(nodes, freshTraces(nodes), maxedTraces(nodes), 2);
    expect(gated.blocked[0]).toMatchObject({ nodeId: "n1", needsAscension: 3 });
    expect(gated.totals.get("2")).toBe(6000);
  });
  it("computes missing quantities", () => {
    const rows = compareWithInventory(new Map([["2", 1000], ["x", 5]]), { "2": 400, x: 9 });
    expect(rows).toEqual([{ id: "2", required: 1000, owned: 400, missing: 600 }, { id: "x", required: 5, owned: 9, missing: 0 }]);
  });
});
