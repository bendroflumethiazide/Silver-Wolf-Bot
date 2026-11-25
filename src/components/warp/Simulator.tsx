"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Dices, RotateCcw, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, cx, Field, Notice, NumberInput, Panel, Stat } from "@/components/ui";
import { fill, pick, SW } from "@/lib/companion/voice";
import { getDb, newId, nowIso } from "@/lib/db";
import { characterDisplayName } from "@/lib/gamedata/types";
import { useApp } from "@/lib/store";
import { playableCharacters } from "@/lib/summary";
import { POOLS, STANDARD_5STAR_IDS, type PoolKind } from "@/lib/warp/rules";
import { createRng, INITIAL_SIM_STATE, monteCarlo, simulatePulls, type SimBanner, type SimItem, type SimPull } from "@/lib/warp/simulator";

const SIM_POOLS: PoolKind[] = ["character", "lightcone", "standard"];

export function WarpSimulator() {
  const { game, settings } = useApp();
  const [kind, setKind] = useState<PoolKind>("character");
  const [featuredId, setFeaturedId] = useState("1006");
  const [featured4, setFeatured4] = useState<string[]>(["", "", ""]);
  const [seed, setSeed] = useState(() => Math.random().toString(36).slice(2, 10));
  const [rngState, setRngState] = useState<{ seed: string; rng: () => number } | null>(null);
  const [state, setState] = useState(INITIAL_SIM_STATE);
  const [history, setHistory] = useState<SimPull[]>([]);
  const [last, setLast] = useState<SimPull[]>([]);
  const [custom, setCustom] = useState(50);
  const [skip, setSkip] = useState(settings.reducedMotion);
  const [mcCopies, setMcCopies] = useState(1);
  const [mcBudget, setMcBudget] = useState(180);
  const [mcResult, setMcResult] = useState<ReturnType<typeof monteCarlo> | null>(null);
  const [saved, setSaved] = useState(false);

  const pools = useMemo(() => {
    const chars = playableCharacters(game);
    const lcs = game ? Object.values(game.lightCones) : [];
    const it = (id: string, name: string): SimItem => ({ id, name });
    const std5c = chars.filter((c) => STANDARD_5STAR_IDS.has(c.id)).map((c) => it(c.id, characterDisplayName(c)));
    const std5l = lcs.filter((l) => STANDARD_5STAR_IDS.has(l.id)).map((l) => it(l.id, l.name));
    const four = [...chars.filter((c) => c.rarity === 4 && Number(c.id) < 8000).map((c) => it(c.id, characterDisplayName(c))), ...lcs.filter((l) => l.rarity === 4).map((l) => it(l.id, l.name))];
    const limited5c = chars.filter((c) => c.rarity === 5 && !STANDARD_5STAR_IDS.has(c.id) && Number(c.id) < 8000);
    const limited5l = lcs.filter((l) => l.rarity === 5 && !STANDARD_5STAR_IDS.has(l.id));
    return { std5c, std5l, four, limited5c, limited5l };
  }, [game]);

  const options = useMemo(
    () => (kind === "lightcone" ? pools.limited5l.map((l) => ({ id: l.id, name: l.name })) : pools.limited5c.map((c) => ({ id: c.id, name: characterDisplayName(c) }))),
    [kind, pools],
  );

  const banner: SimBanner = useMemo(() => {
    const f = options.find((x) => x.id === featuredId) ?? options[0];
    return {
      kind,
      featured5: kind === "standard" || !f ? [] : [f],
      offBanner5: kind === "lightcone" ? pools.std5l : kind === "standard" ? [...pools.std5c, ...pools.std5l] : pools.std5c,
      featured4: pools.four.filter((x) => featured4.includes(x.id!)),
      offBanner4: pools.four.filter((x) => !featured4.includes(x.id!)),
    };
  }, [kind, featuredId, pools, options, featured4]);

  const reset = (newSeed = seed) => { setRngState({ seed: newSeed, rng: createRng(newSeed) }); setState(INITIAL_SIM_STATE); setHistory([]); setLast([]); setSaved(false); };
  const pull = (n: number) => {
    const r = rngState && rngState.seed === seed ? rngState : { seed, rng: createRng(seed) };
    if (r !== rngState) setRngState(r);
    const out = simulatePulls(banner, state, r.rng, n, history.length);
    setState(out.state);
    setHistory((h) => [...h, ...out.pulls]);
    setLast(out.pulls);
    setSaved(false);
  };

  const fives = history.filter((p) => p.rarity === 5);
  const lastFive = [...last].reverse().find((p) => p.rarity === 5);
  const comment = !history.length
    ? { mood: "smug" as const, line: pick(SW.simIntro, `sim-${seed}`), facts: ["Simulation only. Never uses real currency or touches the game.", `Seed "${seed}". Same seed + same actions = same results.`] }
    : lastFive
      ? { mood: "hyped" as const, line: fill(pick(SW.simFive, `five-${history.length}`), { name: lastFive.item.name, pity: lastFive.pityAt }), facts: [`Simulated 5★ at pity ${lastFive.pityAt}${lastFive.featured ? " (featured)" : " (off-banner)"}.`] }
      : { mood: "bored" as const, line: fill(pick(SW.simDry, `dry-${history.length}`), { count: last.length }), facts: [`${history.length} simulated pulls, pity now ${state.pity5}.`] };

  const save = async () => {
    await getDb().simSessions.put({ id: newId("sim"), name: `${POOLS[kind].label} · ${new Date().toLocaleString()}`, pool: kind, seed, createdAt: nowIso(), state, pulls: history, jadeSpent: history.length * 160 });
    setSaved(true);
  };

  return (
    <div className="space-y-5">
      <Notice tone="warn">SIMULATION — fictional pulls with fictional currency. Results here are never mixed with your real Warp history.</Notice>
      <WolfComment comment={comment} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
        <Panel title="Banner">
          <div className="grid gap-3">
            <Field label="Warp type"><select value={kind} onChange={(e) => { setKind(e.target.value as PoolKind); reset(); }}>{SIM_POOLS.map((k) => <option key={k} value={k}>{POOLS[k].label}</option>)}</select></Field>
            {kind !== "standard" && (
              <Field label="Featured 5★">
                <select value={featuredId} onChange={(e) => setFeaturedId(e.target.value)} disabled={!options.length}>
                  {!options.length && <option>Download game data for item names</option>}
                  {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Field>
            )}
            {kind !== "standard" && (
              <Field label="Featured 4★ (optional)" hint="Unset slots show as “Featured 4★”.">
                <div className="grid gap-1.5">
                  {featured4.map((v, i) => (
                    <select key={i} aria-label={`Featured 4★ ${i + 1}`} value={v} onChange={(e) => setFeatured4(featured4.map((x, j) => (j === i ? e.target.value : x)))}>
                      <option value="">—</option>
                      {pools.four.filter((x) => (kind === "lightcone") === x.id!.startsWith("2")).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  ))}
                </div>
              </Field>
            )}
            <Field label="Seed" hint="Change the seed for a different run."><input value={seed} onChange={(e) => { setSeed(e.target.value); reset(e.target.value); }} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} /> Skip animations</label>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => pull(1)}><Dices size={15} /> ×1</Button>
              <Button variant="primary" onClick={() => pull(10)}><Dices size={15} /> ×10</Button>
              <div className="w-24"><NumberInput min={1} max={2000} value={custom} onChange={setCustom} aria-label="Custom pull count" /></div>
              <Button onClick={() => pull(Math.max(1, Math.min(2000, custom)))}>×{custom}</Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => reset()}><RotateCcw size={14} /> Reset</Button>
              <Button size="sm" variant="ghost" onClick={save} disabled={!history.length || saved}><Save size={14} /> {saved ? "Saved" : "Save session"}</Button>
            </div>
          </div>
        </Panel>
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Simulated pulls" value={history.length} />
            <Stat label="Simulated Jade" value={(history.length * 160).toLocaleString()} hint="not real" />
            <Stat label="Pity" value={`${state.pity5}/${POOLS[kind].five.hard}`} hint={state.guaranteed5 ? "guaranteed" : undefined} tone="violet" />
            <Stat label="5★ obtained" value={fives.length} tone="gold" hint={fives.length ? `${fives.filter((f) => f.featured).length} featured` : undefined} />
          </div>
          <Panel title={last.length ? `Last ${last.length > 10 ? "batch (5★/4★ shown)" : "pull(s)"}` : "Results"}>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              <AnimatePresence mode="popLayout">
                {(last.length > 10 ? last.filter((p) => p.rarity >= 4).slice(-20) : last).map((p, i) => (
                  <motion.div
                    key={`${p.index}`}
                    initial={skip ? false : { rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    transition={{ delay: skip ? 0 : i * 0.08, duration: 0.3 }}
                    className={cx("flex aspect-[3/4] flex-col items-center justify-end rounded-lg border p-1 text-center",
                      p.rarity === 5 ? "border-gold bg-gradient-to-b from-amber-500/30 to-transparent shadow-[0_0_18px_rgba(233,196,106,.45)]" : p.rarity === 4 ? "border-[var(--purple4)] bg-gradient-to-b from-violet-500/25 to-transparent" : "border-line bg-white/5")}
                    title={`${p.item.name} · pull #${p.index + 1}`}
                  >
                    <span className="line-clamp-2 text-[9px] leading-tight">{p.item.name}</span>
                    <span className={cx("text-[9px]", p.rarity === 5 ? "text-gold" : p.rarity === 4 ? "text-[var(--purple4)]" : "text-faint")}>{"★".repeat(p.rarity)}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {!last.length && <p className="text-sm text-muted">Pull to start. Uses published rates and the documented soft-pity model.</p>}
          </Panel>
          {fives.length > 0 && (
            <Panel title="Simulated 5★ log">
              <ul className="flex flex-wrap gap-1.5">{fives.map((f) => <li key={f.index}><Badge tone={f.featured ? "gold" : "bad"}>{f.item.name} · {f.pityAt}</Badge></li>)}</ul>
            </Panel>
          )}
        </div>
      </div>
      <Panel title="Monte Carlo analysis">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Featured copies"><NumberInput min={1} max={7} value={mcCopies} onChange={setMcCopies} /></Field>
          <Field label="Pull budget"><NumberInput min={1} max={1500} value={mcBudget} onChange={setMcBudget} /></Field>
          <Button onClick={() => setMcResult(monteCarlo(kind, { pity: 0, guaranteed: false }, mcCopies, mcBudget, 10000, `mc-${seed}`))}>Run 10,000 sessions</Button>
        </div>
        {mcResult && (
          <div className="mt-4">
            <p className="mb-2 text-sm text-muted">Success within {mcBudget} pulls from pity 0: <span className="font-mono text-text">{(mcResult.successRate * 100).toFixed(2)}%</span> · mean pulls when successful <span className="font-mono text-text">{mcResult.meanPullsWhenSuccessful.toFixed(1)}</span></p>
            <div className="h-48">
              <ResponsiveContainer>
                <BarChart data={bucket(mcResult.histogram, 10)}>
                  <CartesianGrid stroke="rgba(167,139,250,.1)" vertical={false} />
                  <XAxis dataKey="range" tick={{ fill: "#9b98b8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#9b98b8", fontSize: 10 }} width={36} />
                  <Tooltip contentStyle={{ background: "#0b0a18", border: "1px solid rgba(167,139,250,.3)", borderRadius: 8 }} />
                  <Bar dataKey="sessions" fill="#5ee6f0" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function bucket(h: number[], size: number) {
  const out: { range: string; sessions: number }[] = [];
  for (let i = 1; i < h.length; i += size) out.push({ range: `${i}`, sessions: h.slice(i, i + size).reduce((a, b) => a + b, 0) });
  return out;
}
