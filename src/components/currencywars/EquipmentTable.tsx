"use client";

import { useState } from "react";
import { recipe } from "@/lib/currencywars/run";
import type { CwPack } from "@/lib/currencywars/sim";
import { Badge, cx, Empty, Notice, Panel } from "../ui";
import { ItemIcon } from "./shared";

/** The in-game "Weapon Combinations" grid: basic × basic → advanced, with details for the picked one. */
export function EquipmentTable({ pack }: { pack: CwPack }) {
  const eq = pack.equipment;
  const [pick, setPick] = useState<string | null>(eq?.advanced[0]?.name ?? null);
  const [who, setWho] = useState("");
  if (!eq?.basic.length) return <Empty title="No equipment data">Press Update at the top to download the equipment page.</Empty>;
  const sel = eq.advanced.find((a) => a.name === pick);
  const forWho = who ? eq.advanced.filter((a) => a.users.includes(who)) : [];
  const users = [...new Set(eq.advanced.flatMap((a) => a.users))].sort();

  return (
    <div className="space-y-5">
      <Panel title="Weapon combinations">
        <p className="mb-3 text-xs text-muted">Any two basic items make one advanced item. It keeps both items&apos; stats and adds its own effect. Tap a square.</p>
        <div className="relative -mx-1 max-w-full overflow-x-auto px-1 pb-1">
          <table className="border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-9" />
                {eq.basic.map((b) => <th key={b.name} title={`${b.name}: ${b.stats}`} className="h-9 w-12 rounded-md bg-white/[0.04]"><span className="flex justify-center"><ItemIcon pack={pack} name={b.name} size={18} /></span><span className="sr-only">{b.name}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {eq.basic.map((row) => (
                <tr key={row.name}>
                  <th title={`${row.name}: ${row.stats}`} className="h-12 w-9 rounded-md bg-white/[0.04]"><span className="flex justify-center"><ItemIcon pack={pack} name={row.name} size={18} /></span><span className="sr-only">{row.name}</span></th>
                  {eq.basic.map((col) => {
                    const r = recipe(pack, row.name, col.name);
                    return (
                      <td key={col.name} className="p-0">
                        {r ? (
                          <button type="button" onClick={() => setPick(r.name)} title={r.name} aria-label={`${row.name} + ${col.name}: ${r.name}`}
                            className={cx("flex h-12 w-12 items-center justify-center rounded-md border transition", pick === r.name ? "border-cyan bg-cyan/15" : forWho.some((f) => f.name === r.name) ? "border-amber-300/70 bg-amber-300/10" : "border-line bg-white/[0.03] hover:border-cyan/50")}>
                            <ItemIcon pack={pack} name={r.name} size={20} />
                          </button>
                        ) : <span className="block h-12 w-12 rounded-md bg-white/[0.02]" />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <label className="flex min-w-0 max-w-full items-center gap-2">Highlight items for
            <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Highlight items for a character" className="w-44 min-w-0 max-w-full"><option value="">nobody</option>{users.map((u) => <option key={u}>{u}</option>)}</select>
          </label>
          {who && <span>{forWho.length} items listed as good on {who}.</span>}
        </div>
      </Panel>

      {sel && (
        <Panel title={<span className="flex items-center gap-2"><ItemIcon pack={pack} name={sel.name} size={18} /> {sel.name}</span>}>
          <div className="flex flex-wrap gap-1.5">{sel.tags.map((t) => <Badge key={t} tone="violet">{t}</Badge>)}</div>
          <p className="mt-2 text-sm">{sel.effect}</p>
          <ul className="mt-2 space-y-0.5 text-xs text-muted">{sel.stats.map((s) => <li key={s}>{s}</li>)}</ul>
          <p className="mt-2 text-xs text-muted">Made from <b className="text-text">{sel.recipe[0]}</b> + <b className="text-text">{sel.recipe[1]}</b>. Numbers are “advanced/privileged”: the privileged version is the stronger copy of the same item.</p>
          {sel.users.length > 0 && <p className="mt-2 text-xs"><span className="text-muted">Good on: </span>{sel.users.join(", ")}</p>}
        </Panel>
      )}

      <Panel title="Basic equipment">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {eq.basic.map((b) => (
            <li key={b.name} className="flex items-center gap-2 rounded-lg border border-line p-2">
              <ItemIcon pack={pack} name={b.name} size={20} />
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{b.name}</span><span className="block text-[11px] text-muted">{b.stats}</span></span>
            </li>
          ))}
        </ul>
        <div className="mt-3"><Notice>Each character holds up to 3 items. A Disassembly Wrench takes items off; a Smelting Furnace rerolls an item into another of the same quality.</Notice></div>
      </Panel>

      {(eq.emblems?.length ?? 0) > 0 && (
        <Panel title={`Emblems (${eq.emblems!.length})`}>
          <p className="mb-3 text-xs text-muted">An Emblem puts its wearer in that Bond and counts toward it. Red Gem + a basic item makes a Faction Emblem; Blue Gem + a basic item makes a School Emblem.</p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {eq.emblems!.map((e) => (
              <li key={e.name} className="rounded-lg border border-amber-200/25 p-2.5">
                <div className="flex items-center gap-2"><ItemIcon pack={pack} name={e.name} size={18} /><b className="text-sm">{e.name}</b></div>
                <p className="mt-1 text-xs text-muted">{e.effect}</p>
                <p className="mt-1 text-[11px] text-faint">{e.stats.join(" · ")}{e.recipe ? ` · ${e.recipe[0]} + ${e.recipe[1]}` : " · not craftable"}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {(eq.gems?.length ?? 0) > 0 && (
        <Panel title="Gems">
          <ul className="grid gap-2 sm:grid-cols-3">
            {eq.gems!.map((g) => (
              <li key={g.name} className="rounded-lg border border-line p-2.5">
                <div className="flex items-center gap-2"><ItemIcon pack={pack} name={g.name} size={18} /><b className="text-sm">{g.name}</b></div>
                <p className="mt-1 text-xs text-muted">{g.effect}</p>
                {g.recipes.length > 0 && <p className="mt-1 text-[11px] text-faint">From {g.recipes.map(([a, b]) => `${a} + ${b}`).join(" or ")}</p>}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
