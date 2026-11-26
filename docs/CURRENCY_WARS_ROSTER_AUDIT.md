# Currency Wars roster audit (Version 4.7)

Generated from the HSR Wiki's "Currency Wars: Voyage Into the Canvas" character pages by the app's own code (`abilities.ts`, `kits.ts`, `elation.ts`), so it shows exactly what the simulator does with each character. Regenerate with the same data when the wiki changes.

**Coverage per ability line** (modelled / Elation engine / in their strength / not modelled):
- **Modelled**: a team or battle effect the simulator applies (squad buffs, enemy debuffs, ally actions, Energy for allies, shields, healing, named summons).
- **Elation engine**: Punchline, Certified Banger, Aha and Elation Skills run event by event in `elation.ts`.
- **In their strength**: the character's own damage, own buffs and own mechanics; already part of their wiki On-/Off-Field Strength.
- **Not modelled**: team-relevant mechanics the simulator doesn't apply yet (listed per line in the app's Roster tab).

Totals: 1031 lines: 140 modelled, 62 Elation engine, 626 in strength, 203 not modelled (80% covered).

Checklist per character: wiki page researched ✓, ability summary ✓, category labels ✓ (per position, in the game's order), Bonds ✓, kit effects in combat (this table), tested: labels (Pearl, Sunday), kits (Hanya, Cerydra, Anaxa, Tribbie, Topaz & Numby, Sunday, Aventurine), Elation kits (Pearl, Yao Guang, Sparxie, Aventurine • Waveflair, Silver Wolf LV.999, Aeon ★ Aha, Sparkle).

| Character | Cost | Pos | Ability | Labels | Bonds | Lines (M/E/S/N) | Simulator applies |
|---|---|---|---|---|---|---|---|
| Anaxa | 1 | On | The Great Performer | Talent | Beast Garden, Combo | 1/0/2/0 | squad dmg +24% |
| Black Swan | 1 | Off | Arcana Surge | Skill · Talent | Intertwined Dreamscapes, DoT | 1/0/7/7 | squad dmg +6% |
| Boothill | 1 | On | Leading Advantage | Talent | Galactic Voyager, Break | 0/0/4/1 | — |
| Cerydra | 1 | Off | The King's Word Is Law | Skill · Talent | Little Giant, Combo | 0/0/13/6 | — |
| Evernight | 1 | On | Evernight of Memory's Sea | Talent · Summon | Beast Garden, Intertwined Dreamscapes, Summon | 1/0/0/1 | squad mit +6% |
| Evernight | 1 | Off | Evernight of Memory's Sea | Talent · Memosprite Skill · Summon | Beast Garden, Intertwined Dreamscapes, Summon | 3/0/7/1 | squad spd +15%, squad mit +7%, summon Evey |
| Fugue | 1 | On | Fire in the Pages | Skill · Talent | Galactic Voyager, Break | 1/0/6/7 | squad dmg +4% |
| Fugue | 1 | Off | Fire in the Pages | Basic ATK · Skill · Talent | Galactic Voyager, Break | 1/0/7/8 | squad dmg +4% |
| Guinaifen | 1 | On | Full House | Skill · Talent | Xianzhou Fleet, DoT | 1/0/3/1 | squad dmg +14% |
| Guinaifen | 1 | Off | Full House | Skill · Talent | Xianzhou Fleet, DoT | 1/0/5/3 | squad dmg +14% |
| Jing Yuan | 1 | On | Thousandfold Strike | Talent · Summon | High-Cloud Quintet, Summon | 2/0/8/2 | squad spd +25%, summon Lightning-Lord |
| Jing Yuan | 1 | Off | Thousandfold Strike | Skill · Talent · Summon | High-Cloud Quintet, Summon | 2/0/11/3 | squad spd +25%, summon Lightning-Lord |
| Lingsha | 1 | On | Fuyuan Heals, Flame Mends | Ultimate · Talent | Xianzhou Fleet, AoE ATK, Heal | 3/0/6/1 | squad mit +9%, summon Fuyuan |
| Lingsha | 1 | Off | Fuyuan Heals, Flame Mends | Skill · Ultimate · Talent | Xianzhou Fleet, AoE ATK, Heal | 5/0/11/1 | squad mit +10%, squad spd +10%, summon Fuyuan |
| March 7th (The Hunt) | 1 | Off | Learn From A Master | Basic ATK · Skill | Trailblaze Silver Rail, Follow-Up ATK | 0/0/11/4 | — |
| Pearl | 1 | Off | Blessed Brushwork | Basic ATK · Ultimate · Elation Skill · Talent · Innate Trace | Phantasmoon Games, Astropolis Merchant Guild, Defender | 3/16/7/1 | Elation kit; squad mit +8%, squad spd +30% |
| Sparxie | 1 | On | Celebrity Effect | Talent | Phantasmoon Games, Girls Band, Elation | 0/3/0/0 | Elation kit; — |
| Sparxie | 1 | Off | Celebrity Effect | Basic ATK · Skill · Elation Skill · Talent · Innate Trace | Phantasmoon Games, Girls Band, Elation | 0/11/15/1 | Elation kit; — |
| Topaz & Numby | 1 | On | Debt Collection | Ultimate · Talent | Astropolis Merchant Guild, Follow-Up ATK | 3/0/7/2 | squad spd +25%, squad dmg +18%, summon Numby |
| Topaz & Numby | 1 | Off | Debt Collection | Skill · Talent | Astropolis Merchant Guild, Follow-Up ATK | 3/0/7/3 | squad spd +25%, squad dmg +18%, summon Numby |
| Welt | 1 | On | Gravitational Black Hole | Skill · Ultimate · Talent | Trailblaze Silver Rail, AoE ATK | 1/0/6/4 | squad dmg +12% |
| Welt | 1 | Off | Gravitational Black Hole | Skill · Ultimate · Talent | Trailblaze Silver Rail, AoE ATK | 2/0/12/4 | squad dmg +18% |
| Bailu | 2 | Off | Eternal Life | Skill · Talent | High-Cloud Quintet, Combo, Heal | 4/0/7/2 | squad mit +8%, squad dmg +12% |
| Evanescia | 2 | — | no wiki page | | | | |
| Firefly | 2 | On | Like Fyreflies to a Flame, Life Begets Death | Ultimate · Talent | Stellaron Hunters, Break | 1/0/2/2 | squad mit +6% |
| Hysilens | 2 | On | Endless Feast | Talent | Beast Garden, DoT | 0/0/3/3 | — |
| Hysilens | 2 | Off | Endless Feast | Skill · Ultimate · Talent | Beast Garden, DoT | 0/0/13/7 | — |
| Mydei | 2 | On | Blood-Soaked Mad Lion | Talent | Beast Garden, The Grand Restaurant, Counter | 0/0/4/0 | — |
| Mydei | 2 | Off | Blood-Soaked Mad Lion | Skill · Talent | Beast Garden, The Grand Restaurant, Counter | 3/0/13/1 | squad spd +65%, squad mit +6% |
| Natasha | 2 | Off | Miracle Cure | Basic ATK · Ultimate · Talent | Galactic Voyager, DoT, Heal | 3/0/8/3 | squad mit +10% |
| Robin | 2 | On | Choral Ode of Harmony | Skill · Ultimate · Talent | Girls Band, Follow-Up ATK | 3/0/7/2 | squad spd +15%, squad dmg +11% |
| Robin • Summeretto | 2 | On | Midsummer Soundwaves | Talent · Summon | Astropolis Merchant Guild, Summon, Energy | 2/0/6/4 | squad mit +6%, squad dmg +1% |
| Robin • Summeretto | 2 | Off | Midsummer Soundwaves | Skill · Ultimate · Talent · Memosprite Skill · Memosprite Talent · Summon | Astropolis Merchant Guild, Summon, Energy | 3/0/23/8 | squad mit +14%, squad dmg +5% |
| Sparkle | 2 | On | Mask Trick | Ultimate | Little Giant, Intertwined Dreamscapes, Elation | 0/1/1/5 | Elation kit; — |
| Sunday | 2 | On | Bountiful Bestowal | Ultimate · Talent | Phantasmoon Games, Trailblaze Silver Rail, Combo | 1/0/4/0 | squad dmg +14% |
| Sunday | 2 | Off | Bountiful Bestowal | Skill · Ultimate · Talent | Phantasmoon Games, Trailblaze Silver Rail, Combo | 3/0/10/2 | squad spd +15%, squad mit +2%, squad dmg +14% |
| The Herta | 2 | On | The Ultimate Answer to the Universe | Talent | Galactic Voyager, AoE ATK | 0/0/3/5 | — |
| Yunli | 2 | On | Zhuming Craftsman | Ultimate · Talent | Xianzhou Fleet, Counter | 0/0/8/2 | — |
| Yunli | 2 | Off | Zhuming Craftsman | Ultimate · Talent | Xianzhou Fleet, Counter | 1/0/8/2 | squad spd +15% |
| Castorice | 3 | On | Newbud of Netherwing | Skill · Talent · Summon | The Grand Restaurant, Summon | 0/0/8/6 | — |
| Castorice | 3 | Off | Newbud of Netherwing | Skill · Talent · Memosprite Talent · Summon | The Grand Restaurant, Summon | 3/0/9/4 | squad mit +7%, summon Netherwing |
| Cipher | 3 | Off | Tricksy Godspeed | Skill · Ultimate · Talent | Beast Garden, AoE ATK | 1/0/14/5 | squad dmg +24% |
| Feixiao | 3 | On | Veteran Merlin's Claw | Ultimate · Talent | Xianzhou Fleet, Follow-Up ATK | 0/0/19/2 | — |
| Fu Xuan | 3 | Off | Foreseen, Foreknown, Foretold | Ultimate · Talent | Little Giant, Counter, Defender | 4/0/4/2 | squad mit +16%, squad dmg +12% |
| Jiaoqiu | 3 | On | Foxian Counselor | Talent | Xianzhou Fleet, DoT | 0/0/4/4 | — |
| Jingliu | 3 | On | Coldmoon Sword Immortal | Skill · Talent | High-Cloud Quintet, Combo | 2/0/6/4 | squad spd +50%, squad mit +6% |
| Jingliu | 3 | Off | Coldmoon Sword Immortal | Skill · Talent | High-Cloud Quintet, Combo | 2/0/9/4 | squad spd +50%, squad dmg +8% |
| Luocha | 3 | On | Unfading Flower | Skill · Ultimate · Talent | Galactic Voyager, Heal | 1/0/4/3 | squad mit +6% |
| Luocha | 3 | Off | Unfading Flower | Skill · Talent | Galactic Voyager, Heal | 4/0/3/1 | squad mit +11% |
| Rappa | 3 | Off | Dazzling Ninjutsu | Basic ATK · Talent | Girls Band, Break | 0/0/13/4 | — |
| Silver Wolf LV.999 | 3 | On | !? Top Player!? | Talent | Phantasmoon Games, Stellaron Hunters, Elation | 0/4/5/0 | Elation kit; — |
| The Dahlia | 3 | On | Dance! Dance! Dance! | Talent | Intertwined Dreamscapes, Break | 1/0/3/2 | squad dmg +1% |
| The Dahlia | 3 | Off | Dance! Dance! Dance! | Skill · Ultimate · Talent | Intertwined Dreamscapes, Break | 2/0/12/5 | squad dmg +9% |
| Trailblazer (Elation) | 3 | — | no wiki page | | | | |
| Yao Guang | 3 | Off | Great Fortune | Basic ATK · Skill · Ultimate · Elation Skill · Talent · Innate Trace | Astropolis Merchant Guild, Elation | 2/15/9/2 | Elation kit; squad dmg +24% |
| Acheron | 4 | On | Return to Nihility | Talent | Intertwined Dreamscapes, AoE ATK | 0/0/2/1 | — |
| Aventurine | 4 | On | Prisoner's Dilemma | Skill · Ultimate · Talent | Galactic Voyager, Follow-Up ATK, Defender | 4/0/4/0 | squad lucky +9%, squad dmg +18%, squad mit +8% |
| Aventurine | 4 | Off | Prisoner's Dilemma | Skill · Ultimate · Talent | Galactic Voyager, Follow-Up ATK, Defender | 6/0/15/1 | squad mit +10%, squad lucky +9%, squad dmg +18% |
| Aventurine • Waveflair | 4 | On | Summer Drink | Talent · Innate Trace | Astropolis Merchant Guild, Elation | 0/7/2/1 | Elation kit; — |
| Blade | 4 | On | Immortality | Ultimate · Talent | High-Cloud Quintet, Counter | 0/0/13/1 | — |
| Blade | 4 | Off | Immortality | Basic ATK · Ultimate · Talent | High-Cloud Quintet, Counter | 0/0/16/3 | — |
| Cyrene | 4 | On | Vow and Verse | Skill · Talent · Summon | The Grand Restaurant, Summon | 1/0/8/1 | squad dmg +8% |
| Hanya | 4 | Off | Karmic Wheel Sanction | Skill · Ultimate · Talent | Xianzhou Fleet, Combo | 3/0/7/0 | squad dmg +68% |
| Himeko • Nova | 4 | On | Starward Dream | Talent | Trailblaze Silver Rail, Energy | 2/0/5/4 | squad dmg +5%, summon Starblazer |
| Huohuo | 4 | Off | Spirit Suppression Talisman | Skill · Ultimate · Talent | Little Giant, Energy | 5/0/11/4 | squad dmg +5%, squad mit +18% |
| Hyacine | 4 | On | Sky, Clear Up! | Talent · Summon | Beast Garden, Summon, Heal | 3/0/1/1 | squad mit +7%, squad spd +18% |
| Hyacine | 4 | Off | Sky, Clear Up! | Skill · Ultimate · Talent · Memosprite Skill · Memosprite Talent · Summon | Beast Garden, Summon, Heal | 12/0/10/3 | squad mit +15%, squad spd +33%, squad hp +40%, summon Little Ica |
| Mortenax Blade | 4 | On | Now I Am Become Blade | Talent | Phantasmoon Games, Stellaron Hunters, AoE ATK | 0/0/0/1 | — |
| Mortenax Blade | 4 | Off | Now I Am Become Blade | Skill · Ultimate · Talent | Phantasmoon Games, Stellaron Hunters, AoE ATK | 2/0/12/3 | squad dmg +81% |
| Serval | 4 | On | Synergistic Currents | Skill · Ultimate · Talent | Girls Band, DoT | 0/0/5/3 | — |
| Tribbie | 4 | On | Tribbie's Rocket Storage | Skill · Talent | Little Giant, Follow-Up ATK | 1/0/6/1 | squad luckyDmg +18%, squad dmg +14% |
| Tribbie | 4 | Off | Tribbie's Rocket Storage | Skill · Ultimate · Talent | Little Giant, Follow-Up ATK | 3/0/12/2 | squad luckyDmg +18%, squad dmg +37% |
| Aglaea | 5 | On | Golden Rose Upon the Blade | Talent | Beast Garden, Combo | 0/0/5/3 | — |
| Ashveil | 5 | Off | Hush... | Skill · Ultimate · Talent | Phantasmoon Games, Follow-Up ATK, Galaxy Ranger | 1/0/18/2 | squad dmg +12% |
| Clara | 5 | On | Master Modder | Skill · Talent | Galactic Voyager, Counter, Ingenious Artificer | 1/0/4/0 | summon Super Svarog |
| Clara | 5 | Off | Master Modder | Skill · Ultimate · Talent | Galactic Voyager, Counter, Ingenious Artificer | 1/0/11/0 | summon Super Svarog |
| Dan Heng • Imbibitor Lunae | 5 | On | Myriad Forms of the Dragon | Basic ATK · Talent | Trailblaze Silver Rail, High-Cloud Quintet, Twin Dragons' Call | 3/0/9/1 | squad spd +15% |
| Dan Heng • Imbibitor Lunae | 5 | Off | This Vessel Is I | Basic ATK · Talent | Trailblaze Silver Rail, High-Cloud Quintet, Twin Dragons' Call | 3/0/9/1 | squad spd +15% |
| Jade | 5 | Off | Currency Wars | Basic ATK · Skill · Ultimate · Talent | Astropolis Merchant Guild, AoE ATK, Black Market Manager | 1/0/14/2 | squad spd +20% |
| Kafka | 5 | On | Spirit Whisper Binding | Talent | Stellaron Hunters, DoT | 4/0/4/0 | squad mit +32%, squad spd +15% |
| King Pom-Pom | 5 | Off | Pom! | Skill · Ultimate · Talent | Trailblaze Silver Rail | 2/0/6/1 | squad dmg +44% |
| Phainon | 5 | On | Flame Reaver | Talent | The Grand Restaurant, Flame Reaver | 0/0/1/2 | — |
| Phainon | 5 | Off | Flame Reaver | Skill · Talent | The Grand Restaurant, Flame Reaver | 1/0/6/0 | squad lucky +18% |
| Xueyi | 5 | On | Piercing Shackles | Ultimate · Talent | Xianzhou Fleet, Break | 1/0/13/4 | squad mit +8% |
| Aeon ★ Aha | 7 | On | Master of Phantasia | Elation Skill · Talent | Elation, Master of Phantasia | 0/5/0/0 | Elation kit; — |
