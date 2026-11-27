import type { Ask } from "../asks.ts";
import { DESTROYED_BY, ELIMINATED } from "../asks-conditions.ts";
import { ELIMINATION_LEVEL } from "../../../rules/core/eliminate.ts";
import { URUK_CHIEFTAIN_ASKS } from "../haradrim-asks.ts";

// The choice words of The Crossings of Poros (haradrim part 9), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-crossings-of-poros --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-crossings-of-poros` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 16042:shadow:1 (Southron Soldier, shadow): Shadow: Choose a non-unique enemy in the staging area. Engage it and deal it a shadow card.
  "16042:shadow:1 @0 Pick": { note: "Southron Soldier: choose a non-unique enemy in the staging area. It engages the first player, then is dealt a shadow card.", verb: "Engage" },
  // 16061:forced:1 (Uruk Chieftain, forced): the shared sentence names the tied players the first player chooses among.
  ...URUK_CHIEFTAIN_ASKS,
  // 16064:whenRevealed:1 (Mordor Warg, whenRevealed): When Revealed: Attach to an Orc enemy and return that enemy to the staging area. Limit 1 per enemy. (Counts as a Mount attachment with the text: "Attached enemy gets +2 Threat, +2 Attack, +2 Defense and +2 hit points. Forced: When attached enemy leaves play, add Mordor Warg to the staging area.")
  "16064:whenRevealed:1 @0 Pick": { owned: true, note: "Mordor Warg: choose an Orc enemy in play, in the staging area, engaged or in the Orcs' area, to attach to. It returns to the staging area.", verb: "Attach" },
  // 17146:A:3 (The Black Serpent, forced): the printed text of 17094; the first player chooses between X progress off the main quest and the Serpent's attack.
  "17146:forced:1 @0 Choose": { note: "The Black Serpent: remove progress equal to the stage number of the main quest, or it attacks you." },
  "17146:forced:1 @0 progress": { label: "Remove {x} progress from the main quest", bind: { x: { stage: true } } },
  "17146:forced:1 @0 attack": { label: "The Black Serpent attacks you (Attack {x})", bind: { x: { stat: "attack", of: "self" } } },

  // 17147:A:1 (Southron Outrider, forced): the engaged player chooses; the discard option stands only while a Harad Soldiers enemy is set aside.
  "17147:forced:1 @1 Choose": { owned: true, note: "Southron Outrider: discard a random set aside Harad Soldiers enemy, or it gets +3 Attack this round." },
  "17147:forced:1 @1 place": { label: "Place a random set aside Harad Soldiers enemy in the encounter discard pile" },
  "17147:forced:1 @1 attack": { label: "Southron Outrider gets +3 Attack until the end of the round" },

  // 17148:A:1 (Uruk Prowler, whenRevealed): the first player chooses.
  "17148:whenRevealed:1 @1 Choose": { note: "Uruk Prowler: discard a random set aside Mordor Orcs enemy, or it attacks you." },
  "17148:whenRevealed:1 @1 place": { label: "Place a random set aside Mordor Orcs enemy in the encounter discard pile" },
  "17148:whenRevealed:1 @1 attack": { label: "Uruk Prowler attacks you from the staging area" },

  // 17149:A:1 (Desert Warg, whenRevealed): the first player chooses.
  "17149:whenRevealed:1 @1 Choose": { note: "Desert Warg: discard a random set aside Desert Creatures enemy, or it gains surge." },
  "17149:whenRevealed:1 @1 place": { label: "Place a random set aside Desert Creatures enemy in the encounter discard pile" },
  "17149:whenRevealed:1 @1 surge": { label: "Desert Warg gains surge: reveal an additional encounter card" },

  // 17150:A:2, 17151:A:1, 17152:A:2 and 17152:A:3 (Desolate Land, Harondor Waste, Danger Close Behind): several set aside sets hold the most cards, so the first player chooses a set by one of its cards; a random card of that set is drawn.
  "17150:forced:1 @0 RandomSetAside": { owned: true, note: "Desolate Land: sets tie for the most cards left. Choose one by a card of it; a random card of that set is revealed.", verb: "Reveal" },
  "17151:forced:1 @0 RandomSetAside": { owned: true, note: "Harondor Waste: sets tie for the most cards left. Choose one by a card of it; a random card of that set goes to the encounter discard pile.", verb: "Place" },
  "17152:whenRevealed:1 @0 RandomSetAside": { owned: true, note: "Danger Close Behind: sets tie for the most cards left. Choose one by a card of it; a random card of that set is revealed.", verb: "Reveal" },
  "17152:shadow:1 @0.0 RandomSetAside": { owned: true, note: "Danger Close Behind: sets tie for the most cards left. Choose one by a card of it; a random card of that set is revealed.", verb: "Reveal" },

  // 17158:B:1 (Pelargir Defences stage 2, forced): the player who played the ally chooses.
  "17158:forced:1 @0 Choose": { owned: true, note: "You played {subject}: exhaust it, or deal 1 damage to it." },
  "17158:forced:1 @0 exhaust": { label: "Exhaust {subject}" },
  "17158:forced:1 @0 damage": { label: "Deal 1 damage to {subject}", caution: { when: DESTROYED_BY(1, "subject"), text: "Tap again: this destroys {subject}" } },

  // 17159:B:1 (stage 2, forced): exhaust the ally, or raise the threat of the player who played it by 1.
  "17159:forced:1 @0 Choose": { owned: true, note: "You played {subject}: exhaust it, or raise your threat by 1." },
  "17159:forced:1 @0 exhaust": { label: "Exhaust {subject}" },
  "17159:forced:1 @0 threat": { label: "Raise your threat by 1", caution: { when: ELIMINATED(1, ELIMINATION_LEVEL), text: "Tap again: this takes your threat to 50 and eliminates you. If you are the last player, the game is lost" } },

  // 17163:whenRevealed:1 (Battle at the Crossings, whenRevealed): When Revealed: The first player takes control of Poros Garrison. Search the encounter deck and discard pile for each enemy that belongs to an encounter set denoted by the first icon on each set aside stage 3 and add them to the staging area. Shuffle the encounter deck.
  "17163:whenRevealed:1 @1 TakeObjectiveAlly": { note: "Battle at the Crossings: the first player takes control of Poros Garrison. It enters play under their control, ready.", verb: "Take" },
};
