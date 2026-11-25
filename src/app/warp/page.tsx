"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Tabs, Loading } from "@/components/ui";
import { WarpBanners } from "@/components/warp/Banners";
import { WarpPlanner } from "@/components/warp/Planner";
import { WarpSimulator } from "@/components/warp/Simulator";
import { WarpTracker } from "@/components/warp/Tracker";

type Tab = "tracker" | "planner" | "simulator" | "banners";
const TABS: { id: Tab; label: string }[] = [
  { id: "tracker", label: "My Warps" }, { id: "planner", label: "Planner" }, { id: "simulator", label: "Simulator" }, { id: "banners", label: "Banners" },
];

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "tracker") as Tab;
  return (
    <div>
      <PageHeader title="Warp Observatory" subtitle="Real pity tracking, exact pull probabilities, and a sandbox simulator. Separate pity pools are never combined." />
      <Tabs<Tab> tabs={TABS} value={tab} onChange={(t) => router.replace(`/warp?tab=${t}`, { scroll: false })} />
      {tab === "tracker" && <WarpTracker />}
      {tab === "planner" && <WarpPlanner />}
      {tab === "simulator" && <WarpSimulator />}
      {tab === "banners" && <WarpBanners />}
    </div>
  );
}

export default function WarpPage() {
  return <Suspense fallback={<Loading />}><Inner /></Suspense>;
}
