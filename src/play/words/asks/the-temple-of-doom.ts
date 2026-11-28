import type { Amount, PickSpec } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";

// The choice words of The Temple of Doom (vengeance-of-mordor part 3), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-temple-of-doom --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-temple-of-doom` prints each sentence.
// The first player answers for the group at each "highest or lowest" tie and at Place of Evil's Choose, so those sentences are not owned; a choice of one player's own (the character that takes X damage, the hero The Legacy of Mordor hurts, the card the Lord of Middle-earth discards, the cards Under the Watchful Eye discards) is owned and names its card in `why`.
// No row here raises a player's threat, so no row arms a caution: Place of Evil's damage row only moves Tribute to Mordor nearer its reveal, which no choice here decides.
// The damage tokens on Tribute to Mordor (it reveals a card of the Power of Mordor deck at 4).
const TRIBUTE_DAMAGE: Amount = { stat: "damage", ofNamed: "Tribute to Mordor" };
// "The Easterling enemy without a copy of the attachment that is tied for the lowest Attack / highest engagement cost / highest Attack", the cards the first player chooses among.
const EASTERLING = { type: "enemy", control: "any", staging: true, trait: "Easterling" } as const;
const LOWEST_ATTACK = (title: string): PickSpec => ({ ...EASTERLING, hasAttachment: { names: [title], none: true }, lowestAttack: true });
const HIGHEST_COST = (title: string): PickSpec => ({ ...EASTERLING, hasAttachment: { names: [title], none: true }, highestEngagementCost: true });
const HIGHEST_ATTACK: PickSpec = { ...EASTERLING, highestAttack: true };

export const ASKS: Readonly<Record<string, Ask>> = {
  // 21022:A:3 (When Revealed): attach to the Easterling enemy with the lowest Attack that has no Sword of Rhûn.
  "21022:whenRevealed:1 @0 Pick": {
    note: "{card}: {tied} Easterling enemies are tied for the lowest Attack ({lowAttack}) and have no Sword of Rhûn. Choose the one it attaches to.",
    bind: { tied: { count: LOWEST_ATTACK("Sword of Rhûn") } },
    named: { low: { pick: LOWEST_ATTACK("Sword of Rhûn"), otherwise: "the same" } },
    verb: "Attach",
  },
  // 21023:A:3 (When Revealed): attach to the Easterling enemy with the highest engagement cost that has no Recurve Bow.
  "21023:whenRevealed:1 @0 Pick": {
    note: "{card}: {tied} Easterling enemies are tied for the highest engagement cost ({highCost}) and have no Recurve Bow. Choose the one it attaches to.",
    bind: { tied: { count: HIGHEST_COST("Recurve Bow") } },
    named: { high: { pick: HIGHEST_COST("Recurve Bow"), otherwise: "the same" } },
    verb: "Attach",
  },
  // 21024:A:2 (Forced after it becomes the current quest): the highest Attack Easterling enemy in the staging area attacks the first player.
  "21024:forced:2 @0 Pick": {
    note: "{card}: {tied} Easterling enemies in the staging area are tied for the highest Attack ({topAttack}). Choose the one that attacks the first player now.",
    bind: { tied: { count: HIGHEST_ATTACK } },
    named: { top: { pick: HIGHEST_ATTACK, otherwise: "the same" } },
    verb: "Attack",
  },

  // 21056:A:1 (Forced when it leaves play): each player chooses a character they control to take X damage, X one more than the quest stages in the victory display.
  "21056:forced:1 @0.0 Pick": {
    owned: true,
    why: "it left play.",
    note: "Choose a character you control to take {x} damage (quest stages in the victory display: {stages}, plus 1).",
    bind: { x: { count: { type: "card", control: "any", from: "victory", cardType: "quest" }, plus: 1 }, stages: { count: { type: "card", control: "any", from: "victory", cardType: "quest" } } },
    verb: "Damage",
  },

  // 21057:A:1 (When Revealed): 1 damage goes on Tribute to Mordor, then the first player chooses: 1 more damage on it, or Place of Evil gains surge.
  "21057:whenRevealed:1 @1 Choose": { note: "{card}: {owner} chooses for all the players. Tribute to Mordor holds {tribute} of 4 damage (it reveals a Power of Mordor card at 4). Place 1 more, or {card} gains surge.", bind: { tribute: TRIBUTE_DAMAGE } },
  "21057:whenRevealed:1 @1 damage": { label: "Place 1 more damage on Tribute ({tribute} to {next} of 4)", bind: { tribute: TRIBUTE_DAMAGE, next: { stat: "damage", ofNamed: "Tribute to Mordor", plus: 1 } } },
  "21057:whenRevealed:1 @1 surge": { label: "{card} gains surge (reveal 1 more card)" },

  // 21059:A:1 (When Revealed): Thane Ulchor makes an immediate attack against the first player.
  "21059:whenRevealed:1 @0 Pick": { note: "{card}: choose Thane Ulchor. He makes an immediate attack against the first player.", verb: "Attack" },

  // 21060:A:2 (When Revealed): attach to the Easterling enemy with the lowest Defense that has no Fanaticism; the first player chooses among those tied.
  "21060:whenRevealed:1 @0 PickLowestDefense": { note: "{card}: the Easterling enemies tied for the lowest Defense and with no Fanaticism are offered. Choose the one it attaches to.", verb: "Attach" },

  // 21068:A:1 (When Revealed): each player with more than 5 cards in hand discards down to 5.
  "21068:whenRevealed:1 @0.0 DiscardFromHand": { owned: true, why: "it was revealed.", note: "Choose cards to discard from your hand, one at a time, until you hold 5.", verb: "Discard" },

  // 21081:B:1 (Forced at the beginning of the quest phase): each player deals 1 damage to a hero they control and exhausts it; it cannot ready or be healed until the refresh phase.
  "21081:forced:1 @0.0 Pick": { owned: true, why: "the quest phase begins.", note: "Choose a hero you control. It takes 1 damage and exhausts, and cannot ready or be healed until the refresh phase.", verb: "Hurt" },

  // 21085:B:2 (Forced at the beginning of the quest phase): each player discards 1 card from hand; no more than X progress goes on this stage this round, X the total cost of the discarded cards.
  "21085:forced:1 @0.0 Pick": { owned: true, why: "the quest phase begins.", note: "Choose a card in your hand to discard. Its printed cost adds to X, the most progress this stage can take this round.", verb: "Discard" },
};
