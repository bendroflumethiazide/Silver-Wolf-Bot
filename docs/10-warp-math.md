# 10 · Warp mathematics

Source: `src/lib/warp/*`. Tests: `src/lib/__tests__/warp-*.test.ts`.

## Published rules (in-game Warp details)

| Pool | 5★ base | 5★ consolidated | Hard pity | Rate-up | 4★ base | 4★ consolidated | 4★ guarantee |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Character Event (11) | 0.6% | 1.6% | 90 | 50%, loss → next guaranteed | 5.1% | 13.0% | 10 |
| Light Cone Event (12) | 0.8% | 1.87% | 80 | 75%, loss → next guaranteed | 6.6% | 14.8% | 10 |
| Stellar Warp (1) | 0.6% | 1.6% | 90 | — | 5.1% | 13.0% | 10 |
| Departure (2) | 0.6% | — | 50 | — | 5.1% | 13.0% | 10 |
| Collaboration (21/22) | as event pools | | | | | | |

Pools never share pity. Collaboration pools are treated as independent, which is community-reported and labelled in the UI.

## Soft pity (community model, not official)

`p(n) = min(1, base + max(0, n − softStart + 1) × increment)`, with `p(hard) = 1`.

| Rarity / pool | softStart | increment | Model consolidated rate | Published |
| --- | --- | --- | --- | --- |
| Character 5★ | 74 | +6% | 1.605% | 1.6% |
| Light Cone 5★ | 66 | +7% | 1.872% | 1.87% |
| Character 4★ | 9 | +51% | 13.06% | 13.0% |
| Light Cone 4★ | 8 | +40% | 14.81% | 14.8% |

Tests fail if any model drifts more than 0.12 percentage points from the published consolidated rate.

## Exact planner

A dynamic programme over states (copies obtained, guarantee flag, pity) gives the full distribution of pulls needed for *k* featured copies. It yields the exact probability within *N* pulls, the expected value, median, 90th percentile, and the worst case `(hard − pity) + (guaranteed ? 0 : hard) + (k − 1) × 2 × hard` (one `hard` per copy for pools without a rate-up). Tested: CDF is monotonic and ends at 1; expected pulls equal consolidated expectation × 1.5 (character) or × 1.25 (Light Cone); Monte Carlo agrees within 4 standard errors.

## Simulator

sfc32 PRNG seeded through splitmix32 (string or number seeds), so the same seed and actions give the same results. A 5★ does not reset 4★ pity; the 4★ guarantee carries to the next pull. Verified over 300,000 pulls: 5★ rate 1.5–1.7%, 4★ rate 12.5–13.5%, hard pity never exceeded, every loss followed by a featured 5★, never 10 consecutive 3★, featured share ≈ 2/3.

## History analysis

Records are ordered by game record id (strictly increasing; ten-pulls share a timestamp), then time, then insertion order for manual rows. The standard 5★ pool (Himeko, Welt, Bronya, Gepard, Clara, Yanqing, Bailu and the 7 standard 5★ Light Cones) marks lost 50/50s; any record can be overridden. Pulls before the first record are unknown unless you set a history-start offset; until then the first 5★'s pity is shown as "≥" and excluded from averages.

## Resources

160 Stellar Jade = 1 pull; 20 Undying Starlight = 1 pass. Jade from different sources is summed before dividing. Future income is your own estimate and is labelled as such.
