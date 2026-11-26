import type { Ask } from "../asks.ts";

// The choice words of Race Across Harad (haradrim part 5), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario race-across-harad --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=race-across-harad` prints each sentence.
// X is the stage number of the main quest (17041): the bind reads it from the quest.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 16064:A:1 (Mordor Warg): it attaches to an Orc enemy in play, also one in the Orcs' area; that enemy returns to the staging area.
  "16064:whenRevealed:1 @0 Pick": { owned: true, note: "Mordor Warg: choose an Orc enemy in play, in the staging area, engaged or in the Orcs' area, to attach to. It returns to the staging area.", verb: "Attach" },

  // 17044:A:2 (Racing Warg): it attaches to an Orc enemy in play, the Chieftain and Orcs in the Orcs' area included; with no Orc it is discarded.
  "17044:whenRevealed:1 @0 Pick": { owned: true, note: "Racing Warg: choose an Orc enemy to attach to, in the staging area, engaged or in the Orcs' area. It gets +1 Threat, +1 Attack, +1 Defense and +1 hit point.", verb: "Attach" },

  // 17041:A:2 (Blistering Erg): X is the stage number of the main quest; each player assigns X damage among the characters he controls.
  "17041:forced:1 @0 AssignDamage": { owned: true, note: "Blistering Erg: assign {x} damage, the stage number of the main quest, among the characters you control ({left} left).", bind: { x: { stage: true } }, verb: "Assign", title: "{card}: assign {left}" },

  // 17048:A:1 (Racing North): the first player chooses where the set aside Uruk Warg-rider is added.
  "17048:whenRevealed:1 @0 Choose": { note: "Racing North: choose where the set aside Uruk Warg-rider is added, the staging area or the Orcs' area." },
  "17048:whenRevealed:1 @0 staging": { label: "Add Uruk Warg-rider to the staging area" },
  "17048:whenRevealed:1 @0 orcsArea": { label: "Add Uruk Warg-rider to the Orcs' area" },

  // 17052:B:2 and 17053:B:2 (Racing North, Hunted in Harad, the Orcs' stages 2D and 3D): the Chieftain returns to the Orcs' area before the progress is counted.
  "17052:forced:1 @0 Pick": { note: "{card}: Uruk Chieftain returns to the Orcs' area at the end of the quest phase, before the Orcs' progress is counted.", verb: "Return" },
  "17053:forced:1 @0 Pick": { note: "{card}: Uruk Chieftain returns to the Orcs' area at the end of the quest phase, before the Orcs' progress is counted.", verb: "Return" },
};
