import type { Amount } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";

// The choice words of The Siege of Gondor (the-return-of-the-king part 2), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-siege-of-gondor --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-siege-of-gondor` prints each sentence.
// X is the resources on The Corsair Fleet, read when the sheet opens (the Fleet places its resource before the players choose).
const FLEET_X: Amount = { resourcesOn: { type: "objective", control: "any", names: ["The Corsair Fleet"] } };

export const ASKS: Readonly<Record<string, Ask>> = {
  // 145030:A:3 (Travel): each player in turn, the first player first, searches for a Corsair enemy; the first search must take Corsair Captain while one is there.
  "145030:travel:1 @0.0 SearchMove": { owned: true, note: "Great Corsair Ship: search the encounter deck and discard pile for a Corsair enemy. Add it to the staging area. Corsair Captain must be taken first, if one is there.", verb: "Add" },
  // 145034:A:1: the first player assigns the 4 damage one point at a time among the characters in play, any player's.
  "145034:forced:1 @1 AssignDamage": { owned: true, note: "Pelargir Quays holds 4 damage tokens: assign {x} damage among the characters in play, any player's. Pelargir Quays is then discarded.", bind: { x: 4 }, verb: "Assign" },
  // 145037:A:2 and 145042:A:3: the engaged or defending player exhausts a ready character they control.
  "145037:forced:1 @0 Pick": { owned: true, note: "Umbar Pirate Crew engaged you: choose a ready character you control to exhaust.", verb: "Exhaust" },
  "145042:shadow:1 @0 Pick": { owned: true, note: "Driven to the Brink shadow: choose a ready character you control to exhaust.", verb: "Exhaust" },
  // 145038:A:1: 1 damage, 2 with a Ship as the active location.
  "145038:forced:1 @0 Pick": {
    owned: true,
    note: [
      { when: { kind: "matches", card: "activeLocation", pick: { type: "location", control: "any", trait: "Ship" } }, text: "Haradrim Pirate engaged you and a Ship is the active location: choose a character you control to take 2 damage." },
      { text: "Haradrim Pirate engaged you: choose a character you control to take 1 damage." },
    ],
    verb: "Assign",
  },
  // 145040:A:2: the revealing player searches for a Ship location when none but the unique Great Corsair Ship is in the staging area.
  "145040:whenRevealed:1 @1 SearchMove": { owned: true, note: "Black Sails: no non-unique Ship location is in the staging area. Search the encounter deck and discard pile for a Ship location. Add it to the staging area.", verb: "Add" },
  // 145041:A:1 (each player in turn, the first player first) and A:2 (the defending player).
  "145041:whenRevealed:1 @0.0 Choose": { owned: true, note: "Raiding the Coasts: add 3 to the staging area's Threat this phase, or discard your highest cost attachment." },
  "145041:whenRevealed:1 @0.0 threat": { label: "Add 3 to the staging area's Threat until the end of the phase" },
  "145041:whenRevealed:1 @0.0 discard": { label: "Discard the highest cost attachment you control" },
  "145041:whenRevealed:1 @0.0.discard.0 Pick": { owned: true, note: "Raiding the Coasts: choose, among your attachments tied for the highest cost, the one to discard.", verb: "Discard" },
  "145041:shadow:1 @1.0 Pick": { owned: true, note: "Raiding the Coasts shadow destroyed a character: choose an attachment you control to discard.", verb: "Discard" },
  // 145039:A:2 (Peril): the revealing player chooses alone.
  "145039:whenRevealed:1 @0 Choose": { owned: true, note: "Fell Folk of Umbar: return each Corsair enemy engaged with you to the staging area. Or discard from the encounter deck until a Corsair enemy is discarded: it engages you." },
  "145039:whenRevealed:1 @0 return": { label: "Return each Corsair enemy engaged with you to the staging area" },
  "145039:whenRevealed:1 @0 discard": { label: "Discard from the encounter deck until a Corsair enemy is discarded: it engages you" },
  // 145042:A:2 (Peril): the revealing player chooses alone; X is the Fleet's resources.
  "145042:whenRevealed:1 @0 Choose": { owned: true, note: "Driven to the Brink: end the quest phase without resolving the quest, or assign {x} damage among your questing characters.", bind: { x: FLEET_X } },
  "145042:whenRevealed:1 @0 end": { label: "End the quest phase now: no progress is made, the quest is not resolved" },
  "145042:whenRevealed:1 @0 damage": { label: "Assign {x} damage among your questing characters", bind: { x: FLEET_X } },
  "145042:whenRevealed:1 @0.damage.0 AssignDamage": { owned: true, note: "Driven to the Brink: assign {x} damage among the characters you committed to the quest.", bind: { x: FLEET_X }, verb: "Assign" },
  // 145069:A:1 (Setup): each player in turn, the first player first, searches the encounter deck (not its discard pile).
  "145069:setup:1 @0.0 SearchMove": { owned: true, note: "Attack on Pelargir: search the encounter deck, not its discard pile, for a Ship location. Add it to the staging area.", verb: "Add" },
  // 145071:A:1: at the beginning of the staging step each player in turn, the first player first, chooses.
  "145071:forced:1 @1.0 Choose": { owned: true, note: "The Corsair Fleet: you either reveal an encounter card on your own, or assign {x} damage among the characters you control.", bind: { x: FLEET_X } },
  "145071:forced:1 @1.0 reveal": { label: "Reveal an encounter card" },
  "145071:forced:1 @1.0 damage": { label: "Assign {x} damage among your characters", bind: { x: FLEET_X } },
  "145071:forced:1 @1.0.damage.0 AssignDamage": { owned: true, note: "The Corsair Fleet: assign {x} damage among the characters you control.", bind: { x: FLEET_X }, verb: "Assign" },
};
