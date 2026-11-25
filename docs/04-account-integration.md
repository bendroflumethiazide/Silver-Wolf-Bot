# 04 · Account integration feasibility

HoYoverse offers **no official public API** for Honkai: Star Rail account data. Every option is either a public record, a file you export, or an unofficial endpoint.

| Option | What it gives | Auth | Risk | Status |
| --- | --- | --- | --- | --- |
| Enka.Network showcase | Nickname, Trailblaze/Equilibrium level, signature, achievement/character/LC/relic counts, and the characters in your showcase with traces, Light Cone and relics | UID only | Low: read-only public data | **Implemented, opt-in** |
| HSR Scanner export | Full character, Light Cone and relic inventory | None (runs on your PC) | Low: OCR mistakes possible; preview catches changes | **Implemented** |
| Star Rail Station Warp import | Warp history (game keeps about 6 months) | Their import reads a temporary game auth key on your PC | Medium: handled on starrailstation.com, never by this app | **Linked** (Open Warp Tracker button); you enter your current pity here |
| HoYoLAB Battle Chronicle | Active days, chests, achievements, characters (level/Eidolon), real-time note (Trailblaze Power, Daily Training, SU weekly, Echo of War, assignments), Memory of Chaos / Pure Fiction / Apocalyptic Shadow | HoYoLAB cookies (`ltoken_v2`, `ltuid_v2`) in `.env.local`, or OS-encrypted in the desktop app | **High**: unofficial endpoints; cookies grant account access | **Implemented at your request**: read-only, opt-in, cookies server-side only, CAPTCHA never bypassed |
| Game client automation / memory reading | Anything | — | Violates terms | **Refused** |

## Connector capability registry

`src/lib/connectors/enka.ts` exports `ENKA_CAPABILITIES`, which lists what the connector provides and what it cannot. The Account page renders this list, so the UI never implies more than the connector delivers. Future connectors implement the same shape.

## Guarantees in the code

- Read-only. No connector writes to any HoYoverse system.
- No password fields anywhere. The only secrets kept are the optional Anthropic key and HoYoLAB cookies you supply: in `.env.local`, or in the desktop app encrypted with the OS (Electron safeStorage), passed to the local server as environment variables and never readable by the page.
- A sync never silently overwrites manual edits: characters you edited by hand are kept and counted in the result message.
- Every sync is recorded in `importHistory` with an undo log, so it can be rolled back.
- Verified data shows a **Verified** badge; imports show **Imported**; manual entries show **Manual**.

## Known limitations

- Enka returns only showcased characters (up to the in-game showcase size). Characters not in the showcase must come from HSR Scanner or manual entry.
- The Enka and HoYoLAB parsers follow the documented/community response structures and are fixture-tested; neither host was reachable from the development sandbox, so the first live sync on your machine is the real test.
- HoYoLAB endpoints are not a public API and can change or start requiring extra verification at any time.
- Treasure-level map completion is not available from any source; map progress is manual and labelled as such.
