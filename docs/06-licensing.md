# 06 · Licensing assessment

| Item | Licence / owner | How it is handled |
| --- | --- | --- |
| Game text, numbers, art | © COGNOSPHERE / HoYoverse | Never committed. Downloaded by your browser for personal reference; notice shown in Settings and the footer |
| StarRailRes index and images | AGPL-3.0 | Not redistributed or modified; fetched at runtime from the original host. The repository contains no AGPL material, so its own licence is unaffected |
| Silver Wolf portrait in the UI | HoYoverse | Loaded from the downloaded data like any other character image; a typographic "SW" fallback is used when data is absent |
| Silver Wolf's lines | Original writing in this repo | No in-game voice lines are reproduced. Ability names quoted in the voice guide are short references for characterisation |
| UIGF / SRGF | Open standards | Implemented from the published schema |
| HSR Scanner format | MIT tool; output format documented in its README | Parser written from the documentation |
| Enka.Network | Service terms (fair use, custom User-Agent, respect ttl) | Followed in `/api/enka/[uid]` |
| Prydwen, Star Rail Station, HoYoLAB map | Site content, not licensed for reuse | Not scraped or copied |
| E2E fixtures | Synthetic data written for tests | Invented names and numbers only |
| npm dependencies | MIT / Apache-2.0 / ISC | Standard |

## Decisions that need you

- **Repository licence:** none chosen yet (private by default). Tell me if you want MIT, or to keep it unlicensed.
- **Bundling game data** (offline-first install, no download step) would make the repo carry AGPL material and HoYoverse IP; you chose not to.
