# 07 · UI/UX specification

## Identity: Silver Wolf's terminal aboard the Astral Express

- **Palette:** void black `#05050b`, night `#0b0a18`; violet `#a78bfa` (primary), cyan `#5ee6f0` (interactive/HUD), magenta `#f472b6` (glitch accent), silver `#cfd4e3`. Gold `#e9c46a` is reserved for 5★ and "keep" verdicts; purple `#b38cff` for 4★.
- **Surfaces:** translucent glass panels (`.glass`), HUD corner brackets on key panels (`.hud`), pixel grid behind empty states and map, faint scanlines and a two-layer starfield.
- **Type:** system sans for reading; monospace for labels, data tags and Silver Wolf's status line (`SILVER WOLF // smug.exe`).
- **Headings:** gradient text with a rare chromatic glitch (disabled under reduced motion).
- **Rarity:** bottom edge stripe in rarity colour on cards.

## Silver Wolf's presence

- One `WolfComment` per page, near the top, sometimes also inside cards (relic verdicts, best-in-slot).
- Avatar ring colour follows mood: smug (fuchsia→violet), hyped (cyan→fuchsia), alert (amber→rose), bored (slate→violet).
- Typing effect in "Full" mode; static text in "Brief" mode or with reduced motion; hidden in "Off".
- "data" toggle reveals the facts behind the line; an optional action chip links to the next step.

## Navigation

Grouped by Astral Express areas: Express Terminal · The Archives · Navigation Room · Warp Observatory · Strategy Room · Trailblazer's Log · System. Collapsible desktop sidebar (state persisted); mobile drawer. Any section can be hidden in Settings. Dashboard widgets can be reordered and hidden.

## Interaction rules

- No dead buttons: every control either works or is absent; unavailable features are explained in text, never shown as fake buttons.
- Every page has loading, empty and error states.
- Destructive actions confirm; imports preview before writing.
- Data provenance is always visible: Verified / Imported / Manual badges, confirmed / speculation / leak / fan-theory badges, "template" warnings on scoring weights.
- Responsive: 16 px gutters on phones, single-column grids that never overflow (end-to-end tested at 412 px).
- Accessibility: labelled form fields, `aria-pressed` on toggles, `role=progressbar`, focus-visible rings, dialogs via `<dialog>`, `prefers-reduced-motion` honoured plus an in-app switch.
