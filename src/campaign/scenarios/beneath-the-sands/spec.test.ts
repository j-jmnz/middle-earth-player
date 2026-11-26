// Rules: TODO name the rule ids the rows exercise (data/rules/entries.json).
import { describe, it } from "vitest";

import { cardSpecs, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Beneath the Sands (haradrim part 6): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// TODO: the rows; the todo below stands in until there is one.
const ROWS: readonly Row[] = [
  // 17065 Brood Mother.
  // 17065:A:1 printed: Cannot have attachments. Cannot take damage.
  // records 17065:constant:1; timing constant
  { line: "17065:A:1", name: "Cannot have attachments. Cannot take damage.", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 17065:A:2 printed: Brood Mother engages the first player.
  // records 17065:forced:1; timing forced
  { line: "17065:A:2", name: "Brood Mother engages the first player.", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },
  // 17065:A:3 printed: Forced: At the end of the round, search the encounter deck and discard pile for a Spider Broodling and add it to the staging area, if able. Shuffle the encounter deck.
  // records 17065:forced:2; timing forced
  { line: "17065:A:3", name: "Forced: At the end of the round, search the encounter deck and discard", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 17066 Hive Guardian.
  // 17066:A:1 printed: While On Track is in play, Hive Guardian gets +2 Attack and -5 engagement cost.
  // records 17066:constant:1; timing constant
  { line: "17066:A:1", name: "While On Track is in play, Hive Guardian gets +2 Attack and -5", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 17066:A:2 printed: Shadow: Attacking enemy gets +1 Attack (+2 Attack instead if On Track is in play).
  // records 17066:shadow:1; timing shadow
  { line: "17066:A:2", name: "Shadow: Attacking enemy gets +1 Attack (+2 Attack instead if On Track", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 17067 Spider Broodling.
  // 17067:A:1 printed: While On Track is in play, Spider Broodling gains surge.
  // records 17067:constant:1; timing constant
  { line: "17067:A:1", name: "While On Track is in play, Spider Broodling gains surge.", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 17067:A:2 printed: Shadow: If On Track is in play, put Spider Broodling into play engaged with you and deal it a shadow card.
  // records 17067:shadow:1; timing shadow
  { line: "17067:A:2", name: "Shadow: If On Track is in play, put Spider Broodling into play engaged", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 17068 Spider Burrow.
  // 17068:A:2 printed: Forced: After Spider Burrow becomes the active location, flip the Search objective to On Track and add Brood Mother to the staging area.
  // records 17068:forced:1; timing forced
  { line: "17068:A:2", name: "Forced: After Spider Burrow becomes the active location, flip the", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 17069 Pitch Black Tunnel.
  // 17069:A:2 printed: X is the number of characters controlled by the first player.
  // records 17069:constant:1; timing constant
  { line: "17069:A:2", name: "X is the number of characters controlled by the first player.", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },

  // 17070 Nest of Vermin.
  // 17070:A:1 printed: Track 3.
  // records 17070:forced:1; timing forced
  { line: "17070:A:1", name: "Track 3.", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },
  // 17070:A:2 printed: Travel: Shuffle the encounter discard pile into the encounter deck and discard cards from the top until a Creature enemy is discarded. Add the discarded enemy to the staging area.
  // records 17070:travel:1; timing travel
  { line: "17070:A:2", name: "Travel: Shuffle the encounter discard pile into the encounter deck and", todo: "write the row from the printed line (1 record, timing travel)", layout: {}, act: [], expect: [] },

  // 17071 Cobwebbed Cavern.
  // 17071:A:1 printed: Track 2.
  // records 17071:forced:1; timing forced
  { line: "17071:A:1", name: "Track 2.", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },
  // 17071:A:2 printed: While On Track is in play, Cobwebbed Cavern gets +2 Threat.
  // records 17071:constant:1; timing constant
  { line: "17071:A:2", name: "While On Track is in play, Cobwebbed Cavern gets +2 Threat.", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 17071:A:3 printed: Shadow: Exhaust a character you control.
  // records 17071:shadow:1; timing shadow
  { line: "17071:A:3", name: "Shadow: Exhaust a character you control.", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 17072 Blocked Passage.
  // 17072:A:1 printed: Track 2.
  // records 17072:forced:1; timing forced
  { line: "17072:A:1", name: "Track 2.", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },
  // 17072:A:2 printed: While On Track is in play, progress cannot be placed on locations in the staging area.
  // records 17072:constant:1; timing constant
  { line: "17072:A:2", name: "While On Track is in play, progress cannot be placed on locations in", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 17072:A:3 printed: Shadow: Discard an attachment you control.
  // records 17072:shadow:1; timing shadow
  { line: "17072:A:3", name: "Shadow: Discard an attachment you control.", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 17073 Forced Off Track.
  // 17073:A:1 printed: When Revealed: Either flip the Search objective to Off Track, or deal 1 damage to each questing character.
  // records 17073:whenRevealed:1; timing whenRevealed
  { line: "17073:A:1", name: "When Revealed: Either flip the Search objective to Off Track, or deal", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },
  // 17073:A:2 printed: Shadow: If On Track is in play, attacking enemy makes an additional attack against you after this one.
  // records 17073:shadow:1; timing shadow
  { line: "17073:A:2", name: "Shadow: If On Track is in play, attacking enemy makes an additional", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 17074 Grabbed by Spiders.
  // 17074:A:2 printed: When Revealed: Attach to the main quest. Limit 1 per quest. (Counts as a Condition attachment with the text: "Forced: After the Search objective is flipped to Off Track, each player discards an ally he controls. Then, discard Grabbed by Spiders.")
  // records 17074:whenRevealed:1, 17074:constant:1, 17074:forced:1; timing whenRevealed, constant, forced
  { line: "17074:A:2", name: "When Revealed: Attach to the main quest. Limit 1 per quest. (Counts as", todo: "write the row from the printed line (3 records, timing whenRevealed, constant, forced)", layout: {}, act: [], expect: [] },

  // 17076 Searching the Caves.
  // 17076:A:1 printed: Setup: Set Brood Mother aside, out of play. Add the Search objective to the staging area (Off Track face up).
  // records 17076:setup:1; timing setup
  { line: "17076:A:1", name: "Setup: Set Brood Mother aside, out of play. Add the Search objective", todo: "write the row from the printed line (1 record, timing setup)", layout: {}, act: [], expect: [] },
  // 17076:B:1 printed: When Revealed: Discard cards from the encounter deck until X locations are discarded, where X is the number of players. Add each location discarded by this effect to the staging area.
  // records 17076:whenRevealed:1; timing whenRevealed
  { line: "17076:B:1", name: "When Revealed: Discard cards from the encounter deck until X locations", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },

  // 17077 Getting Closer.
  // 17077:A:1 printed: When Revealed: Flip the Search objective to Off Track. Shuffle the encounter discard pile into the encounter deck and discard cards from the top until X enemies are discarded, where X is the number of players. Add each enemy discarded by this effect to the staging area.
  // records 17077:whenRevealed:1; timing whenRevealed
  { line: "17077:A:1", name: "When Revealed: Flip the Search objective to Off Track. Shuffle the", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },
  // 17077:B:1 printed: While On Track is in play, encounter card effects cannot be canceled.
  // records 17077:constant:1; timing constant
  { line: "17077:B:1", name: "While On Track is in play, encounter card effects cannot be canceled.", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },

  // 17078 The Spiders' Hive.
  // 17078:A:1 printed: When Revealed: The first player adds Brood Mother to the staging area. Each other player reveals an encounter card. Flip the Search objective to Off Track.
  // records 17078:whenRevealed:1; timing whenRevealed
  { line: "17078:A:1", name: "When Revealed: The first player adds Brood Mother to the staging area.", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },
  // 17078:B:1 printed: While there are at least 5 progress tokens on this stage, Brood Mother loses the text: 'Cannot take damage.'
  // records 17078:constant:1; timing constant
  { line: "17078:B:1", name: "While there are at least 5 progress tokens on this stage, Brood Mother", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 17078:B:3 printed: This stage cannot be defeated while Brood Mother is in play. If the players defeat this stage, they win the game.
  // records 17078:constant:2, 17078:questResolution:1; timing constant, questResolution
  { line: "17078:B:3", name: "This stage cannot be defeated while Brood Mother is in play. If the", todo: "write the row from the printed line (2 records, timing constant, questResolution)", layout: {}, act: [], expect: [] },

  // 17079 Off Track.
  // 17079:A:2 printed: Progress cannot be placed on the main quest.
  // records 17079:constant:1; timing constant
  { line: "17079:A:2", name: "Progress cannot be placed on the main quest.", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },

  // 17080 On Track.
  // 17080:A:2 printed: Forced: After the players quest unsuccessfully, flip this objective.
  // records 17080:forced:2; timing forced
  { line: "17080:A:2", name: "Forced: After the players quest unsuccessfully, flip this objective.", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },
];

if (ROWS.length > 0) cardSpecs("beneath-the-sands", ROWS);
else describe("beneath-the-sands card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
