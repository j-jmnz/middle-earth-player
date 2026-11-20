import type { Ask } from "../asks.ts";

// The choice words of The Hunt for the Dreadnaught (standalone-scenarios part 14), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-hunt-for-the-dreadnaught --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-hunt-for-the-dreadnaught` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 40001:B:2 and 40002:B:1 (the mode cards' Quest Action, once each game for every group).
  "40001:action:1 @0 Pick": { owned: true, note: "Quest Action: choose a non-unique enemy engaged with a player in any group. It takes 10 damage.", verb: "Assign" },
  "40002:action:1 @0 Pick": { owned: true, note: "Quest Action: choose a non-unique enemy engaged with a player in any group. It takes 10 damage, then the top card of the encounter deck is revealed.", verb: "Assign" },

  // The ships' Setup lines and Responses, each answered by the player who controls the ship.
  "40006:setup:1 @0 Pick": { owned: true, note: "Eithiliant: choose a hero you control. It gains the printed Traits of another hero you control until the end of the game.", verb: "Choose" },
  "40006:setup:1 @1 Pick": { owned: true, note: "Eithiliant: choose the other hero you control. The hero you chose first gains its printed Traits until the end of the game.", verb: "Choose" },
  "40006:response:1 @1 Pick": { owned: true, note: "Eithiliant: choose a location in any group. It gets 6 progress.", verb: "Place" },
  "40007:setup:1 @1 Pick": { owned: true, note: "Golden Wing: choose a hero you control. It gains ranged until the end of the game.", verb: "Boost" },
  "40007:response:1 @0 Pick": { owned: true, note: "Golden Wing: choose an enemy in any group. It takes 6 damage.", verb: "Assign" },
  "40008:response:1 @0 Pick": { owned: true, note: "Pride of Lebennin: choose a character to heal 2 damage from.", verb: "Heal" },
  "40009:action:1 @0 PlayFromHand": { owned: true, note: "Silent Mist: choose an event with a cost of 3 or more to play from your hand. Its cost is 1 lower.", verb: "Play" },
  "40009:action:2 @0 PlayFromHand": { owned: true, note: "Silent Mist: choose an event with a cost of 3 or more to play from your hand. Its cost is 2 lower.", verb: "Play" },
  "40010:action:1 @0 SpendResources": { owned: true, note: "Swan Ship of Dol Amroth: choose whose pool pays each of 2 resources.", verb: "Pay" },
  "40010:action:1 @1 Pick": { owned: true, note: "Swan Ship of Dol Amroth: choose an exhausted character to ready.", verb: "Ready" },
  "40010:action:2 @0 SpendResources": { owned: true, note: "Swan Ship of Dol Amroth: choose whose pool pays 1 resource.", verb: "Pay" },
  "40010:action:2 @1 Pick": { owned: true, note: "Swan Ship of Dol Amroth: choose an exhausted card to ready.", verb: "Ready" },
  "40010:response:1 @0 Pick": { owned: true, note: "Swan Ship of Dol Amroth: choose a hero in any group. It gets 2 resources.", verb: "Add" },
  "40010:response:1 @2 Pick": { owned: true, note: "Swan Ship of Dol Amroth: choose an exhausted card to ready.", verb: "Ready" },
  "40011:action:1 @0.ally.0 PlayFromHand": { owned: true, note: "Twilight's Call: choose an ally to play from your hand.", verb: "Play" },
  "40011:action:1 @0.attachment.0 PlayFromHand": { owned: true, note: "Twilight's Call: choose an attachment to play from your hand.", verb: "Play" },
  "40011:action:2 @0.ally.0 PlayFromHand": { owned: true, note: "Twilight's Call: choose an ally to play from your hand.", verb: "Play" },
  "40011:action:2 @0.attachment.0 PlayFromHand": { owned: true, note: "Twilight's Call: choose an attachment to play from your hand.", verb: "Play" },
  "40011:action:1 @0 ally": { label: "Play an ally from your hand" },
  "40011:action:1 @0 attachment": { label: "Play an attachment from your hand" },
  "40011:action:2 @0 ally": { label: "Play an ally from your hand" },
  "40011:action:2 @0 attachment": { label: "Play an attachment from your hand" },

  // 40012:A:2 (Gondorian Warship): the first player chooses the player who controls it.
  "40012:whenRevealed:1 @0 Pick": { note: "Gondorian Warship: the first player chooses the player who gains control of it.", verb: "Choose" },

  // 40015:A:3 (Commander of the Dreadnaught).
  "40015:forced:1 @0 Pick": { note: "Commander of the Dreadnaught attacked you: the Dreadnaught attacks you.", verb: "Attack" },

  // 40021:A:2, 40022:A:2, 40023:A:2 (the Pillage Corsairs): one Forced effect for each event card their Pillage discarded.
  "40021:forced:1 @0 Pick": { owned: true, note: "{card}: an event card was discarded by Pillage. Choose an attachment you control to discard.", verb: "Discard" },
  "40022:forced:1 @0 Pick": { owned: true, note: "{card}: an event card was discarded by Pillage. Choose a character you control. It takes 1 damage.", verb: "Assign" },
  "40023:forced:1 @0 Pick": { owned: true, note: "{card}: an event card was discarded by Pillage. Choose a hero you control. It loses 1 resource.", verb: "Discard" },

  // 40034:A:1 (Belfalas Shipyard): the group pays 5 resources, then a Ship objective is healed of 5 damage, readied and flipped.
  "40034:response:1 @0 SpendResources": { note: "Belfalas Shipyard: the group pays 5 resources. Choose whose pool pays the next 1.", verb: "Pay" },
  "40034:response:1 @1 Pick": { note: "Belfalas Shipyard: choose a Ship objective. It is healed of 5 damage, readied and flipped to its Upgraded side.", verb: "Heal" },

  // 40036:A:3 (Isle of Fortune): its resources go to the pool of a hero the first player chooses.
  "40036:response:1 @0 Pick": { note: "Isle of Fortune: its resources are moved.", verb: "Move" },
  "40036:response:1 @1 Pick": { note: "Isle of Fortune: the first player chooses a hero in any group. It gets the resources on Isle of Fortune.", verb: "Add" },

  // 40042:A:1 and 40045:A:1 (Grappled!, Taking on Water): the Action exhausts 3 characters.
  "40042:action:1 @0.0 Pick": { owned: true, note: "Grappled!: choose a ready character you control to exhaust (3 in all) and discard it.", verb: "Exhaust" },
  "40045:action:1 @0.0 Pick": { owned: true, note: "Taking on Water: choose a ready character you control to exhaust (3 in all) and discard it.", verb: "Exhaust" },

  // 40043:A:1 (Out of the Mist).
  "40043:whenRevealed:1 @0 Pick": { note: "Out of the Mist: choose the enemy in the staging area with the highest engagement cost. It engages the first player and attacks them.", verb: "Engage" },
};
