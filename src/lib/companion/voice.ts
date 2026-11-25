/**
 * Silver Wolf companion voice.
 *
 * Every line here is ORIGINAL writing in her style (see docs/silver-wolf-voice.md). No in-game
 * voice lines are reproduced. Lines are templates: `{name}` placeholders are filled ONLY with
 * values computed from the user's data, so personality never introduces a fact.
 */

export type Mood = "smug" | "bored" | "hyped" | "alert" | "neutral" | "glitch";

export interface Comment {
  mood: Mood;
  line: string;
  /** The verifiable facts the line is based on, shown under the speech bubble. */
  facts: string[];
  action?: { label: string; href: string };
}

/** Deterministic choice: same context + same day → same line (no flicker between renders). */
export function pick<T>(options: readonly T[], key: string, day = new Date().toISOString().slice(0, 10)): T {
  const s = `${key}|${day}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return options[h % options.length];
}

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export const SW = {
  name: "Silver Wolf",
  handle: "SW//",
  signoffs: ["GG.", "Logging off.", "Back to my game.", "Don't make me debug this twice."],

  noGameData: [
    "No game data loaded. Can't speedrun a level that isn't installed. Hit download — it's like five megabytes, you'll live.",
    "Database is empty. I could guess, but guessing is for people who don't read patch notes. Download the data first.",
    "Zero records on disk. Install the game data and I'll start pointing out everything you're doing wrong. Helpfully.",
  ],
  emptyPersonal: [
    "No save file detected. Import a scan or add stuff manually — I don't do commentary on blank screens.",
    "Nothing here yet. Feed me some data and I'll tell you what's broken.",
    "Empty inventory. Either you're new, or you haven't imported anything. Fix one of those.",
  ],
  unsourced: [
    "No permitted data source for this module yet. I'm not making stuff up to fill the screen — that's how you get bad builds.",
    "This one's on manual. No trusted feed to pull from, and I don't fabricate data. Add entries yourself and I'll track them.",
  ],

  // Dashboard
  dashTop: [
    "Top priority: {title}. {reason} Everything else can wait.",
    "Quest log's sorted. First up — {title}. {reason}",
    "If you only do one thing today: {title}. {reason}",
  ],
  dashClear: [
    "Nothing urgent in my queue. Either you're efficient, or you haven't given me enough data. I suspect the second one.",
    "No objectives flagged. Import more data and I'll find something for you to fix.",
  ],

  // Warp
  pitySoft: [
    "Pity {pity}. You're in the soft-pity zone — odds climb every pull from here. This is the part where you don't stop.",
    "{pity} pulls deep. Soft pity's active. The RNG is about to get generous, statistically speaking.",
  ],
  pityMid: [
    "Pity {pity}. Mid-game grind. Nothing exciting until about 74.",
    "{pity} on the counter. Base rate's still {rate}% per pull. Save or commit — no half-measures.",
  ],
  pityLow: [
    "Pity {pity}. Fresh start. Long road ahead — budget like it.",
    "Counter's at {pity}. You just hit, didn't you? Enjoy it. The next one's a grind.",
  ],
  guaranteed: [
    "You lost the last 50/50, so your next 5★ here is locked to the featured unit. That's not luck. That's a rule.",
    "Guarantee's active. Next 5★ on this banner is the rate-up. No coin flip this time.",
  ],
  notGuaranteed: [
    "No guarantee. Next 5★ is a {chance}% coin flip for the featured one. Plan for the bad branch.",
  ],
  planGood: [
    "{prob}% chance with {pulls} pulls. Those are odds I'd queue into.",
    "{pulls} pulls, {prob}% to hit. Solid. Still not 100, so don't brag yet.",
  ],
  planRisky: [
    "{prob}% with {pulls} pulls. Coin-flip territory. Worst case needs {worst}. Your call.",
    "{pulls} pulls gets you {prob}%. Risky. If you can wait for more Jade, wait.",
  ],
  planBad: [
    "{prob}% chance. That's not a plan, that's a lottery ticket. You need about {median} pulls for even odds.",
    "Only {pulls} pulls? {prob}% odds. I've seen better win rates from bots. Save up.",
  ],
  planCertain: [
    "{pulls} pulls covers the worst case of {worst}. Guaranteed. Go ahead, flex.",
  ],
  simIntro: [
    "Simulator. Fake Jade, fake pulls, zero consequences. Rage-pull here instead of in the real game.",
    "Sandbox mode. Nothing here touches your account. Seeded RNG, so you can replay a run exactly.",
  ],
  simFive: [
    "Gold. {name} at pull {pity}. Don't get used to it — it's a simulation.",
    "{name}, pity {pity}. Nice roll. Shame it's not real.",
  ],
  simDry: [
    "{count} pulls, no 5★. Welcome to the actual experience.",
    "Nothing gold in {count} pulls. The RNG says hi.",
  ],
  historyEmpty: [
    "No Warp history imported. Export a UIGF or SRGF file from a gacha-log tool and drop it here. I'll do the math.",
  ],
  historyIncomplete: [
    "Heads up: the game only keeps recent Warp records. Anything older is missing unless you set the starting pity yourself.",
  ],

  // Characters
  charCollection: [
    "{owned} of {total} characters. {pct}% collection. Not bad. Not complete either.",
    "Roster: {owned}/{total}. Every unit you don't have is a team comp you can't run.",
  ],
  charUnbuilt: [
    "{count} owned characters still under level 80. That's a lot of bench warmers.",
    "{count} characters below max level. Half-built units lose to fully-built ones. Basic stuff.",
  ],
  charSelf: [
    "Oh, me. Obviously a top pick. Implanting weaknesses is basically cheating, and I'm very good at cheating.",
    "My profile. Weakness implant, DEF shred, bugs everywhere. Build me properly or don't build me at all.",
  ],
  charSelf999: [
    "LV.999 build. Max level is a suggestion. I patched it.",
    "That's me with the level cap removed. Don't ask how. It's a feature, not a bug.",
  ],
  charNotOwned: [
    "Not on your roster. Check the material list before you even think about pulling.",
  ],
  charLowLevel: [
    "Level {level}. Ascension {asc}. This unit's still in the tutorial.",
  ],
  charMaxed: [
    "Level 80, ascension 6. Now go fix their relics — that's where the real numbers are.",
  ],

  // Relics
  relicKeep: [
    "{score}/100. That's a keeper. Lock it before you accidentally feed it to something.",
    "{score}. Clean rolls. This is the kind of drop people screenshot.",
  ],
  relicGood: [
    "{score}/100. Usable. Not a god roll, but it'll carry for now.",
  ],
  relicUsable: [
    "{score}/100. Filler. Wear it until something better drops.",
  ],
  relicFodder: [
    "{score}/100. That's not a relic, that's a bug report. Fodder.",
    "{score}. Useless substats for this profile. Feed it to something that matters.",
  ],
  relicMainMismatch: [
    "Wrong main stat for this profile. Substats can't save it. Next.",
  ],
  relicInventory: [
    "{count} relics scanned. {fodder} look like fodder for the profiles you've set. Clean up your inventory.",
    "Inventory: {count} relics. {keep} worth keeping. The rest is clutter.",
  ],
  relicTemplate: [
    "These weights are a generic template, not a real build for this character. Tweak them, or I'm grading on a bad curve.",
  ],

  // Light Cones
  lcCollection: [
    "{owned} Light Cones logged. {five} of them are 5★. Check who's actually wearing them.",
  ],

  // Materials
  materialsMissing: [
    "You're short on {count} materials. {top} is the worst one. Go farm.",
    "{count} materials missing. Biggest gap: {top}. Trailblaze Power doesn't spend itself.",
  ],
  materialsDone: [
    "Everything's covered. Rare. Upgrade before you spend it on something dumb.",
  ],
  materialsCaveat: [
    "This counts ascension and trace costs from the game tables. Level-up EXP isn't in my data feed, so it's not included.",
  ],

  // Achievements
  achievements: [
    "{done} of {total} achievements. {pct}%. Completionist run's in progress.",
    "{pct}% complete. {left} left. Some are hidden — no spoilers unless you ask.",
  ],
  achievementsZero: [
    "Zero achievements tracked. Start ticking boxes. I like seeing numbers go up.",
  ],

  // Teams
  teamEmpty: [
    "Empty slots. Four characters, Trailblazer. That's the whole game.",
  ],
  teamNoSustain: [
    "No Preservation or Abundance unit. Glass-cannon strat? Bold. Hope you're fast.",
  ],
  teamNoSupport: [
    "No Harmony or Nihility support. Your DPS is doing all the work alone.",
  ],
  teamSolid: [
    "Roles look covered: {roles}. Composition checks out. Execution is on you.",
  ],

  // Imports
  importPreview: [
    "{new} new, {changed} changed, {conflict} conflicts. Read the conflicts before you hit apply. I won't overwrite your manual stuff without asking.",
  ],
  importDone: [
    "Import applied. {applied} records written. If it went wrong, there's a rollback. You're welcome.",
  ],

  // Journal, map, misc
  journal: [
    "{count} notes. Good. Even I keep logs — mostly of other people's security holes.",
    "Notes logged: {count}. Memory is unreliable. Text files aren't.",
  ],
  journalEmpty: [
    "No notes. Write things down. Future you will thank present you. Probably.",
  ],
  mapEmpty: [
    "No map zones yet. Upload a map screenshot, drop markers, track your loot. Old-school, but it works offline.",
  ],
  mapProgress: [
    "{done} of {total} markers cleared in this zone. {pct}%. Keep sweeping.",
  ],
  settings: [
    "Settings. Everything stays on this device unless you turn something on. I like a tight firewall.",
  ],
  dataUpdate: [
    "Version {remote} is out and you're on {local}. Patch day. Update the data.",
  ],
  dataCurrent: [
    "Data's on {local}. Up to date. Nothing to patch.",
  ],
  accountNoSync: [
    "Sync is off. Everything here is what you typed or imported. If you want verified numbers, enable the public showcase lookup.",
  ],
  accountSynced: [
    "Showcase synced {ago}. Those numbers came from the game, not from you. Verified.",
  ],
  endgameEmpty: [
    "No endgame runs logged. Can't track a high score you never record.",
  ],
  endgameBest: [
    "Best {mode} run: {score}. Beat it.",
  ],
  eventsExpiring: [
    "{name} ends in {left}. Clear it before the timer does.",
  ],
  eventsNone: [
    "No events tracked. Add them from the official notices and I'll count down for you.",
  ],
} as const;

export type LineKey = keyof typeof SW;
