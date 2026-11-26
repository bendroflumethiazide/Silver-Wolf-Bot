"use client";

import { WolfComment } from "@/components/SilverWolf";
import type { EndgameRecord } from "@/lib/types";

/** One short Silver Wolf line about your endgame logs. */
export function EndgameComment({ records }: { records: EndgameRecord[] }) {
  const n = records.length;
  const line = !n ? "U haven't logged a single run|Endgame or it didn't happen|Sync HoYoLAB or log one" : n < 4 ? `${n} run${n === 1 ? "" : "s"} logged|Keep going, I'm tracking ur progress` : `${n} runs logged|Ok tryhard ;)|Check which team keeps carrying`;
  return <WolfComment comment={{ mood: n ? "smug" : "neutral", line, facts: [`${n} endgame record(s) on this device.`] }} />;
}
