import type { Ask } from "../asks.ts";

// The choice words of The Seventh Level (dwarrowdelf part 2), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-seventh-level --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-seventh-level` prints each sentence.
// The first player answers for the group at Goblin Archer and at Search for the Chamber's Setup, so those sentences are not owned (the sheet adds who chooses); the last player's discard, each player's damage, the defending player's shadow
// discard, each player's Plundered Armoury choice and the hero who claims the Book are owned. Book of Mazarbul is the objective card of this scenario. Watchful Eyes is Into the Pit's record and has the same words.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 03022:A:1 (When Revealed): after every player raised his threat, the last player discards an attachment he controls (the Book is an objective, so it is not one).
  "03022:whenRevealed:1 @1.0 Pick": { owned: true, note: "{card}: as the last player, choose 1 attachment you control to discard. Book of Mazarbul is not an attachment.", verb: "Discard" },

  // 03024:A:2 (Action): any player exhausts a ready hero to claim the Book from the staging area or from the hero carrying it.
  "03024:action:1 @0 Pick": { owned: true, note: "{card}: choose 1 ready hero you control to exhaust. That hero claims it, even from another hero, and carries it: it cannot attack.", verb: "Exhaust" },

  // 03032:A:3 (Forced after an enemy is revealed from the encounter deck): the first player damages a character he controls.
  "03032:forced:1 @0 Pick": { note: "{card}: an enemy was revealed from the encounter deck. Choose 1 character you control, a hero or an ally, to take 1 damage.", verb: "Assign" },

  // 03033:A:1 (When Revealed) and A:2 (Shadow): each player puts as much damage as the allies he controls on 1 of them; the defending ally is discarded as a shadow card.
  "03033:whenRevealed:1 @0.0 Pick": { owned: true, bind: { allies: { count: { type: "ally", control: "you" } } }, note: "{card}: choose 1 ally you control to take {allies} damage, the number of allies you control.", verb: "Assign" },
  "03033:shadow:1 @0 Pick": { owned: true, note: "{card}: the defending ally is discarded from play.", verb: "Discard" },

  // 03034:A:2 (Response after Plundered Armoury is explored): each player may put a Weapon or Armour attachment from his hand into play on a character he controls, free.
  "03034:response:1 @0.0 Choose": { owned: true, note: "{card}: put 1 Weapon or Armour attachment from your hand into play on a character you control, free, or keep your hand." },
  "03034:response:1 @0.0 attach": { label: "Put a Weapon or Armour attachment into play from your hand" },
  "03034:response:1 @0.0 keep": { label: "Keep your hand: attach nothing" },
  "03034:response:1 @0.0.attach.0 Pick": { owned: true, note: "{card}: choose 1 Weapon or Armour attachment in your hand to put into play. It costs nothing. Then choose the character that carries it.", verb: "Play free" },

  // 03062:A:1 (When Revealed, Into the Pit's record): the first player attaches Watchful Eyes to one of his heroes that carries no copy of it.
  "03062:whenRevealed:1 @0 AttachSelf": { note: "{card}: choose 1 of your heroes to carry it. A hero with a Watchful Eyes already is not offered.", verb: "Attach" },

  // 03067:A:1 (Setup): the first player attaches Book of Mazarbul to the hero of any player he chooses.
  "03067:setup:1 @1 Pick": { note: "{card}: choose 1 hero, any player's, to carry Book of Mazarbul. That hero cannot attack and does not exhaust to quest. Any hero may claim it later.", verb: "Attach" },
};
