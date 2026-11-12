import type { Amount } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";

// The choice words of The Black Gate Opens (the-return-of-the-king part 5), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-black-gate-opens --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-black-gate-opens` prints each sentence.
// What can lose the game says so on the row: Aragorn destroyed by the damage (mec113.multiplayer-aragorn: if he leaves play the players lose), and a threat raise that takes a player to 99 (the elimination level under Dire, mec113.dire), which ends the scenario when it is the last
// player: in Campaign Mode that end runs the campaign card's Resolution (the Black Gate's resources go to Mount Doom), standalone it is a loss. A pick for the whole table (the first player chooses) leads with the first player.
type When = NonNullable<Ask["caution"]>["when"];
const GATE_TOKENS: Amount = { stat: "resources", ofNamed: "The Black Gate" };
const CHARACTERS: Amount = { count: { type: "character", control: "you" } };
// The picked character is Aragorn, whose leaving play loses the game.
const ARAGORN: When = { kind: "matches", card: "picked", pick: { type: "hero", control: "any", names: ["Aragorn"] } };
// The picked character would be destroyed by `damage` more damage: its hit points are less than its damage plus that damage plus 1.
const DESTROYED_BY = (damage: number): When => ({ kind: "less", left: { stat: "hitPoints", of: "picked" }, right: { stat: "damage", of: "picked", plus: damage + 1 } });
const ARAGORN_DESTROYED_BY = (damage: number): When => ({ kind: "all", conditions: [ARAGORN, DESTROYED_BY(damage)] }) as When;
const LOSES_ARAGORN = "Tap again: {picked} is Aragorn and the damage destroys him, and the players lose the game";
// The raise takes the player to the elimination level, 99 under Dire: the end of the scenario when it is the last player.
const ELIMINATED = (raise: number): { when: When; text: NonNullable<Ask["caution"]>["text"] } => ({
  when: { kind: "threat", min: 99 - raise } as When,
  text: [
    { when: { kind: "inPlay", code: "146074", is: true } as When, text: "Tap again: this takes your threat to 99 and eliminates you. If you are the last player the scenario ends, and the {n} resources on The Black Gate go to Mount Doom" },
    { text: "Tap again: this takes your threat to 99 and eliminates you. If you are the last player, the game is lost" },
  ],
});

export const ASKS: Readonly<Record<string, Ask>> = {
  // 146026:A:2 (Forced, after it becomes the active location): each player in turn, the first player first, engages a non-unique enemy of the staging area.
  "146026:forced:1 @0.0 Pick": { owned: true, note: "Beleaguered Hills: choose a non-unique enemy in the staging area to engage. Each player engages one, the first player first.", verb: "Engage" },

  // 146029:A:1 (Forced, after it becomes the active location): the first player chooses for the group; the enemy lies under Reeking Moat until it leaves play (146029:A:2).
  "146029:forced:1 @0 Pick": { owned: true, note: "Reeking Moat: choose a non-unique enemy that is not a Nazgûl in the staging area. It lies under Reeking Moat, and engages the first player when it leaves play.", verb: "Place" },

  // 146034:A:2, 146035:A:2: the revealing player; 146037:A:2, 146037:A:3: each player in turn.
  "146034:whenRevealed:1 @0 Pick": { owned: true, note: "Easterling Bowman: choose a questing character you control to take 1 damage.", verb: "Assign", caution: { when: ARAGORN_DESTROYED_BY(1), text: LOSES_ARAGORN } },
  "146035:whenRevealed:1 @0 Pick": { owned: true, note: "Warrior of Rhûn: choose a questing character you control to remove from the quest.", verb: "Remove" },

  // 146036:A:2 (Hell-hawk): the revealing player searches for a Nazgûl or attaches Hell-hawk to one in play.
  "146036:whenRevealed:1 @0 Choose": { owned: true, note: "Hell-hawk: search for a Nazgûl enemy to add to the staging area, or attach Hell-hawk to a Nazgûl enemy in play." },
  "146036:whenRevealed:1 @0 search": { label: "Search the encounter deck, discard pile and victory display for a Nazgûl enemy" },
  "146036:whenRevealed:1 @0 attach": { label: "Attach Hell-hawk to a Nazgûl enemy in play" },
  "146036:whenRevealed:1 @0.search.0 SearchMove": { owned: true, note: "Hell-hawk: choose a Nazgûl enemy from the encounter deck, discard pile or victory display to add to the staging area.", verb: "Add" },
  "146036:whenRevealed:1 @0.attach.0 Pick": { owned: true, note: "Hell-hawk: choose the Nazgûl enemy it attaches to. It gets +2 Threat, Attack and Defense, and is immune to player card effects.", verb: "Attach" },

  // 146037:A:2, A:3 (The Hour of Doom): each player in turn, the first player first.
  "146037:whenRevealed:1 @0.0 Choose": { owned: true, note: "The Hour of Doom: raise your threat by 1 for each character you control, or discard the highest cost ally you control." },
  "146037:whenRevealed:1 @0.0 threat": { label: "Raise your threat by {n}, 1 for each character you control", bind: { n: CHARACTERS } },
  "146037:whenRevealed:1 @0.0 ally": { label: "Discard the highest cost ally you control" },
  "146037:whenRevealed:1 @0.0.ally.0 Pick": { owned: true, note: "The Hour of Doom: choose the highest cost ally you control to discard.", verb: "Discard" },
  "146037:shadow:1 @0 Pick": { owned: true, note: "The Hour of Doom shadow: choose a non-objective attachment you control to discard.", verb: "Discard" },

  // 146038:A:1 (Jaws of Steel): X is the resources on The Black Gate; each player assigns X damage among the characters they control, one at a time.
  "146038:whenRevealed:1 @0 AssignDamage": { owned: true, note: "Jaws of Steel: assign {x} damage in all, one at a time, to characters you control. X is the resources on The Black Gate.", bind: { x: GATE_TOKENS }, verb: "Assign", caution: { when: ARAGORN_DESTROYED_BY(1), text: LOSES_ARAGORN } },

  // 146039:A:2 (Rage Filled Him): the revealing player is attacked by The Mouth of Sauron, the only enemy the pick can name.
  "146039:whenRevealed:1 @0 Pick": { owned: true, note: "Rage Filled Him: The Mouth of Sauron attacks you. If it destroys a character, you raise your threat by 4.", verb: "Attack" },

  // 146040:A:1, A:2 (Onslaught of Mordor): each player in turn deals 1 damage; the shadow's enemy is the first player's choice.
  "146040:whenRevealed:1 @0.0 Pick": { owned: true, note: "Onslaught of Mordor: choose a questing character you control to take 1 damage. It gets -1 Willpower and cannot be healed this phase.", verb: "Assign", caution: { when: ARAGORN_DESTROYED_BY(1), text: LOSES_ARAGORN } },
  "146040:shadow:1 @0 Pick": { owned: true, note: "Onslaught of Mordor shadow: choose a non-unique enemy in the staging area. It engages the defending player and is dealt a shadow card.", verb: "Engage" },

  // 146041:A:2 (Gwaihir): the first player chooses for the group. Gwaihir joins the campaign pool only when the first player controls him at the end (146074:B:1).
  "146041:whenRevealed:1 @0 Choose": { owned: true, note: "Gwaihir: take control of him, or spend 1 Fellowship resource and discard him to discard a non-unique enemy in the staging area." },
  "146041:whenRevealed:1 @0 control": { label: "Take control of Gwaihir. He joins the campaign pool if you control him when the scenario ends" },
  "146041:whenRevealed:1 @0 discard": { label: "Spend 1 Fellowship resource: discard Gwaihir and a non-unique enemy in the staging area" },
  "146041:whenRevealed:1 @0.discard.0 SpendResources": { owned: true, note: "Gwaihir: choose the hero whose pool pays 1 Fellowship resource.", verb: "Pay" },
  "146041:whenRevealed:1 @0.discard.1 Pick": { owned: true, note: "Gwaihir: choose a non-unique enemy in the staging area to discard with him.", verb: "Discard" },

  // 146032:A:2 (Nazgûl of Mordor, Forced after it attacks): the defending player chooses.
  "146032:forced:1 @0 Choose": { owned: true, note: "Nazgûl of Mordor attacked you: raise your threat by 4, or return it to the staging area." },
  "146032:forced:1 @0 threat": { label: "Raise your threat by 4", bind: { n: GATE_TOKENS }, caution: ELIMINATED(4) },
  "146032:forced:1 @0 staging": { label: "Return Nazgûl of Mordor to the staging area" },

  // 146058:A:2, A:3, 146059:A:2 (the Orcs): the player the Orc engaged or attacked chooses.
  "146058:forced:1 @0 Pick": { owned: true, note: "Orc of Mordor: choose a character you control to exhaust.", verb: "Exhaust" },
  "146058:shadow:1 @0 Pick": { owned: true, note: "Orc of Mordor shadow: choose a character you control to exhaust.", verb: "Exhaust" },
  "146059:forced:1 @0 Pick": { owned: true, note: "Snaga Archer: choose one character you control to take 2 damage.", verb: "Assign", caution: { when: ARAGORN_DESTROYED_BY(2), text: LOSES_ARAGORN } },

  // 146072:B:1 (Embassy from the Dark Tower): the first player decides a tie for the next pair, then each pair in turn.
  "146072:whenRevealed:1 @1.0 Pick": { owned: true, note: "Embassy from the Dark Tower: two player cards have the highest cost. Choose the one to pair next.", verb: "Pair" },
  "146072:whenRevealed:1 @1.1 Pick": { owned: true, note: "Embassy from the Dark Tower: two encounter cards have the highest Threat. Choose the one that pairs with the player card.", verb: "Pair" },
  "146072:whenRevealed:1 @2.1 Choose": { owned: true, note: "Embassy: {pair}. Discard both cards, or reveal the encounter card and play the player card at no cost." },
  "146072:whenRevealed:1 @2.1 discard": { label: "Discard both cards of the pair" },
  "146072:whenRevealed:1 @2.1 play": { label: "Reveal the encounter card and play the player card at no cost" },

  // 146073:A:1 (The Battle of the Morannon): each player in turn, the first player first; a title another player took is not offered.
  "146073:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Morannon: add an Orc, Troll or Nazgûl enemy with a different title from the encounter deck or discard pile to the staging area.", verb: "Add" },
};
