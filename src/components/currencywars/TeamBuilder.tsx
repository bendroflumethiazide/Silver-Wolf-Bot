"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Coins, Dices, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { WolfComment } from "@/components/SilverWolf";
import { kvGet, kvSet } from "@/lib/db";
import { unitPower } from "@/lib/currencywars/run";
import type { CwCharacter, CwField } from "@/lib/currencywars/parse";
import { boardBonds, boardGold, bondVariants, chanceToSee, rollShop, withVariants, type BoardUnit, type CwPack } from "@/lib/currencywars/sim";
import { createRng } from "@/lib/warp/simulator";
import { Button, cx, Empty, Notice, Panel } from "../ui";
import { BondList, bondsOf, CharCard, COST_TEXT, FieldTag, OddsBar, Portrait } from "./shared";
import { BondTracker } from "./tracking";

const BOARD_KEY = "cwBoard";
const defaultPlace = (field?: CwField): "on" | "off" => (field === "off" ? "off" : "on");

/** Plan a board: pick characters, place them On- or Off-Field, set stars, and watch bonds light up. */
export function TeamBuilder({ pack }: { pack: CwPack }) {
  const saved = useLiveQuery(() => kvGet<BoardUnit[]>(BOARD_KEY, []), []);
  const board = useMemo(() => saved ?? [], [saved]);
  const setBoard = (b: BoardUnit[]) => kvSet(BOARD_KEY, b.slice(0, 12));
  const [cost, setCost] = useState<number | "all">("all");
  const [field, setField] = useState<CwField | "all">("all");
  const [q, setQ] = useState("");
  const [level, setLevel] = useState(7);
  const [seed, setSeed] = useState(() => Math.random().toString(36).slice(2, 8));
  const [rolls, setRolls] = useState(0);
  const roster = pack.characters;
  const info = (n: string) => pack.info?.[n];
  const costOf = (n: string) => roster.find((c) => c.name === n)?.cost ?? 1;
  const costs = [...new Set(roster.map((c) => c.cost))].sort((a, b) => a - b);
  const needle = q.trim().toLowerCase();
  const shown = roster.filter((c) => (cost === "all" || c.cost === cost) && (field === "all" || info(c.name)?.field === field)
    && (!needle || c.name.toLowerCase().includes(needle) || bondsOf(pack, c.name).some((b) => b.toLowerCase().includes(needle))));
  const [rules, setRules] = useState<Record<string, string>>({});
  const families = useMemo(() => bondVariants(pack.bonds), [pack.bonds]);
  const bonds = useMemo(() => boardBonds(board, withVariants(pack.bonds, rules)), [board, pack.bonds, rules]);
  const shopRoster = useMemo(() => roster.filter((c) => c.cost <= 5), [roster]);
  const shop = useMemo(() => (pack.odds.length ? rollShop(pack.odds, level, shopRoster, createRng(`${seed}:${level}:${rolls}`)) : []), [pack.odds, level, shopRoster, seed, rolls]);
  const add = (c: CwCharacter) => { if (!board.some((u) => u.name === c.name)) void setBoard([...board, { name: c.name, stars: 1, place: defaultPlace(info(c.name)?.field) }]); };
  const odds = pack.odds.find((o) => o.level === level)?.odds ?? [];
  const active = bonds.filter((b) => b.active);
  const placeOf = (u: BoardUnit) => u.place ?? defaultPlace(info(u.name)?.field);
  const strength = (u: BoardUnit) => unitPower({ uid: 0, name: u.name, cost: costOf(u.name), stars: u.stars, items: [] }, placeOf(u), pack);
  const near = bonds.find((b) => !b.active && b.next);

  const group = (place: "on" | "off") => {
    const list = board.filter((u) => placeOf(u) === place);
    return (
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{place === "on" ? "On-Field" : "Off-Field"} ({list.length})</p>
        {!list.length ? <p className="text-xs text-faint">Nobody here.</p> : (
          <ul className="space-y-1.5">
            {list.map((u) => {
              const s = strength(u);
              return (
                <li key={u.name} className="flex items-center gap-2">
                  <Portrait name={u.name} cost={costOf(u.name)} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{u.name}</span>
                    <span className="flex items-center gap-1 text-[10px] text-faint"><FieldTag field={info(u.name)?.field} />{pack.info ? (s ? `strength ${Math.round(s)}` : <span className="text-rose-300">won&apos;t act here</span>) : null}</span>
                  </span>
                  <button type="button" onClick={() => setBoard(board.map((x) => (x.name === u.name ? { ...x, place: place === "on" ? "off" : "on" } : x)))} className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted hover:text-text">{place === "on" ? "→ Off" : "→ On"}</button>
                  <div className="flex rounded-md border border-line" role="radiogroup" aria-label={`${u.name} stars`}>
                    {([1, 2, 3] as const).map((st) => <button key={st} type="button" role="radio" aria-checked={u.stars === st} onClick={() => setBoard(board.map((x) => (x.name === u.name ? { ...x, stars: st } : x)))} className={cx("px-1.5 py-0.5 text-xs", u.stars === st ? "bg-amber-400/20 text-amber-300" : "text-faint")}>{st}★</button>)}
                  </div>
                  <button type="button" onClick={() => setBoard(board.filter((x) => x.name !== u.name))} aria-label={`Remove ${u.name}`} className="rounded p-1 text-faint hover:text-bad"><X size={14} /></button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <WolfComment comment={!board.length
        ? { mood: "smug", line: "Auto-chess, but I already know the meta|Tap characters to build a board|I'll track ur bonds", facts: [`${pack.characters.length} characters and ${pack.bonds.length} bonds in ${pack.season}.`] }
        : { mood: active.length ? "hyped" : "neutral", line: active.length ? `${active.length} bond${active.length === 1 ? "" : "s"} live|Best: ${active[0].bond.name} (${active[0].count})|${near ? `${near.bond.name} needs ${near.next!.count - near.count} more` : "Clean board"}` : "Nothing activated yet|Stack characters that share a bond", facts: [`${board.length} on the board, ${boardGold(board, roster)} gold of characters.`] }} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,360px)]">
        <Panel title={`Bonds${active.length ? ` (${active.length})` : ""}`} className="xl:order-1">
          {Object.entries(families).map(([fam, names]) => (
            <label key={fam} className="mb-2 flex flex-col gap-1 text-[11px] text-muted">{fam} rule (random each game)
              <select value={rules[fam] ?? names[0]} onChange={(e) => setRules({ ...rules, [fam]: e.target.value })} aria-label={`${fam} rule`} className="min-w-0">
                {names.map((n) => <option key={n} value={n}>{n.slice(fam.length + 2)}</option>)}
              </select>
            </label>
          ))}
          <BondList pack={pack} states={bonds} have={new Set(board.map((u) => u.name))} />
        </Panel>

        <Panel title="Characters" className="min-w-0 xl:order-2">
          <div className="mb-2"><BondTracker pack={pack} /></div>
          <label className="relative mb-2 block">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or bond" aria-label="Search characters" className="w-full !pl-8" />
          </label>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(["all", ...costs] as const).map((c) => (
              <button key={c} type="button" onClick={() => setCost(c)} aria-pressed={cost === c} className={cx("rounded-full border px-2.5 py-1 text-xs", cost === c ? "border-cyan bg-cyan/15 text-text" : "border-line text-muted")}>{c === "all" ? "All" : <span className={COST_TEXT[c]}>{c} gold</span>}</button>
            ))}
            {pack.info && (["on", "off", "both"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setField(field === f ? "all" : f)} aria-pressed={field === f} className={cx("rounded-full border px-2.5 py-1 text-xs", field === f ? "border-cyan bg-cyan/15 text-text" : "border-line text-muted")}>{f === "on" ? "On-Field" : f === "off" ? "Off-Field" : "On/Off"}</button>
            ))}
          </div>
          {!shown.length ? <Empty title="No matches" /> : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-4 2xl:grid-cols-5">
              {shown.map((c) => <CharCard key={c.name} pack={pack} name={c.name} cost={c.cost} onClick={() => add(c)} disabled={board.some((u) => u.name === c.name)} />)}
            </div>
          )}
        </Panel>

        <Panel title="Your board" className="xl:order-3" actions={board.length > 0 && <Button size="sm" variant="ghost" onClick={() => setBoard([])}><Trash2 size={14} /> Clear</Button>}>
          {!board.length ? <Empty title="Empty board">Tap characters to add them.</Empty> : (
            <div className="space-y-3">
              {group("on")}
              {group("off")}
              <div className="flex justify-between border-t border-line pt-2 text-sm"><span className="text-muted">{board.length} characters</span><span className="flex items-center gap-1"><Coins size={14} className="text-amber-300" /> {boardGold(board, roster)} gold to buy</span></div>
              {pack.info && <p className="text-[11px] text-faint">Strength is the character&apos;s On-/Off-Field Strength at that star from their wiki page (with a share of their HP bonus). An On-Field character placed Off-Field doesn&apos;t act.</p>}
            </div>
          )}
        </Panel>
      </div>

      {pack.odds.length > 0 && (
        <Panel title="Shop practice" actions={<Button size="sm" onClick={() => setRolls((r) => r + 1)}><Dices size={14} /> Refresh</Button>}>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted">Level
              <select value={level} onChange={(e) => setLevel(Number(e.target.value))} aria-label="Level">{pack.odds.map((o) => <option key={o.level} value={o.level}>{o.level}</option>)}</select>
            </label>
            <div className="min-w-0 flex-1 sm:max-w-xs"><OddsBar odds={odds} /></div>
            <span className="text-xs text-faint">A 5-cost in 5 slots: {Math.round(chanceToSee(pack.odds, level, 5, 5) * 100)}%</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {shop.map((c, i) => <CharCard key={`${rolls}-${i}`} pack={pack} name={c.name} cost={c.cost} onClick={() => add(c)} />)}
          </div>
          <div className="mt-3"><Notice>Each slot picks a cost from the level&apos;s odds (wiki page “{pack.oddsFrom}”), then a character of that cost at random. Pool sizes per character aren&apos;t published. Seed {seed}.</Notice></div>
          <div className="mt-2"><Button size="sm" variant="ghost" onClick={() => { setSeed(Math.random().toString(36).slice(2, 8)); setRolls(0); }}><RefreshCw size={13} /> New seed</Button></div>
        </Panel>
      )}
    </div>
  );
}
