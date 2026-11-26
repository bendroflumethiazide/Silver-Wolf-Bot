import { characterDisplayName, pathName, type GameData } from "../gamedata/types";

/** Match a Currency Wars character name to a game-data character id (for portraits). */
export function cwCharacterId(name: string, game: GameData | null): string | null {
  if (!game) return null;
  const all = Object.values(game.characters);
  const exact = all.find((c) => characterDisplayName(c) === name);
  if (exact) return exact.id;
  const m = /^(.*?) \(([^)]+)\)$/.exec(name);
  if (m) {
    const [, base, path] = m;
    const byPath = all.filter((c) => (c.name === base || characterDisplayName(c).startsWith(base)) && pathName(c.path) === path);
    if (byPath.length) return byPath.sort((a, b) => Number(a.id) - Number(b.id))[0].id;
  }
  const loose = all.find((c) => c.name.toLowerCase() === name.toLowerCase());
  return loose?.id ?? null;
}
