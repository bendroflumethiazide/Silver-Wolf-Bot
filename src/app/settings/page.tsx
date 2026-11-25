"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Download, RefreshCw, RotateCcw, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { DesktopSettings } from "@/components/DesktopSettings";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, confirmAction, ErrorBox, Field, Notice, PageHeader, Panel, Progress } from "@/components/ui";
import { createBackup, deleteAllPersonalData, downloadJson, restoreBackup, validateBackup } from "@/lib/backup";
import { dataVersionComment } from "@/lib/companion/comments";
import { fill, pick, SW } from "@/lib/companion/voice";
import { getDb, kvGet } from "@/lib/db";
import { activateSnapshot, downloadSnapshot, fetchSourceInfo, LANGUAGES, listSnapshots, SOURCE, type DownloadProgress } from "@/lib/gamedata/source";
import { NAV } from "@/lib/nav";
import { useApp, type Server } from "@/lib/store";

function GameDataPanel() {
  const { game, reloadGame, settings, updateSettings } = useApp();
  const snapshots = useLiveQuery(() => listSnapshots(), [game?.downloadedAt]);
  const active = useLiveQuery(() => kvGet<string | null>("activeSnapshot", null), [game?.downloadedAt]);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remote, setRemote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);

  const download = async () => {
    setBusy(true); setError(null);
    try {
      await downloadSnapshot(settings.language, setProgress);
      await reloadGame();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); setProgress(null); }
  };
  const check = async () => {
    setError(null);
    try { setRemote((await fetchSourceInfo()).version); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Panel title="Game data" id="game-data" hud>
      <WolfComment comment={dataVersionComment(game?.version ?? null, remote)} className="mb-4" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 text-sm">
          <p className="text-muted">
            Characters, Light Cones, Relics, materials, achievements and Simulated Universe data are downloaded on demand from{" "}
            <a className="text-cyan hover:underline" href={SOURCE.repo} target="_blank" rel="noreferrer">{SOURCE.name}</a>{" "}
            ({SOURCE.license}) into this browser only. Nothing is bundled with the app. {SOURCE.ipNotice}
          </p>
          <Field label="Data language">
            <select value={settings.language} onChange={(e) => updateSettings({ language: e.target.value })}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </Field>
          {!game && (
            <label className="flex items-start gap-2 text-xs text-muted">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              I understand this downloads about 5 MB from raw.githubusercontent.com, and that the data is © HoYoverse, for personal reference.
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={download} disabled={busy || (!game && !consent)}>
              <Download size={15} /> {game ? "Re-download / update" : "Download game data"}
            </Button>
            <Button onClick={check} disabled={busy}><RefreshCw size={15} /> Check for update</Button>
          </div>
          {progress && (
            <div className="space-y-1">
              <Progress value={progress.done} max={progress.total} tone="cyan" label="Download progress" />
              <div className="font-mono text-[11px] text-muted">{progress.done}/{progress.total} · {progress.file}.json</div>
            </div>
          )}
          {error && <ErrorBox>{error}</ErrorBox>}
        </div>
        <div className="min-w-0">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Snapshots (rollback)</div>
          {!snapshots?.length ? <p className="text-sm text-muted">No snapshots downloaded.</p> : (
            <ul className="space-y-2">
              {snapshots.map((s) => (
                <li key={s.id} className="rounded-lg border border-line p-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-mono">v{s.version} · {s.language} · {(s.sizeBytes / 1e6).toFixed(1)} MB</div>
                    {s.id === active ? <Badge tone="ok">active</Badge> : (
                      <Button size="sm" onClick={async () => { await activateSnapshot(s.id); await reloadGame(); }}><RotateCcw size={12} /> Activate</Button>
                    )}
                  </div>
                  <div className="mt-1 text-muted">Downloaded {new Date(s.downloadedAt).toLocaleString()} · source build {new Date(s.timestamp * 1000).toLocaleDateString()}</div>
                  <div className="mt-1 text-muted">{s.report.counts.characters} characters · {s.report.counts.light_cones} Light Cones · {s.report.counts.relic_sets} relic sets · {s.report.counts.achievements} achievements</div>
                  {s.report.warnings.length > 0 && (
                    <details className="mt-1 text-warn"><summary className="cursor-pointer">{s.report.warnings.length} integrity warning(s)</summary>
                      <ul className="mt-1 list-disc pl-4">{s.report.warnings.slice(0, 30).map((w) => <li key={w}>{w}</li>)}</ul>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

function PreferencesPanel() {
  const { settings, updateSettings } = useApp();
  return (
    <Panel title="Companion & preferences">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Silver Wolf commentary" hint="Full shows the facts behind each line. Off hides her everywhere except her terminal.">
          <select value={settings.companion} onChange={(e) => updateSettings({ companion: e.target.value as typeof settings.companion })}>
            <option value="full">Full (lines + data)</option>
            <option value="brief">Brief (lines only)</option>
            <option value="off">Off</option>
          </select>
        </Field>
        <Field label="Server" hint="Used for countdowns and the 04:00 daily reset.">
          <select value={settings.server} onChange={(e) => updateSettings({ server: e.target.value as Server })}>
            {(["America", "Europe", "Asia", "TW/HK/MO"] as Server[]).map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.spoilerFree} onChange={(e) => updateSettings({ spoilerFree: e.target.checked })} /> Spoiler-free mode</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.cacheImages} onChange={(e) => updateSettings({ cacheImages: e.target.checked })} /> Cache images for offline use</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.reducedMotion} onChange={(e) => updateSettings({ reducedMotion: e.target.checked })} /> Reduce motion</label>
        </div>
      </div>
      <div className="mt-5">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Navigation — hide sections you don&apos;t use</div>
        <div className="flex flex-wrap gap-2">
          {NAV.filter((n) => !["home", "settings"].includes(n.id)).map((n) => {
            const hidden = settings.hiddenNav.includes(n.id);
            return (
              <button key={n.id} onClick={() => updateSettings({ hiddenNav: hidden ? settings.hiddenNav.filter((x) => x !== n.id) : [...settings.hiddenNav, n.id] })}
                className={`rounded-md border px-2 py-1 text-xs ${hidden ? "border-line text-faint line-through" : "border-violet/40 text-text"}`} aria-pressed={!hidden}>
                {n.label}
              </button>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function DataPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const { reloadGame } = useApp();
  const backup = async () => {
    const b = await createBackup();
    downloadJson(`astral-companion-backup-${b.exportedAt.slice(0, 10)}.json`, b);
    setMsg({ tone: "ok", text: "Backup downloaded. It contains every personal record, but no game data." });
  };
  const restore = async (f: File) => {
    try {
      const b = validateBackup(JSON.parse(await f.text()));
      if (!confirmAction(`Restore backup from ${b.exportedAt}? This REPLACES all personal data on this device.`)) return;
      const counts = await restoreBackup(b);
      setMsg({ tone: "ok", text: `Restored ${Object.values(counts).reduce((a, c) => a + c, 0)} records. Reloading…` });
      setTimeout(() => location.reload(), 800);
    } catch (e) { setMsg({ tone: "warn", text: e instanceof Error ? e.message : String(e) }); }
  };
  const wipe = async (includeGameData: boolean) => {
    if (!confirmAction(includeGameData ? "Delete ALL personal data AND downloaded game data and cached images? This cannot be undone." : "Delete ALL personal data (profiles, inventory, warps, notes, progress)? This cannot be undone. Make a backup first.")) return;
    await deleteAllPersonalData({ includeGameData });
    await reloadGame();
    location.reload();
  };
  const usage = useLiveQuery(async () => (navigator.storage?.estimate ? navigator.storage.estimate() : null), []);
  return (
    <Panel title="Backup, restore & deletion">
      <div className="flex flex-wrap gap-2">
        <Button onClick={backup}><Download size={15} /> Export backup</Button>
        <Button onClick={() => fileRef.current?.click()}><Upload size={15} /> Restore backup</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ""; }} />
        <Button variant="danger" onClick={() => wipe(false)}><Trash2 size={15} /> Delete all personal data</Button>
        <Button variant="danger" onClick={() => wipe(true)}><Trash2 size={15} /> Delete everything</Button>
      </div>
      {usage && <p className="mt-3 text-xs text-muted">Browser storage used: {((usage.usage ?? 0) / 1e6).toFixed(1)} MB of {((usage.quota ?? 0) / 1e9).toFixed(1)} GB available.</p>}
      {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
    </Panel>
  );
}

function PrivacyPanel() {
  const { settings, updateSettings } = useApp();
  const profiles = useLiveQuery(() => getDb().profiles.count(), []);
  return (
    <Panel title="Privacy & external services">
      <WolfComment comment={{ mood: "smug", line: pick(SW.settings, "settings"), facts: [`External requests: game data download (manual), Enka.Network showcase lookup (${settings.enkaEnabled ? "enabled" : "disabled"}). No analytics. ${profiles ?? 0} local profile(s).`] }} className="mb-4" />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={settings.enkaEnabled} onChange={(e) => updateSettings({ enkaEnabled: e.target.checked })} />
        <span>
          Enable public showcase lookup through Enka.Network. When you press Sync on the Account page, your UID (and nothing else) is sent to enka.network through this app&apos;s local server.
          It is read-only and needs no login. Only characters you put in your in-game showcase are visible.
        </span>
      </label>
      <label className="mt-3 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={settings.hoyolabEnabled} onChange={(e) => updateSettings({ hoyolabEnabled: e.target.checked })} />
        <span>
          Enable HoYoLAB Battle Chronicle sync (read-only). Your cookies stay in <code>.env.local</code> on the machine running this app; the browser never sees them.
          Only your UID is sent from the browser to the local server, which asks HoYoLAB.
        </span>
      </label>
      <p className="mt-3 text-xs text-muted">Claude chat for Silver Wolf: uses <code>ANTHROPIC_API_KEY</code> from <code>.env.local</code> on the local server, and sends only your question plus a compact facts block (no UID or name).</p>
      <p className="mt-3 text-xs text-muted">{fill("This app never asks for your HoYoverse password, never stores credentials in the browser, and never automates the game client.", {})}</p>
    </Panel>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Settings & Data" subtitle="Game data, privacy, backups and preferences. Everything is stored locally in this browser." />
      <DesktopSettings />
      <GameDataPanel />
      <PreferencesPanel />
      <PrivacyPanel />
      <DataPanel />
    </div>
  );
}
