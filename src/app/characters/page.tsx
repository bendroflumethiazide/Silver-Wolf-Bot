"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Plus, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { blankOwned } from "@/components/CharacterEditor";
import { GameImage } from "@/components/GameImage";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, cx, Empty, PageHeader, Panel, Stars } from "@/components/ui";
import { characterCollectionComment, noGameData } from "@/lib/companion/comments";
import { getDb } from "@/lib/db";
import { characterDisplayName, elementName, pathName } from "@/lib/gamedata/types";
import { useApp } from "@/lib/store";
import { playableCharacters } from "@/lib/summary";
import { charHref } from "@/lib/links";

type Own = "all" | "owned" | "missing";

export default function CharactersPage() {
  const { game, profileId } = useApp();
  const owned = useLiveQuery(() => getDb().characters.where("profileId").equals(profileId).toArray(), [profileId]);
  const [q, setQ] = useState("");
  const [path, setPath] = useState("");
  const [element, setElement] = useState("");
  const [rarity, setRarity] = useState(0);
  const [own, setOwn] = useState<Own>("all");
  const [build, setBuild] = useState("");
  const [sort, setSort] = useState<"release" | "name" | "level" | "rarity">("release");

  const ownedMap = useMemo(() => new Map((owned ?? []).map((o) => [o.charId, o])), [owned]);
  const all = useMemo(() => playableCharacters(game), [game]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const nick = game?.nicknames.characters ?? {};
    return all
      .filter((c) => !needle || characterDisplayName(c).toLowerCase().includes(needle) || (nick[c.id] ?? []).some((n) => n.toLowerCase().includes(needle)))
      .filter((c) => !path || c.path === path)
      .filter((c) => !element || c.element === element)
      .filter((c) => !rarity || c.rarity === rarity)
      .filter((c) => own === "all" || (own === "owned") === ownedMap.has(c.id))
      .filter((c) => !build || (ownedMap.get(c.id)?.buildStatus ?? "unbuilt") === build)
      .sort((a, b) => {
        if (sort === "name") return characterDisplayName(a).localeCompare(characterDisplayName(b));
        if (sort === "rarity") return b.rarity - a.rarity || Number(b.id) - Number(a.id);
        if (sort === "level") return (ownedMap.get(b.id)?.level ?? -1) - (ownedMap.get(a.id)?.level ?? -1);
        return Number(b.id >= "8000" ? 0 : b.id) - Number(a.id >= "8000" ? 0 : a.id);
      });
  }, [all, q, path, element, rarity, own, build, sort, ownedMap, game]);

  if (!game) return (<><PageHeader title="Characters" /><WolfComment comment={noGameData()} /></>);

  const toggleOwned = async (id: string) => {
    const o = ownedMap.get(id);
    if (o) return; // removal happens in the editor to avoid accidental data loss
    await getDb().characters.put(blankOwned(profileId, id));
  };
  const belowMax = (owned ?? []).filter((o) => o.level < 80).length;

  return (
    <div>
      <PageHeader title="Characters" subtitle={`${all.length} characters. Tap one for kit and recommended build.`} />
      <WolfComment comment={characterCollectionComment(owned?.length ?? 0, all.length, belowMax)} className="mb-5" />
      <Panel className="mb-5">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Element">
            {Object.values(game.elements).map((e) => (
              <button key={e.id} onClick={() => setElement(element === e.id ? "" : e.id)} aria-pressed={element === e.id} title={elementName(e.id)}
                className={cx("rounded-lg border p-1.5 transition", element === e.id ? "border-cyan bg-cyan/15" : "border-line opacity-70 hover:opacity-100")}>
                <GameImage path={e.icon} alt={elementName(e.id)} className="h-6 w-6 object-contain" rounded="rounded-none" />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Path">
            {Object.values(game.paths).map((p) => (
              <button key={p.id} onClick={() => setPath(path === p.id ? "" : p.id)} aria-pressed={path === p.id} title={pathName(p.id)}
                className={cx("rounded-lg border p-1.5 transition", path === p.id ? "border-cyan bg-cyan/15" : "border-line opacity-70 hover:opacity-100")}>
                <GameImage path={p.icon} alt={pathName(p.id)} className="h-6 w-6 object-contain" rounded="rounded-none" />
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <label className="relative col-span-2 sm:col-span-3 lg:col-span-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or nickname" aria-label="Search characters" className="w-full pl-8" />
          </label>
          <select value={rarity} onChange={(e) => setRarity(Number(e.target.value))} aria-label="Rarity"><option value={0}>All rarities</option><option value={5}>5★</option><option value={4}>4★</option></select>
          <select value={own} onChange={(e) => setOwn(e.target.value as Own)} aria-label="Ownership"><option value="all">Owned & missing</option><option value="owned">Owned</option><option value="missing">Not owned</option></select>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort"><option value="release">Newest first</option><option value="rarity">Rarity</option><option value="name">Name</option><option value="level">My level</option></select>
          <select value={build} onChange={(e) => setBuild(e.target.value)} aria-label="Build status"><option value="">Any build status</option><option value="unbuilt">Unbuilt</option><option value="in-progress">In progress</option><option value="built">Built</option></select>
        </div>
      </Panel>
      {!list.length ? <Empty title="No matches">Try clearing a filter.</Empty> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {list.map((c) => {
            const o = ownedMap.get(c.id);
            return (
              <li key={c.id} className={cx("glass group relative overflow-hidden rarity-border", `rarity-${c.rarity}`, !o && "opacity-70 hover:opacity-100")}>
                <Link href={charHref(c.id)} className="block">
                  <GameImage path={c.icon} alt={characterDisplayName(c)} className="aspect-square w-full bg-gradient-to-b from-violet-950/40 to-black/40" rounded="rounded-t-[13px]" />
                  <div className="p-2.5">
                    <div className="truncate text-sm font-medium">{characterDisplayName(c)}</div>
                    <div className="mt-0.5 flex items-center justify-between gap-1 text-[11px] text-muted">
                      <span className="truncate">{pathName(c.path)} · {elementName(c.element)}</span>
                      <Stars n={c.rarity} />
                    </div>
                    {o && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <Badge tone="cyan">Lv {o.level}</Badge>
                        <Badge tone={o.eidolon ? "gold" : "default"}>E{o.eidolon}</Badge>
                        {o.favorite && <Star size={12} className="fill-gold text-gold" aria-label="Favourite" />}
                      </div>
                    )}
                  </div>
                </Link>
                <button
                  onClick={() => toggleOwned(c.id)}
                  className={cx("absolute right-1.5 top-1.5 rounded-md border p-1 backdrop-blur", o ? "border-ok/50 bg-ok/15 text-ok" : "border-line bg-black/50 text-muted opacity-0 group-hover:opacity-100 focus:opacity-100")}
                  aria-label={o ? `${characterDisplayName(c)} owned` : `Mark ${characterDisplayName(c)} as owned`}
                  title={o ? "Owned — edit on the character page" : "Mark as owned"}
                >
                  {o ? <Check size={14} /> : <Plus size={14} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
