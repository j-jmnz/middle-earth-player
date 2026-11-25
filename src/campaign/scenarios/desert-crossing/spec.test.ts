// Rules: TODO name the rule ids the rows exercise (data/rules/entries.json).
import { describe, it } from "vitest";

import { cardSpecs, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Desert Crossing (haradrim part 2): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// TODO: the rows; the todo below stands in until there is one.
const ROWS: readonly Row[] = [
  // 16022 Mirage.
  // 16022:A:1 printed: When Revealed: Discard the active location. Shuffle the encounter discard pile into the encounter deck and discard cards from the top until a location is discarded. Make that location the active location.
  // records 16022:whenRevealed:1; timing whenRevealed
  { line: "16022:A:1", name: "When Revealed: Discard the active location. Shuffle the encounter", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },

  // 16023 Seek Shade.
  // 16023:A:2 printed: Forced: At the end of the round, remove X progress from the main quest. X is the tens digit of the temperature.
  // records 16023:forced:1; timing forced
  { line: "16023:A:2", name: "Forced: At the end of the round, remove X progress from the main", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 16024 Carrion Bird.
  // 16024:A:1 printed: Carrion Bird gets -1 engagement cost for each damaged character in play.
  // records 16024:constant:1; timing constant
  { line: "16024:A:1", name: "Carrion Bird gets -1 engagement cost for each damaged character in", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 16024:A:2 printed: Forced: After Carrion Bird engages you, discard a damaged character you control.
  // records 16024:forced:1; timing forced
  { line: "16024:A:2", name: "Forced: After Carrion Bird engages you, discard a damaged character", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 16025 Burnt Sands.
  // 16025:A:2 printed: Forced: After Burnt Sands becomes the active location, increase the temperature by 2.
  // records 16025:forced:1; timing forced
  { line: "16025:A:2", name: "Forced: After Burnt Sands becomes the active location, increase the", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 16026 Scorched Hamada.
  // 16026:A:2 printed: Forced: After Scorched Hamada becomes the active location, assign X damage among characters in play.
  // records 16026:forced:1; timing forced
  { line: "16026:A:2", name: "Forced: After Scorched Hamada becomes the active location, assign X", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },
  // 16026:A:3 printed: Shadow: Raise your threat by X, where X is the tens digit of the temperature.
  // records 16026:shadow:1; timing shadow
  { line: "16026:A:3", name: "Shadow: Raise your threat by X, where X is the tens digit of the", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 16027 Parched Wadi.
  // 16027:A:1 printed: While Parched Wadi is in the staging area, each Creature enemy gets +1 Threat and +1 Attack.
  // records 16027:constant:1; timing constant
  { line: "16027:A:1", name: "While Parched Wadi is in the staging area, each Creature enemy gets +1", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 16027:A:2 printed: Forced: After Parched Wadi becomes the active location, shuffle the encounter discard pile into the encounter deck and discard cards from the top until a Creature enemy is discarded. Add that enemy to the staging area.
  // records 16027:forced:1; timing forced
  { line: "16027:A:2", name: "Forced: After Parched Wadi becomes the active location, shuffle the", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 16028 Were-worm.
  // 16028:A:1 printed: X is the tens digit of the temperature.
  // records 16028:constant:1; timing constant
  { line: "16028:A:1", name: "X is the tens digit of the temperature.", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 16028:A:2 printed: Forced: After Were-worm engages you, it makes an immediate attack. (Do not deal it a shadow card.)
  // records 16028:forced:1; timing forced
  { line: "16028:A:2", name: "Forced: After Were-worm engages you, it makes an immediate attack. (Do", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },
  // 16028:A:3 printed: Shadow: Attacking enemy gets +1 Attack (+2 Attack instead if the temperature is 40 or higher).
  // records 16028:shadow:1; timing shadow
  { line: "16028:A:3", name: "Shadow: Attacking enemy gets +1 Attack (+2 Attack instead if the", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 16029 Unbearable Heat.
  // 16029:A:1 printed: When Revealed: Each player assigns X damage among characters he controls, where X is the tens digit of the temperature.
  // records 16029:whenRevealed:1; timing whenRevealed
  { line: "16029:A:1", name: "When Revealed: Each player assigns X damage among characters he", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },
  // 16029:A:2 printed: Shadow: Attacking enemy gets +X Attack, where X is the tens digit of the temperature.
  // records 16029:shadow:1; timing shadow
  { line: "16029:A:2", name: "Shadow: Attacking enemy gets +X Attack, where X is the tens digit of", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 16030 Scorching Sun.
  // 16030:A:2 printed: When Revealed: Increase the temperature by 4.
  // records 16030:whenRevealed:1; timing whenRevealed
  { line: "16030:A:2", name: "When Revealed: Increase the temperature by 4.", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },
  // 16030:A:3 printed: Shadow: Either increase the temperature by 2, or return attacking enemy to the staging area after this attack.
  // records 16030:shadow:1; timing shadow
  { line: "16030:A:3", name: "Shadow: Either increase the temperature by 2, or return attacking", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 16048 Find Water.
  // 16048:A:1 printed: Characters cannot be readied by player card effects.
  // records 16048:constant:1; timing constant
  { line: "16048:A:1", name: "Characters cannot be readied by player card effects.", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 16048:A:2 printed: Response: When this stage is defeated, each player readies 1 hero he controls.
  // records 16048:response:1; timing response
  { line: "16048:A:2", name: "Response: When this stage is defeated, each player readies 1 hero he", todo: "write the row from the printed line (1 record, timing response)", layout: {}, act: [], expect: [] },

  // 16049 Towering Dunes.
  // 16049:A:1 printed: While Towering Dunes is in the staging area, progress cannot be placed on locations in the staging area not named Towering Dunes.
  // records 16049:constant:1; timing constant
  { line: "16049:A:1", name: "While Towering Dunes is in the staging area, progress cannot be placed", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 16049:A:2 printed: Forced: After Towering Dunes becomes the active location, reveal the top card of the encounter deck.
  // records 16049:forced:1; timing forced
  { line: "16049:A:2", name: "Forced: After Towering Dunes becomes the active location, reveal the", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 16050 Desert Oasis.
  // 16050:A:1 printed: While Desert Oasis is the active location, it gains: "Response: When Desert Oasis is explored, heal 4 damage from among characters in play."
  // records 16050:response:1; timing response
  { line: "16050:A:1", name: "While Desert Oasis is the active location, it gains: \"Response: When", todo: "write the row from the printed line (1 record, timing response)", layout: {}, act: [], expect: [] },
  // 16050:A:2 printed: Forced: After Desert Oasis becomes the active location, each player exhausts a character he controls.
  // records 16050:forced:1; timing forced
  { line: "16050:A:2", name: "Forced: After Desert Oasis becomes the active location, each player", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 16051 Sandstorm.
  // 16051:A:1 printed: When Revealed: Each player either discards his hand, or assigns X damage among characters he controls. X is the number of cards in his hand.
  // records 16051:whenRevealed:1; timing whenRevealed
  { line: "16051:A:1", name: "When Revealed: Each player either discards his hand, or assigns X", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },
  // 16051:A:2 printed: Shadow: Either discard the highest cost attachment you control, or assign X damage among characters you control where X is the number of attachments you control.
  // records 16051:shadow:1; timing shadow
  { line: "16051:A:2", name: "Shadow: Either discard the highest cost attachment you control, or", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 16052 Heat Exhaustion.
  // 16052:A:1 printed: When Revealed: Each player exhausts a character he controls and deals 1 damage to that character.
  // records 16052:whenRevealed:1; timing whenRevealed
  { line: "16052:A:1", name: "When Revealed: Each player exhausts a character he controls and deals", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },
  // 16052:A:2 printed: Shadow: Exhaust a character you control.
  // records 16052:shadow:1; timing shadow
  { line: "16052:A:2", name: "Shadow: Exhaust a character you control.", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 16053 Craft Remedy.
  // 16053:A:1 printed: Treat the printed text box of each damaged character as if it were blank (except for Traits).
  // records 16053:constant:1; timing constant
  { line: "16053:A:1", name: "Treat the printed text box of each damaged character as if it were", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 16053:A:2 printed: Response: When this stage is defeated, heal 1 damage from each character in play.
  // records 16053:response:1; timing response
  { line: "16053:A:2", name: "Response: When this stage is defeated, heal 1 damage from each", todo: "write the row from the printed line (1 record, timing response)", layout: {}, act: [], expect: [] },

  // 16054 Sand Viper.
  // 16054:A:1 printed: Players cannot declare defenders against Sand Viper.
  // records 16054:constant:1; timing constant
  { line: "16054:A:1", name: "Players cannot declare defenders against Sand Viper.", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 16054:A:2 printed: Forced: After the players travel to a location, Sand Viper engages the first player.
  // records 16054:forced:1; timing forced
  { line: "16054:A:2", name: "Forced: After the players travel to a location, Sand Viper engages the", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 16055 Giant Scorpion.
  // 16055:A:1 printed: Forced: After Giant Scorpion damages a character, that character cannot ready until the end of the round.
  // records 16055:forced:1; timing forced
  { line: "16055:A:1", name: "Forced: After Giant Scorpion damages a character, that character", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },
  // 16055:A:2 printed: Shadow: If this attack deals damage, the defending character cannot ready until the end of the round.
  // records 16055:shadow:1; timing shadow
  { line: "16055:A:2", name: "Shadow: If this attack deals damage, the defending character cannot", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 16068 The Desert of Harad.
  // 16068:B:1 printed: Forced: After an ally enters play, either exhaust it, or deal 1 damage to it.
  // records 16068:forced:1; timing forced
  { line: "16068:B:1", name: "Forced: After an ally enters play, either exhaust it, or deal 1 damage", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 16070 Beasts of Legend.
  // 16070:A:1 printed: When Revealed: Increase the temperature by 2. Each player searches the encounter deck, discard pile, and victory display for a Were-worm and adds it to the staging area, if able. Shuffle the encounter deck.
  // records 16070:whenRevealed:1; timing whenRevealed
  { line: "16070:A:1", name: "When Revealed: Increase the temperature by 2. Each player searches the", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },
  // 16070:B:1 printed: During the quest phase, add X Threat to the total Threat in the staging area, where X is the tens digit of the temperature.
  // records 16070:constant:1; timing constant
  { line: "16070:B:1", name: "During the quest phase, add X Threat to the total Threat in the", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 16070:B:2 printed: Forced: At the end of the round, increase the temperature by 4.
  // records 16070:forced:1; timing forced
  { line: "16070:B:2", name: "Forced: At the end of the round, increase the temperature by 4.", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },
];

if (ROWS.length > 0) cardSpecs("desert-crossing", ROWS);
else describe("desert-crossing card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
