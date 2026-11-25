"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SIGNATURE } from "@/lib/companion/voice";
import { useApp } from "@/lib/store";
import { WolfAvatar } from "../SilverWolf";
import { cx } from "../ui";
import { ChatComposer, ChatSettings, ChatThread } from "./ChatParts";
import { useWolfChat } from "./useWolfChat";

/** Floating "phone" with Silver Wolf, bottom-right on every page (except her full chat page). */
export function PhoneChat() {
  const pathname = usePathname();
  const reduced = useApp((s) => s.settings.reducedMotion);
  const [open, setOpen] = useState(false);
  const chat = useWolfChat();

  useEffect(() => { if (open && chat.ready) void chat.open(); }, [open, chat.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname.replace(/\/$/, "") === "/terminal") return null;
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog" aria-label="Phone chat with Silver Wolf"
            initial={reduced ? false : { opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#1b1a24] sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[min(640px,calc(100dvh-8rem))] sm:w-[380px] sm:rounded-[28px] sm:border-[6px] sm:border-[#1b1a24] sm:shadow-[0_20px_60px_rgba(0,0,0,.6),0_0_0_1px_rgba(167,139,250,.35)]"
          >
            <div className="flex items-center gap-2.5 bg-[#ececf0] px-3 py-2.5 text-[#141418] sm:rounded-t-[22px]">
              <WolfAvatar size={36} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold leading-tight">Silver Wolf</div>
                <div className="truncate text-[11px] text-[#55555f]">{SIGNATURE}</div>
              </div>
              <ChatSettings chat={chat} light />
              <Link href="/terminal" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-[#44444d] hover:bg-black/5" aria-label="Open full chat"><Maximize2 size={16} /></Link>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-[#44444d] hover:bg-black/5" aria-label="Close phone"><X size={18} /></button>
            </div>
            <ChatThread chat={chat} light />
            <div className="sm:rounded-b-[22px] sm:overflow-hidden"><ChatComposer chat={chat} light /></div>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Silver Wolf's chat" : `Text Silver Wolf${chat.hasPing ? " (new message)" : ""}`}
        className={cx("fixed bottom-5 right-5 z-50 h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 p-[3px] shadow-[0_8px_30px_rgba(167,139,250,.45)] transition hover:scale-105", open ? "hidden sm:flex" : "flex")}
      >
        <span className="relative flex h-full w-full items-center justify-center rounded-full bg-[#0b0a18]">
          {open ? <X size={22} className="text-white" /> : <WolfAvatar size={46} />}
          {!open && <MessageCircle size={16} className="absolute -bottom-0.5 -left-0.5 rounded-full bg-cyan p-0.5 text-[#0b0a18]" />}
          {!open && chat.hasPing && <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-[#0b0a18] bg-magenta" aria-hidden />}
        </span>
      </button>
    </>
  );
}
