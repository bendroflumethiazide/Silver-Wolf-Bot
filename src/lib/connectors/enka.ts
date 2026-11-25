/**
 * Enka.Network public showcase connector (read-only, UID only, no login).
 * Format follows the HSR showcase structure documented by Enka.Network and community libraries.
 * Protobuf-style defaults: numeric fields equal to 0 may be omitted, so every field has a default.
 * NOTE: not verified against a live response from this development environment (host blocked);
 * covered by fixture tests. Unknown/missing ids are reported, never guessed.
 */
import { z } from "zod";
import type { GameData } from "../gamedata/types";
import { kitTrees } from "../gamedata/types";
import { classifyNodes } from "../materials/plan";
import type { RelicSubstat } from "../relics/scoring";
import { isPercentStat, PROPERTY_TO_STAT, type MainStatKey, type RelicSlot, type SubStatKey } from "../relics/stats";
import type { OwnedCharacter, OwnedLightCone, Profile, Relic } from "../types";

export interface ConnectorCapabilities {
  id: string;
  name: string;
  readOnly: true;
  requiresSecret: boolean;
  provides: string[];
  doesNotProvide: string[];
}

export const ENKA_CAPABILITIES: ConnectorCapabilities = {
  id: "enka",
  name: "Enka.Network public showcase",
  readOnly: true,
  requiresSecret: false,
  provides: [
    "Nickname, Trailblaze Level, Equilibrium Level, signature",
    "Achievement, character, Light Cone and relic counts",
    "Up to the characters placed in the in-game showcase: level, ascension, Eidolon, traces, Light Cone, relics",
  ],
  doesNotProvide: [
    "Characters not in the showcase", "Full relic or Light Cone inventory", "Warp history", "Stellar Jade or passes",
    "Map exploration or treasure completion", "Per-achievement completion", "Endgame scores per floor",
  ],
};

const n = z.number().optional().default(0);
const Relic = z.object({ tid: z.number(), type: n, level: n, mainAffixId: n, subAffixList: z.array(z.object({ affixId: z.number(), cnt: n, step: n })).optional().default([]) }).passthrough();
const Avatar = z.object({
  avatarId: z.number(), level: n, promotion: n, rank: n,
  skillTreeList: z.array(z.object({ pointId: z.number(), level: n })).optional().default([]),
  equipment: z.object({ tid: z.number(), level: n, promotion: n, rank: n }).passthrough().optional(),
  relicList: z.array(Relic).optional().default([]),
}).passthrough();
export const EnkaResponse = z.object({
  detailInfo: z.object({
    uid: z.union([z.number(), z.string()]).optional(), nickname: z.string().optional().default(""), level: n, worldLevel: n,
    signature: z.string().optional(), isDisplayAvatar: z.boolean().optional(),
    recordInfo: z.object({ achievementCount: n, avatarCount: n, equipmentCount: n, relicCount: n, bookCount: n, musicCount: n }).passthrough().optional(),
    avatarDetailList: z.array(Avatar).optional().default([]),
    assistAvatarList: z.array(Avatar).optional().default([]),
  }).passthrough(),
  ttl: z.number().optional(),
}).passthrough();
export type EnkaData = z.infer<typeof EnkaResponse>;

const SLOT_BY_TYPE: Record<string, RelicSlot> = { HEAD: "HEAD", HAND: "HAND", BODY: "BODY", FOOT: "FOOT", NECK: "NECK", OBJECT: "OBJECT" };

export interface EnkaParsed {
  profile: Partial<Profile>;
  characters: OwnedCharacter[];
  lightCones: OwnedLightCone[];
  relics: Relic[];
  warnings: string[];
}

export function parseEnka(raw: unknown, game: GameData, profileId: string, now = new Date().toISOString()): EnkaParsed {
  const res = EnkaResponse.safeParse(raw);
  if (!res.success) throw new Error(`Unexpected showcase format: ${res.error.issues[0]?.path.join(".")} ${res.error.issues[0]?.message}`);
  const d = res.data.detailInfo;
  const warnings: string[] = [];
  const avatars = [...d.avatarDetailList];
  for (const a of d.assistAvatarList) if (!avatars.some((x) => x.avatarId === a.avatarId)) avatars.push(a);

  const characters: OwnedCharacter[] = [];
  const lightCones: OwnedLightCone[] = [];
  const relics: Relic[] = [];

  for (const a of avatars) {
    const id = String(a.avatarId);
    const c = game.characters[id];
    if (!c) { warnings.push(`Character ${id} is not in your game data (v${game.version}); update game data.`); continue; }
    const points = new Map(a.skillTreeList.map((p) => [String(p.pointId), p.level]));
    const nodes = kitTrees(c, "original").map((t) => game.characterSkillTrees[t]).filter(Boolean);
    const { abilities, stats } = classifyNodes(nodes);
    const lvl = (anchor: string) => {
      const node = nodes.find((x) => x.anchor === anchor);
      return node ? points.get(node.id) ?? 1 : 1;
    };
    const traces: Record<string, boolean> = {};
    abilities.forEach((x, i) => (traces[`ability_${i + 1}`] = (points.get(x.id) ?? 0) > 0));
    stats.forEach((x, i) => (traces[`stat_${i + 1}`] = (points.get(x.id) ?? 0) > 0));
    characters.push({
      key: `${profileId}:${id}`, profileId, charId: id, level: a.level || 1, ascension: a.promotion, eidolon: a.rank,
      skills: { basic: lvl("Point01"), skill: lvl("Point02"), ult: lvl("Point03"), talent: lvl("Point04") },
      traces, source: "enka", updatedAt: now,
    });
    if (a.equipment) {
      const lcId = String(a.equipment.tid);
      if (!game.lightCones[lcId]) warnings.push(`Light Cone ${lcId} on ${c.name} is not in your game data.`);
      else lightCones.push({ uid: `enka-lc-${id}`, profileId, lcId, level: a.equipment.level || 1, ascension: a.equipment.promotion, superimposition: (a.equipment.rank || 1), location: id, lock: false, source: "enka", updatedAt: now });
    }
    a.relicList.forEach((r, i) => {
      const meta = game.relics[String(r.tid)];
      if (!meta) return void warnings.push(`Relic ${r.tid} on ${c.name} is not in your game data.`);
      const slot = SLOT_BY_TYPE[meta.type];
      const mainAff = game.relicMainAffixes[meta.main_affix_id]?.affixes[String(r.mainAffixId)];
      const main = mainAff ? (PROPERTY_TO_STAT[mainAff.property] as MainStatKey | undefined) : undefined;
      if (!slot || !main) return void warnings.push(`Relic ${r.tid} on ${c.name}: unknown slot or main stat.`);
      const subs: RelicSubstat[] = [];
      for (const s of r.subAffixList) {
        const aff = game.relicSubAffixes[meta.sub_affix_id]?.affixes[String(s.affixId)];
        const key = aff ? (PROPERTY_TO_STAT[aff.property] as SubStatKey | undefined) : undefined;
        if (!aff || !key) { warnings.push(`Relic ${r.tid}: unknown substat ${s.affixId}.`); continue; }
        const raw = aff.base * s.cnt + aff.step * s.step;
        subs.push({ key, value: round(isPercentStat(key) ? raw * 100 : raw) });
      }
      relics.push({
        uid: `enka-relic-${id}-${i}`, profileId, setId: meta.set_id, name: meta.name, slot, rarity: Math.min(5, Math.max(2, meta.rarity)) as Relic["rarity"],
        level: r.level, mainStat: main, substats: subs, location: id, lock: false, source: "enka", updatedAt: now,
      });
    });
  }
  if (d.isDisplayAvatar === false) warnings.push("This account hides its character showcase details in game; only profile statistics were read.");

  return {
    profile: {
      uid: d.uid !== undefined ? String(d.uid) : undefined,
      name: d.nickname || undefined,
      trailblazeLevel: d.level || undefined,
      equilibriumLevel: d.worldLevel,
      signature: d.signature,
      stats: d.recordInfo ? { achievements: d.recordInfo.achievementCount, characters: d.recordInfo.avatarCount, lightCones: d.recordInfo.equipmentCount, relics: d.recordInfo.relicCount, books: d.recordInfo.bookCount, music: d.recordInfo.musicCount } : undefined,
      source: "enka",
      syncedAt: now,
    },
    characters, lightCones, relics, warnings,
  };
}

const round = (v: number) => Math.round(v * 1000) / 1000;
