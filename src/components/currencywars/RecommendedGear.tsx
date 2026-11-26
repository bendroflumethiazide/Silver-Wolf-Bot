"use client";

import { useState } from "react";
import { recommendedFor } from "@/lib/currencywars/gear";
import { madeFrom } from "@/lib/currencywars/items";
import type { CwPack } from "@/lib/currencywars/sim";
import { Badge, cx } from "../ui";
import { ItemDetail } from "./ItemDetail";
import { ItemIcon } from "./shared";

type Status = "held" | "ready" | "partial" | "none";

/** Whether a recommended item is held, can be made from what you have, or you have one part. */
export function gearStatus(pack: CwPack, item: string, held: string[], bag: string[]): Status {
  if (held.includes(item)) return "held";
  const recipe = madeFrom(pack, item)[0];
  if (!recipe) return bag.includes(item) ? "ready" : "none";
  const pool = [...bag, ...held];
  const [a, b] = recipe;
  const countA = pool.filter((x) => x === a).length, countB = pool.filter((x) => x === b).length;
  if (bag.includes(item) || (a === b ? countA >= 2 : countA >= 1 && countB >= 1)) return "ready";
  return countA + countB > 0 ? "partial" : "none";
}

/** Recommended equipment groups for a character, the one for their position first. */
export function recommendedGroups(pack: CwPack, name: string, place?: "on" | "off" | "bench") {
  const groups = pack.info?.[name]?.recommended ?? [];
  const want = place === "off" ? /^off/i : place === "on" ? /^on/i : null;
  return want ? [...groups].sort((x, y) => Number(want.test(y.group)) - Number(want.test(x.group))) : groups;
}

export { recommendedFor };

const STATUS: Record<Status, { label: string; tone: "ok" | "cyan" | "warn" | "default" } | null> = {
  held: { label: "equipped", tone: "ok" },
  ready: { label: "can make", tone: "cyan" },
  partial: { label: "have a part", tone: "warn" },
  none: null,
};

/** Recommended equipment, like the game's "Recommended" panel: recipe, status, and details on tap. */
export function RecommendedGear({ pack, name, place, held = [], bag = [], compact }: {
  pack: CwPack; name: string; place?: "on" | "off" | "bench"; held?: string[]; bag?: string[]; compact?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const groups = recommendedGroups(pack, name, place);
  if (!groups.length) return null;
  const shown = compact ? groups.slice(0, 1) : groups;
  return (
    <div className="space-y-1.5" aria-label={`${name} recommended equipment`}>
      {shown.map((g) => (
        <div key={g.group}>
          {(groups.length > 1 || g.group !== "All") && <p className="mb-1 text-[10px] uppercase tracking-wider text-faint">{g.group === "All" ? "Recommended" : `Recommended · ${g.group}`}</p>}
          <ul className={cx("grid gap-1.5", compact ? "grid-cols-3" : "sm:grid-cols-3")}>
            {g.items.map((it) => {
              const st = gearStatus(pack, it, held, bag);
              const recipe = madeFrom(pack, it)[0];
              return (
                <li key={it}>
                  <button type="button" onClick={() => setOpen(open === it ? null : it)} aria-expanded={open === it}
                    className={cx("flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[11px] transition", open === it ? "border-cyan bg-cyan/10" : st === "held" ? "border-emerald-400/60 bg-emerald-400/[0.06]" : st === "ready" ? "border-cyan/50" : "border-line hover:border-cyan/40")}>
                    <ItemIcon pack={pack} name={it} size={compact ? 14 : 16} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-text">{it}</span>
                      {!compact && recipe && <span className="block truncate text-[10px] text-faint">{recipe[0]} + {recipe[1]}</span>}
                    </span>
                    {STATUS[st] && <Badge tone={STATUS[st]!.tone}>{compact ? (st === "held" ? "✓" : st === "ready" ? "make" : "½") : STATUS[st]!.label}</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {open && <ItemDetail pack={pack} name={open} owned={[...bag, ...held]} onClose={() => setOpen(null)} />}
    </div>
  );
}
