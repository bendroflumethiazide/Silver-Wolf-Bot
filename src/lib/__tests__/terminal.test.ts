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
