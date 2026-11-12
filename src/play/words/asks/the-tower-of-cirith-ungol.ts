import type { Amount } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";

// The choice words of The Tower of Cirith Ungol (the-return-of-the-king part 16), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-tower-of-cirith-ungol --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-tower-of-cirith-ungol` prints each sentence.
// What can lose the game says so on the row: the hero carrying The One Ring destroyed or discarded (the One Ring leaving play loses, mec113.the-one-ring). The Item boon each player sets aside at Setup is chosen on the Campaign Setup checklist (src/campaign/checklist.ts, SetAsideBoon).
type When = NonNullable<Ask["caution"]>["when"];
const QUESTING: Amount = { count: { type: "character", control: "you", committed: true } };
const HAND: Amount = { count: { type: "card", control: "you", from: "hand" } };
// The picked character carries The One Ring: its loss from play loses the game.
const CARRIES_RING: When = { kind: "matches", card: "picked", pick: { type: "character", control: "any", hasAttachment: { names: ["The One Ring"] } } };
// The picked character would be destroyed by `damage` more damage: its hit points are less than its damage plus that damage plus 1.
const DESTROYED_BY = (damage: number): When => ({ kind: "less", left: { stat: "hitPoints", of: "picked" }, right: { stat: "damage", of: "picked", plus: damage + 1 } });

// The picked character carries The One Ring and would be destroyed by `damage` more damage.
const RING_DESTROYED_BY = (damage: number): When => ({ kind: "all", conditions: [CARRIES_RING, DESTROYED_BY(damage)] }) as When;

export const ASKS: Readonly<Record<string, Ask>> = {
  // 146014:A:2 (Action): the acting player chooses any enemy, in the staging area or engaged. The Threat it loses is the Willpower of the hero carrying Last of the Company now, and follows it while the effect lasts.
  "146014:action:1 @2 Pick": { owned: true, note: "Last of the Company: choose an enemy, in the staging area or engaged. It gets -{x} Threat until the end of the phase. X is {host}'s Willpower, and follows it if it changes.", bind: { x: { stat: "willpower", of: "host" } }, verb: "Weaken" },

  // 146018:A:2 (Travel): each player in turn, the first player first.
  "146018:travel:1 @0.0 Pick": { owned: true, note: "Winding Stairs: choose a ready character you control to exhaust.", verb: "Exhaust" },

  // 146019:A:1 and 146067:B:1: a copy of the discarded enemy lies in the staging area; the first player chooses which copy goes with it.
  "146019:forced:1 @2 Pick": { owned: true, note: "Torch-lit Hall: the enemy discarded has a copy in the staging area. Choose the copy to discard as well.", verb: "Discard" },
  "146067:forced:1 @2 Pick": { owned: true, note: "Fighting in the Tower: the enemy discarded has a copy in the staging area. Choose the copy to discard as well.", verb: "Discard" },

  // 146023:A:2 (shadow): the defending player chooses another enemy engaged with them; it takes the attack.
  "146023:shadow:1 @0 Pick": { owned: true, note: "Orcish Howls shadow: choose another enemy engaged with you. The attack is resolved against it, so no one you control takes the damage.", verb: "Redirect" },

  // 146058:A:2 and A:3, 146059:A:2, 146061:A:2: the player the enemy engaged, or the defender, chooses.
  "146058:forced:1 @0 Pick": { owned: true, note: "Orc of Mordor: choose a character you control to exhaust.", verb: "Exhaust" },
  "146058:shadow:1 @0 Pick": { owned: true, note: "Orc of Mordor shadow: choose a character you control to exhaust.", verb: "Exhaust" },
  "146059:forced:1 @0 Pick": { owned: true, note: "Snaga Archer: choose one character you control to take 2 damage.", verb: "Assign", caution: { when: RING_DESTROYED_BY(2), text: "Tap again: {picked} carries The One Ring and is destroyed by the 2 damage, and the players lose the game" } },
  "146061:shadow:1 @0 Pick": { owned: true, note: "Drawn to the Ring shadow: choose a non-objective attachment you control to discard.", verb: "Discard" },

  // 146061:A:1: the first player chooses for the table.
  "146061:whenRevealed:1 @0 Choose": { owned: true, note: "Drawn to the Ring: exhaust The One Ring and reveal an encounter card, or engage the next enemy of the encounter deck." },
  "146061:whenRevealed:1 @0 ring": { label: "Exhaust The One Ring, then reveal an encounter card" },
  "146061:whenRevealed:1 @0 enemy": { label: "Discard cards from the encounter deck until an enemy is discarded, then it engages you" },

  // 146062:A:2: each player in turn, the first player first.
  "146062:whenRevealed:1 @0.0 Choose": { owned: true, note: "Deep Shadows: discard your hand, or reveal an encounter card." },
  "146062:whenRevealed:1 @0.0 discard": { label: "Discard your hand ({n} cards)", bind: { n: HAND } },
  "146062:whenRevealed:1 @0.0 reveal": { label: "Reveal an encounter card" },

  // 146063:A:1: each player in turn, the first player first; a questing hero carrying The One Ring discarded loses the game.
  "146063:whenRevealed:1 @0.0 Choose": { owned: true, note: "Evil Vigilance: discard a questing character you control, or raise your threat by 1 for each one." },
  "146063:whenRevealed:1 @0.0 discard": { label: "Discard a questing character you control" },
  "146063:whenRevealed:1 @0.0 threat": { label: "Raise your threat by {n}, 1 for each questing character you control", bind: { n: QUESTING } },
  "146063:whenRevealed:1 @0.0.discard.0 Pick": { owned: true, note: "Evil Vigilance: choose a questing character you control to discard.", verb: "Discard", caution: { when: CARRIES_RING, text: "Tap again: {picked} carries The One Ring, which leaves play when it is discarded, and the players lose the game" } },

  // 146066:A:1 (Setup): the first player chooses, among the heroes they control, the hero that carries Last of the Company and The One Ring. The Ring-bearer lies under Topmost Chamber and is not offered.
  "146066:setup:1 @2 Pick": { owned: true, note: "Choose the hero who carries Last of the Company and The One Ring. They become a Ring-bearer, and the first player token stays with you.", verb: "Carry" },

  // 146068:A:1 (When Revealed): Last of the Company goes to the victory display; The One Ring returns to the Ring-bearer, who is exhausted.
  "146068:whenRevealed:1 @0 Pick": { note: "Last of the Company goes to the victory display. The hero who carried it stops being a Ring-bearer.", verb: "Continue" },
  "146068:whenRevealed:1 @3 Pick": { owned: true, note: "The One Ring and A Heavy Burden go to {ringBearer}, who exhausts.", verb: "Exhaust" },

  // 144052:A:3 (A Heavy Burden, Forced at the end of the planning phase): the first player chooses for the table; the card lies on the Ring-bearer, the hero it exhausts.
  "144052:forced:1 @0 Choose": { note: "A Heavy Burden: {owner} chooses for all the players. Either each player raises their threat by 1, or {host}, who carries A Heavy Burden, exhausts." },
  "144052:forced:1 @0 threat": { label: "Each player raises their threat by 1" },
  "144052:forced:1 @0 exhaust": { label: "Exhaust {host}, who carries A Heavy Burden" },
};
