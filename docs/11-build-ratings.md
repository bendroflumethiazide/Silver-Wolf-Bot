# 11 · Build ratings

Character page → **Build & rating**. Sources: `src/lib/builds/*`, tests in `src/lib/__tests__/builds.test.ts`.

## Grade scale

D, C, B, A, S, SS, SSS, WTF, each split into thirds as −, plain, + (24 steps).

| Score (0–100) | 0–15 | 15–25 | 25–35 | 35–45 | 45–55 | 55–65 | 65–80 | 80–100 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Letter | D | C | B | A | S | SS | SSS | WTF |

## Relic score

Each substat → rolls (value ÷ that rarity's maximum single roll) × the character's weight for that stat. Score = that sum ÷ the best possible sum for the slot (4 best-weighted lines + every upgrade on the top stat) × 100. Relics below max level are judged on their expected score at max level. A main stat the profile doesn't want halves the score.

Roll arrows (›) on the card show the estimated number of upgrades a substat received (value ÷ 90% of a max roll).

## Overall build rating

Average of the six slots (empty slot = 0). Silver Wolf then lists what the build lacks, in priority order: empty slots, wrong main stats, weakest pieces (B+ or lower), unfinished relics, missing set bonuses, stat targets not met, crit ratio far from 1:2, CRIT Rate over 100%, Light Cone Path mismatch, character level, and a warning when the generic template is grading the build.

## Total stats

Character base (ascension tables) + Light Cone base + relic main stats (`base + step × level` from `relic_main_affixes`) + substats + unlocked minor traces + always-on set bonuses + the Light Cone passive's always-on stats (only when the Path matches). Conditional effects are not included.

**Verified** against an in-game build card (Silver Wolf LV.999, Lv 80 E0, Welcome to the Cosmic City S1, six +15 relics): HP 4867 vs 4866, ATK 1355 vs 1355, DEF 1370 vs 1371, SPD 173.6 vs 173.6, CRIT Rate 61.8% vs 61.9%, Effect Hit Rate 12.0%, Effect RES 6.9%, Break Effect 34.8% vs 34.9%. The ±0.1 differences are in-game hidden decimals. CRIT DMG differed only by the worn set's 2-piece bonus, which wasn't known in the test.

## Recommended builds

- **Silver Wolf's recommendation:** main stats and substat priority from the character's scoring profile; Cavern and Planar sets ranked by how well their always-on bonuses match those weights (conditional 4-piece effects are shown as text, not scored); Light Cones of the same Path by rarity, marking those you own. Labelled as derived from your data, not a community guide.
- **Saved builds:** paste the build a guide recommends (sets, Light Cone, main stats, substats, source link). The card checks your current gear against it (✓/✗ per item).

## Profiles

Each character has their own weights and acceptable main stats (Relics → Scoring profiles). Path-based templates are starting points only and the UI flags them. Templates include starting stat targets (e.g. CRIT Rate 70% for crit DPS, Effect Hit Rate 67% for debuffers) that you should edit to match your guide.
