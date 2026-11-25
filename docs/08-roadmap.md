# 08 · Development roadmap

Live status: the in-app **Dev Status** page (`/status`, source `src/lib/status.ts`).

| Phase | Scope | Status |
| --- | --- | --- |
| 1 Research & architecture | Environment, sources, integration, licensing, schema, docs | Done |
| 2 Foundation & UI | Next.js/TS/Tailwind, Dexie, theme, shell, settings, backup, dashboard | Done |
| 3 Account & inventory | Character/LC/relic databases and inventory, HSR Scanner import, Enka sync, character pages | Done (Enka live-untested) |
| 4 Exploration | Image map system, markers, completion, achievements, missions (codex), collectibles | Done (manual data) |
| 5 Warp Observatory | Star Rail Station tracker button, your pity per pool, planner, simulator, banners | Done (history tracking handed to Star Rail Station at your request) |
| 6 Optimisation | Relic scoring + best-in-slot, team builder + optimizer, materials calculator + farming plan | Done (rule-based) |
| 7 Encyclopedia | Bosses, enemies, NPCs, lore, modes, SU, story, events | Done as codex + game-data directories |
| 8 Silver Wolf AI | Texting voice, local retrieval terminal, phone chat with family small talk, built-in on-device AI, Claude chat, build ratings | Done (built-in AI needs a WebGPU-capable GPU; Claude needs your key) |
| 9 Refinement | Notifications (in-app), responsive, tests, desktop app, updates | Windows/Linux desktop app with one-click updates done; PWA offline shell, OS notifications and a macOS build pending |

## Cannot currently be implemented (and why)

| Feature | Limitation |
| --- | --- |
| Per-treasure map completion | Not exposed by HoYoLAB or any source; map tracking stays manual |
| Preloaded map markers | No licensed marker dataset; HoYoLAB map not reusable |
| Banner/event schedules as a feed | No licensed feed; manual entry with status labels |
| Community build recommendations | Prydwen et al. not licensed for reuse; per-character profiles instead |
| Damage numbers / rotations | No validated combat simulator; refused to fake |
| Level-up EXP and Trailblaze Power costs | EXP curves and drop rates not in the data source |
| In-app screenshot OCR | No reliable in-browser model; HSR Scanner does it on your PC |
| Equations, domain types, SU rewards | Not in StarRailRes index |

## Next tasks (proposed order)

1. Create the GitHub repo `bendroflumethiazide/Silver-Wolf-Bot` (it doesn't exist yet) so the code can be pushed.
2. Live-test Enka and HoYoLAB sync and Claude chat from your machine; adjust parsers if live formats differ.
3. Per-character default scoring weights you trust (from your guides) to replace Path templates.
4. PWA: service worker + manifest for full offline use and installability.
5. Conditional buffs in total stats (needs a per-effect model).
6. Joint set-bonus relic optimisation (4pc/2+2 combinations).
7. Desktop notifications; optional Tauri packaging.
