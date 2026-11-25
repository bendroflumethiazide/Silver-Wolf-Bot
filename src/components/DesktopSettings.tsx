"use client";

import { FolderOpen, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Button, ErrorBox, Field, Notice, Panel } from "./ui";

interface DesktopBridge {
  status: () => Promise<{ version: string; encryptionAvailable: boolean; anthropic: boolean; hoyolab: boolean; dataPath: string }>;
  setSecrets: (v: { anthropicKey?: string; hoyolabLtuid?: string; hoyolabLtoken?: string }) => Promise<boolean>;
  openDataFolder: () => Promise<string>;
}
declare global { interface Window { astralDesktop?: DesktopBridge } }

/** Only shown in the desktop app: store the Claude key / HoYoLAB cookies in the OS keychain. */
export function DesktopSettings() {
  const [bridge, setBridge] = useState<DesktopBridge | null>(null);
  const [status, setStatus] = useState<Awaited<ReturnType<DesktopBridge["status"]>> | null>(null);
  const [key, setKey] = useState("");
  const [ltuid, setLtuid] = useState("");
  const [ltoken, setLtoken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (window.astralDesktop) { setBridge(window.astralDesktop); window.astralDesktop.status().then(setStatus).catch(() => null); } }, []);
  if (!bridge) return null;

  const save = async (values: Parameters<DesktopBridge["setSecrets"]>[0]) => {
    setBusy(true); setErr(null);
    try { await bridge.setSecrets(values); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); }
    // On success the app restarts its server and reloads this page.
  };

  return (
    <Panel title="Desktop app" id="desktop" hud>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="cyan">v{status?.version ?? "…"}</Badge>
        <Badge tone={status?.anthropic ? "ok" : "default"}>Claude key {status?.anthropic ? "saved" : "not set"}</Badge>
        <Badge tone={status?.hoyolab ? "ok" : "default"}>HoYoLAB cookies {status?.hoyolab ? "saved" : "not set"}</Badge>
        <Button size="sm" variant="ghost" onClick={() => bridge.openDataFolder()}><FolderOpen size={14} /> Open data folder</Button>
      </div>
      {status && !status.encryptionAvailable && <Notice tone="warn">Your system&apos;s secure storage isn&apos;t available, so keys can&apos;t be saved here.</Notice>}
      <p className="mb-3 text-sm text-muted">Keys are encrypted with your operating system&apos;s keychain and only used by the app&apos;s local server. They are never shown again, never put in backups, and this page can&apos;t read them back. Saving restarts the app&apos;s server (a second or two).</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Field label="Anthropic API key (Claude chat)" hint="From platform.claude.com → API keys.">
            <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={status?.anthropic ? "•••••• saved — paste to replace" : "sk-ant-…"} />
          </Field>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" disabled={busy || !key.trim()} onClick={() => save({ anthropicKey: key })}><KeyRound size={14} /> Save key</Button>
            {status?.anthropic && <Button variant="ghost" size="sm" disabled={busy} onClick={() => save({ anthropicKey: "" })}>Remove</Button>}
          </div>
        </div>
        <div className="space-y-2">
          <Field label="HoYoLAB ltuid_v2" hint="hoyolab.com → browser dev tools → Application → Cookies."><input autoComplete="off" value={ltuid} onChange={(e) => setLtuid(e.target.value)} placeholder={status?.hoyolab ? "saved — paste to replace" : "123456789"} /></Field>
          <Field label="HoYoLAB ltoken_v2"><input type="password" autoComplete="off" value={ltoken} onChange={(e) => setLtoken(e.target.value)} placeholder={status?.hoyolab ? "•••••• saved — paste to replace" : "v2_…"} /></Field>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" disabled={busy || !ltuid.trim() || !ltoken.trim()} onClick={() => save({ hoyolabLtuid: ltuid, hoyolabLtoken: ltoken })}><KeyRound size={14} /> Save cookies</Button>
            {status?.hoyolab && <Button variant="ghost" size="sm" disabled={busy} onClick={() => save({ hoyolabLtuid: "", hoyolabLtoken: "" })}>Remove</Button>}
          </div>
        </div>
      </div>
      {busy && <p className="mt-3 text-xs text-muted">Restarting…</p>}
      {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
    </Panel>
  );
}
