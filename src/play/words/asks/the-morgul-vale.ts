import type { Ask } from "../asks.ts";

// The choice words of The Morgul Vale (against-the-shadow part 9), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-morgul-vale --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-morgul-vale` prints each sentence.
// A progress token placed on To the Tower is told with the count it reaches against the 10 that lose the game (06147:A:3): `tokens` is the count now, `after` the count the row would leave, and a row that would reach 10 says it loses the game.
const TOKENS = { stat: "progress", ofNamed: "To the Tower" } as const;
const ONE_MORE = { stat: "progress", ofNamed: "To the Tower", plus: 1 } as const;
const THREE_MORE = { stat: "progress", ofNamed: "To the Tower", plus: 3 } as const;
// One more token reaches 10 (9 are there), and three more do (7 or more are there).
const LOSES_AT_ONE = { kind: "less", left: 8, right: TOKENS } as const;
const LOSES_AT_THREE = { kind: "less", left: 6, right: TOKENS } as const;
const ONE_PLAYER = { kind: "less", left: 1, right: { players: true } } as const;
const SHORT_HAND = { kind: "less", left: { hand: true }, right: 3 } as const;
const NO_HAND = { kind: "less", left: { hand: true }, right: 1 } as const;
export const ASKS: Readonly<Record<string, Ask>> = {
  // 06144:A:1 (The Rearguard, Setup): the piles add To the Tower, Murzag and a Morgul Vale to the staging area; the record only names To the Tower so that its own Forced effect hears it.
  "06144:setup:1 @0 Pick": { bare: true, note: "Setup: To the Tower is added to the staging area, and every Faramir the players own is removed from the game.", verb: "Add" },
  // 06149:A:2 (Morgul Sorcerer, Shadow): the defending player places 1 token on To the Tower, or the attack is treated as undefended; not asked when it already is undefended.
  "06149:shadow:1 @0 Choose": { owned: true, note: "Morgul Sorcerer, shadow effect: place 1 progress token on To the Tower, or treat this attack as undefended. To the Tower holds {tokens} of the 10 that lose the game.", bind: { tokens: TOKENS } },
  "06149:shadow:1 @0 place": {
    label: [
      { when: LOSES_AT_ONE, text: "Place 1 progress token on To the Tower: it holds {tokens} now and {after} after, so the players lose the game" },
      { text: "Place 1 progress token on To the Tower: it holds {tokens} now and {after} after. Each Morgul Sorcerer in play is dealt a shadow card" },
    ],
    bind: { tokens: TOKENS, after: ONE_MORE },
  },
  "06149:shadow:1 @0 undefended": { label: "Treat the attack as undefended: no defender takes the damage, and one hero you choose takes all of it" },
  // 06154:A:1 (Morgul Road, Response): after it leaves play as an explored location the first player chooses one: remove 1 token from To the Tower, or deal 1 damage to an enemy in play.
  "06154:response:1 @0 Choose": { owned: true, note: "Morgul Road was explored: remove 1 progress token from To the Tower, or deal 1 damage to an enemy in play. To the Tower holds {tokens}.", bind: { tokens: TOKENS } },
  "06154:response:1 @0 remove": { label: "Remove 1 progress token from To the Tower: it holds {tokens} now and {after} after", bind: { tokens: TOKENS, after: { stat: "progress", ofNamed: "To the Tower", plus: -1 } } },
  "06154:response:1 @0 damage": { label: "Choose an enemy in play and deal 1 damage to it: a Captain's damage goes to a Morgul Bodyguard in play" },
  "06154:response:1 @0.damage.0 Pick": { owned: true, note: "Morgul Road: choose an enemy in play to take 1 damage. A Captain's damage goes to a Morgul Bodyguard while one is in play.", verb: "Damage" },
  // 06155:A:1 (Morgul Vale, Forced): at the end of the round each player, the first player first, returns 1 enemy engaged with him, of his own choice, to the staging area; a Captain too.
  "06155:forced:1 @0.0 Pick": { owned: true, note: "Morgul Vale, end of the round: choose an enemy engaged with you to return to the staging area. A Captain may be chosen: the staging area is in play, so he does not leave play.", verb: "Return" },
  // 06157:A:1 (Impenetrable Fog, When Revealed, as the erratum reads): the first player places 3 tokens on To the Tower (one placement) or reveals as many more cards as there are players; not both.
  "06157:whenRevealed:1 @0 Choose": { owned: true, note: "Impenetrable Fog: place 3 progress tokens on To the Tower, or reveal as many more encounter cards as there are players. Not both. To the Tower holds {tokens} of the 10 that lose the game.", bind: { tokens: TOKENS } },
  "06157:whenRevealed:1 @0 tokens": {
    label: [
      { when: LOSES_AT_THREE, text: "Place 3 progress tokens on To the Tower: it holds {tokens} now and {after} after, so the players lose the game" },
      { text: "Place 3 progress tokens on To the Tower: it holds {tokens} now and {after} after. Each Morgul Sorcerer in play is dealt one shadow card" },
    ],
    bind: { tokens: TOKENS, after: THREE_MORE },
  },
  "06157:whenRevealed:1 @0 reveal": {
    label: [
      { when: ONE_PLAYER, text: "Reveal {players} more encounter card, in full: an enemy stays in the staging area, and no token is placed" },
      { text: "Reveal {players} more encounter cards one at a time, in full: enemies stay in the staging area, and no token is placed" },
    ],
    bind: { players: { players: true } },
  },
  // 06158:A:2 (Sleepless Malice, When Revealed): each player in turn, the first player first, discards 3 cards at random from his hand or places 1 token on To the Tower.
  "06158:whenRevealed:1 @0.0 Choose": { owned: true, note: "Sleepless Malice: discard 3 cards at random from your hand, or place 1 progress token on To the Tower. Each player chooses in turn. To the Tower holds {tokens} of the 10 that lose the game.", bind: { tokens: TOKENS } },
  "06158:whenRevealed:1 @0.0 discard": {
    label: [
      { when: NO_HAND, text: "Discard nothing: your hand is empty, and no token is placed" },
      { when: SHORT_HAND, text: "Discard all {held} cards of your hand at random: you hold fewer than 3, and no token is placed" },
      { text: "Discard 3 of your {held} cards at random: no token is placed" },
    ],
    bind: { held: { hand: true } },
  },
  "06158:whenRevealed:1 @0.0 token": {
    label: [
      { when: LOSES_AT_ONE, text: "Place 1 progress token on To the Tower: it holds {tokens} now and {after} after, so the players lose the game" },
      { text: "Place 1 progress token on To the Tower: it holds {tokens} now and {after} after, and you discard no card" },
    ],
    bind: { tokens: TOKENS, after: ONE_MORE },
  },
};
