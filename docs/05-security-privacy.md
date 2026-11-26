# 05 · Security & privacy assessment

## Data inventory

| Data | Where | Leaves the device? |
| --- | --- | --- |
| Profiles, inventory, Warps, progress, notes, teams, map images | IndexedDB in your browser | Never, except files you export yourself |
| Game data snapshots, cached images | IndexedDB, Cache Storage | Downloaded from raw.githubusercontent.com when you press download |
| UID | IndexedDB | Sent to enka.network / the local HoYoLAB proxy only when that sync is enabled **and** you press it |
| HoYoLAB cookies, Anthropic API key | `.env.local`, or OS-encrypted (safeStorage) in the desktop app | Only to hoyolab.com / api.anthropic.com by the local server; never to the browser, never in backups |
| Chat questions + compact facts (roster, pity, resources, build grades) | Built in the browser per question | Claude mode: sent to the Claude API; no UID, nickname, signature or notes. Built-in AI and quick replies: never leave the device |
| Built-in AI model (Qwen3 1.7B, about 1 GB) | Cache Storage of the app window | Downloaded once from huggingface.co (weights) and raw.githubusercontent.com (WebGPU kernels); nothing is uploaded. Delete it in the chat settings |
| Enemy and Currency Wars packs | IndexedDB | Downloaded on request from honkai-star-rail.fandom.com (public API, anonymous); pictures from static.wikia.nocookie.net. Nothing is uploaded |
| Update check | Desktop app only | On launch (can be turned off) the app asks api.github.com for this repo's latest release; nothing about you is sent. Updates download from github.com and are installed only if their SHA-256 matches the one GitHub publishes |

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
| Tampered update | Only this repo's release URLs are accepted; the installer is hashed while downloading and deleted unless it matches GitHub's SHA-256 digest; no checksum means no auto-install (tested) |
| Small model saying something it shouldn't | Account numbers never come from the model (exact lookups answer those); crisis messages get a fixed reply with helplines; romantic/sexual input or output is replaced with an in-character deflection (tested) |

## User controls (Settings)

Export backup · Restore backup (replaces data atomically, keeps this device's game data pointer) · Delete all personal data · Delete everything (including game data and image cache) · Enka toggle · Companion verbosity.

## AI (Silver Wolf)

Three brains, chosen in the chat settings (Auto picks the best available). **Quick replies** are deterministic and offline. **Built-in AI** runs Qwen3 1.7B on your graphics card through WebGPU (WebLLM, in a Web Worker); it gets a compact facts block and the last few messages, all on-device. Claude mode (your choice) is opt-in per device, uses your own key from `.env.local`, and sends only the question, recent chat turns and a compact facts block (`buildAiContext`, tested to exclude UID, name and signature). The system prompt forbids inventing numbers or asking for credentials. Refusals and errors are shown in-character, and refused requests use Anthropic's server-side fallback.
