"use client";

import { CheckCircle2, CircleDashed, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { abilityCard } from "@/lib/currencywars/abilities";
import { bondsOf } from "@/lib/currencywars/bonds";
import { ELATION_KITS } from "@/lib/currencywars/elation";
import { kitCoverage, kitEffect, type Coverage } from "@/lib/currencywars/kits";
import type { CwPack } from "@/lib/currencywars/sim";
import { cx, Panel } from "../ui";
import { AbilityTags } from "./CharacterCard";
import { Portrait } from "./shared";
import { Verbose } from "./simple";

const STATUS: Record<Coverage, { label: string; tone: string }> = {
  modelled: { label: "Modelled", tone: "bg-emerald-500" },
  elation: { label: "Elation engine", tone: "bg-[#e8735e]" },
  strength: { label: "In their strength", tone: "bg-sky-500" },
  other: { label: "Not modelled", tone: "bg-white/25" },
};

/** Every character in the downloaded roster: labels, summary, and how much of their kit the simulator applies. */
export function RosterAudit({ pack }: { pack: CwPack }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => pack.characters.filter((c) => pack.info?.[c.name]).map((c) => {
    const info = pack.info![c.name];
    const places = (info.field === "both" ? ["on", "off"] : [info.field]) as ("on" | "off")[];
    const views = places.map((p) => {
      const card = abilityCard(info, p, c.cost);
      const kit = kitEffect(info, c.name, 2, p, c.cost);
      return { p, card, kit, cov: kitCoverage(kit) };
    });
    const lines = views.reduce((n, v) => n + v.cov.lines, 0) || 1;
    const covered = views.reduce((n, v) => n + v.cov.modelled + v.cov.elation + v.cov.strength, 0);
    return { c, info, views, share: covered / lines, elation: !!ELATION_KITS[c.name] };
  }).sort((a, b) => a.c.cost - b.c.cost || a.c.name.localeCompare(b.c.name)), [pack]);
  const shown = rows.filter((r) => r.c.name.toLowerCase().includes(q.toLowerCase()));
  const total = rows.reduce((n, r) => n + r.views.reduce((m, v) => m + v.cov.lines, 0), 0);
  const by = (s: Coverage) => rows.reduce((n, r) => n + r.views.reduce((m, v) => m + v.cov[s], 0), 0);
  return (
    <Panel title={`Roster audit · ${rows.length} characters`} actions={<label className="flex items-center gap-1 text-xs"><Search size={12} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find" aria-label="Find a character" className="w-32" /></label>}>
      <Verbose>
        <p className="mb-2 text-xs text-muted">Each character&apos;s Currency Wars abilities (from their wiki page) by position. Every ability line is classified: <b className="text-emerald-300">modelled</b> (a team/battle effect the simulator applies), <b className="text-[#ffb3a5]">Elation engine</b>, <b className="text-sky-300">in their strength</b> (their own damage and self-buffs are part of the wiki On/Off-Field Strength), or <b className="text-text">not modelled</b>.</p>
      </Verbose>
      <div className="mb-3 flex h-2 overflow-hidden rounded-full" aria-label="Roster coverage">
        {(["modelled", "elation", "strength", "other"] as Coverage[]).map((s) => <span key={s} className={STATUS[s].tone} style={{ width: `${(by(s) / Math.max(1, total)) * 100}%` }} title={`${STATUS[s].label}: ${by(s)}`} />)}
      </div>
      <p className="mb-2 text-[11px] text-muted">{total} ability lines: {by("modelled")} modelled · {by("elation")} Elation engine · {by("strength")} in strength · {by("other")} not modelled</p>
      <ul className="space-y-1.5">
        {shown.map((r) => (
          <li key={r.c.name} className="rounded-lg border border-white/10 bg-black/20">
            <button type="button" onClick={() => setOpen(open === r.c.name ? null : r.c.name)} aria-expanded={open === r.c.name} className="flex w-full flex-wrap items-center gap-2 px-2 py-1.5 text-left text-xs">
              <Portrait name={r.c.name} cost={r.c.cost} size={28} />
              <b className="min-w-[8rem] flex-1 text-sm text-text">{r.c.name}</b>
              <span className="text-faint">{r.c.cost}-cost</span>
              <Check ok label="Researched" />
              <Check ok={r.views.every((v) => !!v.card?.desc)} label="Summary" />
              <Check ok={r.views.every((v) => (v.card?.labels.length ?? 0) > 0)} label="Labels" />
              <Check ok={bondsOf(pack, r.c.name).length > 0} label="Bonds" />
              {r.elation && <span className="rounded bg-[#e8735e]/25 px-1.5 py-0.5 text-[#ffb3a5]">Elation kit</span>}
              <span className={cx("ml-auto font-mono", r.share >= 0.8 ? "text-emerald-300" : r.share >= 0.6 ? "text-amber-200" : "text-rose-300")}>{Math.round(r.share * 100)}%</span>
            </button>
            {open === r.c.name && (
              <div className="space-y-2 border-t border-white/10 px-2 py-2">
                {r.views.map((v) => (
                  <div key={v.p}>
                    <p className="mb-1 flex flex-wrap items-center gap-2 text-xs"><b>{v.p === "on" ? "On-Field" : "Off-Field"}</b>{v.card && <><span className="text-muted">{v.card.name}</span><AbilityTags size="sm" labels={v.card.labels} /></>}</p>
                    {v.card?.desc && <p className="mb-1 text-[11px] text-muted">{v.card.desc}</p>}
                    {(v.kit.summons.length > 0 || Object.keys(v.kit.squad).length > 0) && <p className="mb-1 text-[11px] text-emerald-300">Applies: {[...Object.entries(v.kit.squad).map(([k, x]) => `squad ${k} +${Math.round((x ?? 0) * 100)}%`), ...v.kit.summons.map((sm) => `summon ${sm.name}`)].join(" · ")}</p>}
                    <ul className="space-y-0.5 text-[11px]">
                      {v.kit.lines.map((l, i) => (
                        <li key={i} className="flex gap-1.5"><span className={cx("mt-1 h-2 w-2 shrink-0 rounded-full", STATUS[l.status].tone)} title={STATUS[l.status].label} /><span className={l.status === "other" ? "text-text" : "text-muted"}><b className="text-faint">{l.ability}:</b> {l.text}{l.effect && <span className="text-cyan"> → {l.effect}</span>}</span></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return <span className={cx("inline-flex items-center gap-0.5", ok ? "text-emerald-300" : "text-faint")} title={label}>{ok ? <CheckCircle2 size={11} /> : <CircleDashed size={11} />}<span className="hidden sm:inline">{label}</span></span>;
}
