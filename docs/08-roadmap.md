# 08 · Development roadmap

Live status: the in-app **Dev Status** page (`/status`, source `src/lib/status.ts`).

| Phase | Scope | Status |
| --- | --- | --- |
| 1 Research & architecture | Environment, sources, integration, licensing, schema, docs | Done |
| 2 Foundation & UI | Next.js/TS/Tailwind, Dexie, theme, shell, settings, backup, dashboard | Done |
| 3 Account & inventory | Character/LC/relic databases and inventory, HSR Scanner import, Enka sync, character pages | Done (Enka live-untested) |
| 4 Exploration | Image map system, markers, completion, achievements, missions (codex), collectibles | Done (manual data) |
| 5 Warp Observatory | Tracker, history import, pity, planner, simulator, banners | Done |
| 6 Optimisation | Relic scoring + best-in-slot, team builder + optimizer, materials calculator + farming plan | Done (rule-based) |
| 7 Encyclopedia | Bosses, enemies, NPCs, lore, modes, SU, story, events | Done as codex + game-data directories |
| 8 Silver Wolf AI | Commentary engine, local retrieval terminal, sources | Done locally; external LLM awaiting your decision |
| 9 Refinement | Notifications (in-app), responsive, tests | Partly done; PWA offline shell, desktop notifications, Tauri pending |

## Cannot currently be implemented (and why)

| Feature | Limitation |
| --- | --- |
| Automatic exploration %, treasures, endgame records | Only via unofficial HoYoLAB cookie endpoints: security decision needed |
| Preloaded map markers | No licensed marker dataset; HoYoLAB map not reusable |
| Banner/event schedules as a feed | No licensed feed; manual entry with status labels |
| Community build recommendations | Prydwen et al. not licensed for reuse; per-character profiles instead |
| Damage numbers / rotations | No validated combat simulator; refused to fake |
| Level-up EXP and Trailblaze Power costs | EXP curves and drop rates not in the data source |
| In-app screenshot OCR | No reliable in-browser model; HSR Scanner does it on your PC |
| Equations, domain types, SU rewards | Not in StarRailRes index |

## Next tasks (proposed order)

1. Push to your GitHub repo (waiting for its name).
2. Live-test Enka sync from your machine; adjust the parser if the live format differs.
3. Your decisions: external AI for Silver Wolf (Claude API, opt-in), HoYoLAB cookies, repo licence.
4. PWA: service worker + manifest for full offline use and installability.
5. Total-stat engine (relics + traces + set bonuses), validated against in-game character screens.
6. Joint set-bonus relic optimisation (4pc/2+2 combinations).
7. Desktop notifications; optional Tauri packaging.
