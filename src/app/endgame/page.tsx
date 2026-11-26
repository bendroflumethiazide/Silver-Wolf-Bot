"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { GameImage } from "@/components/GameImage";
import { EndgameComment } from "@/components/endgame/EndgameComment";
import { Badge, CardGrid, ImageCard, PageHeader, Panel, SectionTitle } from "@/components/ui";
import { getDb } from "@/lib/db";
import { characterDisplayName } from "@/lib/gamedata/types";
import { useApp } from "@/lib/store";
import type { EndgameRecord } from "@/lib/types";

type Mode = EndgameRecord["mode"];
const MODES: { mode: Exclude<Mode, "Other">; icon: string; what: string[] }[] = [
  { mode: "Memory of Chaos", icon: "241", what: ["12 stages, two teams each.", "Stars for clearing in fewer cycles: single-target damage and speed shine."] },
  { mode: "Pure Fiction", icon: "33", what: ["4 stages, two teams each, waves of enemies that keep coming.", "Score-based: area damage (most Erudition characters) shines. Refreshes every 6 weeks."] },
  { mode: "Apocalyptic Shadow", icon: "252", what: ["Two-phase bosses, one per team, 4 difficulties.", "Breaking Toughness matters most. Refreshes every 6 weeks."] },
  { mode: "Anomaly Arbitration", icon: "102", what: ["Three Knight stages (separate teams) and a King in Check stage.", "Refreshes every Version. Unlocks after 3-star clears of MoC 12, Pure Fiction 4 and Apocalyptic Shadow difficulty 4."] },
];

function best(rs: EndgameRecord[]) {
  const withStars = rs.filter((r) => r.stars !== undefined);
  const withScore = rs.filter((r) => r.score !== undefined);
  if (withStars.length) return `${Math.max(...withStars.map((r) => r.stars!))}★ best`;
  if (withScore.length) return `${Math.max(...withScore.map((r) => r.score!)).toLocaleString()} best score`;
  return null;
}

export default function EndgamePage() {
  const { game, profileId } = useApp();
  const records = useLiveQuery(() => getDb().endgame.where("profileId").equals(profileId).toArray(), [profileId]);
  return (
    <div className="space-y-7">
      <PageHeader title="Endgame" subtitle="The four Treasures Lightward modes, your results, and the teams you used." />
      <EndgameComment records={records ?? []} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {MODES.map((m) => {
          const rs = (records ?? []).filter((r) => r.mode === m.mode).sort((a, b) => b.date.localeCompare(a.date));
          const last = rs[0];
          return (
            <Panel key={m.mode} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-black/30">
                  {game?.items[m.icon]?.icon && <GameImage path={game.items[m.icon].icon} alt="" className="h-full w-full object-contain p-1.5" rounded="rounded-none" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">{m.mode}</h2>
                  <div className="flex flex-wrap gap-1.5 text-xs">{best(rs) ? <Badge tone="gold">{best(rs)}</Badge> : <span className="text-muted">No runs logged yet</span>}{rs.length > 0 && <Badge>{rs.length} run{rs.length === 1 ? "" : "s"}</Badge>}</div>
                </div>
              </div>
              <ul className="space-y-1 text-sm text-muted">{m.what.map((w) => <li key={w}>{w}</li>)}</ul>
              {last && (
                <div className="rounded-lg border border-line p-2.5">
                  <div className="mb-1.5 text-xs text-faint">Last run · {last.season || last.date.slice(0, 10)}</div>
                  <div className="flex flex-wrap gap-3">
                    {last.teams.map((t, i) => (
                      <div key={i} className="flex -space-x-2">
                        {t.map((id) => game?.characters[id] && <GameImage key={id} path={game.characters[id].icon} alt={characterDisplayName(game.characters[id])} className="h-9 w-9 ring-2 ring-[#0b0a18]" rounded="rounded-full" />)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Link href="/teams?tab=endgame" className="mt-auto text-sm text-cyan hover:underline">{rs.length ? "See history and log a run →" : "Log your first run →"}</Link>
            </Panel>
          );
        })}
      </div>
      <section>
        <SectionTitle>Related</SectionTitle>
        <CardGrid>
          <ImageCard href="/teams" title="Team builder" sub="Plan two teams for a stage" image={game?.characters["1303"]?.icon ? <GameImage path={game.characters["1303"].icon} alt="" className="h-full w-full" rounded="rounded-none" /> : <span />} />
          <ImageCard href="/account" title="Sync from HoYoLAB" sub="Pull your endgame records automatically" image={game?.items["22"]?.icon ? <GameImage path={game.items["22"].icon} alt="" className="h-full w-full object-contain p-2" rounded="rounded-none" /> : <span />} />
          <ImageCard href="/bosses" title="Enemies" sub="Weaknesses and pictures" image={game?.items["241"]?.icon ? <GameImage path={game.items["241"].icon} alt="" className="h-full w-full object-contain p-2" rounded="rounded-none" /> : <span />} />
        </CardGrid>
      </section>
    </div>
  );
}
