/**
 * Voyage Companions (Escapade, Version 4.7). Names, headings and effect texts are copied from the HSR
 * Wiki page "Currency Wars: Voyage Into the Canvas/Voyage Companion": "At the start of each Currency
 * Wars run, the player will be given one of eleven different Voyage Companions… The companion is
 * random and there is no way to guarantee a specific companion or their effects."
 *
 * Each wiki bullet is one possible effect ("variant"); a run rolls one companion and one of its
 * variants. `assumed` says what the simulator had to fill in where the wiki gives no number.
 */

export type CompanionCategory = "equipment" | "resource" | "node";

export interface CompanionVariant {
  id: string;
  /** The wiki heading the effect is listed under. */
  title: string;
  text: string;
  category: CompanionCategory;
  /** Planes (0-based) whose Reward Node before the boss becomes "Backstage Tea Break". */
  teaBreak?: number[];
  /** "Pearliefin's Treasury" replaces the final Reward Node of these planes. */
  treasury?: number[];
  assumed?: string;
}

export interface Companion {
  name: string;
  /** Short look for the reveal card (the wiki's artwork stays on the wiki). */
  emoji: string;
  color: string;
  variants: CompanionVariant[];
}

const BEFORE = (planes: string) => `The Reward Node before the ${planes} boss will be replaced with "Backstage Tea Break."`;

export const COMPANIONS: Companion[] = [
  { name: "March Bunny", emoji: "🐰", color: "from-pink-400/40", variants: [
    { id: "mb-emblem", title: "March Bunny, apprentice training in progress!", category: "equipment", text: "March Bunny will learn the Bond with the highest tier and wear its corresponding Emblem~", assumed: "March Bunny joins as a squad member (like Peppy) and re-learns your highest-tier active Bond at each node." },
    { id: "mb-xp", title: "March Bunny, apprentice training in progress!", category: "resource", text: "Gain 1 extra point of Experience when purchasing Experience in the Second/Third Plane." },
    { id: "mb-photo", title: "You'll run into March Bunny in Backstage Tea Break.", category: "node", teaBreak: [0, 1], text: `${BEFORE("First/Second Plane")} After selecting a Companion Occurrence, March Bunny will record the characters currently on the field and provide copies of these characters in subsequent Nodes.`, assumed: "One 1-star copy of a recorded character per node, in recorded order." },
    { id: "mb-supplies", title: "You'll run into March Bunny in Backstage Tea Break.", category: "node", teaBreak: [0], text: `${BEFORE("First Plane")} After selecting a Companion Occurrence, March Bunny will automatically refresh the Store and purchase characters for you.`, assumed: "On each of the next 1–3 nodes the Store refreshes for free and March Bunny buys one character for free (one you already own if offered, else the cheapest)." },
    { id: "mb-three", title: "You'll run into March Bunny in Backstage Tea Break.", category: "node", teaBreak: [1], text: `${BEFORE("Second Plane")} After selecting a Companion Occurrence, March Bunny will summon Woof Woof Dan to join you on your adventure.` },
  ] },
  { name: "Woof Woof Dan", emoji: "🐶", color: "from-teal-400/40", variants: [
    { id: "wd-plane", title: "Woof Woof Dan wants to protect you!", category: "node", text: "Starting from the First/Second/Third Plane, the first failed combat becomes a Perfect Clear.", assumed: "The starting plane is rolled with the companion." },
    { id: "wd-each", title: "Woof Woof Dan wants to protect you!", category: "node", text: "The first failed battle in each Plane becomes a Perfect Clear." },
    { id: "wd-affix", title: "Woof Woof Dan will accompany you for a short break in \"Backstage Tea Break.\"", category: "node", teaBreak: [0], text: `${BEFORE("First Plane")} After selecting the Companion Occurrence, Woof Woof Dan will help you remove a random enemy affix.`, assumed: "The simulator has no separate affixes, so this lowers enemy difficulty by 1." },
    { id: "wd-difficulty", title: "Woof Woof Dan will accompany you for a short break in \"Backstage Tea Break.\"", category: "node", teaBreak: [0], text: `${BEFORE("First Plane")} After selecting a Companion Occurrence, Woof Woof Dan will help you reduce the enemy difficulty.`, assumed: "The wiki marks the amount as unverified; 2 is used." },
    { id: "wd-stars", title: "Woof Woof Dan will accompany you for a short break in \"Backstage Tea Break.\"", category: "node", teaBreak: [0], text: `${BEFORE("First Plane")} Woof Woof Dan will help you lower the enemy star rating.`, assumed: "Later enemies are 10% weaker." },
  ] },
  { name: "Himekat", emoji: "🐱", color: "from-rose-400/40", variants: [
    { id: "hk-coffee", title: "You'll run into Himekat in Backstage Tea Break.", category: "node", teaBreak: [0, 1], text: `${BEFORE("First/Second Plane")} After selecting a Companion Occurrence, Himekat will invite you to taste different coffees and experience their various effects.`, assumed: "Three coffees are offered; \"Nameless Coffee\" gives one of the others' rewards and loses 1–10 HP." },
    { id: "hk-strange", title: "You'll run into Himekat in Backstage Tea Break.", category: "node", teaBreak: [0, 1], text: `${BEFORE("First/Second Plane")} After selecting a Companion Occurrence, Himekat will invite you to try different coffees, but this time, the coffees seem a bit different.` },
  ] },
  { name: "Mr. Yang", emoji: "🐻", color: "from-amber-500/40", variants: [
    { id: "my-singularity", title: "Mr. Yang unleashes his black hole powers!", category: "equipment", text: "Obtain the special equipment \"Imploding Singularity\" at the start. It provides stat growth on a winning streak and reduces equipment stats upon defeat." },
    { id: "my-turbulence", title: "Mr. Yang unleashes his black hole powers!", category: "node", text: "A \"Black Hole Turbulence Slot\" lasting for 1 Node randomly appears in the preparation area. Upon entering a new Node, the character standing on the \"Black Hole Turbulence Slot\" changes into a new character of the same cost." },
    { id: "my-talent", title: "Mr. Yang unleashes his black hole powers!", category: "resource", text: "A \"Talent Black Hole Slot\" randomly appears in the Store. Purchasing the character in this slot will refresh another character of the same cost." },
    { id: "my-talent2", title: "Mr. Yang unleashes his black hole powers!", category: "resource", text: "A \"Talent Black Hole Slot\" randomly appears in the Store. Purchasing the character in this slot will also refresh a 3/4/5-cost character based on the plane." },
    { id: "my-robot", title: "Mr. Yang has prepared a mechanical support plan.", category: "node", text: "Summons a Belobog Robot with 150 SPD. When taking action, it attacks all enemies, deals Fire DMG equal to 400% of base DMG, and causes the character who has dealt the most DMG in this battle to immediately take action." },
    { id: "my-robot-node", title: "Mr. Yang has prepared a mechanical support plan.", category: "node", text: "Mr. Yang will dispatch mechanical support at the designated Node.", assumed: "The designated Nodes are taken to be the Boss Nodes." },
    { id: "my-robot-plus", title: "Mr. Yang has prepared a mechanical support plan.", category: "node", text: "Mr. Yang will deploy higher-grade mechanical support at the designated Node.", assumed: "Boss Nodes, with a robot hitting twice as hard." },
  ] },
  { name: "Sundove", emoji: "🐦", color: "from-yellow-300/40", variants: [
    { id: "sd-strategy", title: "Sundove flaps their wings, getting ready to advance your actions!", category: "node", text: "Investment Strategy Nodes will appear early in different planes.", assumed: "Each plane's Strategy Node moves one node earlier." },
    { id: "sd-gift", title: "Sundove flaps their wings, getting ready to advance your actions!", category: "resource", text: "Sundove flaked, failed to advance actions. As compensation, he brought back a gift.", assumed: "The gift is a Gold Crystal Ore." },
    { id: "sd-reward", title: "Sundove will take flight in \"Backstage Tea Break.\"", category: "node", teaBreak: [0, 1], text: `${BEFORE("First/Second Plane")} After selecting a Companion Occurrence, Sundove will advance the Reward Node in subsequent planes.`, assumed: "The next plane's Reward Node moves one node earlier." },
    { id: "sd-supply", title: "Sundove will take flight in \"Backstage Tea Break.\"", category: "node", teaBreak: [0, 1], text: `${BEFORE("First/Second Plane")} After selecting a Companion Occurrence, Sundove will advance the Supply phase in subsequent planes.`, assumed: "The next plane's Supply Node moves one node earlier." },
  ] },
  { name: "Cottontail", emoji: "🐇", color: "from-slate-300/40", variants: [
    { id: "ct-shroom", title: "Cottontail will perform a grand transformation act in \"Backstage Tea Break.\"", category: "node", teaBreak: [0], text: `${BEFORE("First Plane")} After selecting a Companion Occurrence, Cottontail will act as other small animals to bring you random effects.` },
    { id: "ct-malfunction", title: "Cottontail is ready to cause some trouble!", category: "resource", text: "A Store malfunction will occur at the designated Node in the First/Second/Third Plane: The Store is forced to refresh every 4 seconds for a total of 7 times.", assumed: "The designated Node is each plane's Supply Node's next fight; the 7 refreshes are given as 7 free refreshes for that node (they expire at the next node)." },
    { id: "ct-strategy", title: "Cottontail is ready to cause some trouble!", category: "resource", text: "The first time an Investment Strategy is refreshed in each Plane, it will be refreshed into a higher-quality Investment Strategy." },
  ] },
  { name: "Ashwolf", emoji: "🐺", color: "from-zinc-400/40", variants: [
    { id: "aw-plane", title: "Ashwolf has accepted an assignment for you.", category: "resource", text: "At the start of the First/Second/Third Plane, Ashwolf will accept an assignment for you.", assumed: "The wiki doesn't list these assignments or rewards: a random one from the Tea Break list is used, rewarding a Gold Crystal Ore, and it lasts until the plane ends." },
    { id: "aw-tea", title: "Ashwolf will look for you in \"Backstage Tea Break\" to chat about a new assignment.", category: "node", teaBreak: [0, 1], text: `${BEFORE("First/Second Plane")} After selecting a Companion Occurrence, Ashwolf will offer several high-difficulty assignments for you to choose from.`, assumed: "3 of the wiki's assignments are offered; rewards aren't listed, so a Gold (First Plane) or Prismatic (Second Plane) Crystal Ore is used. Unfinished ones carry over." },
  ] },
  { name: "Bubble Wolf", emoji: "🫧", color: "from-sky-400/40", variants: [
    { id: "bw-strategy", title: "Bubble Wolf will type in a string of mysterious code in \"Backstage Tea Break.\"", category: "node", teaBreak: [0, 1], text: `${BEFORE("First/Second Plane")} After selecting a Companion Occurrence, Bubble Wolf will bring you 1 Investment Strategy selection of a random quality.` },
    { id: "bw-plot", title: "Bubble Wolf will type in a string of mysterious code in \"Backstage Tea Break.\"", category: "node", teaBreak: [0], text: `${BEFORE("First Plane")} After selecting a Companion Occurrence, Bubble Wolf will make powerful Plot Armor more likely to appear in this match, and they will not increase enemy difficulty.` },
    { id: "bw-weaken", title: "Bubble Wolf is stealthily hacking in...", category: "node", text: "Hacked into the Node system! All Frenzied Nodes have turned into Weakened Nodes!", assumed: "The simulator's elite fights (the last Combat Node of a plane) stand in for Frenzied Nodes: their enemies are 15% weaker." },
    { id: "bw-turbulent", title: "Bubble Wolf is stealthily hacking in...", category: "equipment", text: "Hacked into the equipment system! You will obtain \"Turbulent Basic Equipment.\"", assumed: "Given as 2 random basic equipment (the Turbulent version isn't described)." },
    { id: "bw-strategy-mod", title: "Bubble Wolf is stealthily hacking in...", category: "resource", text: "Bubble Wolf has hacked into the system and modified your Investment Strategy for this run.", assumed: "Your next Investment Strategy offer is Prismatic." },
    { id: "bw-trotters", title: "You'll run into Bubble Wolf in Backstage Tea Break.", category: "node", teaBreak: [0], text: "The Reward Node before this plane's boss will be replaced with \"Backstage Tea Break.\" After selecting a Companion Occurrence, Bubble Wolf will hack into enemy data, giving enemies in subsequent Combat Nodes of the current match a chance to turn into Trotters.", assumed: "25% per fight; Trotter fights are 40% easier and drop a Blue Crystal Ore." },
  ] },
  { name: "Evanefox", emoji: "🦊", color: "from-orange-400/40", variants: [
    { id: "ef-p1-emblem", title: "Evanefox is here to show support! Fan gifts will appear in Supplies!", category: "equipment", text: "Equipment supplied in the First Plane becomes Emblems." },
    { id: "ef-p1-2emblem", title: "Evanefox is here to show support! Fan gifts will appear in Supplies!", category: "equipment", text: "Equipment supplied in the First Plane becomes 2 random Emblems." },
    { id: "ef-p2-emblem", title: "Evanefox is here to show support! Fan gifts will appear in Supplies!", category: "equipment", text: "Equipment supplied in the Second Plane becomes Emblems." },
    { id: "ef-2star", title: "Evanefox is here to show support! Fan gifts will appear in Supplies!", category: "resource", text: "All Supplies in this match become 2-star character Supplies." },
    { id: "ef-3star", title: "Evanefox is here to show support! Fan gifts will appear in Supplies!", category: "resource", text: "In this match, the Supplies in the First and Second Planes become 3-star, 1-cost character Supplies." },
    { id: "ef-p1-4cost", title: "Evanefox is here to show support! Fan gifts will appear in Supplies!", category: "resource", text: "All characters in the First Plane's Supply will become 4-cost characters." },
    { id: "ef-p2-5cost", title: "Evanefox is here to show support! Fan gifts will appear in Supplies!", category: "resource", text: "All characters in the Second Plane's Supply will become 5-cost characters." },
  ] },
  { name: "Mummicat", emoji: "😺", color: "from-amber-200/40", variants: [
    { id: "mc-refund", title: "Mummicat is hammering away!", category: "equipment", text: "When synthesizing a piece of equipment for the first time in each Plane, one piece of the basic equipment used will be refunded." },
    { id: "mc-box", title: "Mummicat is hammering away!", category: "equipment", text: "When obtaining a piece of basic equipment, Mummicat crafts it into a \"Basic Weapon Box.\"" },
    { id: "mc-supply-box", title: "Mummicat is hammering away!", category: "equipment", text: "Mummicat has transformed all Supply phase characters into equipment boxes.", assumed: "Each Supply pick becomes 2 Basic Weapon Boxes instead of a character and item." },
  ] },
  { name: "Pearliefin", emoji: "🐟", color: "from-cyan-300/40", variants: [
    { id: "pf-gifts", title: "Pearliefin will practice painting in \"Backstage Tea Break.\"", category: "node", teaBreak: [0, 1, 2], text: `${BEFORE("First/Second/Third Plane")} After selecting a Companion Occurrence, you will receive Pearliefin's gift: 3 "Intern Projectors" (First Plane), 2 "Staff Projectors" (Second), 1 "Perfect Projector" (Third).` },
    { id: "pf-copy", title: "Pearliefin will practice painting in \"Backstage Tea Break.\"", category: "node", teaBreak: [0, 1, 2], text: "All Reward Nodes before the Plane bosses will be replaced with \"Backstage Tea Break.\" After selecting a Companion Occurrence, Pearliefin will replicate a character on the field. Obtain a 1-star copy of them." },
    { id: "pf-treasury", title: "Pearliefin has opened their art collection.", category: "node", treasury: [1, 2], text: "The final Reward Node in the Second/Third Plane will be replaced with Pearliefin's Treasury.", assumed: "The Treasury's contents aren't listed: pick 1 of 3 advanced equipment." },
  ] },
];

export const companionOf = (name: string) => COMPANIONS.find((c) => c.name === name);
export const variantOf = (id: string) => COMPANIONS.flatMap((c) => c.variants).find((v) => v.id === id);
