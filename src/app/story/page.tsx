"use client";

import { Codex } from "@/components/Codex";
import { WolfComment } from "@/components/SilverWolf";
import { Notice, PageHeader } from "@/components/ui";
import { unsourced } from "@/lib/companion/comments";

export default function StoryPage() {
  return (
    <div>
      <PageHeader title="Story & Missions" subtitle="Trailblaze, Companion, Adventure and Side missions, hidden quests and archived limited-time stories, with your progress." />
      <WolfComment comment={unsourced("Story & Missions")} className="mb-5" />
      <Notice>Set “Availability” to Current or Archived (limited-time), so historical stories stay separate from what you can still play. Entries marked as spoilers stay hidden while spoiler-free mode is on.</Notice>
      <div className="mt-4"><Codex kinds={["mission"]} /></div>
    </div>
  );
}
