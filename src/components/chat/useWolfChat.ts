"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AI_REQUEST, aiSetupLine, casualFallback, casualReply, openingLine, type Persona } from "@/lib/companion/casual";
import { answer, buildAiContext, type BuildSummary, type TerminalContext } from "@/lib/companion/terminal";
import { cleanLocal, crisisLine, CRISIS, crossesLine, deflectLine, localSystemPrompt, resolveBrain, type Brain } from "@/lib/ai/brain";
import { deleteLocalAi, ensureLocalAi, generateLocal, probeLocalAi, useLocalAi } from "@/lib/ai/local-llm";
import { bubbles } from "@/lib/companion/voice";
import { evaluateBuild } from "@/lib/builds/evaluate";
import { computeStats } from "@/lib/builds/stats";
import { getDb, kvGet, kvSet, newId } from "@/lib/db";
import { characterDisplayName } from "@/lib/gamedata/types";
import { useAccount, useProfile, useRelicProfiles } from "@/lib/hooks";
import { mergeTotals } from "@/lib/materials/calculator";
import { FULL_TARGET, planCharacter, planLightCone, type CharacterTarget } from "@/lib/materials/plan";
import { useApp } from "@/lib/store";
import { isMobileDevice, WEB_EDITION } from "@/lib/edition";
import { profileFor } from "@/lib/summary";

export interface ChatMsg {
  id: string;
  from: "you" | "wolf";
  /** Bubbles separated by "|". */
  text: string;
  at: string;
  via?: "local" | "local-ai" | "claude";
  status?: "done" | "error";
  intent?: string;
  facts?: string[];
  sources?: string[];
  links?: { label: string; href: string }[];
}

const MAX_HISTORY = 300;
const chatKey = (profileId: string) => `phoneChat:${profileId}`;
const seenKey = (profileId: string) => `phoneSeen:${profileId}`;
const URGENT = new Set(["event", "banner", "warp"]);

/** Decide how to answer locally: data intents first, then small talk, then a fallback. */
export function localReply(text: string, ctx: TerminalContext, persona: Persona, now = new Date(), salt = 0, ai: { configured: boolean } | null = null): Reply {
  const pre = guardReply(text, persona, ai, false);
  if (pre) return pre;
  const a = answer(text, ctx);
  if (a.intent !== "unknown" && a.intent !== "help") return { text: a.line, via: "local", status: "done", intent: a.intent, facts: a.facts, sources: a.sources, links: a.links };
  const c = casualReply(text, persona, now, salt);
  if (c) return { text: c.line, via: "local", status: "done", intent: c.intent };
  const hint = ai && !ai.configured ? "|(type \"claude\" if u want me to actually talk)" : ai?.configured ? "|(type \"claude\" to switch me to real convo mode)" : "";
  return { text: casualFallback(persona, now, salt) + hint, via: "local", status: "done", intent: "fallback" };
}

type Reply = Omit<ChatMsg, "id" | "at" | "from"> & { enableClaude?: boolean };

/** Replies that never go to a model: Claude requests, crisis, lines she won't cross. */
function guardReply(text: string, persona: Persona, ai: { configured: boolean } | null, onLocalAi: boolean): Reply | null {
  if (CRISIS.test(text)) return { text: crisisLine(persona), via: "local", status: "done", intent: "care" };
  if (crossesLine(text)) return { text: deflectLine(persona), via: "local", status: "done", intent: "deflect" };
  if (AI_REQUEST.test(text)) {
    const configured = !!ai?.configured;
    return { text: aiSetupLine(persona, configured, onLocalAi), via: "local", status: "done", intent: "ai", enableClaude: configured, links: configured ? undefined : [{ label: "Open Settings", href: "/settings#desktop" }] };
  }
  return null;
}

/**
 * With the built-in AI: safety and account questions are answered exactly from your data (a small
 * model would get numbers wrong); everything else, small talk included, goes to the model (null).
 */
export function routeLocalAi(text: string, ctx: TerminalContext, persona: Persona, ai: { configured: boolean } | null): Reply | null {
  const pre = guardReply(text, persona, ai, true);
  if (pre) return pre;
  const a = answer(text, ctx);
  if (a.intent !== "unknown" && a.intent !== "help") return { text: a.line, via: "local", status: "done", intent: a.intent, facts: a.facts, sources: a.sources, links: a.links };
  return null;
}

export function useWolfChat() {
  const { game, profileId, settings, updateSettings } = useApp();
  const persona: Persona = useMemo(() => ({ relationship: settings.companionRelationship, callsYou: settings.companionCallsYou }), [settings.companionRelationship, settings.companionCallsYou]);
  const profile = useProfile();
  const { summary } = useAccount();
  const db = getDb();
  const characters = useLiveQuery(() => db.characters.where("profileId").equals(profileId).toArray(), [profileId]);
  const lcs = useLiveQuery(() => db.lightCones.where("profileId").equals(profileId).toArray(), [profileId]);
  const relics = useLiveQuery(() => db.relics.where("profileId").equals(profileId).toArray(), [profileId]);
  const events = useLiveQuery(() => db.events.toArray(), []);
  const zones = useLiveQuery(() => db.mapZones.toArray(), []);
  const markers = useLiveQuery(() => db.mapMarkers.where("profileId").equals(profileId).toArray(), [profileId]);
  const codex = useLiveQuery(() => db.codex.toArray(), []);
  const invRows = useLiveQuery(() => db.materials.where("profileId").equals(profileId).toArray(), [profileId]);
  const plans = useLiveQuery(() => kvGet<{ kind: string; targetId: string; target?: CharacterTarget; lcTo?: number }[]>(`materialPlans:${profileId}`, []), [profileId]);
  const stored = useLiveQuery(() => kvGet<ChatMsg[]>(chatKey(profileId), []), [profileId]);
  const seen = useLiveQuery(() => kvGet<string>(seenKey(profileId), ""), [profileId]);
  const relicProfiles = useRelicProfiles(profileId);
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [ai, setAi] = useState<{ configured: boolean; model?: string } | null>(null);
  const greeted = useRef(false);

  const localAi = useLocalAi((st) => st.status);
  useEffect(() => {
    if (WEB_EDITION) { setAi({ configured: false }); return; }
    fetch("/api/silverwolf").then((r) => r.json()).then(setAi).catch(() => setAi({ configured: false }));
  }, []);
  useEffect(() => { void probeLocalAi(); }, []);

  const materialNeeds = useMemo(() => {
    if (!game || !plans?.length || !characters || !lcs) return null;
    return mergeTotals(...plans.map((p) => {
      try {
        if (p.kind === "character") return planCharacter(game, p.targetId, characters.find((c) => c.charId === p.targetId) ?? null, p.target ?? FULL_TARGET).totals;
        const lc = lcs.find((l) => l.uid === p.targetId);
        return lc ? planLightCone(game, lc.lcId, lc.ascension, Math.max(lc.ascension, p.lcTo ?? 6)) : new Map();
      } catch { return new Map(); }
    }));
  }, [game, plans, characters, lcs]);

  const builds = useMemo<BuildSummary[]>(() => {
    if (!game || !characters || !relics || !lcs) return [];
    return characters.filter((c) => game.characters[c.charId] && relics.some((r) => r.location === c.charId)).map((c) => {
      const worn = relics.filter((r) => r.location === c.charId);
      const lc = lcs.find((l) => l.location === c.charId) ?? null;
      const e = evaluateBuild(game, c, worn, profileFor(c.charId, game, relicProfiles), computeStats(game, c, lc, worn), lc);
      return { charId: c.charId, name: characterDisplayName(game.characters[c.charId]), grade: e.overall.grade.label, score: e.overall.score, lacks: e.lacks, best: e.strengths[0], equipped: e.equipped };
    });
  }, [game, characters, relics, lcs, relicProfiles]);

  const ctx: TerminalContext | null = useMemo(() => (summary && profile && characters && events && zones && markers && codex && invRows
    ? { game, summary, profile, characters, events, zones, markers, codex, materialNeeds, builds, inventory: Object.fromEntries(invRows.map((r) => [r.itemId, r.count])) }
    : null), [game, summary, profile, characters, events, zones, markers, codex, invRows, materialNeeds, builds]);
  const messages = stored ?? [];
  const brain = resolveBrain(settings.chatBrain, { claude: !!ai?.configured, local: localAi.state !== "unsupported" });
  const useClaude = brain === "claude";
  // The built-in AI downloads itself the first time it's needed (Auto or Built-in AI).
  // On phones it waits for "Download now" (1 GB on mobile data is a bad surprise).
  const autoDownload = brain === "local-ai" && localAi.state === "idle" && (localAi.cached || !isMobileDevice());
  useEffect(() => { if (autoDownload) void ensureLocalAi(); }, [autoDownload]);
  const urgent = summary?.objectives.find((o) => URGENT.has(o.category)) ?? null;
  const hasPing = !!urgent && seen !== undefined && seen !== urgent.id;

  const save = useCallback(async (msgs: ChatMsg[]) => kvSet(chatKey(profileId), msgs.slice(-MAX_HISTORY)), [profileId]);

  /** When the chat opens: say hi if it's been a while, and mention one urgent thing. */
  const open = useCallback(async () => {
    if (!ctx || greeted.current) return;
    greeted.current = true;
    const msgs = await kvGet<ChatMsg[]>(chatKey(profileId), []);
    const last = msgs[msgs.length - 1];
    const stale = !last || Date.now() - Date.parse(last.at) > 3 * 3600_000;
    const mention = urgent && urgent.id !== seen ? `${urgent.title}|${urgent.reason}` : null;
    if (stale || mention) {
      const text = stale ? openingLine(persona, mention) : `Btw|${mention}`;
      await save([...msgs, { id: newId("m"), from: "wolf", text, at: new Date().toISOString(), via: "local", status: "done", intent: "opening", links: urgent && mention ? [{ label: urgent.title, href: urgent.href }] : undefined }]);
    }
    if (urgent) await kvSet(seenKey(profileId), urgent.id);
  }, [ctx, profileId, urgent, seen, persona, save]);

  const ask = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!ctx || !text || busy) return;
    const history = await kvGet<ChatMsg[]>(chatKey(profileId), []);
    const mine: ChatMsg = { id: newId("m"), from: "you", text, at: new Date().toISOString() };
    const withMine = [...history, mine];
    await save(withMine);
    const put = async (r: Reply) => {
      const { enableClaude, ...reply } = r;
      await save([...withMine, { id: newId("m"), from: "wolf", at: new Date().toISOString(), ...reply }]);
      if (enableClaude) await updateSettings({ chatBrain: "claude" });
    };
    // Salt = how many messages you've sent, so consecutive quick replies rotate through her lines.
    const salt = withMine.filter((m) => m.from === "you").length;
    if (brain === "quick") return put(localReply(text, ctx, persona, new Date(), salt, ai));
    if (brain === "local-ai") {
      const direct = routeLocalAi(text, ctx, persona, ai);
      if (direct) return put(direct);
      const st = useLocalAi.getState().status;
      if (st.state !== "ready") {
        if (st.state === "idle" && !st.cached && isMobileDevice()) {
          const q = localReply(text, ctx, persona, new Date(), salt, null);
          return put({ ...q, text: `${q.text}|(my AI brain isn't on this phone yet: tap the gear → Download now, about 1 GB, use Wi-Fi)` });
        }
        void ensureLocalAi();
        const q = localReply(text, ctx, persona, new Date(), salt, null);
        const note = st.state === "downloading" ? `(downloading my brain: ${Math.round(st.progress * 100)}%, real chat soon)`
          : st.state === "error" ? "(my AI brain crashed, quick replies for now)" : "(booting my brain, gimme a sec)";
        return put({ ...q, text: `${q.text}|${note}` });
      }
      setBusy(true);
      setStreaming("");
      try {
        const hist = withMine.filter((m) => m.status !== "error").slice(-8).map((m) => ({ role: m.from === "you" ? ("user" as const) : ("assistant" as const), content: m.from === "wolf" ? bubbles(m.text).join("\n") : m.text }));
        const first = hist.findIndex((m) => m.role === "user");
        const out = await generateLocal([{ role: "system", content: localSystemPrompt(persona, buildAiContext(text, ctx, { compact: true })) }, ...hist.slice(first)], (t) => setStreaming(cleanLocal(t)));
        let final = cleanLocal(out) || "...|Brain lag|Say that again?";
        if (crossesLine(final)) final = deflectLine(persona);
        await put({ text: final, via: "local-ai", status: "done", intent: "chat" });
      } catch (e) {
        const q = localReply(text, ctx, persona, new Date(), salt, null);
        await put({ ...q, text: `${q.text}|(my AI brain glitched: ${e instanceof Error ? e.message : String(e)})`, status: "error" });
      } finally { setBusy(false); setStreaming(null); }
      return;
    }
    setBusy(true);
    setStreaming("");
    let acc = "";
    try {
      const convo = withMine.filter((m) => m.status !== "error").slice(-20).map((m) => ({ role: m.from === "you" ? ("user" as const) : ("assistant" as const), text: m.from === "wolf" ? bubbles(m.text).join("\n") : m.text }));
      const first = convo.findIndex((m) => m.role === "user");
      const res = await fetch("/api/silverwolf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: buildAiContext(text, ctx), persona, messages: convo.slice(first) }) });
      if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `HTTP ${res.status}`); }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setStreaming(clean(acc));
      }
      const err = /\[\[error\]\] (.*)$/s.exec(acc)?.[1];
      let final = clean(acc);
      if (acc.includes("[[refusal]]")) final += "|...can't help w/ that one";
      await save([...withMine, { id: newId("m"), from: "wolf", at: new Date().toISOString(), text: err ? `${final ? `${final}|` : ""}${err}` : final || "...", via: "claude", status: err ? "error" : "done" }]);
    } catch (e) {
      await save([...withMine, { id: newId("m"), from: "wolf", at: new Date().toISOString(), text: `Connection's dead|${e instanceof Error ? e.message : String(e)}|Local mode still works tho`, via: "claude", status: "error" }]);
    } finally { setBusy(false); setStreaming(null); }
  }, [ctx, busy, profileId, save, brain, persona, ai, updateSettings]);

  const clear = useCallback(async () => { await kvSet(chatKey(profileId), []); greeted.current = false; }, [profileId]);

  return {
    ready: !!ctx, messages, streaming, busy, ask, open, clear, hasPing,
    ai, useClaude, brain, brainPref: settings.chatBrain, setBrain: (b: Brain) => updateSettings({ chatBrain: b }),
    localAi, startLocalAi: () => void ensureLocalAi(true), deleteLocalAi,
    persona, setPersona: (p: Partial<Persona>) => updateSettings({ ...(p.relationship ? { companionRelationship: p.relationship } : {}), ...(p.callsYou !== undefined ? { companionCallsYou: p.callsYou.slice(0, 24) } : {}) }),
    youName: profile?.name ?? "You",
  };
}

const clean = (acc: string) => acc.replace(/\n?\[\[(refusal|truncated|error)\]\].*$/s, "").split("\n").map((l) => l.trim()).filter(Boolean).join("|");
