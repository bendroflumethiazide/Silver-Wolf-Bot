"use client";

import { FRIBBELS } from "@/lib/builds/fribbels";
import { WIKI } from "@/lib/wiki/fandom";
import { Panel } from "./ui";

/** Sources and licences, as their terms ask. */
export function Credits() {
  const row = (name: string, href: string, what: string, terms: string) => (
    <li className="flex flex-col gap-0.5 border-b border-line/50 py-2 sm:flex-row sm:items-baseline sm:gap-3">
      <a href={href} target="_blank" rel="noreferrer" className="w-56 shrink-0 font-medium text-cyan hover:underline">{name}</a>
      <span className="flex-1 text-muted">{what}</span>
      <span className="text-xs text-faint">{terms}</span>
    </li>
  );
  return (
    <Panel title="Credits & licences" id="credits">
      <ul className="text-sm">
        {row("Fribbels HSR Optimizer", FRIBBELS.url, "Community builds: substat weights, main stats, sets, teammates, default Light Cones", "MIT License, Copyright (c) 2024 Fribbels")}
        {row("StarRailRes", "https://github.com/Mar-7th/StarRailRes", "Game data and images (downloaded by you)", "AGPL-3.0")}
        {row(WIKI.name, "https://honkai-star-rail.fandom.com", "Enemy pictures and weaknesses, Currency Wars data (downloaded by you)", WIKI.license)}
        {row("WebLLM + Qwen models", "https://github.com/mlc-ai/web-llm", "Built-in AI that runs on your device", "Apache-2.0")}
        {row("Silver Wolf Bot", "https://github.com/bendroflumethiazide/Silver-Wolf-Bot", "This app", "MIT")}
      </ul>
      <p className="mt-2 text-xs text-faint">Game content © COGNOSPHERE / HoYoverse. Fan-made, not affiliated. Full notices: THIRD_PARTY_NOTICES.md in the repository.</p>
    </Panel>
  );
}
