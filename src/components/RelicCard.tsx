"use client";

import { Lock } from "lucide-react";
import type { RelicScore } from "@/lib/relics/scoring";
import { formatStat, SLOT_LABEL } from "@/lib/relics/stats";
import type { Relic } from "@/lib/types";
import { grade } from "@/lib/builds/grade";
import { GradeTag } from "./GradeTag";
import { cx, SourceBadge } from "./ui";

export const VERDICT_TONE = { keep: "gold", good: "cyan", usable: "default", fodder: "bad" } as const;

export function RelicCard({ relic, setName, ownerName, score, onClick }: { relic: Relic; setName: string; ownerName?: string; score: RelicScore; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cx("glass w-full rarity-border p-3 text-left transition hover:border-violet/50", `rarity-${relic.rarity}`)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{SLOT_LABEL[relic.slot]} <span className="text-muted">+{relic.level}</span></div>
          <div className="truncate text-[11px] text-muted">{setName}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="flex items-baseline gap-1 font-mono text-xs"><span className="text-muted">{score.score.toFixed(1)}</span><GradeTag g={grade(score.mainStatFits ? (score.remainingUpgrades ? score.expectedAtMax : score.score) : score.score * 0.5)} /></span>
          {relic.lock && <Lock size={11} className="text-faint" aria-label="Locked" />}
        </div>
      </div>
      <div className="mt-2 text-xs text-violet">{relic.mainStat}</div>
      <ul className="mt-1 space-y-0.5 text-xs">
        {score.breakdown.map((b) => (
          <li key={b.key} className="flex justify-between gap-2">
            <span className={b.weight > 0 ? "text-text" : "text-faint"}>{b.key}</span>
            <span className="font-mono text-muted">{formatStat(b.key, b.value)} <span className="text-faint">({b.rolls.toFixed(1)}r)</span></span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-faint">
        <span className="truncate">{ownerName ? `on ${ownerName}` : "unequipped"}</span>
        <SourceBadge source={relic.source} />
      </div>
    </button>
  );
}
