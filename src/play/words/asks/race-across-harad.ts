import type { Condition } from "../../../catalog/boundary.ts";

import type { Ask } from "../asks.ts";
import { URUK_CHIEFTAIN_ASKS } from "../haradrim-asks.ts";

// A condition that always holds: a caution that does not depend on the table.
const ALWAYS: Condition = { kind: "all", conditions: [] };

// The choice words of Race Across Harad (haradrim part 5), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario race-across-harad --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=race-across-harad` prints each sentence.
// X is the stage number of the main quest (17041): the bind reads it from the quest.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 17047:A:1 (Setup): each player takes control of a Tamed Mûmak; copies of one card are one choice, so this asks only when the set-aside copies differ.
  "17047:setup:1 @0.0 TakeObjectiveAlly": { owned: true, note: "Setup: take control of a Tamed Mûmak. It enters play under your control, ready.", verb: "Take" },

  // 16064:A:1 (Mordor Warg): it attaches to an Orc enemy in play, also one in the Orcs' area; that enemy returns to the staging area.
  "16064:whenRevealed:1 @0 Pick": { owned: true, note: "Mordor Warg: choose an Orc enemy in play, in the staging area, engaged or in the Orcs' area, to attach to. It returns to the staging area.", verb: "Attach" },

  // 17044:A:2 (Racing Warg): it attaches to an Orc enemy in play, the Chieftain and Orcs in the Orcs' area included; with no Orc it is discarded.
  "17044:whenRevealed:1 @0 Pick": { owned: true, note: "Racing Warg: choose an Orc enemy to attach to, in the staging area, engaged or in the Orcs' area. It gets +1 Threat, +1 Attack, +1 Defense and +1 hit point.", verb: "Attach" },

  // 17041:A:2 (Blistering Erg): X is the stage number of the main quest; each player assigns X damage among the characters he controls.
  "17041:forced:1 @0 AssignDamage": { owned: true, note: "Blistering Erg: assign {x} damage, the stage number of the main quest, among the characters you control ({left} left).", bind: { x: { stage: true } }, verb: "Assign", title: "{card}: assign {left}" },

  // 17048:A:1 (Racing North): the first player chooses where the set aside Uruk Warg-rider is added.
  "17048:whenRevealed:1 @0 Choose": { note: "Racing North: choose where the set aside Uruk Warg-rider is added, the staging area or the Orcs' area." },
  // Each branch warns what it does with the Warg-rider's 3 Threat (a warning that holds whatever the table says: `ALWAYS`).
  "17048:whenRevealed:1 @0 staging": { label: "Add Uruk Warg-rider to the staging area", caution: { when: ALWAYS, text: "Tap again: its 3 Threat counts now and you can engage it." } },
  "17048:whenRevealed:1 @0 orcsArea": {
    label: "Add Uruk Warg-rider to the Orcs' area",
    caution: {
      when: ALWAYS,
      text: [
        { when: { kind: "orcsStage", is: "sameStage" }, text: "Tap again: the Orcs are at your stage, so it counts in the staging area, and its Threat adds to the Orcs' progress." },
        { text: "Tap again: it is out of reach while you are apart, and its Threat adds to the Orcs' progress." },
      ],
    },
  },

  // 17052:B:2 and 17053:B:2 (Racing North, Hunted in Harad, the Orcs' stages 2D and 3D): the Chieftain returns to the Orcs' area before the progress is counted.
  "17052:forced:1 @0 Pick": { note: "{card}: Uruk Chieftain returns to the Orcs' area at the end of the quest phase, before the Orcs' progress is counted.", verb: "Return" },
  "17053:forced:1 @0 Pick": { note: "{card}: Uruk Chieftain returns to the Orcs' area at the end of the quest phase, before the Orcs' progress is counted.", verb: "Return" },

  // 16061:A:3 (Uruk Chieftain): the first player picks among tied players (haradrim-asks.ts).
  ...URUK_CHIEFTAIN_ASKS,
};
