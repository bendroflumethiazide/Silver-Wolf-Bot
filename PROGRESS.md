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

## 2026-11-26 · Session 1, part 5 (Prydwen/Fribbels-style overhaul, 1.2.0)

### Completed
- **Community builds (Fribbels, MIT):** substat weights, main stats, relic/ornament sets, teammates and default Light Cone for 96 characters, extracted by script at a pinned commit and validated against game data. Default scoring profile; picture build box on every character page (owned or not); Silver Wolf answers "how do I build X?".
- **Prydwen-style UI:** plain-language menu groups, Home hub with image cards and next steps, Guides hub (own text), Endgame hub, compact Silver Wolf comments, icon filters, "How this works" folds.
- **Enemies with pictures** (HSR Wiki, ~270, type and weakness filters), bigger NPC portraits, **Codes** tracker.
- **Simulated Universe run simulator** (blessing Path/rarity decoded from ids; stated assumptions for odds) and **Currency Wars simulator** (wiki characters, bonds, shop odds; live bonds, gold, shop practice).
- **Fribbels save import** in the Import Center.
- Bugs found and fixed on the way: nested wiki template text lost in cleanup; date-dependent small-talk test; enemy names matched inside other words.

### Test results
- typecheck ✓ · lint ✓ · unit **136/136** · E2E **11/11** on both the server build and the static web edition; phone-width checks for every new page; live downloads checked (enemies 269, Currency Wars 60 characters / 36 bonds).

### Not possible / limits
- Prydwen blocks automated access (Cloudflare) and its content isn't licensed, so nothing is copied; the user supplied screenshots for layout reference.
- SU offer odds and Currency Wars shop slot counts aren't published; the simulators state their assumptions.

## 2026-11-26 · 1.6.1 Recommended equipment

- Every character's recommended equipment (from their wiki page, by On-Field / Off-Field, or by form for Dan Heng) now shows on the selected character in the simulator (like the game's card), near the top of the character sheet with each item's recipe, and as icons on team-builder rows.
- Each item says whether it's equipped, can be made now from your items, or you have one part; tapping it opens the item's details and combinations.
- Bag items that are (or make) recommended equipment for a deployed character get a ★, with who it's for.
- Checked: all 58 characters have recommendations and all 249 recommended items match the equipment data.

### Test results
- typecheck ✓ · lint ✓ · unit **172/172** · E2E **13/13** on both builds; real data checked at desktop and phone width.

## 2026-11-26 · 1.6.0 Character stats and abilities

- **Character sheets** (Details on a selected unit in the simulator; the ⓘ button in the team builder): every stat from the game's Stats Details: On-/Off-Field Strength, DMG Amplification with its eight parts, DMG Mitigation, Lucky Strike Rate (base 5%) and DMG (base 100%), SPD Amplification, Healing and Shield Strength, HP Amplification, each with base by star and the boost from held equipment. Checked against the game's screen for Topaz & Numby.
- **Abilities** from each character's wiki page, grouped On Field / Off Field (or by cost for Aeon ★ Aha), with the selected star's value highlighted in "a/b/c" numbers; infobox summaries with Energy; Off-Field Eidolons, signature Light Cone, recommended equipment (held ones marked) and gameplay notes. Hidden damage multipliers (base DMG Amplification and per-Eidolon) shown from the wiki's damage formula.
- Battle viewer: characters with higher SPD Amplification now take more turns.
- Parser fixes found on real pages: a wiki typo ("||" inside a template) split a table cell; names in {{Enemy}}/{{Extra Effect}} templates were dropped.

### Test results
- typecheck ✓ · lint ✓ · unit **170/170** · E2E **13/13** on the server build and the static web edition (character sheet: stats, ability tabs, star highlighting). All 58 character pages parse; desktop and phone checked on real data with no errors or overflow.

## 2026-11-26 · 1.5.0 Bond Tracking, turn order, Bond members

- **Bond Tracking** (like the game's): pick Bonds to track in the shop bar or the team builder; every character in a tracked Bond (or wearing its Emblem) gets a thumbs-up in the shop, Supply, board, bench and character list. Saved on the device, shared by both tabs.
- **Turn order** in the battle viewer, like the game's left-hand bar: who's acting, the next turns of squad and enemies, Action Value until each (toggle "AV"), and the current cycle. Vertical on desktop, a strip on phones.
- **Bond members:** opening a Bond (in the Bonds list, or a selected character's Bond tags) shows every member as a small portrait, owned ones bright, with a Track button.

### Test results
- typecheck ✓ · lint ✓ · unit **166/166** · E2E **13/13** on the server build and the static web edition (tracking marks, member portraits, turn order and AV toggle). Checked on real wiki data at desktop and phone width: no console errors, no horizontal overflow.

## 2026-11-26 · 1.4.0 Currency Wars items, ores and battle viewer

- **Bug fixed:** Investment Environments that grant Emblems (e.g. "Labor Dispatch Contract": "Gain a random emblem…") gave nothing, because Emblems weren't modelled. Emblems are now parsed from the wiki (21), land in Items, put their wearer in their Bond (counting toward it), and Labor Dispatch Contract also gives a character of that Bond at each Boss node. "Obtain a X Emblem" environments and Lottery Purchase work too.
- **Gems:** Red/Blue Gem + a basic item makes an Emblem; two gems make a Wealth Gem, which raises team size by 1 (wiki).
- **Crystal Ores:** White, Blue, Gold and Prismatic orbs in Items; tap to open. Reward nodes drop them; Print More Money, Prismatic Ore(+), Bursting Ore, Cracked Quartz and Gold Miner work as written. What's inside a random ore isn't published, so the contents are listed in the app as guesses.
- **Item details:** tap an item for what it does, what it's made from, and every combination (ones you can make now first, each result expandable).
- **Battle viewer:** every Battle plays out with squad and enemy HP bars, waves, boss phases, Ultimate Instant, falls and revives, elapsed time, Action Value left, 1×/2×/4× speed, pause and skip. It replays the simulated result, so the outcome always matches.
- **Crystal Ore guide** (8 sections) in Guides, separating what the wiki confirms from what it doesn't.
- Found and fixed while testing: Gold Miner's text gave a Prismatic ore instead of the Gold one; a boss hit crossing two phase lines showed one phase change; the battle viewer and ore results appeared off-screen on phones.

### Test results
- typecheck ✓ · lint ✓ · unit **162/162** · E2E **13/13** on the server build and the static web edition (emblem environment, item details, battle viewer at 4× with skip, opening ores; phone-width checks). Calibration over 150 seeded runs on real wiki data: a simple bot clears A0 ~81%, A4 ~29%; a passive player never clears.

## 2026-11-26 · 1.3.0 Currency Wars update

- **Bug fixed:** on phones the Currency Wars search box overlapped the "All" chip. Search now has its own row (checked by an E2E test).
- **Run simulator, laid out like the game:** node track, squad HP, gold, level/XP, streak; bonds list with thresholds; On-Field (4), Off-Field and a 9-slot bench; shop of 5 with level odds, Buy XP, Refresh, Lock and Battle; item bag with combining; Environment, Strategy, Supply and Encounter choices; result and end-of-run screens with rank gain and Expected Profit goals. Seeded, saved, replayable.
- **Rules from the wiki (4.7):** node order, Action Value, HP loss per plane, interest 1/10 up to 5, refresh 2, Experience 4, odds by level, 3-copy merges, 3 items per character, 36 recipes, Supply 1 of 5, Strategy rarity and difficulty, Encounters from A2, 3 random opponents and their bosses, 68 difficulty steps, rank gain by HP, idle wrong-position characters, per-character strength by star. Unpublished numbers (base and streak gold, XP curve except the 84 at Lv.9, Reward drops) are listed in the app as guesses.
- **More detail:** equipment combination grid (the in-game "Weapon Combinations" table) with effects and recommended users; all ~70 Environments and ~300 Strategies; team builder with positions, strength by star and a picker for Phantasmoon Games' per-game rule.
- **Guide:** "Currency Wars" in Guides, 10 sections with beginner/advanced and permanent/4.7 labels. "Escapade" and "Employee Bonds" from the request couldn't be found on the 4.7 wiki pages, so the guide says so instead of guessing.
- Found and fixed while testing: a full bench could lock a Supply node; starters could be three copies of one character; Phantasmoon Games' three rule variants were counted as three bonds; table labels widened the phone layout; the last action could be lost on an instant reload.

### Test results
- typecheck ✓ · lint ✓ · unit **154/154** · E2E **13/13** on the server build and the static web edition, including a played run and phone-width checks for every Currency Wars tab. Calibration over 150 seeded runs on real wiki data: a simple bot clears A0 ~71%, A4 ~25%; a passive player never clears.

## 2026-11-26 · 1.2.1 bug sweep

A scripted real-data sweep (every page and tab, Fribbels import, both wiki downloads, a full SU run, chat) found:
- **Enemy pictures never loaded**: the wiki's image host answers 404 to requests from other sites (hotlink protection). Not worked around; cards now show type and large weakness icons, and link to the wiki page for the picture.
- Missing guide / unknown character pages had no heading or way back: fixed.
- Element, Path and weakness icon buttons had no accessible names: fixed.
No other console errors, crashes or failed requests.
