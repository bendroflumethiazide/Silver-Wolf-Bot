"use client";

import { Sparkles } from "lucide-react";
import { AHA, ELATION_ASSUMED, ELATION_KITS, PUNCHLINE, type ElationResult } from "@/lib/currencywars/elation";
import type { CwPack } from "@/lib/currencywars/sim";
import { cx, Panel } from "../ui";
import { ItemIcon } from "./shared";
import { useSimple } from "./simple";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Elation and Aha before a fight: Aha's star, SPD and equipment, Punchline, who joins Aha Instant and in what order. */
export function ElationPanel({ pack, elation, star, items, ahaStats, onGive, giving }: {
  pack: CwPack; elation: ElationResult; star: number; items: string[];
  ahaStats: { strength: number; dmg: number; lucky: number; luckyDmg: number; spdAmp: number } | null;
  onGive?: () => void; giving?: string | null;
}) {
  const simple = useSimple();
  if (!elation.active) return null;
  const order = [...elation.participants.map((n) => ({ n, pid: ELATION_KITS[n]?.last ? 1000 : ELATION_KITS[n]?.pid ?? 0 })), ...(star ? [{ n: "Aha", pid: AHA.pid }] : [])].sort((a, b) => a.pid - b.pid);
  return (
    <Panel title={<span className="flex items-center gap-2"><Sparkles size={15} className="text-[#e8735e]" /> Elation · Aha</span>}
      actions={<span className="text-xs text-muted">Punchline at start <b className="text-text">{elation.punchlineStart}</b></span>}>
      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Aha" value={star ? `${"★".repeat(star)} (${star} slot${star === 1 ? "" : "s"})` : "not summoned"} />
          <Stat label="Aha SPD" value={String(Math.round(elation.ahaSpd))} />
          <Stat label="Aha Instants (est.)" value={String(elation.instants)} />
          <Stat label="Punchline peak (est.)" value={String(elation.punchlinePeak)} />
        </div>
        {ahaStats && (
          <p className="text-muted">Aha gives Elation characters during Elation Skills: strength +{pct(ahaStats.strength)}, DMG Amp +{pct(ahaStats.dmg)}, Lucky Strike Rate +{pct(ahaStats.lucky)}, Lucky Strike DMG +{pct(ahaStats.luckyDmg)}{ahaStats.spdAmp ? `; Aha SPD Amp +${pct(ahaStats.spdAmp)}` : ""}.</p>
        )}
        {star > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted">Aha&apos;s equipment:</span>
            {items.map((it, i) => <span key={i} className="inline-flex items-center gap-1 rounded border border-white/15 px-1.5 py-0.5" title={it}><ItemIcon pack={pack} name={it} size={12} />{it}</span>)}
            {onGive && giving && <button type="button" onClick={onGive} className="rounded border border-[#e8735e]/60 px-2 py-0.5 text-[#ffb3a5] hover:bg-[#e8735e]/15">Give {giving} to Aha</button>}
          </div>
        )}
        <div>
          <p className="mb-1 text-muted">Aha Instant order (Participant ID):</p>
          <ol className="flex flex-wrap gap-1">{order.map((o, i) => <li key={o.n} className={cx("rounded-full border px-2 py-0.5", o.n === "Aha" ? "border-[#e8735e]/60 text-[#ffb3a5]" : "border-white/20")}>{i + 1}. {o.n}</li>)}</ol>
        </div>
        {elation.hiddenMmr !== undefined && <p className="text-muted">Silver Wolf LV.999 Hidden MMR this fight ≈ <b className="text-text">{elation.hiddenMmr}</b>{elation.hiddenMmr >= 180 ? " (≥180: DMG Amplification up)" : " (180 for her DMG Amplification)"}.</p>}
        {!simple && <p className="text-faint">Punchline is shared; Elation DMG × (1 + 5·P / (P + 240)). After each Aha Instant, participants get Certified Banger equal to the Punchline counted (2 turns each). Battle start: {PUNCHLINE.startPerElation} Punchline per Elation character and {PUNCHLINE.startBanger} Certified Banger each. Assumed: base SPD {ELATION_ASSUMED.baseSpd}, Elation DMG scale, &quot;Let There Be Laughter&quot; {ELATION_ASSUMED.laughterMult}% per hit.</p>}
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5"><p className="text-[10px] uppercase tracking-wider text-faint">{label}</p><p className="font-semibold text-text">{value}</p></div>;
}
