import { ELIMINATION_LEVEL } from "../../../rules/core/eliminate.ts";
import type { Ask } from "../asks.ts";
import { ELIMINATED, type When } from "../asks-conditions.ts";

// The choice words of The Massing at Osgiliath (standalone-scenarios part 1), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-massing-at-osgiliath --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-massing-at-osgiliath` prints each sentence.
// Each player answers for himself (the defending player at 00001, 00012 and 00015; each player in turn from the first player at 00018), so the sentences are owned.

// A raise of 3 that takes the player to the elimination level (50): the last player's elimination loses the game.
const ELIMINATED_BY_THREAT: NonNullable<Ask["caution"]> = { when: ELIMINATED(3, ELIMINATION_LEVEL), text: "Tap again: this takes your threat to 50 and eliminates you. If you are the last player, the game is lost" };
// The player controls one hero only, the one picked: discarding it eliminates him (the last player's elimination loses the game).
const LAST_HERO: When = { kind: "count", pick: { type: "hero", control: "you" }, max: 1 };
const LAST_HERO_LOST = "Tap again: this is your last hero, and discarding it eliminates you. If you are the last player, the game is lost";

export const ASKS: Readonly<Record<string, Ask>> = {
  // 00001:A:3 (Forced after the Witch-king attacks): the defending player raises his threat by 3 or the Witch-king returns to the staging area.
  "00001:forced:1 @0 Choose": { owned: true, note: "The Witch-king attacked you: raise your threat by 3, or he returns to the staging area." },
  "00001:forced:1 @0 threat": { label: "Raise your threat by 3", caution: ELIMINATED_BY_THREAT },
  "00001:forced:1 @0 staging": { label: "The Witch-king returns to the staging area" },

  // 00012:A:3 (Cut Off, Shadow): the defending player discards 1 ally card from his hand (2 when the attack is undefended) or the attacking enemy gets +3 Attack.
  // The discard option is offered only when the hand holds the cards (1 on a defended attack, 2 on an undefended one); with neither option left the +3 Attack is the only answer and nothing is asked.
  "00012:shadow:1 @0 Choose": {
    owned: true,
    note: [
      { when: { kind: "undefended" }, text: "Cut Off: discard 2 ally cards from your hand (the attack is undefended), or the attacking enemy gets +3 Attack." },
      { text: "Cut Off: discard 1 ally card from your hand, or the attacking enemy gets +3 Attack." },
    ],
  },
  "00012:shadow:1 @0 discard": { label: "Discard 1 ally card from your hand" },
  "00012:shadow:1 @0 discardTwo": { label: "Discard 2 ally cards from your hand" },
  "00012:shadow:1 @0 attack": { label: "The attacking enemy gets +3 Attack" },
  "00012:shadow:1 @0.discard.0 Pick": { owned: true, note: "Cut Off: choose an ally card in your hand to discard.", verb: "Discard" },
  "00012:shadow:1 @0.discardTwo.0 Pick": { owned: true, note: "Cut Off: choose the first of 2 ally cards in your hand to discard.", verb: "Discard" },
  "00012:shadow:1 @0.discardTwo.2 Pick": { owned: true, note: "Cut Off: choose the second of 2 ally cards in your hand to discard.", verb: "Discard" },

  // 00015:A:2 (Ranger of Ithilien, Shadow): the defending player may exhaust a character he controls to take control of the Ranger.
  "00015:shadow:1 @1 Choose": { owned: true, note: "Ranger of Ithilien dealt 2 damage to the attacking enemy. Exhaust a ready character you control to take control of the Ranger, or it is discarded." },
  "00015:shadow:1 @1 take": { label: "Exhaust a character to take control of Ranger of Ithilien" },
  "00015:shadow:1 @1 decline": { label: "Let Ranger of Ithilien be discarded" },
  "00015:shadow:1 @1.take.0 Pick": { owned: true, note: "Ranger of Ithilien: choose a ready character you control to exhaust. You take control of the Ranger of Ithilien.", verb: "Exhaust" },

  // 00018:B:3 (Anduin Crossing): before committing characters, each player discards a hero or a Ranger of Ithilien he controls.
  "00018:forced:1 @0.0 Choose": { owned: true, note: "Anduin Crossing: to commit characters this phase, discard a hero or a Ranger of Ithilien you control. Or commit none." },
  "00018:forced:1 @0.0 hero": { label: "Discard a hero, then commit", caution: { when: LAST_HERO, text: LAST_HERO_LOST } },
  "00018:forced:1 @0.0 ranger": { label: "Discard a Ranger of Ithilien, then commit" },
  "00018:forced:1 @0.0 none": { label: "Discard nothing: you commit no characters this phase" },
  "00018:forced:1 @0.0.hero.0 Pick": { owned: true, note: "Anduin Crossing: choose a hero you control to discard.", verb: "Discard", caution: { when: LAST_HERO, text: LAST_HERO_LOST } },
  "00018:forced:1 @0.0.ranger.0 Pick": { owned: true, note: "Anduin Crossing: choose a Ranger of Ithilien you control to discard.", verb: "Discard" },
};
