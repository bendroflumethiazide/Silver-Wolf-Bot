import { describe, expect, it } from "vitest";
import { answer, type TerminalContext } from "../companion/terminal";
import { summarizeAccount } from "../summary";

const base = (): TerminalContext => ({
  game: null,
  summary: summarizeAccount({ game: null, characters: [], lightCones: [], relics: [], achievements: [], markers: [], banners: [], events: [], relicProfiles: {} }),
  profile: { id: "p", name: "T", source: "manual", createdAt: "", updatedAt: "", resources: { stellarJade: 16000, specialPasses: 80, undyingStarlight: 0 } },
  characters: [], events: [], zones: [], markers: [], materialNeeds: null, inventory: {}, codex: [],
});

describe("Silver Wolf terminal", () => {
  it("answers pull questions from entered resources", () => {
    const a = answer("How many pulls can I afford?", base());
    expect(a.intent).toBe("pulls");
    expect(a.line).toMatch(/180 event pulls/);
    expect(a.line).toMatch(/100\.0%/);
    expect(a.sources).toContain("Resources you entered");
  });
  it("admits missing data instead of inventing it", () => {
    expect(answer("how do I beat the final boss", base()).line).toMatch(/not inventing/);
    expect(answer("what's my pity", base()).line).toMatch(/I don.t know ur pity/);
    expect(answer("blorp zorp", base()).intent).toBe("unknown");
    expect(answer("which character should I build next", base()).line).toMatch(/haven't told me/);
  });
  it("uses codex entries the user recorded", () => {
    const ctx = { ...base(), codex: [{ kind: "boss", name: "Cocolia", body: "Weak to Fire.", sourceUrl: "https://example.org" }] };
    const a = answer("how do I defeat cocolia?", ctx);
    expect(a.facts[0]).toBe("Weak to Fire.");
    expect(a.sources).toEqual(["https://example.org"]);
  });
});

describe("community build answers", () => {
  it("answers 'how do I build X' from Fribbels data and matches whole names only", async () => {
    const { answer, mentionedCharacter } = await import("../companion/terminal");
    const { summarizeAccount } = await import("../summary");
    const game = {
      version: "t",
      characters: { "1308": { id: "1308", name: "Acheron", path: "Warlock", element: "Thunder", rarity: 5 }, "1006": { id: "1006", name: "Silver Wolf", path: "Warlock", element: "Quantum", rarity: 5 }, "1112": { id: "1112", name: "Topaz & Numby", path: "Rogue", element: "Fire", rarity: 5 }, "1009": { id: "1009", name: "Asta", path: "Shaman", element: "Fire", rarity: 4 } },
      lightCones: { "23024": { id: "23024", name: "Along the Passing Shore" } },
      relicSets: { "117": { id: "117", name: "Pioneer Diver of Dead Waters" }, "312": { id: "312", name: "Izumo Gensei and Takama Divine Realm" } },
    } as never;
    expect(mentionedCharacter("silver wolf how do i build acheron", game)).toBe("1308");
    expect(mentionedCharacter("i want pasta", game)).toBeNull();
    const ctx = { game, summary: summarizeAccount({ game: null, characters: [], lightCones: [], relics: [], achievements: [], markers: [], banners: [], events: [], relicProfiles: {} }), profile: { id: "p", name: "T", source: "manual", createdAt: "", updatedAt: "" }, characters: [], events: [], zones: [], markers: [], materialNeeds: null, inventory: {}, codex: [] } as never;
    const a = answer("How do I build Acheron?", ctx);
    expect(a.intent).toBe("recommend");
    expect(a.line).toMatch(/Pioneer Diver of Dead Waters 4pc/);
    expect(a.line).toMatch(/Best LC: Along the Passing Shore/);
    expect(a.sources[0]).toMatch(/Fribbels/);
    expect(answer("who should i build next", ctx).intent).toBe("build");
  });
});
