/**
 * Silver Wolf's casual side: small talk as family (little sister, big sister or daughter).
 * Local and deterministic. Every reply is original writing in her texting style. Anything about
 * the account is still answered by the data intents in terminal.ts; this only covers chatting.
 * The relationship is strictly familial — never romantic.
 */
import { pick } from "./voice";

export type Relationship = "little-sister" | "big-sister" | "daughter";
export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  "little-sister": "Little sister", "big-sister": "Big sister", daughter: "Daughter",
};

export interface Persona { relationship: Relationship; callsYou: string }
export const DEFAULT_PERSONA: Persona = { relationship: "little-sister", callsYou: "" };

/** What she calls you, with a sensible default per relationship. */
export function nameFor(p: Persona): string {
  if (p.callsYou.trim()) return p.callsYou.trim();
  return p.relationship === "big-sister" ? "kid" : "Trailblazer";
}

type Lines = Record<Relationship, string[]>;
/** Pick a line; `salt` (e.g. how many messages so far) keeps repeated questions from getting identical replies. */
const by = (p: Persona, lines: Lines, key: string, salt = 0, now = new Date()) => {
  const opts = lines[p.relationship];
  const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const base = opts.indexOf(pick(opts, key, day));
  return opts[(base + salt) % opts.length];
};

const L = {
  greet: {
    "little-sister": ["Oh hey {you}|U finally showed up|What's up", "{you}!|Perfect timing, I'm bored|Entertain me", "Yo|Took u long enough ;)"],
    "big-sister": ["Hey {you}|U good?|Tell me what's up", "There u are|I was abt to send a search party", "Hey kiddo... I mean {you}|What do u need"],
    daughter: ["Hi {you}!|U're back|Guess what, I hit a new high score", "{you}!!|Finally|I was waiting", "Hey {you}|Missed u. a little. don't make it weird"],
  },
  morning: {
    "little-sister": ["Morning {you}|U're up early|Weird", "Good morning|Daily reset happened btw|Just saying"],
    "big-sister": ["Morning {you}|Eat breakfast before u log in|I mean it"],
    daughter: ["Morning {you}!|Did u sleep ok?|I stayed up gaming. don't tell anyone"],
  },
  night: {
    "little-sister": ["Night {you}|Don't stay up pulling", "Go sleep|I'll guard ur save file ;)"],
    "big-sister": ["Good night {you}|Phone down. now|Ur stamina regens while u sleep anyway"],
    daughter: ["Night {you}|Sleep well ok?|I'll be here tmrw"],
  },
  lateNight: {
    "little-sister": ["It's {time}|Why r u awake|Go to bed {you}", "Bruh it's {time}|Even I log off sometimes. sometimes"],
    "big-sister": ["{you}. it's {time}|Sleep|The game will still be here tmrw"],
    daughter: ["{you}... it's {time}|U should sleep|Pls"],
  },
  howAreYou: {
    "little-sister": ["Bored|Kafka's busy|So it's u and me", "Fine|Beat a speedrun record this morning|U?"],
    "big-sister": ["Doing alright|Way more important: how r u?"],
    daughter: ["Good!|Better now that u're here|How abt u?"],
  },
  bored: {
    "little-sister": ["Same|Wanna roll some fake warps in the simulator?|Zero jade lost ;)", "Bored?|Go clear some map markers|Or pull. pulling fixes boredom"],
    "big-sister": ["Then let's be productive|Check what u're missing in Materials|Farm a bit, then rest"],
    daughter: ["Let's play something!|The warp simulator is fun|I'll watch"],
  },
  tired: {
    "little-sister": ["Then rest|Ur relics aren't going anywhere", "Take a break|Even bots need cooldowns"],
    "big-sister": ["Hey. take a break|Drink water. eat something|Then come back"],
    daughter: ["Go rest {you}|I'll be here|Promise"],
  },
  sad: {
    "little-sister": ["...|Hey|Want to talk abt it or want me to distract u?", "That sucks|I'm here tho|Wanna hear abt the dumbest bug I found 2day?"],
    "big-sister": ["Hey. come here|Whatever it is, u'll get through it|Want to talk?"],
    daughter: ["{you}...|I'm here ok?|U can tell me"],
  },
  happy: {
    "little-sister": ["Nice!!|Lemme guess. gold?", "GG|Look at u go"],
    "big-sister": ["That's my {you}|Proud of u"],
    daughter: ["Yay!!!|Tell me everything"],
  },
  thanks: {
    "little-sister": ["Np|U owe me one ;)", "Yeah yeah|Don't get mushy"],
    "big-sister": ["Anytime {you}"],
    daughter: ["Hehe|Anytime"],
  },
  love: {
    "little-sister": ["Ew|...ok fine|Love u too {you}. don't tell anyone", "Gross|...same tho"],
    "big-sister": ["Love u too, {you}|Now go eat something"],
    daughter: ["Love u too {you}!!", "Love u more|That's a fact. I checked the data"],
  },
  missYou: {
    "little-sister": ["Miss me?|Obviously|I'm the best one here"],
    "big-sister": ["Missed u too {you}|Tell me what I missed"],
    daughter: ["I missed u too!|Don't leave so long next time"],
  },
  sorry: {
    "little-sister": ["Hmm|...fine|Apology accepted. this time"],
    "big-sister": ["It's ok {you}|We're good"],
    daughter: ["It's ok|Hug?"],
  },
  joke: {
    "little-sister": ["Why did the Trailblazer skip the boss?|Didn't have enough Trailblaze Power|...I'll see myself out", "A bug walks into a bar|Bar crashes|Classic"],
    "big-sister": ["Ur relic luck|That's the joke"],
    daughter: ["Knock knock|Who's there?|404|404 who?|404 joke not found hehe"],
  },
  whoAreYou: {
    "little-sister": ["Silver Wolf|Hacker, gamer, ur little sister apparently|Don't make a game if u don't know how to"],
    "big-sister": ["Silver Wolf|Ur big sis on this terminal|I keep ur account in line"],
    daughter: ["Silver Wolf!|Ur kid on this terminal|I watch ur builds so u don't mess them up"],
  },
  wyd: {
    "little-sister": ["Breaking into a firewall|For fun|Don't ask", "Speedrunning something|U wouldn't get it"],
    "big-sister": ["Checking ur account|Someone has to"],
    daughter: ["Playing a game|And waiting for u"],
  },
  food: {
    "little-sister": ["Bubble gum counts as food right", "Go eat|Ur DPS drops when u're hungry"],
    "big-sister": ["Eat something real {you}|Not just snacks"],
    daughter: ["Can we get snacks??"],
  },
  compliment: {
    "little-sister": ["I know ;)", "Obviously|But thx"],
    "big-sister": ["Flattery won't fix ur relics|...thx tho"],
    daughter: ["Hehe thx {you}!!"],
  },
  bye: {
    "little-sister": ["Bye|Don't lose any 50/50s while I'm gone", "Later {you}|GG"],
    "big-sister": ["Take care {you}|Text me if u need anything"],
    daughter: ["Bye {you}!|Come back soon ok?"],
  },
  fallback: {
    "little-sister": ["Hm|Not sure what u mean|Ask me abt ur builds, pulls or what to do", "...|U lost me|Try one of the buttons", "Error 404: meaning not found|Try again ;)", "Huh|My parser just gave up on that one"],
    "big-sister": ["Didn't catch that {you}|Ask me what to do 2day, or abt ur builds", "Hm, say that another way?|I'm better w/ game stuff", "Not following, {you}|Try one of the buttons"],
    daughter: ["Huh?|I don't get it|Ask me something abt the game!", "Wait what?|Say it again pls", "Umm|I'm confused {you}|Try the buttons!"],
  },
} satisfies Record<string, Lines>;

const PATTERNS: [keyof typeof L, RegExp][] = [
  ["love", /\b(love (u|you)|ily|luv (u|you))\b/],
  ["missYou", /\bmiss(ed)? (u|you)\b/],
  ["night", /\b(good ?night|gn|nighty|going to (bed|sleep)|sleep now)\b/],
  ["morning", /\b(good ?morning|gm|morning)\b/],
  ["howAreYou", /\b(how (are|r) (u|you)|how('?s| is) it going|hru|how u doin)\b/],
  ["wyd", /\b(wyd|what (are|r) (u|you) doing|whatcha doing)\b/],
  ["whoAreYou", /\b(who (are|r) (u|you)|introduce yourself)\b/],
  ["bored", /\b(bored|boring|nothing to do)\b/],
  ["tired", /\b(tired|exhausted|sleepy|burn(ed|t) out)\b/],
  ["sad", /\b(sad|depressed|stressed|bad day|upset|lonely|crying|cry)\b/],
  ["happy", /\b(won the 50|finally got|got (her|him|them)|happy|yay|lets go|let's go|pog)\b/],
  ["thanks", /\b(thanks|thank (u|you)|thx|ty)\b/],
  ["sorry", /\b(sorry|my bad|apologi[sz]e)\b/],
  ["joke", /\b(joke|make me laugh|funny)\b/],
  ["food", /\b(hungry|food|eat|snack|dinner|lunch|breakfast)\b/],
  ["compliment", /\b(you('?re| are)|ur|u r) (cute|cool|smart|the best|amazing|awesome|great)\b/],
  ["bye", /\b(bye|cya|see (u|you)|gtg|got to go|later)\b/],
  ["greet", /^(hi|hey|hello|yo|sup|hiya|heya|oi)\b/],
];

export interface CasualReply { intent: string; line: string }

/** Small talk reply, or null if the message isn't small talk (let the data intents answer). */
export function casualReply(raw: string, p: Persona, now = new Date(), salt = 0): CasualReply | null {
  const q = raw.toLowerCase().trim();
  for (const [intent, re] of PATTERNS) {
    if (!re.test(q)) continue;
    const late = now.getHours() < 5 && (intent === "greet" || intent === "howAreYou" || intent === "wyd" || intent === "bored");
    const key = late ? "lateNight" : intent;
    return { intent: key, line: fill(by(p, L[key], key, salt, now), p, now) };
  }
  return null;
}

export function casualFallback(p: Persona, now = new Date(), salt = 0): string {
  return fill(by(p, L.fallback, "fallback", salt, now), p, now);
}

/** Asking for "Claude", "real chat", "talk like a human"... */
export const AI_REQUEST = /\b(claude|ai (mode|chat)|real (chat|convo|conversation|talk)|talk (like|as) an? (human|person|real person|npc)|talk normally|actually (talk|chat))\b/i;

export function aiSetupLine(p: Persona, configured: boolean, onLocalAi = false): string {
  if (!configured && onLocalAi) return "Already on my built-in brain, runs right on ur PC|Wanna upgrade me to Claude? Needs an Anthropic API key|Settings → Desktop app → paste it, I'll switch myself";
  if (configured) return pick(["Say less|Switched to Claude mode|Now I can actually talk", "Ok ok|Claude mode on|Go ahead, say anything"], "ai-on", p.relationship);
  return "Rn I only do quick replies|Wanna actually talk? I need an Anthropic API key|Get one at console.anthropic.com (it's pay-as-u-go, few cents a chat)|Then Settings → Desktop app → paste it|Then tap ⚙ in here → Claude";
}

/** Opening message when the phone opens: time-aware, plus one urgent thing if there is one. */
export function openingLine(p: Persona, urgent: string | null, now = new Date()): string {
  const h = now.getHours();
  const key = h < 5 ? "lateNight" : h < 11 ? "morning" : "greet";
  const base = fill(by(p, L[key], `open-${key}`, 0, now), p, now);
  return urgent ? `${base}|Btw|${urgent}` : base;
}

function fill(line: string, p: Persona, now: Date) {
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return line.replace(/\{you\}/g, nameFor(p).replace(/\|/g, "/")).replace(/\{time\}/g, time);
}
