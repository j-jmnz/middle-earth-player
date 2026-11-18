import type { Ask } from "../asks.ts";

// The choice words of Fog on the Barrow-downs (standalone-scenarios part 5), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario fog-on-the-barrow-downs --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=fog-on-the-barrow-downs` prints each sentence.
// Each player answers for himself, so the sentences are owned. The choices that cannot be taken back say what they do: the allies discarded, the progress placed, the Great Barrow sent to the victory display.
const ENGAGED_WITH_YOU = { count: { type: "enemy", control: "any", engaged: "you" } } as const;

export const ASKS: Readonly<Record<string, Ask>> = {
  // 148004:A:1 (Trapped Inside a Barrow, stage 4A): the player keeps as many allies as enemies are engaged with him, one at a time; the rest are discarded when the last one is kept.
  "148004:whenRevealed:1 @3 Each": {
    owned: true,
    note: "Choose the allies you keep, one at a time: you keep {x} (the enemies engaged with you). Each other ally you control is discarded.",
    bind: { x: ENGAGED_WITH_YOU },
    verb: "Keep",
  },

  // 148004:B:2 (stage 4B defeated): he returns to stage 3B at the beginning of the travel phase and 1 progress goes on a Great Barrow there; a Great Barrow holds 1 quest point.
  "148004:forced:2 @0.1 Pick": {
    owned: true,
    note: "Choose the Great Barrow at stage 3B that gets 1 progress. It has 1 quest point, so it is explored and goes to the victory display.",
    verb: "Place",
  },

  // 148004:B:2 (the designer's ruling, Semi-official FAQ 3.181): stage 4B left play because its player was eliminated, so 1 Great Barrow in play goes to the victory display.
  "148004:forced:3 @0 Pick": {
    owned: true,
    note: "Trapped Inside a Barrow left play with its eliminated player. Choose a Great Barrow in any staging area to add to the victory display.",
    verb: "Add",
  },

  // 148008:A:2 (Ancient Barrow): each player places an ally he controls facedown under it, which adds 1 to its Threat and returns to his hand when it is explored.
  "148008:forced:1 @0.0 Pick": {
    owned: true,
    note: "Ancient Barrow: choose an ally you control to place facedown under it. It adds 1 to its Threat and returns to your hand when the location is explored.",
    verb: "Place",
  },

  // 148018:A:2 (Dreadful Song): attached to a questing hero the revealer controls with no Dreadful Song; the hero's Willpower is 0 and the player raises his threat at the end of the round.
  "148018:whenRevealed:1 @0 Pick": {
    owned: true,
    note: "Dreadful Song: choose a questing hero you control without one. Its Willpower is reduced to 0, and you raise your threat at the end of the round for each Wight engaged with you.",
    verb: "Attach",
  },

  // 148019:A:1 (Tom Bombadil): the first player chooses a player, who takes control of Tom Bombadil, ready and committed to the quest, until the end of the round.
  "148019:whenRevealed:1 @0 Pick": { owned: true, note: "Tom Bombadil: choose the player who takes control of him, ready and committed to the quest. He is discarded at the end of the round.", verb: "Give" },
};
