"use client";

import { Coffee, Crown, Dices, RotateCcw, Skull, Sparkles, Swords } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { stripMarkup } from "@/lib/gamedata/types";
import { useApp } from "@/lib/store";
import {
  advance, ASSUMPTIONS, blessingOffer, classicBlessings, domainChoices, enhance, hasResonance, newRun, pathCount, randomCurio, randomOccurrence,
  summarize, SU_PATHS, takeBlessing, type DomainKind, type RunState, type SuBlessing, type SuPath,
} from "@/lib/universe/sim";
import { createRng } from "@/lib/warp/simulator";
import { GameImage } from "../GameImage";
import { WolfComment } from "../SilverWolf";
import { Badge, Button, cx, Notice, Panel, Progress } from "../ui";

const PATH_KEY: Partial<Record<SuPath, string>> = { Preservation: "Knight", Remembrance: "Memory", Nihility: "Warlock", Abundance: "Priest", "The Hunt": "Rogue", Destruction: "Warrior", Elation: "Elation", Erudition: "Mage" };
const DOMAIN_ICON: Record<DomainKind, ReactNode> = { Combat: <Swords size={18} />, Elite: <Skull size={18} />, Occurrence: <Sparkles size={18} />, Respite: <Coffee size={18} />, Boss: <Crown size={18} /> };
const DOMAIN_HINT: Record<DomainKind, string> = { Combat: "Fight → pick a blessing", Elite: "Tougher fight → better blessing + a curio", Occurrence: "Random event → blessing or curio", Respite: "Enhance a blessing", Boss: "Final fight" };

type Phase =
  | { kind: "path" }
  | { kind: "domain"; options: DomainKind[] }
  | { kind: "blessing"; offer: SuBlessing[]; from: DomainKind; curio?: string }
  | { kind: "respite" }
  | { kind: "done" };

function PathIcon({ path, size = 40 }: { path: SuPath; size?: number }) {
  const game = useApp((s) => s.game);
  const key = PATH_KEY[path];
  const icon = key ? game?.paths[key]?.icon : undefined;
  return <span style={{ width: size, height: size }} className="inline-flex shrink-0 items-center justify-center">{icon ? <GameImage path={icon} alt={path} className="h-full w-full object-contain" rounded="rounded-none" /> : <Sparkles size={size * 0.7} className="text-violet" />}</span>;
}

const Stars = ({ n }: { n: number }) => <span className={cx("text-xs", n === 3 ? "text-gold" : n === 2 ? "text-[var(--purple4)]" : "text-sky-300")}>{"★".repeat(n)}</span>;

export function RunSimulator() {
  const game = useApp((s) => s.game);
  const data = useMemo(() => (game ? classicBlessings(game.blessings) : null), [game]);
  const [seed, setSeed] = useState(() => Math.random().toString(36).slice(2, 8));
  const rng = useRef<() => number>(createRng(seed));
  const [run, setRun] = useState<RunState | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "path" });
  const [event, setEvent] = useState<{ name: string; image?: string } | null>(null);
  if (!game || !data) return null;

  const r = () => rng.current();
  const restart = (newSeed?: string) => { const s = newSeed ?? seed; rng.current = createRng(s); setRun(null); setEvent(null); setPhase({ kind: "path" }); };
  const toDomain = (st: RunState) => (st.domain >= ASSUMPTIONS.domains ? setPhase({ kind: "done" }) : setPhase({ kind: "domain", options: domainChoices(st, r) }));
  const start = (p: SuPath) => { const st = newRun(p); setRun(st); toDomain(st); };
  const enter = (k: DomainKind) => {
    if (!run) return;
    setEvent(null);
    if (k === "Boss") { const st = advance(run, "Defeated the Boss. Run complete!"); setRun({ ...st, finished: true }); setPhase({ kind: "done" }); return; }
    if (k === "Respite") { setPhase({ kind: "respite" }); return; }
    if (k === "Occurrence") {
      const ev = randomOccurrence(game, r);
      setEvent(ev ? { name: ev.name, image: ev.image } : null);
      if (r() < 0.5) { const c = randomCurio(game, r); const st = advance({ ...run, curios: [...run.curios, c.name], occurrences: [...run.occurrences, ev?.name ?? "?"] }, `Occurrence “${ev?.name}”: found the curio ${c.name}.`); setRun(st); toDomain(st); return; }
      setRun({ ...run, occurrences: [...run.occurrences, ev?.name ?? "?"] });
      setPhase({ kind: "blessing", offer: blessingOffer(data.pool, run, r), from: k });
      return;
    }
    const curio = k === "Elite" ? randomCurio(game, r)?.name : undefined;
    setPhase({ kind: "blessing", offer: blessingOffer(data.pool, run, r, k === "Elite"), from: k, curio });
  };
  const pick = (b: SuBlessing | null) => {
    if (!run || phase.kind !== "blessing") return;
    let st = b ? takeBlessing(run, b) : run;
    if (phase.curio) st = { ...st, curios: [...st.curios, phase.curio], log: [...st.log, `Elite dropped the curio ${phase.curio}.`] };
    st = advance(st, `Cleared domain ${run.domain + 1} (${phase.from}).`);
    setRun(st); toDomain(st);
  };
  const rest = (id: string | null) => { if (!run) return; let st = id ? enhance(run, id) : run; st = advance(st, `Cleared domain ${run.domain + 1} (Respite).`); setRun(st); toDomain(st); };

  const sum = run ? summarize(run) : null;
  const resonance = run && hasResonance(run) ? data.resonance[run.path] : undefined;
  const wolf = !run ? { mood: "smug" as const, line: "Pick a Path|I'll keep the RNG honest|Seeded, so u can replay it", facts: [] }
    : phase.kind === "done" ? { mood: "hyped" as const, line: `GG|${run.blessings.length} blessings, ${Math.round((sum?.focus ?? 0) * 100)}% on ${run.path}|${(sum?.focus ?? 0) >= 0.5 ? "Focused build. Nice" : "Kinda all over the place tho"}`, facts: [] }
    : { mood: "neutral" as const, line: `Domain ${run.domain + 1}/${ASSUMPTIONS.domains}|${pathCount(run)} ${run.path} blessing${pathCount(run) === 1 ? "" : "s"}${resonance ? " · Resonance on" : `, Resonance at ${ASSUMPTIONS.resonanceAt}`}`, facts: [] };

  return (
    <div className="space-y-4">
      <WolfComment comment={wolf} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <Panel title={!run ? "Choose your Path" : phase.kind === "done" ? "Run complete" : `Domain ${run.domain + 1} of ${ASSUMPTIONS.domains}`}
          actions={run && <Button size="sm" variant="ghost" onClick={() => restart()}><RotateCcw size={14} /> Restart</Button>}>
          {run && <div className="mb-4"><Progress value={run.domain} max={ASSUMPTIONS.domains} tone="cyan" label="Run progress" /></div>}

          {phase.kind === "path" && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SU_PATHS.map((p) => (
                <button key={p} onClick={() => start(p)} className="flex items-center gap-3 rounded-xl border border-line p-3 text-left hover:border-cyan/50 hover:bg-white/[0.04]">
                  <PathIcon path={p} /><span className="font-medium">{p}</span>
                </button>
              ))}
            </div>
          )}

          {phase.kind === "domain" && (
            <div className="space-y-3">
              {event && (
                <div className="flex items-center gap-3 rounded-xl border border-violet/40 p-2">
                  {event.image && <GameImage path={event.image} alt={event.name} className="h-16 w-28 object-cover" rounded="rounded-lg" />}
                  <div className="text-sm"><div className="text-xs text-faint">Occurrence</div>{event.name}</div>
                </div>
              )}
              <p className="text-sm text-muted">Where next?</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {phase.options.map((k) => (
                  <button key={k} onClick={() => enter(k)} className="flex flex-col items-start gap-1 rounded-xl border border-line p-3 text-left hover:border-cyan/50 hover:bg-white/[0.04]">
                    <span className="flex items-center gap-2 font-medium text-text">{DOMAIN_ICON[k]} {k}</span>
                    <span className="text-xs text-muted">{DOMAIN_HINT[k]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase.kind === "blessing" && (
            <div className="space-y-3">
              {event && <div className="flex items-center gap-3 text-sm">{event.image && <GameImage path={event.image} alt={event.name} className="h-12 w-20 object-cover" rounded="rounded-md" />}<span><span className="text-faint">Occurrence: </span>{event.name}</span></div>}
              <p className="text-sm text-muted">Choose a blessing{phase.curio ? ` (the Elite also drops the curio ${phase.curio})` : ""}:</p>
              <div className="grid gap-2 md:grid-cols-3">
                {phase.offer.map((b) => (
                  <button key={b.id} onClick={() => pick(b)} className={cx("flex flex-col gap-1.5 rounded-xl border p-3 text-left transition hover:bg-white/[0.04]", b.rarity === 3 ? "border-gold/60" : b.rarity === 2 ? "border-[var(--purple4)]/60" : "border-line", "hover:border-cyan/60")}>
                    <span className="flex items-center gap-2"><PathIcon path={b.path} size={22} /><Stars n={b.rarity} />{b.path === run?.path && <Badge tone="cyan">your Path</Badge>}</span>
                    <span className="font-medium leading-tight">{b.name}</span>
                    <span className="text-xs text-muted">{stripMarkup(b.desc)}</span>
                  </button>
                ))}
              </div>
              <Button size="sm" variant="ghost" onClick={() => pick(null)}>Skip</Button>
            </div>
          )}

          {phase.kind === "respite" && run && (
            <div className="space-y-2">
              <p className="text-sm text-muted">Enhance a blessing:</p>
              {!run.blessings.some((o) => !o.enhanced && o.blessing.enhancedDesc) ? <p className="text-sm text-muted">Nothing to enhance yet.</p> : (
                <div className="grid gap-2 md:grid-cols-2">
                  {run.blessings.filter((o) => !o.enhanced && o.blessing.enhancedDesc).map((o) => (
                    <button key={o.blessing.id} onClick={() => rest(o.blessing.id)} className="rounded-xl border border-line p-3 text-left hover:border-cyan/50">
                      <div className="flex items-center gap-2"><Stars n={o.blessing.rarity} /><span className="font-medium">{o.blessing.name}</span></div>
                      <div className="mt-1 text-xs text-muted">{stripMarkup(o.blessing.enhancedDesc)}</div>
                    </button>
                  ))}
                </div>
              )}
              <Button size="sm" variant="ghost" onClick={() => rest(null)}>Rest without enhancing</Button>
            </div>
          )}

          {phase.kind === "done" && run && sum && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-line p-3"><div className="text-2xl font-semibold">{run.blessings.length}</div><div className="text-xs text-muted">blessings</div></div>
                <div className="rounded-xl border border-line p-3"><div className="text-2xl font-semibold">{Math.round(sum.focus * 100)}%</div><div className="text-xs text-muted">on {run.path}</div></div>
                <div className="rounded-xl border border-line p-3"><div className="text-2xl font-semibold">{run.curios.length}</div><div className="text-xs text-muted">curios</div></div>
              </div>
              <div className="space-y-1.5">{sum.byPath.map((x) => <div key={x.path} className="flex items-center gap-2 text-sm"><PathIcon path={x.path} size={20} /><span className="w-28 shrink-0">{x.path}</span><Progress value={x.count} max={run.blessings.length} tone={x.path === run.path ? "cyan" : "violet"} label={x.path} /><span className="w-6 text-right font-mono text-xs">{x.count}</span></div>)}</div>
              <div className="flex gap-2"><Button variant="primary" onClick={() => restart()}><RotateCcw size={14} /> Same seed again</Button><Button onClick={() => { const s = Math.random().toString(36).slice(2, 8); setSeed(s); restart(s); }}><Dices size={14} /> New run</Button></div>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          {run && (
            <Panel title={`Your build · ${run.path}`}>
              {resonance ? (
                <div className="mb-3 rounded-xl border border-gold/50 bg-gold/5 p-2.5">
                  <div className="flex items-center gap-2 text-sm font-medium text-gold"><PathIcon path={run.path} size={20} /> {resonance.name}</div>
                  <div className="mt-1 text-xs text-muted">{stripMarkup(resonance.desc)}</div>
                </div>
              ) : <p className="mb-3 text-xs text-muted">Resonance unlocks at {ASSUMPTIONS.resonanceAt} {run.path} blessings ({pathCount(run)}/{ASSUMPTIONS.resonanceAt}).</p>}
              {!run.blessings.length ? <p className="text-sm text-muted">No blessings yet.</p> : (
                <ul className="space-y-1">{run.blessings.map((o) => (
                  <li key={o.blessing.id} className="flex items-center gap-2 text-sm" title={stripMarkup(o.enhanced ? o.blessing.enhancedDesc : o.blessing.desc)}>
                    <PathIcon path={o.blessing.path} size={18} /><span className="min-w-0 flex-1 truncate">{o.blessing.name}{o.enhanced && <span className="text-cyan"> +</span>}</span><Stars n={o.blessing.rarity} />
                  </li>
                ))}</ul>
              )}
              {run.curios.length > 0 && <div className="mt-3 border-t border-line pt-2 text-xs text-muted">Curios: {run.curios.join(", ")}</div>}
            </Panel>
          )}
          {run && (
            <Panel title="Log">
              <ol className="max-h-56 space-y-1 overflow-y-auto text-xs text-muted">{[...run.log].reverse().map((l, i) => <li key={i}>{l}</li>)}</ol>
            </Panel>
          )}
          <Notice>Practice sandbox built from the game&apos;s classic Simulated Universe blessings, curios and occurrences. The real offer odds aren&apos;t published, so this uses stated assumptions: each offered blessing is your Path {Math.round(ASSUMPTIONS.ownPath * 100)}% of the time; rarity ★/★★/★★★ {ASSUMPTIONS.rarity.map((x) => `${Math.round(x * 100)}%`).join("/")} ({ASSUMPTIONS.eliteRarity.map((x) => `${Math.round(x * 100)}%`).join("/")} from Elites); Resonance at {ASSUMPTIONS.resonanceAt} Path blessings; {ASSUMPTIONS.domains} domains. Path and rarity are read from each blessing&apos;s id. Seed {seed}.</Notice>
        </div>
      </div>
    </div>
  );
}
