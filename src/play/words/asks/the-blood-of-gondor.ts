import type { Ask } from "../asks.ts";

// The choice words of The Blood of Gondor (against-the-shadow part 8), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-blood-of-gondor --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-blood-of-gondor` prints each sentence.
// The count a sentence says is the hidden cards of the player asked (the amount `hidden own`); it is a number and never a card. Faramir's choice of a player is the engine's own Choose (families/pelargir/hidden-turn.ts): words/scenarios/against-the-shadow/blood-choice.ts words it.
const HELD = { kind: "less", left: 0, right: { hidden: "own" } } as const;
const MANY = { kind: "less", left: 1, right: { hidden: "own" } } as const;
export const ASKS: Readonly<Record<string, Ask>> = {
  // 06117:B:2 (The Ambush, stage 1B): at the beginning of the combat phase each player, the first player first, turns each of his hidden cards faceup or takes 1 hidden card; a player with none may choose either.
  "06117:forced:2 @0.0 Choose": {
    owned: true,
    bind: { held: { hidden: "own" } },
    note: "Beginning of combat, The Ambush: turn your hidden cards faceup, or take 1 more. Hidden cards you hold: {held}. Turning engages each enemy among them whatever its engagement cost and discards any other card. Taking adds the top card of the encounter deck, facedown and unseen.",
  },
  "06117:forced:2 @0.0 turn": {
    label: [
      { when: MANY, text: "Turn your {held} hidden cards faceup: each enemy engages you, any other card is discarded" },
      { when: HELD, text: "Turn your hidden card faceup: an enemy engages you, any other card is discarded" },
      { text: "Turn nothing: you hold no hidden card" },
    ],
    bind: { held: { hidden: "own" } },
  },
  "06117:forced:2 @0.0 take": { label: "Take 1 hidden card: the top card of the encounter deck lies facedown in your play area, unseen" },
  // 06120:A:1 (Orc Ambusher, Forced): after it engages you, discard 1 non-objective ally you control, if able.
  "06120:forced:1 @0 Pick": { owned: true, note: "Orc Ambusher engaged you: choose a non-objective ally you control to discard. Faramir and Lord Alcaron are objectives and cannot be chosen.", verb: "Discard" },
  // 06133:A:2 (Lord Alcaron, Action): exhaust him to return an enemy engaged with you to the staging area, an enemy just engaged by a hidden turn too.
  "06133:action:1 @0 Pick": { owned: true, note: "Lord Alcaron: choose an enemy engaged with you to return to the staging area. He exhausts.", verb: "Return" },
};
