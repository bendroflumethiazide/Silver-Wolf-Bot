"use client";

import { ArrowDownToLine, Search, ThumbsUp, Coffee, Coins, Crown, Dices, Flag, Gift, Heart, Library, Lock, LockOpen, Package, Play, RefreshCw, Skull, Swords, Trophy, Undo2, X, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { WolfComment } from "@/components/SilverWolf";
import { kvGet, kvSet } from "@/lib/db";
import {
  advance, ASSUMED, at, autoSpot, battle, buy, buyXp, chooseEnvironment, combineBag, deployed, enemyPower, equip, lineupValue, openOre, units,
  moveUnit, newRun, nodeKind, nodeKinds, objectives, pickEncounter, pickStrategy, pickSupply, rankGain, refresh, RULES, runBonds, sell, skipSupply, teamPower, teamSize,
  toggleLock, unitPower, winChance, xpToNext, type NodeKind, type RunState, type Spot, type Unit, type Zone,
  choosePlotArmor, pickTea, placedBondStates, settle, useSwap as swapProtagonist,
} from "@/lib/currencywars/run";
import { openBox, specialNode } from "@/lib/currencywars/escapade";
import { changeProtagonist, chooseProtagonist, PLOT_ARMOR_CONFIG, PLOT_ARMOR_RULES, plotOf, refreshPlot, selectionNode } from "@/lib/currencywars/plotArmor";
import { specialItem } from "@/lib/currencywars/specialItems";
import { buyTsr, refreshTsr, TSR_ASSUMED, TSR_BOND, TSR_RULES } from "@/lib/currencywars/trailblazeStore";
import { companionOf } from "@/lib/currencywars/voyageCompanions";
import { CompanionCard, CompanionCollection, CompanionReveal, TeaBreakPanel, useCollection } from "./Escapade";
import { PlotArmorPanel, PlotArmorStatus } from "./PlotArmor";
import { TrailblazeStorePanel } from "./TrailblazeStore";
import { craftableNow, fillUnknown, gearMark, gearNeeds, type GearTarget } from "@/lib/currencywars/gear";
import { isOre, itemKind, ORE_DROP_ODDS, ORE_REWARDS, ORE_TIERS } from "@/lib/currencywars/items";
import type { CwPack } from "@/lib/currencywars/sim";
import { BattleView } from "./BattleView";
import { CharacterSheet } from "./CharacterSheet";
import { RecommendedGear } from "./RecommendedGear";
import { ItemDetail } from "./ItemDetail";
import { Badge, Button, cx, Modal, Notice, Panel } from "../ui";
import { BondList, BondMembers, bondsOf, CharCard, FieldTag, ItemIcon, OddsBar, Portrait, WhoFaces } from "./shared";
import { BondTracker, TrackMark, useTracked } from "./tracking";

const RUN_KEY = "cwRun";
const NODE_ICON: Record<NodeKind, LucideIcon> = { Reward: Gift, Strategy: Flag, Combat: Swords, Supply: Package, Encounter: Dices, Boss: Skull };
const NODE_LABEL: Record<NodeKind, string> = { Reward: "Reward", Strategy: "Strategy + Combat", Combat: "Combat", Supply: "Supply", Encounter: "Encounter", Boss: "Boss" };
const RARITY_CARD = { Silver: "border-slate-300/50 from-slate-400/20", Gold: "border-amber-300/60 from-amber-400/20", Prismatic: "border-fuchsia-300/60 from-fuchsia-400/20 via-cyan-400/10" } as const;
const newSeed = () => Math.random().toString(36).slice(2, 8);

type Sel = { kind: "unit"; spot: Spot } | { kind: "item"; index: number } | null;

function Setup({ pack, onStart }: { pack: CwPack; onStart: (rank: string, seed: string) => void }) {
  const steps = pack.difficulty ?? [];
  const [rank, setRank] = useState(steps[0]?.id ?? "A0-1");
  const [seed, setSeed] = useState(newSeed);
  const ranks = [...new Set(steps.map((d) => d.rank))];
  const step = steps.find((d) => d.id === rank);
  return (
    <Panel title="New run">
      <ol className="mb-4 grid gap-2 text-sm sm:grid-cols-3">
        {[
          ["1. Pick an Investment Environment", "A buff for the whole run."],
          ["2. Build your squad", "Buy, merge 3 copies into stars, deploy On-/Off-Field, equip items."],
          ["3. Clear 3 planes", "Each ends in a boss. Lose a fight, lose squad HP. 0 HP ends the run."],
        ].map(([t, d]) => <li key={t} className="rounded-lg border border-line p-2.5"><b className="block text-text">{t}</b><span className="text-xs text-muted">{d}</span></li>)}
      </ol>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">Difficulty
          <select value={rank} onChange={(e) => setRank(e.target.value)} aria-label="Difficulty">
            {ranks.length ? ranks.map((r) => <optgroup key={r} label={r}>{steps.filter((d) => d.rank === r).map((d) => <option key={d.id} value={d.id}>{d.id}</option>)}</optgroup>) : <option value="A0-1">A0-1</option>}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">Seed
          <span className="flex gap-1"><input value={seed} onChange={(e) => setSeed(e.target.value.slice(0, 24))} aria-label="Seed" className="w-28" /><Button size="sm" variant="ghost" onClick={() => setSeed(newSeed())} aria-label="New seed"><Dices size={14} /></Button></span>
        </label>
        <Button variant="primary" onClick={() => onStart(rank, seed || newSeed())}><Play size={15} /> Start run</Button>
      </div>
      {step && <p className="mt-3 text-xs text-muted">{step.rank}, step {step.id}: enemies get +{step.planes.map((p) => `${p.hp}%`).join(" / ")} HP on planes 1/2/3.{step.effects.length ? ` ${step.effects.join(" ")}` : ""}</p>}
    </Panel>
  );
}

function Hud({ run }: { run: RunState }) {
  const kinds = nodeKinds(run.plane, run);
  const plotAt = (PLOT_ARMOR_RULES.planes as readonly number[]).includes(run.plane) && !plotOf(run).done.includes(run.plane) ? selectionNode(run, run.plane) : -1;
  const comp = run.escapade ? companionOf(run.escapade.companion) : undefined;
  const need = xpToNext(run.level);
  return (
    <div className="glass space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="font-semibold">Plane {run.plane + 1}<span className="text-faint">/3</span></span>
        <ol className="flex flex-wrap gap-1" aria-label="Nodes on this plane">
          {kinds.map((k, i) => {
            const real = i === run.node ? nodeKind(run) : nodeKind({ ...run, node: i });
            const special = real === "Reward" && i >= run.node ? specialNode({ ...run, node: i }) : null;
            const Icon = special === "teaBreak" ? Coffee : special === "treasury" ? Library : NODE_ICON[real];
            const label = special === "teaBreak" ? "Backstage Tea Break" : special === "treasury" ? "Pearliefin's Treasury" : NODE_LABEL[real];
            return (
              <li key={i} title={`${i + 1}. ${label}${i === plotAt ? " · Plot Armor selection" : ""}`} className={cx("relative flex h-7 w-7 items-center justify-center rounded-md border", i < run.node ? "border-line text-faint opacity-50" : i === run.node ? "border-cyan bg-cyan/15 text-cyan" : "border-line text-muted", real === "Boss" && i >= run.node && "border-rose-400/60 text-rose-300", special && "border-amber-300/60 text-amber-300")}>
                <Icon size={14} aria-hidden /><span className="sr-only">{label}{i === run.node ? " (now)" : ""}{i === plotAt ? ", Plot Armor selection" : ""}</span>
                {i === plotAt && i >= run.node && <Crown size={10} className="absolute -right-1 -top-1 text-fuchsia-300" aria-hidden />}
              </li>
            );
          })}
        </ol>
        <Badge tone="violet">{run.rank}</Badge>
        {comp && <span className="flex items-center gap-1 text-xs text-muted" title="Voyage Companion"><span aria-hidden>{comp.emoji}</span>{comp.name}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        <span className="flex items-center gap-1.5"><Heart size={15} className="text-rose-400" /> <b>{run.hp}</b><span className="text-faint">/100</span></span>
        <span className="flex items-center gap-1.5"><Coins size={15} className="text-amber-300" /> <b>{run.gold}</b> gold</span>
        <span className="flex items-center gap-1.5">Lv.<b>{run.level}</b>{need > 0 && <span className="text-xs text-faint">{run.xp}/{need} XP</span>}</span>
        <span className="flex items-center gap-1.5"><Swords size={14} className="text-cyan" /> {deployed(run).length}/{teamSize(run)} deployed</span>
        <span className="flex items-center gap-1.5">Streak <b>{run.streak}</b></span>
        {run.tsr && <span className="flex items-center gap-1.5" title="Trailblaze Power"><Zap size={14} className="text-amber-300" /> <b>{run.tsr.tp}</b> TP</span>}
        {plotOf(run).holders.some((h) => !h.disabled) && <span className="flex items-center gap-1.5" title="Plot Armor holders"><Crown size={14} className="text-fuchsia-300" /> {plotOf(run).holders.filter((h) => !h.disabled).map((h) => h.name).join(", ")}</span>}
      </div>
    </div>
  );
}

function UnitTile({ u, place, pack, selected, onClick, label, crowned, turbulence }: { u: Unit | null; place: Zone; pack: CwPack; selected: boolean; onClick: () => void; label: string; crowned?: boolean; turbulence?: boolean }) {
  if (turbulence && !u) return <button type="button" onClick={onClick} aria-label={`${label} (Black Hole Turbulence Slot)`} title="Black Hole Turbulence Slot: whoever stands here changes into another character of the same cost at the next node." className={cx("aspect-square min-w-0 rounded-lg border border-dashed border-violet-400/80 bg-violet-500/10", selected && "ring-2 ring-cyan")} />;
  if (!u) return <button type="button" onClick={onClick} aria-label={label} className={cx("aspect-square min-w-0 rounded-lg border border-dashed transition", selected ? "border-cyan bg-cyan/10" : "border-line/70 hover:border-cyan/50")} />;
  const idle = place !== "bench" && unitPower(u, place, pack) === 0;
  return (
    <button type="button" onClick={onClick} aria-label={`${label}: ${u.stars}-star ${u.name}`} aria-pressed={selected}
      className={cx("relative flex aspect-square min-w-0 flex-col items-center justify-center rounded-lg border bg-white/[0.03] p-0.5 transition", selected ? "border-cyan ring-2 ring-cyan" : idle ? "border-rose-400/70" : "border-line hover:border-cyan/50")}>
      <span className="absolute left-1 top-0.5 text-[9px] leading-none text-amber-300">{"★".repeat(u.stars)}</span>
      {crowned && <Crown size={11} className="absolute left-0.5 bottom-0.5 text-fuchsia-300" aria-label="Plot Armor" />}
      {turbulence && <span className="absolute inset-0 rounded-lg ring-2 ring-violet-400/70" title="Black Hole Turbulence Slot" aria-hidden />}
      <Portrait name={u.name} cost={u.cost} size={34} className="!ring-1" />
      <span className="mt-0.5 w-full truncate text-[9px] leading-tight">{u.name}</span>
      {u.items.length > 0 && <span className="absolute bottom-0.5 right-0.5 flex gap-px">{u.items.map((it, i) => <ItemIcon key={i} pack={pack} name={it} size={9} />)}</span>}
      {idle ? <span className="absolute right-0.5 top-0.5 rounded bg-rose-500/80 px-0.5 text-[8px] font-bold">IDLE</span> : <TrackMark pack={pack} name={u.name} items={u.items} />}
    </button>
  );
}

function Report({ run, pack, onNext }: { run: RunState; pack: CwPack; onNext: () => void }) {
  const r = run.last!;
  const total = r.gold.base + r.gold.streak + r.gold.interest + r.gold.drops;
  return (
    <Panel title={<span className={r.won ? "text-ok" : "text-bad"}>{r.kind === "Reward" ? "Reward node cleared" : r.won ? "Node cleared" : "Not cleared in time"}</span>} actions={<Button variant="primary" size="sm" onClick={onNext}>Next node →</Button>}>
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <div><p className="text-xs text-muted">Fight</p><p>{r.opponent || "Enemies"}{r.enemies.length ? <span className="block text-xs text-faint">{r.enemies.join(", ")}</span> : null}</p>
          {r.kind !== "Reward" && <p className="mt-1 text-xs text-muted">Your strength {Math.round(r.power)} vs {Math.round(r.enemy)} · estimated win chance {Math.round(r.chance * 100)}%</p>}</div>
        <div><p className="text-xs text-muted">Gold +{total}</p><p className="text-xs">Base {r.gold.base} · streak {r.gold.streak} · interest {r.gold.interest}{r.gold.drops ? ` · drops ${r.gold.drops}` : ""}</p>{r.item && <p className="mt-1 flex items-center gap-1 text-xs">Dropped <ItemIcon pack={pack} name={r.item} size={12} /> {r.item}</p>}
          {r.ores && r.ores.length > 0 && <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">Ores: {r.ores.map((o, i) => <span key={i} className="inline-flex items-center gap-1"><ItemIcon pack={pack} name={o} size={11} />{o.replace(" Crystal Ore", "")}</span>)} <span className="text-faint">(in Items: tap to open)</span></p>}</div>
        <div><p className="text-xs text-muted">Squad</p><p className="text-xs">{r.won ? "No HP lost." : `Cleared about ${Math.round(r.cleared * 100)}% → −${r.hpLost} squad HP.`} +{r.xp} XP.</p>
          {r.saved && <p className="mt-1 text-xs text-ok">Woof Woof Dan turned this failed fight into a Perfect Clear!</p>}
          {r.trotter && <p className="mt-1 text-xs text-amber-200">Trotters! (Bubble Wolf) Easier fight, extra ore.</p>}
          {r.express && <p className="mt-1 text-xs text-amber-200">Astral Express: {r.express.collisions} collision{r.express.collisions === 1 ? "" : "s"} (+{Math.round(r.express.bonus * 100)}% strength).</p>}
          {run.tsr && <p className="mt-1 text-xs text-muted">Trailblaze Power now {run.tsr.tp}.</p>}</div>
      </div>
    </Panel>
  );
}

function Summary({ run, pack, onNew }: { run: RunState; pack: CwPack; onNew: () => void }) {
  const goals = objectives(run, pack);
  const cleared = run.result === "cleared";
  return (
    <Panel title={<span className="flex items-center gap-2">{cleared ? <Trophy size={16} className="text-gold" /> : <Skull size={16} className="text-bad" />}{cleared ? `Run cleared with ${run.hp} squad HP` : "Run over"}</span>} actions={<Button variant="primary" size="sm" onClick={onNew}>New run</Button>}>
      <div className="grid gap-4 text-sm md:grid-cols-2">
        <div className="space-y-1">
          {cleared && <p>Rank: <b className="text-cyan">+{rankGain(run)}</b> step{rankGain(run) === 1 ? "" : "s"} (70+ HP → 3, 40+ → 2, else 1).</p>}
          <p className="text-muted">Wins {run.stats.wins} · losses {run.stats.losses} · best streak {run.stats.bestStreak}</p>
          <p className="text-muted">Gold earned {run.stats.goldEarned} (interest {run.stats.interest}) · refreshes {run.stats.refreshes} · XP bought {run.stats.xpBought}×</p>
          <p className="text-muted">Level {run.level} · lineup value {lineupValue(run)} gold</p>
          {run.environment && <p className="text-muted">Environment: {run.environment.name}</p>}
          {run.strategies.length > 0 && <p className="text-muted">Strategies: {run.strategies.map((s) => s.name).join(", ")}</p>}
        </div>
        <div>
          <p className="mb-1 text-xs text-muted">Expected Profit goals this run {cleared ? "meets" : "would meet on a clear"}:</p>
          <ul className="space-y-1 text-xs">{goals.map((g) => <li key={g.label} className={cx("flex justify-between gap-2", g.done ? "text-ok" : "text-faint")}><span>{g.done ? "✓" : "·"} {g.label}</span>{g.value && <span>{g.value}</span>}</li>)}</ul>
        </div>
      </div>
    </Panel>
  );
}

function Rules() {
  const lv = Object.entries(ASSUMED.levelXp).map(([l, x]) => `${l}→${Number(l) + 1}: ${x}`).join(", ");
  return (
    <Notice title="How this simulator works">
      <p className="font-medium text-text">From the wiki and the game (Version 4.7):</p>
      <ul className="mb-2 list-disc pl-4">
        <li>Node order per plane, Action Value ({RULES.actionValue.map((a) => a.join("/")).join(", ")}), squad HP 100, HP lost on a failed node {RULES.hpLoss.map((a) => a.join("/")).join(", ")} (combat/boss) plus more the less you cleared.</li>
        <li>Interest: 1 gold per {RULES.interestPer} you hold, up to {RULES.interestCap}. Refresh {RULES.refreshCost} gold, Experience {RULES.xpCost} gold, store auto-refreshes each node unless locked.</li>
        <li>Shop odds by level, 3 copies merge into the next star, 3 items per character, 2 basic items combine by the wiki recipe table.</li>
        <li>Supply: 1 of 5 characters carrying a basic item. Strategies after the first fight of each plane; Gold/Prismatic raise enemy difficulty. Encounters from Jade Steel (A2). 3 random opponents, one boss per plane.</li>
        <li>Characters placed in the wrong position don&apos;t act (shown as IDLE); each character&apos;s On-/Off-Field Strength by star comes from their wiki page.</li>
        <li>Emblems put their wearer in that Bond and count toward it; Red/Blue Gem + a basic item makes an Emblem; owning a Wealth Gem raises the team size by 1. Ore strategies (Prismatic Ore, Bursting Ore, Cracked Quartz, Gold Miner) work as written.</li>
      </ul>
      <p className="font-medium text-text">Version 4.7 mechanics (wiki-verified):</p>
      <ul className="mb-2 list-disc pl-4">
        <li>Trailblaze Silver Rail: after each combat, {TSR_RULES.income.map(([c, v]) => `${v} TP at ${c}`).join(", ")}. Store names, texts and prices as listed; Express Enhancements +{TSR_RULES.enhancementStep} and Components +{TSR_RULES.componentStep} per purchase; level 6 adds Components; level 10 gives 500 TP and Forward IV; spending 500 TP unlocks King Pom-Pom.</li>
        <li>Escapade: one of 11 random Voyage Companions per run, each with the wiki&apos;s effects; Backstage Tea Break replaces the Reward Node before the boss for companions that have one.</li>
        <li>Plot Armor: two protagonists from deployed characters (Plane 1 and Plane 2 bosses), first paid refreshes 1 gold; Plot Armor Procurement, Early Entrance (nodes 1-6 / 2-4), Refresh Chain(+), New Cast Performance, It&apos;s A Wrap; Roll-Call 5 gives Imagenae: Plot Armor and 7 boosts holders by 100% strength and 50% SPD; the five Plot Armor Bonds.</li>
      </ul>
      <p className="font-medium text-text">Not published, so guessed here:</p>
      <ul className="list-disc pl-4">
        <li>Base gold {ASSUMED.baseIncome} per fight, streak bonus {ASSUMED.streakBonus.join("/")}, Reward drops {ASSUMED.rewardGold.join("–")} gold, sell price = what you paid.</li>
        <li>{ASSUMED.xpPerBuy} XP per purchase, {ASSUMED.xpPerBattle} XP per fight, start at level {ASSUMED.startLevel}, deploy = level, XP to level up {lv} (the 84 matches the game).</li>
        <li>Crystal Ores: tiers White, Blue, Gold and Prismatic are real, and ores hold gold, characters or equipment, but what&apos;s inside isn&apos;t published. Here: {ORE_TIERS.map((t) => `${t}: ${ORE_REWARDS[t].map((r) => r.label).join(" / ")}`).join("; ")}. Reward nodes drop {ASSUMED.rewardOres} ores (plane 1 odds {ORE_DROP_ODDS[0].map((x) => `${Math.round(x * 100)}%`).join("/")}).</li>
        <li>4.7: Trailblaze Store unlock levels (other than 2/4/6/10), {TSR_ASSUMED.stockSlots} goods in stock refreshed after each combat, &quot;Others&quot; priced in gold; Plot Armor chosen at the boss node by default, {PLOT_ARMOR_CONFIG.cheapRefreshes} paid refreshes at 1 gold then +{PLOT_ARMOR_CONFIG.escalation} each, and the non-Bond Plot Armor options (the wiki has no list); missing companion numbers (each says so on its card).</li>
        <li>Up to {ASSUMED.onFieldSlots} On-Field slots. Fights are a strength comparison (stats, stars, items, bonds) with a win chance, not a real battle. Environment/Strategy effects the simulator can&apos;t model are listed as “not simulated”.</li>
      </ul>
    </Notice>
  );
}

export function RunSim({ pack }: { pack: CwPack }) {
  const [run, setRun] = useState<RunState | null | undefined>(undefined);
  const [sel, setSel] = useState<Sel>(null);
  /** An equipped item whose details are open. */
  const [peek, setPeek] = useState<string | null>(null);
  /** A Bond whose members are shown (from a selected character's Bond tags). */
  const [bondPeek, setBondPeek] = useState<string | null>(null);
  /** The character whose full sheet (stats, abilities) is open. */
  const [sheet, setSheet] = useState<{ name: string; stars: number; items: string[]; place: Zone } | null>(null);
  /** The fight being watched (by tick), so a reload shows the result instead of replaying. */
  const [watching, setWatching] = useState<number | null>(null);
  useEffect(() => { let live = true; void kvGet<RunState | null>(RUN_KEY, null).then((r) => { if (live) setRun(r); }); return () => { live = false; }; }, []);
  // The ref keeps rapid clicks consistent; the save starts right away (not inside a state updater).
  const runRef = useRef<RunState | null | undefined>(undefined);
  runRef.current = run;
  const update = (fn: (s: RunState) => RunState) => {
    const cur = runRef.current;
    if (!cur) return;
    // settle(): unlocks and grants that happen as soon as the board allows (once each).
    const next = settle(fn(cur), pack);
    if (next === cur) return;
    runRef.current = next;
    setRun(next);
    void kvSet(RUN_KEY, next);
  };
  const start = (rank: string, seed: string) => { const r = newRun(pack, seed, rank); setSel(null); setRun(r); void kvSet(RUN_KEY, r); };
  const quit = () => { setRun(null); setSel(null); void kvSet(RUN_KEY, null); };

  const tp = useMemo(() => (run ? teamPower(run, pack) : null), [run, pack]);
  const tsrLevel = useMemo(() => (run ? placedBondStates(run, pack).find((b) => b.bond.name === TSR_BOND)?.count ?? 0 : 0), [run, pack]);
  const collection = useCollection(run);
  const { gear: gearTracked, toggleGear } = useTracked();
  /** Characters whose recommended equipment is tracked: the ones you picked, else everyone deployed. */
  const gearTargets = useMemo<GearTarget[]>(() => {
    if (!run) return [];
    const placed = (["on", "off", "bench"] as const).flatMap((zone) => run[zone].filter((u): u is Unit => !!u && !u.npc).map((u) => ({ u, zone })));
    if (gearTracked.length) {
      return gearTracked.map((name) => {
        const hit = placed.find((p) => p.u.name === name);
        return { name, place: hit && hit.zone !== "bench" ? hit.zone : undefined, held: hit?.u.items ?? [] };
      });
    }
    return placed.filter((p) => p.zone !== "bench").map((p) => ({ name: p.u.name, place: p.zone, held: p.u.items }));
  }, [run, gearTracked]);
  const needs = useMemo(() => gearNeeds(pack, gearTargets), [pack, gearTargets]);
  const heldByTargets = gearTargets.flatMap((t) => t.held);
  /** Items your characters hold (a bag item that combines with one of them can be crafted by equipping it). */
  const heldByAll = run ? (["on", "off", "bench"] as const).flatMap((z) => run[z].flatMap((u) => (u && !u.npc ? u.items : []))) : [];
  /** 👍 = a tracked character prefers it (or it's a part of what they prefer); blue = it can be crafted right now. */
  const markOf = (item: string, others: string[]) => {
    const want = gearMark(needs, item, [...others, ...heldByTargets]);
    const craft = craftableNow(pack, item, [...others, ...heldByAll]);
    const notes = [...want.notes.map((n) => `Preferred by ${n}`), ...craft.map((c) => `Craft now: ${item} + ${c.partner} → ${c.makes}`)];
    // Who it's for: characters preferring the item itself, or what it crafts into right now.
    const who = [...new Set([...(needs.get(item) ?? []).map((n) => n.who), ...craft.flatMap((c) => (needs.get(c.makes) ?? []).map((n) => n.who))])];
    return { wanted: want.wanted, ready: craft.length > 0, notes, preferred: want.notes, craft: craft.map((c) => `${c.partner} → ${c.makes}`), who };
  };
  if (run === undefined) return null;
  if (!run) return <div className="space-y-4"><Setup pack={pack} onStart={start} /><CompanionCollection collection={collection} /><Rules /></div>;

  const prep = run.phase === "prep";
  const odds = pack.odds.find((o) => o.level === run.level)?.odds ?? [1, 0, 0, 0, 0];
  const kind = nodeKind(run);
  const enemy = prep ? enemyPower(run, pack) : 0;
  const chance = prep && tp ? (kind === "Reward" ? 1 : winChance(tp.power, enemy)) : 0;
  const av = RULES.actionValue[run.plane]?.[kind === "Boss" ? 1 : 0];
  const selUnit = sel?.kind === "unit" ? at(run, sel.spot) : null;

  const canManage = prep || run.phase === "supply";
  const clickSlot = (spot: Spot) => {
    if (!canManage) return;
    if (!prep) { setSel(at(run, spot) ? { kind: "unit", spot } : null); return; }
    if (sel?.kind === "item") { if (at(run, spot)) update((s) => equip(s, pack, sel.index, spot)); setSel(null); return; }
    if (sel?.kind === "unit") {
      if (sel.spot.zone === spot.zone && sel.spot.index === spot.index) setSel(null);
      else { update((s) => moveUnit(s, sel.spot, spot)); setSel(null); }
      return;
    }
    if (at(run, spot)) setSel({ kind: "unit", spot });
  };
  const clickItem = (index: number) => {
    const it = run.bag[index];
    // Ores open on tap, any time during the run.
    if (it && isOre(it)) { setSel(null); update((s) => openOre(s, pack, index)); return; }
    if (!prep) return;
    setPeek(null);
    if (sel?.kind === "item" && sel.index !== index) {
      const a = run.bag[sel.index];
      const both = [itemKind(pack, a), itemKind(pack, it)];
      if (both.every((k) => k === "basic" || k === "gem")) { update((s) => combineBag(s, pack, sel.index, index)); setSel(null); return; }
    }
    setSel(sel?.kind === "item" && sel.index === index ? null : { kind: "item", index });
  };
  const zoneRow = (zone: Zone, title: string, cols: string) => (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</p>
      <div className={cx("grid gap-1.5", cols)}>
        {run[zone].map((u, index) => <UnitTile key={index} u={u} place={zone} pack={pack} selected={sel?.kind === "unit" ? sel.spot.zone === zone && sel.spot.index === index : false} onClick={() => clickSlot({ zone, index })} label={`${title} slot ${index + 1}`}
          crowned={!!u && plotOf(run).holders.some((h) => h.uid === u.uid && !h.disabled)} turbulence={zone === "bench" && run.escapade?.variant === "my-turbulence" && run.escapade.turbulence === index} />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <WolfComment comment={run.phase === "over"
        ? { mood: run.result === "cleared" ? "hyped" : "smug", line: run.result === "cleared" ? `Cleared with ${run.hp} HP|Not bad for a sandbox` : "Squad HP gone|Run it back, different econ", facts: [`Seed ${run.seed}, ${run.rank}.`] }
        : { mood: chance >= 0.6 ? "smug" : "neutral", line: prep ? `${NODE_LABEL[kind]} next|I give u ${Math.round(chance * 100)}%${tp?.idle.length ? `|${tp.idle[0]} is IDLE there btw` : ""}` : "Pick one|Choices matter", facts: [`Seed ${run.seed}, ${run.rank}.`] }} />

      <Hud run={run} />
      {run.note && <p role="status" className={cx("rounded-lg border px-3 py-2 text-sm", run.note.startsWith("Opened") ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-amber-300/40 bg-amber-300/10 text-amber-100")}>{run.note}</p>}

      {run.escapade && !run.escapade.revealed && run.phase !== "over" && <CompanionReveal run={run} onDone={() => update((s) => (s.escapade ? { ...s, escapade: { ...s.escapade, revealed: true } } : s))} />}
      {run.phase === "teaBreak" && <TeaBreakPanel run={run} onPick={(i) => { setSel(null); update((s) => pickTea(s, pack, i)); }} />}
      {run.phase === "plotArmor" && <PlotArmorPanel run={run} pack={pack} onProtagonist={(uid) => update((s) => chooseProtagonist(s, pack, uid))} onRefresh={() => update((s) => refreshPlot(s, pack))} onChoose={(i) => update((s) => choosePlotArmor(s, pack, i))} />}
      {run.phase === "environment" && (
        <Panel title="Choose an Investment Environment">
          <div className="grid gap-3 sm:grid-cols-3">
            {run.offers.environments?.map((e, i) => (
              <button key={e.name} type="button" onClick={() => update((s) => chooseEnvironment(s, pack, i))} className="rounded-xl border border-cyan/30 bg-gradient-to-b from-cyan/10 to-transparent p-4 text-left hover:border-cyan">
                <b className="block">{e.name}</b><span className="mt-1 block text-xs text-muted">{fillUnknown(e.name, e.effect)}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}
      {run.phase === "strategy" && (
        <Panel title="Choose an Investment Strategy">
          <div className="grid gap-3 sm:grid-cols-3">
            {run.offers.strategies?.map((st, i) => (
              <button key={st.name} type="button" onClick={() => update((s) => pickStrategy(s, pack, i))} className={cx("rounded-xl border bg-gradient-to-b to-transparent p-4 text-left hover:brightness-125", RARITY_CARD[st.rarity])}>
                <span className="text-[10px] uppercase tracking-wider text-muted">{st.rarity}{RULES.strategyDifficulty[st.rarity] ? ` · enemy difficulty +${RULES.strategyDifficulty[st.rarity]}` : ""}</span>
                <b className="block">{st.name}</b><span className="mt-1 block text-xs text-muted">{fillUnknown(st.name, st.effect)}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}
      {run.phase === "supply" && (
        <Panel title="Supply: take one character and the item they carry" actions={<Button size="sm" variant="ghost" onClick={() => update((s) => skipSupply(s, pack))}>Skip</Button>}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {run.offers.supply?.map((o, i) => (
              <div key={i} className="flex flex-col gap-1">
                {o.name === "Basic Weapon Box"
                  ? <button type="button" onClick={() => update((s) => pickSupply(s, pack, i))} className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border border-amber-300/50 bg-amber-300/[0.06] p-2 text-[11px]"><Package size={28} className="text-amber-200" />{(o.items ?? []).length} × Basic Weapon Box<span className="text-faint">Mummicat</span></button>
                  : <CharCard pack={pack} name={o.name} cost={o.cost} stars={o.stars} onClick={() => update((s) => pickSupply(s, pack, i))} footer={o.stars && o.stars > 1 ? `free ${"★".repeat(o.stars)}` : "free"} />}
                {o.items && o.items.length > 1 && o.name !== "Basic Weapon Box" && <span className="text-center text-[10px] text-amber-100">+ {o.items.slice(1).join(", ")}</span>}
                {o.item && (() => {
                  const mark = markOf(o.item, run.bag);
                  return (
                    <span title={mark.notes.length ? mark.notes.join("\n") : o.item} className={cx("relative flex items-center justify-center gap-1 rounded-md px-1 py-0.5 text-[10px]", mark.ready ? "text-text ring-2 ring-sky-400" : "text-muted", mark.wanted && !mark.ready && "text-text")}>
                      <ItemIcon pack={pack} name={o.item} size={11} /> {o.item}
                      {mark.wanted && <ThumbsUp size={11} className="shrink-0 text-emerald-400" aria-label={`Preferred by ${mark.preferred.join("; ")}`} />}
                      <WhoFaces pack={pack} names={mark.who} size={14} />{mark.ready && <span className="sr-only">Can craft now: {mark.craft.join("; ")}</span>}
                    </span>
                  );
                })()}
              </div>
            ))}
          </div>
        </Panel>
      )}
      {run.phase === "encounter" && (
        <Panel title="Encounter: pick a fight">
          <div className="grid gap-3 sm:grid-cols-2">
            {(["easy", "hard"] as const).map((w) => (
              <button key={w} type="button" onClick={() => update((s) => pickEncounter(s, w))} className={cx("rounded-xl border p-4 text-left hover:brightness-125", w === "hard" ? "border-rose-400/50 bg-rose-500/10" : "border-emerald-400/40 bg-emerald-500/10")}>
                <b className="block capitalize">{w}</b>
                <span className="text-xs text-muted">{w === "easy" ? `Weaker enemies, small reward (+${ASSUMED.encounter.easy.gold} gold).` : `Much stronger enemies, better reward (+${ASSUMED.encounter.hard.gold} gold and a basic item).`}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}
      {watching === run.tick && run.last?.timeline && (run.phase === "result" || run.phase === "over")
        ? <BattleView key={run.tick} timeline={run.last.timeline} title={`P${run.plane + 1}-${run.node + 1} ${NODE_LABEL[run.last.kind]}${run.last.opponent ? ` vs ${run.last.opponent}` : ""}`} onDone={() => setWatching(null)} />
        : <>
          {run.phase === "result" && run.last && <Report run={run} pack={pack} onNext={() => { setSel(null); update((s) => advance(s, pack)); }} />}
          {run.phase === "over" && <Summary run={run} pack={pack} onNew={quit} />}
        </>}

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Panel title={`Bonds${tp?.bonds.length ? ` (${tp.bonds.length} active)` : ""}`}>
          <BondList pack={pack} states={tp?.bonds ?? []} have={new Set(units(run).map((u) => u.name))} />
          {tp && <BondsInactive run={run} pack={pack} />}
        </Panel>

        <div className="min-w-0 space-y-3">
          <div className="glass space-y-3 p-3">
            {prep && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span>Next: <b className="text-text">{NODE_LABEL[kind]}</b>{run.nodeOpponent ? ` vs ${run.nodeOpponent}` : ""}{kind !== "Reward" && av ? ` · ${av} Action Value × 2 cycles` : ""}{run.encounter ? ` (${run.encounter})` : ""}</span>
                {tp && <span>Strength <b className="text-text">{Math.round(tp.power)}</b>{tp.bonus > 0 && <span className="text-cyan"> (+{Math.round(tp.bonus * 100)}% bonds)</span>} · win chance ≈ <b className={chance >= 0.6 ? "text-ok" : chance >= 0.4 ? "text-amber-300" : "text-bad"}>{Math.round(chance * 100)}%</b></span>}
              </div>
            )}
            {zoneRow("on", "On-Field", "grid-cols-4 max-w-[22rem]")}
            {zoneRow("off", "Off-Field", "grid-cols-3 max-w-[16.5rem] sm:max-w-[33rem] sm:grid-cols-6")}
            {zoneRow("bench", "Bench", "grid-cols-5 max-w-[27.5rem] sm:max-w-[49.5rem] sm:grid-cols-9")}
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Items ({run.bag.length})</p>
              <p className="mb-1.5 flex flex-wrap items-center gap-1 text-[11px] text-muted">
                <ThumbsUp size={11} className="text-emerald-400" /> Gear tracking:
                {gearTracked.length ? gearTracked.map((n) => (
                  <span key={n} className="inline-flex items-center gap-0.5 rounded-full border border-emerald-400/50 bg-emerald-400/10 py-0.5 pl-1.5 pr-0.5 text-emerald-100">{n}
                    <button type="button" onClick={() => toggleGear(n)} aria-label={`Stop tracking ${n}'s gear`} className="rounded-full p-0.5 hover:bg-white/10"><X size={10} /></button>
                  </span>
                )) : <span className="text-faint">everyone deployed (select a character → Track gear to choose)</span>}
                <span className="text-faint">· 👍 preferred · <span className="rounded px-1 ring-1 ring-sky-400">blue</span> = you can craft it now</span>
              </p>
              {run.bag.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {run.bag.map((it, i) => {
                    const mark = isOre(it) ? { wanted: false, ready: false, notes: [] as string[], preferred: [] as string[], craft: [] as string[], who: [] as string[] } : markOf(it, run.bag.filter((_, k) => k !== i));
                    return (
                      <button key={`${it}-${i}`} type="button" onClick={() => clickItem(i)} aria-pressed={sel?.kind === "item" && sel.index === i} title={mark.notes.length ? `${it}\n${mark.notes.join("\n")}` : it}
                        className={cx("flex items-center gap-1 rounded-md border px-1.5 py-1 text-[11px]", sel?.kind === "item" && sel.index === i ? "border-cyan bg-cyan/15" : mark.ready ? "border-sky-400 ring-1 ring-sky-400" : "border-line hover:border-cyan/50", itemKind(pack, it) === "advanced" && "text-violet-200", itemKind(pack, it) === "emblem" && "text-amber-100", isOre(it) && "border-white/20 bg-white/[0.04]")}>
                        <ItemIcon pack={pack} name={it} size={13} /> {it}
                        {mark.wanted && <ThumbsUp size={11} className="text-emerald-400" aria-label={`Preferred by ${mark.preferred.join("; ")}`} />}
                        <WhoFaces pack={pack} names={mark.who} size={16} />{mark.ready && <span className="sr-only">Can craft now: {mark.craft.join("; ")}</span>}
                      </button>
                    );
                  })}
                </div>
              ) : <p className="text-xs text-faint">Reward and Supply nodes give items and Crystal Ores.</p>}
              {run.note?.startsWith("Opened") && <p className="mt-1.5 text-xs text-cyan">{run.note}</p>}
            </div>
            {sel?.kind === "item" && run.bag[sel.index] && (() => {
              const name = run.bag[sel.index];
              const sp = specialItem(name);
              const kindOf = itemKind(pack, name);
              const hint = sp?.use === "box" ? "Choose the basic equipment inside:" : sp?.use === "projector" ? "Tap a character to copy them (1-star copy to the bench)." : sp?.use === "plotArmor" ? "Tap a deployed character to give them Plot Armor." : kindOf === "basic" || kindOf === "gem" ? "Tap a character to equip it (it combines with a matching item they hold), or tap another item here to combine them." : "Tap a character to equip it.";
              return (
                <ItemDetail pack={pack} name={name} owned={run.bag.filter((_, i) => i !== sel.index)} needs={needs} onClose={() => setSel(null)} hint={hint}
                  actions={sp?.use === "box" ? <span className="flex flex-wrap gap-1">{(pack.equipment?.basic ?? []).map((b) => <Button key={b.name} size="sm" variant="ghost" onClick={() => { update((s) => openBox(s, pack, sel.index, b.name)); setSel(null); }}><ItemIcon pack={pack} name={b.name} size={11} /> {b.name}</Button>)}</span> : undefined} />
              );
            })()}
            {peek && !sel && <ItemDetail pack={pack} name={peek} owned={run.bag} needs={needs} onClose={() => setPeek(null)} />}
            {selUnit && sel?.kind === "unit" && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cyan/40 bg-cyan/[0.06] p-2 text-xs">
                <Portrait name={selUnit.name} cost={selUnit.cost} size={30} />
                <span className="min-w-[12rem] flex-1">
                  <b className="text-text">{selUnit.npc ? "" : `${"★".repeat(selUnit.stars)} `}{selUnit.name}</b> {selUnit.npc ? <Badge>squad member</Badge> : <FieldTag field={pack.info?.[selUnit.name]?.field} />}
                  <span className="mt-0.5 flex flex-wrap items-center gap-1 text-muted">
                    {bondsOf(pack, selUnit.name).map((b) => <button key={b} type="button" onClick={() => setBondPeek(bondPeek === b ? null : b)} aria-expanded={bondPeek === b} className={cx("rounded border px-1 py-0.5 text-[10px]", bondPeek === b ? "border-cyan text-cyan" : "border-line hover:text-text")}>{b}</button>)}
                    <span>· On-Field {Math.round(unitPower(selUnit, "on", pack))} / Off-Field {Math.round(unitPower(selUnit, "off", pack))}</span>
                  </span>
                  {selUnit.items.length > 0 && <span className="mt-1 flex flex-wrap gap-1">{selUnit.items.map((it, i) => <button key={i} type="button" onClick={() => { setPeek(it); setSel(null); }} className="inline-flex items-center gap-1 rounded border border-line px-1 py-0.5 hover:border-cyan/50"><ItemIcon pack={pack} name={it} size={11} />{it}</button>)}</span>}
                  <span className="block text-faint">Tap a slot to move it there.</span>
                </span>
                {sel.spot.zone === "bench"
                  ? <Button size="sm" onClick={() => { const to = autoSpot(run, pack, selUnit); if (to) update((s) => moveUnit(s, sel.spot, to)); else update((s) => ({ ...s, note: `Team is full: level ${s.level} deploys ${teamSize(s)}.` })); setSel(null); }}><Swords size={13} /> Deploy</Button>
                  : <Button size="sm" onClick={() => { const free = run.bench.findIndex((x) => !x); if (free >= 0) update((s) => moveUnit(s, sel.spot, { zone: "bench", index: free })); setSel(null); }}><ArrowDownToLine size={13} /> To bench</Button>}
                {pack.info?.[selUnit.name]?.recommended?.length ? <Button size="sm" variant="ghost" aria-pressed={gearTracked.includes(selUnit.name)} onClick={() => toggleGear(selUnit.name)}><ThumbsUp size={13} className={gearTracked.includes(selUnit.name) ? "text-emerald-400" : ""} /> {gearTracked.includes(selUnit.name) ? "Tracking gear" : "Track gear"}</Button> : null}
                {pack.info?.[selUnit.name] && <Button size="sm" variant="ghost" onClick={() => setSheet({ name: selUnit.name, stars: selUnit.stars, items: selUnit.items, place: sel.spot.zone })}><Search size={13} /> Details</Button>}
                <Button size="sm" variant="ghost" onClick={() => { update((s) => sell(s, sel.spot)); setSel(null); }}><Coins size={13} /> Sell +{ASSUMED.sellRefund(selUnit.cost, selUnit.stars)}</Button>
                <button type="button" onClick={() => setSel(null)} aria-label="Cancel" className="rounded p-1 text-faint hover:text-text"><X size={14} /></button>
              </div>
            )}
            {selUnit && sel?.kind === "unit" && <RecommendedGear pack={pack} name={selUnit.name} place={sel.spot.zone} held={selUnit.items} bag={run.bag} compact />}
            {selUnit && sel?.kind === "unit" && bondPeek && <BondMembers pack={pack} bond={bondPeek} have={new Set(units(run).map((u) => u.name))} />}
          </div>

          <div className={cx("glass space-y-2 p-3", !prep && "pointer-events-none opacity-50")} aria-disabled={!prep}>
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted">Shop · Lv.{run.level} odds · {run.shopNote === "kept" ? <span className="text-amber-300">kept by Lock this node</span> : <span className="text-cyan">new stock for P{run.plane + 1}-{run.node + 1}</span>}</span><div className="w-full sm:w-72"><OddsBar odds={odds} /></div></div>
            <BondTracker pack={pack} />
            <div className="grid grid-cols-5 gap-1.5">
              {run.shop.map((slot, i) => slot
                ? <CharCard key={i} pack={pack} name={slot.name} cost={slot.cost} stars={slot.stars} onClick={() => update((s) => buy(s, pack, i))} disabled={run.gold < slot.cost * (slot.stars === 2 ? 3 : 1)} footer={slot.cost * (slot.stars === 2 ? 3 : 1)} highlight={deployed(run).concat(run.bench.filter(Boolean) as Unit[]).some((u) => u.name === slot.name)} />
                : <span key={i} className="rounded-xl border border-dashed border-line/60" />)}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button onClick={() => update(buyXp)} disabled={run.level >= ASSUMED.maxLevel}><span className="flex flex-col items-start leading-tight"><span className="text-xs">Buy XP · <Coins size={11} className="inline text-amber-300" /> {run.xpCost}</span><span className="text-[10px] text-faint">Lv.{run.level} {xpToNext(run.level) ? `${run.xp}/${xpToNext(run.level)}` : "max"}</span></span></Button>
              <Button onClick={() => update((s) => refresh(s, pack))}><RefreshCw size={14} /> {run.freeRefreshes ? `Free ×${run.freeRefreshes}` : <>Refresh · <Coins size={11} className="text-amber-300" /> {RULES.refreshCost}</>}</Button>
              <Button variant="ghost" onClick={() => update(toggleLock)} aria-pressed={run.locked}>{run.locked ? <Lock size={14} className="text-amber-300" /> : <LockOpen size={14} />} {run.locked ? "Locked (next node)" : "Lock shop"}</Button>
              <Button variant="primary" onClick={() => { setSel(null); setPeek(null); const before = runRef.current; update((s) => battle(s, pack)); if (runRef.current !== before && runRef.current?.last?.timeline) setWatching(runRef.current.tick); }}><Swords size={14} /> Battle</Button>
            </div>
          </div>
          <TrailblazeStorePanel run={run} pack={pack} level={tsrLevel} onBuy={(id, slot) => update((s) => buyTsr(s, pack, id, tsrLevel, slot))} onRefresh={() => update((s) => refreshTsr(s, pack, tsrLevel))} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Run log" actions={<Button size="sm" variant="ghost" onClick={() => { if (window.confirm("Abandon this run?")) quit(); }}><Undo2 size={13} /> Abandon</Button>}>
          <ol className="max-h-64 space-y-1 overflow-y-auto text-xs text-muted">{[...run.log].reverse().slice(0, 60).map((l, i) => <li key={i}>{l}</li>)}</ol>
        </Panel>
        <div className="space-y-3">
          <CompanionCard run={run} />
          <PlotArmorStatus run={run} pack={pack} onSwap={() => update((s) => swapProtagonist(s, pack))} onChange={(from, to) => update((s) => changeProtagonist(s, from, to))} />
          {(run.environment || run.strategies.length > 0) && (
            <Panel title="Your buffs">
              <ul className="space-y-1.5 text-xs">
                {run.environment && <li><Badge tone="cyan">Environment</Badge> <b>{run.environment.name}</b> <span className="text-muted">{fillUnknown(run.environment.name, run.environment.effect)}</span></li>}
                {run.strategies.map((s) => <li key={s.name}><Badge tone={s.rarity === "Prismatic" ? "violet" : s.rarity === "Gold" ? "gold" : "default"}>{s.rarity}</Badge> <b>{s.name}</b> <span className="text-muted">{fillUnknown(s.name, s.effect)}</span></li>)}
              </ul>
            </Panel>
          )}
          <Rules />
        </div>
      </div>
      <Modal open={!!sheet} onClose={() => setSheet(null)} title={sheet ? `${sheet.name} · details` : "Details"} wide>
        {sheet && <CharacterSheet key={`${sheet.name}-${sheet.stars}`} pack={pack} name={sheet.name} stars={sheet.stars} items={sheet.items} bag={run.bag} place={sheet.place} />}
      </Modal>
    </div>
  );
}

/** Bonds you're one or two characters away from, so the list isn't empty early on. */
function BondsInactive({ run, pack }: { run: RunState; pack: CwPack }) {
  const names = new Set(deployed(run).map((u) => u.name));
  const near = runBonds(run, pack)
    .map((b) => ({ b, count: b.members.filter((m) => names.has(m)).length }))
    .filter((x) => x.count > 0 && x.b.levels[0] && x.count < x.b.levels[0].count)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  if (!near.length) return null;
  return (
    <ul className="mt-2 space-y-0.5 border-t border-line pt-2 text-[11px] text-faint">
      {near.map(({ b, count }) => <li key={b.name} className="flex justify-between gap-2"><span className="truncate">{b.name}</span><span>{count}/{b.levels[0].count}</span></li>)}
    </ul>
  );
}

