# Astral Companion

**Your entire Trailblazing journey, in one place.** A personal, local-first Honkai: Star Rail command center, with **Silver Wolf** as your companion.

Fan-made personal tool. Not affiliated with HoYoverse. Game content © COGNOSPHERE / HoYoverse.

## What it does

| Area | Highlights |
| --- | --- |
| Express Terminal | Customisable dashboard, objectives derived from your data, resources, server-aware daily/weekly reset countdowns |
| Silver Wolf | Comments on every page in her voice, built from your real numbers (a "data" toggle shows the facts behind each line), plus a local terminal that answers questions with sources |
| Account | Multiple profiles; optional read-only public showcase sync via Enka.Network (UID only, no login); connector capability registry |
| Archives | 94 characters, 172 Light Cones, 64 relic sets from game data; stats at any level; abilities; traces (original and enhanced kits); Eidolons |
| Relics | Inventory, per-character scoring profiles with transparent maths, best-in-slot per slot, 2pc/4pc database |
| Import Center | HSR Scanner JSON (the format Fribbels imports), UIGF v4 / SRGF v1 / CSV Warp history; preview → conflicts → approve → apply → rollback |
| Warp Observatory | Pity tracking per pool, 50/50 history, exact probability planner, Monte Carlo cross-check, seeded simulator with animations, banner tracker with confirmed/speculation/leak labels |
| Strategy | Team builder, saved teams, comparison, explainable account-wide optimizer, endgame history charts, materials calculator and farming plan |
| Exploration | Image-based multi-floor map: your screenshots, markers in 25 categories, clustering, filters, completion per zone and planet, map-pack export/import |
| Log | 1,993 achievements (spoiler-safe), events with expiry alerts, Markdown journal with tags, links, reminders and attachments |
| Codex | Bosses, enemies, NPCs, lore, missions and game modes, each with sources and confirmed/speculation/fan-theory status; NPC directory and glossary from game data |

The **Dev Status** page (`/status`) lists every feature as tested, implemented, awaiting integration, blocked or planned, with the reason.

## Run it

Requirements: Node 20+ and pnpm (npm works too).

```bash
pnpm install
```

```bash
pnpm build && pnpm start
```

Open http://localhost:3000, go to **Settings → Game data**, tick the notice and press **Download game data** (about 5 MB, stored in your browser only).

For development: `pnpm dev`.

## Quality checks

```bash
pnpm typecheck && pnpm lint && pnpm test
```

```bash
pnpm build && pnpm test:e2e
```

- **Unit tests (Vitest):** 70 tests. Warp rules vs published rates, exact DP vs Monte Carlo, simulator statistics over 300k pulls, pity/50-50 history, planner, relic scoring, materials, importers, apply/rollback, backup round-trip, Enka parser, map logic, team analysis, time/resets, Silver Wolf commentary grounding, terminal intents, Markdown escaping.
- **End-to-end (Playwright):** 9 scenarios on desktop and mobile, using a synthetic dataset (no HoYoverse content in the repo).

## Privacy in one paragraph

Everything lives in your browser's IndexedDB. The app never asks for a HoYoverse password, stores no credentials and never automates the game. It makes network requests only when you ask it to: **Download game data** (raw.githubusercontent.com) and **Fetch showcase** (enka.network, sends only your UID, off by default). Backup, restore, and "delete all personal data" are in Settings.

## Documentation

| Doc | Contents |
| --- | --- |
| [01 Architecture](docs/01-architecture.md) | Stack, decisions (ADRs), folder structure, data flow, feature dependency diagram |
| [02 Database schema](docs/02-database-schema.md) | Every IndexedDB table and index |
| [03 Data sources](docs/03-data-sources.md) | Source-by-source assessment |
| [04 Account integration](docs/04-account-integration.md) | What can and cannot be synchronised, and why |
| [05 Security & privacy](docs/05-security-privacy.md) | Threat model and controls |
| [06 Licensing](docs/06-licensing.md) | AGPL / HoYoverse IP handling |
| [07 UI/UX specification](docs/07-ui-ux-spec.md) | Visual system and interaction rules |
| [08 Roadmap](docs/08-roadmap.md) | Phases, status, limitations, next tasks |
| [09 Silver Wolf voice](docs/09-silver-wolf-voice.md) | Character brief and writing rules for her lines |
| [10 Warp maths](docs/10-warp-math.md) | Rates, soft-pity model, verification |
| [PROGRESS.md](PROGRESS.md) | Development log and phase reports |
