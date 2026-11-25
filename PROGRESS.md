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

## 2026-11-25 · Session 1, part 3 (desktop app)

### Completed
- **Warp tracker is now a button** (your request): **Open Warp Tracker** opens [Star Rail Station](https://starrailstation.com/en/warp#import) from Warp, Import Center and Dashboard. The internal history tracker and UIGF/SRGF/CSV importer were removed. You enter your current pity and 50/50 guarantee per pool (My pity tab); the planner, dashboard objective and Silver Wolf use it.
- **Silver Wolf as family** (your request): a phone button at the bottom right opens a chat with her on every page; small talk (greetings, late-night nagging, "I'm tired", jokes, thanks, bye...), "what should I do today?", build ratings, pull advice. Settings in the chat: she's your little sister, big sister or daughter, and what she calls you. Strictly familial in local lines and in the Claude prompt. History is saved per profile; she greets you when you come back after a while or something urgent is up. The full-size chat (/terminal) shares the same thread.
- **Desktop app**: Electron, Windows installer + portable exe, Linux AppImage; secrets encrypted by the OS; local server on 127.0.0.1 only; external links open in your browser. GitHub Actions workflow builds the Windows installer on a Windows runner.
- **Bug pass**: API routes reject cross-site requests (and non-loopback Hosts in the desktop app); exact-origin checks for navigation and IPC; repeated small-talk replies varied; packaged-server layout fixed (electron-builder was dropping the server's `node_modules`).

### Test results
- typecheck ✓ · lint ✓ · build ✓ · unit **90/90** · E2E **10/10** against the standalone server the desktop app ships · packaged Linux app smoke-tested (window opens, tracker button, secrets save/remove, server restarts and exits cleanly).

### Not possible here
- NSIS installer: needs Windows (Wine crashes in this sandbox), so the release workflow builds it. The portable exe built here has the default Electron icon for the same reason.
- macOS build: needs a Mac.
