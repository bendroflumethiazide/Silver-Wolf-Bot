"use client";

import { ThumbsUp, X } from "lucide-react";
import type { GearNeed } from "@/lib/currencywars/gear";
import { combinations, describe, madeFrom } from "@/lib/currencywars/items";
import type { CwPack } from "@/lib/currencywars/sim";
import { Badge, cx } from "../ui";
import { ItemIcon, WhoFaces } from "./shared";

/** One item: what it does, what it's made from, and what it combines into (owned partners marked). */
export function ItemDetail({ pack, name, owned = [], hint, onClose, actions, needs }: {
  pack: CwPack; name: string; owned?: string[]; hint?: string; onClose?: () => void; actions?: React.ReactNode;
  /** Tracked characters' preferences, to show whose recommended equipment an item or combination is. */
  needs?: Map<string, GearNeed[]>;
}) {
  const whoFor = (item: string) => [...new Set((needs?.get(item) ?? []).map((n) => n.who))];
  const d = describe(pack, name);
  const combos = combinations(pack, name);
  const from = madeFrom(pack, name);
  const have = new Set(owned);
  const ready = combos.filter((c) => have.has(c.partner));
  return (
    <div className="rounded-lg border border-cyan/40 bg-cyan/[0.05] p-2.5 text-xs" role="region" aria-label={`${name} details`}>
      <div className="flex items-start gap-2">
        <ItemIcon pack={pack} name={name} size={20} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">{name}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted">{d.kindLabel}</p>
        </div>
        {whoFor(name).length > 0 && <span className="flex items-center gap-1 text-[10px] text-emerald-300"><ThumbsUp size={11} aria-hidden /><WhoFaces pack={pack} names={whoFor(name)} size={20} /></span>}
        {actions}
        {onClose && <button type="button" onClick={onClose} aria-label="Close item details" className="rounded p-1 text-faint hover:text-text"><X size={14} /></button>}
      </div>
      {d.summary && <p className="mt-1.5 text-text/90">{d.summary}</p>}
      {d.details.length > 0 && <ul className="mt-1 space-y-0.5 text-muted">{d.details.map((x) => <li key={x}>{x}</li>)}</ul>}
      {d.users.length > 0 && <p className="mt-1 text-muted">Good on: {d.users.join(", ")}</p>}
      {from.length > 0 && <p className="mt-1 text-muted">Made from: {from.map(([a, b]) => `${a} + ${b}`).join(" or ")}</p>}
      {combos.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 font-medium text-text">{ready.length ? `You can make ${ready.length} now` : "Combines with"}</p>
          <ul className="space-y-1">
            {[...combos].sort((x, y) => (have.has(y.partner) ? 2 : 0) + (whoFor(y.makes).length ? 1 : 0) - (have.has(x.partner) ? 2 : 0) - (whoFor(x.makes).length ? 1 : 0)).map((c) => {
              const r = describe(pack, c.makes);
              return (
                <li key={c.partner}>
                  <details className={cx("rounded-md border px-2 py-1", have.has(c.partner) ? "border-emerald-400/50 bg-emerald-400/[0.06]" : "border-line")}>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-1.5">
                      <span className="text-faint">+</span><ItemIcon pack={pack} name={c.partner} size={12} /><span>{c.partner}</span>
                      <span className="text-faint">→</span><ItemIcon pack={pack} name={c.makes} size={12} /><span className="font-medium text-text">{c.makes}</span>
                      {have.has(c.partner) && <Badge tone="ok">you have it</Badge>}
                      {whoFor(c.makes).length > 0 && <span className="ml-auto flex items-center gap-1 text-emerald-300"><ThumbsUp size={11} aria-hidden /><WhoFaces pack={pack} names={whoFor(c.makes)} size={18} /></span>}
                    </summary>
                    <div className="mt-1 space-y-0.5 text-muted">
                      {r.summary && <p>{r.summary}</p>}
                      {r.details.map((x) => <p key={x}>{x}</p>)}
                      {r.users.length > 0 && <p>Good on: {r.users.join(", ")}</p>}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {hint && <p className="mt-2 text-cyan">{hint}</p>}
    </div>
  );
}
