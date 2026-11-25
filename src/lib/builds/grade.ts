/**
 * Letter grades, lowest to highest: D, C, B, A, S, SS, SSS, WTF — each split into -, plain, +.
 * Input is a 0–100 score where 100 = the best possible piece/build for the character's profile.
 */
export const GRADE_LETTERS = ["D", "C", "B", "A", "S", "SS", "SSS", "WTF"] as const;
export type GradeLetter = (typeof GRADE_LETTERS)[number];

/** Lower bound of each letter band (score out of 100). */
export const GRADE_BANDS: [number, GradeLetter][] = [
  [0, "D"], [15, "C"], [25, "B"], [35, "A"], [45, "S"], [55, "SS"], [65, "SSS"], [80, "WTF"],
];

export interface Grade {
  letter: GradeLetter;
  modifier: "-" | "" | "+";
  label: string;
  /** 0..23, for comparisons and colour scales. */
  rank: number;
}

export function grade(score: number): Grade {
  const s = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
  let i = 0;
  for (let k = 0; k < GRADE_BANDS.length; k++) if (s >= GRADE_BANDS[k][0]) i = k;
  const lo = GRADE_BANDS[i][0];
  const hi = i + 1 < GRADE_BANDS.length ? GRADE_BANDS[i + 1][0] : 100.0001;
  const pos = (s - lo) / (hi - lo);
  const modifier = pos < 1 / 3 ? "-" : pos >= 2 / 3 ? "+" : "";
  const letter = GRADE_BANDS[i][1];
  return { letter, modifier, label: `${letter}${modifier}`, rank: i * 3 + (modifier === "-" ? 0 : modifier === "" ? 1 : 2) };
}

/** Tailwind-friendly colour per letter. */
export const GRADE_COLOR: Record<GradeLetter, string> = {
  D: "#8b8aa3", C: "#6fd19b", B: "#6aa7ff", A: "#b38cff", S: "#e9c46a", SS: "#f59e0b", SSS: "#f472b6", WTF: "#5ee6f0",
};
