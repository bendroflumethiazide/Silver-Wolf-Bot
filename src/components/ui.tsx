"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { SOURCE_LABEL, type DataSource } from "@/lib/types";

export const cx = clsx;

export function Panel({ title, actions, children, className, hud, id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; hud?: boolean; id?: string }) {
  return (
    <section id={id} className={cx("glass p-4 sm:p-5", hud && "hud", className)}>
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="glitch text-2xl font-semibold tracking-tight text-gradient sm:text-3xl" data-text={title}>{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "subtle"; size?: "sm" | "md" };
export function Button({ variant = "subtle", size = "md", className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
        variant === "primary" && "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-[0_0_20px_rgba(167,139,250,.35)] hover:brightness-110",
        variant === "subtle" && "border border-line bg-white/5 text-text hover:border-violet/50 hover:bg-white/10",
        variant === "ghost" && "text-muted hover:bg-white/5 hover:text-text",
        variant === "danger" && "border border-bad/40 bg-bad/10 text-bad hover:bg-bad/20",
        className,
      )}
    />
  );
}

export function Badge({ children, tone = "default", className, title }: { children: ReactNode; tone?: "default" | "gold" | "violet" | "cyan" | "ok" | "warn" | "bad"; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        tone === "default" && "border-line text-muted",
        tone === "gold" && "border-gold/40 text-gold",
        tone === "violet" && "border-violet/40 text-violet",
        tone === "cyan" && "border-cyan/40 text-cyan",
        tone === "ok" && "border-ok/40 text-ok",
        tone === "warn" && "border-warn/40 text-warn",
        tone === "bad" && "border-bad/40 text-bad",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SourceBadge({ source }: { source: DataSource }) {
  const tone = source === "enka" ? "ok" : source === "manual" ? "default" : "cyan";
  const label = source === "enka" ? "Verified" : source === "manual" ? "Manual" : "Imported";
  return <Badge tone={tone} title={SOURCE_LABEL[source]}>{label}</Badge>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "gold" | "cyan" | "violet" }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-black/20 p-3">
      <div className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-faint">{label}</div>
      <div className={cx("mt-1 truncate text-xl font-semibold tabular-nums", tone === "gold" && "text-gold", tone === "cyan" && "text-cyan", tone === "violet" && "text-violet")}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Progress({ value, max = 1, tone = "violet", label }: { value: number; max?: number; tone?: "violet" | "gold" | "cyan" | "ok"; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="w-full" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={cx("h-full rounded-full transition-[width] duration-500",
            tone === "violet" && "bg-gradient-to-r from-violet-500 to-fuchsia-400",
            tone === "gold" && "bg-gradient-to-r from-amber-400 to-yellow-200",
            tone === "cyan" && "bg-gradient-to-r from-cyan-400 to-teal-300",
            tone === "ok" && "bg-ok")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-10 text-center">
      <div className="font-mono text-xs uppercase tracking-[0.18em] text-faint">{title}</div>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return <div className="caret py-8 text-center font-mono text-xs uppercase tracking-[0.2em] text-muted" role="status">{label}</div>;
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <div role="alert" className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{children}</div>;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "ok" }) {
  return (
    <div className={cx("rounded-lg border px-3 py-2 text-sm",
      tone === "info" && "border-cyan/30 bg-cyan/5 text-cyan/90",
      tone === "warn" && "border-warn/40 bg-warn/10 text-warn",
      tone === "ok" && "border-ok/40 bg-ok/10 text-ok")}>
      {children}
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1 text-xs text-muted [&>input]:w-full [&>select]:w-full [&>textarea]:w-full", className)}>
      <span className="font-mono uppercase tracking-wider">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

export function NumberInput({ value, onChange, min, max, step = 1, ...rest }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; "aria-label"?: string; id?: string }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={Number.isFinite(value) ? value : ""}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = e.target.value === "" ? 0 : Number(e.target.value);
        if (Number.isNaN(v)) return;
        onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)));
      }}
      {...rest}
    />
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-black/20 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition",
            value === t.id ? "bg-violet/20 text-text shadow-[inset_0_0_0_1px_rgba(167,139,250,.4)]" : "text-muted hover:text-text")}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={cx("glass-strong m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto p-0 text-text backdrop:bg-black/70 backdrop:backdrop-blur-sm", wide ? "max-w-4xl" : "max-w-lg")}
    >
      {open && (
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X size={16} /></Button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Stars({ n }: { n: number }) {
  return <span className={cx("font-mono text-xs", n >= 5 ? "text-gold" : n === 4 ? "text-[var(--purple4)]" : "text-muted")} aria-label={`${n} star`}>{"★".repeat(Math.max(0, n))}</span>;
}

export function confirmAction(message: string): boolean {
  return typeof window !== "undefined" && window.confirm(message);
}
