import type { Ask } from "../asks.ts";

// The choice words of We Must Away, Ere Break of Day (the-hobbit part 1), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario we-must-away-ere-break-of-day --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=we-must-away-ere-break-of-day` prints each sentence.
// The first player makes every choice below that is not a player's own: the target of a Sack card and of the Key and the Purse, and the Troll Hungry Troll engages. Not owned, so the sentence names no player (hob.sack-x: "the first player must choose").
const SACK_TIE = (value: string): Ask => ({ note: `{card}: choose the character it attaches to. They tie for the ${value}.`, verb: "Attach" });

export const ASKS: Readonly<Record<string, Ask>> = {
  // 131042:A:1 and 131043:A:1: a Troll Purse or Troll Key in the staging area with no host attaches to a Troll enemy.
  "131042:forced:2 @0 Pick": { note: "Troll Purse: choose a Troll enemy to attach it to.", verb: "Attach" },
  "131042:forced:3 @0 Pick": { note: "Troll Purse: choose a Troll enemy to attach it to.", verb: "Attach" },
  "131043:forced:2 @0 Pick": { note: "Troll Key: choose a Troll enemy to attach it to.", verb: "Attach" },
  "131043:forced:3 @0 Pick": { note: "Troll Key: choose a Troll enemy to attach it to.", verb: "Attach" },

  // 131054:A:1 (Hungry Troll): the first player chooses a Troll enemy in the staging area and engages it.
  "131054:whenRevealed:1 @0 Pick": { note: "Hungry Troll: choose a Troll enemy in the staging area. It engages the first player.", verb: "Engage" },

  // 131036:A:2 (Troll Camp): Bilbo Baggins removes a Sack card from a character; it returns to the Sack deck.
  "131036:action:1 @0 Pick": { note: "Troll Camp: choose a Sack card to remove from its character. It goes back into the Sack deck.", verb: "Remove" },

  // 131045:A:1 to 131049:A:1 and 131050:A:1 (the Sack cards): When Sacked, the first player chooses among the characters tied for the highest value (131044:A:1 has no tie but among allies).
  "131044:triggered:1 @0 AttachSacked": SACK_TIE("highest printed cost"),
  "131045:triggered:1 @0 AttachSacked": SACK_TIE("highest printed Attack"),
  "131046:triggered:1 @0 AttachSacked": SACK_TIE("highest printed Defense"),
  "131047:triggered:1 @0 AttachSacked": SACK_TIE("highest printed hit points"),
  "131048:triggered:1 @0 AttachSacked": SACK_TIE("highest printed Willpower"),
  "131049:triggered:1 @0 AttachSacked": SACK_TIE("most attachments"),
  "131050:triggered:1 @0 AttachSacked": SACK_TIE("most resources"),
};
