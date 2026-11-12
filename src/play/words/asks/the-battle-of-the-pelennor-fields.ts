import type { Amount } from "../../../catalog/boundary.ts";
import type { Ask, Text } from "../asks.ts";

// The choice words of The Battle of the Pelennor Fields (the-return-of-the-king part 3), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-battle-of-the-pelennor-fields --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-battle-of-the-pelennor-fields` prints each sentence.
// Minas Tirith's damage and hit points are read from the card (`ofNamed`) when the sheet opens. A row that deals damage to it warns when the damage reaches what destroys it (`minasTirithLeft`: its hit points less its damage, plus what the active City Wall can still take
// first, 145046:A:1), since the players lose the game then (145043:A:2): a City Wall in the staging area shields nothing, and damage beyond the Wall's room still counts.
const CITY_DAMAGE: Amount = { stat: "damage", ofNamed: "Minas Tirith" };
const CITY_HIT_POINTS: Amount = { stat: "hitPoints", ofNamed: "Minas Tirith" };
const CITY_FALLS = (damage: number): NonNullable<Ask["caution"]> => ({
  when: { kind: "less", left: { minasTirithLeft: true, plus: -1 }, right: damage },
  text: "Tap again: Minas Tirith is destroyed and the players lose the game",
});
const CITY_BIND = { held: CITY_DAMAGE, total: CITY_HIT_POINTS } as const;
// A row that deals `n` damage to Minas Tirith: what it holds, and that the active City Wall takes it first (the flag `damageFirst` on Minas Tirith is in force only then, 145046:A:1).
const CITY_ROW = (n: number): Text => [
  { when: { kind: "namedFlag", name: "Minas Tirith", stat: "damageFirst" }, text: `Deal ${n} damage to Minas Tirith ({held} damage of its {total} hit points): City Wall takes it first` },
  { text: `Deal ${n} damage to Minas Tirith ({held} damage of its {total} hit points)` },
];
const STAGED_ENEMIES: Amount = { count: { type: "enemy", control: "any", stagingOnly: true } };

export const ASKS: Readonly<Record<string, Ask>> = {
  // 145044:A:4 (Travel): each player in turn, the first player first, is attacked by The Witch-king when he is in play.
  "145044:travel:1 @0.0 Pick": { owned: true, note: "Grond: The Witch-king, in play, makes an immediate attack against you, from the staging area or as he is engaged. Tap The Witch-king to begin it.", verb: "Attack" },

  // 145052:A:1: the defending player (the first player for an attack from the staging area) chooses after a blank shadow card.
  "145052:forced:1 @0 Choose": { owned: true, note: "Southron Champion's shadow card is blank: deal 3 damage to Minas Tirith, or it attacks you again after this attack." },
  "145052:forced:1 @0 city": { label: CITY_ROW(3), bind: CITY_BIND, caution: CITY_FALLS(3) },
  "145052:forced:1 @0 attack": { label: "It attacks you again after this attack, dealt a new shadow card" },

  // 145054:A:2 (Peril): the revealing player chooses alone.
  "145054:whenRevealed:1 @0 Choose": { owned: true, note: "Orc of the Eye: deal 2 damage to a hero you control, or 2 damage to Minas Tirith." },
  "145054:whenRevealed:1 @0 hero": { label: "Deal 2 damage to a hero you control" },
  "145054:whenRevealed:1 @0 city": { label: CITY_ROW(2), bind: CITY_BIND, caution: CITY_FALLS(2) },
  "145054:whenRevealed:1 @0.hero.0 Pick": { owned: true, note: "Orc of the Eye: choose a hero you control to take 2 damage.", verb: "Assign" },

  // 145056:A:1 (each player in turn, the first player first) and A:2 (the defending player).
  "145056:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "The Rammas is Breached: search the encounter deck and discard pile for an enemy. It enters play engaged with you.", verb: "Engage" },
  "145056:shadow:1 @0 Choose": { owned: true, note: "The Rammas is Breached: deal 3 damage to Minas Tirith, or the attacking enemy makes an additional attack against you after this one." },
  "145056:shadow:1 @0 city": { label: CITY_ROW(3), bind: CITY_BIND, caution: CITY_FALLS(3) },
  "145056:shadow:1 @0 attack": { label: "The attacking enemy attacks you again after this attack, dealt a new shadow card" },

  // 145057:A:2: the revealing player attaches Fell Beast to a Nazgûl enemy in play (the staging area or engaged, any player's).
  "145057:whenRevealed:1 @0 Pick": { owned: true, note: "Fell Beast: choose a Nazgûl enemy in play to attach it to. The enemy gets +1 Threat, +1 Attack, +1 Defense and -10 engagement cost.", verb: "Attach" },

  // 145058:A:1: the revealing player removes a hero they control from the quest and attaches Black Dart to it.
  "145058:whenRevealed:1 @0 Pick": { owned: true, note: "Black Dart: choose a hero you control to remove from the quest. It takes 1 damage at the end of each round.", verb: "Remove" },

  // 145059:A:1: the revealing player chooses alone; every player's exhausted characters count.
  "145059:whenRevealed:1 @0 Choose": { owned: true, note: "Spells of Ruin: deal 1 damage to each exhausted character in play, any player's, or 5 damage to Minas Tirith." },
  "145059:whenRevealed:1 @0 exhausted": { label: "Deal 1 damage to each exhausted character in play ({n} now)", bind: { n: { count: { type: "character", control: "any", state: "exhausted" } } } },
  "145059:whenRevealed:1 @0 city": { label: CITY_ROW(5), bind: CITY_BIND, caution: CITY_FALLS(5) },

  // 145060:A:2 and A:3: the revealing player discards an ally; the defending player discards an attachment.
  "145060:whenRevealed:1 @0 Pick": { owned: true, note: "Dread and Despair: choose an ally you control to discard. The staging area's Threat rises by 1 for each ally in your discard pile until the end of the phase.", verb: "Discard" },
  "145060:shadow:1 @0 Pick": { owned: true, note: "Dread and Despair shadow: choose a non-objective attachment you control to discard.", verb: "Discard" },

  // 145061:A:2: each player in turn, the first player first, damages a hero they control.
  "145061:whenRevealed:1 @0.0 Pick": { owned: true, note: "Shadow of Mordor: choose a hero you control to take 1 damage. Its text box is blank until the end of the round.", verb: "Assign" },

  // 145073:A:1 (Setup): the first player may attach each Esquire, set aside, to a hero of any seat; an Esquire still attached when the scenario is won is earned for that hero's controller (145078:B:2).
  "145073:setup:1 @0 Choose": { owned: true, note: "The Garrison of Gondor: attach Esquire of Rohan to a hero, any player's? If it is still attached when you win, that hero's controller earns it." },
  "145073:setup:1 @0 rohan": { label: "Attach Esquire of Rohan to a hero: the hero gains the Rohan trait and +1 Attack while attacking with another Rohan character" },
  "145073:setup:1 @0 none": { label: "Don't attach Esquire of Rohan" },
  "145073:setup:1 @0.rohan.0 Pick": { owned: true, note: "The Garrison of Gondor: choose the hero, any player's, who carries Esquire of Rohan. Its controller earns it if it is still attached when you win.", verb: "Attach" },
  "145073:setup:1 @1 Choose": { owned: true, note: "The Garrison of Gondor: attach Esquire of Gondor to a different hero, any player's? If it is still attached when you win, that hero's controller earns it." },
  "145073:setup:1 @1 gondor": { label: "Attach Esquire of Gondor to a hero: the hero gains the Gondor trait and +1 Willpower while committed to the quest with another Gondor character" },
  "145073:setup:1 @1 none": { label: "Don't attach Esquire of Gondor" },
  "145073:setup:1 @1.gondor.0 Pick": { owned: true, note: "The Garrison of Gondor: choose a hero without Esquire of Rohan to carry Esquire of Gondor. Its controller earns it if it is still attached when you win.", verb: "Attach" },

  // 145074:B:3: at the end of the round the first player assigns the damage among the allies in the staging area, one at a time, any player's.
  "145074:forced:1 @0 AssignDamage": { owned: true, note: "Retreat from Osgiliath: assign {x} damage, 1 for each enemy in the staging area, among the allies there. A destroyed ally goes to its owner's discard pile.", bind: { x: STAGED_ENEMIES }, verb: "Assign" },

  // 145075:A:1: each player but the first, in turn, searches for a different enemy and adds it to the staging area.
  "145075:whenRevealed:1 @4.0 SearchMove": { owned: true, note: "The White City Besieged: search the encounter deck and discard pile for an enemy different from the others taken. Add it to the staging area.", verb: "Add" },

  // 145076:A:1: each player puts an ally of a sphere of a hero they control from the top 10 cards of their deck into play; 145076:B:1: the first player assigns the questing progress as damage among the enemies in play.
  "145076:whenRevealed:1 @1.0 Pick": { owned: true, note: "Rohan has Come!: choose an ally among your top 10 cards that matches the sphere of a hero you control. Put it into play.", verb: "Play" },
  "145076:triggered:1 @0 AssignDamage": { owned: true, note: "Rohan has Come!: assign {x} damage, 1 for each progress the quest placed, among the enemies in play. The stage takes no progress.", bind: { x: { x: true } }, verb: "Assign" },
};
