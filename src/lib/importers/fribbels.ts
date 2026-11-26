import { z } from "zod";
import type { GameData } from "../gamedata/types";
import { ascensionForLevel } from "../materials/calculator";
import { MAIN_STATS_BY_SLOT, SUB_STATS, type MainStatKey, type RelicSlot, type SubStatKey } from "../relics/stats";
import type { OwnedCharacter, OwnedLightCone, Relic } from "../types";
import type { ParsedScan } from "./hsrScanner";

/** Fribbels HSR Optimizer save file ("Save data" → fribbels-optimizer-save.json). Unknown keys are ignored. */
const Stat = z.object({ stat: z.string(), value: z.number() });
const SaveSchema = z.object({
  relics: z.array(z.object({
    id: z.string().optional(),
    part: z.string(),
    set: z.string(),
    enhance: z.number(),
    grade: z.number(),
    main: Stat,
    substats: z.array(Stat).default([]),
    equippedBy: z.string().nullish(),
    verified: z.boolean().optional(),
  })),
  characters: z.array(z.object({
    id: z.string(),
    form: z.object({
      characterLevel: z.number().optional(),
      characterEidolon: z.number().optional(),
      lightCone: z.string().nullish(),
      lightConeLevel: z.number().optional(),
      lightConeSuperimposition: z.number().optional(),
    }).passthrough(),
  }).passthrough()).default([]),
}).passthrough();

const PART: Record<string, RelicSlot> = { Head: "HEAD", Hands: "HAND", Body: "BODY", Feet: "FOOT", PlanarSphere: "NECK", LinkRope: "OBJECT" };
/** Fribbels marks reworked-kit variants with a suffix ("1212b1"); the game data id is the base. */
const baseId = (id: string) => id.replace(/b\d+$/i, "");
const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

/**
 * Parse a Fribbels optimizer save into the same shape as an HSR Scanner import.
 * - Relics: the full relic inventory, matched to game-data sets by name.
 * - Characters: level and Eidolon. Fribbels doesn't store trace levels, so for characters you already
 *   have, skills and traces are kept from `existing`; new ones start at 1/1/1/1.
 * - Light Cones: only the ones equipped in Fribbels (it has no Light Cone inventory).
 */
export function parseFribbelsSave(json: unknown, profileId: string, game: GameData, existing: OwnedCharacter[], now = new Date().toISOString()): ParsedScan {
  const res = SaveSchema.safeParse(json);
  if (!res.success) {
    const first = res.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    throw new Error(`Not a Fribbels optimizer save file (${first}).`);
  }
  const d = res.data;
  const issues: string[] = [];
  const setIds = new Map(Object.values(game.relicSets).map((s) => [s.name, s.id]));
  const have = new Map(existing.map((c) => [c.charId, c]));

  const relics: Relic[] = [];
  d.relics.forEach((r, i) => {
    const slot = PART[r.part];
    const setId = setIds.get(r.set);
    if (!slot) return void issues.push(`Relic #${i + 1}: unknown slot "${r.part}" — skipped.`);
    if (!setId) return void issues.push(`Relic #${i + 1}: set "${r.set}" isn't in game data v${game.version} — skipped.`);
    const main = r.main.stat as MainStatKey;
    if (!MAIN_STATS_BY_SLOT[slot].includes(main)) return void issues.push(`Relic #${i + 1} (${r.set}): main stat "${r.main.stat}" isn't valid for ${r.part} — skipped.`);
    if (![2, 3, 4, 5].includes(r.grade)) return void issues.push(`Relic #${i + 1}: rarity ${r.grade} not supported — skipped.`);
    const substats = r.substats.filter((s) => SUB_STATS.includes(s.stat as SubStatKey)).map((s) => ({ key: s.stat as SubStatKey, value: Math.round(s.value * 1000) / 1000 }));
    relics.push({
      uid: `fribbels-relic-${r.id ?? i}`, profileId, setId, name: r.set, slot, rarity: r.grade as 2 | 3 | 4 | 5,
      level: clampInt(r.enhance, 0, 15), mainStat: main, substats,
      location: r.equippedBy ? baseId(r.equippedBy) : "", lock: false, source: "fribbels", updatedAt: now,
    });
  });

  const characters: OwnedCharacter[] = [];
  const lightCones: OwnedLightCone[] = [];
  const seen = new Set<string>();
  for (const c of d.characters) {
    const id = baseId(c.id);
    if (seen.has(id)) continue;
    seen.add(id);
    if (!game.characters[id]) { issues.push(`Character ${c.id} isn't in game data v${game.version} — skipped.`); continue; }
    const level = clampInt(c.form.characterLevel ?? 80, 1, 80);
    const prev = have.get(id);
    characters.push({
      key: `${profileId}:${id}`, profileId, charId: id, level, ascension: ascensionForLevel(level),
      eidolon: clampInt(c.form.characterEidolon ?? 0, 0, 6),
      skills: prev?.skills ?? { basic: 1, skill: 1, ult: 1, talent: 1 },
      traces: prev?.traces ?? {},
      source: "fribbels", updatedAt: now,
    });
    const lc = c.form.lightCone;
    if (lc && game.lightCones[lc]) {
      const lv = clampInt(c.form.lightConeLevel ?? 80, 1, 80);
      lightCones.push({ uid: `fribbels-lc-${id}`, profileId, lcId: lc, level: lv, ascension: ascensionForLevel(lv), superimposition: clampInt(c.form.lightConeSuperimposition ?? 1, 1, 5), location: id, lock: false, source: "fribbels", updatedAt: now });
    }
  }
  if (!relics.length && !characters.length) throw new Error("The save file has no relics or characters this app can read.");
  return { meta: { version: 0, build: "Fribbels optimizer save" }, characters, lightCones, relics, issues };
}
