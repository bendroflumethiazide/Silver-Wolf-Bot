# 05 · Security & privacy assessment

## Data inventory

| Data | Where | Leaves the device? |
| --- | --- | --- |
| Profiles, inventory, Warps, progress, notes, teams, map images | IndexedDB in your browser | Never, except files you export yourself |
| Game data snapshots, cached images | IndexedDB, Cache Storage | Downloaded from raw.githubusercontent.com when you press download |
| UID | IndexedDB | Sent to enka.network only when showcase sync is enabled **and** you press Fetch |

There is no analytics, no telemetry, and no account system. The Next.js telemetry flag is disabled in scripts used here.

## Threats and controls

| Threat | Control |
| --- | --- |
| Credential theft | No password or cookie inputs exist; HoYoLAB cookie integration deliberately not built |
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

The terminal runs locally on deterministic intents and never calls an external model. If an external model is added later, the plan is: opt-in, your own API key, only the minimal facts needed per question, no credentials, and the same facts/sources display. That needs your approval because it sends account data to a provider.
