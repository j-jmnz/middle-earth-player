import type { Ask } from "../asks.ts";

// The choice words of The Watcher in the Water (dwarrowdelf part 6), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-watcher-in-the-water --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-watcher-in-the-water` prints each sentence.
// The first player answers for the group at Wrapped!, Stair Falls, Ill Purpose's tie, the Tentacles that attach to a character (Grasping, Thrashing and Choking Tentacle) and Rippling From Beneath, so those sentences are not owned (the sheet adds who chooses and the rows of a pick that spans
// seats name their owner); each player's own choice is owned: Wrapped!'s Action, Doors of Durin's hand discards and The Watcher's damage to one of his characters.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 040076:A:1 (When Revealed): the first player attaches Wrapped! to a hero he controls that has no Wrapped!. Attached, the hero cannot exhaust or ready and is discarded from play at the end of the round.
  "040076:whenRevealed:1 @0 AttachSelf": { note: "{card}: choose a hero the first player controls to carry it. The hero cannot exhaust or ready, and is discarded from play at the end of the round.", verb: "Attach" },
  // 040076:A:1 (Combat Action, any player's): exhaust a ready hero he controls that has no Tentacle attachment to discard Wrapped!.
  "040076:action:1 @0 Pick": { owned: true, note: "{card}: choose a ready hero you control with no Tentacle attachment to exhaust. Wrapped! is discarded and its hero is free.", verb: "Exhaust" },

  // 04065:A:2 (Action, any player's, once each round): each player in turn, the first player first, discards any number of cards from his hand; the top encounter card is discarded and, when its title starts with the same letter as a card discarded, Doors of Durin goes to the victory display.
  "04065:action:1 @0.0 Each": { owned: true, note: "{card}: choose any number of cards from your hand to discard, one at a time. Done stops. Then the top encounter card is discarded: a title with the same first letter wins Doors of Durin.", verb: "Discard", labels: { done: "Done" } },

  // 04066:A:1 (Travel): the first player exhausts 2 ready characters he controls.
  "04066:travel:1 @0 Pick": { note: "{card}: to travel here the first player exhausts 2 ready characters he controls. Choose the first character.", verb: "Exhaust" },
  "04066:travel:1 @2 Pick": { note: "{card}: choose the second ready character the first player controls to exhaust for the travel cost.", verb: "Exhaust" },

  // 04070:A:1 (When Revealed): every enemy in the staging area engages the player with the highest threat; the first player chooses among tied players.
  "04070:whenRevealed:1 @0 PickHighestThreat": { note: "{card}: players are tied for the highest threat. Choose the player every enemy in the staging area engages." },

  // 04072:A:3 (Forced at the end of the combat phase, in the staging area) and 901502:A:2 (the same): each player assigns all 3 damage to 1 character he controls.
  "04072:forced:1 @0 AssignDamage": { owned: true, note: "{card} is in the staging area: choose 1 character you control to take all {left} damage. A hero or an ally, even one the damage destroys.", verb: "Assign" },
  "901502:forced:1 @0 AssignDamage": { owned: true, note: "{card} is in the staging area: choose 1 character you control to take all {left} damage. A hero or an ally, even one the damage destroys.", verb: "Assign" },

  // 04073:A:1 (Forced when it is attacked): on a match it attaches to an attacking character the first player chooses and the attack is over.
  "04073:forced:1 @1 Pick": { note: "{card} matched the discarded card: choose 1 of the attacking characters to carry it. Its Attack and Defense become 0 and the attack is over.", verb: "Attach" },
  // 04074:A:1 (Forced when it is attacked): on a match the attack's damage goes to 1 character of an attacking player, ignoring defense.
  "04074:forced:1 @1 Pick": { note: "{card} matched the discarded card: choose 1 of the attacking characters to take the attack's {n} damage, ignoring defense. It takes none itself.", verb: "Assign" },

  // 901501:A:3 (Forced when a Tentacle enemy is destroyed, Nightmare): 1 damage to The Watcher when it is in play.
  "901501:forced:1 @0 Pick": { note: "A Tentacle enemy was destroyed: The Watcher takes 1 damage, wherever it is in play. Choose The Watcher.", verb: "Assign" },

  // 901504:A:1 (Forced after it attacks, Nightmare): on a match it attaches to a character the defending player controls, the first player choosing. Each time that character readies it takes 1 damage.
  "901504:forced:1 @1 Pick": { note: "{card} matched the discarded card: choose a character the defending player controls to carry it. It takes 1 damage each time it readies.", verb: "Attach" },

  // 901507:A:2 (Shadow, Nightmare): the defending character with a Tentacle attachment is discarded from play.
  "901507:shadow:1 @0 Pick": { note: "{card}: the defending character carries a Tentacle attachment and is discarded from play, not destroyed. Choose it.", verb: "Discard" },

  // 901508:A:2 (When Revealed, Nightmare): the first player chooses X Tentacle enemies of the discard pile to shuffle into the encounter deck, X the players; then The Watcher is healed X damage.
  "901508:whenRevealed:1 @0.0 ShuffleIntoDeck": { bind: { x: { players: true } }, note: "{card}: choose a Tentacle enemy from the encounter discard pile to shuffle into the encounter deck. The first player picks {x} in all, as many as there are players.", verb: "Shuffle" },
  "901508:whenRevealed:1 @1 Pick": { note: "{card}: The Watcher is in play and is healed of as much damage as there are players. Choose The Watcher.", verb: "Heal" },
};
