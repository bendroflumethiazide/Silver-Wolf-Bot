# 03 · Data-source assessment

Assessed 2026-11-25. "Reachable" means from this development sandbox; most sources are reachable from a normal home network.

| Source | Data quality | Update frequency | Licence / terms | API | Reachable | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| **StarRailRes** (Mar-7th) | High; structured index of characters, skills, traces, Eidolons, promotions with costs, Light Cones, relics, affix tables, items with sources, achievements, SU blessings/curios/occurrences, NPC contacts, glossary. v4.7.0, build 2026-11-11 | Every game version | AGPL-3.0; content © HoYoverse | Static JSON over raw.githubusercontent (CORS `*`) | Yes | **Used**, downloaded on demand into the browser (your decision) |
| Dimbreath StarRailData | Raw game tables + huge text maps | Every version | No explicit licence; datamined | Static files | Repo paths returned 404 | Not used; StarRailRes is derived from it |
| Official HSR site / HoYoLAB notices | Authoritative for banners and events | Per announcement | HoYoverse terms; no API | HTML only | No | Manual entry with source links |
| HoYoLAB Interactive Map | Authoritative marker data | Frequent | Not licensed for reuse; private API | Undocumented | No | Not used; own image-based map system |
| HoYoLAB Battle Chronicle | Stats, real-time note, endgame records | Live | Unofficial cookie-based endpoints | Undocumented | No | **Implemented at your request**, read-only, opt-in (see 04) |
| **Enka.Network** | Public showcase: profile + showcase characters with relics | Live (ttl cache) | Free use; asks for custom User-Agent, no UID enumeration, respect ttl | Documented JSON | No (sandbox) | **Implemented**, opt-in, through local proxy |
| **HSR Scanner** (kel-z) | OCR export; SPD decimals not readable (documented) | Tool releases | MIT tool; data is yours | File (JSON v3–4) | Docs yes | **Importer implemented** |
| Fribbels optimizer | Reference for scoring/optimisation; imports HSR Scanner files | Active | Open source | File formats | Docs yes | Same input format supported |
| UIGF v4 / SRGF v1 | Standard Warp export formats | Stable standard | Open standard | File | Docs yes | Importer removed; Warp history lives on Star Rail Station |
| **Star Rail Station** | Warp tracker with history import | Active | Site terms | No public API | No | **Linked** from Warp, Import and Dashboard (opens in your browser) |
| Prydwen | Community builds/tier lists | Frequent | Content not licensed for reuse | No API | No | Not used; per-character scoring profiles are yours to set |

## Rules applied

- A public repository is not treated as permission to redistribute; nothing from these sources is committed.
- Official sources for announcements and mechanics; community sources only where labelled.
- Every downloaded snapshot is validated (Zod), integrity-checked (missing trace nodes, ascension tables, asset paths) and versioned with rollback.
