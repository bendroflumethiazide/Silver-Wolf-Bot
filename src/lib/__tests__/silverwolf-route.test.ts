import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: unknown[] = [];
let stopReason = "end_turn";
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error { status?: number }
  class Anthropic {
    static APIError = APIError;
    static AuthenticationError = class extends APIError {};
    static RateLimitError = class extends APIError {};
    static APIConnectionError = class extends APIError {};
    beta = {
      messages: {
        stream: (params: unknown) => {
          calls.push(params);
          const events = [
            { type: "content_block_delta", delta: { type: "text_delta", text: "Pity 76\n" } },
            { type: "content_block_delta", delta: { type: "text_delta", text: "Just pull" } },
          ];
          return {
            async *[Symbol.asyncIterator]() { for (const e of events) yield e; },
            finalMessage: async () => ({ stop_reason: stopReason }),
          };
        },
      },
    };
  }
  return { default: Anthropic };
});

import { GET, POST } from "../../app/api/silverwolf/route";
import { buildAiContext } from "../companion/terminal";
import { summarizeAccount } from "../summary";

const req = (body: unknown) => new Request("http://x/api/silverwolf", { method: "POST", body: JSON.stringify(body) });

describe("/api/silverwolf", () => {
  beforeEach(() => { calls.length = 0; stopReason = "end_turn"; });
  afterEach(() => { delete process.env.ANTHROPIC_API_KEY; });

  it("reports configuration without exposing the key", async () => {
    expect(await (GET(new Request("http://x/api/silverwolf"))).json()).toEqual({ configured: false, model: "claude-opus-5-5" });
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const j = await GET(new Request("http://x/api/silverwolf")).json();
    expect(j.configured).toBe(true);
    expect(JSON.stringify(j)).not.toContain("sk-test");
  });

  it("refuses without a key and validates input", async () => {
    expect((await POST(req({ context: "", messages: [{ role: "user", text: "hi" }] }))).status).toBe(503);
    process.env.ANTHROPIC_API_KEY = "sk-test";
    expect((await POST(req({ context: "", messages: [] }))).status).toBe(400);
    expect((await POST(req({ context: "", messages: [{ role: "assistant", text: "x" }] }))).status).toBe(400);
  });

  it("streams text and calls Claude with persona, fallbacks and the data block", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const res = await POST(req({ context: "Character Event Warp: pity 76/90", messages: [{ role: "user", text: "should i pull?" }] }));
    expect(await res.text()).toBe("Pity 76\nJust pull");
    const p = calls[0] as Record<string, unknown> & { messages: { content: string }[]; system: { text: string }[] };
    expect(p.model).toBe("claude-opus-5-5");
    expect(p.fallbacks).toBe("default");
    expect(p.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(p.thinking).toBeUndefined();
    expect(p.messages.at(-1)!.content).toContain("<account_data>\nCharacter Event Warp: pity 76/90\n</account_data>");
    expect(p.system[0].text).toMatch(/Silver Wolf/);
  });

  it("passes the family relationship and nickname, sanitised", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    await (await POST(req({ context: "x", persona: { relationship: "daughter", callsYou: "Dad<>" }, messages: [{ role: "user", text: "hi" }] }))).text();
    const p = calls[0] as { messages: { content: string }[] };
    expect(p.messages.at(-1)!.content).toContain(`<relationship>You are the user's daughter. You call them "Dad".</relationship>`);
    expect((await POST(req({ context: "x", persona: { relationship: "girlfriend", callsYou: "x" }, messages: [{ role: "user", text: "hi" }] }))).status).toBe(400);
  });

  it("marks refusals", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    stopReason = "refusal";
    const res = await POST(req({ context: "", messages: [{ role: "user", text: "x" }] }));
    expect(await res.text()).toMatch(/\[\[refusal\]\]$/);
  });
});

describe("AI context", () => {
  it("contains the needed numbers but no UID, nickname or signature", () => {
    const s = buildAiContext("rate my builds", {
      game: null,
      summary: summarizeAccount({ game: null, characters: [], lightCones: [], relics: [], achievements: [], markers: [], banners: [], events: [], relicProfiles: {} }),
      profile: { id: "p", name: "SecretName", uid: "812345678", signature: "my sig", source: "manual", createdAt: "", updatedAt: "", resources: { stellarJade: 3200 } },
      characters: [], events: [], zones: [], markers: [], materialNeeds: null, inventory: {}, codex: [],
      builds: [{ charId: "1006", name: "Silver Wolf", grade: "SS-", score: 56.2, lacks: ["Feet is only B"], equipped: 6 }],
    });
    expect(s).toContain("Stellar Jade 3200");
    expect(s).toContain("Build rating Silver Wolf: SS- (56.2/100)");
    expect(s).not.toMatch(/812345678|SecretName|my sig/);
  });
});
