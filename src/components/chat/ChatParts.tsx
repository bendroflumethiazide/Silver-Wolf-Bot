"use client";

import Link from "next/link";
import { Send, Settings2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RELATIONSHIP_LABEL, type Relationship } from "@/lib/companion/casual";
import { BRAIN_LABEL, LOCAL_MODEL_NAME, LOCAL_MODEL_SIZE, type Brain } from "@/lib/ai/brain";
import { SUGGESTIONS } from "@/lib/companion/terminal";
import { bubbles } from "@/lib/companion/voice";
import { Badge, confirmAction, cx } from "../ui";
import { Bubble, WolfAvatar, WolfMessages } from "../SilverWolf";
import type { useWolfChat } from "./useWolfChat";

type Chat = ReturnType<typeof useWolfChat>;

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Scrolling message list, in-game Messages style. Follows new bubbles as they type in. */
export function ChatThread({ chat, light }: { chat: Chat; light?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    const mo = new MutationObserver(() => { el.scrollTop = el.scrollHeight; });
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, []);
  const msgs = chat.messages;
  return (
    <div ref={box} className={cx("flex-1 space-y-4 overflow-y-auto p-3 sm:p-4", light ? "bg-[#d6d6dc]" : "bg-[rgba(236,236,241,0.04)]")} aria-live="polite">
      <BrainBanner chat={chat} light={light} />
      {!msgs.length && !chat.streaming && <p className={cx("pt-10 text-center text-xs", light ? "text-[#6b6b78]" : "text-muted")}>No messages yet. Say hi.</p>}
      {msgs.map((m, i) => m.from === "you" ? (
        <div key={m.id} className="ml-auto flex max-w-[85%] flex-col items-end gap-1">
          <div className={cx("text-[11px] font-medium", light ? "text-[#55555f]" : "text-muted")}>{chat.youName} · {time(m.at)}</div>
          <Bubble mine>{m.text}</Bubble>
        </div>
      ) : (
        <div key={m.id} className="max-w-[94%]">
          <WolfMessages parts={bubbles(m.text)} mood={m.status === "error" ? "alert" : "neutral"} animate={i === msgs.length - 1 && m.via === "local" && Date.now() - Date.parse(m.at) < 4000} light={light} />
          {(m.via === "claude" || m.via === "local-ai" || (m.facts && m.facts.length) || m.links?.length) && (
            <div className="ml-[54px] mt-1.5 flex flex-wrap items-center gap-2">
              {m.via === "claude" && <Badge tone="violet">claude</Badge>}
              {m.via === "local-ai" && <Badge tone="cyan">built-in AI</Badge>}
              {m.facts && m.facts.length > 0 && (
                <details className={cx("text-xs", light ? "text-[#44444d]" : "text-muted")}>
                  <summary className="cursor-pointer font-mono text-[11px] opacity-70">data & sources ({m.intent})</summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">{m.facts.map((f, j) => <li key={j}>{f}</li>)}</ul>
                  {m.sources && <div className="mt-1 flex flex-wrap gap-1">{m.sources.map((s) => <Badge key={s}>{s}</Badge>)}</div>}
                </details>
              )}
              {m.links?.map((l) => <Link key={l.href + l.label} href={l.href} className={cx("font-mono text-[11px] hover:underline", light ? "text-[#5b3fb6]" : "text-cyan")}>▸ {l.label}</Link>)}
            </div>
          )}
        </div>
      ))}
      {chat.streaming !== null && (
        chat.streaming ? <WolfMessages parts={bubbles(chat.streaming)} animate={false} light={light} /> : (
          <div className="flex gap-3"><WolfAvatar size={42} /><div className="space-y-1.5"><div className={cx("text-xs font-medium", light ? "text-[#55555f]" : "text-muted")}>Silver Wolf</div><Bubble typing /></div></div>
        )
      )}
    </div>
  );
}

const QUICK = ["What should I do today?", "Rate my builds", "Should I pull?", "How's it going?"];

export function ChatComposer({ chat, light, chips = "quick" }: { chat: Chat; light?: boolean; chips?: "quick" | "all" }) {
  const [input, setInput] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const list = chips === "all" ? [...QUICK.slice(0, 1), ...SUGGESTIONS] : QUICK;
  return (
    <div className={cx("border-t p-2.5", light ? "border-[#c4c4cc] bg-[#e7e7ec]" : "border-line")}>
      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
        {[...new Set(list)].map((s) => (
          <button key={s} onClick={() => chat.ask(s)} disabled={chat.busy || !chat.ready}
            className={cx("whitespace-nowrap rounded-full border px-2.5 py-1 text-xs", light ? "border-[#b9b9c3] bg-white/70 text-[#2d2d35] hover:bg-white" : "border-line text-muted hover:border-violet/50 hover:text-text")}>{s}</button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void chat.ask(input); setInput(""); }} className="flex gap-2">
        <input ref={ref} value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} aria-label="Message Silver Wolf"
          placeholder={chat.brain === "quick" ? "Text Silver Wolf (quick replies)…" : "Text Silver Wolf…"}
          className={cx("min-w-0 flex-1", light && "!border-[#b9b9c3] !bg-white !text-[#141418] placeholder:text-[#8a8a95]")} />
        <button type="submit" disabled={!input.trim() || chat.busy || !chat.ready} aria-label="Send"
          className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 text-white disabled:opacity-40"><Send size={15} /></button>
      </form>
    </div>
  );
}

/** Relationship, nickname, engine and clear-history controls. */
export function ChatSettings({ chat, light }: { chat: Chat; light?: boolean }) {
  const [open, setOpen] = useState(false);
  const field = cx("w-full", light && "!border-[#b9b9c3] !bg-white !text-[#141418]");
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Chat settings" className={cx("rounded-lg p-1.5", light ? "text-[#44444d] hover:bg-black/5" : "text-muted hover:bg-white/5")}><Settings2 size={17} /></button>
      {open && (
        <div className="glass-strong absolute right-0 top-9 z-10 w-64 space-y-3 p-3 text-sm text-text">
          <label className="block text-xs text-muted">She is your
            <select className="mt-1 w-full" value={chat.persona.relationship} onChange={(e) => chat.setPersona({ relationship: e.target.value as Relationship })}>
              {(Object.keys(RELATIONSHIP_LABEL) as Relationship[]).map((r) => <option key={r} value={r}>{RELATIONSHIP_LABEL[r]}</option>)}
            </select>
          </label>
          <label className="block text-xs text-muted">She calls you
            <input className={cx("mt-1", field)} value={chat.persona.callsYou} maxLength={24} placeholder={chat.persona.relationship === "big-sister" ? "kid" : "Trailblazer"} onChange={(e) => chat.setPersona({ callsYou: e.target.value })} />
          </label>
          <label className="block text-xs text-muted">Her brain
            <select className="mt-1 w-full" value={chat.brainPref} onChange={(e) => chat.setBrain(e.target.value as Brain)} aria-label="Her brain">
              {(Object.keys(BRAIN_LABEL) as Brain[]).map((b) => <option key={b} value={b} disabled={b === "claude" && !chat.ai?.configured}>{BRAIN_LABEL[b]}{b === "claude" && !chat.ai?.configured ? " (needs key)" : ""}</option>)}
            </select>
            <span className="mt-1 block text-[11px] text-faint">Using now: {chat.brain === "claude" ? "Claude" : chat.brain === "local-ai" ? "built-in AI" : "quick replies"}</span>
          </label>
          <LocalAiStatus chat={chat} />
          <button onClick={async () => { if (confirmAction("Clear your chat history with Silver Wolf?")) await chat.clear(); }} className="inline-flex items-center gap-1 text-xs text-bad hover:underline"><Trash2 size={12} /> Clear chat history</button>
        </div>
      )}
    </div>
  );
}

function pct(p: number) { return `${Math.round(p * 100)}%`; }

/** Download progress (first time only) shown above the messages. */
function BrainBanner({ chat, light }: { chat: Chat; light?: boolean }) {
  const st = chat.localAi;
  if (chat.brain !== "local-ai" || st.state !== "downloading") return null;
  return (
    <div className={cx("sticky top-0 z-[1] rounded-lg border px-3 py-2 text-xs", light ? "border-[#c4c4cc] bg-white/90 text-[#2d2d35]" : "border-line bg-panel/90 text-muted")} role="status">
      <div className="flex justify-between gap-2"><span>Downloading Silver Wolf&apos;s brain (one time, {LOCAL_MODEL_SIZE})</span><span className="font-mono">{pct(st.progress)}</span></div>
      <div className={cx("mt-1.5 h-1 overflow-hidden rounded", light ? "bg-[#d6d6dc]" : "bg-white/10")}><div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-[width]" style={{ width: pct(st.progress) }} /></div>
      <div className="mt-1 opacity-70">She answers with quick replies until it&apos;s done.</div>
    </div>
  );
}

/** Built-in AI state, with download / delete. */
export function LocalAiStatus({ chat }: { chat: Chat }) {
  const st = chat.localAi;
  const text = st.state === "checking" ? "Checking this PC…"
    : st.state === "unsupported" ? `Not available on this PC: ${st.reason}`
    : st.state === "idle" ? (st.cached ? "Downloaded, loads when needed." : `Not downloaded yet (${LOCAL_MODEL_SIZE}).`)
    : st.state === "downloading" ? `Downloading… ${pct(st.progress)}`
    : st.state === "ready" ? "Ready, running on this PC."
    : `Error: ${st.message}`;
  return (
    <div className="text-xs text-muted">
      <div>Built-in AI ({LOCAL_MODEL_NAME})</div>
      <p className="mt-0.5 text-[11px] text-faint">{text}</p>
      <div className="mt-1 flex gap-3">
        {(st.state === "idle" || st.state === "error") && <button onClick={chat.startLocalAi} className="text-[11px] text-cyan hover:underline">{st.state === "error" ? "Try again" : st.cached ? "Load now" : "Download now"}</button>}
        {(st.state === "ready" || (st.state === "idle" && st.cached)) && <button onClick={async () => { if (confirmAction("Delete the built-in AI model? It downloads again next time it's needed.")) await chat.deleteLocalAi(); }} className="text-[11px] text-bad hover:underline">Delete model</button>}
      </div>
    </div>
  );
}
