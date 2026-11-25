import { describe, expect, it } from "vitest";
import { casualFallback, casualReply, nameFor, openingLine, type Persona } from "../companion/casual";
import { localReply } from "../../components/chat/useWolfChat";
import { SILVER_WOLF_SYSTEM } from "../companion/persona";
import { summarizeAccount } from "../summary";
import type { TerminalContext } from "../companion/terminal";

const sis: Persona = { relationship: "little-sister", callsYou: "" };
const kid: Persona = { relationship: "daughter", callsYou: "Dad" };
const noon = new Date(2026, 10, 25, 12, 0);

const ctx = (): TerminalContext => ({
  game: null,
  summary: summarizeAccount({ game: null, characters: [], lightCones: [], relics: [], achievements: [], markers: [], banners: [], events: [], relicProfiles: {} }),
  profile: { id: "p", name: "T", source: "manual", createdAt: "", updatedAt: "", resources: { stellarJade: 1600 } },
  characters: [], events: [], zones: [], markers: [], materialNeeds: null, inventory: {}, codex: [],
});

describe("Silver Wolf small talk", () => {
  it("uses the name she calls you, with defaults per relationship", () => {
    expect(nameFor(sis)).toBe("Trailblazer");
    expect(nameFor({ relationship: "big-sister", callsYou: "" })).toBe("kid");
    expect(nameFor(kid)).toBe("Dad");
    expect(casualReply("love you", kid, noon)!.line).toMatch(/Dad/);
  });
  it("recognises common small talk and stays in bubble format", () => {
    for (const [msg, intent] of [["hi", "greet"], ["how are you?", "howAreYou"], ["im so bored", "bored"], ["i'm tired", "tired"], ["thanks!", "thanks"], ["good night", "night"], ["tell me a joke", "joke"], ["wyd", "wyd"], ["bye", "bye"]] as const) {
      const r = casualReply(msg, sis, noon);
      expect(r?.intent, msg).toBe(intent);
      expect(r!.line.split("|").length).toBeGreaterThanOrEqual(1);
      expect(r!.line).not.toMatch(/\{you\}|\{time\}/);
    }
    expect(casualReply("rate my relics", sis, noon)).toBeNull();
  });
  it("nags you to sleep late at night", () => {
    const r = casualReply("hey", sis, new Date(2026, 10, 25, 2, 30));
    expect(r!.intent).toBe("lateNight");
  });
  it("routes data questions to data intents and the rest to small talk", () => {
    expect(localReply("how many pulls can I afford?", ctx(), sis, noon).intent).toBe("pulls");
    expect(localReply("what should I do today?", ctx(), sis, noon).intent).toBe("todo");
    expect(localReply("hi", ctx(), sis, noon).intent).toBe("greet");
    expect(localReply("asdfgh", ctx(), sis, noon).intent).toBe("fallback");
    expect(casualFallback(sis, noon).length).toBeGreaterThan(0);
  });
  it("opening line mentions one urgent thing", () => {
    expect(openingLine(sis, "Finish Event X|Ends in 1 day", noon)).toMatch(/\|Btw\|Finish Event X\|Ends in 1 day$/);
  });
  it("keeps the Claude persona strictly familial", () => {
    expect(SILVER_WOLF_SYSTEM).toMatch(/strictly familial/);
    expect(SILVER_WOLF_SYSTEM).toMatch(/Never romantic/);
  });
});

describe("variety", () => {
  it("doesn't repeat the exact same reply to the same message back to back", () => {
    const a = casualReply("hey", sis, noon, 3)!.line;
    const b = casualReply("hey", sis, noon, 4)!.line;
    expect(a).not.toBe(b);
  });
});
