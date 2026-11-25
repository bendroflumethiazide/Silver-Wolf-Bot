import {
  Terminal, User, Users, Map, Sparkles, Swords, Gem, Disc3, Package, Skull, BookUser, Gamepad2, ScrollText,
  CalendarClock, Trophy, Orbit, MessageSquareCode, NotebookPen, Settings, Upload, Activity, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** Astral Express themed area this page belongs to. */
  area: "Express Terminal" | "The Archives" | "Navigation Room" | "Warp Observatory" | "Strategy Room" | "Trailblazer's Log" | "System";
}

export const NAV: NavItem[] = [
  { id: "home", href: "/", label: "Express Terminal", icon: Terminal, area: "Express Terminal" },
  { id: "wolf", href: "/terminal", label: "Silver Wolf", icon: MessageSquareCode, area: "Express Terminal" },
  { id: "account", href: "/account", label: "My Account", icon: User, area: "Express Terminal" },
  { id: "characters", href: "/characters", label: "Character Archive", icon: Users, area: "The Archives" },
  { id: "light-cones", href: "/light-cones", label: "Light Cones", icon: Disc3, area: "The Archives" },
  { id: "relics", href: "/relics", label: "Relics", icon: Gem, area: "The Archives" },
  { id: "bosses", href: "/bosses", label: "Bosses & Enemies", icon: Skull, area: "The Archives" },
  { id: "npcs", href: "/npcs", label: "NPCs & Lore", icon: BookUser, area: "The Archives" },
  { id: "map", href: "/map", label: "World Map", icon: Map, area: "Navigation Room" },
  { id: "warp", href: "/warp", label: "Warp Observatory", icon: Sparkles, area: "Warp Observatory" },
  { id: "teams", href: "/teams", label: "Builds & Teams", icon: Swords, area: "Strategy Room" },
  { id: "materials", href: "/materials", label: "Materials & Farming", icon: Package, area: "Strategy Room" },
  { id: "modes", href: "/game-modes", label: "Game Modes", icon: Gamepad2, area: "Strategy Room" },
  { id: "universe", href: "/universe", label: "Simulated Universe", icon: Orbit, area: "Strategy Room" },
  { id: "story", href: "/story", label: "Story & Missions", icon: ScrollText, area: "Trailblazer's Log" },
  { id: "events", href: "/events", label: "Events", icon: CalendarClock, area: "Trailblazer's Log" },
  { id: "achievements", href: "/achievements", label: "Achievements", icon: Trophy, area: "Trailblazer's Log" },
  { id: "journal", href: "/journal", label: "Journal", icon: NotebookPen, area: "Trailblazer's Log" },
  { id: "import", href: "/import", label: "Import Center", icon: Upload, area: "System" },
  { id: "status", href: "/status", label: "Dev Status", icon: Activity, area: "System" },
  { id: "settings", href: "/settings", label: "Settings & Data", icon: Settings, area: "System" },
];

export const AREAS = [...new Set(NAV.map((n) => n.area))];
