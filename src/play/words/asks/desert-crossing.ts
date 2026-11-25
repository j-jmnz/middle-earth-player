import type { Condition } from "../../../catalog/boundary.ts";
import { HEAT_LIMIT } from "../scenarios/haradrim/heat-table.ts";
import type { Ask } from "../asks.ts";

// The choice words of Desert Crossing (haradrim part 2), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario desert-crossing --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=desert-crossing` prints each sentence.
// X is the tens digit of the temperature wherever a card says it (16026, 16029, 16069): the bind reads it from the heat tracker.
const TENS = { temperature: "tens" } as const;

// The temperature is 2 short of the limit or more: a rise by 2 loses the game.
const REACHES_LIMIT: Condition = { kind: "temperature", min: HEAT_LIMIT - 2 };

export const ASKS: Readonly<Record<string, Ask>> = {
  // 16068:B:1 (The Desert of Harad, stage 1B): the ally's controller exhausts it or deals it 1 damage.
  "16068:forced:1 @0 exhaust": { label: "Exhaust {subject}" },
  "16068:forced:1 @0 damage": { label: "Deal 1 damage to {subject}" },

  // 16069:B:1 (Under the Merciless Sun): after the temperature rises by 4, each player assigns X damage among characters he controls.
  "16069:forced:1 @1 AssignDamage": { owned: true, note: "Under the Merciless Sun: assign {x} damage, the tens digit of the temperature, among the characters you control ({left} left).", bind: { x: TENS }, verb: "Assign", title: "{card}: assign {left}" },

  // 16070:A:1 (Beasts of Legend): each player in turn adds a Were-worm from the encounter deck, discard pile or victory display to the staging area.
  "16070:whenRevealed:1 @1.0 SearchMove": { owned: true, note: "Beasts of Legend: choose a Were-worm in the encounter deck, discard pile or victory display to add to the staging area.", verb: "Add" },

  // 16024 (Carrion Bird): when it engages you, you discard a damaged character you control.
  "16024:forced:1 @0 Pick": { owned: true, note: "Carrion Bird: choose a damaged character you control to discard.", verb: "Discard" },

  // 16026 (Scorched Hamada): X damage among characters in play, any player's.
  "16026:forced:1 @0 AssignDamage": { note: "Scorched Hamada: assign {x} damage, the tens digit of the temperature, among the characters in play ({left} left).", bind: { x: TENS }, verb: "Assign", title: "{card}: assign {left}" },

  // 16029 (Unbearable Heat): each player assigns X damage among characters he controls.
  "16029:whenRevealed:1 @0 AssignDamage": { owned: true, note: "Unbearable Heat: assign {x} damage, the tens digit of the temperature, among the characters you control ({left} left).", bind: { x: TENS }, verb: "Assign", title: "{card}: assign {left}" },

  // 16030 (Scorching Sun) Shadow: the defending player raises the temperature by 2, or the attacking enemy returns to the staging area after this attack.
  // The row says where the temperature ends when it reaches the limit, and its tap is two taps (docs/design-system-table.md, Two taps): +2 reaches 60 from 58.
  "16030:shadow:1 @0 temperature": {
    label: [{ when: REACHES_LIMIT, text: `Raise the temperature by 2, to ${HEAT_LIMIT}` }, { text: "Raise the temperature by 2" }],
    caution: { when: REACHES_LIMIT, text: `Tap again: the temperature reaches ${HEAT_LIMIT} and the game is lost` },
  },
  "16030:shadow:1 @0 return": { label: "Attacker returns to staging after attack" },

  // 16048 (Find Water): when it is defeated each player readies a hero he controls.
  "16048:response:1 @0.0 Pick": { owned: true, note: "Find Water: choose an exhausted hero you control to ready.", verb: "Ready" },

  // 16050 (Desert Oasis): after it becomes the active location each player exhausts a character he controls.
  "16050:forced:1 @0.0 Pick": { owned: true, note: "Desert Oasis: choose a ready character you control to exhaust.", verb: "Exhaust" },

  // 16051 (Sandstorm): discard your hand, or assign X damage where X is the cards in your hand; Shadow: discard your highest cost attachment, or assign X damage where X is your attachments.
  "16051:whenRevealed:1 @0.0 discard": { label: "Discard your hand" },
  "16051:whenRevealed:1 @0.0 damage": { label: "Assign {x} damage (1 per card in hand)", bind: { x: { hand: true } } },
  "16051:whenRevealed:1 @0.0.damage.0 AssignDamage": { owned: true, note: "Sandstorm: assign {x} damage, 1 for each card in your hand, among the characters you control ({left} left).", bind: { x: { hand: true } }, verb: "Assign", title: "{card}: assign {left}" },
  "16051:shadow:1 @0 discard": { label: "Discard your highest cost attachment" },
  "16051:shadow:1 @0 damage": { label: "Assign {x} damage (1 per attachment)", bind: { x: { count: { type: "attachment", control: "you" } } } },
  "16051:shadow:1 @0.discard.0 Pick": { owned: true, note: "Sandstorm, Shadow: choose one of your highest cost attachments to discard.", verb: "Discard" },
  "16051:shadow:1 @0.damage.0 AssignDamage": { owned: true, note: "Sandstorm, Shadow: assign {x} damage, 1 for each attachment you control, among the characters you control ({left} left).", bind: { x: { count: { type: "attachment", control: "you" } } }, verb: "Assign", title: "{card}: assign {left}" },

  // 16052 (Heat Exhaustion): each player exhausts a ready character he controls and deals 1 damage to it; Shadow: exhaust a character you control.
  "16052:whenRevealed:1 @0.0 Pick": { owned: true, note: "Heat Exhaustion: choose a ready character you control to exhaust. It takes 1 damage.", verb: "Exhaust" },
  "16052:shadow:1 @0 Pick": { owned: true, note: "Heat Exhaustion, Shadow: choose a ready character you control to exhaust.", verb: "Exhaust" },
};
