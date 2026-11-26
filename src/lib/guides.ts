/** Guide index. Content lives in src/components/guides/GuideContent.tsx (own words, game data, app rules). */
export interface GuideMeta {
  slug: string;
  section: "Beginner" | "Game knowledge" | "Gearing" | "Planning";
  title: string;
  blurb: string;
  /** Picture source for the card. */
  image: { kind: "item"; id: string } | { kind: "character"; id: string } | { kind: "element" } | { kind: "path" } | { kind: "relicSet"; id: string };
  /** Cards that just open another page. */
  href?: string;
}

export const GUIDES: GuideMeta[] = [
  { slug: "start-here", section: "Beginner", title: "Start here", blurb: "Set up the app in five minutes", image: { kind: "character", id: "1006" } },
  { slug: "warps", section: "Beginner", title: "How Warps work", blurb: "Pity, 50/50 and guarantees", image: { kind: "item", id: "102" } },
  { slug: "leveling", section: "Beginner", title: "Leveling a character", blurb: "Levels, ascension, traces, Eidolons", image: { kind: "item", id: "213" } },
  { slug: "daily", section: "Beginner", title: "Daily routine", blurb: "Spend Trailblaze Power well", image: { kind: "item", id: "11" } },

  { slug: "elements", section: "Game knowledge", title: "Elements", blurb: "The seven damage types", image: { kind: "element" } },
  { slug: "paths", section: "Game knowledge", title: "Paths", blurb: "What each role does", image: { kind: "path" } },
  { slug: "modes", section: "Game knowledge", title: "Game modes", blurb: "What each mode is for", image: { kind: "item", id: "33" }, href: "/game-modes" },
  { slug: "endgame", section: "Game knowledge", title: "Endgame", blurb: "Your endgame hub", image: { kind: "item", id: "241" }, href: "/endgame" },

  { slug: "relics-101", section: "Gearing", title: "Relics 101", blurb: "Slots, sets, main stats", image: { kind: "relicSet", id: "114" } },
  { slug: "substats", section: "Gearing", title: "Substats and rolls", blurb: "What a good relic looks like", image: { kind: "relicSet", id: "101" } },
  { slug: "farming", section: "Gearing", title: "Farming relics", blurb: "Where sets and ornaments drop", image: { kind: "item", id: "235" } },

  { slug: "saving", section: "Planning", title: "Saving for a banner", blurb: "Count pulls before you spend", image: { kind: "item", id: "1" } },
  { slug: "import", section: "Planning", title: "Bring in your account", blurb: "HSR Scanner, Fribbels, Enka", image: { kind: "item", id: "235" } },
];

export const GUIDE_SECTIONS = ["Beginner", "Game knowledge", "Gearing", "Planning"] as const;
export const guide = (slug: string) => GUIDES.find((g) => g.slug === slug);
