/** Bond membership helpers shared by the simulator, the team builder and Bond Tracking. */
import { emblemBond } from "./items";
import type { CwPack } from "./sim";

/** "Phantasmoon Games: Wishpower" → "Phantasmoon Games" (per-game variants share one family). */
export const bondFamily = (name: string) => name.replace(/: .*$/, "");

/** Every Bond once (variants collapsed), in the wiki's order. */
export const bondNames = (pack: CwPack) => [...new Set(pack.bonds.map((b) => bondFamily(b.name)))];

/** Bonds a character belongs to: from their own page, else from the bond lists. */
export function bondsOf(pack: CwPack, name: string): string[] {
  const fromPage = pack.info?.[name]?.bonds;
  if (fromPage?.length) return fromPage;
  return [...new Set(pack.bonds.filter((b) => b.members.includes(name)).map((b) => bondFamily(b.name)))];
}

/** Members of a Bond (family name or exact name). */
export function membersOf(pack: CwPack, bond: string): string[] {
  const fam = bondFamily(bond);
  const fromLists = pack.bonds.filter((b) => bondFamily(b.name) === fam).flatMap((b) => b.members);
  const fromPages = pack.characters.filter((c) => pack.info?.[c.name]?.bonds.includes(fam)).map((c) => c.name);
  return [...new Set([...fromLists, ...fromPages])];
}

/** Which of the tracked Bonds this character (and the Emblems they wear) belongs to. */
export function trackedMatches(pack: CwPack, name: string, tracked: string[], items: string[] = []): string[] {
  if (!tracked.length) return [];
  const own = new Set([...bondsOf(pack, name), ...membersIn(pack, name), ...items.map((i) => emblemBond(pack, i)).filter((b): b is string => !!b).map(bondFamily)]);
  return tracked.filter((t) => own.has(t));
}
const membersIn = (pack: CwPack, name: string) => pack.bonds.filter((b) => b.members.includes(name)).map((b) => bondFamily(b.name));
