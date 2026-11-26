# Silver Wolf Bot · Astral Companion

**Your entire Trailblazing journey, in one place.** A personal, local-first Honkai: Star Rail command center, with **Silver Wolf** as your companion. She texts you like she does in-game, treats you like family, rates your builds from D to WTF, and can chat through Claude. Runs as a desktop app on Windows and Linux, or in your browser.

Fan-made personal tool. Not affiliated with HoYoverse. Game content © COGNOSPHERE / HoYoverse.

## What it does

| Area | Highlights |
| --- | --- |
| Home | Prydwen-style hub: your next three steps, image cards for every section (Database, Endgame, Tools, Guides), then your account widgets (customisable) |
| Silver Wolf | Texts you on every page in short Messages-style bursts built from your real numbers (a "data" toggle shows the facts behind each line). A **phone button (bottom right)** opens a chat with her: small talk, "what should I do today?", build ratings, pull advice, "how do I build Acheron?". Choose whether she's your little sister, big sister or daughter and what she calls you. **Real conversation with no setup**: a small AI model runs on your PC (downloads itself once, about 1 GB, then works offline); add an Anthropic key and she switches to Claude. Account answers always come straight from your data |
| Builds | **Community builds from Fribbels' HSR Optimizer** for 96 characters, shown with pictures (Light Cones, relic and ornament sets, main stats per slot, substat order, best teammates), owned or not. Total stats, a D→WTF (−/+) grade for every relic and the whole build, what it lacks, and saved guide builds checked against your gear |
| Account | Multiple profiles; read-only sync from Enka.Network (public showcase, UID only) and the HoYoLAB Battle Chronicle (stats, Trailblaze Power, daily progress, Memory of Chaos / Pure Fiction / Apocalyptic Shadow); connector capability registry |
| Database | 94 characters (element and Path icon filters), 172 Light Cones, 64 relic sets (with who they're for); stats at any level; abilities; traces; Eidolons. **Enemies**: ~270 bosses and enemies with type and weakness filters (from the HSR Wiki; tap one for its wiki page and picture). NPC portraits. **Codes** tracker with official redeem links |
| Endgame | Endgame hub (Memory of Chaos, Pure Fiction, Apocalyptic Shadow, Anomaly Arbitration) with your best runs and teams. **Simulated Universe run simulator** (choose domains, pick blessings, Resonance, curios, occurrences). **Currency Wars**: a full **run simulator** laid out like the game (Investment Environment, Strategies, 3 planes of nodes, shop with odds, Buy XP, Refresh, Lock, On-Field/Off-Field/bench, 3-copy merges, equipment combining, Emblems and gems, Crystal Ores you tap to open, item details with everything an item combines into, an animated battle viewer with HP bars, a turn-order bar with Action Value and 1×/2×/4× speed, Bond Tracking (thumbs-up on matching characters), Bond member portraits, character sheets with every stat (like the game's Stats Details), each ability's values by star and recommended equipment (what you can make now), bonds, bosses, end-of-run goals), a team builder, the equipment combination grid, every Environment/Strategy, and a 10-section guide and a Crystal Ore guide |
| Import Center | HSR Scanner JSON and **Fribbels optimizer save files**; preview → conflicts → approve → apply → rollback. Warp history goes to [Star Rail Station](https://starrailstation.com/en/warp#import) via a button |
| Warp Planner | **Open Warp Tracker** button (Star Rail Station); your current pity and 50/50 guarantee per pool, which feed an exact probability planner with a Monte Carlo cross-check; seeded simulator with animations; banner tracker with confirmed/speculation/leak labels |
| Strategy | Team builder, saved teams, comparison, explainable account-wide optimizer, endgame history charts, materials calculator and farming plan |
| Exploration | Image-based multi-floor map: your screenshots, markers in 25 categories, clustering, filters, completion per zone and planet, map-pack export/import |
| Log | 1,993 achievements (spoiler-safe), events with expiry alerts, Markdown journal with tags, links, reminders and attachments |
| Guides | Short, visual guides in our own words: start here, Warps, leveling, daily routine, elements, Paths, relics, substats, farming, saving, importing |
| Codex | Your notes on bosses, NPCs, lore and missions, with sources and confirmed/speculation status; glossary from game data |

The **Dev Status** page (`/status`) lists every feature as tested, implemented, awaiting integration, blocked or planned, with the reason.

## Desktop app (Windows)

Download from the repository's **Releases** page:

- `Silver-Wolf-Bot-Setup-<version>.exe`: installer with Start-menu and desktop shortcuts.
- `Silver-Wolf-Bot-<version>-portable.exe`: no install, just double-click.

The builds are not code-signed, so Windows SmartScreen may say "Windows protected your PC": choose **More info → Run anyway**.

**Updates:** the app checks GitHub when it starts and shows a banner when a newer version is out. Press **Update** and it downloads the installer, checks its SHA-256 against GitHub's, installs silently and reopens. (The portable exe opens the download page instead.) Turn the check off in **Settings → Desktop app → Updates**.

Your data lives in `%APPDATA%\silver-wolf-bot` and survives updates. In the app, **Settings → Desktop app** stores your Anthropic API key and HoYoLAB cookies encrypted with Windows' own data protection (they're never shown to the page again), and opens the data folder. The app runs its own small server on `127.0.0.1:47923`, reachable only from your PC; links to other sites open in your normal browser.

Build it yourself:

```bash
pnpm install
```

```bash
pnpm desktop:prepare && pnpm dist:win
```

`pnpm desktop` runs it without packaging, `pnpm dist:linux` makes an AppImage. The NSIS installer needs Windows (or Wine); running **Desktop release (Windows)** from the Actions tab (or pushing a tag such as `v1.0.0`) builds both Windows files on a Windows runner and attaches them to a Release (`.github/workflows/desktop-release.yml`). A macOS build has to be made on a Mac.

## Web version (phone or any browser, nothing to install)

**https://bendroflumethiazide.github.io/Silver-Wolf-Bot/** is the same app as a plain website (`pnpm build:web`, published by `.github/workflows/pages.yml`). Your data stays in that browser. No server, so Claude chat, HoYoLAB sync and the Enka fetch are switched off there (import an HSR Scanner file instead). The built-in AI works in desktop Chrome/Edge with a decent graphics card. Phones get a smaller model (Qwen2.5 0.5B, about 300 MB) that only downloads when you tap Download now; if loading it ever crashes the page, it switches itself off instead of crashing again.

## Run it in a browser (from source)

Requirements: Node 20+ and pnpm (npm works too).

```bash
pnpm install
```

```bash
pnpm build && node scripts/prepare-desktop.mjs && node dist-desktop/server/server.js
```

Open http://localhost:3000, go to **Settings → Game data**, tick the notice and press **Download game data** (about 5 MB, stored in your browser only).

For development: `pnpm dev`.

### Optional: Claude chat and HoYoLAB sync

In the desktop app, use **Settings → Desktop app**. In the browser version, copy `.env.example` to `.env.local` (git-ignored) and fill in what you want, then restart the server:

- `ANTHROPIC_API_KEY`: turns on Claude mode in Silver Wolf's chats (model `claude-opus-5-5`, with server-side refusal fallbacks). The key stays on the local server; the browser only sends your question and a compact facts block (roster, pity, resources, build grades; never your UID or name).
- `HOYOLAB_LTUID_V2` and `HOYOLAB_LTOKEN_V2`: cookies from hoyolab.com (dev tools → Application → Cookies). Then enable the sync in Settings → Privacy and press **Sync from HoYoLAB** on My Account. Read-only GET requests only; if HoYoLAB asks for a verification check, you complete it on hoyolab.com yourself. These cookies give access to your HoYoLAB account, so keep `.env.local` private.

## Quality checks

```bash
pnpm typecheck && pnpm lint && pnpm test
```

```bash
pnpm build && pnpm test:e2e
```

(`test:e2e` runs against the same standalone server the desktop app ships.)

- **Unit tests (Vitest):** 180 tests. Warp rules vs published rates, exact DP vs Monte Carlo, simulator statistics over 300k pulls, pity storage, planner, relic scoring, materials, importers, apply/rollback, backup round-trip, Enka parser, map logic, team analysis, time/resets, Silver Wolf commentary grounding, terminal intents, Markdown escaping, build grading and total stats, Claude route (mocked SDK), HoYoLAB connector (mocked fetch), Silver Wolf small talk and family settings, same-origin and loopback-only API guards, chat brain routing and safety rules, updater (version compare, URL allow-list, checksum), Fribbels data and save import, wiki parsing (enemies, Currency Wars tables and character pages), Currency Wars board maths and run simulator (rules, merges, recipes, emblems, gems, ores, battle timelines, economy, seeded replays, a calibration bot), SU simulator, code links.
- **End-to-end (Playwright):** 11 scenarios on desktop and mobile, using a synthetic dataset (no HoYoverse content in the repo). The **Built-in AI check** workflow downloads a real model and chats with it using software WebGPU.

## Privacy in one paragraph

Everything lives in IndexedDB on your machine (the app window's storage in the desktop app). The app never asks for a HoYoverse password and never automates the game; the only secrets it keeps are the optional API key and HoYoLAB cookies you give it (encrypted by the OS in the desktop app). It makes network requests only when you ask it to: **Download game data** (raw.githubusercontent.com), **Fetch showcase** (enka.network, UID only), **Sync from HoYoLAB** (cookies kept by the local server, never sent to the page), and Claude chat (api.anthropic.com). **Open Warp Tracker** opens starrailstation.com in your browser. The built-in AI downloads its model once from huggingface.co and then runs entirely on your PC. The desktop app asks api.github.com for the latest release on launch (can be turned off). **Download enemies** and **Download Currency Wars data** read public pages of the HSR Wiki (honkai-star-rail.fandom.com); enemy pictures stay on the wiki. The syncs are off by default and Claude needs your key. Backup, restore, and "delete all personal data" are in Settings.

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
| [11 Build ratings](docs/11-build-ratings.md) | Grade scale, scoring, total stats (verified), recommended builds |
| [PROGRESS.md](PROGRESS.md) | Development log and phase reports |

## Licence

MIT for the code (see `LICENSE`). Community build data comes from Fribbels' HSR Optimizer (MIT, see `THIRD_PARTY_NOTICES.md`). Game content belongs to HoYoverse and is not part of this repository. Prydwen's content isn't copied; only the layout style inspired the hubs.
