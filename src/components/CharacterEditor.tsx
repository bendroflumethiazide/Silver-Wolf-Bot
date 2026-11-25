"use client";

import { useState } from "react";
import { getDb, nowIso } from "@/lib/db";
import { ascensionForLevel, LEVEL_CAP_BY_ASCENSION } from "@/lib/materials/calculator";
import type { OwnedCharacter } from "@/lib/types";
import { Button, confirmAction, ErrorBox, Field, Modal, NumberInput } from "./ui";

const DEFAULT_TRACES = Object.fromEntries([...["ability_1", "ability_2", "ability_3"], ...Array.from({ length: 10 }, (_, i) => `stat_${i + 1}`)].map((k) => [k, false]));

export function blankOwned(profileId: string, charId: string): OwnedCharacter {
  return {
    key: `${profileId}:${charId}`, profileId, charId, level: 1, ascension: 0, eidolon: 0,
    skills: { basic: 1, skill: 1, ult: 1, talent: 1 }, traces: { ...DEFAULT_TRACES }, source: "manual", updatedAt: nowIso(),
  };
}

/** Validate a manual character entry against game rules. Returns an error message or null. */
export function validateOwned(c: OwnedCharacter): string | null {
  if (c.level < 1 || c.level > 80) return "Level must be 1–80.";
  if (c.ascension < 0 || c.ascension > 6) return "Ascension must be 0–6.";
  if (c.level > LEVEL_CAP_BY_ASCENSION[c.ascension]) return `Level ${c.level} needs at least Ascension ${ascensionForLevel(c.level)}.`;
  if (c.ascension > 0 && c.level < LEVEL_CAP_BY_ASCENSION[c.ascension - 1]) return `Ascension ${c.ascension} requires reaching level ${LEVEL_CAP_BY_ASCENSION[c.ascension - 1]} first.`;
  if (c.eidolon < 0 || c.eidolon > 6) return "Eidolon must be 0–6.";
  const { basic, skill, ult, talent } = c.skills;
  if (basic < 1 || basic > 6) return "Basic ATK level must be 1–6 (before Eidolon bonuses).";
  for (const [n, v] of [["Skill", skill], ["Ultimate", ult], ["Talent", talent]] as const) if (v < 1 || v > 10) return `${n} level must be 1–10 (before Eidolon bonuses).`;
  return null;
}

export function CharacterEditor({ open, onClose, initial, name }: { open: boolean; onClose: () => void; initial: OwnedCharacter; name: string }) {
  const [c, setC] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<OwnedCharacter>) => setC((x) => ({ ...x, ...patch }));
  const save = async () => {
    const e = validateOwned(c);
    if (e) return setErr(e);
    // Any edit by hand makes the record manual, so future imports will ask before overwriting it.
    await getDb().characters.put({ ...c, source: "manual", updatedAt: nowIso() });
    onClose();
  };
  const remove = async () => {
    if (!confirmAction(`Remove ${name} from your roster?`)) return;
    await getDb().characters.delete(c.key);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={`${name} — progress`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Level"><NumberInput min={1} max={80} value={c.level} onChange={(v) => set({ level: v, ascension: Math.max(c.ascension, ascensionForLevel(v)) })} /></Field>
        <Field label="Ascension"><NumberInput min={0} max={6} value={c.ascension} onChange={(v) => set({ ascension: v })} /></Field>
        <Field label="Eidolon"><NumberInput min={0} max={6} value={c.eidolon} onChange={(v) => set({ eidolon: v })} /></Field>
        {(["basic", "skill", "ult", "talent"] as const).map((k) => (
          <Field key={k} label={k === "ult" ? "Ultimate" : k[0].toUpperCase() + k.slice(1)}>
            <NumberInput min={1} max={k === "basic" ? 6 : 10} value={c.skills[k]} onChange={(v) => set({ skills: { ...c.skills, [k]: v } })} />
          </Field>
        ))}
        <Field label="Build status">
          <select value={c.buildStatus ?? "unbuilt"} onChange={(e) => set({ buildStatus: e.target.value as OwnedCharacter["buildStatus"] })}>
            <option value="unbuilt">Unbuilt</option><option value="in-progress">In progress</option><option value="built">Built</option>
          </select>
        </Field>
      </div>
      <div className="mt-4">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Traces unlocked</div>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(c.traces).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((k) => (
            <label key={k} className={`flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs ${c.traces[k] ? "border-cyan/50 text-cyan" : "border-line text-muted"}`}>
              <input type="checkbox" className="sr-only" checked={c.traces[k]} onChange={(e) => set({ traces: { ...c.traces, [k]: e.target.checked } })} />
              {k.replace("_", " ")}
            </label>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-faint">Major traces (ability 1–3) and stat bonuses (1–10), in HSR Scanner order: earliest unlock first.</p>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!c.favorite} onChange={(e) => set({ favorite: e.target.checked })} /> Favourite (prioritised in recommendations)</label>
      {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
      <div className="mt-5 flex justify-between gap-2">
        <Button variant="danger" onClick={remove}>Remove</Button>
        <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></div>
      </div>
    </Modal>
  );
}
