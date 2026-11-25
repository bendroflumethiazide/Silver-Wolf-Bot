/**
 * Rule-based team analysis. No damage simulation exists, so nothing here predicts damage; it only
 * checks role coverage and investment, and explains every suggestion.
 */
import type { OwnedCharacter } from "./types";

export type Role = "sustain" | "support" | "damage";

/** Coarse role by Path (internal ids). Many characters break these rules; the UI says so. */
export function roleOfPath(path: string): Role {
  if (path === "Knight" || path === "Priest") return "sustain";
  if (path === "Shaman" || path === "Warlock") return "support";
  return "damage";
}

export interface TeamMemberInfo { id: string; path: string; element: string; rarity: number }

export interface TeamAnalysis {
  roles: Record<Role, number>;
  elements: string[];
  missing: string[];
  weaknessHits: string[];
  notes: string[];
}

export function analyzeTeam(members: (TeamMemberInfo | null)[], enemyWeaknesses: string[] = []): TeamAnalysis {
  const m = members.filter((x): x is TeamMemberInfo => !!x);
  const roles: Record<Role, number> = { sustain: 0, support: 0, damage: 0 };
  for (const x of m) roles[roleOfPath(x.path)]++;
  const elements = [...new Set(m.map((x) => x.element))];
  const missing: string[] = [];
  if (m.length < 4) missing.push(`${4 - m.length} empty slot(s)`);
  if (!roles.sustain) missing.push("no sustain (Preservation/Abundance)");
  if (!roles.damage) missing.push("no damage dealer");
  if (!roles.support) missing.push("no Harmony/Nihility support");
  const notes: string[] = [];
  if (roles.sustain > 1) notes.push("Two sustains: safer, but less damage.");
  if (roles.damage > 2) notes.push("Three or more damage dealers compete for Skill Points.");
  return { roles, elements, missing, weaknessHits: elements.filter((e) => enemyWeaknesses.includes(e)), notes };
}

/** Investment score 0–100 from recorded progress. Transparent and coarse by design. */
export function investment(c: OwnedCharacter, rarity: number): number {
  const lvl = (c.level / 80) * 50;
  const skills = ((c.skills.skill + c.skills.ult + c.skills.talent) / 30) * 25;
  const eid = (c.eidolon / 6) * 10;
  const rar = rarity >= 5 ? 15 : 8;
  return Math.round(lvl + skills + eid + rar);
}

export interface SuggestedTeam { members: string[]; reasons: string[] }

/**
 * Greedy, explainable team assembly: builds `count` teams without reusing a character.
 * Each team takes the best-invested sustain, then support(s), then damage dealers.
 */
export function suggestTeams(pool: { info: TeamMemberInfo; invest: number }[], count: number): SuggestedTeam[] {
  const left = [...pool].sort((a, b) => b.invest - a.invest);
  const take = (role: Role) => {
    const i = left.findIndex((p) => roleOfPath(p.info.path) === role);
    return i === -1 ? null : left.splice(i, 1)[0];
  };
  const teams: SuggestedTeam[] = [];
  for (let t = 0; t < count; t++) {
    const members: typeof pool = [];
    const reasons: string[] = [];
    const sustain = take("sustain");
    if (sustain) { members.push(sustain); reasons.push(`Sustain: highest-invested Preservation/Abundance unit (score ${sustain.invest}).`); }
    else reasons.push("No sustain left — this team has no healer or shielder.");
    const dps = take("damage");
    if (dps) { members.push(dps); reasons.push(`Main damage: highest-invested damage Path unit left (score ${dps.invest}).`); }
    const sup = take("support");
    if (sup) { members.push(sup); reasons.push(`Support: highest-invested Harmony/Nihility unit (score ${sup.invest}).`); }
    while (members.length < 4 && left.length) {
      const next = take("support") ?? take("damage") ?? left.shift()!;
      members.push(next);
      reasons.push(`Flex slot: next best by investment (score ${next.invest}).`);
    }
    if (!members.length) break;
    teams.push({ members: members.map((m) => m.info.id), reasons });
  }
  return teams;
}
