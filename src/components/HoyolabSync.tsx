"use client";

import Link from "next/link";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { getDb, kvSet, newId, nowIso } from "@/lib/db";
import { HOYOLAB_CAPABILITIES, parseHoyolab, serverForUid, type HoyolabParsed, type HoyolabRaw } from "@/lib/connectors/hoyolab";
import { useApp } from "@/lib/store";
import type { ImportHistoryEntry, Profile } from "@/lib/types";
import { Badge, Button, ErrorBox, Notice, Panel } from "./ui";
import { WEB_EDITION, WEB_EDITION_NOTE } from "@/lib/edition";

/** Apply a parsed HoYoLAB sync. Manual character edits are never overwritten. Returns a summary. */
export async function applyHoyolab(p: HoyolabParsed, profile: Profile): Promise<string> {
  const db = getDb();
  const undo: ImportHistoryEntry["undo"] = [];
  let updated = 0, added = 0, keptManual = 0;
  await db.transaction("rw", [db.characters, db.profiles, db.endgame, db.kv], async () => {
    for (const c of p.characters) {
      const before = await db.characters.get(c.key);
      if (before?.source === "manual") { keptManual++; continue; }
      if (before && before.level === c.level && before.eidolon === c.eidolon) continue;
      undo.push({ table: "characters", key: c.key, before: before ?? null });
      // Keep skills/traces from earlier imports: HoYoLAB's summary only carries level and Eidolon.
      await db.characters.put(before ? { ...before, level: c.level, eidolon: c.eidolon, ascension: Math.max(before.ascension, c.ascension), source: "hoyolab", updatedAt: c.updatedAt } : c);
      if (before) updated++; else added++;
    }
    for (const e of p.endgame) { undo.push({ table: "endgame", key: e.id, before: (await db.endgame.get(e.id)) ?? null }); await db.endgame.put(e); }
    undo.push({ table: "profiles", key: profile.id, before: profile });
    await db.profiles.put({
      ...profile,
      stats: { ...profile.stats, ...(p.stats ?? {}) },
      resources: p.note ? { ...profile.resources, trailblazePower: p.note.trailblazePower, trailblazePowerRecordedAt: Date.parse(p.note.fetchedAt) } : profile.resources,
      syncedAt: nowIso(), updatedAt: nowIso(),
    });
    if (p.note) await kvSet(`dailyNote:${profile.id}`, p.note);
  });
  await db.importHistory.put({ id: newId("import"), kind: "hoyolab", importedAt: nowIso(), summary: `HoYoLAB sync: ${added} added, ${updated} updated, ${p.endgame.length} endgame record(s)${keptManual ? `, ${keptManual} manual kept` : ""}`, undo });
  return `${added} character(s) added, ${updated} updated, ${p.endgame.length} endgame record(s)${p.note ? ", Trailblaze Power and daily progress refreshed" : ""}.${keptManual ? ` ${keptManual} character(s) you edited by hand were kept.` : ""}`;
}

export function HoyolabSync({ profile }: { profile: Profile }) {
  const { game, settings, profileId } = useApp();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<HoyolabParsed | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (WEB_EDITION) { setConfigured(false); return; }
    fetch("/api/hoyolab").then((r) => r.json()).then((j) => setConfigured(!!j.configured)).catch(() => setConfigured(false));
  }, []);

  const fetchIt = async () => {
    setBusy(true); setErr(null); setMsg(null); setPreview(null);
    try {
      if (!profile.uid || !serverForUid(profile.uid)) throw new Error("Set a global-server UID (starting with 6, 7, 8 or 9) in the profile panel.");
      const res = await fetch("/api/hoyolab", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid: profile.uid }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Sync failed (HTTP ${res.status}).`);
      setPreview(parseHoyolab(j as HoyolabRaw, game, profileId));
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <Panel title="HoYoLAB Battle Chronicle">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2"><Badge tone="ok">read-only</Badge><Badge tone="warn">unofficial endpoints</Badge>{configured === false && <Badge tone="bad">not configured</Badge>}{configured && <Badge tone="cyan">cookies set on server</Badge>}</div>
          {WEB_EDITION ? <Notice>{WEB_EDITION_NOTE}</Notice> : configured === false && (
            <Notice>
              Put your HoYoLAB cookies in <code>.env.local</code> next to the app (never in the browser):<br />
              <code>HOYOLAB_LTUID_V2=…</code> and <code>HOYOLAB_LTOKEN_V2=…</code>, then restart. See README → HoYoLAB.
            </Notice>
          )}
          {!settings.hoyolabEnabled ? <Notice>Disabled. Turn it on in <Link className="underline" href="/settings">Settings → Privacy</Link>.</Notice> : (
            <Button variant="primary" onClick={fetchIt} disabled={busy || !configured}><RefreshCw size={15} className={busy ? "animate-spin" : ""} /> {busy ? "Reading HoYoLAB…" : "Sync from HoYoLAB"}</Button>
          )}
          {err && <ErrorBox>{err}</ErrorBox>}
          {msg && <Notice tone="ok">{msg}</Notice>}
          {preview && (
            <div className="space-y-2 rounded-lg border border-line p-3">
              {preview.stats && <div>Active {preview.stats.activeDays} days · {preview.stats.characters} characters · {preview.stats.achievements} achievements · {preview.stats.chests} chests</div>}
              {preview.note && <div className="text-muted">Trailblaze Power {preview.note.trailblazePower}/{preview.note.maxTrailblazePower} · Daily Training {preview.note.dailyTraining[0]}/{preview.note.dailyTraining[1]} · Echo of War {preview.note.echoOfWar[0]}/{preview.note.echoOfWar[1]}</div>}
              <div className="text-muted">{preview.characters.length} character(s), {preview.endgame.length} endgame record(s)</div>
              {preview.warnings.length > 0 && <ul className="list-disc pl-4 text-xs text-warn">{preview.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
              <div className="flex gap-2">
                <Button size="sm" variant="primary" onClick={async () => { setMsg(await applyHoyolab(preview, profile)); setPreview(null); }}>Apply sync</Button>
                <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>Discard</Button>
              </div>
            </div>
          )}
        </div>
        <div className="grid gap-3 text-xs sm:grid-cols-2">
          <div><div className="mb-1 font-mono uppercase tracking-wider text-ok">Provides</div><ul className="space-y-1">{HOYOLAB_CAPABILITIES.provides.map((p) => <li key={p} className="flex gap-1.5"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-ok" />{p}</li>)}</ul></div>
          <div><div className="mb-1 font-mono uppercase tracking-wider text-bad">Cannot provide</div><ul className="space-y-1">{HOYOLAB_CAPABILITIES.doesNotProvide.map((p) => <li key={p} className="flex gap-1.5"><XCircle size={13} className="mt-0.5 shrink-0 text-bad" />{p}</li>)}</ul></div>
        </div>
      </div>
      <p className="mt-4 text-xs text-faint">Only GET requests to Battle Chronicle pages. No check-ins, redemptions or any action on your account. If HoYoLAB asks for a verification check, you&apos;ll be told to complete it on hoyolab.com yourself. This app never bypasses it.</p>
    </Panel>
  );
}
