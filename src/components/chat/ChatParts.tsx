"use client";

import Link from "next/link";
import { Send, Settings2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RELATIONSHIP_LABEL, type Relationship } from "@/lib/companion/casual";
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
      {!msgs.length && !chat.streaming && <p className={cx("pt-10 text-center text-xs", light ? "text-[#6b6b78]" : "text-muted")}>No messages yet. Say hi.</p>}
      {msgs.map((m, i) => m.from === "you" ? (
        <div key={m.id} className="ml-auto flex max-w-[85%] flex-col items-end gap-1">
          <div className={cx("text-[11px] font-medium", light ? "text-[#55555f]" : "text-muted")}>{chat.youName} · {time(m.at)}</div>
          <Bubble mine>{m.text}</Bubble>
        </div>
      ) : (
        <div key={m.id} className="max-w-[94%]">
          <WolfMessages parts={bubbles(m.text)} mood={m.status === "error" ? "alert" : "neutral"} animate={i === msgs.length - 1 && m.via === "local" && Date.now() - Date.parse(m.at) < 4000} light={light} />
          {(m.via === "claude" || (m.facts && m.facts.length) || m.links?.length) && (
            <div className="ml-[54px] mt-1.5 flex flex-wrap items-center gap-2">
              {m.via === "claude" && <Badge tone="violet">claude</Badge>}
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
          placeholder={chat.useClaude ? "Text Silver Wolf…" : "Text Silver Wolf (local mode)…"}
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
          <div className="text-xs text-muted">Chat engine
            <div className="mt-1 flex gap-1 rounded-lg border border-line p-0.5" role="radiogroup" aria-label="Chat engine">
              <button role="radio" aria-checked={!chat.useClaude} onClick={() => chat.setUseClaude(false)} className={cx("flex-1 rounded-md px-2 py-1", !chat.useClaude ? "bg-violet/25 text-text" : "")}>Local</button>
              <button role="radio" aria-checked={chat.useClaude} disabled={!chat.ai?.configured} onClick={() => chat.setUseClaude(true)} className={cx("flex-1 rounded-md px-2 py-1 disabled:opacity-40", chat.useClaude ? "bg-violet/25 text-text" : "")} title={chat.ai?.configured ? `Claude (${chat.ai.model})` : "Add your Anthropic API key in Settings → Desktop (or .env.local)"}>Claude</button>
            </div>
            {!chat.ai?.configured && <p className="mt-1 text-[11px] text-faint">Claude needs an API key (Settings).</p>}
          </div>
          <button onClick={async () => { if (confirmAction("Clear your chat history with Silver Wolf?")) await chat.clear(); }} className="inline-flex items-center gap-1 text-xs text-bad hover:underline"><Trash2 size={12} /> Clear chat history</button>
        </div>
      )}
    </div>
  );
}
