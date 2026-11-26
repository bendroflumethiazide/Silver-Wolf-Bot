"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Tabs, Loading } from "@/components/ui";
import { WarpBanners } from "@/components/warp/Banners";
import { WarpPlanner } from "@/components/warp/Planner";
import { WarpSimulator } from "@/components/warp/Simulator";
import { PityPanel, WarpTrackerButton } from "@/components/warp/Pity";

type Tab = "pity" | "planner" | "simulator" | "banners";
const TABS: { id: Tab; label: string }[] = [
  { id: "pity", label: "My pity" }, { id: "planner", label: "Planner" }, { id: "simulator", label: "Simulator" }, { id: "banners", label: "Banners" },
];

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "pity") as Tab;
  return (
    <div>
      <PageHeader title="Warp Planner" subtitle="Your pity, your odds, a simulator and banners." actions={<WarpTrackerButton size="sm" variant="subtle" />} />
      <Tabs<Tab> tabs={TABS} value={tab} onChange={(t) => router.replace(`/warp?tab=${t}`, { scroll: false })} />
      {tab === "pity" && <PityPanel />}
      {tab === "planner" && <WarpPlanner />}
      {tab === "simulator" && <WarpSimulator />}
      {tab === "banners" && <WarpBanners />}
    </div>
  );
}

export default function WarpPage() {
  return <Suspense fallback={<Loading />}><Inner /></Suspense>;
}
