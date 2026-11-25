"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/time";

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function Countdown({ to, prefix }: { to: number; prefix?: string }) {
  const now = useNow();
  const left = to - now;
  return (
    <time dateTime={new Date(to).toISOString()} title={new Date(to).toLocaleString()} className="font-mono tabular-nums">
      {prefix}{left > 0 ? formatDuration(left) : "ended"}
    </time>
  );
}
