import type { MapMarker, MapZone, MarkerCategory } from "./types";

export const CATEGORY_COLOR: Partial<Record<MarkerCategory, string>> & { default: string } = {
  "Basic Treasure": "#cfd4e3", "Bountiful Treasure": "#b38cff", "Precious Treasure": "#e9c46a", "Warp Trotter": "#f472b6",
  Puzzle: "#5ee6f0", "Hidden Puzzle": "#22d3ee", "Space Anchor": "#60a5fa", Calyx: "#fbbf24", "Stagnant Shadow": "#a78bfa",
  "Cavern of Corrosion": "#fb7185", "Echo of War": "#ef4444", Boss: "#ef4444", Enemy: "#f97316", NPC: "#34d399",
  "Origami Bird": "#fde68a", "Lordly Trashcan": "#86efac", default: "#9b98b8",
};

export interface Cluster { x: number; y: number; markers: MapMarker[] }

/**
 * Grid clustering in screen space. `scale` is the current zoom; positions are relative (0..1) to an
 * image of size width × height. Markers closer than `cell` pixels on screen are grouped.
 */
export function clusterMarkers(markers: MapMarker[], width: number, height: number, scale: number, cell = 36): Cluster[] {
  const cells = new Map<string, MapMarker[]>();
  for (const m of markers) {
    const k = `${Math.floor((m.x * width * scale) / cell)}:${Math.floor((m.y * height * scale) / cell)}`;
    const list = cells.get(k);
    if (list) list.push(m); else cells.set(k, [m]);
  }
  return [...cells.values()].map((ms) => ({
    x: ms.reduce((s, m) => s + m.x, 0) / ms.length,
    y: ms.reduce((s, m) => s + m.y, 0) / ms.length,
    markers: ms,
  }));
}

export function completion(markers: MapMarker[]): { done: number; total: number; pct: number } {
  const counted = markers.filter((m) => m.status !== "skipped");
  const done = counted.filter((m) => m.status === "completed").length;
  return { done, total: counted.length, pct: counted.length ? (done / counted.length) * 100 : 0 };
}

/** Group zones into planet → region → zone name → floors. */
export function zoneTree(zones: MapZone[]) {
  const tree = new Map<string, Map<string, Map<string, MapZone[]>>>();
  for (const z of zones) {
    const p = tree.get(z.planet) ?? new Map();
    const r = p.get(z.region) ?? new Map();
    const n = r.get(z.name) ?? [];
    n.push(z);
    n.sort((a: MapZone, b: MapZone) => a.floor.localeCompare(b.floor, undefined, { numeric: true }));
    r.set(z.name, n); p.set(z.region, r); tree.set(z.planet, p);
  }
  return tree;
}

/** Clamp a pan offset so at least `keep` px of the image stays visible. */
export function clampPan(x: number, y: number, imgW: number, imgH: number, viewW: number, viewH: number, keep = 80) {
  return {
    x: Math.min(viewW - keep, Math.max(keep - imgW, x)),
    y: Math.min(viewH - keep, Math.max(keep - imgH, y)),
  };
}

export interface MapPack {
  app: "astral-companion-map";
  version: 1;
  zones: (Omit<MapZone, "image"> & { image?: string })[];
  markers: Omit<MapMarker, "profileId">[];
}
