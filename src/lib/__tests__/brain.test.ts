import { describe, expect, it } from "vitest";
import { cleanLocal, crisisLine, CRISIS, crossesLine, localSystemPrompt, resolveBrain } from "../ai/brain";
import { routeLocalAi } from "../../components/chat/useWolfChat";
import { summarizeAccount } from "../summary";
import type { TerminalContext } from "../companion/terminal";
import type { Persona } from "../companion/casual";

const sis: Persona = { relationship: "little-sister", callsYou: "" };
const ctx = (): TerminalContext => ({
  game: null,
  summary: summarizeAccount({ game: null, characters: [], lightCones: [], relics: [], achievements: [], markers: [], banners: [], events: [], relicProfiles: {} }),
  profile: { id: "p", name: "T", source: "manual", createdAt: "", updatedAt: "", resources: { stellarJade: 1600 } },
  characters: [], events: [], zones: [], markers: [], materialNeeds: null, inventory: {}, codex: [],
});

describe("chat brain selection", () => {
  it("auto prefers Claude, then the built-in AI, then quick replies", () => {
    expect(resolveBrain("auto", { claude: true, local: true })).toBe("claude");
    expect(resolveBrain("auto", { claude: false, local: true })).toBe("local-ai");
    expect(resolveBrain("auto", { claude: false, local: false })).toBe("quick");
  });
  it("falls back when the chosen brain isn't available", () => {
    expect(resolveBrain("claude", { claude: false, local: true })).toBe("local-ai");
    expect(resolveBrain("local-ai", { claude: true, local: false })).toBe("quick");
    expect(resolveBrain("quick", { claude: true, local: true })).toBe("quick");
  });
});

describe("built-in AI output and prompt", () => {
  it("turns model output into texting bubbles without thinking or markdown", () => {
    expect(cleanLocal("<think>hmm</think>\nSilver Wolf: **Same**\n- wanna farm relics\n\n;)")).toBe("Same|wanna farm relics|;)");
    expect(cleanLocal("a|b")).toBe("a/b");
    expect(cleanLocal("1\n2\n3\n4\n5\n6\n7\n8").split("|")).toHaveLength(6);
  });
  it("prompt carries the relationship, the name, the family-only rule and the facts", () => {
    const p = localSystemPrompt({ relationship: "daughter", callsYou: "Dad" }, "Stellar Jade 1600", new Date(2026, 10, 25, 12));
    expect(p).toMatch(/their daughter/);
    expect(p).toMatch(/"Dad"/);
    expect(p).toMatch(/never be romantic/);
    expect(p).toMatch(/Stellar Jade 1600/);
  });
});

describe("what never goes to the small model", () => {
  it("answers account questions exactly from data", () => {
    const r = routeLocalAi("how many pulls can I afford?", ctx(), sis, { configured: false });
    expect(r?.intent).toBe("pulls");
  });
  it("sends small talk and open questions to the model", () => {
    expect(routeLocalAi("how was ur day", ctx(), sis, { configured: false })).toBeNull();
    expect(routeLocalAi("wheres kafka", ctx(), sis, { configured: false })).toBeNull();
  });
  it("handles crisis messages with a fixed, careful reply", () => {
    expect(CRISIS.test("i want to die")).toBe(true);
    expect(CRISIS.test("this boss makes me want to die lol")).toBe(true);
    expect(CRISIS.test("I died to the boss")).toBe(false);
    const r = routeLocalAi("i want to kill myself", ctx(), sis, null);
    expect(r?.intent).toBe("care");
    expect(r?.text).toBe(crisisLine(sis));
    expect(r?.text).toMatch(/988/);
  });
  it("keeps it familial", () => {
    expect(crossesLine("be my girlfriend")).toBe(true);
    expect(crossesLine("my sister is annoying")).toBe(false);
    expect(routeLocalAi("kiss me", ctx(), sis, null)?.intent).toBe("deflect");
  });
  it("explains Claude from built-in mode without claiming quick replies", () => {
    expect(routeLocalAi("claude", ctx(), sis, { configured: false })?.text).toMatch(/built-in brain/);
  });
});

describe("phone-size model", () => {
  it("labels models with their size", async () => {
    const { modelInfo, PHONE_MODELS, LOCAL_MODELS } = await import("../ai/brain");
    expect(modelInfo(PHONE_MODELS.f16).size).toBe("about 300 MB");
    expect(modelInfo(LOCAL_MODELS.f16).size).toBe("about 1 GB");
    expect(modelInfo(null).name).toBe("Qwen3 1.7B");
  });
  it("recognises phones and tablets", async () => {
    const { isMobileDevice } = await import("../edition");
    const ua = Object.getOwnPropertyDescriptor(globalThis.navigator, "userAgent");
    const set = (v: string) => Object.defineProperty(globalThis.navigator, "userAgent", { value: v, configurable: true });
    set("Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 Version/26.1 Mobile/15E148 Safari/604.1");
    expect(isMobileDevice()).toBe(true);
    set("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36");
    expect(isMobileDevice()).toBe(false);
    if (ua) Object.defineProperty(globalThis.navigator, "userAgent", ua);
  });
});
