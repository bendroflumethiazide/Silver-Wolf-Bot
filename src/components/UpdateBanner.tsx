"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { desktop, useUpdate } from "@/lib/desktop";
import { useApp } from "@/lib/store";
import { Button } from "./ui";
import { WolfMessages } from "./SilverWolf";

/** Desktop only: tells you when a newer version is out and updates with one click. */
export function UpdateBanner() {
  const enabled = useApp((s) => s.settings.updateCheck);
  const { info, phase, progress, error, dismissed, check, install, dismiss } = useUpdate();
  const [notes, setNotes] = useState(false);
  useEffect(() => { if (enabled && desktop()?.checkUpdate) void check(); }, [enabled, check]);
  if (!info?.newer || dismissed) return null;
  const busy = phase === "downloading" || phase === "installing";
  return (
    <div className="glass-strong mb-5 p-3 sm:p-4" role="status" aria-label="Update available">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <WolfMessages parts={[`Ur on v${info.current}`, `v${info.latest} is out`, info.canInstall ? "Patch it ;)" : "Grab the new build"]} mood="alert" />
        </div>
        {!busy && <button onClick={dismiss} aria-label="Later" className="rounded p-1 text-muted hover:bg-white/5"><X size={16} /></button>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 sm:ml-[54px]">
        <Button variant="primary" size="sm" disabled={busy} onClick={() => void install()}>
          <Download size={14} /> {info.canInstall ? `Update to v${info.latest}` : "Open download page"}
        </Button>
        {info.notes && <Button variant="ghost" size="sm" onClick={() => setNotes((v) => !v)}>{notes ? "Hide" : "What's new"}</Button>}
        {!busy && <Button variant="ghost" size="sm" onClick={dismiss}>Later</Button>}
        {phase === "downloading" && <span className="font-mono text-xs text-muted">Downloading {Math.round(progress * 100)}%</span>}
        {phase === "installing" && <span className="text-xs text-muted">Installing… the app restarts by itself.</span>}
        {info.portable && <span className="text-xs text-faint">Portable copy: download the new exe and replace this one. Your data stays.</span>}
      </div>
      {phase === "downloading" && <div className="mt-2 h-1 overflow-hidden rounded bg-white/10 sm:ml-[54px]"><div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
      {error && <p className="mt-2 text-xs text-bad sm:ml-[54px]">{error}</p>}
      {notes && <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-line p-3 text-xs text-muted sm:ml-[54px]">{info.notes}</pre>}
    </div>
  );
}
