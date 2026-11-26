/**
 * A character's Currency Wars stats, laid out like the game's "Stats Details": base values by star from
 * their wiki page, plus boosts from the equipment they hold (item stat lines from the wiki).
 * Bond, Plot Armor and in-battle effects aren't added. Base Lucky Strike Rate (5%) and Lucky Strike DMG
 * (100%) are the values the game's Stats Details shows.
 */
import type { CwPack } from "./sim";

export type StatKey =
  | "onField" | "offField" | "dmgAmp" | "basicAmp" | "skillAmp" | "ultAmp" | "fuaAmp" | "dotAmp" | "breakAmp" | "elationAmp"
  | "mitigation" | "luckyRate" | "luckyDmg" | "spdAmp" | "healing" | "shield" | "hpAmp" | "breakEff" | "initialEnergy";

/** Stat names as the wiki and the game write them → key(s). */
const NAMES: [RegExp, StatKey[]][] = [
  [/^On[- ]?Field\/Off[- ]?Field Strength$|^On\/Off[- ]?Field Strength$/i, ["onField", "offField"]],
  [/^On[- ]?Field Strength$/i, ["onField"]],
  [/^Off[- ]?Field Strength$/i, ["offField"]],
  [/^Basic ATK DMG Amplification$/i, ["basicAmp"]],
  [/^Skill DMG Amplification$/i, ["skillAmp"]],
  [/^Ultimate DMG Amplification$/i, ["ultAmp"]],
  [/^Follow-Up ATK DMG Amplification$/i, ["fuaAmp"]],
  [/^DoT (?:DMG )?Amplification$/i, ["dotAmp"]],
  [/^Break DMG Amplification$/i, ["breakAmp"]],
  [/^Elation DMG Amplification$/i, ["elationAmp"]],
  [/^DMG Amplification$/i, ["dmgAmp"]],
  [/^DMG Mitigation$/i, ["mitigation"]],
  [/^Lucky Strike Rate$/i, ["luckyRate"]],
  [/^Lucky Strike DMG$/i, ["luckyDmg"]],
  [/^SPD Amplification$/i, ["spdAmp"]],
  [/^Healing Strength$/i, ["healing"]],
  [/^Shield Strength$/i, ["shield"]],
  [/^HP Amplification$/i, ["hpAmp"]],
  [/^Break Efficiency$/i, ["breakEff"]],
  [/^Initial Energy$/i, ["initialEnergy"]],
];

/** "SPD Amplification: 5%" or "On-Field Strength 25%/50%" → keys and the (advanced, not privileged) value. */
export function parseStatLine(line: string): { keys: StatKey[]; value: number } | null {
  const m = /^(.+?):?\s+([\d.]+)%?(?:\/[\d.]+%?)?$/.exec(line.trim());
  if (!m) return null;
  const hit = NAMES.find(([re]) => re.test(m[1].trim()));
  return hit ? { keys: hit[1], value: Number(m[2]) } : null;
}

/** Stat lines of one item (basic, advanced or Emblem). */
export function itemStatLines(pack: CwPack, item: string): string[] {
  const eq = pack.equipment;
  const basic = eq?.basic.find((b) => b.name === item);
  if (basic) return basic.stats.split(" · ");
  return eq?.advanced.find((a) => a.name === item.replace(/: Privilege$/, ""))?.stats ?? eq?.emblems?.find((e) => e.name === item)?.stats ?? [];
}

export function itemBoosts(pack: CwPack, items: string[]): Partial<Record<StatKey, number>> {
  const out: Partial<Record<StatKey, number>> = {};
  for (const it of items) for (const line of itemStatLines(pack, it)) {
    const p = parseStatLine(line);
    if (p) for (const k of p.keys) out[k] = (out[k] ?? 0) + p.value;
  }
  return out;
}

export interface StatRow {
  key: StatKey;
  label: string;
  /** Final value shown in the header row. */
  total: number;
  percent: boolean;
  parts: { label: string; value: number; boost?: boolean; percent: boolean }[];
}

export const BASE_LUCKY_RATE = 5;
export const BASE_LUCKY_DMG = 100;

/** Highest star the character's page lists (3, or 4 for a few). */
export const maxStars = (pack: CwPack, name: string) => Math.max(3, pack.info?.[name]?.onField.length ?? 3);

export function characterStats(pack: CwPack, name: string, stars: number, items: string[] = []): StatRow[] {
  const info = pack.info?.[name];
  const i = Math.max(0, stars - 1);
  const at = (arr: number[] | undefined) => (arr?.length ? arr[Math.min(i, arr.length - 1)] : 0);
  const b = itemBoosts(pack, items);
  const v = (k: StatKey) => b[k] ?? 0;
  const scaled = (key: StatKey, label: string, base: number, baseLabel: string, boostLabel: string): StatRow => ({
    key, label, total: Math.round(base * (1 + v(key) / 100)), percent: false,
    parts: [{ label: baseLabel, value: base, percent: false }, { label: boostLabel, value: v(key), boost: true, percent: true }],
  });
  const added = (key: StatKey, label: string, base: number | null, baseLabel: string, boostLabel: string): StatRow => ({
    key, label, total: (base ?? 0) + v(key), percent: true,
    parts: [...(base !== null ? [{ label: baseLabel, value: base, percent: true }] : []), { label: boostLabel, value: v(key), boost: true, percent: true }],
  });
  const rows: StatRow[] = [
    scaled("onField", "On-Field Strength", at(info?.onField), "Base On-Field Strength", "On-Field Strength Boost"),
    scaled("offField", "Off-Field Strength", at(info?.offField), "Base Off-Field Strength", "Increases Off-Field Strength"),
    {
      key: "dmgAmp", label: "DMG Amplification", total: v("dmgAmp"), percent: true,
      parts: ([["dmgAmp", "DMG Amplification"], ["basicAmp", "Basic ATK DMG Amplification"], ["skillAmp", "Skill DMG Amplification"], ["ultAmp", "Ultimate DMG Amplification"], ["fuaAmp", "Follow-Up ATK DMG Amplification"], ["dotAmp", "DoT Amplification"], ["breakAmp", "Break DMG Amplification"], ["elationAmp", "Elation DMG Amplification"]] as [StatKey, string][])
        .map(([k, label]) => ({ label, value: v(k), boost: true, percent: true })),
    },
    added("mitigation", "DMG Mitigation", null, "", "DMG Mitigation"),
    added("luckyRate", "Lucky Strike Rate", BASE_LUCKY_RATE, "Base Lucky Strike Rate", "Lucky Strike Rate Boost"),
    added("luckyDmg", "Lucky Strike DMG", BASE_LUCKY_DMG, "Base Lucky Strike DMG", "Lucky Strike DMG Boost"),
    added("spdAmp", "SPD Amplification", at(info?.spd), "Base SPD Amplification", "SPD Amplification Boost"),
    scaled("healing", "Healing Strength", at(info?.healing), "Base Healing Strength", "Increases Healing Strength"),
    scaled("shield", "Shield Strength", at(info?.shield), "Base Shield Strength", "Increases Shield Strength"),
    added("hpAmp", "HP Amplification", at(info?.hp), "Base HP Amplification", "HP Amplification Boost"),
  ];
  if (v("breakEff")) rows.push(added("breakEff", "Break Efficiency", null, "", "Break Efficiency"));
  if (v("initialEnergy")) rows.push({ key: "initialEnergy", label: "Initial Energy", total: v("initialEnergy"), percent: false, parts: [{ label: "Initial Energy", value: v("initialEnergy"), boost: true, percent: false }] });
  return rows;
}

/** "150%/187%/270%" → the pieces, so the current star's value can be highlighted. */
export const STAR_VALUES = /(\d[\d,.]*%?(?:\/\d[\d,.]*%?){2,4})/g;
