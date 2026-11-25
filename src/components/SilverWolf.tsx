"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Database } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { bubbles, type Comment, type Mood } from "@/lib/companion/voice";
import { useApp } from "@/lib/store";
import { GameImage } from "./GameImage";
import { cx } from "./ui";

const MOOD_RING: Record<Mood, string> = {
  smug: "from-fuchsia-500 to-violet-500",
  bored: "from-slate-500 to-violet-700",
  hyped: "from-cyan-400 to-fuchsia-500",
  alert: "from-amber-400 to-rose-500",
  neutral: "from-violet-500 to-cyan-500",
  glitch: "from-cyan-400 to-rose-500",
};

export function WolfAvatar({ mood = "neutral", size = 44 }: { mood?: Mood; size?: number }) {
  const icon = useApp((s) => s.game?.characters["1006"]?.icon);
  return (
    <div className={cx("relative shrink-0 rounded-full bg-gradient-to-br p-[2px]", MOOD_RING[mood])} style={{ width: size, height: size }}>
      <GameImage path={icon} alt="Silver Wolf" fallback="S W" rounded="rounded-full" className="h-full w-full bg-black" />
      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--void)] bg-ok" aria-hidden />
    </div>
  );
}

/** One in-game-Messages-style bubble. */
export function Bubble({ children, mine, typing, light }: { children?: ReactNode; mine?: boolean; typing?: boolean; light?: boolean }) {
  return (
    <div className={cx("w-fit max-w-full rounded-[14px] px-3.5 py-2 text-[15px] font-medium leading-snug shadow-sm",
      mine ? "ml-auto bg-[#d3b98a] text-[#1d1a14]" : light ? "bg-[#f7f7f9] text-[#141418]" : "bg-[#ececf1] text-[#141418]")}>
      {typing ? <span className="inline-flex gap-1 py-1" aria-label="typing"><Dot d={0} /><Dot d={0.15} /><Dot d={0.3} /></span> : children}
    </div>
  );
}
const Dot = ({ d }: { d: number }) => (
  <motion.span className="h-1.5 w-1.5 rounded-full bg-[#6b6b78]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.9, repeat: Infinity, delay: d }} />
);

/** Reveal bubbles one by one, like she's typing them. */
export function useBurst(parts: string[], animate: boolean) {
  const key = parts.join("|");
  const [shown, setShown] = useState(animate ? 0 : parts.length);
  useEffect(() => {
    if (!animate) { setShown(parts.length); return; }
    setShown(0);
    let n = 0;
    const tick = () => { n++; setShown(n); if (n < parts.length) timer = setTimeout(tick, 380 + Math.min(500, parts[n].length * 18)); };
    let timer = setTimeout(tick, 250);
    return () => clearTimeout(timer);
  }, [key, animate]); // eslint-disable-line react-hooks/exhaustive-deps
  return shown;
}

/** A burst of Silver Wolf messages (avatar + name on the first bubble, like the in-game chat). */
export function WolfMessages({ parts, mood = "neutral", animate = true, light }: { parts: string[]; mood?: Mood; animate?: boolean; light?: boolean }) {
  const reduced = useApp((s) => s.settings.reducedMotion);
  const shown = useBurst(parts, animate && !reduced);
  return (
    <div className="flex gap-3">
      <WolfAvatar mood={mood} size={42} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className={cx("text-xs font-medium", light ? "text-[#55555f]" : "text-muted")}>Silver Wolf</div>
        {parts.slice(0, shown).map((p, i) => (
          <motion.div key={i} initial={reduced ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}><Bubble light={light}>{p}</Bubble></motion.div>
        ))}
        {shown < parts.length && <Bubble typing light={light} />}
      </div>
    </div>
  );
}

/** Silver Wolf's comment for the current page. The messages are flavour; the data list is the source. */
export function WolfComment({ comment, className }: { comment: Comment | null; className?: string }) {
  const mode = useApp((s) => s.settings.companion);
  const [showFacts, setShowFacts] = useState(false);
  if (!comment || mode === "off") return null;
  const parts = bubbles(comment.line);
  return (
    <aside className={cx("glass hud p-3 sm:p-4", className)} aria-label="Silver Wolf says">
      <WolfMessages parts={mode === "brief" ? parts.slice(0, 2) : parts} mood={comment.mood} animate={mode === "full"} />
      {mode === "full" && (comment.action || comment.facts.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-[54px]">
          {comment.action && (
            <Link href={comment.action.href} className="rounded-md border border-cyan/40 px-2 py-0.5 font-mono text-[11px] text-cyan hover:bg-cyan/10">▸ {comment.action.label}</Link>
          )}
          {comment.facts.length > 0 && (
            <button onClick={() => setShowFacts((v) => !v)} className="inline-flex items-center gap-1 font-mono text-[11px] text-muted hover:text-text" aria-expanded={showFacts}>
              <Database size={11} /> data <ChevronDown size={11} className={cx("transition", showFacts && "rotate-180")} />
            </button>
          )}
        </div>
      )}
      <AnimatePresence>
        {showFacts && mode === "full" && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="ml-[54px] mt-2 space-y-0.5 overflow-hidden border-l border-line pl-3 font-mono text-[11px] text-muted">
            {comment.facts.map((f) => <li key={f}>{f}</li>)}
          </motion.ul>
        )}
      </AnimatePresence>
    </aside>
  );
}
