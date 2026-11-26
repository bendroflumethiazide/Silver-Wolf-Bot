"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, Download, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EquipmentTable } from "@/components/currencywars/EquipmentTable";
import { Investments } from "@/components/currencywars/Investments";
import { RunSim } from "@/components/currencywars/RunSim";
import { TeamBuilder } from "@/components/currencywars/TeamBuilder";
import { TrackedProvider } from "@/components/currencywars/tracking";
import { SimpleProvider, SimpleToggle } from "@/components/currencywars/simple";
import { Button, ErrorBox, Notice, PageHeader, Panel, Tabs } from "@/components/ui";
import { kvGet, kvSet } from "@/lib/db";
import { CW_PACK_KEY, CW_PACK_SCHEMA, downloadCwPack, type CwPack } from "@/lib/currencywars/sim";
import { WIKI } from "@/lib/wiki/fandom";

type Tab = "run" | "builder" | "equipment" | "investments";

export default function CurrencyWarsPage() {
  const pack = useLiveQuery(() => kvGet<CwPack | null>(CW_PACK_KEY, null), []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("run");
  const get = async () => {
    setBusy(true); setErr(null);
    try { await kvSet(CW_PACK_KEY, await downloadCwPack()); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const outdated = !!pack && (pack.schema ?? 1) < CW_PACK_SCHEMA;
  const update = <Button size="sm" variant={outdated ? "primary" : "ghost"} onClick={get} disabled={busy}><RefreshCw size={14} className={busy ? "animate-spin" : ""} /> {busy ? "Updating…" : "Update"}</Button>;

  return (
    <SimpleProvider>
    <div className="space-y-4">
      <PageHeader title="Currency Wars" subtitle={pack ? `${pack.season} (Version ${pack.version}): run simulator, team builder and every item.` : "Run simulator, team builder, equipment and investments."}
        actions={pack ? <div className="flex flex-wrap gap-2"><SimpleToggle /><Link href="/guides/view?g=currency-wars" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-text"><BookOpen size={14} /> Guide</Link>{update}</div> : undefined} />
      {err && <ErrorBox>{err}</ErrorBox>}
      {outdated && <Notice tone="warn" title="New Currency Wars data available" open>Press Update to download the latest: equipment, Emblems, Investment Environments and Strategies, opponents, difficulty ranks, and every character&apos;s stats, abilities, Eidolons and recommended equipment.</Notice>}
      {pack === undefined ? null : pack ? (
        <TrackedProvider>
          <Tabs<Tab> value={tab} onChange={setTab} tabs={[
            { id: "run", label: "Run simulator" },
            { id: "builder", label: "Team builder" },
            { id: "equipment", label: "Equipment" },
            { id: "investments", label: "Investments" },
          ]} />
          {tab === "run" && (outdated ? <Panel><p className="text-sm text-muted">Update the data first (button above).</p></Panel> : <RunSim pack={pack} />)}
          {tab === "builder" && <TeamBuilder pack={pack} />}
          {tab === "equipment" && <EquipmentTable pack={pack} />}
          {tab === "investments" && <Investments pack={pack} />}
          <p className="text-[11px] text-faint">Data from the <a className="underline" href={WIKI.page(`Currency Wars: ${pack.season}`)} target="_blank" rel="noreferrer">{WIKI.name}</a> ({WIKI.license}), downloaded {pack.fetchedAt.slice(0, 10)}. Game content © HoYoverse.</p>
        </TrackedProvider>
      ) : (
        <Panel>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="max-w-md text-sm text-muted">Download the current Currency Wars period from the Honkai: Star Rail Wiki: characters, bonds, shop odds, equipment, investments, opponents and difficulty ranks.</p>
            <Button variant="primary" onClick={get} disabled={busy}><Download size={15} /> {busy ? "Downloading…" : "Download Currency Wars data"}</Button>
          </div>
          <Notice>The app reads about ten public wiki pages. Nothing about you is sent. Text is {WIKI.license}.</Notice>
        </Panel>
      )}
    </div>
    </SimpleProvider>
  );
}
