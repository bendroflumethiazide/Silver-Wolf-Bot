"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { WolfAvatar } from "@/components/SilverWolf";
import { Badge, Button, cx, Loading, Notice, PageHeader } from "@/components/ui";
import { answer, SUGGESTIONS, type TerminalAnswer } from "@/lib/companion/terminal";
import { getDb, kvGet } from "@/lib/db";
import { useAccount, useProfile } from "@/lib/hooks";
import { mergeTotals } from "@/lib/materials/calculator";
import { FULL_TARGET, planCharacter, planLightCone, type CharacterTarget } from "@/lib/materials/plan";
import { useApp } from "@/lib/store";

interface Msg { from: "you" | "wolf"; text: string; a?: TerminalAnswer }

export default function TerminalPage() {
  const { game, profileId } = useApp();
  const profile = useProfile();
  const { summary } = useAccount();
  const db = getDb();
  const characters = useLiveQuery(() => db.characters.where("profileId").equals(profileId).toArray(), [profileId]);
  const lcs = useLiveQuery(() => db.lightCones.where("profileId").equals(profileId).toArray(), [profileId]);
  const events = useLiveQuery(() => db.events.toArray(), []);
  const zones = useLiveQuery(() => db.mapZones.toArray(), []);
  const markers = useLiveQuery(() => db.mapMarkers.where("profileId").equals(profileId).toArray(), [profileId]);
  const codex = useLiveQuery(() => db.codex.toArray(), []);
  const invRows = useLiveQuery(() => db.materials.where("profileId").equals(profileId).toArray(), [profileId]);
  const plans = useLiveQuery(() => kvGet<{ kind: string; targetId: string; target?: CharacterTarget; lcTo?: number }[]>(`materialPlans:${profileId}`, []), [profileId]);
  const [input, setInput] = useState("");
  const [log, setLog] = useState<Msg[]>([]);
  const end = useRef<HTMLDivElement>(null);

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

  const ready = summary && profile && characters && events && zones && markers && codex && invRows;
  const ask = (text: string) => {
    if (!ready || !text.trim()) return;
    const a = answer(text, { game, summary, profile, characters, events, zones, markers, codex, materialNeeds, inventory: Object.fromEntries(invRows.map((r) => [r.itemId, r.count])) });
    setLog((l) => [...l, { from: "you", text }, { from: "wolf", text: a.line, a }]);
    setInput("");
  };
  useEffect(() => { if (ready && !log.length) ask("hello"); });
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [log.length]);

  if (!ready) return <Loading label="Connecting to SW// terminal" />;
  return (
    <div>
      <PageHeader title="Silver Wolf // Terminal" subtitle="Ask about your account. Answers come only from your local data and the downloaded game database, with the facts and sources shown." />
      <Notice>Local mode. External AI chat (for example the Claude API) is not configured. Turning it on means sending selected account data to a provider, so it needs your approval first.</Notice>
      <div className="glass hud mt-4 flex h-[62dvh] min-h-[380px] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {log.filter((m) => m.from === "you" ? m.text !== "hello" : true).map((m, i) => (
            <div key={i} className={cx("flex gap-3", m.from === "you" && "justify-end")}>
              {m.from === "wolf" && <WolfAvatar size={36} />}
              <div className={cx("max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm", m.from === "you" ? "bg-violet/20 text-text" : "border border-line bg-black/30")}>
                <p className="whitespace-pre-line">{m.text}</p>
                {m.a && (m.a.facts.length > 0 || m.a.sources.length > 0) && (
                  <details className="mt-2 text-xs text-muted">
                    <summary className="cursor-pointer font-mono text-[11px] text-faint">data & sources ({m.a.intent})</summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">{m.a.facts.map((f, j) => <li key={j}>{f}</li>)}</ul>
                    <div className="mt-1 flex flex-wrap gap-1">{m.a.sources.map((s) => <Badge key={s}>{s}</Badge>)}</div>
                  </details>
                )}
                {m.a?.links.length ? <div className="mt-2 flex flex-wrap gap-2">{m.a.links.map((l) => <Link key={l.href} href={l.href} className="font-mono text-[11px] text-cyan hover:underline">▸ {l.label}</Link>)}</div> : null}
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>
        <div className="border-t border-line p-3">
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
            {SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)} className="whitespace-nowrap rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-violet/50 hover:text-text">{s}</button>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Silver Wolf…" aria-label="Message Silver Wolf" className="min-w-0 flex-1" />
            <Button variant="primary" type="submit" disabled={!input.trim()} aria-label="Send"><Send size={15} /></Button>
          </form>
        </div>
      </div>
    </div>
  );
}
