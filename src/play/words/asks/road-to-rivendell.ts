import type { Ask } from "../asks.ts";

// The choice words of Road to Rivendell (dwarrowdelf part 5), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario road-to-rivendell --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=road-to-rivendell` prints each sentence.
// The first player answers for the group at Ruined Road, Followed by Night, Orc Ambush and Arwen's Response, so those sentences are not owned (the sheet adds who chooses); the engaged player's own characters and attachments are owned at Goblin Taskmaster, Orc Raiders
// and Goblin Trapper. Orc Ambush asks once for each Orc in the staging area (the number is how many Orcs engage, the first player picking the order); Arwen is the one card Uruk Elf-stalker's pick can find, so the Nightmare sentence names her.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 04039:B:1 (When Revealed): Goblin Gate joins the staging area from the encounter deck or discard pile, not revealed, then becomes the active location when there is none.
  "04039:whenRevealed:1 @0 SearchMove": { note: "{card}: search the encounter deck and discard pile for Goblin Gate. It joins the staging area, not revealed, and the deck is not shuffled.", verb: "Add" },
  "04039:whenRevealed:1 @1 Pick": { note: "{card}: Goblin Gate is in the staging area and no location is active. It becomes the active location. The players do not travel there.", verb: "Make active" },

  // 04041:A:2 (Response when Arwen exhausts): her controller chooses a hero, any player's, to get 1 resource. The pick spans seats, so each row names its owner.
  "04041:response:1 @0 Pick": { note: "{card} exhausted: choose a hero, any player's, to add 1 resource to.", verb: "Add" },

  // 04042:A:1 (Response after the players travel to it): the first player chooses 2 progress on Ruined Road or readying a hero he controls.
  "04042:response:1 @0 Choose": { note: "{card}: the players traveled here. Choose 1. Place 2 progress on it, or ready 1 hero the first player controls." },
  "04042:response:1 @0 progress": { label: "Place 2 progress on Ruined Road" },
  "04042:response:1 @0 ready": { label: "Ready 1 hero the first player controls" },
  "04042:response:1 @0.ready.0 Pick": { note: "{card}: choose 1 hero the first player controls to ready.", verb: "Ready" },

  // 04047:A:1 (When Revealed): the first player chooses 1 damage to each ally in play and surge, or an immediate attack by each engaged enemy.
  "04047:whenRevealed:1 @0 Choose": { note: "{card}: choose 1. Deal 1 damage to each ally in play, Arwen included, and reveal 1 more card. Or each enemy engaged with a player makes an immediate attack." },
  "04047:whenRevealed:1 @0 damage": { label: "Deal 1 damage to each ally in play, then reveal 1 more card" },
  "04047:whenRevealed:1 @0 attack": { label: "Each engaged enemy makes an immediate attack, each dealt its own shadow card" },

  // 04048:A:2 (When Revealed): each Orc in the staging area engages the first player, in the order he chooses, whatever its engagement cost.
  "04048:whenRevealed:1 @2.0 Pick": { note: "{card}: choose the next Orc enemy in the staging area to engage the first player, whatever its engagement cost. The first player picks the order.", verb: "Engage" },

  // 04049:A:2 (Forced after it engages a player): that player deals 2 damage to a character he controls, a hero or an ally, even one the damage destroys.
  "04049:forced:1 @0 Pick": { owned: true, note: "{card}: choose 1 character you control to take 2 damage. A hero or an ally, even one the damage destroys.", verb: "Assign" },

  // 04050:A:2 (Forced after it engages a player): that player discards 2 attachments he controls, on any card, one at a time.
  "04050:forced:1 @0.0 Pick": { owned: true, note: "{card}: choose 1 of the 2 attachments you control to discard, on any card. Then choose the second.", verb: "Discard" },

  // 901402:A:1 (When Revealed, Nightmare): Goblin Gate is searched out of the encounter deck, its discard pile or the victory display into the staging area, not revealed.
  "901402:whenRevealed:1 @0 SearchMove": { note: "{card}: search the encounter deck, its discard pile and the victory display for Goblin Gate. It joins the staging area, not revealed.", verb: "Add" },
  // 901402:B:1 (When Revealed): Goblin Gate, wherever it is in play, guards Arwen: no player controls her until it leaves play.
  "901402:whenRevealed:2 @0 Pick": { note: "{card}: choose Goblin Gate, wherever it is in play. It guards Arwen: she stays in play and no player controls her until it leaves play.", verb: "Guard" },

  // 901403:A:2 (Forced when it attacks and destroys a character, Nightmare): Arwen takes 1 damage, whoever controls or guards her.
  "901403:forced:1 @0 Pick": { note: "{card} destroyed a character: Arwen takes 1 damage, whoever controls or guards her. Choose Arwen.", verb: "Assign" },

  // 901404:A:2 (Forced after it engages a player, Nightmare): that player exhausts a ready character he controls.
  "901404:forced:1 @0 Pick": { owned: true, note: "{card}: choose 1 ready character you control to exhaust.", verb: "Exhaust" },
};
