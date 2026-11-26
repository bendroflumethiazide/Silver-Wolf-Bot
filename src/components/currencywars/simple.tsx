"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { kvGet, kvSet } from "@/lib/db";
import { cx } from "../ui";

/** Simple Mode: hides explanations, assumptions and long descriptions in Currency Wars (saved). */
const KEY = "cwSimple";
const Ctx = createContext<{ simple: boolean; setSimple: (v: boolean) => void }>({ simple: false, setSimple: () => {} });

export function SimpleProvider({ children }: { children: ReactNode }) {
  const [simple, set] = useState(false);
  useEffect(() => { let live = true; void kvGet<boolean>(KEY, false).then((v) => { if (live) set(!!v); }); return () => { live = false; }; }, []);
  const setSimple = (v: boolean) => { set(v); void kvSet(KEY, v); };
  return <Ctx.Provider value={{ simple, setSimple }}>{children}</Ctx.Provider>;
}

export const useSimple = () => useContext(Ctx).simple;

/** Shown only when Simple Mode is off. */
export function Verbose({ children }: { children: ReactNode }) {
  return useSimple() ? null : <>{children}</>;
}

export function SimpleToggle() {
  const { simple, setSimple } = useContext(Ctx);
  return (
    <button type="button" role="switch" aria-checked={simple} onClick={() => setSimple(!simple)} title="Hide explanations, assumptions and long descriptions"
      className={cx("inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm", simple ? "border-cyan/60 text-cyan" : "border-line text-muted hover:text-text")}>
      <span className={cx("relative inline-block h-4 w-7 rounded-full transition", simple ? "bg-cyan/70" : "bg-white/15")}>
        <span className={cx("absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all", simple ? "left-3.5" : "left-0.5")} />
      </span>
      Simple Mode
    </button>
  );
}
