// Rules: TODO name the rule ids the rows exercise (data/rules/entries.json).
import { describe, it } from "vitest";

import { cardSpecs, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Peril in Pelargir (against-the-shadow part 1): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// TODO: the rows; the todo below stands in until there is one.
const ROWS: readonly Row[] = [
  // 05019 Alcaron's Scroll.
  // 05019:A:1 printed: If unattached, return Alcaron's Scroll to the staging area and it gains: 'Action: Exhaust a hero to attach Alcaron's Scroll to that hero.'
  // records 05019:constant:1, 05019:action:1; timing constant, action
  { line: "05019:A:1", name: "If unattached, return Alcaron's Scroll to the staging area and it", todo: "write the row from the printed line (2 records, timing constant, action)", layout: {}, act: [], expect: [] },
  // 05019:A:2 printed: Forced: When the hero with Alcaron's Scroll attached is damaged by an enemy attack, attach Alcaron's Scroll to that enemy.
  // records 05019:forced:1; timing forced
  { line: "05019:A:2", name: "Forced: When the hero with Alcaron's Scroll attached is damaged by an", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 05020 Harbor Thug.
  // 05020:A:1 printed: Forced: When the player whose hero has Alcaron's Scroll attached raises his threat, Harbor Thug engages that player.
  // records 05020:forced:1; timing forced
  { line: "05020:A:1", name: "Forced: When the player whose hero has Alcaron's Scroll attached", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },
  // 05020:A:2 printed: Shadow: Any damage dealt by this attack is dealt to the hero with Alcaron's Scroll attached, if able.
  // records 05020:shadow:1; timing shadow
  { line: "05020:A:2", name: "Shadow: Any damage dealt by this attack is dealt to the hero with", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 05021 The Leaping Fish.
  // 05021:A:1 printed: If Alcaron's Scroll is attached to a hero, The Leaping Fish gains: 'Forced: At the beginning of the quest phase discard X cards from the top of the encounter deck where X is the number of players in the game. Add each enemy discarded by this effect to the staging area.'
  // records 05021:forced:1; timing forced
  { line: "05021:A:1", name: "If Alcaron's Scroll is attached to a hero, The Leaping Fish gains", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 05022 Pelargir Docks.
  // 05022:A:1 printed: While Pelargir Docks is the active location, enemies get +1 Attack and +1 Defense.
  // records 05022:constant:1; timing constant
  { line: "05022:A:1", name: "While Pelargir Docks is the active location, enemies get +1 Attack and", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },

  // 05023 Harbor Storehouse.
  // 05023:A:1 printed: Forced: Each time a location is discarded from the top of the encounter deck, raise each player's threat by 1.
  // records 05023:constant:1, 05023:forced:1; timing constant, forced
  { line: "05023:A:1", name: "Forced: Each time a location is discarded from the top of the", todo: "write the row from the printed line (2 records, timing constant, forced)", layout: {}, act: [], expect: [] },
  // 05023:A:2 printed: Shadow: Deal attacking enemy an additional shadow card for each Thug enemy in play.
  // records 05023:shadow:1; timing shadow
  { line: "05023:A:2", name: "Shadow: Deal attacking enemy an additional shadow card for each Thug", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 05037 Pickpocket.
  // 05037:A:1 printed: Forced: When Pickpocket attacks, the defending player discards 1 resource from one of his heroes' resource pools and 1 card at random from his hand.
  // records 05037:forced:1; timing forced
  { line: "05037:A:1", name: "Forced: When Pickpocket attacks, the defending player discards 1", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },
  // 05037:A:2 printed: Shadow: Defending player discards 1 of his attachments. (Discard all of his attachments instead if undefended.)
  // records 05037:shadow:1; timing shadow
  { line: "05037:A:2", name: "Shadow: Defending player discards 1 of his attachments. (Discard all", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 05038 City Street.
  // 05038:A:2 printed: While City Street is in the staging area, players cannot travel to a location that does not have the title City Street.
  // records 05038:constant:1; timing constant
  { line: "05038:A:2", name: "While City Street is in the staging area, players cannot travel to a", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },

  // 05039 Market Square.
  // 05039:A:2 printed: Travel: Each player must spend 1 resource from one of his heroes' resource pools to travel here.
  // records 05039:travel:1; timing travel
  { line: "05039:A:2", name: "Travel: Each player must spend 1 resource from one of his heroes'", todo: "write the row from the printed line (1 record, timing travel)", layout: {}, act: [], expect: [] },
  // 05039:A:3 printed: Shadow: Defending player discards all resources in his heroes' resource pools.
  // records 05039:shadow:1; timing shadow
  { line: "05039:A:3", name: "Shadow: Defending player discards all resources in his heroes'", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 05040 Lost in the City.
  // 05040:A:1 printed: When Revealed: Each player must search the encounter deck and discard pile for 1 City location and add it to the staging area, if able. Shuffle the encounter deck. This effect cannot be canceled.
  // records 05040:whenRevealed:1; timing whenRevealed
  { line: "05040:A:1", name: "When Revealed: Each player must search the encounter deck and discard", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },
  // 05040:A:2 printed: Shadow: Defending player discards his hand.
  // records 05040:shadow:1; timing shadow
  { line: "05040:A:2", name: "Shadow: Defending player discards his hand.", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 05041 Local Trouble.
  // 05041:A:1 printed: When Revealed: Attach this card to the hero with the highest threat cost without a copy of Local Trouble attached. (Counts as a Condition attachment with the text: 'When attached hero exhausts, readies, or triggers an ability, raise its controller's threat by 1.')
  // records 05041:constant:1, 05041:triggered:1, 05041:triggered:2, 05041:triggered:3; timing constant, triggered
  { line: "05041:A:1", name: "When Revealed: Attach this card to the hero with the highest threat", todo: "write the row from the printed line (4 records, timing constant, triggered)", layout: {}, act: [], expect: [] },

  // 05042 Zealous Traitor.
  // 05042:A:1 printed: Forced: When Zealous Traitor engages a player, that player must deal 1 damage to each ally he controls. (2 damage instead if Zealous Traitor was not optionally engaged.)
  // records 05042:forced:1; timing forced
  { line: "05042:A:1", name: "Forced: When Zealous Traitor engages a player, that player must deal 1", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 05043 Lossarnach Bandit.
  // 05043:A:1 printed: Forced: When Lossarnach Bandit engages a player, that player discards 1 resource from each of his heroes' resource pools. (2 resources instead if Lossarnach Bandit was not optionally engaged.)
  // records 05043:forced:1; timing forced
  { line: "05043:A:1", name: "Forced: When Lossarnach Bandit engages a player, that player discards", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 05044 Umbar Assassin.
  // 05044:A:2 printed: Forced: When Umbar Assassin engages a player, that player must deal 3 damage to a hero he controls. (Discard that hero instead if Umbar Assassin was not optionally engaged.)
  // records 05044:forced:1; timing forced
  { line: "05044:A:2", name: "Forced: When Umbar Assassin engages a player, that player must deal 3", todo: "write the row from the printed line (1 record, timing forced)", layout: {}, act: [], expect: [] },

  // 05045 Lurking in Shadows.
  // 05045:A:1 printed: When Revealed: Return all Brigand enemies engaged with players to the staging area. If this effect returned no Brigand enemies to the staging area, Lurking in Shadows gains surge.
  // records 05045:whenRevealed:1; timing whenRevealed
  { line: "05045:A:1", name: "When Revealed: Return all Brigand enemies engaged with players to the", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },
  // 05045:A:2 printed: Shadow: Return attacking enemy to the staging area after it attacks.
  // records 05045:shadow:1; timing shadow
  { line: "05045:A:2", name: "Shadow: Return attacking enemy to the staging area after it attacks.", todo: "write the row from the printed line (1 record, timing shadow)", layout: {}, act: [], expect: [] },

  // 05065 The Leaping Fish.
  // 05065:A:1 printed: Setup: Search the encounter deck for The Leaping Fish and Alcaron's Scroll. Make The Leaping Fish the active location and attach Alcaron's Scroll to a hero.
  // records 05065:setup:1; timing setup
  { line: "05065:A:1", name: "Setup: Search the encounter deck for The Leaping Fish and Alcaron's", todo: "write the row from the printed line (1 record, timing setup)", layout: {}, act: [], expect: [] },
  // 05065:B:1 printed: Battle. (Characters use their Attack instead of Willpower when questing.)
  // records 05065:constant:1; timing constant
  { line: "05065:B:1", name: "Battle. (Characters use their Attack instead of Willpower when", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 05065:B:2 printed: When Revealed: Each player must search the encounter deck for a copy of Harbor Thug and add it to the staging area. Shuffle the encounter deck.
  // records 05065:whenRevealed:1; timing whenRevealed
  { line: "05065:B:2", name: "When Revealed: Each player must search the encounter deck for a copy", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },

  // 05066 Fighting in the Streets.
  // 05066:B:1 printed: Battle. (Characters use their Attack instead of Willpower when questing.)
  // records 05066:constant:1; timing constant
  { line: "05066:B:1", name: "Battle. (Characters use their Attack instead of Willpower when", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 05066:B:2 printed: The players cannot advance to the next stage unless Alcaron's Scroll is attached to a hero.
  // records 05066:constant:2; timing constant
  { line: "05066:B:2", name: "The players cannot advance to the next stage unless Alcaron's Scroll", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 05066:B:3 printed: When Revealed: Attach Alcaron's Scroll to the highest engagement cost enemy in play, if able. Otherwise, add Alcaron's Scroll to the staging area.
  // records 05066:whenRevealed:1; timing whenRevealed
  { line: "05066:B:3", name: "When Revealed: Attach Alcaron's Scroll to the highest engagement cost", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },

  // 05067 Escape to the Quays.
  // 05067:A:1 printed: When Revealed: Each player searches the encounter deck and discard pile for 1 enemy and adds it to the staging area.
  // records 05067:whenRevealed:1; timing whenRevealed
  { line: "05067:A:1", name: "When Revealed: Each player searches the encounter deck and discard", todo: "write the row from the printed line (1 record, timing whenRevealed)", layout: {}, act: [], expect: [] },
  // 05067:B:1 printed: Enemies cannot be optionally engaged.
  // records 05067:constant:1; timing constant
  { line: "05067:B:1", name: "Enemies cannot be optionally engaged.", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
  // 05067:B:3 printed: The players cannot defeat this stage unless Alcaron's Scroll is attached to a hero. If the players defeat this stage, they have won the game.
  // records 05067:constant:2; timing constant
  { line: "05067:B:3", name: "The players cannot defeat this stage unless Alcaron's Scroll is", todo: "write the row from the printed line (1 record, timing constant)", layout: {}, act: [], expect: [] },
];

if (ROWS.length > 0) cardSpecs("peril-in-pelargir", ROWS);
else describe("peril-in-pelargir card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
