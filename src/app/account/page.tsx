"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle2, Plus, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { HoyolabSync } from "@/components/HoyolabSync";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, confirmAction, ErrorBox, Field, Notice, NumberInput, PageHeader, Panel, SourceBadge, Stat } from "@/components/ui";
import { fill, pick, SW } from "@/lib/companion/voice";
import { ENKA_CAPABILITIES, parseEnka, type EnkaParsed } from "@/lib/connectors/enka";
import { getDb, newId, nowIso } from "@/lib/db";
import { useAccount, useProfile } from "@/lib/hooks";
import { countDiff, diffByKey } from "@/lib/importers/diff";
import { relicFingerprint, lightConeFingerprint } from "@/lib/importers/hsrScanner";
import { useApp } from "@/lib/store";
import { formatDuration } from "@/lib/time";
import type { ImportHistoryEntry, Profile } from "@/lib/types";

const SERVERS: NonNullable<Profile["server"]>[] = ["America", "Europe", "Asia", "TW/HK/MO", "China"];

function SyncPanel({ profile }: { profile: Profile }) {
  const { game, settings, profileId } = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<EnkaParsed | null>(null);
  const [withEquipment, setWithEquipment] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchShowcase = async () => {
    setBusy(true); setErr(null); setMsg(null); setPreview(null);
    try {
      if (!profile.uid) throw new Error("Enter your UID first.");
      if (!game) throw new Error("Download game data first, so showcase ids can be resolved.");
      const res = await fetch(`/api/enka/${profile.uid}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Sync failed (HTTP ${res.status}).`);
      setPreview(parseEnka(body.data, game, profileId));
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const apply = async () => {
    if (!preview) return;
    const db = getDb();
    const undo: ImportHistoryEntry["undo"] = [];
    const existing = await db.characters.where("profileId").equals(profileId).toArray();
    const rows = diffByKey(existing, preview.characters, (c) => c.charId, ["level", "ascension", "eidolon", "skills", "traces"], { removeMissing: false });
    let written = 0, skippedManual = 0;
    await db.transaction("rw", [db.characters, db.profiles, db.lightCones, db.relics], async () => {
      for (const r of rows) {
        if (r.kind === "unchanged") continue;
        if (r.kind === "conflict") { skippedManual++; continue; }
        undo.push({ table: "characters", key: r.after!.key, before: r.before });
        await db.characters.put({ ...(r.before ?? {}), ...r.after! });
        written++;
      }
      undo.push({ table: "profiles", key: profile.id, before: profile });
      await db.profiles.put({ ...profile, ...Object.fromEntries(Object.entries(preview.profile).filter(([, v]) => v !== undefined)), id: profile.id, updatedAt: nowIso() } as Profile);
      if (withEquipment) {
        const lcs = await db.lightCones.where("profileId").equals(profileId).toArray();
        const have = new Set(lcs.map((l) => lightConeFingerprint(l) + l.location));
        for (const l of preview.lightCones) if (!have.has(lightConeFingerprint(l) + l.location)) { undo.push({ table: "lightCones", key: l.uid, before: null }); await db.lightCones.put(l); written++; }
        const rel = await db.relics.where("profileId").equals(profileId).toArray();
        const haveR = new Set(rel.map(relicFingerprint));
        for (const r of preview.relics) if (!haveR.has(relicFingerprint(r))) { undo.push({ table: "relics", key: r.uid, before: null }); await db.relics.put(r); written++; }
      }
    });
    await db.importHistory.put({ id: newId("import"), kind: "enka", importedAt: nowIso(), summary: `Showcase sync: ${written} written${skippedManual ? `, ${skippedManual} manual entries kept` : ""}`, undo });
    setMsg(`Synced. ${written} record(s) written.${skippedManual ? ` ${skippedManual} character(s) you edited by hand were kept; review them in the Import Center if needed.` : ""}`);
    setPreview(null);
  };

  const ago = profile.syncedAt ? formatDuration(Date.now() - Date.parse(profile.syncedAt)) + " ago" : null;
  const comment = profile.syncedAt
    ? { mood: "smug" as const, line: fill(pick(SW.accountSynced, profile.syncedAt), { ago: ago! }), facts: [`Last verified sync: ${new Date(profile.syncedAt).toLocaleString()}.`] }
    : { mood: "neutral" as const, line: pick(SW.accountNoSync, profile.id), facts: ["No verified sync recorded for this profile."] };

  return (
    <Panel title="Account connection" hud>
      <WolfComment comment={comment} className="mb-4" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2"><span className="font-medium">{ENKA_CAPABILITIES.name}</span><Badge tone="ok">read-only</Badge><Badge>no login</Badge></div>
          {!settings.enkaEnabled ? (
            <Notice>Disabled. Enable it under <Link href="/settings" className="underline">Settings → Privacy</Link>. Only your UID is sent.</Notice>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={fetchShowcase} disabled={busy || !profile.uid}><RefreshCw size={15} className={busy ? "animate-spin" : ""} /> {busy ? "Fetching…" : "Fetch showcase"}</Button>
              </div>
              {!profile.uid && <p className="text-xs text-warn">Set your UID in the profile panel.</p>}
            </>
          )}
          {err && <ErrorBox>{err}</ErrorBox>}
          {msg && <Notice tone="ok">{msg}</Notice>}
          {preview && (() => {
            const c = countDiff(diffByKey([], preview.characters, (x) => x.charId, [], { removeMissing: false }));
            return (
              <div className="space-y-2 rounded-lg border border-line p-3">
                <div>Read <b>{preview.profile.name}</b> · TL {preview.profile.trailblazeLevel} · EQ {preview.profile.equilibriumLevel}</div>
                <div className="text-muted">{c.new} showcase character(s), {preview.lightCones.length} Light Cone(s), {preview.relics.length} relic(s).</div>
                {preview.warnings.length > 0 && <ul className="list-disc pl-4 text-xs text-warn">{preview.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={withEquipment} onChange={(e) => setWithEquipment(e.target.checked)} /> Also add showcase Light Cones and relics to inventory (duplicates of existing items are skipped)</label>
                <div className="flex gap-2"><Button variant="primary" size="sm" onClick={apply}>Apply sync</Button><Button size="sm" variant="ghost" onClick={() => setPreview(null)}>Discard</Button></div>
              </div>
            );
          })()}
        </div>
        <div className="grid gap-3 text-xs sm:grid-cols-2">
          <div><div className="mb-1 font-mono uppercase tracking-wider text-ok">Provides</div><ul className="space-y-1">{ENKA_CAPABILITIES.provides.map((p) => <li key={p} className="flex gap-1.5"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-ok" />{p}</li>)}</ul></div>
          <div><div className="mb-1 font-mono uppercase tracking-wider text-bad">Cannot provide</div><ul className="space-y-1">{ENKA_CAPABILITIES.doesNotProvide.map((p) => <li key={p} className="flex gap-1.5"><XCircle size={13} className="mt-0.5 shrink-0 text-bad" />{p}</li>)}</ul></div>
        </div>
      </div>
    </Panel>
  );
}

export default function AccountPage() {
  const profile = useProfile();
  const { setProfile } = useApp();
  const profiles = useLiveQuery(() => getDb().profiles.toArray(), []);
  const { summary } = useAccount();
  if (!profile || !profiles) return null;
  const upd = (patch: Partial<Profile>) => getDb().profiles.update(profile.id, { ...patch, updatedAt: nowIso() });
  const addProfile = async () => {
    const p: Profile = { id: newId("profile"), name: `Account ${profiles.length + 1}`, source: "manual", createdAt: nowIso(), updatedAt: nowIso() };
    await getDb().profiles.put(p);
    await setProfile(p.id);
  };
  const removeProfile = async () => {
    if (profiles.length < 2) return;
    if (!confirmAction(`Delete profile "${profile.name}" and ALL of its characters, inventory, Warps, progress and teams?`)) return;
    const db = getDb();
    const id = profile.id;
    await db.transaction("rw", [db.profiles, db.characters, db.lightCones, db.relics, db.warps, db.materials, db.relicProfiles, db.teams, db.achievements, db.mapMarkers, db.endgame], async () => {
      for (const t of [db.characters, db.lightCones, db.relics, db.warps, db.materials, db.relicProfiles, db.teams, db.achievements, db.mapMarkers, db.endgame]) await t.where("profileId").equals(id).delete();
      await db.profiles.delete(id);
    });
    await setProfile(profiles.find((p) => p.id !== id)!.id);
  };
  const st = profile.stats;
  return (
    <div className="space-y-5">
      <PageHeader title="My Account" subtitle="Trailblazer profile, verified sync, and an overview of everything tracked for this account."
        actions={<><Button size="sm" onClick={addProfile}><Plus size={14} /> Add profile</Button>{profiles.length > 1 && <Button size="sm" variant="danger" onClick={removeProfile}><Trash2 size={14} /> Delete profile</Button>}</>} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Panel title="Profile" actions={<SourceBadge source={profile.source} />}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" className="col-span-2"><input value={profile.name} onChange={(e) => upd({ name: e.target.value })} /></Field>
            <Field label="UID"><input inputMode="numeric" value={profile.uid ?? ""} onChange={(e) => upd({ uid: e.target.value.replace(/\D/g, "").slice(0, 10) })} /></Field>
            <Field label="Server"><select value={profile.server ?? ""} onChange={(e) => upd({ server: (e.target.value || undefined) as Profile["server"] })}><option value="">—</option>{SERVERS.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Trailblaze Level"><NumberInput min={1} max={70} value={profile.trailblazeLevel ?? 1} onChange={(v) => upd({ trailblazeLevel: v })} /></Field>
            <Field label="Equilibrium Level"><NumberInput min={0} max={6} value={profile.equilibriumLevel ?? 0} onChange={(v) => upd({ equilibriumLevel: v })} /></Field>
          </div>
          {profile.signature && <p className="mt-3 text-sm italic text-muted">“{profile.signature}”</p>}
          <p className="mt-3 text-[11px] text-faint">Editing these fields by hand keeps them as entered. A later verified sync overwrites them with game values.</p>
        </Panel>
        <Panel title="Overview">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Characters" value={summary ? `${summary.owned}/${summary.totalPlayable}` : "—"} hint={st?.characters !== undefined ? `${st.characters} per showcase (verified)` : "tracked here"} />
            <Stat label="Light Cones" value={summary?.lightConesOwned ?? "—"} hint={st?.lightCones !== undefined ? `${st.lightCones} per showcase (verified)` : "tracked here"} />
            <Stat label="Achievements" value={st?.achievements ?? summary?.achievementsDone ?? "—"} hint={st?.achievements !== undefined ? "verified count" : "manually tracked"} tone="gold" />
            <Stat label="Map objectives" value={summary ? `${summary.markersDone}/${summary.markersTotal}` : "—"} hint="manual map tracking" />
            <Stat label="Warps logged" value={summary ? summary.pools.character.total + summary.pools.lightcone.total + summary.pools.standard.total : "—"} />
            <Stat label="Last sync" value={profile.syncedAt ? new Date(profile.syncedAt).toLocaleDateString() : "never"} />
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <Link href="/characters" className="text-cyan hover:underline">Collection →</Link><Link href="/warp" className="text-cyan hover:underline">Warp history →</Link>
            <Link href="/achievements" className="text-cyan hover:underline">Achievements →</Link><Link href="/teams?tab=endgame" className="text-cyan hover:underline">Endgame records →</Link>
          </div>
        </Panel>
      </div>
      <SyncPanel profile={profile} />
      <HoyolabSync profile={profile} />
    </div>
  );
}
