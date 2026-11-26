import type { Ask } from "../asks.ts";

// The choice words of The Mûmakil (haradrim part 4), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-mumakil --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-mumakil` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 16059:A:2 (Overgrown, dealt here from the encounter deck): the first player chooses among the tied highest-Threat locations in the staging area that carry no Overgrown.
  "16059:whenRevealed:1 @0 Pick": { owned: true, note: "Overgrown: choose, among the tied highest-Threat locations in the staging area with no Overgrown, the one Overgrown attaches to. It gives that location +1 Threat.", verb: "Attach" },
  // 17015:A:3 (Wild Mûmak, Forced): at the end of the round the player it is engaged with chooses; with more than one Mûmak engaged, each is asked in turn.
  "17015:forced:1 @0.0 Choose": { owned: true, note: "{card} is engaged with you. At the end of the round, return it to the staging area, or it makes an immediate attack against you." },
  "17015:forced:1 @0.0 staging": { label: "Return it to the staging area" },
  "17015:forced:1 @0.0 attack": { label: "It attacks you now (new shadow card) and stays engaged" },
  // 17027:A:1 (Capture the Mûmakil, When Revealed): each player in turn, the first player first, attaches the next random set-aside Capture to a Wild Mûmak in play, in the staging area or engaged. Two Captures may lie on one Mûmak.
  "17027:whenRevealed:1 @0.0 Pick": { owned: true, note: "Choose a Wild Mûmak in play, in the staging area or engaged with any player, to carry the next random set-aside Capture. A Mûmak may carry two Captures.", verb: "Attach" },
  // 17021:A:2 (Stampeding, When Revealed): the first player chooses a Wild Mûmak in the staging area; it attacks the first player and stays in the staging area. With no attack made, Mûmak Trail is searched for.
  "17021:whenRevealed:1 @0 Pick": { owned: true, note: "Stampeding: choose a Wild Mûmak in the staging area to make an immediate attack against you, the first player. It stays in the staging area.", verb: "Attack" },
  // 17024:A:1, 17024:A:2 (Biting Insects): the card discarded at random from the hand sets X, its cost; the damage is assigned among characters the player controls.
  // The title leads with the damage left; the note names the discarded card and its cost, apart from the damage left.
  "17024:whenRevealed:1 @0.1 AssignDamage": { owned: true, note: "You discarded {picked} at random (cost {cost}). {left} of {cost} damage left to assign among characters you control.", bind: { cost: { stat: "cost", of: "picked", printed: true } }, verb: "Assign", title: "Assign {left}: {card}" },
  "17024:shadow:1 @1 AssignDamage": { owned: true, note: "You discarded {picked} at random (cost {cost}). {left} of {cost} damage left to assign among characters you control.", bind: { cost: { stat: "cost", of: "picked", printed: true } }, verb: "Assign", title: "Assign {left}: {card} (shadow)" },
  // 17026:A:1 (Welcome to the Jungle, Setup): each player in turn, the first player first, takes a location from the encounter deck whose title no earlier player took.
  "17026:setup:1 @0.0 SearchMove": { owned: true, note: "Setup: choose a location from the encounter deck to add to the staging area. Its title must differ from each location the players before you took. It is not revealed.", verb: "Add" },
};
