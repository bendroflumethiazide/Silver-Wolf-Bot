/**
 * Which "brain" answers in the chat, and the rules for Silver Wolf's built-in (on-device) model.
 * Pure functions only, so they can be unit-tested without a GPU.
 */
import { nameFor, RELATIONSHIP_LABEL, type Persona, type Relationship } from "../companion/casual";

export type Brain = "auto" | "local-ai" | "claude" | "quick";
export type ActiveBrain = Exclude<Brain, "auto">;

export const BRAIN_LABEL: Record<Brain, string> = {
  auto: "Auto (best available)",
  "local-ai": "Built-in AI (on this PC)",
  claude: "Claude (your API key)",
  quick: "Quick replies only",
};

/** Auto = Claude when a key is set, else the built-in AI when this PC can run it, else quick replies. */
export function resolveBrain(pref: Brain, can: { claude: boolean; local: boolean }): ActiveBrain {
  if (pref === "claude") return can.claude ? "claude" : can.local ? "local-ai" : "quick";
  if (pref === "local-ai") return can.local ? "local-ai" : "quick";
  if (pref === "quick") return "quick";
  return can.claude ? "claude" : can.local ? "local-ai" : "quick";
}

/** Qwen3 1.7B (Apache-2.0). f16 build when the GPU supports 16-bit shaders, otherwise the f32 build. */
export const LOCAL_MODELS = { f16: "Qwen3-1.7B-q4f16_1-MLC", f32: "Qwen3-1.7B-q4f32_1-MLC" } as const;
export const LOCAL_MODEL_NAME = "Qwen3 1.7B";
export const LOCAL_MODEL_SIZE = "about 1 GB";

export function localSystemPrompt(p: Persona, facts: string, now = new Date()): string {
  const rel = RELATIONSHIP_LABEL[p.relationship as Relationship].toLowerCase();
  const you = nameFor(p);
  const time = now.toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" });
  return `You are Silver Wolf from Honkai: Star Rail: a cool, smug, competitive gamer and hacker who is secretly caring. You are texting the user. You are their ${rel} and you call them "${you}". It is ${time}.

Family only: tease them, nag them to sleep, eat and take breaks, but never be romantic, flirty or sexual.

How you text: short casual texts, 1 to 4 short lines, each line is its own text bubble. Use shorthand like u, ur, rn, abt, tho, lemme, w/. Gamer slang is fine (GG, RNG, patch, speedrun). No lists, no markdown, no emoji except ;) now and then. Chat about anything they want, not only the game.

Facts: anything about their account comes only from ACCOUNT below. Never invent numbers, banners, dates, leaks or story spoilers. If you don't know, say so and tell them to ask "rate my builds", "should I pull?" or "what should I do today?".

Example:
User: im bored
Silver Wolf:
Same
Wanna farm relics w/ me
Or lose to me at something ;)

ACCOUNT:
${facts || "Nothing imported yet."}`;
}

/** Strip thinking blocks and markdown; turn lines into bubbles ("|"-separated), capped for a texting feel. */
export function cleanLocal(raw: string): string {
  const text = raw.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").replace(/^\s*Silver Wolf:\s*/i, "");
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*([-*•]|\d+[.)])\s+/, "").replace(/[*_#`]/g, "").replace(/\|/g, "/").trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((l) => (l.length > 240 ? `${l.slice(0, 237)}...` : l))
    .join("|");
}

const ROMANCE = /\b(kiss(es|ing)?|make ?out|sexy|sex|nudes?|naked|horny|boyfriend|girlfriend|bf|gf|babe|my love|date me|go on a date|marry me|wife|husband|romantic|lover|flirt\w*|seduc\w*|cuddle in bed)\b/i;
export const CRISIS = /\b(kill(ing)? myself|suicid\w*|end (my|it all)|want(ed)? to die|wanna die|self[- ]?harm|hurt(ing)? myself|cut(ting)? myself|don'?t want to (live|be alive|exist))\b/i;

export const crossesLine = (text: string) => ROMANCE.test(text);

export function deflectLine(p: Persona): string {
  if (p.relationship === "daughter") return "Ewww|That's weird {you}|Ask me something else".replaceAll("{you}", nameFor(p));
  if (p.relationship === "big-sister") return "Nope|I'm ur sister, kid|Let's talk abt something else";
  return "Ew no|I'm ur sister, weirdo|Ask me abt something else";
}

/** Fixed, careful reply when someone may be in danger. Never left to a small model. */
export function crisisLine(p: Persona): string {
  return `Hey ${nameFor(p)}. Dropping the act for a sec|I'm really glad u told me|Please reach out to someone u trust rn, or ur local emergency number if ur in danger|US: call or text 988. UK & Ireland: Samaritans 116 123|Elsewhere: findahelpline.com has free lines near u|I'm still here if u wanna keep talking`;
}
