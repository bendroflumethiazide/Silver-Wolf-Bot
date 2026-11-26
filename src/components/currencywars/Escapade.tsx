"use client";

import { Coffee, ExternalLink, Library, PawPrint, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { kvGet, kvSet } from "@/lib/db";
import { ESCAPADE_ASSUMED } from "@/lib/currencywars/escapade";
import type { RunState } from "@/lib/currencywars/run";
import { COMPANIONS, companionOf, variantOf, type CompanionCategory } from "@/lib/currencywars/voyageCompanions";
import { Badge, Button, cx, Panel } from "../ui";
import { useSimple } from "./simple";

const WIKI = "https://honkai-star-rail.fandom.com/wiki/Currency_Wars:_Voyage_Into_the_Canvas/Voyage_Companion";
const CATEGORY: Record<CompanionCategory, { label: string; tone: "cyan" | "gold" | "violet" }> = { equipment: { label: "Equipment", tone: "violet" }, resource: { label: "Resource", tone: "gold" }, node: { label: "Node", tone: "cyan" } };

/** Collection kept across runs: which companions, effects and Plot Armor you've met. */
export const COLLECTION_KEY = "cwCollection";
export interface CwCollection { companions: Record<string, string[]>; variants: Record<string, string[]>; plotArmor: Record<string, string[]>; protagonists: Record<string, string[]> }
const emptyCollection = (): CwCollection => ({ companions: {}, variants: {}, plotArmor: {}, protagonists: {} });

/** Add this run to the collection (idempotent: each run counts once per entry). */
export function mergeCollection(c: CwCollection, run: RunState): CwCollection {
  const id = `${run.seed}|${run.rank}`;
  const add = (map: Record<string, string[]>, key: string) => (map[key]?.includes(id) ? map : { ...map, [key]: [...(map[key] ?? []), id].slice(-200) });
  let out = c;
  if (run.escapade?.revealed) out = { ...out, companions: add(out.companions, run.escapade.companion), variants: add(out.variants, run.escapade.variant) };
  for (const h of run.plotArmor?.holders ?? []) out = { ...out, plotArmor: add(out.plotArmor, h.option), protagonists: add(out.protagonists, h.name) };
  return out;
}

export function useCollection(run: RunState | null | undefined) {
  const [c, setC] = useState<CwCollection | null>(null);
  useEffect(() => { let live = true; void kvGet<CwCollection>(COLLECTION_KEY, emptyCollection()).then((x) => { if (live) setC({ ...emptyCollection(), ...x }); }); return () => { live = false; }; }, []);
  useEffect(() => {
    if (!c || !run) return;
    const next = mergeCollection(c, run);
    if (next !== c) { setC(next); void kvSet(COLLECTION_KEY, next); }
  }, [c, run]);
  return c;
}

function Assumed({ text }: { text: string }) {
  return useSimple() ? null : <p className="text-xs text-faint">Simulator: {text}</p>;
}

function CompanionFace({ name, size = 64, className }: { name: string; size?: number; className?: string }) {
  const c = companionOf(name);
  return (
    <span aria-hidden className={cx("inline-flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br to-transparent ring-1 ring-white/20", c?.color, className)} style={{ width: size, height: size, fontSize: size * 0.55 }}>
      {c?.emoji ?? "✦"}
    </span>
  );
}

/** The run-start reveal: the card flips in once; dismissing it is saved with the run. */
export function CompanionReveal({ run, onDone }: { run: RunState; onDone: () => void }) {
  const e = run.escapade!;
  const v = variantOf(e.variant);
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 900); return () => clearTimeout(t); }, []);
  return (
    <div role="dialog" aria-modal="true" aria-label="Your Voyage Companion" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="cw-reveal relative w-full max-w-sm overflow-hidden rounded-2xl border border-amber-300/50 bg-[var(--night)] p-5 text-center shadow-[0_0_60px_rgba(251,191,36,0.25)]">
        <span className="cw-reveal-rays pointer-events-none absolute inset-0" aria-hidden />
        <p className="relative text-[11px] uppercase tracking-[0.2em] text-amber-200">Escapade · Voyage Companion</p>
        <div className="relative my-4 flex justify-center"><CompanionFace name={e.companion} size={96} className="cw-reveal-face" /></div>
        <h2 className="relative text-xl font-semibold">{e.companion}</h2>
        {v && (
          <div className={cx("relative mt-3 space-y-2 text-left text-sm transition-opacity duration-500", shown ? "opacity-100" : "opacity-0")}>
            <p className="flex flex-wrap items-center gap-1.5"><Badge tone={CATEGORY[v.category].tone}>{CATEGORY[v.category].label}</Badge><span className="text-xs text-muted">{v.title}</span></p>
            <p>{v.text}</p>
            {v.assumed && <Assumed text={v.assumed} />}
            <p className="text-xs text-muted">Applied automatically. {v.teaBreak ? `Look for Backstage Tea Break before the Plane ${v.teaBreak.map((p) => p + 1).join("/")} boss.` : ""}</p>
          </div>
        )}
        <Button variant="primary" className="relative mt-4 w-full" onClick={onDone} disabled={!shown}>Let&apos;s go</Button>
      </div>
    </div>
  );
}

/** The companion's card in the run (effect, Tea Break plan, history). */
export function CompanionCard({ run }: { run: RunState }) {
  const e = run.escapade;
  if (!e) return null;
  const v = variantOf(e.variant);
  return (
    <Panel title={<span className="flex items-center gap-2"><PawPrint size={15} className="text-amber-300" /> Voyage Companion</span>}>
      <div className="flex gap-3 text-xs">
        <CompanionFace name={e.companion} size={48} />
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-1.5"><b className="text-sm text-text">{e.companion}</b>{v && <Badge tone={CATEGORY[v.category].tone}>{CATEGORY[v.category].label}</Badge>}</p>
          {v && <p className="text-muted">{v.text}</p>}
          {v?.assumed && <Assumed text={v.assumed} />}
          {v?.teaBreak && <p className="flex items-center gap-1 text-cyan"><Coffee size={12} /> Tea Break: Plane {v.teaBreak.map((p) => `${p + 1}${e.done.includes(p) ? " ✓" : ""}`).join(", ")}</p>}
          {e.saveFrom !== undefined && <p className="text-muted">Protects from Plane {e.saveFrom + 1}{e.savesUsed?.length ? " (used)" : ""}.</p>}
          {e.variant === "wd-each" && <p className="text-muted">Saves used: Plane {(e.savesUsed ?? []).map((p) => p + 1).join(", ") || "none yet"}.</p>}
          {e.singularity !== undefined && <p className="text-muted">Imploding Singularity: {e.singularity}/{ESCAPADE_ASSUMED.singularity.max} stacks.</p>}
          {e.photo && e.photo.length > 0 && <p className="text-muted">Photo copies still to come: {e.photo.join(", ")}.</p>}
          {(e.assignments ?? []).map((a) => <p key={a.name} className="rounded border border-line px-1.5 py-1"><b className="text-text">Assignment: {a.name}</b> · {a.text} <span className="text-amber-200">Reward: {a.reward}</span></p>)}
          {(e.completed ?? []).length > 0 && <p className="text-ok">Completed: {e.completed!.join(", ")}</p>}
          {e.history.length > 0 && (
            <details><summary className="cursor-pointer text-muted">History ({e.history.length})</summary>
              <ol className="mt-1 space-y-0.5 text-muted">{e.history.map((h, i) => <li key={i}>{h.text}</li>)}</ol>
            </details>
          )}
        </div>
      </div>
    </Panel>
  );
}

/** Backstage Tea Break / Pearliefin's Treasury: choose an option. */
export function TeaBreakPanel({ run, onPick }: { run: RunState; onPick: (i: number) => void }) {
  const tb = run.offers.teaBreak;
  const e = run.escapade;
  if (!tb || !e) return null;
  return (
    <Panel title={<span className="flex items-center gap-2">{tb.kind === "treasury" ? <Library size={16} className="text-cyan" /> : <Coffee size={16} className="text-amber-300" />}{tb.kind === "treasury" ? "Pearliefin's Treasury" : "Backstage Tea Break"}</span>}>
      <p className="mb-3 flex items-center gap-2 text-sm text-muted"><CompanionFace name={e.companion} size={32} /> {tb.kind === "treasury" ? "Pearliefin opened their art collection. Take one piece." : `${e.companion} is waiting backstage. Choose a Companion Occurrence (this node has no fight).`}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {tb.options.map((o, i) => (
          <button key={o.id} type="button" onClick={() => onPick(i)} className="rounded-xl border border-amber-300/40 bg-gradient-to-b from-amber-300/10 to-transparent p-4 text-left hover:border-amber-300">
            <b className="block">{o.name}</b><span className="mt-1 block text-xs text-muted">{o.text}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

/** Every companion and effect, with how often you've met them (across runs). */
export function CompanionCollection({ collection }: { collection: CwCollection | null }) {
  const met = (name: string) => collection?.companions[name]?.length ?? 0;
  const total = COMPANIONS.filter((c) => met(c.name) > 0).length;
  const plot = Object.keys(collection?.plotArmor ?? {}).length;
  return (
    <Panel title={<span className="flex items-center gap-2"><Sparkles size={15} className="text-amber-300" /> Escapade collection</span>} actions={<a href={WIKI} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-cyan hover:underline">Artwork on the wiki <ExternalLink size={11} /></a>}>
      <p className="mb-2 text-xs text-muted">Companions met {total}/{COMPANIONS.length} · Plot Armor collected {plot} · protagonists {Object.keys(collection?.protagonists ?? {}).length} (the game rewards 3/6/…/18 companions and 5/10/…/60 Plot Armor).</p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {COMPANIONS.map((c) => {
          const n = met(c.name);
          return (
            <li key={c.name} className={cx("rounded-lg border p-2 text-xs", n ? "border-amber-300/40" : "border-line opacity-60")}>
              <span className="flex items-center gap-2"><CompanionFace name={c.name} size={28} className={n ? "" : "grayscale"} /><b className="min-w-0 truncate">{c.name}</b></span>
              <span className="mt-1 block text-faint">{n ? `Met ${n}×` : "Not met yet"} · {c.variants.filter((v) => collection?.variants[v.id]?.length).length}/{c.variants.length} effects</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
