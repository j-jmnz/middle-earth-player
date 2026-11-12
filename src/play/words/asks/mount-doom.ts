import type { Amount } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";

// The choice words of Mount Doom (the-return-of-the-king part 6), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario mount-doom --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=mount-doom` prints each sentence. The Fortitude test's commit is a sheet of its own (src/play/readouts/fortitude.ts, fortitudeCommitNote).
// What can lose the game says so on the row: the hero carrying The One Ring destroyed or discarded (The One Ring leaving play loses, mec113.the-one-ring), and a threat raise that takes a player to 99 (the elimination level under Dire, mec113.dire), which loses the game for the last player.
// The Resolution's choice (146079:B:1) is worded on the Resolution screen (src/campaign/return-of-the-king-words.ts).
type When = NonNullable<Ask["caution"]>["when"];
const ALLIES: Amount = { count: { type: "ally", control: "you" } };
const QUESTING: Amount = { count: { type: "character", control: "you", committed: true } };
const HAND: Amount = { count: { type: "card", control: "you", from: "hand" } };
// The picked character carries The One Ring: its loss from play loses the game.
const CARRIES_RING: When = { kind: "matches", card: "picked", pick: { type: "character", control: "any", hasAttachment: { names: ["The One Ring"] } } };
// The picked character would be destroyed by `damage` more damage: its hit points are less than its damage plus that damage plus 1.
const DESTROYED_BY = (damage: number): When => ({ kind: "less", left: { stat: "hitPoints", of: "picked" }, right: { stat: "damage", of: "picked", plus: damage + 1 } });
const RING_DESTROYED_BY = (damage: number): When => ({ kind: "all", conditions: [CARRIES_RING, DESTROYED_BY(damage)] }) as When;
// The raise takes the player to the elimination level, 99 under Dire or more: `raise` is a number or an amount read now.
const ELIMINATED = (raise: number | Amount): { when: When; text: string } => ({
  // Threat plus the raise is 99 or more: 98 less the threat is less than the raise.
  when: (typeof raise === "number" ? { kind: "threat", min: 99 - raise } : { kind: "less", left: { threat: "actor", times: -1, plus: 98 }, right: raise }) as When,
  text: "Tap again: this takes your threat to 99 or more and eliminates you. If you are the last player, the game is lost",
});

export const ASKS: Readonly<Record<string, Ask>> = {
  // 146047:A:2 (Forced, after it becomes the active location, at Setup): each player assigns X damage, X the tens digit of their own threat, among the characters they control.
  "146047:forced:1 @0 AssignDamage": { owned: true, note: "Brake of Thorns: assign {x} damage, 1 at a time, to characters you control: the tens digit of your threat.", bind: { x: { threat: "tens" } }, verb: "Assign", caution: { when: RING_DESTROYED_BY(1), text: "Tap again: the damage destroys {picked}, which carries The One Ring, and the players lose the game" } },

  // 146048:A:2 (Travel): each player in turn, the first player first; a player with no ready hero cannot pay, so the players cannot travel.
  "146048:travel:1 @0.0 Pick": { owned: true, note: "Old Water-course: choose a ready hero you control to exhaust. All players pay to travel here.", verb: "Exhaust" },

  // 146049:A:3 (Forced, after Gollum is discarded during a Fortitude test): the first player chooses an encounter card discarded for the test; its Sauron's Eye icons are not counted.
  "146049:forced:3 @1 Pick": { owned: true, note: "Gollum: choose a card discarded for this Fortitude test. Its Sauron's Eye icons are not counted.", verb: "Ignore" },

  // 146052:A:2: the player Big Uruk engaged chooses.
  "146052:forced:1 @0 Choose": { owned: true, note: "Big Uruk engaged you: raise your threat by 4, or it makes an immediate attack against you." },
  "146052:forced:1 @0 threat": { label: "Raise your threat by 4", caution: ELIMINATED(4) },
  "146052:forced:1 @0 attack": { label: "Big Uruk makes an immediate attack against you" },

  // 146053:A:2 and A:3: the revealing player; the defending player for the shadow.
  "146053:whenRevealed:1 @0 Choose": { owned: true, note: "Little Snuffler: raise your threat by 1 for each ally you control, or discard an ally you control." },
  "146053:whenRevealed:1 @0 threat": { label: "Raise your threat by {n}, 1 for each ally you control", bind: { n: ALLIES }, caution: ELIMINATED(ALLIES) },
  "146053:whenRevealed:1 @0 discard": { label: "Discard an ally you control" },
  "146053:whenRevealed:1 @0.discard.0 Pick": { owned: true, note: "Little Snuffler: choose an ally you control to discard.", verb: "Discard" },
  "146053:shadow:1 @0 Pick": { owned: true, note: "Little Snuffler shadow: choose a character you control to exhaust.", verb: "Exhaust" },

  // 146054:A:1: Gollum attacks the first player, then is fetched when he is not in play.
  "146054:whenRevealed:1 @0 Pick": { note: "Gollum makes an immediate attack against the first player ('Wicked Master!').", verb: "Attack" },
  "146054:whenRevealed:1 @2 SearchMove": { owned: true, note: "'Wicked Master!': Gollum is not in play. Choose him from the encounter deck or discard pile to put into play engaged with the first player.", verb: "Add" },

  // 146057:A:1: the first player chooses among the heroes tied for the most attachments.
  "146057:whenRevealed:1 @0 AttachSelf": { owned: true, note: "Heavy and Tired attaches to the hero with the most attachments, which is exhausted and cannot commit to Fortitude tests. Choose among the tied heroes.", verb: "Attach" },

  // 146061, 146062, 146063 (Deep Shadows): the first player chooses for the table (146061:A:1); each player in turn (146062:A:2, 146063:A:1).
  "146061:shadow:1 @0 Pick": { owned: true, note: "Drawn to the Ring shadow: choose a non-objective attachment you control to discard.", verb: "Discard" },
  "146061:whenRevealed:1 @0 Choose": { owned: true, note: "Drawn to the Ring: exhaust The One Ring and reveal an encounter card, or engage the next enemy of the encounter deck." },
  "146061:whenRevealed:1 @0 ring": { label: "Exhaust The One Ring, then reveal an encounter card" },
  "146061:whenRevealed:1 @0 enemy": { label: "Discard cards from the encounter deck until an enemy is discarded, then it engages you" },
  "146062:whenRevealed:1 @0.0 Choose": { owned: true, note: "Deep Shadows: discard your hand, or reveal an encounter card." },
  "146062:whenRevealed:1 @0.0 discard": { label: "Discard your hand ({n} cards)", bind: { n: HAND } },
  "146062:whenRevealed:1 @0.0 reveal": { label: "Reveal an encounter card" },
  "146063:whenRevealed:1 @0.0 Choose": { owned: true, note: "Evil Vigilance: discard a questing character you control, or raise your threat by 1 for each one." },
  "146063:whenRevealed:1 @0.0 discard": { label: "Discard a questing character you control" },
  "146063:whenRevealed:1 @0.0 threat": { label: "Raise your threat by {n}, 1 for each questing character you control", bind: { n: QUESTING }, caution: ELIMINATED(QUESTING) },
  "146063:whenRevealed:1 @0.0.discard.0 Pick": { owned: true, note: "Evil Vigilance: choose a questing character you control to discard.", verb: "Discard", caution: { when: CARRIES_RING, text: "Tap again: {picked} carries The One Ring, which leaves play when it is discarded, and the players lose the game" } },

  // 146075:A:1 (Setup): each player in turn, the first player first, searches for a different location; 146076:A:1: the first player searches for Mordor Road.
  "146075:setup:1 @0.0 SearchMove": { owned: true, note: "Mount Doom Setup: choose a location from the encounter deck or discard pile to add to the staging area. A different one for each player.", verb: "Add" },
  "146076:whenRevealed:1 @0 SearchMove": { owned: true, note: "Choose Mordor Road from the encounter deck, discard pile or victory display to add to the staging area. The players then travel to it if no location is active.", verb: "Add" },
};
