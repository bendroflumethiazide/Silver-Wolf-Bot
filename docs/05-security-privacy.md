# 05 · Security & privacy assessment

## Data inventory

| Data | Where | Leaves the device? |
| --- | --- | --- |
| Profiles, inventory, Warps, progress, notes, teams, map images | IndexedDB in your browser | Never, except files you export yourself |
| Game data snapshots, cached images | IndexedDB, Cache Storage | Downloaded from raw.githubusercontent.com when you press download |
| UID | IndexedDB | Sent to enka.network / the local HoYoLAB proxy only when that sync is enabled **and** you press it |
| HoYoLAB cookies, Anthropic API key | `.env.local` on the machine running the server | Only to hoyolab.com / api.anthropic.com by the local server; never to the browser, never in backups |
| Chat questions + compact facts (roster, pity, resources, build grades) | Built in the browser per question | Sent to the Claude API only in Claude mode; no UID, nickname, signature or notes |

There is no analytics, no telemetry, and no account system. The Next.js telemetry flag is disabled in scripts used here.

## Threats and controls

| Threat | Control |
| --- | --- |
| Credential theft | No password or cookie inputs in the UI; secrets live only in server env vars; status endpoints return booleans, never values (tested) |
| Abuse of the HoYoLAB session | GET-only calls to game_record endpoints; no check-in/redeem/write paths exist; verification challenges stop the sync and are reported (tested) |
| XSS through notes/codex/imports | Markdown renderer escapes all HTML first and only links `http(s)` URLs (unit-tested with script and `javascript:` payloads); imported text renders as text |
| Malicious import files | Zod schemas, numeric clamping, per-row validation messages; nothing is written before preview + approval |
| Data loss from imports | Keyed diff; manual rows produce conflicts that need explicit approval; full undo log and rollback |
| Proxy abuse (`/api/enka`) | Accepts only 9–10 digit UIDs; forwards nothing else; caches by Enka's ttl; fixed User-Agent |
| Large attachments filling storage | Attachments ≤ 2 MB; map images ≤ 15 MB; storage usage shown in Settings |
| Accidental deletion | Every destructive action asks for confirmation; backup export is one click |
| Supply chain | Small dependency set; versions pinned by `pnpm-lock.yaml` |

## User controls (Settings)

Export backup · Restore backup (replaces data atomically, keeps this device's game data pointer) · Delete all personal data · Delete everything (including game data and image cache) · Enka toggle · Companion verbosity.

## AI (Silver Wolf)

Local mode is deterministic and offline. Claude mode (your choice) is opt-in per device, uses your own key from `.env.local`, and sends only the question, recent chat turns and a compact facts block (`buildAiContext`, tested to exclude UID, name and signature). The system prompt forbids inventing numbers or asking for credentials. Refusals and errors are shown in-character, and refused requests use Anthropic's server-side fallback.
