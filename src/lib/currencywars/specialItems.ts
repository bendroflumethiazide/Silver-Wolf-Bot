/**
 * Items the 4.7 mechanics add that aren't in the wiki's equipment tables: Trailblaze Store
 * consumables and Bond-exclusive Components, Projectors, the Plot Armor item, Weapon Boxes and
 * Mr. Yang's Imploding Singularity. `verified` marks texts copied from the HSR Wiki (Version 4.7);
 * anything else (e.g. the cost limit of Intern/Staff Projectors) is a stated guess.
 */

export type SpecialUse = "projector" | "plotArmor" | "box" | "equip";

export interface SpecialItem {
  name: string;
  /** "consumable": used up when dragged on a character; "component": equipped like equipment. */
  kind: "consumable" | "component";
  text: string;
  verified: boolean;
  use: SpecialUse;
  /** Projectors: highest cost they can copy, and the Bond the target must be in (if any). */
  maxCost?: number;
  bond?: string;
  /** Components only some characters can equip. */
  only?: string;
  /** Strength the component adds to its wearer in the simulator's model (a share, like advanced equipment's 0.15). */
  power?: number;
  /** Source shown in the item details. */
  source: string;
}

const TSR = "Trailblaze Silver Rail";

export const SPECIAL_ITEMS: Record<string, SpecialItem> = Object.fromEntries(([
  { name: "Trailblaze: Staff Projector", kind: "consumable", use: "projector", maxCost: 3, bond: TSR, verified: true, source: "Trailblaze Store",
    text: "Drag onto a 3-Cost or lower \"Trailblaze Silver Rail\" character to use, creating a 1-star copy of this character in the preparation area. This item disappears after use." },
  { name: "Trailblaze: Perfect Projector", kind: "consumable", use: "projector", maxCost: 99, bond: TSR, verified: true, source: "Trailblaze Store",
    text: "Drag onto any \"Trailblaze Silver Rail\" character to use, creating a 1-star copy of this character in the preparation area. This item disappears after use." },
  { name: "Intern Projector", kind: "consumable", use: "projector", maxCost: 2, verified: false, source: "Pearliefin (Voyage Companion)",
    text: "Drag onto a character to create a 1-star copy of them in the preparation area. The wiki doesn't give its cost limit; 2-Cost or lower is assumed here." },
  { name: "Staff Projector", kind: "consumable", use: "projector", maxCost: 3, verified: false, source: "Pearliefin, \"Stars To Stars\"",
    text: "Drag onto a character to create a 1-star copy of them in the preparation area. Cost limit 3 assumed (as the Trailblaze Staff Projector)." },
  { name: "Perfect Projector", kind: "consumable", use: "projector", maxCost: 99, verified: false, source: "Pearliefin (Voyage Companion)",
    text: "Drag onto any character to create a 1-star copy of them in the preparation area (no cost limit assumed)." },
  { name: "Phantasmoon: Plot Armor", kind: "consumable", use: "plotArmor", verified: true, source: "Phantasmoon Games: Roll-Call (5) \"Imagenae: Plot Armor\"",
    text: "Drag onto a character to use. You can select Plot Armor 1 time." },
  { name: "Basic Weapon Box", kind: "consumable", use: "box", verified: true, source: "Mummicat (Voyage Companion)",
    text: "Open it and choose 1 piece of basic equipment." },
  { name: "Imploding Singularity", kind: "component", use: "equip", power: 0.05, verified: true, source: "Mr. Yang (Voyage Companion)",
    text: "Provides stat growth on a winning streak and reduces equipment stats upon defeat. (Here: +3% strength per stack, +1 stack per win, −1 per loss, 0–10 stacks; the sizes are assumed.)" },
  { name: "Overload Energy Module", kind: "component", use: "equip", only: "King Pom-Pom", power: 0.2, verified: true, source: "Trailblaze Store (Bond Level 6)",
    text: "Can only be equipped by King Pom-Pom. The proportion of the DMG record used to deal True DMG increases by 20%, and regenerates 10 Energy after taking action. Upon entering a new Node, gain 10/20/100 \"Trailblaze Power\" based on the star rating of \"King Pom-Pom.\"" },
  { name: "Evolution Modification Module", kind: "component", use: "equip", only: "King Pom-Pom", power: 0.15, verified: true, source: "Trailblaze Store (Bond Level 6)",
    text: "Can only be equipped by King Pom-Pom. Before entering combat, temporarily changes the first equipped piece of advanced equipment into privileged equipment." },
  { name: "Navigator's Banner", kind: "component", use: "equip", power: 0.3, verified: true, source: "Trailblaze Store (Bond Level 6)",
    text: "The wearer gains 30% Skill/Ultimate DMG Amplification. After using a Skill, the wearer's Ultimate DMG Amplification increases by 10%, stacking up to 6 time(s). This effect resets after using an Ultimate." },
  { name: "Cloud-Piercer Thunder", kind: "component", use: "equip", power: 0.3, verified: true, source: "Trailblaze Store (Bond Level 6)",
    text: "The wearer gains 30% Basic ATK DMG Amplification. For every 1 Skill Point consumed, the next Basic ATK additionally deals 10% Lucky Strike DMG, up to a maximum of 30%." },
  { name: "Nameless Proof", kind: "component", use: "equip", power: 0.4, verified: true, source: "Trailblaze Store (Bond Level 6)",
    text: "Greatly increases On/Off-Field Strength. The wearer's attacks can \"Execute\" enemy targets whose HP percentage is lower than 12%." },
  { name: "Trailblaze's Whistle", kind: "component", use: "equip", power: 0.1, verified: true, source: "Trailblaze Store (Bond Level 6)",
    text: "After the wearer uses their Ultimate, summons the \"Astral Express\" to strike all enemy targets, dealing DMG based on the current Express level. \"Light Rail\": Increases the ally squad's On/Off-Field Strength by 30%. Provides 1 stack of \"Light Rail\" after an Express collision; increases the max stack limit of \"Light Rail\" by 2." },
] as SpecialItem[]).map((x) => [x.name, x]));

export const specialItem = (name: string): SpecialItem | undefined => SPECIAL_ITEMS[name];
