import type { Ask } from "../asks.ts";

// The choice words of The Hunt for Gollum (shadows-of-mirkwood part 1), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-hunt-for-gollum --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-hunt-for-gollum` prints each sentence.
// The first player answers for the group at The Hunt Begins, False Lead and the Nightmare cards, so those sentences are not owned (the sheet adds who chooses); the defending player's own choice at The Enemy's Trail as a shadow card is owned,
// and so is each player's own choice at Dark Pools. A Clue is one of the four Signs of Gollum (a Clue card in play lies in the staging area, guarded or not, or on a hero or a Mordor enemy).
export const ASKS: Readonly<Record<string, Ask>> = {
  // 02014:A:2 (Response): the players claim Signs of Gollum and attach it to a hero committed to the quest, chosen by the first player.
  "02014:response:1 @0 Pick": { note: "Claim {card}: choose 1 hero committed to the quest to carry it. {card} is attached to that hero.", verb: "Claim" },

  // 02022:A:1 (When Revealed): the first player shuffles 1 Clue card in play into the encounter deck.
  "02022:whenRevealed:1 @1 Pick": { note: "{card}: choose 1 Clue card in play to shuffle into the encounter deck. Its guards stay in the staging area.", verb: "Shuffle" },

  // 900401:A:2 (Forced at the end of the refresh phase): the first player picks 1 Clue that no hero holds and no Mordor enemy guards, then 1 Mordor enemy in play, which guards it.
  "900401:forced:1 @0 Pick": { note: "{card}: choose 1 Clue card that no hero holds and no Mordor enemy guards. A Mordor enemy guards it next.", verb: "Choose" },
  "900401:forced:1 @1 Pick": { note: "{card}: choose 1 Mordor enemy in play to guard that Clue card. Its old guards stay in the staging area.", verb: "Guard" },

  // 900406:A:2 (Forced after it becomes the active location): each player discards the ally with the highest printed cost among those he controls, his choice among a tie.
  "900406:forced:1 @0.0 Pick": { owned: true, note: "{card}: choose 1 of your allies with the highest printed cost to discard.", verb: "Discard" },

  // 900407:A:1 and A:2: a Clue card of the encounter discard pile is attached to a Mordor enemy in play, the first player's choice as a When Revealed effect and the defending player's as a shadow card.
  "900407:whenRevealed:1 @0 Pick": { note: "{card}: choose 1 Mordor enemy in play to guard a Clue card from the encounter discard pile.", verb: "Choose" },
  "900407:whenRevealed:1 @1 SearchMove": { note: "{card}: choose 1 Clue card from the encounter discard pile. The Mordor enemy guards it.", verb: "Attach" },
  "900407:shadow:1 @0 Pick": { owned: true, note: "{card}: choose 1 Mordor enemy in play to guard a Clue card from the encounter discard pile.", verb: "Choose" },
  "900407:shadow:1 @1 SearchMove": { owned: true, note: "{card}: choose 1 Clue card from the encounter discard pile. The Mordor enemy guards it.", verb: "Attach" },

  // 900408:A:2 (When Revealed): the first player takes a Clue off a hero and a Mordor enemy in play guards it.
  "900408:whenRevealed:1 @0 Pick": { note: "{card}: choose 1 Mordor enemy in play to guard a Clue card taken from a hero.", verb: "Choose" },
  "900408:whenRevealed:1 @1 Pick": { note: "{card}: choose 1 Clue card attached to a hero to take from it. The Mordor enemy guards it.", verb: "Take" },

  // 900409:A:1 (When Revealed): attached to the active location, which loses all its progress.
  "900409:whenRevealed:1 @0 Pick": { note: "{card}: attach it to the active location, which loses all its progress.", verb: "Attach" },
};
