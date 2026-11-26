// Rules: TODO name the rule ids the rows exercise (data/rules/entries.json).
import { describe, it } from "vitest";

import { cardSpecs, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Trouble in Tharbad (the-ring-maker part 6): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// TODO: the rows; the todo below stands in until there is one.
const ROWS: readonly Row[] = [
  // 08066 Double Dealings.
  // 08066:A:1 printed: Setup: Set Bellach and The Crossing at Tharbad aside, out of play. Search the encounter deck for 1 copy of Spy From Mordor per player, and add them to the staging area. Make The Empty Mug the active location. The first player takes control of Nalir, as an ally. Shuffle the encounter deck.
  // records 08066:setup:1; timing setup
  { line: "08066:A:1", name: "Setup: Set Bellach and The Crossing at Tharbad aside, out of play.", todo: "write the row from the printed line (1 record, timing setup)", layout: {}, act: [], expect: [] },
  // 08066:B:1 printed: Time 4.
  // records 08066:constant:1; timing constant
  { line: "08066:B:1", name: "Time 4.", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },

  // 08067 Escape from Tharbad.
  // 08067:A:1 printed: When Revealed: Add Bellach and The Crossing at Tharbad to the staging area. Then, shuffle the encounter discard pile into the encounter deck and discard cards from the encounter deck until X Orc enemies have been discarded, where X is the number of players in the game. Add all discarded Orc enemies to the staging area.
  // records 08067:whenRevealed:1; timing whenRevealed
  { line: "08067:A:1", name: "When Revealed: Add Bellach and The Crossing at Tharbad to the staging", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },
  // 08067:B:1 printed: Time 3.
  // records 08067:constant:1; timing constant
  { line: "08067:B:1", name: "Time 3.", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 08067:B:4 printed: Forced: After a character leaves play, raise its controller's threat by 2.
  // records 08067:forced:3; timing forced
  { line: "08067:B:4", name: "Forced: After a character leaves play, raise its controller's threat", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 08068 Nalir.
  // 08068:A:1 printed: The first player gains control of Nalir.
  // records 08068:constant:1; timing constant
  { line: "08068:A:1", name: "The first player gains control of Nalir.", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 08068:A:2 printed: Forced: At the beginning of the refresh phase, raise your threat by 1 for each player in the game.
  // records 08068:forced:1; timing forced
  { line: "08068:A:2", name: "Forced: At the beginning of the refresh phase, raise your threat by 1", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 08070 Bellach.
  // 08070:A:1 printed: X is the number of players in the game.
  // records 08070:constant:1; timing constant
  { line: "08070:A:1", name: "X is the number of players in the game.", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 08070:A:2 printed: Orc and Creature enemies get -30 engagement cost and +1 Threat.
  // records 08070:constant:2; timing constant
  { line: "08070:A:2", name: "Orc and Creature enemies get -30 engagement cost and +1 Threat.", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },

  // 08072 Spy from Mordor.
  // 08072:A:1 printed: Forced: When Spy From Mordor attacks, remove 1 time counter from the current quest.
  // records 08072:forced:1; timing forced
  { line: "08072:A:1", name: "Forced: When Spy From Mordor attacks, remove 1 time counter from the", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 08073 Bellach's Marauder.
  // 08073:A:1 printed: While Bellach's Marauder is engaged with a player, it gains: 'Forced: After a time counter is removed from the current quest, deal Bellach's Marauder 2 shadow cards.'
  // records 08073:forced:1; timing forced
  { line: "08073:A:1", name: "While Bellach's Marauder is engaged with a player, it gains: 'Forced", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },
  // 08073:A:2 printed: Shadow: Remove 1 time counter from the current quest.
  // records 08073:shadow:1; timing shadow
  { line: "08073:A:2", name: "Shadow: Remove 1 time counter from the current quest.", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 08074 Streets of Tharbad.
  // 08074:A:1 printed: Progress cannot be placed on Streets of Tharbad while it is in the staging area.
  // records 08074:constant:1; timing constant
  { line: "08074:A:1", name: "Progress cannot be placed on Streets of Tharbad while it is in the", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 08074:A:2 printed: While Streets of Tharbad is the active location, enemies get -20 engagement cost.
  // records 08074:constant:2; timing constant
  { line: "08074:A:2", name: "While Streets of Tharbad is the active location, enemies get -20", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },

  // 08075 Tharbad Hideout.
  // 08075:A:3 printed: Forced: At the beginning of the quest phase, place 1 progress on Tharbad Hideout.
  // records 08075:forced:1; timing forced
  { line: "08075:A:3", name: "Forced: At the beginning of the quest phase, place 1 progress on", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 08076 Ruins of the Second Age.
  // 08076:A:1 printed: While Ruins of the Second Age is in the staging area, City locations get +1 Threat.
  // records 08076:constant:1; timing constant
  { line: "08076:A:1", name: "While Ruins of the Second Age is in the staging area, City locations", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 08076:A:2 printed: While Ruins of the Second Age is the active location, deal engaged enemies 1 additional shadow card at the beginning of the combat phase.
  // records 08076:forced:1; timing forced
  { line: "08076:A:2", name: "While Ruins of the Second Age is the active location, deal engaged", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 08077 Seedy Inn.
  // 08077:A:2 printed: Shadow: Raise the defending player's threat by X, where X is the amount of damage dealt by this attack.
  // records 08077:shadow:1; timing shadow
  { line: "08077:A:2", name: "Shadow: Raise the defending player's threat by X, where X is the", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 08078 Hidden Alleyway.
  // 08078:A:1 printed: Travel: Raise each player's threat by X to travel here. X is the number of enemies in play.
  // records 08078:travel:1; timing travel
  { line: "08078:A:1", name: "Travel: Raise each player's threat by X to travel here. X is the", todo: "write the row from the printed line (1 record, timing travel)", layout: {}, act: [], expect: [] },
  // 08078:A:2 printed: Forced: After traveling to Hidden Alleyway, add 1 time counter to the current quest.
  // records 08078:forced:1; timing forced
  { line: "08078:A:2", name: "Forced: After traveling to Hidden Alleyway, add 1 time counter to the", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 08079 Decrepit Rooftops.
  // 08079:A:1 printed: While Decrepit Rooftops is the active location, enemies get +1 Threat and do not make engagement checks.
  // records 08079:constant:1; timing constant
  { line: "08079:A:1", name: "While Decrepit Rooftops is the active location, enemies get +1 Threat", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 08079:A:2 printed: Forced: After traveling to Decrepit Rooftops, return all engaged enemies to the staging area.
  // records 08079:forced:1; timing forced
  { line: "08079:A:2", name: "Forced: After traveling to Decrepit Rooftops, return all engaged", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 08080 Constant Tail.
  // 08080:A:1 printed: When Revealed: Return all engaged enemies to the staging area. Then, the first player either removes 1 time counter from the current quest or each Spy enemy in the staging area gets +2 Threat until the end of the phase.
  // records 08080:whenRevealed:1; timing whenRevealed
  { line: "08080:A:1", name: "When Revealed: Return all engaged enemies to the staging area. Then", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },

  // 08081 Conspicuous Lot.
  // 08081:A:2 printed: Shadow: Attacking enemy gets +1 Attack. (+2 Attack instead if the defending player's threat is 20 or less).
  // records 08081:shadow:1; timing shadow
  { line: "08081:A:2", name: "Shadow: Attacking enemy gets +1 Attack. (+2 Attack instead if the", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 08082 Cornered.
  // 08082:A:1 printed: When Revealed: The first player either removes 1 time counter from the current quest or each enemy gets -20 engagement cost and +1 Attack until the end of the round.
  // records 08082:whenRevealed:1; timing whenRevealed
  { line: "08082:A:1", name: "When Revealed: The first player either removes 1 time counter from the", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },
  // 08082:A:2 printed: Shadow: Attacking enemy gets +1 Attack (+2 Attack instead if the defending player's threat is 20 or less).
  // records 08082:shadow:1; timing shadow
  { line: "08082:A:2", name: "Shadow: Attacking enemy gets +1 Attack (+2 Attack instead if the", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 08083 Get That Dwarf!.
  // 08083:A:2 printed: Shadow: If this attack is undefended, deal 2 damage to Nalir.
  // records 08083:shadow:1; timing shadow
  { line: "08083:A:2", name: "Shadow: If this attack is undefended, deal 2 damage to Nalir.", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },
];

if (ROWS.length > 0) cardSpecs("trouble-in-tharbad", ROWS);
else describe("trouble-in-tharbad card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
