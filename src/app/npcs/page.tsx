"use client";

import { useState } from "react";
import { Codex } from "@/components/Codex";
import { GameImage } from "@/components/GameImage";
import { WolfComment } from "@/components/SilverWolf";
import { Empty, PageHeader, Panel, Tabs } from "@/components/ui";
import { noGameData } from "@/lib/companion/comments";
import { stripMarkup } from "@/lib/gamedata/types";
import { useApp } from "@/lib/store";

type Tab = "directory" | "glossary" | "codex";

export default function NpcsPage() {
  const { game } = useApp();
  const [tab, setTab] = useState<Tab>("directory");
  const [q, setQ] = useState("");
  const needle = q.toLowerCase();
  const contacts = Object.values(game?.contacts ?? {}).filter((c) => c.name && (!needle || c.name.toLowerCase().includes(needle)));
  const glossary = Object.values(game?.descriptions ?? {}).filter((d) => d.title && (!needle || (d.title + d.desc).toLowerCase().includes(needle)));
  return (
    <div>
      <PageHeader title="NPCs & Lore" subtitle="NPC directory and glossary from game data, plus your own lore codex with confirmed facts kept separate from theories." />
      {!game && <WolfComment comment={noGameData()} className="mb-5" />}
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "directory", label: `NPC directory (${Object.keys(game?.contacts ?? {}).length})` }, { id: "glossary", label: `Glossary (${Object.keys(game?.descriptions ?? {}).length})` }, { id: "codex", label: "Lore & NPC codex" }]} />
      {tab !== "codex" && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search" className="mb-4 w-full sm:w-72" />}
      {tab === "directory" && (!contacts.length ? <Empty title="No contacts">Download game data to load the in-game Messages contact list.</Empty> : (
        <>
          <p className="mb-3 text-xs text-muted">Source: the in-game Messages contact list (names and portraits). Background, locations and quests are not in this data. Add them in the codex.</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {contacts.slice(0, 300).map((c) => (
              <li key={c.id} className="glass flex items-center gap-2 p-2"><GameImage path={c.icon} alt={c.name} className="h-9 w-9 shrink-0" rounded="rounded-full" /><span className="truncate text-xs">{c.name}</span></li>
            ))}
          </ul>
        </>
      ))}
      {tab === "glossary" && (!glossary.length ? <Empty title="No glossary" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {glossary.slice(0, 200).map((d) => <Panel key={d.id} title={d.title}><p className="whitespace-pre-line text-sm text-muted">{stripMarkup(d.desc)}</p></Panel>)}
        </div>
      ))}
      {tab === "codex" && <Codex kinds={["npc", "lore"]} />}
    </div>
  );
}
