import type { Condition } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";

// A Wizardry line resolved from a shadow card (Saruman's Forced effect, 143047:A:2) is resolved while Saruman is the attacking enemy: the defending player resolves it as the only player in the game.
const IN_SHADOW: Condition = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", names: ["Saruman"] } };

export const ASKS: Readonly<Record<string, Ask>> = {
  // 143020:A:2: the Palantír's Quest Action exhausted Aragorn and the Palantír and discarded the top encounter card; the optional part ("may") needs Aragorn's Willpower above that card's Threat. Controller-owned.
  "143020:action:1 @1 Choose": { note: "Palantír of Orthanc: You exhausted Aragorn and the Palantír, and discarded the top encounter card, and Aragorn's Willpower is greater than its Threat. You either use the Palantír for good or do nothing." },
  "143020:action:1 @1 use": { label: "Remove the Palantír from the campaign pool for good, then choose a player who reveals 1 fewer encounter card this phase" },
  "143020:action:1 @1 skip": { label: "Do nothing: the Palantír stays in the campaign pool, exhausted" },
  "143020:action:1 @1.use.2 Pick": { owned: true, note: "Palantír of Orthanc: choose the player who reveals 1 fewer encounter card this phase, to a minimum of 0. Their next reveal is skipped.", verb: "Choose player" },
  // 143046:A:1: any player's Quest Action; the hero exhausted is the triggering player's own, the top encounter card is discarded, and a resource goes on the Ent when the hero's Willpower beats its Threat (3 give the player control).
  "143046:action:1 @0 Pick": { owned: true, note: "Ent of Fangorn: choose a hero you control to exhaust. The top encounter card is discarded. If the hero's Willpower is greater than its Threat, the Ent gets 1 resource token; at 3 you take control of it.", verb: "Exhaust" },
  // 143051:A:2 (Isengard Orc is not Peril: the revealing player answers).
  "143051:whenRevealed:1 @0 Choose": { note: "Isengard Orc: You either discard 1 card at random from your hand, or reveal 1 additional encounter card." },
  "143051:whenRevealed:1 @0 discard": { label: "Discard 1 card at random from your hand" },
  "143051:whenRevealed:1 @0 reveal": { label: "Reveal 1 additional encounter card" },
  // 143052:A:1: dealt a shadow card with a Wizardry effect, the defending player chooses; with an empty hand only the attack is offered.
  "143052:forced:1 @0 Choose": { note: "Wolf of Isengard was dealt a shadow card with a Wizardry effect. You either discard 1 card from your hand, or the Wolf makes an additional attack against you after this one." },
  "143052:forced:1 @0 discard": { label: "Discard 1 card of your choice from your hand" },
  "143052:forced:1 @0 attack": { label: "Wolf of Isengard makes an additional attack against you after this one, dealt a new shadow card" },
  // 143053:A:2: the first player looked at the top 3 cards; the one chosen is revealed, then the others are discarded.
  "143053:forced:1 @1 PickEncounter": { owned: true, note: "Orthanc: choose 1 of the 3 encounter cards you looked at to reveal. Once it is resolved, the other cards you looked at are discarded.", verb: "Reveal" },
  // 143056:A:2 and 143057:A:1, 143057:A:2, 143058:A:3: the Wizardry locations; each player chooses their own.
  "143056:forced:2 @0.0 Pick": { owned: true, note: [{ when: IN_SHADOW, text: "Underground Armoury's Wizardry, from Saruman's shadow card: you resolve it as the only player. Exhaust 1 ready character you control." }, { text: "Underground Armoury, Wizardry: exhaust 1 ready character you control." }], verb: "Exhaust" },
  "143057:forced:1 @0 Pick": { owned: true, note: "Steaming Vent: choose a questing character you control to take 1 damage.", verb: "Assign" },
  "143057:forced:2 @0 AssignDamage": { note: [{ when: IN_SHADOW, text: "Steaming Vent's Wizardry, from Saruman's shadow card: you resolve it as the only player. Assign 2 damage among your characters." }, { text: "Steaming Vent, Wizardry: assign {x} damage among the characters in play." }], bind: { x: { players: true, plus: 1 } }, verb: "Assign" },
  "143058:forced:1 @0.0 Pick": { owned: true, note: [{ when: IN_SHADOW, text: "Plain of Isengard's Wizardry, from Saruman's shadow card: you resolve it as the only player. Discard 1 ally you control." }, { text: "Plain of Isengard, Wizardry: discard 1 ally you control." }], verb: "Discard" },
  "143060:whenRevealed:1 @0 AssignDamage": { note: "Blast of Sorcery: assign {x} damage among the characters committed to the quest, 1 more than the number of players.", bind: { x: { players: true, plus: 1 } }, verb: "Assign" },
  // 143068:A:2 (Peril, so the words speak to the player who reveals it): a hero committed to the quest, any player's; then its controller discards 1 card each time the hero commits, attacks, defends or triggers its ability.
  "143068:whenRevealed:1 @0 Pick": { owned: true, note: "Saruman's Voice: choose a hero committed to the quest, any player's. Remove it from the quest and attach Saruman's Voice to it. Its player discards 1 card each time it commits, attacks, defends or triggers its ability.", verb: "Attach" },
  "143068:forced:1 @0 DiscardFromHand": { note: "Saruman's Voice: the hero committed to the quest, so you discard 1 card from your hand.", verb: "Discard" },
  "143068:forced:2 @0 DiscardFromHand": { note: "Saruman's Voice: the hero was declared as an attacker, so you discard 1 card from your hand.", verb: "Discard" },
  "143068:forced:3 @0 DiscardFromHand": { note: "Saruman's Voice: the hero was declared as a defender, so you discard 1 card from your hand.", verb: "Discard" },
  "143068:forced:4 @0 DiscardFromHand": { note: "Saruman's Voice: the hero triggered its ability, so you discard 1 card from your hand.", verb: "Discard" },
  // 143078:B:2: at the end of the round a resource goes on the stage, then the players choose; advancing reveals 1 card for each resource token and sends the Ents in the staging area out of the game.
  "143078:forced:1 @1 Choose": { note: "Rouse the Ents now holds {tokens} resource tokens. The players either advance to stage 2A or stay on this stage." , bind: { tokens: { stat: "resources", of: "self" } } },
  "143078:forced:1 @1 advance": { label: "Advance to stage 2A, Breaking Isengard: shuffle the encounter discard pile into the encounter deck and reveal 1 encounter card for each resource token here. Each Ent of Fangorn still in the staging area leaves the game", bind: { tokens: { stat: "resources", of: "self" } } },
  "143078:forced:1 @1 stay": { label: "Stay on stage 1B: no card is revealed, the Ents stay, and the next token raises the cost of advancing" },
  // 143079:B:3: an Ent the player controls and has ready exhausts to place 2 progress on a non-unique location.
  "143079:action:1 @0 Pick": { owned: true, note: "Breaking Isengard: choose a ready Ent of Fangorn you control to exhaust.", verb: "Exhaust" },
  "143079:action:1 @2 Pick": { owned: true, note: "Breaking Isengard: choose a non-unique location, in the staging area or active, to place 2 progress on. Exploring it puts 1 damage on this stage.", verb: "Place" },
  // 143080:A:1: each player draws 6 cards, then discards down to 6.
  "143080:whenRevealed:1 @1.0 DiscardFromHand": { note: "The Voice of Saruman: discard {x} cards from your hand, down to 6.", bind: { x: { hand: true, plus: -6 } }, verb: "Discard" },
};
