import type { PickSpec } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";
import { DESTROYED_BY, ELIMINATED, type When } from "../asks-conditions.ts";
import { ELIMINATION_LEVEL } from "../../../rules/core/eliminate.ts";
import { DETERMINATION_ASKS, LOOT_BOON_ASKS, POOL_BOON_ASKS } from "../pool-boon-asks.ts";

// The choice words of Across the Ettenmoors (angmar-awakened part 6), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario across-the-ettenmoors --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=across-the-ettenmoors` prints each sentence.
// A choice of one player's own (the character the Coldfell Giant hurts, Abandoned Camp's card, Arador's Bane's engage or search, Losing Time's threat or exhaust and its shadow, the card Scavenge for Supplies lets a player play, the ally Barren Moorland costs) is owned: two-handed the sentence leads with the player.
// The first player answers for the group at Troll-fells' search, No Rest's hero, Lie Low's enemy and Scavenge for Supplies' Troll, so those sentences are not owned and the sheet adds who chooses. A row of a pick that spans players (No Rest's heroes) names the owner of its card. Amarthiúl (10067) is an
// objective ally with 3 hit points, and his leaving play loses the game: the Coldfell Giant's damage row warns when 1 damage destroys the one picked, and says the game is lost for Amarthiúl. The pool's boons are worded once (src/play/words/pool-boon-asks.ts).
const MY_READY_HERO: PickSpec = { type: "hero", control: "you", state: "ready" };
const ENEMY_ABOVE_MY_THREAT: PickSpec = { type: "enemy", control: "any", stagingOnly: true, aboveThreat: true };
// The picked character is Amarthiúl, whose leaving play loses the game for every player (10067:A:2), and the damage that would destroy him.
const AMARTHIUL: When = { kind: "matches", card: "picked", pick: { type: "ally", control: "you", names: ["Amarthiúl"] } };
const AMARTHIUL_DESTROYED_BY = (damage: number): When => ({ kind: "all", conditions: [AMARTHIUL, DESTROYED_BY(damage)] }) as When;
// The ally that entered play (the card that triggered Barren Moorland) is Amarthiúl: the same, read from the subject.
const SUBJECT_AMARTHIUL_DESTROYED_BY = (damage: number): When =>
  ({ kind: "all", conditions: [{ kind: "matches", card: "subject", pick: { type: "ally", control: "you", names: ["Amarthiúl"] } }, DESTROYED_BY(damage, "subject")] }) as When;
// A raise of 3 that takes the player to the elimination level (50): the last player's elimination loses the game.
const ELIMINATED_BY_THREAT = { when: ELIMINATED(3, ELIMINATION_LEVEL), text: "Tap again: this takes your threat to 50 and eliminates you. If you are the last player, the game is lost" };

export const ASKS: Readonly<Record<string, Ask>> = {
  // 10070:A:3 (Response after you travel to Abandoned Camp): each player may return 1 card from their discard pile to their hand.
  "10070:response:1 @0.0 Choose": { owned: true, note: "Abandoned Camp: return 1 card from your discard pile to your hand, or none." },
  "10070:response:1 @0.0 return": { label: "Return a card from your discard pile to your hand" },
  "10070:response:1 @0.0 skip": { label: "Return no card" },
  "10070:response:1 @0.0.return.0 Pick": { owned: true, note: "Abandoned Camp: choose a card from your discard pile to return to your hand.", verb: "Return" },

  // 10073:A:1 (Forced after it engages you): 1 damage to each of 3 different characters you control, one at a time.
  "10073:forced:1 @0.0 hit": { label: "Deal 1 damage to a character you control that has taken none from this card" },
  "10073:forced:1 @0.0.hit.0 Pick": { owned: true, note: "Coldfell Giant engaged you: choose a character you control to take 1 damage. Each of 3 different characters takes 1.", verb: "Assign", caution: { when: DESTROYED_BY(1), text: [{ when: AMARTHIUL_DESTROYED_BY(1), text: "Tap again: Amarthiúl is destroyed and the game is lost" }, { text: "Tap again: {picked} is destroyed" }] } },

  // 10075:A:2 (Shadow): the defending player chooses a location with the safe keyword in play and shuffles it into the encounter deck; the card guarding it stays in the staging area.
  "10075:shadow:1 @0 Pick": { owned: true, note: "Ruthless Hill-troll's shadow: choose a location with the safe keyword in play, the active one included. It is shuffled into the encounter deck. The card guarding it stays in the staging area.", verb: "Shuffle in" },

  // 10077:A:2 (When Revealed): the first player searches the encounter deck and discard pile for a location with the safe keyword; it joins the staging area guarded by Troll-fells.
  "10077:whenRevealed:1 @0 SearchMove": { note: "Troll-fells: choose a location with the safe keyword from the encounter deck or discard pile. It is added to the staging area, guarded by Troll-fells. The deck is then shuffled.", verb: "Add" },

  // 10078:A:1 (Forced while in the staging area, after an ally enters play): its controller exhausts it or deals it 1 damage.
  "10078:forced:1 @0 Choose": { owned: true, note: "Barren Moorland: an ally you control entered play. Exhaust it or deal it 1 damage." },
  "10078:forced:1 @0 exhaust": { label: "Exhaust {subject}" },
  "10078:forced:1 @0 damage": { label: "Deal {subject} 1 damage", caution: { when: DESTROYED_BY(1, "subject"), text: [{ when: SUBJECT_AMARTHIUL_DESTROYED_BY(1), text: "Tap again: the damage destroys Amarthiúl and the game is lost" }, { text: "Tap again: the damage destroys {subject}" }] } },

  // 10079:A:1 (When Revealed): each player in turn engages an enemy in the staging area with an engagement cost above their threat, or searches for a Troll or Giant and adds it to the staging area.
  "10079:whenRevealed:1 @0.0 Choose": { owned: true, note: "Arador's Bane: engage an enemy in the staging area costing more than your threat, or search for a Troll or Giant." },
  "10079:whenRevealed:1 @0.0 engage": { named: { enemy: { pick: ENEMY_ABOVE_MY_THREAT, otherwise: "an enemy in the staging area" } }, label: "Engage {enemy}, then deal it 2 shadow cards" },
  "10079:whenRevealed:1 @0.0 search": { label: "Search the encounter deck and discard pile for a Troll or Giant and add it to the staging area" },
  "10079:whenRevealed:1 @0.0.engage.0 Pick": { owned: true, note: "Arador's Bane: choose the enemy in the staging area to engage. Its engagement cost is above your threat. It is dealt 2 shadow cards.", verb: "Engage" },
  "10079:whenRevealed:1 @0.0.search.0 SearchMove": { owned: true, note: "Arador's Bane: choose a Troll or Giant from the encounter deck or discard pile to add to the staging area.", verb: "Add" },

  // 10080:A:1 (When Revealed): the first player attaches it to an exhausted hero, any player's, that has no No Rest; with none, to a ready hero without one.
  "10080:whenRevealed:1 @0 Pick": { note: "No Rest: choose an exhausted hero, any player's, to carry it. The hero cannot ready or collect resources. It is discarded when the players travel to a safe location.", verb: "Attach" },
  "10080:whenRevealed:1 @1 Pick": { note: "No Rest: no hero is exhausted. Choose a ready hero, any player's, to carry it. The hero cannot ready or collect resources. It is discarded when the players travel to a safe location.", verb: "Attach" },

  // 10081:A:2 (Response after it is defeated): the first player shuffles an enemy of the staging area into the encounter deck.
  "10081:response:1 @0 Pick": { note: "Lie Low is defeated: choose an enemy in the staging area to shuffle into the encounter deck.", verb: "Shuffle in" },

  // 10083:A:2 (Forced when defeated): the first player chooses a Troll from the encounter deck or discard pile, which enters play engaged with the player with the highest threat; each player may then play 1 card from their hand at no cost.
  "10083:forced:1 @1 SearchMove": { note: "Scavenge for Supplies is defeated: choose a Troll enemy from the encounter deck or discard pile. It enters play engaged with the player with the highest threat.", verb: "Choose" },
  "10083:forced:1 @3.0 Choose": { owned: true, note: "Scavenge for Supplies is defeated: you may play 1 card from your hand at no cost." },
  "10083:forced:1 @3.0 play": { label: "Play a card from your hand at no cost" },
  "10083:forced:1 @3.0 skip": { label: "Play no card" },
  "10083:forced:1 @3.0.play.0 PlayFromHand": { owned: true, note: "Scavenge for Supplies: choose a card from your hand to play at no cost.", verb: "Play" },

  // 10183:A:2 (When Revealed): each player in turn raises their threat by 3 or exhausts a hero they control.
  "10183:whenRevealed:1 @0.0 Choose": { owned: true, note: "Losing Time: raise your threat by 3, or exhaust a hero you control." },
  "10183:whenRevealed:1 @0.0 threat": { label: "Raise your threat by 3", caution: ELIMINATED_BY_THREAT },
  "10183:whenRevealed:1 @0.0 exhaust": { named: { hero: { pick: MY_READY_HERO, otherwise: "a ready hero you control" } }, label: "Exhaust {hero}" },
  "10183:whenRevealed:1 @0.0.exhaust.0 Pick": { owned: true, note: "Losing Time: choose a ready hero you control to exhaust.", verb: "Exhaust" },
  // 10183:A:3 (Shadow): the defending player chooses whether the attacking enemy gets +3 Attack or +3 Defense until the end of the phase.
  "10183:shadow:1 @0 Choose": { owned: true, note: "Losing Time's shadow: the attacking enemy gets +3 Attack or +3 Defense until the end of the phase." },
  "10183:shadow:1 @0 attack": { label: "The attacking enemy gets +3 Attack" },
  "10183:shadow:1 @0 defense": { label: "The attacking enemy gets +3 Defense" },

  // Determination (10172:A:1) and Ruthless (10164:A:4), worded once for every scenario that can deal them.
  ...DETERMINATION_ASKS,
  ...POOL_BOON_ASKS,
  ...LOOT_BOON_ASKS,

  "09049:whenRevealed:1 @0.current.0 ChooseCurrentQuest": { note: "{card}: choose the main quest card or a side quest in the staging area to be the current quest this phase.", verb: "Choose" },
  "10083:forced:1 @0 PickHighestThreat": { note: "{card}: players are tied for the highest threat. Choose the player the Troll enemy engages.", verb: "Engage" },
};
