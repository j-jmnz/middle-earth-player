import type { Condition, PickSpec } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";
import { POOL_BOON_ASKS } from "../pool-boon-asks.ts";

// The choice words of The Weather Hills (angmar-awakened part 2), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-weather-hills --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-weather-hills` prints each sentence.
// A choice of one player's own (damage he assigns to a character he controls, a hero that takes damage, the shadow's defender) is owned: two-handed the sentence leads with the player. The first player answers for the group (the Mission objective, the
// characters committed to the quest, the Orc enemy Concealed Orc-camp puts into play, Cornered Animals' choice, Angmar Orc's options), so those sentences are not owned and the sheet adds who chooses. Orc Ambush and Angmar Orc are worded as Intruders in Chetwood
// words them (a game reads only its own scenario's file). The boon Mysterious Omens offers is a choice of boon codes (ChooseBoon), then a hero.
const COMMITTED: PickSpec = { type: "character", control: "any", committed: true };
// Savage Counter-attack holds one token: removing it leaves none and the players lose (09072:A:3).
const LAST_TOKEN: Condition = { kind: "not", condition: { kind: "tokens", code: "09072", min: 2 } };
const SAVAGE_TOKENS = { stat: "resources", ofNamed: "Savage Counter-attack" } as const;

export const ASKS: Readonly<Record<string, Ask>> = {
  // 09028:A:1 (Forced, end of the refresh phase while Exposed Ridge is the active location): each player deals 1 damage to a character he controls.
  "09028:forced:1 @0.0 Pick": { owned: true, note: "Exposed Ridge: choose a character you control to take 1 damage.", verb: "Assign" },

  // 09029:A:1 (Response when it is explored): a character is healed of all its damage; A:2 (Travel): remove a token from the Mission objective, whichever card holds one.
  "09029:response:1 @0 Pick": { note: "Sheltered Valley: choose a damaged character in play, any player's, to heal of all its damage.", verb: "Heal" },
  "09029:travel:1 @0 Pick": { note: "Sheltered Valley: to travel here, remove 1 resource token from the Mission objective. Choose it.", verb: "Remove" },

  // 09030:A:1 (Response when it is explored): a token goes on the Mission objective; A:2 (Travel): the first player puts an Orc enemy into play engaged with him.
  "09030:response:1 @0 Pick": { note: "Concealed Orc-camp: choose the Mission objective to place 1 resource token on.", verb: "Place" },
  "09030:travel:1 @0 SearchMove": { note: "Concealed Orc-camp: search the encounter deck and discard pile for an Orc enemy. Put it into play engaged with the first player.", verb: "Engage" },

  // 09031 Ice Storm: each player assigns X damage (X the quest cards in play) among the characters he controls, one at a time; every damaged character is then exhausted.
  "09031:whenRevealed:1 @0 AssignDamage": { owned: true, note: "Ice Storm: assign {x} damage among the characters you control, 1 at a time ({x}, the quest cards in play; {left} left). Every damaged character is then exhausted.", bind: { x: { questCards: true } }, verb: "Assign" },
  "09031:shadow:1 @0 AssignDamage": { owned: true, note: "Ice Storm's shadow: assign {x} damage among the characters you control, 1 at a time ({x}, the quest cards in play; {left} left).", bind: { x: { questCards: true } }, verb: "Assign" },

  // 09032:A:2 (Forced after the last time counter): each player deals 4 damage to one hero he controls.
  "09032:forced:1 @0.0 Pick": { owned: true, note: "Find Shelter: choose a hero you control to take all 4 damage.", verb: "Assign" },

  // 09043:A:1 (When Revealed): the first player chooses for the group; 09046:A:2: each player in turn searches for an Orc enemy.
  "09043:whenRevealed:1 @0 Choose": { note: "Angmar Orc: the first player either discards an ally from play, or reveals an additional encounter card." },
  "09043:whenRevealed:1 @0 ally": { label: "Discard an ally from play" },
  "09043:whenRevealed:1 @0 reveal": { label: "Reveal an additional encounter card" },
  "09043:whenRevealed:1 @0.ally.0 Pick": { note: "Angmar Orc: choose an ally in play to discard.", verb: "Discard" },
  "09046:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Orc Ambush: search the encounter deck and discard pile for an Orc enemy. Put it into play engaged with you.", verb: "Engage" },

  // 09052:A:1 (When Revealed): the first player assigns X damage among the committed characters, any player's, X the number committed.
  "09052:whenRevealed:1 @0 AssignDamage": { note: "Biting Wind: assign {x} damage among the characters committed to the quest, 1 at a time (one for each character committed; {left} left).", bind: { x: { count: COMMITTED } }, verb: "Assign" },

  // 09054:A:1 (When Revealed): each player deals 1 damage to a hero he controls.
  "09054:whenRevealed:1 @0.0 Pick": { owned: true, note: "Cold from Angmar: choose a hero you control to take 1 damage. Cold from Angmar then blanks the text of each damaged character while it is attached to the quest.", verb: "Assign" },

  // 09055:A:3 (Response after it is defeated): each player heals up to 3 damage from a hero he controls.
  "09055:response:1 @0.0 Pick": { owned: true, note: "Make Camp: choose a damaged hero you control to heal up to 3 damage.", verb: "Heal" },

  // 09058:A:2 (Shadow): the defending player chooses.
  "09058:shadow:1 @0 Choose": { owned: true, note: "Tragic Discovery's shadow: you either raise your threat by 3, or this attack is considered undefended." },
  "09058:shadow:1 @0 threat": { label: "Raise your threat by 3" },
  "09058:shadow:1 @0 undefended": { label: "This attack is considered undefended" },

  // 09070:B:2 (Forced, beginning of the quest phase): the first player chooses for the group; an option that changes nothing is not offered, so with no token the reveal is the only one.
  "09070:forced:1 @0 Choose": { note: "Cornered Animals: remove 1 resource token from Savage Counter-attack ({tokens} on it; the players lose at 0), or reveal an additional encounter card this phase.", bind: { tokens: SAVAGE_TOKENS } },
  "09070:forced:1 @0 discard": { label: "Remove 1 resource token from Savage Counter-attack", caution: { when: LAST_TOKEN, text: "Tap again: removing its last token loses the game" } },
  "09070:forced:1 @0 reveal": { label: "Reveal an additional encounter card this phase" },

  // 10160:A:3 (Forced after Mysterious Omens is defeated): each player in turn, the first player first, may take one boon not yet taken, then picks the hero that carries it.
  "10160:forced:2 @1 ChooseBoon": { owned: true, note: "Mysterious Omens: choose one of the boons not yet taken to attach to a hero you control, or take none. A boon stays with its hero through the campaign.", verb: "Take", labels: { none: "Take no boon" } },

  // Ruthless (10164:A:4), worded once for every scenario that can deal it.
  ...POOL_BOON_ASKS,
};
