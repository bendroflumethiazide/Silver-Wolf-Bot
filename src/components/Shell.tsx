"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Bell, ChevronsLeft, ChevronsRight, Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { getDb } from "@/lib/db";
import { AREAS, NAV } from "@/lib/nav";
import { useApp } from "@/lib/store";
import { WolfAvatar } from "./SilverWolf";
import { cx, ErrorBox, Loading } from "./ui";
import { NotificationCenter } from "./NotificationCenter";
import { PhoneChat } from "./chat/PhoneChat";

function NavLinks({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const hidden = useApp((s) => s.settings.hiddenNav);
  return (
    <nav aria-label="Main" className="flex flex-col gap-4">
      {AREAS.map((area) => {
        const items = NAV.filter((n) => n.area === area && !hidden.includes(n.id));
        if (!items.length) return null;
        return (
          <div key={area}>
            {!collapsed && <div className="mb-1 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">{area}</div>}
            <ul className="flex flex-col gap-0.5">
              {items.map((n) => {
                const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
                const Icon = n.icon;
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={onNavigate}
                      title={collapsed ? n.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cx("group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                        active ? "bg-gradient-to-r from-violet/20 to-transparent text-text shadow-[inset_2px_0_0_var(--cyan)]" : "text-muted hover:bg-white/5 hover:text-text",
                        collapsed && "justify-center px-0")}
                    >
                      <Icon size={17} className={cx(active ? "text-cyan" : "text-faint group-hover:text-violet")} />
                      {!collapsed && <span className="truncate">{n.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2">
      <WolfAvatar size={34} />
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-wide text-gradient">SILVER WOLF BOT</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Astral Companion</div>
        </div>
      )}
    </Link>
  );
}

function ProfileSwitch() {
  const profileId = useApp((s) => s.profileId);
  const setProfile = useApp((s) => s.setProfile);
  const profiles = useLiveQuery(() => getDb().profiles.toArray(), []);
  if (!profiles || profiles.length < 2) return null;
  return (
    <select aria-label="Active profile" value={profileId} onChange={(e) => setProfile(e.target.value)} className="max-w-[10rem] py-1 text-xs">
      {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}{p.uid ? ` · ${p.uid}` : ""}</option>)}
    </select>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { ready, error, init, settings, updateSettings } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const unread = useLiveQuery(() => getDb().notifications.filter((n) => !n.read).count(), [], 0);
  const collapsed = settings.sidebarCollapsed;

  useEffect(() => { void init(); }, [init]);
  useEffect(() => { document.documentElement.dataset.reducedMotion = String(settings.reducedMotion); }, [settings.reducedMotion]);

  return (
    <div className="starfield scanlines relative min-h-dvh">
      {/* Desktop sidebar */}
      <aside className={cx("fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-[rgba(8,7,18,.82)] backdrop-blur-xl lg:flex", collapsed ? "w-[68px]" : "w-64")}>
        <div className="flex h-16 items-center justify-between border-b border-line px-3"><Brand collapsed={collapsed} /></div>
        <div className="flex-1 overflow-y-auto px-2 py-4"><NavLinks collapsed={collapsed} /></div>
        <button
          onClick={() => updateSettings({ sidebarCollapsed: !collapsed })}
          className="flex h-11 items-center justify-center gap-2 border-t border-line text-xs text-muted hover:text-text"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> Collapse</>}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-[var(--night)]">
            <div className="flex h-14 items-center justify-between border-b border-line px-3">
              <Brand collapsed={false} />
              <button onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="p-2 text-muted"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-4"><NavLinks collapsed={false} onNavigate={() => setMobileOpen(false)} /></div>
          </div>
        </div>
      )}

      <div className={cx("relative z-10 flex min-h-dvh flex-col", collapsed ? "lg:pl-[68px]" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-[rgba(5,5,11,.72)] px-4 backdrop-blur-xl lg:h-16 lg:px-6">
          <button className="-ml-1 p-1.5 text-muted lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="lg:hidden"><Brand collapsed /></div>
          <div className="flex-1" />
          <ProfileSwitch />
          <button onClick={() => setBellOpen(true)} className="relative rounded-lg p-2 text-muted hover:bg-white/5 hover:text-text" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
            <Bell size={18} />
            {!!unread && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-magenta" />}
          </button>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8">
          {!ready ? <Loading label="Booting terminal" /> : error ? <ErrorBox>Local database failed to open: {error}. Private browsing or blocked site data can prevent storage.</ErrorBox> : children}
        </main>
        <footer className="border-t border-line px-4 py-3 pr-24 text-center text-[11px] text-faint lg:px-8 lg:pr-24">
          Fan-made personal tool. Not affiliated with HoYoverse. Game content © COGNOSPHERE / HoYoverse. Your data stays on this device.
        </footer>
      </div>
      <NotificationCenter open={bellOpen} onClose={() => setBellOpen(false)} />
      {ready && !error && <PhoneChat />}
    </div>
  );
}
