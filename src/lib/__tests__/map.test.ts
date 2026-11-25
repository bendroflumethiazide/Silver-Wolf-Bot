import { describe, expect, it } from "vitest";
import { clampPan, clusterMarkers, completion, zoneTree } from "../map";
import type { MapMarker, MapZone } from "../types";

const mk = (id: string, x: number, y: number, status: MapMarker["status"] = "not-started"): MapMarker => ({ id, profileId: "p", zoneId: "z", x, y, category: "Basic Treasure", name: id, status, createdAt: "", updatedAt: "" });

describe("map", () => {
  it("clusters nearby markers only when zoomed out", () => {
    const ms = [mk("a", 0.1, 0.1), mk("b", 0.101, 0.101), mk("c", 0.9, 0.9)];
    expect(clusterMarkers(ms, 1000, 1000, 0.5).map((c) => c.markers.length).sort()).toEqual([1, 2]);
    expect(clusterMarkers(ms, 1000, 1000, 40).every((c) => c.markers.length === 1)).toBe(true);
  });
  it("completion ignores skipped markers", () => {
    expect(completion([mk("a", 0, 0, "completed"), mk("b", 0, 0, "skipped"), mk("c", 0, 0)])).toEqual({ done: 1, total: 2, pct: 50 });
    expect(completion([]).pct).toBe(0);
  });
  it("groups zones and sorts floors numerically", () => {
    const z = (id: string, floor: string): MapZone => ({ id, planet: "P", region: "R", name: "Z", floor, width: 1, height: 1, createdAt: "" });
    const t = zoneTree([z("2", "F10"), z("1", "F2")]);
    expect(t.get("P")!.get("R")!.get("Z")!.map((x) => x.floor)).toEqual(["F2", "F10"]);
  });
  it("keeps part of the image on screen", () => {
    expect(clampPan(-5000, 5000, 1000, 1000, 800, 600)).toEqual({ x: -920, y: 520 });
  });
});
