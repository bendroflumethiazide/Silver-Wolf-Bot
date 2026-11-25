"use client";

import { GRADE_COLOR, type Grade } from "@/lib/builds/grade";

export function GradeTag({ g, size = "sm" }: { g: Grade | null; size?: "sm" | "lg" }) {
  if (!g) return <span className="font-mono text-xs text-faint">—</span>;
  return (
    <span className={size === "lg" ? "font-mono text-3xl font-bold tracking-tight" : "font-mono text-xs font-bold"} style={{ color: GRADE_COLOR[g.letter], textShadow: g.rank >= 18 ? `0 0 12px ${GRADE_COLOR[g.letter]}` : undefined }}>
      {g.label}
    </span>
  );
}
