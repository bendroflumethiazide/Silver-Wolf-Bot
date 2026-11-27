# Currency Wars 4.7: Investment Environment and Strategy coverage

Generated from the HSR Wiki data pack by running every text through the run simulator's own parser (`effectCoverage` in `src/lib/currencywars/run.ts`).

- **Simulated**: every part of the text changes the run (gold, XP, items, characters, nodes, shop, combat stats).
- **Partly**: some parts work; the rest are listed.
- **Not simulated**: the wiki doesn't say what it gives (an amount, an unnamed item or a term it never defines). Nothing is invented for these.

Named rules (`src/lib/currencywars/rules.ts`) handle wording the general parser can't; where a rule averages an in-fight condition or the wiki leaves a value open, the value is in `RULE_ASSUMED` and listed below.

## Investment Environments (72): 70 simulated · 0 partly · 2 not simulated

| Name | Status | What isn't simulated (and why) |
|---|---|---|
| Gift of Destiny | Not simulated | Surprise Box; After a perfect victory in combat, additionally reduces the countdown by 1 |
| Flank Destruction | Not simulated | disabling one enemy's affixes that have already spawned |

### Investment Environments: simplifications

| Name | How it's modelled |
|---|---|
| Economic Overheat | Reward nodes drop more: 1.5× Reward loot (the wiki says only "more") |
| Economic Hyperheat | Reward nodes drop more: 2× Reward loot (the wiki says only "tons") |
| Combat Power Level Up | the 2-star character gains a random stat each node: +2% strength per node |
| Combat Power Surge | the 2-star character gains a random stat each node: +2% strength per node |

## Investment Strategies (298): 288 simulated · 5 partly · 5 not simulated

| Name | Status | What isn't simulated (and why) |
|---|---|---|
| Holiday Giftbox (Prismatic) | Not simulated | random massive reward |
| Xianzhou Fleet Emblem Set (Prismatic) | Partly | an item the wiki hasn't named |
| The Grand Restaurant Emblem Set (Prismatic) | Partly | an item the wiki hasn't named |
| DoT Emblem Set (Prismatic) | Partly | an item the wiki hasn't named |
| Network Ascension (Prismatic) | Partly | After activating 2 non-independent Bonds in a single battle, obtain a reward; Thereafter, every time the objective is achieved, the number of activated Bonds required t |
| Talent Bundle (Gold) | Not simulated | the wiki text doesn't say exactly what it gives or does |
| Talent Bundle+ (Gold) | Not simulated | the wiki text doesn't say exactly what it gives or does |
| Talent Bundle++ (Gold) | Not simulated | the wiki text doesn't say exactly what it gives or does |
| Chimera Growth Log (Gold) | Partly | Chimera Projector |
| Strength Through Setbacks (Gold) | Not simulated | For every 1 attack received by "Counter King", Counter DMG multiplier increases by 5%, las |

### Investment Strategies: simplifications

| Name | How it's modelled |
|---|---|
| Faster-Than-Light Promotion | a 1-cost character fights at 4-star (+5% strength): 4-star = 3-star × 1.5 |
| Efficient Decision | unlimited free refreshes this node: 50 seconds = the rest of this node |
| Tactical Eyepiece | Energy on defeating enemies: as squad Energy |
| Role Model: Prismatic | top damage dealer +70% strength; others echo 1% of its damage: echo averaged over the fight |
| Volley of Arrows | (stars + 8) Wind Arrows of 1600% base DMG at the start: base DMG size assumed |
| Tactical Eyepiece++ | Energy on defeating enemies: as squad Energy |
| Savage Growth | 2 on-field and 2 off-field characters +100% strength: spread evenly over the position (random in the game) |
| Onboarding Package | characters with 2 items get a recommended advanced item in combat: the first recommended item they don't hold |
| Exclusive Endorsement | its components become the chosen advanced item: the item is picked at random from 3 |
| Tactical Eyepiece+ | Energy on defeating enemies: as squad Energy |
| Complete Disassembly | advanced equipment becomes Molecular Solvent (extra hits, +4% Mitigation each): Solvent's extra hits as +20% DMG dealt |
| Rise Above All | characters with 3 items: one item privileged in combat: their first advanced item |
| Equipment Liquidation | equipment can be sold; a basic item each plane: sale prices assumed |
| Equipment Liquidation+ | equipment can be sold; a basic item each plane: sale prices assumed |
| Market Vitality | 2-star 1/2-cost characters in the shop: 2% per level above 2 |
| Market Chaos | 7 free refreshes at Reward nodes: the forced refreshes are free refreshes for that node |
| Early Push | 40% action advance; +60% strength falling 1% per AV: averaged over the fight |
| Role Model: Gold | top damage dealer +40%, others +10% strength: the top dealer is the strongest unit before the fight |
| Eidolon Ascension | on-field characters Eidolon +1: counted as +10% On-Field Strength |
| Aha is Amused | Aha +40% DMG: Aha's equipment choice isn't modelled |
| Perfect Start | +40% strength for the first half of the fight: counts for half of each fight |
| Role Model: Silver | top damage dealer +25% strength: the top dealer is the strongest unit before the fight |
| Sucker Punch | 1000% base DMG and Fragility on the biggest enemy each wave: base DMG size assumed |

## Assumed values (`RULE_ASSUMED`)

```json
{
  "baseDmgShare": 0.002,
  "baseDmgCap": 0.5,
  "firstHalf": 0.5,
  "fragileTarget": 0.25,
  "eidolonStr": 0.1,
  "fourStar": 1.5,
  "maxEnergy": 120,
  "eyepieceEnergy": 30,
  "initialEnergy": 15,
  "vitalityPerLevel": 0.02,
  "hyperheatLoot": 2,
  "overheatLoot": 1.5,
  "executeAt": 0.16,
  "randomStat": 0.02,
  "solventDealt": 0.2,
  "sellItem": {
    "basic": 1,
    "advanced": 3,
    "privileged": 5,
    "emblem": 2,
    "gem": 2
  }
}
```
