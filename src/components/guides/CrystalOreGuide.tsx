"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "../ui";

/**
 * Crystal Ore guide. Every fact cites the HSR Wiki page it comes from (Voyage Into the Canvas, 4.7,
 * unless marked Zero-Sum Game). Things the wiki doesn't document are labelled "Not confirmed".
 */

const TAG = { confirmed: "bg-emerald-500/15 text-emerald-200", unconfirmed: "bg-amber-500/15 text-amber-100", advice: "bg-sky-500/15 text-sky-200", beginner: "bg-emerald-500/15 text-emerald-200", seasonal: "bg-fuchsia-500/15 text-fuchsia-200" } as const;
const T = ({ k, children }: { k: keyof typeof TAG; children?: ReactNode }) => <span className={cx("ml-1 rounded px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide", TAG[k])}>{children ?? k}</span>;
const H = ({ id, n, children }: { id: string; n: number; children: ReactNode }) => <h2 id={id} className="mb-2 mt-8 scroll-mt-20 text-lg font-semibold text-text first:mt-0">{n}. {children}</h2>;
const H3 = ({ children }: { children: ReactNode }) => <h3 className="mb-1.5 mt-4 text-sm font-semibold text-text">{children}</h3>;
const P = ({ children }: { children: ReactNode }) => <p className="mb-2 text-sm text-muted">{children}</p>;
const L = ({ items }: { items: ReactNode[] }) => <ul className="mb-2 space-y-1.5 text-sm text-muted">{items.map((x, i) => <li key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" /><span>{x}</span></li>)}</ul>;
const Table = ({ head, rows }: { head: string[]; rows: ReactNode[][] }) => (
  <div className="mb-3 overflow-x-auto"><table className="w-full min-w-[34rem] text-left text-xs">
    <thead><tr>{head.map((h) => <th key={h} className="border-b border-line px-2 py-1.5 font-semibold text-text">{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line/50 align-top">{r.map((c, j) => <td key={j} className="px-2 py-1.5 text-muted">{c}</td>)}</tr>)}</tbody>
  </table></div>
);
const Orb = ({ tier }: { tier: "White" | "Blue" | "Gold" | "Prismatic" }) => (
  <span aria-hidden className={cx("mr-1.5 inline-block h-3.5 w-3.5 rounded-full align-middle ring-1 ring-white/50", {
    White: "bg-[radial-gradient(circle_at_35%_30%,#fff,#a1a1aa)]",
    Blue: "bg-[radial-gradient(circle_at_35%_30%,#e0f2fe,#3b82f6_60%,#1e3a8a)]",
    Gold: "bg-[radial-gradient(circle_at_35%_30%,#fef9c3,#f59e0b_60%,#92400e)]",
    Prismatic: "bg-[conic-gradient(from_0deg,#f472b6,#facc15,#4ade80,#38bdf8,#a78bfa,#f472b6)]",
  }[tier])} />
);

const SECTIONS = [["types", "Every Crystal Ore"], ["start", "Starting amounts"], ["obtain", "How to get them"], ["what", "What they do"], ["compare", "Comparison and ranking"], ["max", "Getting the most"], ["beginner", "Beginner's steps"], ["research", "What's confirmed, what isn't"]] as const;

export function CrystalOreGuide() {
  return (
    <div>
      <div className="mb-6 rounded-lg border border-line p-3 text-xs text-muted">
        <p className="mb-2"><b className="text-text">Labels:</b> <T k="confirmed" /> stated on the HSR Wiki · <T k="unconfirmed">not confirmed</T> not documented anywhere I could check · <T k="advice" /> general play advice, not game data · <T k="seasonal">4.7</T> Voyage Into the Canvas only.</p>
        <p className="mb-2">Crystal Ores are the orbs enemies drop during a run (like the blue one in your screenshot). They aren&apos;t character rarity icons, a currency, equipment or the Advantage Layout.</p>
        <ol className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">{SECTIONS.map(([id, t], i) => <li key={id}><a href={`#${id}`} className="text-cyan hover:underline">{i + 1}. {t}</a></li>)}</ol>
      </div>

      <H id="types" n={1}>Every Crystal Ore</H>
      <P>The wiki names four tiers. <T k="confirmed" /> Sparxie&apos;s Zero-Sum Game page lists &ldquo;White/Blue/Golden/Prismatic crystal ore&rdquo;, and the Investment Strategies (both seasons) name a &ldquo;Gold Crystal Ore&rdquo; and a &ldquo;Prismatic Crystal Ore&rdquo;. The gray orb you see is the White tier.</P>
      <Table head={["Ore", "Looks", "Tier", "What sets it apart"]} rows={[
        [<><Orb tier="White" />White Crystal Ore</>, "White / gray orb", "1 (lowest)", "The common drop. Sparxie counted it as 1 point of “Clout”."],
        [<><Orb tier="Blue" />Blue Crystal Ore</>, "Blue orb (your screenshot)", "2", "Counted as 2 Clout."],
        [<><Orb tier="Gold" />Gold (Golden) Crystal Ore</>, "Gold orb", "3", "Counted as 8 Clout. Gold Miner gives one immediately."],
        [<><Orb tier="Prismatic" />Prismatic Crystal Ore</>, "Rainbow orb", "4 (highest)", "Counted as 40 Clout; strategies call it “packed with valuable treasures”."],
      ]} />
      <L items={[
        <>The order White → Blue → Gold → Prismatic is confirmed by Gold Miner (&ldquo;a crystal ore of one tier lower&rdquo;) and by Sparxie&apos;s Clout values (1/2/8/40). <T k="confirmed" /></>,
        <>Some ores have <b className="text-text">fixed contents</b> stated in their source: Print More Money&apos;s ore is &ldquo;worth 6/8/12 Gold Coins&rdquo;; 3★ Phainon&apos;s ore holds a 3★ character; Aeon ★ Aha&apos;s five 7-cost ores have listed rewards. <T k="confirmed" /></>,
        <>The exact in-game item names and whether a color always means a bigger reward (rather than a different pool) aren&apos;t documented. <T k="unconfirmed">not confirmed</T></>,
      ]} />

      <H id="start" n={2}>Starting amounts</H>
      <L items={[
        <>No wiki page says a run starts with any Crystal Ores, of any color. Treat the default as <b className="text-text">zero</b>. <T k="unconfirmed">not confirmed</T></>,
        <>Nothing documented ties a starting amount to difficulty, upgrades or Standard vs Overclock Gambit. The Advantage Layout&apos;s documented advantages give gold, equipment, refreshes and stats, not ores. <T k="confirmed" /></>,
        <>Ways to <b className="text-text">start a plane</b> with one: the Investment Environment <b className="text-text">Print More Money</b> gives a crystal ore worth 6/8/12 Gold Coins at the start of Planes 1/2/3, guaranteed. The Strategy <b className="text-text">Gold Miner</b> gives a Gold Crystal Ore the moment you pick it. <T k="confirmed" /></>,
        "These are rewards you choose during a run, not starting quantities.",
      ]} />

      <H id="obtain" n={3}>How to get them</H>
      <Table head={["Source", "What to do", "Guaranteed?"]} rows={[
        ["Reward nodes", "Defeat the enemies (no time limit). They drop Gold Coins and ores of varying rarity.", "Ores: yes, some. Tiers: random."],
        ["Economic Overheat / Hyperheat (Environments)", "Reward nodes become Warp Trotters that “drop more loot” (Hyperheat: “tons of treasure”, but they run fast). On the last plane's final Reward node, a massive Trotter drops ores as it loses HP, and killing it gives an “extremely rare crystal ore”.", "Drops: yes. The rare ore: only if you kill it."],
        ["Print More Money (Environment)", "Pick it at the start of the run.", "Yes: one ore worth 6/8/12 gold at the start of Planes 1/2/3."],
        ["Prismatic Ore (Plane 1) / Prismatic Ore+ (Planes 2–3) (Strategy)", "Pick it; reach the next Reward node.", "Yes: one extra Prismatic Crystal Ore."],
        ["Bursting Ore: Prismatic / Bursting Ore: Gold / Cracked Quartz: Silver (Strategy)", "Defeat enemies in any fight.", "No: 45% / 30% / 20% chance per enemy defeated. (“Silver/Gold/Prismatic” in the name is the strategy's rarity, not the ore's.)"],
        ["Gold Miner (Strategy)", "Pick it.", "One Gold Crystal Ore now. Afterwards each ore you open has a 50% chance to give an ore one tier lower and a very small chance of a Prismatic."],
        [<>Phantasmoon Games: Wishpower (Bond) <T k="seasonal">4.7</T></>, "When that rule is active, gather Wishpower after each fight (double on a Perfect Clear).", "Yes, at set Wishpower totals (table below)."],
        [<>Elation Bond, level 8 <T k="seasonal">4.7</T></>, "4-star Aha.", "“High chance” of Prismatic ores."],
        [<>Phainon (Flame Reaver) <T k="seasonal">4.7</T></>, "3★ Phainon absorbing a character gives an ore with a random 3★ character one cost lower (once per node); absorbing a 4★ Phainon gives 3 ores with 3★ 4-costs (up to 5 times per node).", "Yes, when the condition is met."],
        [<>Aeon ★ Aha at 3★ 7-cost <T k="seasonal">4.7</T></>, "Ascend Aha (Master of Phantasia).", "Yes: 5 Prismatic ores (3★ Phantasmoon/Elation characters, 10 Blue Gems, 30 Smelting Furnaces, 30 Disassembly Wrenches; coin amount unverified)."],
      ]} />
      <H3>Phantasmoon Games: Wishpower ore rewards <T k="seasonal">4.7</T> <T k="confirmed" /></H3>
      <Table head={["Level", "Total Wishpower", "Rewards"]} rows={[
        ["2", "18", "3 Gold Coins"], ["3", "48", "Random 1★ 3-, 2- and 1-cost character"], ["4", "80", "Random 1★ 4-cost character, Smelting Furnace, 2 Gold Coins"],
        ["5", "120", "Basic Weapon Box, 3 Gold Coins"], ["6", "160", "2 × 5-Cost Employment Contract"], ["7", "210", "Random Emblem"],
        ["8", "270", "Basic Weapon Box, Special Privilege Card, Smelting Furnace"], ["9", "420", "Wealth Gem"], ["10", "660", "Privilege Weapon Box, 30 Gold Coins"],
        ["11", "900", "Three 1★ Aeon ★ Aha of the current cost, 99 Gold Coins"],
      ]} />
      <P>Exploration and special events outside a run don&apos;t give Crystal Ores: they exist only inside Currency Wars matches. Ordinary Combat, Encounter and Boss nodes have no documented ore drops of their own; they only give ores through the strategies and Bonds above. <T k="unconfirmed">not confirmed</T></P>

      <H id="what" n={4}>What they do</H>
      <L items={[
        <>&ldquo;Crystal Ore can be opened to obtain Gold Coins, characters, equipment or other rare items!&rdquo; (Zero-Sum Game Bonds page). Reward-node ores contain &ldquo;more coins, basic equipment or characters&rdquo; (Nodes page). <T k="confirmed" /></>,
        "Collecting one puts it in your inventory; opening it gives what's inside. Characters go to your preparation area (bench), items to your inventory, and Gold Coins straight to your total.",
        "Fixed ores give exactly what their source says (e.g. 6, 8 or 12 gold for Print More Money).",
        <>Whether each color draws from a different reward pool, and the odds inside a random ore, are <b className="text-text">not published</b>. Higher tiers clearly hold more (the game itself values them 1/2/8/40 for Sparxie). <T k="unconfirmed">not confirmed</T></>,
      ]} />

      <H id="compare" n={5}>Comparison and ranking</H>
      <Table head={["Ore", "Rarity", "Possible rewards", "Expected value", "Prioritize?", "Special"]} rows={[
        [<><Orb tier="White" />White</>, "Most common", "Coins, basic items or characters (pool not published)", "Lowest; not documented", "Open whenever", "—"],
        [<><Orb tier="Blue" />Blue</>, "Common", "Same kinds of rewards", "Not documented", "Open when you have bench space", "—"],
        [<><Orb tier="Gold" />Gold</>, "Uncommon", "Same kinds of rewards", "Not documented (≈4× Blue by Clout)", "Yes", "Gold Miner gives one"],
        [<><Orb tier="Prismatic" />Prismatic</>, "Rare", "“Valuable treasures”", "Not documented (≈5× Gold by Clout)", "Yes, highest", "Guaranteed by Prismatic Ore strategies"],
      ]} />
      <P>Ranking from least to most valuable: <b className="text-text">White &lt; Blue &lt; Gold &lt; Prismatic</b>. This is supported by the game (Gold Miner&apos;s tier order and Sparxie&apos;s 1/2/8/40 Clout), even though exact contents aren&apos;t published. <T k="confirmed" /></P>

      <H id="max" n={6}>Getting the most</H>
      <L items={[
        <><b className="text-text">Clear every Reward node fully.</b> They have no time limit; every enemy can drop an ore. The Pre-Battle Suppression Seasonal Advantage takes 99% of Reward-node enemies&apos; HP at the start (not in special Investment Environments such as the Trotter ones). <T k="confirmed" /></>,
        <><b className="text-text">Strategies:</b> Prismatic Ore / Prismatic Ore+ for a guaranteed Prismatic; Bursting Ore (45% / 30%) or Cracked Quartz (20%) if your team kills many enemies; Gold Miner if you&apos;ll open lots of ores. <T k="confirmed" /></>,
        <><b className="text-text">Environments:</b> Print More Money (three guaranteed gold ores), Economic Overheat/Hyperheat for bigger Reward nodes; Hyperheat Trotters run fast, so bring damage. <T k="confirmed" /></>,
        <><b className="text-text">Bonds:</b> if Phantasmoon Games rolls Wishpower, perfect clears double your Wishpower. Elation at level 8 (4★ Aha) has a high chance of Prismatic ores. Phainon can farm ores by absorbing. <T k="seasonal">4.7</T></>,
        <><b className="text-text">Open them before the fight, not after.</b> Interest is paid on the gold you hold at the end of combat, so gold from an ore opened during preparation can earn interest that node. <T k="advice" /></>,
        <><b className="text-text">Keep bench space</b> before opening: an ore may hold a character. <T k="advice" /></>,
        <>Saving ores has no documented benefit (outside effects like Zero-Sum Game&apos;s Sparxie that count ores opened). <T k="unconfirmed">not confirmed</T></>,
      ]} />

      <H id="beginner" n={7}>Beginner&apos;s steps</H>
      <ol className="mb-2 list-decimal space-y-1.5 pl-5 text-sm text-muted">
        <li>In Reward nodes, defeat every enemy. The orbs they drop are your Crystal Ores. <T k="beginner" /></li>
        <li>Look at the color: White, Blue, Gold, Prismatic, from least to most valuable.</li>
        <li>Make one bench slot free, then open them during preparation.</li>
        <li>Spend or save the gold with interest in mind (1 per 10 held, up to 5).</li>
        <li>If you see Prismatic Ore or Print More Money offered and your board is stable, they&apos;re safe, guaranteed value.</li>
        <li>Mistakes to avoid: leaving Reward-node enemies alive, opening with a full bench, taking Bursting Ore on a team that kills slowly, and confusing ores with character rarity icons.</li>
      </ol>
      <P>Practise it: the <Link className="text-cyan" href="/currency-wars">Currency Wars run simulator</Link> drops ores at Reward nodes (tap one in Items to open it) and supports the ore strategies above. Its ore contents are guesses and say so.</P>

      <H id="research" n={8}>What&apos;s confirmed, what isn&apos;t</H>
      <H3>Confirmed (HSR Wiki)</H3>
      <L items={[
        "Four tiers and their order; fixed-content ores from Print More Money, Phainon and Aha; Reward-node and Trotter drops; every strategy and Bond effect quoted above; the Wishpower reward table.",
        <>Season changes: in <b className="text-text">Zero-Sum Game</b> (3.7–4.6) the Night Demigod Bond&apos;s &ldquo;Moonlight Essence&rdquo; gave ore rewards, Sparxie&apos;s &ldquo;Mega Influencer&rdquo; levelled up from opening ores (and could drop them), and an objective asked for 50 ores in one match. In <b className="text-text">Voyage Into the Canvas</b> (4.7) Phantasmoon Games: Wishpower, Elation (Aha) and Phainon took those roles. The ore strategies and Print More Money are the same in both seasons.</>,
      ]} />
      <H3>Not confirmed</H3>
      <L items={[
        "How many ores a run starts with (no source says any).",
        "The reward table and odds inside random White/Blue/Gold/Prismatic ores, and their average value in gold.",
        "How many ores a Reward node drops and the odds of each color.",
        "Whether each color uses a separate reward pool.",
      ]} />
      <p className="mt-6 text-[11px] text-faint">Sources: Honkai: Star Rail Wiki (Fandom, CC BY-SA 3.0): Currency Wars/Nodes; Currency Wars: Voyage Into the Canvas/Investment Strategy, /Investment Environment, /Bonds, /Equipment, /Advantage Layout; Currency Wars: Zero-Sum Game/Bonds, /Investment Strategy; Sparxie (Zero-Sum Game). Checked November 2026. Game content © HoYoverse.</p>
    </div>
  );
}
