import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

import { withCopies } from "../reprint.ts";

// The Seventh Level Nightmare (deck 9011, data/printed/nightmare.json). The setup card sets Overseer Maurûl and Chamber of Records aside and, when stage 2B is revealed, makes the Chamber the active location, adds Maurûl to the staging area and shuffles every
// Balin's Doom in the discard pile back; side B is the recipe the build applies (its lines are inert). The cards put resources on Goblin enemies (the staging area and every player's engaged enemies) and read them.
// Rules: rr.forced, rr.active-location, rr.immune, rr.cancel, rr.damage, rr.victory, faq.simultaneous-effects, faq.progress-without-advancing, dwd.revealing-enemies (data/rules/entries.json); the readings are in docs/scenarios/dwarrowdelf.md (The Seventh Level).
const MAURUL = "901102";
const CHAMBER = "901103";
const FATE_OF_BALIN = "The Fate of Balin";
const GOBLIN_IN_PLAY: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Goblin" };
const GOBLIN_WITH_RESOURCE: PickSpec = { ...GOBLIN_IN_PLAY, hasResources: true };
const MOST_RESOURCES = { resourcesOn: GOBLIN_IN_PLAY, max: true } as const;
const ATTACKER_IS_GOBLIN: Condition = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Goblin" } };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([
  // 901101 setup card. A:2: Overseer Maurûl and Chamber of Records are set aside. A:3: when stage 2B is revealed (beside its own When Revealed) the Chamber becomes the active location without a Travel (the old active location returns to the staging area with its
  // progress), Maurûl joins the staging area, and every Balin's Doom in the discard pile is shuffled into the encounter deck, which is shuffled whether or not one was there.
  { id: "901101:setup:1", cardCode: "901101", lines: ["901101:A:2"], timing: "setup", instructions: [{ verb: "SetAsideFromDeck", code: MAURUL }, { verb: "SetAsideFromDeck", code: CHAMBER }] },
  {
    id: "901101:forced:1",
    cardCode: "901101",
    lines: ["901101:A:3"],
    timing: "forced",
    trigger: "stageRevealed",
    condition: { kind: "matches", card: "subject", pick: { type: "card", control: "any", names: [FATE_OF_BALIN] } },
    instructions: [{ verb: "MakeSetAsideActive", code: CHAMBER }, { verb: "AddSetAsideToStaging", code: MAURUL }, { verb: "ShuffleEncounterDiscard", name: "Balin's Doom" }],
  },

  // 901102 Overseer Maurûl: +X Threat, Attack and Defense, X the most resources on a Goblin enemy in play (he is no Goblin); the players cannot win unless he is in the victory display (a bar on the stage's advance).
  {
    id: "901102:constant:1",
    cardCode: MAURUL,
    lines: ["901102:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "threat", amount: MOST_RESOURCES, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "attack", amount: MOST_RESOURCES, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "defense", amount: MOST_RESOURCES, until: "whileSourceInPlay", target: "self" },
    ],
  },
  { id: "901102:constant:2", cardCode: MAURUL, lines: ["901102:A:2"], timing: "constant", condition: { kind: "inVictory", code: MAURUL, is: false }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 901103 Chamber of Records: each Goblin enemy with a resource is immune to player events; a Goblin that engages a player gets 2 resources.
  { id: "901103:constant:1", cardCode: CHAMBER, lines: ["901103:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerEvents", amount: 1, until: "whileSourceInPlay", holders: GOBLIN_WITH_RESOURCE }] },
  {
    id: "901103:forced:1",
    cardCode: CHAMBER,
    lines: ["901103:A:3"],
    timing: "forced",
    trigger: "engaged",
    subject: { type: "enemy", control: "any", trait: "Goblin" },
    instructions: [{ verb: "PlaceResourceTokens", amount: 2, on: "subject" }],
  },

  // 901104 Orc Taskmaster (When Revealed is the template): damage dealt to a Goblin with a resource costs it that resource and is canceled, whatever it would have destroyed (a Forced of each Taskmaster in play).
  {
    id: "901104:forced:1",
    cardCode: "901104",
    lines: ["901104:A:2"],
    timing: "forced",
    trigger: "damageDealt",
    subject: { type: "enemy", control: "any", staging: true, trait: "Goblin", hasResources: true },
    instructions: [{ verb: "RemoveResourceTokens", on: "subject", amount: 1 }, { verb: "CancelDamage", all: true }],
  },

  // 901105 Goblin Skirmisher: each Goblin enemy gets +1 Attack for each resource on it, once however many copies are in play. Shadow: X damage to the defending character, X the resources on the attacker.
  { id: "901105:constant:1", cardCode: "901105", lines: ["901105:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: GOBLIN_IN_PLAY, eachResource: true, doesNotStack: true }] },
  { id: "901105:shadow:1", cardCode: "901105", lines: ["901105:A:2"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: { stat: "resources", of: "attacker" }, target: "defender" }] },

  // 901106 Pit Goblin: 2 resources when revealed; its Shadow is Balin's Doom's.
  { id: "901106:whenRevealed:1", cardCode: "901106", lines: ["901106:A:1"], timing: "whenRevealed", instructions: [{ verb: "PlaceResourceTokens", amount: 2, on: "self" }] },
  // The Nightmare ledger is not among the ledgers the copies test reads, so the Shadow Balin's Doom prints too is written again.
  { id: "901106:shadow:1", cardCode: "901106", lines: ["901106:A:2"], timing: "shadow", instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "attacker", when: ATTACKER_IS_GOBLIN }] },

  // 901107 Deep-Mines: a Goblin that enters play while it is in the staging area gets 1 resource. Shadow: +1 Attack, and a Goblin attacker is dealt another shadow card.
  {
    id: "901107:forced:1",
    cardCode: "901107",
    lines: ["901107:A:1"],
    timing: "forced",
    trigger: "encounterEnteredPlay",
    subject: { type: "enemy", control: "any", staging: true, trait: "Goblin" },
    condition: { kind: "sourceIn", zone: "staging" },
    instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "subject" }],
  },
  {
    id: "901107:shadow:1",
    cardCode: "901107",
    lines: ["901107:A:2"],
    timing: "shadow",
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "DealShadowTo", target: "attacker", when: ATTACKER_IS_GOBLIN }],
  },

  // 901108 Western Hall (Travel is the template): each Goblin enemy gets +1 Threat for each resource on it, once however many copies are in play.
  { id: "901108:constant:1", cardCode: "901108", lines: ["901108:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: GOBLIN_IN_PLAY, eachResource: true, doesNotStack: true }] },

  // 901109 Balin's Doom (When Revealed is the template): the Shadow gives a Goblin attacker 1 resource.
  { id: "901109:shadow:1", cardCode: "901109", lines: ["901109:A:3"], timing: "shadow", instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "attacker", when: ATTACKER_IS_GOBLIN }] },

  // 901110 Beats and Echoes: X is 2 plus the players with no Goblin enemy engaged, counted before the reveals.
  {
    id: "901110:whenRevealed:1",
    cardCode: "901110",
    lines: ["901110:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "SetX", value: 2 },
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "AddToX", amount: 1, when: { kind: "count", pick: { type: "enemy", control: "any", engaged: "you", trait: "Goblin" }, max: 0 } }] },
      { verb: "RevealTopEnemies", count: { x: true } },
    ],
  },
]);

export const AUTHORED_REPLACES: readonly string[] = [];
