import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseHoyolab, serverForUid, type HoyolabRaw } from "../connectors/hoyolab";
import { cookieFromEnv, dynamicSecret } from "../connectors/hoyolab-server";
import { applyHoyolab } from "../../components/HoyolabSync";
import { deleteAllPersonalData } from "../backup";
import { getDb, kvGet } from "../db";
import type { GameData } from "../gamedata/types";
import type { Profile } from "../types";

const game = { characters: { "1006": { id: "1006", name: "Silver Wolf" }, "1001": { id: "1001", name: "March 7th" } } } as unknown as GameData;
const raw: HoyolabRaw = {
  uid: "600000001", fetchedAt: "2026-11-25T10:00:00.000Z", errors: {},
  index: { stats: { active_days: 500, avatar_num: 40, achievement_num: 600, chest_num: 2500 }, avatar_list: [{ id: 1006, level: 80, rank: 2, name: "Silver Wolf" }, { id: 1001, level: 55, rank: 6 }, { id: 9999, level: 1, rank: 0, name: "Unknown" }] },
  note: { current_stamina: 182, max_stamina: 300, stamina_recover_time: 21000, current_reserve_stamina: 900, current_train_score: 300, max_train_score: 500, current_rogue_score: 14000, max_rogue_score: 14000, weekly_cocoon_cnt: 1, weekly_cocoon_limit: 3, accepted_epedition_num: 4, total_expedition_num: 4 },
  moc: { schedule_id: 1012, begin_time: { year: 2026, month: 11, day: 17, hour: 4 }, star_num: 33, max_floor: "Stage 12", battle_num: 14, has_data: true,
    all_floor_detail: [{ name: "Stage 12", round_num: 6, star_num: 3, node_1: { avatars: [{ id: 1006, level: 80, rank: 2 }] }, node_2: { avatars: [{ id: 1001, level: 80, rank: 6 }] } }],
    groups: [{ schedule_id: 1012, name_mi18n: "Test Season" }] },
  pf: { has_data: true, schedule_id: 2005, star_num: 12, all_floor_detail: [{ name: "4", round_num: 0, star_num: 3, node_1: { avatars: [], score: "21000" }, node_2: { avatars: [], score: "20500" } }], groups: [] },
  as: { has_data: false, all_floor_detail: [] },
};

describe("HoYoLAB connector", () => {
  afterEach(() => vi.restoreAllMocks());
  it("maps UIDs to global servers only", () => {
    expect(serverForUid("600000001")).toBe("prod_official_usa");
    expect(serverForUid("700000001")).toBe("prod_official_eur");
    expect(serverForUid("800000001")).toBe("prod_official_asia");
    expect(serverForUid("900000001")).toBe("prod_official_cht");
    expect(serverForUid("100000001")).toBeNull();
    expect(serverForUid("12ab")).toBeNull();
  });
  it("signs requests with the DS format", () => {
    const ds = dynamicSecret(1700000000, "abcdef");
    const md5 = createHash("md5").update("salt=6s25p5ox5y14umn1p61aqyyvbvvl3lrt&t=1700000000&r=abcdef").digest("hex");
    expect(ds).toBe(`1700000000,abcdef,${md5}`);
  });
  it("reads cookies only from env", () => {
    expect(cookieFromEnv({})).toBeNull();
    expect(cookieFromEnv({ HOYOLAB_LTUID_V2: "1", HOYOLAB_LTOKEN_V2: "v2_x" })).toBe("ltuid_v2=1; ltoken_v2=v2_x");
    expect(cookieFromEnv({ HOYOLAB_COOKIE: " a=b " })).toBe("a=b");
  });
  it("parses stats, note, characters and endgame", () => {
    const p = parseHoyolab(raw, game, "p");
    expect(p.stats).toEqual({ activeDays: 500, characters: 40, achievements: 600, chests: 2500 });
    expect(p.note).toMatchObject({ trailblazePower: 182, dailyTraining: [300, 500], echoOfWar: [1, 3] });
    expect(p.characters.map((c) => [c.charId, c.level, c.eidolon, c.ascension, c.source])).toEqual([["1006", 80, 2, 6, "hoyolab"], ["1001", 55, 6, 4, "hoyolab"]]);
    expect(p.warnings.join(" ")).toMatch(/Unknown isn't in your game data/);
    expect(p.endgame).toHaveLength(2);
    expect(p.endgame[0]).toMatchObject({ id: "hoyolab-MemoryofChaos-1012", mode: "Memory of Chaos", season: "Test Season", stars: 33, cycles: 6, date: "2026-11-17", teams: [["1006"], ["1001"]] });
    expect(p.endgame[1]).toMatchObject({ mode: "Pure Fiction", score: 41500 });
  });
  it("applies without overwriting manual edits and keeps skills from earlier imports", async () => {
    await deleteAllPersonalData({ includeGameData: true });
    const db = getDb();
    const profile: Profile = { id: "p", name: "T", uid: "600000001", source: "manual", createdAt: "", updatedAt: "" };
    await db.profiles.put(profile);
    await db.characters.put({ key: "p:1006", profileId: "p", charId: "1006", level: 70, ascension: 5, eidolon: 0, skills: { basic: 6, skill: 10, ult: 10, talent: 10 }, traces: { ability_1: true }, source: "hsr-scanner", updatedAt: "" });
    await db.characters.put({ key: "p:1001", profileId: "p", charId: "1001", level: 20, ascension: 0, eidolon: 0, skills: { basic: 1, skill: 1, ult: 1, talent: 1 }, traces: {}, source: "manual", updatedAt: "" });
    const msg = await applyHoyolab(parseHoyolab(raw, game, "p"), profile);
    expect(msg).toMatch(/1 updated/);
    expect(msg).toMatch(/1 character\(s\) you edited by hand were kept/);
    const sw = (await db.characters.get("p:1006"))!;
    expect(sw).toMatchObject({ level: 80, eidolon: 2, ascension: 6, source: "hoyolab", skills: { skill: 10 }, traces: { ability_1: true } });
    expect((await db.characters.get("p:1001"))!.level).toBe(20);
    expect((await db.profiles.get("p"))!.resources?.trailblazePower).toBe(182);
    expect(await db.endgame.count()).toBe(2);
    expect((await kvGet<{ dailyTraining: number[] } | null>("dailyNote:p", null))!.dailyTraining).toEqual([300, 500]);
  });
});

describe("/api/hoyolab", () => {
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.HOYOLAB_LTUID_V2; delete process.env.HOYOLAB_LTOKEN_V2; });
  const post = (uid: string) => new Request("http://x/api/hoyolab", { method: "POST", body: JSON.stringify({ uid }) });

  it("needs cookies and a valid UID, and never leaks them", async () => {
    const { GET, POST } = await import("../../app/api/hoyolab/route");
    expect(await GET().json()).toEqual({ configured: false });
    expect((await POST(post("600000001"))).status).toBe(503);
    process.env.HOYOLAB_LTUID_V2 = "1"; process.env.HOYOLAB_LTOKEN_V2 = "secret-token";
    expect((await POST(post("123"))).status).toBe(400);
    expect(JSON.stringify(await GET().json())).not.toContain("secret");
  });

  it("stops at a verification challenge instead of retrying", async () => {
    process.env.HOYOLAB_LTUID_V2 = "1"; process.env.HOYOLAB_LTOKEN_V2 = "t";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ retcode: 1034, message: "captcha", data: null }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("../../app/api/hoyolab/route");
    const res = await POST(post("700000002"));
    const j = await res.json();
    expect(res.status).toBe(502);
    expect(j.error).toMatch(/never bypasses CAPTCHA/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).DS).toMatch(/^\d+,\w{6},[0-9a-f]{32}$/);
  });

  it("collects all sections on success", async () => {
    process.env.HOYOLAB_LTUID_V2 = "1"; process.env.HOYOLAB_LTOKEN_V2 = "t";
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify({ retcode: 0, message: "OK", data: { url } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("../../app/api/hoyolab/route");
    const j = await (await POST(post("800000003"))).json();
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(j.index.url).toContain("/index?server=prod_official_asia&role_id=800000003");
    expect(j.moc.url).toContain("/challenge?");
    expect(j.pf.url).toContain("type=story");
    expect(j.as.url).toContain("challenge_boss");
  });
});
