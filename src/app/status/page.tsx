"use client";

import { Badge, PageHeader, Panel, Stat } from "@/components/ui";
import { FEATURES, type DevStatus } from "@/lib/status";

const TONE: Record<DevStatus, "ok" | "cyan" | "violet" | "warn" | "bad" | "default"> = {
  tested: "ok", implemented: "cyan", "in-development": "violet", "awaiting-integration": "warn", blocked: "bad", planned: "default",
};
const ORDER: DevStatus[] = ["tested", "implemented", "in-development", "awaiting-integration", "blocked", "planned"];

export default function StatusPage() {
  const areas = [...new Set(FEATURES.map((f) => f.area))];
  return (
    <div className="space-y-5">
      <PageHeader title="Development Status" subtitle="What works, what is tested, and what is blocked or planned. “Tested” means covered by automated tests." />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {ORDER.map((s) => <Stat key={s} label={s.replace("-", " ")} value={FEATURES.filter((f) => f.status === s).length} />)}
      </div>
      {areas.map((a) => (
        <Panel key={a} title={a}>
          <ul className="divide-y divide-line">
            {FEATURES.filter((f) => f.area === a).map((f) => (
              <li key={f.feature} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Badge tone={TONE[f.status]}>{f.status.replace("-", " ")}</Badge>
                <span className="min-w-0 flex-1">{f.feature}</span>
                {f.note && <span className="w-full text-xs text-muted sm:w-auto">{f.note}</span>}
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}
