import type { Effect } from "../../../catalog/boundary.ts";

// Authored records for player attacks: attack modifiers and targets, immediate attacks, attacks into the staging area (docs/plans/effect-authoring.md). A card's other lines may have records in pool/<pack>.ts.

const ENEMY = { type: "enemy", control: "any" } as const;
const IN_STAGING = { ...ENEMY, stagingOnly: true } as const;
const READY_RANGED = { type: "character", control: "you", keyword: "ranged", state: "ready" } as const;
// "a Weapon attached to that character", ready to be exhausted.
const READY_WEAPON = { type: "attachment", control: "any", trait: "Weapon", state: "ready", onSubject: true } as const;
// "another enemy that shares a Trait with the destroyed enemy", engaged or in the staging area.
const SHARES_TRAIT = { ...ENEMY, staging: true, sharesTrait: "other" } as const;
const host = (amount: number, when?: Extract<NonNullable<Effect["condition"]>, { kind: "attacking" }>) =>
  ({ verb: "ModifyStat", stat: "attack", amount, until: "whileSourceInPlay", target: "host", ...(when ? { when } : {}) }) as const;
const spend = (amount: number, sphere: "spirit" | "lore") => ({ verb: "SpendResources", amount, sphere, group: true }) as const;
const afford = (min: number, sphere: "spirit" | "lore") => ({ kind: "resources", min, sphere, group: true }) as const;

export const RECORDS: readonly Effect[] = [
  // Legolas, Blade of Gondolin: progress on the current quest after an attack that destroys an enemy.
  { id: "01005:response:1", cardCode: "01005", lines: ["01005:A:2"], timing: "response", trigger: "attackDestroyed", subject: "self", instructions: [{ verb: "QuestProgress", amount: 2 }] },
  { id: "01039:constant:2", cardCode: "01039", lines: ["01039:A:2"], timing: "constant", instructions: [host(1, { kind: "attacking", enemy: { ...ENEMY, trait: "Orc" } })] },
  { id: "01039:response:1", cardCode: "01039", lines: ["01039:A:3"], timing: "response", trigger: "attackDestroyed", subject: "host", instructions: [{ verb: "QuestProgress", amount: 1 }] },

  // Dúnhere: targets the staging area when he attacks alone, with +1 Attack doing so.
  {
    id: "01009:constant:1",
    cardCode: "01009",
    lines: ["01009:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "attacksStagingAlone", amount: 1, until: "whileSourceInPlay" },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", when: { kind: "attacking", enemy: IN_STAGING, alone: true } },
    ],
  },

  // Rain of Arrows: exhaust a ranged character (the cost, as the first instructions) to damage each enemy engaged with a player.
  {
    id: "01033:action:1",
    cardCode: "01033",
    lines: ["01033:A:1"],
    timing: "action",
    condition: { kind: "canPick", pick: READY_RANGED },
    instructions: [
      { verb: "Pick", pick: READY_RANGED },
      { verb: "Exhaust", target: { kind: "picked" } },
      { verb: "Pick", pick: { type: "player", control: "any" } },
      { verb: "Each", pick: { ...ENEMY, engagedWith: "picked" }, instructions: [{ verb: "DamageCard", amount: 1 }] },
    ],
  },

  // Brand son of Bain: an enemy engaged with another player destroyed, one of that player's characters readies.
  { id: "02072:response:1", cardCode: "02072", lines: ["02072:A:2"], timing: "response", trigger: "attackDestroyedEngaged", subject: "self", eventSeat: "other", instructions: [{ verb: "Pick", pick: { type: "character", control: "other" } }, { verb: "Ready", target: "picked" }] },

  // Vassal of the Windlord, Trollshaw Scout: after their attack.
  { id: "02098:forced:1", cardCode: "02098", lines: ["02098:A:2"], timing: "forced", trigger: "attacked", subject: "self", instructions: [{ verb: "Discard", target: { kind: "self" } }] },
  {
    id: "04104:forced:1",
    cardCode: "04104",
    lines: ["04104:A:3"],
    timing: "forced",
    trigger: "attacked",
    subject: "self",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "discardSelf", instructions: [{ verb: "Discard", target: { kind: "self" } }] },
          { id: "discardHand", requires: { kind: "handHasCard" }, instructions: [{ verb: "DiscardFromHand", amount: 1 }] },
        ],
      },
    ],
  },

  // Unseen Strike: the bonus is read each time the stat is, while attacking an enemy above the controller's threat.
  {
    id: "04004:action:1",
    cardCode: "04004",
    lines: ["04004:A:1"],
    timing: "action",
    condition: { kind: "canPick", pick: { type: "character", control: "you" } },
    instructions: [
      { verb: "Pick", pick: { type: "character", control: "you" } },
      { verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfPhase", target: "picked", when: { kind: "versusHighEngagement", role: "attacking" } },
    ],
  },

  // Rivendell Blade, Bard the Bowman: the enemy attacked loses Defense for the phase as the attack is declared.
  { id: "04031:triggered:1", cardCode: "04031", lines: ["04031:A:2"], timing: "triggered", trigger: "declaredAttacker", subject: "host", instructions: [{ verb: "ModifyStat", stat: "defense", amount: -2, until: "endOfPhase", target: "other" }] },
  { id: "132003:triggered:1", cardCode: "132003", lines: ["132003:A:2"], timing: "triggered", trigger: "declaredAttacker", subject: "self", condition: { kind: "attacking", ranged: true }, instructions: [{ verb: "ModifyStat", stat: "defense", amount: -2, until: "endOfPhase", target: "other" }] },

  // Rivendell Bow: +1 Attack in a ranged attack, for a host with the printed keyword.
  { id: "04057:constant:3", cardCode: "04057", lines: ["04057:A:3"], timing: "constant", condition: { kind: "matches", card: "host", pick: { type: "character", control: "any", printedKeyword: "ranged" } }, instructions: [host(1, { kind: "attacking", ranged: true })] },

  // Hands Upon the Bow: the exhausted ranged character attacks an enemy in the staging area, +1 Attack for that attack.
  {
    id: "04131:action:1",
    cardCode: "04131",
    lines: ["04131:A:1"],
    timing: "action",
    condition: { kind: "all", conditions: [{ kind: "canPick", pick: READY_RANGED }, { kind: "canPick", pick: IN_STAGING }] },
    instructions: [
      { verb: "Pick", pick: READY_RANGED },
      { verb: "Exhaust", target: { kind: "picked" } },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "picked" },
      { verb: "Pick", pick: IN_STAGING },
      { verb: "DeclareAttack", exhausted: true },
    ],
  },

  // Mighty Prowess, Azain Silverbeard: damage to another enemy sharing a Trait with the one destroyed.
  { id: "06035:response:1", cardCode: "06035", lines: ["06035:A:2"], timing: "response", trigger: "attackDestroyed", subject: "host", condition: { kind: "canPick", pick: SHARES_TRAIT }, instructions: [{ verb: "Pick", pick: SHARES_TRAIT }, { verb: "DamageCard", amount: 1 }] },
  { id: "12004:response:1", cardCode: "12004", lines: ["12004:A:1"], timing: "response", trigger: "attackDestroyed", subject: "self", anyPlayer: true, cost: { kind: "resources", amount: 1, sphere: "tactics" }, condition: { kind: "canPick", pick: SHARES_TRAIT }, instructions: [{ verb: "Pick", pick: SHARES_TRAIT }, { verb: "DamageCard", amount: 2 }] },

  // Ithilien Archer: the enemy it damaged returns to the staging area.
  { id: "06063:response:1", cardCode: "06063", lines: ["06063:A:2"], timing: "response", trigger: "attackDamaged", subject: "self", condition: { kind: "matches", card: "other", inPlay: true }, instructions: [{ verb: "ReturnToStaging", target: { kind: "other" } }] },

  // Knight of Minas Tirith: the Response it gains engages an enemy from the staging area and attacks it.
  {
    id: "06084:response:1",
    cardCode: "06084",
    lines: ["06084:A:1"],
    timing: "response",
    trigger: "enteredPlay",
    subject: "self",
    cost: { kind: "exhaustSelf" },
    condition: { kind: "all", conditions: [{ kind: "allMatch", of: { type: "hero", control: "you" }, match: { type: "hero", control: "you", printedIcon: "tactics" } }, { kind: "canPick", pick: IN_STAGING }] },
    instructions: [{ verb: "Pick", pick: IN_STAGING }, { verb: "Engage", target: "picked" }, { verb: "DeclareAttack", attacker: "self", exhausted: true }],
  },

  // Spear of the Mark, Bow of the Galadhrim, Ranger Spear: +1 Attack, +2 instead against some enemies.
  { id: "06137:constant:2", cardCode: "06137", lines: ["06137:A:3"], timing: "constant", instructions: [host(1), host(1, { kind: "attacking", enemy: IN_STAGING })] },
  { id: "08088:constant:2", cardCode: "08088", lines: ["08088:A:3"], timing: "constant", instructions: [host(1), host(1, { kind: "attacking", notEnemy: { ...ENEMY, engaged: "you" } })] },
  { id: "12145:constant:2", cardCode: "12145", lines: ["12145:A:2"], timing: "constant", instructions: [host(1), host(1, { kind: "attacking", enemy: { ...ENEMY, hasAttachment: {} } })] },

  // Forth Eorlingas!: each Rohan hero in play may attack the staging area this phase.
  { id: "06138:action:1", cardCode: "06138", lines: ["06138:A:1"], timing: "action", condition: { kind: "phase", is: "Combat" }, instructions: [{ verb: "ModifyStat", stat: "attacksStaging", amount: 1, until: "endOfPhase", holders: { type: "hero", control: "any", trait: "Rohan" } }] },

  // Haldir of Lórien: attacks an enemy not engaged with him, if his player engaged no enemy this round.
  {
    id: "08056:action:1",
    cardCode: "08056",
    lines: ["08056:A:2"],
    timing: "action",
    limit: "oncePerRound",
    cost: { kind: "exhaustSelf" },
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "engagedThisRound", is: false }, { kind: "canPick", pick: { ...ENEMY, staging: true, engagedWith: "notYou" } }] },
    instructions: [{ verb: "Pick", pick: { ...ENEMY, staging: true, engagedWith: "notYou" } }, { verb: "DeclareAttack", attacker: "self", exhausted: true }],
  },

  // Sword of Númenor: a resource after an attack destroys an enemy with 5 or more printed hit points.
  { id: "10142:response:1", cardCode: "10142", lines: ["10142:A:3"], timing: "response", trigger: "attackDestroyed", subject: "host", cost: { kind: "exhaustSelf" }, condition: { kind: "matches", card: "other", pick: { ...ENEMY, minHitPoints: 5 } }, instructions: [{ verb: "AddResources", amount: 1, to: "host" }] },

  // Mithlond Sea-watcher: +2 Attack and ranged while the top card of its player's discard pile is an ally.
  {
    id: "11003:constant:1",
    cardCode: "11003",
    lines: ["11003:A:1"],
    timing: "constant",
    condition: { kind: "count", pick: { type: "card", control: "you", from: "discard", cardType: "ally", topOfDiscard: true }, min: 1 },
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay" }, { verb: "ModifyStat", stat: "ranged", amount: 1, until: "whileSourceInPlay" }],
  },

  // Battle-fury: the exhausted hero attacks any enemy it could; then the group may pay 1 Spirit to commit it to the quest.
  {
    id: "12086:action:1",
    cardCode: "12086",
    lines: ["12086:A:2"],
    timing: "action",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "canPick", pick: { type: "hero", control: "you", state: "ready", canAttack: true } }] },
    instructions: [
      { verb: "Pick", pick: { type: "hero", control: "you", state: "ready", canAttack: true } },
      { verb: "Exhaust", target: { kind: "picked" } },
      { verb: "Pick", pick: { ...ENEMY, staging: true, attackableByPicked: true } },
      { verb: "DeclareAttack", exhausted: true },
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "commit", requires: afford(1, "spirit"), instructions: [spend(1, "spirit"), { verb: "Commit", target: "picked" }] },
          { id: "decline", instructions: [] },
        ],
      },
    ],
  },

  // Knife-work: -1 Defense to each enemy engaged with the chosen player; then the group may pay 2 Lore for that player's draws.
  {
    id: "12114:action:1",
    cardCode: "12114",
    lines: ["12114:A:1"],
    timing: "action",
    instructions: [
      { verb: "Pick", pick: { type: "player", control: "any" } },
      { verb: "ModifyStat", stat: "defense", amount: -1, until: "endOfPhase", holders: { ...ENEMY, engagedWith: "picked" } },
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "draw", requires: afford(2, "lore"), instructions: [{ verb: "ModifyStat", stat: "drawOnAttackDestroy", amount: 1, until: "endOfPhase", target: "pickedSeat" }, spend(2, "lore")] },
          { id: "decline", instructions: [] },
        ],
      },
    ],
  },

  // Foe-hammer, Swift and Strong: exhaust a Weapon on the character that attacked and destroyed an enemy.
  { id: "131015:response:1", cardCode: "131015", lines: ["131015:A:1"], timing: "response", trigger: "attackDestroyed", subject: { type: "hero", control: "you" }, cost: { kind: "playEvent" }, condition: { kind: "canPick", pick: READY_WEAPON }, instructions: [{ verb: "Pick", pick: READY_WEAPON }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "Draw", amount: 3 }] },
  {
    id: "19090:response:1",
    cardCode: "19090",
    lines: ["19090:A:1"],
    timing: "response",
    trigger: "attackDestroyed",
    subject: { type: "character", control: "you" },
    cost: { kind: "playEvent" },
    condition: { kind: "canPick", pick: READY_WEAPON },
    instructions: [
      { verb: "Pick", pick: READY_WEAPON },
      { verb: "Exhaust", target: { kind: "picked" } },
      { verb: "Ready", target: "subject" },
      { verb: "ModifyStat", stat: "nextAttackBonus", amount: 2, until: "endOfPhase", target: "subject" },
    ],
  },

  // Great Yew Bow: attaches to a hero with the printed Ranged keyword; a ranged attack on an enemy in the staging area.
  { id: "132014:constant:1", cardCode: "132014", lines: ["132014:A:1"], timing: "constant", instructions: [{ verb: "AttachesTo", hosts: [{ type: "hero", control: "any", printedKeyword: "ranged" }] }] },
  {
    id: "132014:action:1",
    cardCode: "132014",
    lines: ["132014:A:2"],
    timing: "action",
    cost: [{ kind: "exhaustSelf" }, { kind: "exhaustHost" }],
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "canPick", pick: IN_STAGING }] },
    instructions: [{ verb: "Pick", pick: IN_STAGING }, { verb: "DeclareAttack", attacker: "host", exhausted: true, ranged: true }],
  },

  // Skinbark, Mirkwood Runner: attacking alone (against an Orc), the enemy does not count its Defense.
  { id: "144006:constant:2", cardCode: "144006", lines: ["144006:A:2"], timing: "constant", condition: { kind: "attacking", alone: true, enemy: { ...ENEMY, trait: "Orc" } }, instructions: [{ verb: "ModifyStat", stat: "ignoresDefense", amount: 1, until: "whileSourceInPlay" }] },
  { id: "02123:constant:1", cardCode: "02123", lines: ["02123:A:1"], timing: "constant", condition: { kind: "attacking", alone: true }, instructions: [{ verb: "ModifyStat", stat: "ignoresDefense", amount: 1, until: "whileSourceInPlay" }] },

  // Roheryn: after an optional engagement, the attached hero attacks that enemy.
  { id: "145012:response:1", cardCode: "145012", lines: ["145012:A:3"], timing: "response", trigger: "optionallyEngaged", eventSeat: "you", cost: [{ kind: "exhaustSelf" }, { kind: "exhaustHost" }], instructions: [{ verb: "DeclareAttack", attacker: "host", enemy: "subject", exhausted: true }] },

  // Banner of Elendil: while Aragorn attacks, the other attacking characters of his player get +1 Attack.
  { id: "145013:constant:3", cardCode: "145013", lines: ["145013:A:3"], timing: "constant", condition: { kind: "matches", card: "host", pick: { type: "character", control: "any", attacking: true } }, instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "you", attacking: true, notHost: true } }] },

  // Éomer: after he commits to the quest, he attacks an enemy in the staging area (he must be ready to be declared).
  {
    id: "146003:response:1",
    cardCode: "146003",
    lines: ["146003:A:1"],
    timing: "response",
    trigger: "committed",
    subject: "self",
    cost: { kind: "resources", amount: 1, from: "self" },
    condition: { kind: "all", conditions: [{ kind: "matches", card: "self", pick: { type: "hero", control: "any", state: "ready" } }, { kind: "canPick", pick: IN_STAGING }] },
    instructions: [{ verb: "Pick", pick: IN_STAGING }, { verb: "DeclareAttack", attacker: "self" }],
  },

  // Gúthwinë, Haradrim Spear, Riddermark Knight: Attack for this attack, and what happens when it ends.
  {
    id: "146011:response:1",
    cardCode: "146011",
    lines: ["146011:A:2"],
    timing: "response",
    trigger: "declaredAttacker",
    subject: "host",
    cost: { kind: "exhaustSelf" },
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "host" },
      {
        verb: "Delay",
        until: "endOfAttack",
        instructions: [
          { verb: "Pick", pick: { type: "card", control: "you", from: "discard", cardType: "ally", trait: "Rohan" }, when: { kind: "matches", card: "other", inPlay: false } },
          { verb: "MovePicked", to: "hand", when: { kind: "matches", card: "other", inPlay: false } },
        ],
      },
    ],
  },
  { id: "17056:response:1", cardCode: "17056", lines: ["17056:A:3"], timing: "response", trigger: "declaredAttacker", subject: "host", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "host" }, { verb: "Delay", until: "endOfAttack", instructions: [{ verb: "Discard", target: { kind: "self" } }] }] },
  { id: "17112:response:1", cardCode: "17112", lines: ["17112:A:1"], timing: "response", trigger: "declaredAttacker", subject: "self", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack" }, { verb: "Delay", until: "endOfAttack", instructions: [{ verb: "Discard", target: { kind: "self" } }] }] },

  // Derufin: discarded, he lowers the threat of the player the destroyed enemy was engaged with by its printed Threat.
  { id: "21006:response:1", cardCode: "21006", lines: ["21006:A:3"], timing: "response", trigger: "attackDestroyedEngaged", subject: "self", cost: { kind: "discardSelf" }, instructions: [{ verb: "LowerThreat", amount: { stat: "threat", of: "other", printed: true }, who: "eventSeat" }] },

  // Charge into Battle: an attack against each non-unique enemy in the staging area, as if engaged with the player.
  { id: "22007:action:1", cardCode: "22007", lines: ["22007:A:2"], timing: "action", condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "canPick", pick: { ...IN_STAGING, nonUnique: true } }] }, instructions: [{ verb: "OfferAttacks", pick: { ...IN_STAGING, nonUnique: true } }] },

  // Dwarrowdelf Axe: after the attached character attacks, 1 damage to the enemy it attacked.
  { id: "03007:response:1", cardCode: "03007", lines: ["03007:A:4"], timing: "response", trigger: "attacked", subject: "host", instructions: [{ verb: "DamageCard", amount: 1, target: "other" }] },

  // Firefoot: attacking alone, the attack's excess damage goes to a non-unique enemy engaged with the player.
  {
    id: "08004:response:1",
    cardCode: "08004",
    lines: ["08004:A:3"],
    timing: "response",
    trigger: "declaredAttacker",
    subject: "host",
    cost: { kind: "exhaustSelf" },
    condition: { kind: "all", conditions: [{ kind: "attacking", card: "host", alone: true }, { kind: "canPick", pick: { ...ENEMY, engaged: "you", nonUnique: true } }] },
    instructions: [{ verb: "Pick", pick: { ...ENEMY, engaged: "you", nonUnique: true } }, { verb: "ExcessDamageTo" }],
  },
];

// Generated record ids an authored record here replaces.
export const REPLACES: readonly string[] = [];
