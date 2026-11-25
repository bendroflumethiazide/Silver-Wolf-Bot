"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { WolfComment } from "@/components/SilverWolf";
import { Button, ErrorBox, Field, NumberInput, Panel, Stat } from "@/components/ui";
import { plannerComment } from "@/lib/companion/comments";
import { getDb } from "@/lib/db";
import { useOffsets, useProfile } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import { DEFAULT_OFFSET, summarizePool } from "@/lib/warp/history";
import { planWarps } from "@/lib/warp/planner";
import { targetDistribution } from "@/lib/warp/probability";
import { POOLS, type PoolKind } from "@/lib/warp/rules";
import { monteCarlo, type MonteCarloResult } from "@/lib/warp/simulator";

const PLANNABLE: PoolKind[] = ["character", "lightcone", "standard", "collab-character", "collab-lightcone"];

export function WarpPlanner() {
  const { profileId } = useApp();
  const profile = useProfile();
  const offsets = useOffsets(profileId);
  const [pool, setPool] = useState<PoolKind>("character");
  const [jade, setJade] = useState(0);
  const [passes, setPasses] = useState(0);
  const [starlight, setStarlight] = useState(0);
  const [futureJade, setFutureJade] = useState(0);
  const [futurePasses, setFuturePasses] = useState(0);
  const [pity, setPity] = useState(0);
  const [guaranteed, setGuaranteed] = useState(false);
  const [copies, setCopies] = useState(1);
  const [mc, setMc] = useState<MonteCarloResult | null>(null);
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
  const records = useLiveQuery(() => getDb().warps.where({ profileId, pool }).toArray(), [profileId, pool]);
  const hard = POOLS[pool].five.hard;

  useEffect(() => {
    if (!profile?.resources) return;
    const r = profile.resources;
    setJade(r.stellarJade ?? 0);
    setPasses(pool === "standard" ? r.starRailPasses ?? 0 : r.specialPasses ?? 0);
    setStarlight(r.undyingStarlight ?? 0);
  }, [profile?.id, pool]); // eslint-disable-line react-hooks/exhaustive-deps

  const useHistory = () => {
    if (!records) return;
    const s = summarizePool(pool, records, offsets[pool] ?? DEFAULT_OFFSET);
    setPity(s.pity5);
    setGuaranteed(s.guaranteed5);
    setLoadedFrom(`${s.total} recorded pulls${s.historyComplete ? "" : " (history may be incomplete)"}`);
  };

  const result = useMemo(() => {
    try {
      return { ok: planWarps({ pool, stellarJade: jade, passes, undyingStarlight: starlight, expectedFutureJade: futureJade, expectedFuturePasses: futurePasses, state: { pity: Math.min(pity, hard - 1), guaranteed }, copies }) };
    } catch (e) { return { err: e instanceof Error ? e.message : String(e) }; }
  }, [pool, jade, passes, starlight, futureJade, futurePasses, pity, guaranteed, copies, hard]);

  const chart = useMemo(() => {
    if (!result.ok) return [];
    const d = targetDistribution(pool, { pity: Math.min(pity, hard - 1), guaranteed }, copies);
    const step = Math.max(1, Math.floor(d.cdf.length / 120));
    return d.cdf.map((p, n) => ({ n, p: +(p * 100).toFixed(2) })).filter((x) => x.n % step === 0 || x.n === d.cdf.length - 1);
  }, [result.ok, pool, pity, guaranteed, copies, hard]);

  useEffect(() => setMc(null), [pool, pity, guaranteed, copies, jade, passes, starlight, futureJade, futurePasses]);

  const label = copies === 1 ? "1 copy" : `${copies} copies`;
  const isChar = pool.includes("character") || pool === "standard";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Panel title="Inputs">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target banner" className="col-span-2">
              <select value={pool} onChange={(e) => setPool(e.target.value as PoolKind)}>{PLANNABLE.map((k) => <option key={k} value={k}>{POOLS[k].label}</option>)}</select>
            </Field>
            <Field label="Stellar Jade"><NumberInput min={0} value={jade} onChange={setJade} /></Field>
            <Field label={pool === "standard" ? "Star Rail Passes" : "Special Passes"}><NumberInput min={0} value={passes} onChange={setPasses} /></Field>
            <Field label="Undying Starlight"><NumberInput min={0} value={starlight} onChange={setStarlight} /></Field>
            <Field label={isChar ? "Copies wanted" : "Copies (S-level)"} hint={isChar ? "1 = E0, 2 = E1…" : "1 = S1, 2 = S2…"}><NumberInput min={1} max={7} value={copies} onChange={setCopies} /></Field>
            <Field label="Future Jade (estimate)"><NumberInput min={0} value={futureJade} onChange={setFutureJade} /></Field>
            <Field label="Future passes (estimate)"><NumberInput min={0} value={futurePasses} onChange={setFuturePasses} /></Field>
            <Field label={`Current pity (0–${hard - 1})`}><NumberInput min={0} max={hard - 1} value={pity} onChange={setPity} /></Field>
            <label className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={guaranteed} disabled={POOLS[pool].fiveFeaturedChance === null} onChange={(e) => setGuaranteed(e.target.checked)} /> Guaranteed</label>
          </div>
          <Button size="sm" className="mt-3" onClick={useHistory} disabled={!records?.length}>Use pity from my Warp history</Button>
          {loadedFrom && <p className="mt-1 text-[11px] text-muted">Loaded from {loadedFrom}.</p>}
          <p className="mt-2 text-[11px] text-faint">Jade, passes and Starlight are prefilled from the Resources widget on the Express Terminal.</p>
        </Panel>
        <div className="min-w-0 space-y-4">
          {result.err && <ErrorBox>{result.err}</ErrorBox>}
          {result.ok && (
            <>
              <WolfComment comment={plannerComment(result.ok, pool)} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="Pulls available" value={result.ok.totalPulls} hint={`${result.ok.currentPulls} now + ${result.ok.futurePulls} future`} tone="gold" />
                <Stat label={`P(${label})`} value={`${(result.ok.probability * 100).toFixed(1)}%`} tone="cyan" hint="exact calculation" />
                <Stat label="Expected pulls" value={result.ok.expectedPulls.toFixed(1)} hint={`median ${result.ok.median} · 90% ${result.ok.p90}`} />
                <Stat label="Worst case" value={result.ok.worstCase} hint="every rate-up lost at hard pity" />
                <Stat label="Short of certainty" value={result.ok.shortfallForCertainty} hint={`${result.ok.jadeShortfallForCertainty.toLocaleString()} Jade`} />
                <Stat label="Guarantee feasible" value={result.ok.shortfallForCertainty === 0 ? "Yes" : "No"} tone={result.ok.shortfallForCertainty === 0 ? "cyan" : undefined} />
              </div>
              <Panel title="Probability vs. pulls">
                <div className="h-56">
                  <ResponsiveContainer>
                    <AreaChart data={chart}>
                      <defs><linearGradient id="cdf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.6} /><stop offset="100%" stopColor="#a78bfa" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid stroke="rgba(167,139,250,.1)" />
                      <XAxis dataKey="n" tick={{ fill: "#9b98b8", fontSize: 10 }} />
                      <YAxis unit="%" domain={[0, 100]} tick={{ fill: "#9b98b8", fontSize: 10 }} width={36} />
                      <Tooltip formatter={(v) => [`${v}%`, "P(success)"]} labelFormatter={(n) => `${n} pulls`} contentStyle={{ background: "#0b0a18", border: "1px solid rgba(167,139,250,.3)", borderRadius: 8 }} />
                      <Area type="stepAfter" dataKey="p" stroke="#a78bfa" fill="url(#cdf)" />
                      <ReferenceLine x={Math.min(result.ok.totalPulls, chart.at(-1)?.n ?? 0)} stroke="#5ee6f0" strokeDasharray="4 4" label={{ value: "you", fill: "#5ee6f0", fontSize: 10, position: "top" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
              <Panel title="Cross-check (Monte Carlo)" actions={<Button size="sm" onClick={() => setMc(monteCarlo(pool, { pity: Math.min(pity, hard - 1), guaranteed }, copies, Math.max(1, result.ok!.totalPulls), 20000, `${pool}-${pity}-${copies}-${result.ok!.totalPulls}`))}>Run 20,000 sessions</Button>}>
                {mc ? (
                  <p className="text-sm text-muted">Simulated success rate: <span className="font-mono text-text">{(mc.successRate * 100).toFixed(2)}% ± {(mc.standardError * 196).toFixed(2)}%</span> (95% CI) vs exact <span className="font-mono text-text">{(result.ok.probability * 100).toFixed(2)}%</span>. Seeded, so it is reproducible.</p>
                ) : <p className="text-sm text-muted">Runs a seeded simulation of the same rules to confirm the exact result.</p>}
              </Panel>
              <Panel title="Assumptions">
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted">{result.ok.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
