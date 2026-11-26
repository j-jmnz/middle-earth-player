import type { Ask } from "../asks.ts";

// The choice words of The Ruins of Belegost (standalone-scenarios part 6), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-ruins-of-belegost --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-ruins-of-belegost` prints each sentence.
// The Discover and Loot choices (the Loot objective a location attaches, the one of the encounter discard pile) are worded by the Wilderland words of The Ghost of Framsburg (words/scenarios/framsburg.ts), which read the instruction, not the card.
// A Loot objective's Action is used by the player who controls it, and the player it picks is chosen by that player, so these are not owned. A When Revealed or Shadow choice a player makes for himself is owned.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 50608:A:1 (Stalking the Ruins): with 3 or more resources Naurlhûg engaged with a player returns to the staging area.
  "50608:forced:1 @2 Pick": { note: "Stalking the Ruins holds 3 resources: Naurlhûg returns to the staging area.", verb: "Return" },

  // 50610:A:3, 50611:A:3, 50612:A:3, 50613:A:3, 50614:A:3 (the Loot objectives' Actions).
  "50610:action:1 @0 Pick": { note: "Map of Ered Luin: choose a non-unique location. It gets -2 Threat until the end of the phase.", verb: "Weaken" },
  "50611:action:1 @0 Pick": { note: "Keys of Belegost: choose a hero. It gets 1 resource.", verb: "Add" },
  "50612:action:1 @0 Pick": { note: "Book of Aulë's Children: choose a player. That player draws 1 card.", verb: "Choose" },
  "50613:action:1 @0 Pick": { note: "Dwarven Torch: choose a non-unique enemy. It gets -1 Attack and -1 Defense until the end of the phase.", verb: "Weaken" },
  "50614:action:1 @0 Pick": { note: "Blue Mountain Gem: choose a player. That player reduces their threat by 1.", verb: "Choose" },

  // 50615:A:2 and A:3 (Naurlhûg): when it attacks, the defending player assigns X damage, X the resources on Stalking the Ruins.
  "50615:forced:1 @0 AssignDamage": { owned: true, note: "Naurlhûg attacks: assign damage to a character you control, as much as the resources on Stalking the Ruins.", verb: "Assign" },

  // 50625:A:4 (Sunken Treasury): the defending player exhausts a character he controls.
  "50625:shadow:1 @0 Pick": { owned: true, note: "Sunken Treasury: choose a ready character you control to exhaust.", verb: "Exhaust" },

  // 50628:A:1 (Spawn of Thangorodrim): with Naurlhûg in play it attacks the first player.
  "50628:whenRevealed:1 @0 Pick": { note: "Spawn of Thangorodrim: Naurlhûg is in play. It makes an immediate attack against the first player.", verb: "Attack" },

  // 50629:A:1 and A:2 (Concealed Spikes).
  "50629:whenRevealed:1 @0.0 AssignDamage": { owned: true, note: "Concealed Spikes: assign damage to your characters, 1 more than the Discover value of the active location.", verb: "Assign" },
  "50629:shadow:1 @0.damage.0 AssignDamage": { owned: true, note: "Concealed Spikes: assign damage to your characters, 1 for each attachment you control.", verb: "Assign" },
  "50629:shadow:1 @0.discard.0 Pick": { owned: true, note: "Concealed Spikes: choose the attachment you control with the highest cost. It is discarded.", verb: "Discard" },
  "50629:shadow:1 @0 damage": { label: "Assign damage among your characters, 1 for each attachment you control" },
  "50629:shadow:1 @0 discard": { label: "Discard the highest cost attachment you control" },

  // 50630:A:1 and A:2 (Covered Pit).
  "50630:whenRevealed:1 @0.0 Pick": { owned: true, note: "Covered Pit: choose an ally you control to discard.", verb: "Discard" },
  "50630:shadow:1 @0 Pick": { owned: true, note: "Covered Pit: choose a Loot objective you control. It is attached to the attacking enemy as a guarded objective.", verb: "Guard" },

  "50621:forced:1 @0 Discover": { note: "{card}, Discover 5: look at the top 5 cards of the encounter deck. Choose 1 looked-at Loot objective to attach to it as a guarded objective. A looked-at Hazard card is revealed, and the rest are discarded.", verb: "Attach" },
  "50622:forced:1 @0 Discover": { note: "{card}, Discover 2: look at the top 2 cards of the encounter deck, and 1 more for each player. Choose 1 looked-at Loot objective to attach to it as a guarded objective. A looked-at Hazard card is revealed, and the rest are discarded.", verb: "Attach" },
  "50623:forced:1 @0 Discover": { note: "{card}, Discover 4: look at the top 4 cards of the encounter deck. Choose 1 looked-at Loot objective to attach to it as a guarded objective. 1 more Hazard card is revealed for each other player, and the rest are discarded.", verb: "Attach" },
  "50624:forced:1 @0 Discover": { note: "{card}, Discover 2: look at the top 2 cards of the encounter deck. Choose 1 looked-at Loot objective to attach to it as a guarded objective. A looked-at Hazard card is revealed, and the rest are discarded.", verb: "Attach" },
  "50625:forced:1 @0 Discover": { note: "{card}, Discover 3: look at the top 3 cards of the encounter deck. Choose 1 looked-at Loot objective to attach to it as a guarded objective. A looked-at Hazard card is revealed, and the rest are discarded.", verb: "Attach" },
  "50626:forced:1 @0 Discover": { note: "{card}, Discover 3: look at the top 3 cards of the encounter deck. Choose 1 looked-at Loot objective to attach to it as a guarded objective. A looked-at Hazard card is revealed, and the rest are discarded.", verb: "Attach" },
};
