"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Coins, Dices, Download, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { GameImage } from "@/components/GameImage";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, cx, Empty, ErrorBox, Notice, PageHeader, Panel, Progress } from "@/components/ui";
import { kvGet, kvSet } from "@/lib/db";
import { cwCharacterId } from "@/lib/currencywars/names";
import type { BondTier, CwCharacter } from "@/lib/currencywars/parse";
import { boardBonds, boardGold, chanceToSee, CW_PACK_KEY, downloadCwPack, rollShop, type BoardUnit, type CwPack } from "@/lib/currencywars/sim";
import { useApp } from "@/lib/store";
import { createRng } from "@/lib/warp/simulator";
import { WIKI } from "@/lib/wiki/fandom";

const BOARD_KEY = "cwBoard";
const COST_RING: Record<number, string> = { 1: "ring-zinc-400", 2: "ring-emerald-400", 3: "ring-sky-400", 4: "ring-violet-400", 5: "ring-amber-400", 7: "ring-rose-400" };
const COST_TEXT: Record<number, string> = { 1: "text-zinc-300", 2: "text-emerald-300", 3: "text-sky-300", 4: "text-violet-300", 5: "text-amber-300", 7: "text-rose-300" };
const TIER_TONE: Record<BondTier, "default" | "cyan" | "gold" | "violet"> = { bronze: "default", silver: "cyan", gold: "gold", plat: "violet" };

function Portrait({ name, cost, size = 56 }: { name: string; cost?: number; size?: number }) {
  const game = useApp((s) => s.game);
  const id = cwCharacterId(name, game);
  return (
    <span className={cx("inline-block shrink-0 overflow-hidden rounded-full ring-2", COST_RING[cost ?? 1] ?? "ring-line")} style={{ width: size, height: size }}>
      <GameImage path={id ? game?.characters[id]?.icon : undefined} alt={name} fallback={name} className="h-full w-full" rounded="rounded-full" />
    </span>
  );
}

function Sim({ pack }: { pack: CwPack }) {
  const saved = useLiveQuery(() => kvGet<BoardUnit[]>(BOARD_KEY, []), []);
  const board = useMemo(() => saved ?? [], [saved]);
  const setBoard = (b: BoardUnit[]) => kvSet(BOARD_KEY, b.slice(0, 12));
  const [cost, setCost] = useState<number | "all">("all");
  const [q, setQ] = useState("");
  const [level, setLevel] = useState(7);
  const [seed, setSeed] = useState(() => Math.random().toString(36).slice(2, 8));
  const [rolls, setRolls] = useState(0);
  const roster = pack.characters;
  const costOf = (n: string) => roster.find((c) => c.name === n)?.cost;
  const costs = [...new Set(roster.map((c) => c.cost))].sort((a, b) => a - b);
  const shown = roster.filter((c) => (cost === "all" || c.cost === cost) && (!q || c.name.toLowerCase().includes(q.toLowerCase())));
  const bonds = useMemo(() => boardBonds(board, pack.bonds), [board, pack.bonds]);
  const memberOf = (n: string) => pack.bonds.filter((b) => b.members.includes(n)).map((b) => b.name);
  const shop = useMemo(() => (pack.odds.length ? rollShop(pack.odds, level, roster, createRng(`${seed}:${level}:${rolls}`)) : []), [pack.odds, level, roster, seed, rolls]);
  const add = (c: CwCharacter) => { if (!board.some((u) => u.name === c.name)) void setBoard([...board, { name: c.name, stars: 1 }]); };
  const odds = pack.odds.find((o) => o.level === level)?.odds ?? [];
  const active = bonds.filter((b) => b.active);

  return (
    <div className="space-y-5">
      <WolfComment comment={!board.length
        ? { mood: "smug", line: "Auto-chess, but I already know the meta|Tap characters to build a board|I'll track ur bonds", facts: [`${pack.characters.length} characters and ${pack.bonds.length} bonds in ${pack.season}.`] }
        : { mood: active.length ? "hyped" : "neutral", line: active.length ? `${active.length} bond${active.length === 1 ? "" : "s"} live|Best: ${active[0].bond.name} (${active[0].count})|${bonds.find((b) => !b.active && b.next) ? `${bonds.find((b) => !b.active && b.next)!.bond.name} needs ${bonds.find((b) => !b.active && b.next)!.next!.count - bonds.find((b) => !b.active && b.next)!.count} more` : "Clean board"}` : "Nothing activated yet|Stack characters that share a bond", facts: [`${board.length} on the board, ${boardGold(board, roster)} gold of characters.`] }} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Panel title="Characters">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1 sm:max-w-[220px]"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search characters" className="w-full !pl-8" /></label>
            {(["all", ...costs] as const).map((c) => (
              <button key={c} onClick={() => setCost(c)} className={cx("rounded-full border px-2.5 py-1 text-xs", cost === c ? "border-cyan bg-cyan/15 text-text" : "border-line text-muted")}>{c === "all" ? "All" : <span className={COST_TEXT[c]}>{c} gold</span>}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {shown.map((c) => {
              const on = board.some((u) => u.name === c.name);
              return (
                <button key={c.name} onClick={() => add(c)} disabled={on} title={memberOf(c.name).join(" · ")}
                  className={cx("flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition", on ? "border-cyan/40 opacity-50" : "border-line hover:border-cyan/50 hover:bg-white/[0.04]")}>
                  <Portrait name={c.name} cost={c.cost} />
                  <span className="line-clamp-2 text-[11px] leading-tight">{c.name}</span>
                  <span className={cx("flex items-center gap-0.5 text-[10px]", COST_TEXT[c.cost])}><Coins size={10} />{c.cost}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Your board" actions={board.length > 0 && <Button size="sm" variant="ghost" onClick={() => setBoard([])}><Trash2 size={14} /> Clear</Button>}>
            {!board.length ? <Empty title="Empty board">Tap characters on the left.</Empty> : (
              <>
                <ul className="space-y-1.5">
                  {board.map((u) => (
                    <li key={u.name} className="flex items-center gap-2">
                      <Portrait name={u.name} cost={costOf(u.name)} size={36} />
                      <span className="min-w-0 flex-1 truncate text-sm">{u.name}</span>
                      <div className="flex rounded-md border border-line" role="radiogroup" aria-label={`${u.name} stars`}>
                        {([1, 2, 3] as const).map((s) => <button key={s} role="radio" aria-checked={u.stars === s} onClick={() => setBoard(board.map((x) => (x.name === u.name ? { ...x, stars: s } : x)))} className={cx("px-1.5 py-0.5 text-xs", u.stars === s ? "bg-amber-400/20 text-amber-300" : "text-faint")}>{"★".repeat(s)}</button>)}
                      </div>
                      <button onClick={() => setBoard(board.filter((x) => x.name !== u.name))} aria-label={`Remove ${u.name}`} className="rounded p-1 text-faint hover:text-bad"><X size={14} /></button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-between border-t border-line pt-2 text-sm"><span className="text-muted">{board.length} characters</span><span className="flex items-center gap-1"><Coins size={14} className="text-amber-300" /> {boardGold(board, roster)} gold to buy</span></div>
              </>
            )}
          </Panel>

          <Panel title="Bonds">
            {!bonds.length ? <p className="text-sm text-muted">Bonds light up as you add characters.</p> : (
              <ul className="space-y-2.5">
                {bonds.map((b) => {
                  const top = b.bond.levels[b.bond.levels.length - 1]?.count ?? 1;
                  return (
                    <li key={b.bond.name} className={cx("rounded-lg border p-2.5", b.active ? "border-cyan/40 bg-cyan/[0.04]" : "border-line")}>
                      <details>
                        <summary className="flex cursor-pointer list-none items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.bond.name}</span>
                          {b.tier && <Badge tone={TIER_TONE[b.tier]}>{b.tier === "plat" ? "platinum" : b.tier}</Badge>}
                          <span className="font-mono text-xs text-muted">{b.count}{b.next ? `/${b.next.count}` : ""}</span>
                        </summary>
                        <div className="mt-2 space-y-1.5 text-xs text-muted">
                          <p>{b.bond.summary}</p>
                          {b.bond.levels.map((l) => <p key={l.count} className={cx(b.active?.count === l.count && "text-text")}><b className={b.count >= l.count ? "text-cyan" : "text-faint"}>({l.count})</b> {l.effect}</p>)}
                          <p className="text-faint">Members: {b.bond.members.join(", ")}</p>
                        </div>
                      </details>
                      <div className="mt-1.5"><Progress value={Math.min(1, b.count / top)} /></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {pack.odds.length > 0 && (
        <Panel title="Shop practice" actions={<Button size="sm" onClick={() => setRolls((r) => r + 1)}><Dices size={14} /> Refresh shop</Button>}>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted">Level
              <select value={level} onChange={(e) => setLevel(Number(e.target.value))} aria-label="Level">{pack.odds.map((o) => <option key={o.level} value={o.level}>{o.level}</option>)}</select>
            </label>
            <div className="flex flex-wrap gap-2 text-xs">{odds.map((p, i) => p > 0 && <span key={i} className={COST_TEXT[i + 1]}>{i + 1}-cost {Math.round(p * 100)}%</span>)}</div>
            <span className="text-xs text-faint">· chance of a 5-cost in 5 slots: {Math.round(chanceToSee(pack.odds, level, 5, 5) * 100)}%</span>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {shop.map((c, i) => (
              <button key={`${rolls}-${i}`} onClick={() => add(c)} className="flex flex-col items-center gap-1 rounded-xl border border-line p-2 text-center hover:border-cyan/50">
                <Portrait name={c.name} cost={c.cost} size={48} />
                <span className="line-clamp-2 text-[11px] leading-tight">{c.name}</span>
                <span className={cx("text-[10px]", COST_TEXT[c.cost])}>{c.cost} gold · buy</span>
              </button>
            ))}
          </div>
          <div className="mt-3"><Notice>Each slot picks a cost using the shop odds for your level (from the wiki page “{pack.oddsFrom}”), then a character of that cost at random. Slot count and per-character pool sizes aren&apos;t documented, so this is practice, not an exact copy of the game. Seed {seed}.</Notice></div>
          <div className="mt-2"><Button size="sm" variant="ghost" onClick={() => { setSeed(Math.random().toString(36).slice(2, 8)); setRolls(0); }}><RefreshCw size={13} /> New seed</Button></div>
        </Panel>
      )}
      <p className="text-[11px] text-faint">{pack.season} (Version {pack.version}). Characters, bonds and odds from the <a className="underline" href={WIKI.page(`Currency Wars: ${pack.season}`)} target="_blank" rel="noreferrer">{WIKI.name}</a> ({WIKI.license}), downloaded {pack.fetchedAt.slice(0, 10)}. Game content © HoYoverse.</p>
    </div>
  );
}

export default function CurrencyWarsPage() {
  const pack = useLiveQuery(() => kvGet<CwPack | null>(CW_PACK_KEY, null), []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const get = async () => {
    setBusy(true); setErr(null);
    try { await kvSet(CW_PACK_KEY, await downloadCwPack()); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <PageHeader title="Currency Wars" subtitle={pack ? `Team builder for ${pack.season}: pick characters, see which bonds light up.` : "Team builder with bonds and a shop to practise on."}
        actions={pack ? <Button size="sm" variant="ghost" onClick={get} disabled={busy}><RefreshCw size={14} className={busy ? "animate-spin" : ""} /> Update</Button> : undefined} />
      {err && <ErrorBox>{err}</ErrorBox>}
      {pack === undefined ? null : pack ? <Sim pack={pack} /> : (
        <Panel>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="max-w-md text-sm text-muted">Download the current Currency Wars period from the Honkai: Star Rail Wiki: its characters, bonds and shop odds.</p>
            <Button variant="primary" onClick={get} disabled={busy}><Download size={15} /> {busy ? "Downloading…" : "Download Currency Wars data"}</Button>
          </div>
          <Notice>The app reads three or four public wiki pages. Nothing about you is sent. Text is {WIKI.license}.</Notice>
        </Panel>
      )}
    </div>
  );
}
