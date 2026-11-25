# 06 · Licensing assessment

| Item | Licence / owner | How it is handled |
| --- | --- | --- |
| Game text, numbers, art | © COGNOSPHERE / HoYoverse | Never committed. Downloaded by your browser for personal reference; notice shown in Settings and the footer |
| StarRailRes index and images | AGPL-3.0 | Not redistributed or modified; fetched at runtime from the original host. The repository contains no AGPL material, so its own licence is unaffected |
| Silver Wolf portrait in the UI | HoYoverse | Loaded from the downloaded data like any other character image; a typographic "SW" fallback is used when data is absent |
| Silver Wolf's lines | Original writing in this repo | Written in the style of her in-game texts (your screenshots). Only her one-line Messages signature is quoted, as the chat header |
| HoYoLAB Battle Chronicle | HoYoverse service terms | Unofficial endpoints, used read-only for your own account at your request |
| UIGF / SRGF | Open standards | Implemented from the published schema |
| HSR Scanner format | MIT tool; output format documented in its README | Parser written from the documentation |
| Enka.Network | Service terms (fair use, custom User-Agent, respect ttl) | Followed in `/api/enka/[uid]` |
| Prydwen, Star Rail Station, HoYoLAB map | Site content, not licensed for reuse | Not scraped or copied |
| E2E fixtures | Synthetic data written for tests | Invented names and numbers only |
| npm dependencies | MIT / Apache-2.0 / ISC | Standard |
| WebLLM (`@mlc-ai/web-llm`) | Apache-2.0 | npm dependency; runs the built-in AI |
| Qwen3 1.7B (MLC build) | Apache-2.0 (Alibaba Qwen team; MLC conversion by mlc-ai) | Not bundled; downloaded by the app from Hugging Face on first use |

## Decisions that need you

- **Repository licence:** MIT (your choice: "whatever you like"). Covers the code only.
- **Bundling game data** (offline-first install, no download step) would make the repo carry AGPL material and HoYoverse IP; you chose not to.
