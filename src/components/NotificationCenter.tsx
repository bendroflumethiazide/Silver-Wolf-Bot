"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";
import { getDb, newId, nowIso } from "@/lib/db";
import type { AppNotification } from "@/lib/types";
import { useApp } from "@/lib/store";
import { Button, Empty, Modal } from "./ui";

const HOUR = 3600_000;

/** Create in-app notifications for expiring banners/events and due journal reminders. Idempotent via `dedupe`. */
export async function sweepNotifications(now = Date.now()) {
  const db = getDb();
  const existing = new Set((await db.notifications.toArray()).map((n) => n.dedupe).filter(Boolean));
  const add: AppNotification[] = [];
  const push = (dedupe: string, n: Omit<AppNotification, "id" | "createdAt" | "read" | "dedupe">) => {
    if (existing.has(dedupe)) return;
    existing.add(dedupe);
    add.push({ ...n, id: newId("ntf"), createdAt: nowIso(), read: false, dedupe });
  };
  for (const b of await db.banners.toArray()) {
    const end = Date.parse(b.end), start = Date.parse(b.start);
    if (end > now && end - now < 48 * HOUR) push(`banner-end-${b.id}`, { kind: "banner", title: `Banner ending: ${b.featured5.join(", ") || b.version}`, body: `Ends ${new Date(end).toLocaleString()}.`, href: "/warp?tab=banners" });
    if (start > now && start - now < 24 * HOUR) push(`banner-start-${b.id}`, { kind: "banner", title: `New banner soon: ${b.featured5.join(", ") || b.version}`, body: `Starts ${new Date(start).toLocaleString()}.`, href: "/warp?tab=banners" });
  }
  for (const e of await db.events.toArray()) {
    if (!e.end || e.permanent || e.completion === "completed") continue;
    const end = Date.parse(e.end);
    if (end > now && end - now < 72 * HOUR) push(`event-end-${e.id}`, { kind: "event", title: `Event expiring: ${e.name}`, body: `Ends ${new Date(end).toLocaleString()}.`, href: "/events" });
  }
  for (const n of await db.notes.toArray()) {
    if (n.remindAt && Date.parse(n.remindAt) <= now) push(`note-${n.id}-${n.remindAt}`, { kind: "reminder", title: `Reminder: ${n.title || "Untitled note"}`, body: n.body.slice(0, 140), href: `/journal?note=${n.id}` });
  }
  if (add.length) await db.notifications.bulkAdd(add);
  return add.length;
}

export function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ready = useApp((s) => s.ready);
  const items = useLiveQuery(() => getDb().notifications.orderBy("createdAt").reverse().limit(100).toArray(), []);
  useEffect(() => {
    if (!ready) return;
    void sweepNotifications();
    const id = setInterval(() => void sweepNotifications(), 5 * 60_000);
    return () => clearInterval(id);
  }, [ready]);
  const markAll = () => getDb().notifications.toCollection().modify({ read: true });
  return (
    <Modal open={open} onClose={onClose} title="Notifications">
      <div className="mb-3 flex justify-end gap-2">
        <Button size="sm" onClick={markAll}>Mark all read</Button>
        <Button size="sm" variant="ghost" onClick={() => getDb().notifications.clear()}>Clear</Button>
      </div>
      {!items?.length ? (
        <Empty title="No notifications">Banner and event expiry alerts appear here for entries you track, plus journal reminders.</Empty>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className={`rounded-lg border p-3 text-sm ${n.read ? "border-line text-muted" : "border-violet/40"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-text">{n.title}</div>
                  <div className="text-xs text-muted">{n.body}</div>
                </div>
                <time className="shrink-0 font-mono text-[10px] text-faint">{new Date(n.createdAt).toLocaleDateString()}</time>
              </div>
              <div className="mt-2 flex gap-2">
                {n.href && <Link href={n.href} onClick={() => { void getDb().notifications.update(n.id, { read: true }); onClose(); }} className="text-xs text-cyan hover:underline">Open</Link>}
                {!n.read && <button className="text-xs text-muted hover:text-text" onClick={() => getDb().notifications.update(n.id, { read: true })}>Mark read</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
