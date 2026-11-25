import { SERVER_OFFSET, type Server } from "./store";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Next daily reset: 04:00 in the server's fixed UTC offset. */
export function nextDailyReset(server: Server, now = Date.now()): number {
  const off = SERVER_OFFSET[server] * HOUR;
  const local = now + off; // shift so UTC fields read as server-local time
  const d = new Date(local);
  let reset = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 4) - off;
  if (reset <= now) reset += DAY;
  return reset;
}

/** Next weekly reset: Monday 04:00 server time. */
export function nextWeeklyReset(server: Server, now = Date.now()): number {
  let t = nextDailyReset(server, now);
  const off = SERVER_OFFSET[server] * HOUR;
  while (new Date(t + off).getUTCDay() !== 1) t += DAY;
  return t;
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "now";
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

/** Trailblaze Power regenerates 1 per 6 minutes (published), capped at the reserve max entered by the user. */
export function trailblazePowerAt(current: number, recordedAt: number, cap = 300, now = Date.now()): number {
  if (current >= cap) return current;
  return Math.min(cap, current + Math.floor((now - recordedAt) / (6 * 60_000)));
}
