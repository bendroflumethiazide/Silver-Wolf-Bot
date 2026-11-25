import { z } from "zod";
import { scannerMainStat, scannerSlot, scannerSubStat } from "../relics/stats";
import type { OwnedCharacter, OwnedLightCone, Relic } from "../types";

/** HSR Scanner (kel-z/HSR-Scanner) output, format versions 3–4. Unknown keys are ignored. */
const Stat = z.object({ key: z.string(), value: z.number() });
const ScannerSchema = z.object({
  source: z.literal("HSR-Scanner"),
  version: z.number().int().min(3),
  build: z.string().optional(),
  metadata: z.object({ uid: z.union([z.number(), z.string()]).nullish(), trailblazer: z.string().optional() }).optional(),
  light_cones: z
    .array(z.object({
      id: z.string(), name: z.string().optional(), level: z.number().int(), ascension: z.number().int(),
      superimposition: z.number().int(), location: z.string().default(""), lock: z.boolean().default(false),
      _uid: z.string().optional(),
    }))
    .optional(),
  relics: z
    .array(z.object({
      set_id: z.string(), name: z.string().optional(), slot: z.string(), rarity: z.number().int(), level: z.number().int(),
      mainstat: z.string(), substats: z.array(Stat), preview_substats: z.array(Stat).optional(),
      location: z.string().default(""), lock: z.boolean().default(false), discard: z.boolean().optional(), _uid: z.string().optional(),
    }))
    .optional(),
  characters: z
    .array(z.object({
      id: z.string(), name: z.string().optional(), path: z.string().optional(), level: z.number().int(),
      ascension: z.number().int(), eidolon: z.number().int(),
      skills: z.object({ basic: z.number(), skill: z.number(), ult: z.number(), talent: z.number(), elation: z.number().optional() }),
      traces: z.record(z.string(), z.boolean()).default({}),
      memosprite: z.object({ skill: z.number(), talent: z.number() }).optional(),
    }))
    .optional(),
});

export interface ParsedScan {
  meta: { build?: string; version: number; uid?: string };
  characters: OwnedCharacter[];
  lightCones: OwnedLightCone[];
  relics: Relic[];
  issues: string[];
}

const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

export function parseHsrScanner(json: unknown, profileId: string, now = new Date().toISOString()): ParsedScan {
  const res = ScannerSchema.safeParse(json);
  if (!res.success) {
    const first = res.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    throw new Error(`Not a valid HSR Scanner export (${first}).`);
  }
  const d = res.data;
  const issues: string[] = [];

  const characters: OwnedCharacter[] = (d.characters ?? []).map((c) => ({
    key: `${profileId}:${c.id}`,
    profileId,
    charId: c.id,
    level: clampInt(c.level, 1, 80),
    ascension: clampInt(c.ascension, 0, 6),
    eidolon: clampInt(c.eidolon, 0, 6),
    skills: {
      basic: c.skills.basic, skill: c.skills.skill, ult: c.skills.ult, talent: c.skills.talent,
      ...(c.skills.elation !== undefined ? { elation: c.skills.elation } : {}),
      ...(c.memosprite ? { memoSkill: c.memosprite.skill, memoTalent: c.memosprite.talent } : {}),
    },
    traces: c.traces,
    source: "hsr-scanner",
    updatedAt: now,
  }));

  const lightCones: OwnedLightCone[] = (d.light_cones ?? []).map((l, i) => ({
    uid: `scan-lc-${i}-${l.id}`,
    profileId,
    lcId: l.id,
    level: clampInt(l.level, 1, 80),
    ascension: clampInt(l.ascension, 0, 6),
    superimposition: clampInt(l.superimposition, 1, 5),
    location: l.location,
    lock: l.lock,
    source: "hsr-scanner",
    updatedAt: now,
  }));

  const relics: Relic[] = [];
  (d.relics ?? []).forEach((r, i) => {
    const slot = scannerSlot(r.slot);
    if (!slot) return void issues.push(`Relic #${i + 1} (${r.name ?? r.set_id}): unknown slot "${r.slot}" — skipped.`);
    const main = scannerMainStat(r.mainstat, slot);
    if (!main) return void issues.push(`Relic #${i + 1} (${r.name ?? r.set_id}): main stat "${r.mainstat}" is not valid for ${r.slot} — skipped.`);
    if (![2, 3, 4, 5].includes(r.rarity)) return void issues.push(`Relic #${i + 1}: rarity ${r.rarity} not supported — skipped.`);
    const subs = [];
    for (const s of r.substats) {
      const k = scannerSubStat(s.key);
      if (!k) { issues.push(`Relic #${i + 1}: unknown substat "${s.key}" ignored.`); continue; }
      subs.push({ key: k, value: s.value });
    }
    relics.push({
      uid: `scan-relic-${i}`,
      profileId,
      setId: r.set_id,
      name: r.name,
      slot,
      rarity: r.rarity as 2 | 3 | 4 | 5,
      level: clampInt(r.level, 0, 15),
      mainStat: main,
      substats: subs,
      location: r.location,
      lock: r.lock,
      discard: r.discard,
      source: "hsr-scanner",
      updatedAt: now,
    });
  });

  if (d.relics?.some((r) => r.substats.some((s) => s.key === "SPD")))
    issues.push("Note: HSR Scanner cannot read the hidden decimals of SPD substats, so SPD totals may read slightly low.");

  return {
    meta: { build: d.build, version: d.version, uid: d.metadata?.uid != null ? String(d.metadata.uid) : undefined },
    characters,
    lightCones,
    relics,
    issues,
  };
}

/** Content fingerprint used to recognise the same relic across scans (scanner `_uid`s are per-scan). */
export function relicFingerprint(r: Pick<Relic, "setId" | "slot" | "rarity" | "level" | "mainStat" | "substats">): string {
  const subs = [...r.substats].sort((a, b) => a.key.localeCompare(b.key)).map((s) => `${s.key}=${s.value}`).join(",");
  return `${r.setId}|${r.slot}|${r.rarity}|${r.level}|${r.mainStat}|${subs}`;
}

export function lightConeFingerprint(l: Pick<OwnedLightCone, "lcId" | "level" | "ascension" | "superimposition">): string {
  return `${l.lcId}|${l.level}|${l.ascension}|${l.superimposition}`;
}
