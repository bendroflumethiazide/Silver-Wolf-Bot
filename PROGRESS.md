# Development progress log

## 2026-11-25 · Session 1 (Phases 1–8 foundation)

### Decisions confirmed with you
- Keep code in a GitHub repo you create (name pending; local commits until then).
- Game data downloaded on demand from StarRailRes; nothing bundled.
- IndexedDB-only storage.
- Enka.Network showcase sync built, opt-in.
- Companion is **Silver Wolf** (replaces Pom-Pom), commenting everywhere in her voice.

### Completed
- Research: StarRailRes format and coverage (v4.7.0), HSR Scanner v4 format, UIGF v4/SRGF v1, Enka API rules.
- Warp engine: published rules, calibrated soft-pity model, exact DP planner, seeded simulator, Monte Carlo, history/pity/50-50 analysis.
- Relic engine: stat vocabulary, roll tables derived from game data, per-character scoring profiles with templates, potential projection.
- Materials engine: ascension + trace costs from game tables; original/enhanced kit separation (bug found and fixed on real data: 10 characters would have had doubled costs).
- Importers with keyed diff, manual-entry conflict protection, undo log and rollback; backup/restore/delete.
- All 19 navigation areas plus Import Center and Dev Status, functional with empty/loading/error states.
- Silver Wolf: data-grounded commentary on every page; local retrieval terminal with facts and sources.
- Docs 01–10.

### Verified against real data
- Silver Wolf Lv 80 base stats in-app: HP 1048 / ATK 640 / DEF 461 / SPD 107, and Incessant Rain Lv 80: 1058 / 582 / 463. These match the in-game values.
- Game-data download of 25 files (~5 MB) through the browser with validation: 99 character entries (94 playable), 172 Light Cones, 64 relic sets, 1,993 achievements.

### Test results
- `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm build`: pass (25 routes)
- `pnpm test`: **70/70 passed** (12 files)
- `pnpm test:e2e`: **9/9 passed** (desktop + mobile), stable over repeated runs

### Known limitations
See docs/08-roadmap.md → "Cannot currently be implemented".

### Next
See docs/08-roadmap.md → "Next tasks".

## 2026-11-25 · Session 1, part 2 (your feedback)

### Completed
- **Silver Wolf's voice rewritten** to match her in-game texts (your screenshots): short bursts as separate Messages-style bubbles, shorthand, "just pull" streak. Bubbles type in one by one on every page; terminal redesigned as her Messages window with her signature.
- **Build ratings (D → WTF with −/+)** on the character page: total stats (verified against your in-game build card within rounding), a graded card per relic with roll markers, overall rating, "what this build lacks", her stat-match recommended build, and saved guide builds checked ✓/✗ against your gear. Relic Database cards show the same letter grades. Terminal: "rate my builds".
- **Claude chat** (your choice "use whatever fits"): `claude-opus-5-5`, streaming, low effort for snappy texts, server-side refusal fallbacks, prompt-cached persona, API key server-side only, minimal facts block.
- **HoYoLAB Battle Chronicle sync** (your choice "add it"): read-only; stats, real-time note (Trailblaze Power, Daily Training, SU weekly, Echo of War, assignments) shown on the dashboard, Memory of Chaos / Pure Fiction / Apocalyptic Shadow into Endgame history; cookies only in `.env.local`; CAPTCHA never bypassed.
- **MIT licence** (your choice "whatever you like"), `.env.example`, docs 04/05/06/08/09 updated, new doc 11.

### Test results
- typecheck ✓ · lint ✓ · build ✓ · unit **87/87** · E2E **9/9** (repeat runs stable)

### Blocked
- Push: `bendroflumethiazide/Silver-Wolf-Bot` doesn't exist on GitHub yet, and this session can't create repos.
