"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Database } from "lucide-react";
import { useEffect, useState } from "react";
import type { Comment, Mood } from "@/lib/companion/voice";
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
const MOOD_TAG: Record<Mood, string> = {
  smug: "smug.exe", bored: "afk", hyped: "gg", alert: "warning", neutral: "online", glitch: "glitch",
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

function useTyped(text: string, enabled: boolean) {
  const [n, setN] = useState(enabled ? 0 : text.length);
  useEffect(() => {
    if (!enabled) { setN(text.length); return; }
    setN(0);
    const id = setInterval(() => setN((v) => { if (v >= text.length) { clearInterval(id); return v; } return v + 2; }), 14);
    return () => clearInterval(id);
  }, [text, enabled]);
  return text.slice(0, n);
}

/** Silver Wolf's comment for the current page. The speech is flavour; the facts list is the data it came from. */
export function WolfComment({ comment, className }: { comment: Comment | null; className?: string }) {
  const mode = useApp((s) => s.settings.companion);
  const reduced = useApp((s) => s.settings.reducedMotion);
  const [showFacts, setShowFacts] = useState(false);
  const typed = useTyped(comment?.line ?? "", !reduced && mode === "full");
  if (!comment || mode === "off") return null;
  return (
    <motion.aside
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cx("glass hud flex gap-3 p-3 sm:p-4", className)}
      aria-label="Silver Wolf says"
    >
      <WolfAvatar mood={comment.mood} />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
          <span className="text-violet">Silver Wolf</span>
          <span>{`// ${MOOD_TAG[comment.mood]}`}</span>
        </div>
        <p className={cx("text-sm leading-relaxed text-text", typed.length < comment.line.length && "caret")}>{typed}</p>
        {mode === "full" && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {comment.action && (
              <Link href={comment.action.href} className="rounded-md border border-cyan/40 px-2 py-0.5 font-mono text-[11px] text-cyan hover:bg-cyan/10">
                ▸ {comment.action.label}
              </Link>
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
            <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 space-y-0.5 overflow-hidden border-l border-line pl-3 font-mono text-[11px] text-muted">
              {comment.facts.map((f) => <li key={f}>{f}</li>)}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
