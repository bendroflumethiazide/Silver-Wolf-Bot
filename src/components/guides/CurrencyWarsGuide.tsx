"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "../ui";

/**
 * Currency Wars guide. Facts are from the Honkai: Star Rail Wiki's Currency Wars pages (Voyage Into
 * the Canvas, Version 4.7) and the game's tutorial texts; general strategy advice is marked as such.
 */

const TAG = {
  beginner: "bg-emerald-500/15 text-emerald-200",
  advanced: "bg-rose-500/15 text-rose-200",
  permanent: "bg-sky-500/15 text-sky-200",
  seasonal: "bg-fuchsia-500/15 text-fuchsia-200",
} as const;
const T = ({ k, children }: { k: keyof typeof TAG; children?: ReactNode }) => <span className={cx("ml-1 rounded px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide", TAG[k])}>{children ?? k}</span>;
const H = ({ id, n, children }: { id: string; n: number; children: ReactNode }) => <h2 id={id} className="mb-2 mt-8 scroll-mt-20 text-lg font-semibold text-text first:mt-0">{n}. {children}</h2>;
const H3 = ({ children }: { children: ReactNode }) => <h3 className="mb-1.5 mt-4 text-sm font-semibold text-text">{children}</h3>;
const P = ({ children }: { children: ReactNode }) => <p className="mb-2 text-sm text-muted">{children}</p>;
const L = ({ items }: { items: ReactNode[] }) => <ul className="mb-2 space-y-1.5 text-sm text-muted">{items.map((x, i) => <li key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" /><span>{x}</span></li>)}</ul>;
const Table = ({ head, rows }: { head: string[]; rows: ReactNode[][] }) => (
  <div className="mb-3 overflow-x-auto"><table className="w-full text-left text-xs">
    <thead><tr>{head.map((h) => <th key={h} className="border-b border-line px-2 py-1.5 font-semibold text-text">{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line/50">{r.map((c, j) => <td key={j} className="px-2 py-1.5 text-muted">{c}</td>)}</tr>)}</tbody>
  </table></div>
);

const SECTIONS = [
  ["what", "What Currency Wars is"], ["mechanics", "Every mechanic"], ["teams", "Team building"], ["economy", "Economy"],
  ["progression", "Run progression"], ["v47", "Version 4.7: Voyage Into the Canvas"], ["modes", "Activities and modes"],
  ["rewards", "Rewards"], ["tips", "Mistakes and advanced tips"], ["checklist", "Checklist"],
] as const;

const ODDS = [[1, "100%", "–", "–", "–", "–"], [2, "100%", "–", "–", "–", "–"], [3, "100%", "–", "–", "–", "–"], [4, "65%", "25%", "10%", "–", "–"], [5, "45%", "33%", "20%", "2%", "–"], [6, "30%", "40%", "25%", "5%", "–"], [7, "19%", "30%", "40%", "10%", "1%"], [8, "18%", "25%", "32%", "22%", "3%"], [9, "15%", "20%", "25%", "30%", "10%"], [10, "5%", "10%", "20%", "40%", "25%"]];

export function CurrencyWarsGuide() {
  return (
    <div>
      <div className="mb-6 rounded-lg border border-line p-3 text-xs text-muted">
        <p className="mb-2"><b className="text-text">Labels:</b> <T k="beginner" /> safe to do from your first run · <T k="advanced" /> needs game sense · <T k="permanent" /> part of every period · <T k="seasonal">4.7 only</T> Voyage Into the Canvas only.</p>
        <ol className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">{SECTIONS.map(([id, t], i) => <li key={id}><a href={`#${id}`} className="text-cyan hover:underline">{i + 1}. {t}</a></li>)}</ol>
      </div>

      <H id="what" n={1}>What Currency Wars is</H>
      <P>An auto-chess style Game System in the Cosmic Strife tab of the Interastral Peace Guide. You buy characters with Gold Coins, merge copies to raise their stars, place them On-Field or Off-Field, stack Bonds and equipment, and fight through three planes of enemies that each end in a boss. <T k="permanent" /></P>
      <L items={[
        "It runs in periods. Zero-Sum Game ran from Version 3.7 to 4.6. Voyage Into the Canvas is the current one, from Version 4.7.",
        "A new period resets your progress, except the Startup Guide and the Advantage Layout.",
        "You start every match with 100 squad HP. Fail a fight and you lose some; at 0 the match is lost. Win and your rank goes up based on the HP you have left.",
      ]} />

      <H id="mechanics" n={2}>Every mechanic</H>
      <H3>Gold Coins <T k="permanent" /></H3>
      <L items={[
        "Gold buys characters, buys Experience and refreshes the store.",
        <>After each fight: <b className="text-text">base gold + winning-streak gold + interest</b>.</>,
        <>Interest: <b className="text-text">1 gold for every 10 you hold, up to 5</b>. Some Investment Strategies raise the cap (for example to 9 or 10) or remove interest for other rewards.</>,
        "The longer your winning streak, the more extra gold. The exact base and streak amounts aren't published.",
      ]} />
      <H3>Recruiting and the store <T k="permanent" /></H3>
      <L items={[
        "Characters cost 1 (gray), 2 (green), 3 (blue), 4 (purple) or 5 (gold) coins. Same cost means similar strength.",
        <>The store refreshes once at the start of every node. A manual refresh costs <b className="text-text">2 gold</b>. <b className="text-text">Lock</b> keeps the current offers through the next node.</>,
        "Your level sets the odds of each cost appearing:",
      ]} />
      <Table head={["Level", "1-cost", "2-cost", "3-cost", "4-cost", "5-cost"]} rows={ODDS} />
      <L items={["You start each match with three characters of up to blue rarity; gray and green are the most common.", "Characters you own are used with your Eidolons, Light Cone, Traces and relics. Others are trial versions (with a 4★ Light Cone)."]} />
      <H3>Star levels <T k="permanent" /></H3>
      <L items={["Three copies of the same star merge automatically: 3 × 1★ = 2★, 3 × 2★ = 3★ (nine copies in total).", "Stars raise stats and strengthen the character's Empowerment. 3★ is usually a character's strongest form."]} />
      <H3>Experience and levels <T k="permanent" /></H3>
      <L items={["You get Experience from fights and by buying it with gold (the button costs 4 gold).", "Your level sets how many characters you can deploy, and the store odds above. Level 10 is the top row of the odds table."]} />
      <H3>On-Field and Off-Field <T k="permanent" /></H3>
      <L items={[
        "Every character is On-Field, Off-Field, or On/Off-Field (either works).",
        "On-Field characters fight in the front line, on auto or under your control.",
        "Off-Field characters act on their own from the back: attacks, buffs or support.",
        <>An On-Field character placed Off-Field <b className="text-text">does nothing in battle</b>; only their bonds and items still count. The game marks wrong placements.</>,
        "Off-Field characters don't get Light Cone or relic effects that trigger on entering battle (a few signature Light Cones are adjusted for this mode).",
      ]} />
      <H3>Character Empowerment <T k="permanent" /></H3>
      <P>An ability that only exists in Currency Wars and only turns on in the right position. On-Field Empowerments enhance a character&apos;s abilities or add new ones; Off-Field ones let them fight or support from the back. Higher stars strengthen it.</P>
      <H3>Bonds <T k="permanent" /></H3>
      <L items={[
        "Each character has one to three Bond tags. Deploying more different characters with the same Bond raises its level: higher levels, stronger effects.",
        "A character counts once per Bond no matter how many copies you own.",
        "Bond tiers show as Bronze → Silver → Gold → Prismatic in the list.",
        <>4.7 groups: <b className="text-text">Faction</b> (Phantasmoon Games, Beast Garden, Xianzhou Fleet, Trailblaze Silver Rail, Astropolis Merchant Guild, High-Cloud Quintet, Stellaron Hunters, The Grand Restaurant, Intertwined Dreamscapes, Galactic Voyager, Little Giant, Girls Band), <b className="text-text">School</b> (Combo, Follow-Up ATK, DoT, AoE ATK, Break, Elation, Counter, Summon, Energy, Heal, Defender), <b className="text-text">Unique</b> (one character each) and <b className="text-text">Plot Armor</b> Bonds <T k="seasonal">4.7</T>.</>,
      ]} />
      <H3>Equipment <T k="permanent" /></H3>
      <L items={[
        <>Up to <b className="text-text">3 items</b> per character.</>,
        <>Two basic items combine into one advanced item. It keeps both items&apos; stats and adds a unique effect. 4.7 has 8 basic items, so 36 combinations; see the grid in <Link className="text-cyan" href="/currency-wars">Currency Wars → Equipment</Link>.</>,
        "Privileged equipment is a stronger version of an advanced item with the same name.",
        "Items come from Supply and Reward nodes, ores, some Bonds and Investments. A Disassembly Wrench takes items off; a Smelting Furnace rerolls an item (or all of a character's items) into others of the same quality.",
        "Each character has recommended items, and Equipment Tracking marks what to build.",
      ]} />
      <H3>Investment Environments and Strategies <T k="permanent" /></H3>
      <L items={[
        "Environment: pick 1 of 3 at the start. It lasts the whole match (for example, start with 2 basic items, or get ore worth 6/8/12 gold at the start of planes 1/2/3).",
        "Strategy: pick 1 of 3 after the first fight of each plane. The three offers share a rarity (Silver, Gold or Prismatic). Higher rarities make enemies tougher; the difficulty table lists +0/+1/+3 enemy difficulty for Silver/Gold/Prismatic.",
        "Strategies can be refreshed one at a time with the Strategy Refresh advantage.",
      ]} />
      <H3>Planes, nodes and bosses <T k="permanent" /></H3>
      <Table head={["Plane", "Nodes in order"]} rows={[
        ["1", "Reward, Reward, Strategy + Combat, Combat, Supply, Combat, Encounter, Reward, Boss"],
        ["2", "Combat, Strategy + Combat, Supply, Combat, Encounter, Reward, Boss"],
        ["3", "Combat, Strategy + Combat, Supply, Combat, Encounter, Reward, Boss"],
      ]} />
      <L items={[
        "Reward: easy fight with no time limit. Enemies drop gold and ores (more gold, basic items or characters). It doesn't add to your winning streak but doesn't break it.",
        "Combat: two waves; the third combat of a plane mixes in elites, with reinforcements replacing fallen enemies.",
        "Supply: take 1 of 5 characters, with the basic item they carry, for free. Higher levels offer rarer characters.",
        "Encounter (from Jade Steel, A2): choose an easy or a hard fight. Harder fights pay better.",
        "Boss: two phases on planes 1 and 2, three on plane 3. Each match draws 3 of 20 opponent factions; each one supplies a plane's boss and the enemies of the fights tied to it.",
        "Every fight except Reward has an Action Value limit of two cycles. Not clearing in time costs squad HP: 5/10/15 on planes 1/2/3 (boss 10/15/20), plus more the less you cleared.",
        "A fallen character revives at full HP but costs 15 Action Value (35 from Cobalt Silver, A3). In boss fights, when less than one cycle is left, your squad enters “Ultimate Instant” and deals 200% DMG.",
      ]} />
      <Table head={["Action Value (4.7)", "Plane 1", "Plane 2", "Plane 3"]} rows={[["Combat / Encounter", "150", "125", "100"], ["Boss", "180", "150", "150"]]} />
      <H3>Seasonal mechanics <T k="seasonal">4.7</T></H3>
      <P>See section 6. In short: Plot Armor, Voyage Companions, new Unique and Plot Armor Bonds, Aeon ★ Aha (7-cost), new equipment types, and all enemies having 70% independent DMG mitigation.</P>

      <H id="teams" n={3}>Team building</H>
      <L items={[
        <><T k="beginner" /> Pick a direction from what the store gives you early, usually one Faction and one School Bond that share characters.</>,
        <><T k="beginner" /> Place every character in their own position. An IDLE On-Field character Off-Field is wasted gold.</>,
        <><T k="beginner" /> Bring sustain. Revives cost Action Value, so a team that keeps dying runs out of time. The wiki itself calls good healers and shielders important.</>,
        <><T k="beginner" /> Put items on one or two carries, using their recommended items.</>,
        <><T k="advanced" /> Stay flexible until about level 6–7, then commit. Two-star versions of the right characters beat one-star “perfect” ones.</>,
        <><T k="advanced" /> Count unique members: a fourth copy doesn&apos;t raise a Bond, a different member does.</>,
      ]} />
      <P>Try it in the <Link className="text-cyan" href="/currency-wars">Team builder</Link>: it shows each character&apos;s position and strength by star and lights up Bonds as you add them.</P>

      <H id="economy" n={4}>Economy</H>
      <L items={[
        <><T k="beginner" /> Interest grows at 10, 20, 30, 40 and 50 gold. Ending a node at 50 earns the full +5; ending at 49 earns +4.</>,
        <><T k="beginner" /> Don&apos;t refresh every node early. 2 gold a refresh adds up, and the store refreshes for free each node.</>,
        <><T k="beginner" /> Lock the store when it shows copies you want but can&apos;t afford yet.</>,
        <><T k="advanced" /> Win streaks pay extra gold, so a strong early board pays for itself. A losing board burns HP and earns no streak.</>,
        <><T k="advanced" /> Level up when the next level&apos;s odds show the cost you need (4-costs from level 5, 5-costs from level 7; see the table). Spend down when you need to stabilise, not just because you can.</>,
        "Several Strategies change the rules (raise the interest cap, cheaper Experience, free refreshes). Read them; they can change the right plan.",
      ]} />
      <P>General advice in this section is common auto-chess practice, not numbers from the game.</P>

      <H id="progression" n={5}>Run progression</H>
      <Table head={["When", "What to aim for"]} rows={[
        ["Start", "Pick the Environment that fits a plan (gold, items or a strong character). Deploy your three starters in their positions."],
        ["Plane 1", "Two Reward nodes give gold and items. Buy cheap copies toward 2★, build your first advanced item, take your first Strategy."],
        ["Plane 1 boss", "Field your best squad. A loss here costs 10 HP."],
        ["Plane 2", "Level up to reach 4-costs, commit to Bonds, use the Supply node for a missing piece. Second Strategy."],
        ["Plane 3", "Fights get shorter (100 AV). Finish 3★s or 4/5-costs, complete items, third Strategy. The final boss has three phases."],
        ["After", "Rank up by remaining HP: 70+ → +3 steps, 40–69 → +2, under 40 → +1. A loss never lowers your rank."],
      ]} />
      <P>Practise the whole flow in the <Link className="text-cyan" href="/currency-wars">Run simulator</Link>. It uses the real node order, store odds, interest, refresh cost, merges and item recipes, and lists which numbers it has to guess.</P>

      <H id="v47" n={6}>Version 4.7: Voyage Into the Canvas <T k="seasonal">4.7</T></H>
      <L items={[
        "Started on 11 November 2026 (server time), with no end date listed yet.",
        <><b className="text-text">Plot Armor</b>: you pick a protagonist and give them a Plot Armor effect. Refreshing it can cost gold; some Plot Armors raise enemy difficulty. Five Plot Armor Bonds (Joint Follow-Up ATK, Four-Dimensional Frenzy, Star Hunt Oath, Deliverer, Apprenticeship) have no native members and only activate through Plot Armor. Expected Profit goals ask for Plot Armor on 15 different characters, on a 5-cost, on a 3★, and for activating a Plot Armor Bond.</>,
        <><b className="text-text">Voyage Companions</b>: one of eleven random companions joins each run. Example: March Bunny learns your highest-tier Bond, gives +1 Experience per purchase on planes 2 and 3, and replaces the Reward node before the plane 1 and 2 bosses with “Backstage Tea Break”.</>,
        <><b className="text-text">Bonds</b>: the Faction/School/Unique lineup above, with character mechanics such as Clara&apos;s modifications, Phainon&apos;s “Torchflame”, Jade&apos;s black market and Phantasmoon Games&apos; Wishpower. <b className="text-text">Aeon ★ Aha</b> can ascend into a 7-cost and collect “Miracles”.</>,
        <><b className="text-text">Equipment</b>: besides basic/advanced/privileged items there are Emblems, Red/Blue Gems, Wealth Gems, Bond components (Meal, Express, Hacking) and Script equipment.</>,
        <><b className="text-text">Investments</b>: about 70 Environments and about 300 Strategies on the wiki, including Plot Armor ones (for example Plot Armor Procurement: refreshes fixed at 1 gold plus 6 free).</>,
        <><b className="text-text">Enemies</b>: all have 70% independent DMG mitigation in this period. Bosses use their normal moves on planes 1–2 and their “Complete” moves on plane 3. From Monarch of Capital (A7), nodes can become “frenzied”.</>,
        <><b className="text-text">Advantage Layout</b>: unlocked with Phantasmal Orbs and refundable at any time. Seasonal advantages open after all permanent ones.</>,
        <>Not verified: <b className="text-text">“Escapade”</b> and <b className="text-text">“Employee Bonds”</b> don&apos;t appear on the wiki&apos;s 4.7 Currency Wars pages (Escapade is a Divergent Universe term). The closest match is Four-Dimensional Frenzy giving a “4-Cost Employment Contract”. They&apos;re left out rather than guessed.</>,
      ]} />

      <H id="modes" n={7}>Activities and modes</H>
      <L items={[
        <><b className="text-text">Standard Gambit</b> <T k="permanent" />: plays at your highest rank&apos;s difficulty and is the only mode that raises your rank. Wins give Currency Wars points and Ascension Points (more at higher difficulty); reaching ranks gives Stellar Jade.</>,
        <><b className="text-text">Overclock Gambit</b> <T k="permanent" />: a shorter mode for points, Ascension Points and banknotes, slightly less per win than Standard at the same difficulty.</>,
        <><b className="text-text">Ranks</b>: A0 Black Iron, A1 Viridian Bronze, A2 Jade Steel, A3 Cobalt Silver, A4 Ice Titanium, A5 Amethyst Gold, A6 Investment Master, A7 Monarch of Capital, A8 Wealth Creator. Each has steps (A8 has 20). You advance automatically up to A5-9; after that an Ascension Match unlocks the next rank. Higher steps add enemy stats, affixes and rules (for example Encounters from A2, minimum clear percentages from A3).</>,
        <><b className="text-text">Startup Guide</b> <T k="beginner" />: chapters of tutorial goals (deploy a 2★, buy Experience 4 times, activate a Gold Bond, win 5 in a row, earn 30 gold from interest, reach level 9…). Progress carries across periods.</>,
        <><b className="text-text">Strategy</b> (in-match): recommends a plan from your current characters and highlights them in the store.</>,
      ]} />

      <H id="rewards" n={8}>Rewards</H>
      <H3>Points (every period) <T k="permanent" /></H3>
      <P>Points from matches unlock a reward track (Stellar Jade, Star Rail Pass, Tracks of Destiny, Lost Crystal and more, up to 18,000 points). The tier depends on your Equilibrium Level. It resets <b className="text-text">every two weeks on Monday at 04:00 server time</b>.</P>
      <H3>Ascension Level <T k="seasonal">4.7</T></H3>
      <P>80 levels at 800 Ascension Points each.</P>
      <H3>Rank rewards <T k="seasonal">4.7</T></H3>
      <Table head={["Rank", "Reward"]} rows={[
        ["A0 Black Iron", "500 AP, 6 Lost Crystal"], ["A1 Viridian Bronze", "500 AP, 6 Lost Crystal"], ["A2 Jade Steel", "50 Jade, 500 AP"], ["A3 Cobalt Silver", "50 Jade, 500 AP"],
        ["A4 Ice Titanium", "100 Jade, 1,000 AP"], ["A5 Amethyst Gold", "100 Jade, 1,000 AP"], ["A6 Investment Master", "100 Jade, 1,000 AP"], ["A7 Monarch of Capital", "100 Jade, 1,000 AP"],
        ["A8 Wealth Creator", "100 Jade, 1,000 AP, Gift Trophy"],
      ]} />
      <H3>Goal lists <T k="seasonal">4.7</T></H3>
      <L items={[
        <><b className="text-text">Expected Profit</b>: Regular Challenge goals (20 Jade plus materials each: reach Lv. 10, earn 400 gold, lineup value 100, 12 advanced items, Plot Armor goals…), Bonds Intertwined (character-mechanic goals), Path of Mastery (high Bond levels) and Ultimate Game (hard goals, several at Investment Master or above).</>,
        <><b className="text-text">Bond Link</b>: 20 Jade + 100 AP for each Bond threshold reached (most Bonds have two, plus one at Investment Master+ in Standard Gambit).</>,
        <><b className="text-text">Collection</b>: 20 Jade + 200 AP per tier for unlocking Investment Strategies (15–150), Environments (5–30), Plot Armors (5–60) and Voyage Companions (3–18).</>,
        <><b className="text-text">Startup Guide</b>: 100 Jade (plus materials) per completed chapter.</>,
        <><b className="text-text">Advantage Layout</b>: spends Phantasmal Orbs (earned by completing matches); fully refundable. <T k="permanent" /> advantages include Battle Prep (all On-Field Techniques at the start of battle), Gold Blessing, Basic Armament, Bonus Supply, Strategy Refresh and Sustained Combat.</>,
      ]} />

      <H id="tips" n={9}>Mistakes and advanced tips</H>
      <H3>Common mistakes <T k="beginner" /></H3>
      <L items={[
        "Placing On-Field characters Off-Field (they don't act).",
        "Spending to 0 every node and never earning interest.",
        "Refreshing for one copy while your board loses fights.",
        "Spreading items over everyone instead of finishing advanced items on a carry.",
        "Skipping sustain: deaths cost Action Value and the fight times out.",
        "Taking Prismatic Strategies without being ready for the tougher enemies.",
      ]} />
      <H3>Advanced tips <T k="advanced" /></H3>
      <L items={[
        "Hard Encounters and Gold/Prismatic Strategies are worth it only when your board is ahead.",
        "Use Supply nodes to finish a Bond threshold or a 3★, not just to take the most expensive character.",
        "Plan your Plot Armor around a character you'll keep to the end; a 3★ or 5-cost protagonist also clears Expected Profit goals.",
        "At high ranks, minimum clear percentages punish timeouts hard. Build for clear speed, not just survival.",
      ]} />

      <H id="checklist" n={10}>Checklist</H>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>Do the Startup Guide chapters first. <T k="beginner" /></li>
        <li>Unlock the permanent Advantage Layout nodes, starting with Strategy Refresh and Bonus Supply. <T k="beginner" /></li>
        <li>Every match: right positions, sustain, items on carries.</li>
        <li>Keep interest rolling; level when the odds you need open up.</li>
        <li>Climb Standard Gambit ranks for Stellar Jade; Overclock for quick points.</li>
        <li>Collect point rewards before each two-week reset (Monday 04:00).</li>
        <li>Work through Expected Profit and Bond Link goals as your Bonds allow. <T k="seasonal">4.7</T></li>
        <li>Then the Ultimate Game goals at Investment Master and above. <T k="advanced" /></li>
      </ol>

      <p className="mt-6 text-[11px] text-faint">Sources: Honkai: Star Rail Wiki (Fandom, CC BY-SA 3.0) pages “Currency Wars”, “Currency Wars: Voyage Into the Canvas” and its Characters, Bonds, Equipment, Investment Environment, Investment Strategy, Opponent and Voyage Companion pages, “Currency Wars/Nodes”, “/Advantage Layout”, “/Startup Guide”, and the game&apos;s Currency Wars tutorial texts. Checked November 2026. Game content © HoYoverse.</p>
      <Link href="/currency-wars" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan/15 px-3 py-2 text-sm text-cyan hover:bg-cyan/25">Try it: open the Currency Wars simulator →</Link>
    </div>
  );
}
