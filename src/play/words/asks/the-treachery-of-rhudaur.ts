import type { PickSpec } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";
import { DESTROYED_BY, type When } from "../asks-conditions.ts";
import { DETERMINATION_ASKS, LOOT_BOON_ASKS, POOL_BOON_ASKS } from "../pool-boon-asks.ts";

// The choice words of The Treachery of Rhudaur (angmar-awakened part 7), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-treachery-of-rhudaur --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-treachery-of-rhudaur` prints each sentence.
// A choice of one player's own (a Clue's claim, an Undead enemy a player searches for) is owned: two-handed the sentence leads with the player. The first player answers for the group at Dark Covenant, so those sentences are not owned and the sheet adds who chooses; a row of a pick that
// spans players names the owner of its card. The first player's question at the beginning of the quest phase (a side quest, or no current quest on stage 1: Secrets of Rhudaur cannot be the current quest) is worded in src/play/words/scenarios/night.ts. Amarthiúl (10096) is an objective ally
// with 3 hit points, and his leaving play loses the game: Dark Covenant's damage row warns when 1 damage destroys the one picked, and says the game is lost for Amarthiúl. The pool's boons are worded once (src/play/words/pool-boon-asks.ts).
const AMARTHIUL_READY: PickSpec = { type: "character", control: "you", state: "ready", names: ["Amarthiúl"] };
const AMARTHIUL: When = { kind: "matches", card: "picked", pick: { type: "ally", control: "any", names: ["Amarthiúl"] } };
const AMARTHIUL_DESTROYED_BY = (damage: number): When => ({ kind: "all", conditions: [AMARTHIUL, DESTROYED_BY(damage)] }) as When;

// The Clue objectives' Action (10110, 10112, 10114): exhaust a ready hero or Amarthiúl to claim the Clue, attached to that character.
const claim = (clue: string): Readonly<Record<string, Ask>> => ({
  [`${clue}:action:1 @0 Choose`]: { owned: true, note: "Claim {card}: exhaust a ready hero you control, or Amarthiúl. It is attached to the character exhausted." },
  [`${clue}:action:1 @0 hero`]: { label: "Exhaust a ready hero you control to claim {card}" },
  [`${clue}:action:1 @0 amarthiul`]: { named: { amarthiul: { pick: AMARTHIUL_READY, otherwise: "Amarthiúl" } }, label: "Exhaust {amarthiul} to claim {card}" },
  [`${clue}:action:1 @0.hero.0 Pick`]: { owned: true, note: "Claim {card}: choose a ready hero you control to exhaust. {card} is attached to it.", verb: "Exhaust" },
  [`${clue}:action:1 @0.amarthiul.0 Pick`]: { owned: true, note: "Claim {card}: exhaust Amarthiúl. {card} is attached to him.", verb: "Exhaust" },
});

export const ASKS: Readonly<Record<string, Ask>> = {
  // 10095:A:1 (When Revealed): each player in turn searches the encounter deck and discard pile for an Undead enemy and adds it to the staging area.
  "10095:whenRevealed:1 @1.0 SearchMove": { owned: true, note: "Thaurdir's Pursuit: choose an Undead enemy from the encounter deck or discard pile to add to the staging area. It is not revealed.", verb: "Add" },

  // 10097:A:1 (Forced when explored): each player in turn discards the top 5 cards of the encounter deck and adds an Undead enemy of those they discarded to the staging area.
  "10097:forced:1 @0.1 StageLooked": { owned: true, note: "The Great Hall is explored: choose an Undead enemy among the cards you discarded to add to the staging area. It is not revealed.", verb: "Add" },

  // 10105:A:2 (When Revealed): the first player chooses a quest card other than the current quest to be the current quest.
  "10105:whenRevealed:1 @0 ChooseCurrentQuest": { note: "Centuries of Sorrow: choose a quest card other than the current quest to be the current quest. The main quest card cannot be chosen on stage 1.", verb: "Choose" },

  // 10107:A:1 (When Revealed): the first player removes X progress from among the quests in play, or assigns X damage among the characters they control, X the total Threat of the 3 cards discarded.
  "10107:whenRevealed:1 @1 Choose": { bind: { x: { discardedThreat: true } }, note: "Dark Covenant: the 3 cards discarded total {x} Threat. Remove {x} progress from among the quests in play, or assign {x} damage among the characters the first player controls." },
  "10107:whenRevealed:1 @1 remove": { bind: { x: { discardedThreat: true } }, label: "Remove {x} progress from among the quests in play" },
  "10107:whenRevealed:1 @1 damage": { bind: { x: { discardedThreat: true } }, label: "Assign {x} damage among the characters you control" },
  "10107:whenRevealed:1 @1.remove.0 RemoveProgressAmong": { note: "Dark Covenant: choose a quest card to remove 1 progress from. The progress comes off one token at a time.", verb: "Remove" },
  "10107:whenRevealed:1 @1.damage.0 AssignDamage": { note: "Dark Covenant: choose a character the first player controls to take 1 damage. {left} damage is left to assign.", verb: "Assign", caution: { when: DESTROYED_BY(1), text: [{ when: AMARTHIUL_DESTROYED_BY(1), text: "Tap again: Amarthiúl is destroyed and the game is lost" }, { text: "Tap again: {picked} is destroyed" }] } },

  // 10109:A:2, 10111:A:2, 10113:A:2: the progress goes on the side quest itself, the one quest card of that name.
  "10109:forced:2 @0 Pick": { note: "An enemy was destroyed: Quiet the Spirits takes 2 progress.", verb: "Place" },
  "10111:forced:1 @0 Pick": { note: "A location was explored: Sift through the Debris takes 2 progress.", verb: "Place" },
  "10113:action:1 @0 Pick": { owned: true, note: "Decipher Ancient Texts: pay 1 resource from a hero you control to place 1 progress on it.", verb: "Place" },

  // The Clue objectives' Action.
  ...claim("10110"),
  ...claim("10112"),
  ...claim("10114"),

  // 10185:A:3 (Response after it is played): search the top 5 cards of the encounter deck for a Sorcery treachery and add it to the victory display.
  "10185:response:1 @0 PickEncounter": { note: "Daechanar's Brand: choose a Sorcery treachery from the top 5 cards of the encounter deck to add to the victory display. The deck is then shuffled.", verb: "Add" },
  // 10187:A:3 (Response after it is played): discard a non-unique Undead enemy with 2 or less remaining hit points.
  "10187:response:1 @0 Pick": { note: "Orders from Angmar: choose a non-unique Undead enemy with 2 or less hit points left to discard.", verb: "Discard" },

  // Determination (10172:A:1), Ruthless (10164:A:4) and the pool's other boons, worded once for every scenario that can deal them.
  ...DETERMINATION_ASKS,
  ...POOL_BOON_ASKS,
  ...LOOT_BOON_ASKS,
};
