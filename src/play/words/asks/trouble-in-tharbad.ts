import type { Ask } from "../asks.ts";

// The choice words of Trouble in Tharbad (the-ring-maker part 6), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario trouble-in-tharbad --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=trouble-in-tharbad` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 08067:forced:1 (Escape from Tharbad, forced): Forced: After the last time counter is removed from the quest, either raise each player's threat by 3 or Bellach makes an immediate attack against Nalir. Then, place 3 time counters on this stage.
  "08067:forced:1 @0 Choose": { owned: true, note: "Escape from Tharbad: the last time counter is gone. As first player, choose for the group: each player raises their threat by 3, or Bellach attacks Nalir." },
  "08067:forced:1 @0 threat": { label: "Each player raises their threat by 3" },
  "08067:forced:1 @0 attack": { label: "Bellach makes an immediate attack against Nalir" },
  "08067:forced:1 @0.attack.0 Pick": { note: "Escape from Tharbad: Bellach makes an immediate attack against Nalir. Choose Bellach.", verb: "Attack" },
  // 08083:whenRevealed:1 (Get That Dwarf!, whenRevealed): When Revealed: The enemy in the staging area with the highest Attack engages the first player and makes an immediate attack against Nalir. If there are no enemies in the staging area, Get That Dwarf! gains surge.
  "08083:whenRevealed:1 @1 Pick": { note: "Get That Dwarf!: choose the enemy in the staging area with the highest Attack. It engages the first player and makes an immediate attack against Nalir.", verb: "Engage" },

  // 08083:A:2 (Shadow): if this attack is undefended, deal 2 damage to Nalir.
  "08083:shadow:1 @0 Pick": { note: "Get That Dwarf!'s shadow: this attack is undefended. Choose Nalir to take 2 damage.", verb: "Assign" },

  // 08077:A:1 (Travel): search the encounter deck and discard pile for a Spy enemy and add it to the staging area.
  "08077:travel:1 @0 SearchMove": { note: "{card}: search the encounter deck and discard pile for a Spy enemy. Add it to the staging area.", verb: "Add" },

  // 08080:A:1 and 08082:A:1 (When Revealed): the first player removes 1 time counter from the current quest, or the other branch.
  "08080:whenRevealed:1 @1 time": { label: "Remove 1 time counter from the current quest" },
  "08080:whenRevealed:1 @1 threat": { label: "Each Spy enemy in the staging area gets +2 Threat until the end of the phase" },
  "08082:whenRevealed:1 @0 time": { label: "Remove 1 time counter from the current quest" },
  "08082:whenRevealed:1 @0 enemies": { label: "Each enemy gets -20 engagement cost and +1 Attack until the end of the round" },
};
