import {
  Home, User, Users, Map, Sparkles, Swords, Gem, Disc3, Package, Skull, BookUser, Gamepad2, ScrollText,
  CalendarClock, Trophy, Orbit, MessageSquareCode, NotebookPen, Settings, Upload, Activity, BookOpen,
  Flame, Coins, Ticket, CalendarRange, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** Menu group (Prydwen-style plain names). "" = the top group with no heading. */
  area: "" | "Database" | "Endgame" | "Tools" | "Guides" | "Your log" | "System";
  /** One short line for hub cards. */
  blurb?: string;
}

export const NAV: NavItem[] = [
  { id: "home", href: "/", label: "Home", icon: Home, area: "" },
  { id: "wolf", href: "/terminal", label: "Silver Wolf", icon: MessageSquareCode, area: "", blurb: "Chat with her" },
  { id: "account", href: "/account", label: "My Account", icon: User, area: "", blurb: "Profile, sync, pity" },

  { id: "characters", href: "/characters", label: "Characters", icon: Users, area: "Database", blurb: "Kits, builds, your roster" },
  { id: "light-cones", href: "/light-cones", label: "Light Cones", icon: Disc3, area: "Database", blurb: "Every Light Cone and who uses it" },
  { id: "relics", href: "/relics", label: "Relic Sets", icon: Gem, area: "Database", blurb: "Sets, your relics, ratings" },
  { id: "bosses", href: "/bosses", label: "Enemies", icon: Skull, area: "Database", blurb: "Bosses and enemies with pictures" },
  { id: "npcs", href: "/npcs", label: "NPCs & Lore", icon: BookUser, area: "Database", blurb: "Who's who" },
  { id: "banners", href: "/warp?tab=banners", label: "Banners", icon: CalendarRange, area: "Database", blurb: "Current and upcoming Warps" },
  { id: "codes", href: "/codes", label: "Codes", icon: Ticket, area: "Database", blurb: "Redeem codes you've used" },

  { id: "endgame", href: "/endgame", label: "Endgame", icon: Flame, area: "Endgame", blurb: "MoC, Pure Fiction, Apocalyptic Shadow, Anomaly Arbitration" },
  { id: "universe", href: "/universe", label: "Simulated Universe", icon: Orbit, area: "Endgame", blurb: "Blessings, curios and a run simulator" },
  { id: "currency-wars", href: "/currency-wars", label: "Currency Wars", icon: Coins, area: "Endgame", blurb: "Team builder with bonds" },

  { id: "warp", href: "/warp", label: "Warp Planner", icon: Sparkles, area: "Tools", blurb: "Pity, odds, simulator" },
  { id: "teams", href: "/teams", label: "Builds & Teams", icon: Swords, area: "Tools", blurb: "Team builder and optimizer" },
  { id: "materials", href: "/materials", label: "Materials Planner", icon: Package, area: "Tools", blurb: "What to farm next" },
  { id: "map", href: "/map", label: "World Map", icon: Map, area: "Tools", blurb: "Your markers and completion" },
  { id: "import", href: "/import", label: "Import Center", icon: Upload, area: "Tools", blurb: "HSR Scanner, Fribbels, backups" },

  { id: "guides", href: "/guides", label: "Guides", icon: BookOpen, area: "Guides", blurb: "Beginner to endgame, short and visual" },
  { id: "modes", href: "/game-modes", label: "Game Modes", icon: Gamepad2, area: "Guides", blurb: "What each mode is" },

  { id: "events", href: "/events", label: "Events", icon: CalendarClock, area: "Your log", blurb: "Track and get reminded" },
  { id: "achievements", href: "/achievements", label: "Achievements", icon: Trophy, area: "Your log", blurb: "Spoiler-safe checklist" },
  { id: "story", href: "/story", label: "Story & Missions", icon: ScrollText, area: "Your log" },
  { id: "journal", href: "/journal", label: "Journal", icon: NotebookPen, area: "Your log" },

  { id: "settings", href: "/settings", label: "Settings & Data", icon: Settings, area: "System" },
  { id: "status", href: "/status", label: "Dev Status", icon: Activity, area: "System" },
];

export const AREAS = [...new Set(NAV.map((n) => n.area))];
export const navItem = (id: string) => NAV.find((n) => n.id === id)!;
