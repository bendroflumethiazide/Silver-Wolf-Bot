/**
 * Silver Wolf companion voice — texting style.
 *
 * Modelled on how she messages the Trailblazer in-game: short bursts sent as separate bubbles,
 * shorthand (u, ur, abt, 2day, lemme, w/), little punctuation, the odd ";)" or "...", and an
 * impulsive "just pull" streak. All lines are ORIGINAL writing (docs/09-silver-wolf-voice.md).
 *
 * Format: one template = one burst of messages; "|" separates bubbles. `{name}` placeholders are
 * filled ONLY with values computed from the user's data, so personality never introduces a fact.
 */

export type Mood = "smug" | "bored" | "hyped" | "alert" | "neutral" | "glitch";

export interface Comment {
  mood: Mood;
  /** Bubbles separated by "|". Use `bubbles()` to split. */
  line: string;
  /** The verifiable facts the line is based on, shown under the messages. */
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

/** Fill placeholders. Values can never create extra bubbles ("|" in data becomes "/"). */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]).replace(/\|/g, "/") : m));
}

/** Split a line into message bubbles. */
export function bubbles(line: string): string[] {
  return line.split("|").map((b) => b.trim()).filter(Boolean);
}

/** Her in-game Messages signature, shown in the chat header (user-provided reference). */
export const SIGNATURE = "Don't make a game if you don't know how to";

export const SW = {
  name: "Silver Wolf",
  handle: "SW//",

  noGameData: [
    "Hold up|Ur database is empty|Can't play a game u didn't install|Hit download. it's like 5MB",
    "...|No game data|Download it first, then we talk",
    "Bruh|Zero files on disk|Settings → download. go",
  ],
  emptyPersonal: [
    "No save file?|Import something or add it urself|I don't comment on blank screens",
    "It's empty in here|Feed me data|Then I'll tell u what's broken",
  ],
  unsourced: [
    "No legit source for this one|Not gonna make stuff up|U add it, I'll track it",
    "Manual mode|No trusted feed to pull from|Fake data = bad builds. pass",
  ],

  // Dashboard
  dashTop: [
    "Top priority: {title}|{reason}|Everything else can wait",
    "First up|{title}|{reason}",
    "If u do one thing 2day|{title}|{reason}",
  ],
  dashClear: [
    "Nothing urgent|Either ur efficient or u didn't give me enough data|I bet it's the second one",
    "Queue's empty|Import more stuff and I'll find u something to fix",
  ],

  // Warp
  pitySoft: [
    "Pity {pity}|Soft pity zone|Odds go up every pull now|Don't stop. just pull",
    "{pity} pulls deep|It's coming|Don't hesitate",
  ],
  pityMid: [
    "Pity {pity}|Mid-game grind|Nothing fun till like 74",
    "Counter's at {pity}|Still {rate}% per pull|Save or commit. no half stuff",
  ],
  pityLow: [
    "Pity {pity}|Fresh run|Long grind ahead, budget for it",
    "{pity}?|U just hit didn't u|Next one's gonna take a while ;)",
  ],
  guaranteed: [
    "U lost the last 50/50|So the next 5★ here is locked to the featured one|That's not luck, that's a rule",
    "Guarantee's on|No coin flip this time|Just pull",
  ],
  notGuaranteed: [
    "No guarantee|Next 5★ is a {chance}% coin flip|Plan for the bad ending",
  ],
  planGood: [
    "{prob}% with {pulls} pulls|Don't ask|Don't hesitate|Just pull",
    "{pulls} pulls, {prob}% to hit|If ur asking, u want it ;)",
  ],
  planRisky: [
    "{prob}% w/ {pulls} pulls|Coin-flip territory|Worst case is {worst}. ur call",
    "{pulls} pulls → {prob}%|Risky|If u can wait for more jade... wait",
  ],
  planBad: [
    "{prob}%...|That's a lottery ticket, not a plan|U need like {median} pulls for even odds",
    "Only {pulls} pulls?|{prob}%|Save up. seriously",
  ],
  planCertain: [
    "{pulls} pulls covers the worst case ({worst})|It's a lock|Seize the moment!",
    "Guaranteed|{pulls} ≥ {worst}|Come on. now",
  ],
  simIntro: [
    "Simulator|Fake jade, zero consequences|Rage-pull here instead of the real game",
    "Sandbox mode|Seeded RNG so u can replay a run|Pull first, ask questions later ;)",
  ],
  simFive: [
    "It's here!!!|{name} at pity {pity}|Shame it's not real ;)",
    "{name}!!!|Pity {pity}|Don't get used to it",
  ],
  simDry: [
    "{count} pulls|No gold|Welcome to the real experience",
    "...|{count} pulls and nothing|RNG says hi",
  ],
  historyEmpty: [
    "What's ur pity?|Check Star Rail Station, then type it in here|I'll do the math",
    "I don't know ur pity yet|Import ur warps on Star Rail Station|Then tell me the number",
  ],

  // Characters
  charCollection: [
    "{owned}/{total} characters|{pct}%|Not bad. not done either",
    "Roster's at {owned}/{total}|Every unit u don't have is a team u can't run",
  ],
  charUnbuilt: [
    "{count} of ur characters aren't lv 80|That's a lot of bench warmers",
    "{count} half-built units|Half-built loses to fully built|Basic stuff",
  ],
  charSelf: [
    "Oh. me|Obviously a top pick|Implanting weaknesses is basically cheating ;)",
    "My page|Build me right or don't build me at all",
  ],
  charSelf999: [
    "LV.999|Level cap? never heard of it",
    "That's me w/ the cap removed|Patched it myself. don't ask how",
  ],
  charNotOwned: [
    "Not on ur roster|Check the mats before u even think abt pulling",
  ],
  charLowLevel: [
    "Lv {level}, A{asc}|This unit's still in the tutorial",
  ],
  charMaxed: [
    "80/80|Now fix their relics|That's where the real numbers are",
  ],

  // Relics & builds
  relicKeep: [
    "{score}/100|Keeper|Lock it before u feed it to something",
    "{score}!!!|Clean rolls|Screenshot-worthy ;)",
  ],
  relicGood: ["{score}/100|Usable|Not a god roll but it'll carry"],
  relicUsable: ["{score}/100|Filler|Wear it till something better drops"],
  relicFodder: [
    "{score}/100|That's not a relic, that's a bug report|Fodder",
    "{score}...|Useless subs for this build|Feed it to something",
  ],
  relicMainMismatch: ["Wrong main stat|Subs can't save it|Next"],
  relicInventory: [
    "{count} relics|{fodder} look like fodder|Clean ur inventory",
    "Inventory: {count}|{keep} worth keeping|Rest is clutter",
  ],
  relicTemplate: [
    "These weights are a generic template|Not a real build for this character|Tweak them or I'm grading on a bad curve",
  ],
  buildTop: [
    "Build rating: {grade}|{best} is carrying|{lack}",
    "{grade}|{lack}|Fix that and we'll talk",
    "Ok I looked|{grade} overall|{lack}",
  ],
  buildGreat: [
    "{grade}!!!|Ok this build is actually cracked|Lemme see who got the better one ;)",
    "{grade}|No notes|...ok one note. {lack}",
  ],
  buildEmpty: [
    "No relics on this unit|Can't rate an empty build|Import a scan first",
  ],

  // Light Cones
  lcCollection: ["{owned} light cones|{five} are 5★|Check who's actually wearing them"],

  // Materials
  materialsMissing: [
    "U're short on {count} mats|Worst one: {top}|Go farm",
    "{count} mats missing|Biggest gap is {top}|TB power doesn't spend itself",
  ],
  materialsDone: ["Everything's covered|Rare|Upgrade before u forget"],
  materialsCaveat: ["Heads up|Level-up EXP isn't in my data feed|So it's not counted"],

  // Achievements
  achievements: [
    "{done}/{total} achievements|{pct}%|Keep going",
    "{pct}% done|{left} left|Some are hidden. no spoilers unless u ask",
  ],
  achievementsZero: ["Zero achievements tracked|Start ticking boxes|I like seeing numbers go up"],

  // Teams
  teamEmpty: ["Empty slots|It's 4 characters|That's the whole game"],
  teamNoSustain: ["No sustain?|Glass cannon run|Bold. hope ur fast"],
  teamNoSupport: ["No harmony or nihility|Ur DPS is doing everything alone"],
  teamSolid: ["Roles covered: {roles}|Comp checks out|Execution's on u"],

  // Imports
  importPreview: [
    "{new} new, {changed} changed, {conflict} conflicts|Read the conflicts first|I won't overwrite ur manual stuff w/o asking",
  ],
  importDone: ["Done|{applied} records written|Messed up? there's a rollback ;)"],

  // Journal, map, misc
  journal: [
    "{count} notes|Good|I keep logs too... mostly of other ppl's security holes",
    "{count} notes logged|Memory's unreliable. text files aren't",
  ],
  journalEmpty: ["No notes|Write stuff down|Future u will thank u. probably"],
  mapEmpty: ["No zones yet|Upload a map screenshot, drop markers|Old-school but it works"],
  mapProgress: ["{done}/{total} cleared here|{pct}%|Keep sweeping"],
  universe: ["{curios} curios, {blessings} blessings logged|Collection's a grind|Good thing I like watching ppl grind ;)"],
  settings: ["Settings|Everything stays on this device unless u turn it on|I like a tight firewall"],
  dataUpdate: ["{remote} is out|U're on {local}|Patch day. update"],
  dataCurrent: ["Data's on {local}|Up to date|Nothing to patch"],
  accountNoSync: ["Sync's off|Everything here is what u typed or imported|Want verified numbers? turn on a sync"],
  accountSynced: ["Synced {ago}|Those numbers came from the game, not u|Verified ;)"],
  endgameEmpty: ["No runs logged|Can't beat a high score u never record"],
  endgameBest: ["Best {mode}: {score}|Beat it"],
  eventsExpiring: ["{name} ends in {left}|Clear it before the timer does|Now"],
  eventsNone: ["No events tracked|Add them from the notices|I'll count down for u"],
} as const;

export type LineKey = keyof typeof SW;
