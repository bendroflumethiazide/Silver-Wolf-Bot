"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bubble, WolfAvatar, WolfMessages } from "@/components/SilverWolf";
import { Badge, Button, cx, Loading, Notice } from "@/components/ui";
import { answer, buildAiContext, SUGGESTIONS, type BuildSummary, type TerminalAnswer, type TerminalContext } from "@/lib/companion/terminal";
import { bubbles, SIGNATURE } from "@/lib/companion/voice";
import { evaluateBuild } from "@/lib/builds/evaluate";
import { computeStats } from "@/lib/builds/stats";
import { getDb, kvGet } from "@/lib/db";
import { characterDisplayName } from "@/lib/gamedata/types";
import { useAccount, useProfile, useRelicProfiles } from "@/lib/hooks";
import { mergeTotals } from "@/lib/materials/calculator";
import { FULL_TARGET, planCharacter, planLightCone, type CharacterTarget } from "@/lib/materials/plan";
import { useApp } from "@/lib/store";
import { profileFor } from "@/lib/summary";

interface Msg { from: "you" | "wolf"; text: string; a?: TerminalAnswer; via?: "local" | "claude"; status?: "streaming" | "done" | "error" }

export default function TerminalPage() {
  const { game, profileId, settings, updateSettings } = useApp();
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
  const relicProfiles = useRelicProfiles(profileId);
  const [input, setInput] = useState("");
  const [log, setLog] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<{ configured: boolean; model?: string } | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch("/api/silverwolf").then((r) => r.json()).then(setAi).catch(() => setAi({ configured: false })); }, []);

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
      const p = profileFor(c.charId, game, relicProfiles);
      const e = evaluateBuild(game, c, worn, p, computeStats(game, c, lc, worn), lc);
      return { charId: c.charId, name: characterDisplayName(game.characters[c.charId]), grade: e.overall.grade.label, score: e.overall.score, lacks: e.lacks, best: e.strengths[0], equipped: e.equipped };
    });
  }, [game, characters, relics, lcs, relicProfiles]);

  const ctx: TerminalContext | null = summary && profile && characters && events && zones && markers && codex && invRows
    ? { game, summary, profile, characters, events, zones, markers, codex, materialNeeds, builds, inventory: Object.fromEntries(invRows.map((r) => [r.itemId, r.count])) }
    : null;
  const useClaude = !!ai?.configured && settings.aiChat;

  const askLocal = (text: string, c: TerminalContext) => {
    const a = answer(text, c);
    setLog((l) => [...l, { from: "wolf", text: a.line, a, via: "local", status: "done" }]);
  };

  const askClaude = async (text: string, c: TerminalContext, history: Msg[]) => {
    setBusy(true);
    const convo = [...history, { from: "you" as const, text }].filter((m) => m.status !== "error").slice(-20)
      .map((m) => ({ role: m.from === "you" ? ("user" as const) : ("assistant" as const), text: m.from === "wolf" ? bubbles(m.text).join("\n") : m.text }));
    const firstUser = convo.findIndex((m) => m.role === "user");
    setLog((l) => [...l, { from: "wolf", text: "", via: "claude", status: "streaming" }]);
    const update = (t: string, status: Msg["status"]) => setLog((l) => { const copy = [...l]; copy[copy.length - 1] = { ...copy[copy.length - 1], text: t, status }; return copy; });
    try {
      const res = await fetch("/api/silverwolf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: buildAiContext(text, c), messages: convo.slice(firstUser) }) });
      if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `HTTP ${res.status}`); }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        update(acc.replace(/\n?\[\[(refusal|truncated|error)\]\].*$/s, "").split("\n").join("|"), "streaming");
      }
      const err = /\[\[error\]\] (.*)$/s.exec(acc)?.[1];
      const refusal = acc.includes("[[refusal]]");
      let final = acc.replace(/\n?\[\[(refusal|truncated|error)\]\].*$/s, "").split("\n").join("|");
      if (refusal) final += "|...can't help w/ that one";
      if (err) { update(final ? `${final}|${err}` : err, "error"); return; }
      update(final || "...", "done");
    } catch (e) {
      update(`Connection's dead|${e instanceof Error ? e.message : String(e)}|Switching to local mode works tho`, "error");
    } finally { setBusy(false); }
  };

  const greeting: Msg | null = ctx ? { from: "wolf", text: answer("hello", ctx).line, a: answer("hello", ctx), via: "local", status: "done" } : null;
  const shown = log.length || !greeting ? log : [greeting];

  const ask = (text: string) => {
    if (!ctx || !text.trim() || busy) return;
    const history = shown;
    setLog([...history, { from: "you", text }]);
    setInput("");
    if (useClaude) void askClaude(text, ctx, history);
    else askLocal(text, ctx);
  };
  const scroller = useRef<HTMLDivElement>(null);
  // Follow her bubbles as they arrive (they reveal one by one), not only when a message is added.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { el.scrollTop = el.scrollHeight; });
    for (const child of Array.from(el.children)) ro.observe(child);
    const mo = new MutationObserver(() => { el.scrollTop = el.scrollHeight; });
    mo.observe(el, { childList: true, subtree: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  });

  if (!ctx) return <Loading label="Connecting to SW// terminal" />;
  return (
    <div className="mx-auto max-w-4xl">
      <div className="glass hud flex h-[calc(100dvh-10rem)] min-h-[460px] flex-col overflow-hidden">
        <header className="flex flex-wrap items-center gap-3 border-b border-line bg-white/[0.03] px-4 py-3">
          <WolfAvatar size={40} />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">Silver Wolf</h1>
            <p className="truncate text-xs text-muted">{SIGNATURE}</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-line p-0.5 text-xs" role="radiogroup" aria-label="Chat engine">
            <button role="radio" aria-checked={!useClaude} onClick={() => updateSettings({ aiChat: false })} className={cx("rounded-md px-2.5 py-1", !useClaude ? "bg-violet/25 text-text" : "text-muted")}>Local</button>
            <button role="radio" aria-checked={useClaude} disabled={!ai?.configured} onClick={() => updateSettings({ aiChat: true })} className={cx("rounded-md px-2.5 py-1 disabled:opacity-40", useClaude ? "bg-violet/25 text-text" : "text-muted")} title={ai?.configured ? `Claude (${ai.model})` : "Add ANTHROPIC_API_KEY to .env.local to enable"}>Claude</button>
          </div>
        </header>
        <div ref={scroller} className="flex-1 space-y-5 overflow-y-auto bg-[rgba(236,236,241,0.04)] p-4" aria-live="polite">
          {shown.map((m, i) => m.from === "you" ? (
            <div key={i} className="ml-auto flex max-w-[85%] flex-col items-end gap-1">
              <div className="text-xs font-medium text-muted">{profile?.name ?? "You"}</div>
              <Bubble mine>{m.text}</Bubble>
            </div>
          ) : (
            <div key={i} className="max-w-[92%]">
              {m.status === "streaming" && !m.text ? (
                <div className="flex gap-3"><WolfAvatar size={42} /><div className="space-y-1.5"><div className="text-xs font-medium text-muted">Silver Wolf</div><Bubble typing /></div></div>
              ) : (
                <WolfMessages parts={bubbles(m.text)} mood={m.status === "error" ? "alert" : "neutral"} animate={m.via === "local" && i === shown.length - 1} />
              )}
              <div className="ml-[54px] mt-1.5 flex flex-wrap items-center gap-2">
                {m.via === "claude" && <Badge tone="violet">claude</Badge>}
                {m.a && (m.a.facts.length > 0 || m.a.sources.length > 0) && (
                  <details className="text-xs text-muted">
                    <summary className="cursor-pointer font-mono text-[11px] text-faint">data & sources ({m.a.intent})</summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">{m.a.facts.map((f, j) => <li key={j}>{f}</li>)}</ul>
                    <div className="mt-1 flex flex-wrap gap-1">{m.a.sources.map((s) => <Badge key={s}>{s}</Badge>)}</div>
                  </details>
                )}
                {m.a?.links.map((l) => <Link key={l.href} href={l.href} className="font-mono text-[11px] text-cyan hover:underline">▸ {l.label}</Link>)}
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>
        <div className="border-t border-line p-3">
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
            {SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)} disabled={busy} className="whitespace-nowrap rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-violet/50 hover:text-text">{s}</button>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={useClaude ? "Text Silver Wolf…" : "Ask Silver Wolf (local mode)…"} aria-label="Message Silver Wolf" className="min-w-0 flex-1" maxLength={2000} />
            <Button variant="primary" type="submit" disabled={!input.trim() || busy} aria-label="Send"><Send size={15} /></Button>
          </form>
        </div>
      </div>
      <div className="mt-3">
        {useClaude
          ? <Notice>Claude mode: your question plus a compact facts block (roster, pity, resources, build grades; no UID or name) is sent to the Claude API from this app&apos;s local server. She may still be wrong. Check the numbers on the relevant page.</Notice>
          : <Notice>Local mode: answers come only from data on this device. {ai?.configured ? "Switch to Claude above for free-form chat." : "To chat freely, add ANTHROPIC_API_KEY to .env.local and restart (see README)."}</Notice>}
      </div>
    </div>
  );
}
