import type { Effect, PickSpec } from "../../catalog/boundary.ts";

// Records for Raid on the Grey Havens (Dream-chaser part 3, campaign card 11182): the two quest stages, The Havens Burn, the Dream-chaser location, the Raid on the Grey Havens and Corsair Raiders
// encounter cards, the enemy and objective ally sides of Captain Sahír and Na'asiyah (The Stormcaller Elite), Graxar, and the campaign card. Black Key, Galdor's Counsel, Parrying Cutlass and
// Throwing Axe, which the campaign card places, are in pool/DCCE.ts. Every line is read from the scan ledger (data/printed/dream-chaser.json).
// Rules: dcce.aflame, dcce.stormcaller-elite, dcce.last-player, dcce.setup-raid-on-the-grey-havens, dcce.campaign-setup-raid-on-the-grey-havens, dcce.gaining-xp, dcce.scalable-upgradable,
// dcce.encounter-cards, dcce.naasiyah, rr.search, rr.first-player (data/rules/entries.json).
// The Aflame locations in play, and the one with the lowest Aflame value (the first player chooses among those tied).
const AFLAME: PickSpec = { type: "location", control: "any", aflame: true };
const LOWEST_AFLAME: PickSpec = { ...AFLAME, lowestAflame: true, who: "firstPlayer" };
// An enemy in play with a Trait (in the staging area or engaged).
const RAIDER: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Raider" };
const CORSAIR = { type: "enemy", control: "any", staging: true, trait: "Corsair" } as const;
const ELITE = ["Captain Sahír", "Na'asiyah"] as const;
const DREAM_CHASER: PickSpec = { type: "location", control: "any", names: ["Dream-chaser"] };
// The attacking enemy (a shadow effect's) and the Raider condition on it.
const ATTACKER_PICK: PickSpec = { type: "enemy", control: "any", attackingEnemy: true };
const RAIDER_ATTACKS = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Raider" } } as const;
const ACTIVE_AFLAME = { kind: "matches", card: "activeLocation", pick: AFLAME } as const;
const A_HERO_WITH_RESOURCES: PickSpec = { type: "hero", control: "you", hasResources: true };
const STAGING_LOCATION: PickSpec = { type: "location", control: "any", stagingOnly: true };

// "Forced: When X is placed underneath The Havens Burn, ..." heard by the destroyed Aflame location itself, from where it went.
const placedUnder = (code: string, line: string, id: number, instructions: Effect["instructions"]): Effect => ({ id: `${code}:forced:${id}`, cardCode: code, lines: [line], timing: "forced", trigger: "placedUnder", subject: "self", instructions });

// "Move 1 resource from one of your heroes' pools to ~" (11064:A:2, 11065:A:2): the player's choice of a hero with a resource; nothing happens with none.
const takesAHeroResource: Effect["instructions"] = [
  { verb: "Pick", pick: A_HERO_WITH_RESOURCES },
  { verb: "DiscardResources", amount: 1, target: "picked" },
  { verb: "PlaceResourceTokens", amount: 1, on: "self" },
];

// "If ~ leaves play, the players lose" (the objective ally sides of the Stormcaller Elite).
const losesWhenLeaving = (code: string, line: string): Effect => ({ id: `${code}:triggered:1`, cardCode: code, lines: [line], timing: "triggered", trigger: "leftPlay", subject: "self", instructions: [{ verb: "LoseGame" }] });

// "Action: Spend 1 resource from a hero you control to place 1 resource on ~. (Limit once per round.)" (the objective ally sides).
const resourceFromHero = (code: string, line: string): Effect => ({
  id: `${code}:action:1`,
  cardCode: code,
  lines: [line],
  timing: "action",
  limit: "oncePerRound",
  condition: { kind: "canPick", pick: A_HERO_WITH_RESOURCES },
  instructions: takesAHeroResource,
});

// "When Na'asiyah attacks or defends, she gets +1 Attack and +1 Defense for this attack for each resource on her" (11078:A:3): read when the attack begins and kept until it ends.
const NAASIYAH_STATS: Effect["instructions"] = [
  { verb: "ModifyStat", stat: "attack", amount: { stat: "resources", of: "self" }, until: "endOfAttack", target: "self" },
  { verb: "ModifyStat", stat: "defense", amount: { stat: "resources", of: "self" }, until: "endOfAttack", target: "self" },
];
const naasiyahBonus = (): Effect => ({
  id: "11078:forced:4",
  cardCode: "11078",
  lines: ["11078:A:3"],
  timing: "forced",
  trigger: "enemyAttacked",
  subject: "self",
  instructions: [...NAASIYAH_STATS, { verb: "Delay", until: "endOfAttack", instructions: [{ verb: "DiscardResources", amount: 1, target: "self" }] }],
});

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 11036 The Corsairs' Assault. Setup: Captain Sahír and Na'asiyah are set aside and The Havens Burn, the Dream-chaser and a Sahír's Ravager are added to the staging area by the scenario's piles;
  // the encounter deck is shuffled, cards are discarded until one Aflame location for each player is, each goes to the staging area, and the discard pile is shuffled back. Side B: Forced: at the end of the combat
  // phase, the Aflame location with the lowest Aflame value takes damage for each Corsair enemy in play.
  {
    id: "11036:setup:1",
    cardCode: "11036",
    lines: ["11036:A:1"],
    timing: "setup",
    instructions: [{ verb: "ShuffleEncounterDeck" }, { verb: "DiscardUntilAflame", perPlayer: 1 }, { verb: "ShuffleEncounterDiscard" }],
  },
  {
    id: "11036:forced:1",
    cardCode: "11036",
    lines: ["11036:B:1"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "phase", is: "Combat" },
    instructions: [{ verb: "Pick", pick: LOWEST_AFLAME }, { verb: "DamageCard", amount: { count: CORSAIR }, target: "picked" }],
  },

  // 11037 Sahír's Advance. When Revealed: Na'asiyah and Captain Sahír join the staging area on their enemy sides, each player reveals the top card of the encounter deck, both get resources equal to the damage on
  // the Dream-chaser, and each other Raider enemy gets 1. Side B: progress on the quest removes damage from locations instead (the stage hears the amount); a Raider revealed by the encounter deck enters play with
  // 1 resource (not while side A's When Revealed is resolving); Captain Sahír in the victory display and no damage on any location wins.
  {
    id: "11037:whenRevealed:1",
    cardCode: "11037",
    lines: ["11037:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "StageSetAside", code: "11078" },
      { verb: "StageSetAside", code: "11076" },
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] },
      { verb: "Each", pick: { type: "enemy", control: "any", staging: true, names: [...ELITE] }, instructions: [{ verb: "PlaceResourceTokens", amount: { stat: "damage", ofNamed: "Dream-chaser" }, on: "picked" }] },
      { verb: "Each", pick: { ...RAIDER, exceptNames: [...ELITE] }, instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "picked" }] },
    ],
  },
  { id: "11037:constant:1", cardCode: "11037", lines: ["11037:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "progressHeals", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "11037:triggered:1", cardCode: "11037", lines: ["11037:B:1"], timing: "triggered", trigger: "progressReplaced", instructions: [{ verb: "HealLocations", amount: { x: true } }] },
  {
    id: "11037:forced:1",
    cardCode: "11037",
    lines: ["11037:B:2"],
    timing: "forced",
    trigger: "revealed",
    byEncounterDeck: true,
    subject: RAIDER,
    condition: { kind: "not", condition: { kind: "revealing" } },
    instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "subject" }],
  },
  {
    id: "11037:constant:2",
    cardCode: "11037",
    lines: ["11037:B:3"],
    timing: "constant",
    condition: { kind: "all", conditions: [{ kind: "inVictory", code: "11076", is: true }, { kind: "count", pick: { type: "location", control: "any", damaged: true }, max: 0 }] },
    instructions: [{ verb: "WinGame" }],
  },

  // 11038 The Havens Burn. Forced: when a card is placed underneath it, the top card of the encounter deck is revealed; with 3 more cards than players underneath, the players lose.
  { id: "11038:forced:1", cardCode: "11038", lines: ["11038:A:1"], timing: "forced", trigger: "placedUnder", subject: { type: "location", control: "any" }, instructions: [{ verb: "RevealEncounter" }] },
  {
    id: "11038:triggered:1",
    cardCode: "11038",
    lines: ["11038:A:2"],
    timing: "triggered",
    trigger: "placedUnder",
    subject: { type: "location", control: "any" },
    condition: { kind: "underBurn", min: 3, players: true },
    instructions: [{ verb: "LoseGame", reason: "The Corsairs have destroyed the Elven fleet" }],
  },

  // 11039 Dream-chaser (the location; Aflame 12 and Immune to player card effects are keywords). The players cannot travel to it; the players lose when it is placed underneath The Havens Burn.
  { id: "11039:constant:1", cardCode: "11039", lines: ["11039:A:3"], timing: "constant", instructions: [{ verb: "Restrict", what: "travel" }] },
  { id: "11039:triggered:1", cardCode: "11039", lines: ["11039:A:4"], timing: "triggered", trigger: "placedUnder", subject: "self", instructions: [{ verb: "LoseGame", reason: "The Dream-chaser was placed underneath The Havens Burn" }] },

  // 11040 Corsair Arsonist. When Revealed: the first player has it either deal 2 damage to an Aflame location in play, or search for the Aflame location with the highest Aflame value.
  {
    id: "11040:whenRevealed:1",
    cardCode: "11040",
    lines: ["11040:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "damage", requires: { kind: "canPick", pick: AFLAME }, instructions: [{ verb: "Pick", pick: { ...AFLAME, who: "firstPlayer" } }, { verb: "DamageCard", amount: 2, target: "picked" }] },
          { id: "search", instructions: [{ verb: "SearchAflame" }] },
        ],
      },
    ],
  },

  // 11041 Sahír's Ravager. Forced: after it attacks, 1 resource is placed on it, then the Aflame location with the lowest Aflame value takes damage equal to its resources.
  {
    id: "11041:forced:1",
    cardCode: "11041",
    lines: ["11041:A:1"],
    timing: "forced",
    trigger: "attackResolved",
    subject: "self",
    instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }, { verb: "Pick", pick: LOWEST_AFLAME }, { verb: "DamageCard", amount: { stat: "resources", of: "self" }, target: "picked" }],
  },

  // 11042 Mithlond Harbor (Surge is a keyword). In the staging area no progress can be placed on the locations there. Shadow: the attacking enemy gets +1 Attack for each damage on the active location.
  {
    id: "11042:constant:1",
    cardCode: "11042",
    lines: ["11042:A:2"],
    timing: "constant",
    condition: { kind: "sourceIn", zone: "staging" },
    instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", holders: STAGING_LOCATION }],
  },
  {
    id: "11042:shadow:1",
    cardCode: "11042",
    lines: ["11042:A:3"],
    timing: "shadow",
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stat: "damage", of: "activeLocation" }, until: "endOfAttack", target: "attacker" }],
  },

  // 11043 Burning Piers (Aflame 5 is a keyword). +1 Threat for each damage on it. Forced: when placed underneath The Havens Burn, 3 damage to the Dream-chaser. Shadow: it is added to the staging area.
  { id: "11043:constant:1", cardCode: "11043", lines: ["11043:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { stat: "damage", of: "self" }, until: "whileSourceInPlay", target: "self" }] },
  placedUnder("11043", "11043:A:3", 1, [{ verb: "Pick", pick: DREAM_CHASER }, { verb: "DamageCard", amount: 3, target: "picked" }]),
  { id: "11043:shadow:1", cardCode: "11043", lines: ["11043:A:4"], timing: "shadow", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "staging" }] },

  // 11044 Pillaged Ship (Aflame 5 is a keyword). When Revealed: either 3 damage to it, or the topmost enemy in the encounter discard pile joins the staging area (the first player chooses). Shadow: against a
  // Raider, all resources move from the defending character to the attacking enemy.
  {
    id: "11044:whenRevealed:1",
    cardCode: "11044",
    lines: ["11044:A:2"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "damage", instructions: [{ verb: "DamageCard", amount: 3, target: "self" }] },
          { id: "discard", instructions: [{ verb: "PickDiscardTop", types: ["enemy"] }, { verb: "MoveEncounterCard", card: "picked", to: "staging" }] },
        ],
      },
    ],
  },
  {
    id: "11044:shadow:1",
    cardCode: "11044",
    lines: ["11044:A:3"],
    timing: "shadow",
    instructions: [{ verb: "Pick", pick: { type: "character", control: "any", defending: true }, when: RAIDER_ATTACKS }, { verb: "Pick", pick: ATTACKER_PICK, when: RAIDER_ATTACKS }, { verb: "MoveResources", all: true, when: RAIDER_ATTACKS }],
  },

  // 11045 White Ship (Aflame 4 is a keyword). Travel: search for a Corsair enemy, add it to the staging area, shuffle the encounter deck. Forced: when placed underneath The Havens Burn, 1 resource on each Raider enemy.
  { id: "11045:travel:1", cardCode: "11045", lines: ["11045:A:2"], timing: "travel", instructions: [{ verb: "SearchMove", trait: "Corsair", type: "enemy", to: "staging" }, { verb: "ShuffleEncounterDeck" }] },
  placedUnder("11045", "11045:A:3", 1, [{ verb: "Each", pick: RAIDER, instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "picked" }] }]),

  // 11046 Elven Wave-runner (Aflame 3 is a keyword). Response: after it is added to the victory display, each player draws 1 card. Shadow: against a Raider, a card at random is discarded from your hand and
  // the attacking enemy gets 1 resource.
  {
    id: "11046:response:1",
    cardCode: "11046",
    lines: ["11046:A:2"],
    timing: "response",
    trigger: "leftPlay",
    subject: "self",
    condition: { kind: "sourceIn", zone: "victory" },
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Draw", amount: 1 }] }],
  },
  {
    id: "11046:shadow:1",
    cardCode: "11046",
    lines: ["11046:A:3"],
    timing: "shadow",
    instructions: [{ verb: "DiscardRandomFromHand", when: RAIDER_ATTACKS }, { verb: "Pick", pick: ATTACKER_PICK, when: RAIDER_ATTACKS }, { verb: "PlaceResourceTokens", amount: 1, on: "picked", when: RAIDER_ATTACKS }],
  },

  // 11047 Elven Caravel (Aflame 4 is a keyword). Travel: each player assigns damage among their characters equal to the damage on it. Forced: when placed underneath The Havens Burn, 1 damage to each character in play.
  { id: "11047:travel:1", cardCode: "11047", lines: ["11047:A:2"], timing: "travel", instructions: [{ verb: "AssignDamage", amount: { stat: "damage", of: "self" }, pick: { type: "character", control: "you" }, who: "eachSeat" }] },
  placedUnder("11047", "11047:A:3", 1, [{ verb: "DamageEach", amount: 1, pick: { type: "character", control: "any" } }]),

  // 11048 Put to the Torch. When Revealed: each player deals 3 damage to a character they control, or to an Aflame location in play. Shadow: with an Aflame active location, either it takes 3 damage or the
  // defending character takes 1.
  {
    id: "11048:whenRevealed:1",
    cardCode: "11048",
    lines: ["11048:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "character", requires: { kind: "canPick", pick: { type: "character", control: "you" } }, instructions: [{ verb: "Pick", pick: { type: "character", control: "you" } }, { verb: "DamageCard", amount: 3, target: "picked" }] },
              { id: "location", requires: { kind: "canPick", pick: AFLAME }, instructions: [{ verb: "Pick", pick: AFLAME }, { verb: "DamageCard", amount: 3, target: "picked" }] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "11048:shadow:1",
    cardCode: "11048",
    lines: ["11048:A:2"],
    timing: "shadow",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "location", requires: ACTIVE_AFLAME, instructions: [{ verb: "DamageCard", amount: 3, target: "activeLocation" }] },
          { id: "character", requires: ACTIVE_AFLAME, instructions: [{ verb: "DamageCard", amount: 1, target: "defender" }] },
        ],
      },
    ],
  },

  // 11049 The Fires Spread (Doomed 2 is a keyword). When Revealed: 1 damage to each Aflame location in play; it gains surge when there are fewer than 3 (so fewer than 3 damage is dealt). Shadow: if the attack
  // destroys a character, 1 damage to each Aflame location in play.
  {
    id: "11049:whenRevealed:1",
    cardCode: "11049",
    lines: ["11049:A:2"],
    timing: "whenRevealed",
    instructions: [{ verb: "GainSurge", when: { kind: "count", pick: AFLAME, max: 2 } }, { verb: "DamageEach", amount: 1, pick: AFLAME }],
  },
  {
    id: "11049:shadow:1",
    cardCode: "11049",
    lines: ["11049:A:3"],
    timing: "shadow",
    instructions: [{ verb: "AfterAttack", instructions: [{ verb: "DamageEach", amount: 1, pick: AFLAME, when: { kind: "x", min: 1 } }] }],
  },

  // 11064 Umbar Raider. +1 Attack for each resource on it. Forced: after it attacks you, a resource from one of your heroes' pools moves to it.
  { id: "11064:constant:1", cardCode: "11064", lines: ["11064:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" }] },
  { id: "11064:forced:1", cardCode: "11064", lines: ["11064:A:2"], timing: "forced", trigger: "attackResolved", subject: "self", eventSeat: "you", instructions: takesAHeroResource },

  // 11065 Corsair Infiltrator. Forced: when it attacks, it is dealt 1 additional shadow card for each resource on it. Forced: after the engaged player collects resources, a resource from one of their heroes' pools moves to it.
  {
    id: "11065:forced:1",
    cardCode: "11065",
    lines: ["11065:A:1"],
    timing: "forced",
    trigger: "attacks",
    subject: "self",
    instructions: [{ verb: "Repeat", times: { stat: "resources", of: "self" }, instructions: [{ verb: "DealShadow", additional: true }] }],
  },
  {
    id: "11065:forced:2",
    cardCode: "11065",
    lines: ["11065:A:2"],
    timing: "forced",
    trigger: "resourcesCollected",
    eventSeat: "you",
    condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "engaged" }, { kind: "canPick", pick: A_HERO_WITH_RESOURCES }] },
    instructions: takesAHeroResource,
  },

  // 11066 Raid Leader. +1 Defense for each resource on it. Forced: when it engages you, 1 resource moves from each of your heroes' pools to it.
  { id: "11066:constant:1", cardCode: "11066", lines: ["11066:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "defense", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" }] },
  { id: "11066:forced:1", cardCode: "11066", lines: ["11066:A:2"], timing: "forced", trigger: "engaged", subject: "self", eventSeat: "you", instructions: [{ verb: "MoveResourceFromHeroes", to: "self" }] },

  // 11067 Battle-Hardened. When Revealed: 1 resource on each Raider enemy in play, each engaged non-Ship enemy makes an immediate attack, and it gains surge when none did. Shadow: against a Raider, 2 resources on it.
  {
    id: "11067:whenRevealed:1",
    cardCode: "11067",
    lines: ["11067:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Each", pick: RAIDER, instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "picked" }] }, { verb: "ImmediateAttackEach", notTrait: "Ship" }, { verb: "GainSurge", when: { kind: "noneReturned" } }],
  },
  {
    id: "11067:shadow:1",
    cardCode: "11067",
    lines: ["11067:A:2"],
    timing: "shadow",
    instructions: [{ verb: "Pick", pick: ATTACKER_PICK, when: RAIDER_ATTACKS }, { verb: "PlaceResourceTokens", amount: 2, on: "picked", when: RAIDER_ATTACKS }],
  },

  // 11076 Captain Sahír (enemy side). He engages the first player when he is added to the staging area. For each point of damage he would take, a resource is discarded from him and the damage canceled.
  // Forced: after he attacks, 2 resources on him (4 when his attack destroyed a character).
  { id: "11076:forced:1", cardCode: "11076", lines: ["11076:A:1"], timing: "forced", trigger: "addedToStaging", subject: "self", instructions: [{ verb: "EngageFirstPlayer" }] },
  { id: "11076:constant:1", cardCode: "11076", lines: ["11076:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "resourceShield", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "11076:forced:2",
    cardCode: "11076",
    lines: ["11076:A:3"],
    timing: "forced",
    trigger: "attacks",
    subject: "self",
    instructions: [
      {
        verb: "AfterAttack",
        instructions: [{ verb: "PlaceResourceTokens", amount: 2, on: "self", when: { kind: "not", condition: { kind: "x", min: 1 } } }, { verb: "PlaceResourceTokens", amount: 4, on: "self", when: { kind: "x", min: 1 } }],
      },
    ],
  },

  // 11077 Captain Sahír (objective ally side). The first player controls him; +1 Willpower and +1 Attack for each resource on him (at most +6); Action: a resource from a hero you control places a resource on him
  // once a round; the players lose if he leaves play.
  { id: "11077:constant:1", cardCode: "11077", lines: ["11077:A:1"], timing: "constant", instructions: [{ verb: "ControlledBy", who: "firstPlayer", card: "self" }] },
  {
    id: "11077:constant:2",
    cardCode: "11077",
    lines: ["11077:A:2"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "willpower", amount: { stat: "resources", of: "self", limit: 6 }, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "attack", amount: { stat: "resources", of: "self", limit: 6 }, until: "whileSourceInPlay", target: "self" },
    ],
  },
  resourceFromHero("11077", "11077:A:3"),
  losesWhenLeaving("11077", "11077:A:4"),

  // 11078 Na'asiyah (enemy side). She engages the last player when she is added to the staging area. Forced: when she engages you, each event in your hand is discarded and she gets 1 resource for each.
  // Forced: when she attacks or defends she gets +1 Attack and +1 Defense for each resource on her for this attack; after it 1 resource is discarded from her.
  { id: "11078:forced:1", cardCode: "11078", lines: ["11078:A:1"], timing: "forced", trigger: "addedToStaging", subject: "self", instructions: [{ verb: "EngageLastPlayer" }] },
  {
    id: "11078:forced:2",
    cardCode: "11078",
    lines: ["11078:A:2"],
    timing: "forced",
    trigger: "engaged",
    subject: "self",
    eventSeat: "you",
    instructions: [{ verb: "Each", pick: { type: "card", control: "you", from: "hand", cardType: "event" }, instructions: [{ verb: "DiscardPicked" }, { verb: "PlaceResourceTokens", amount: 1, on: "self" }] }],
  },
  // The bonus she gets for this attack, for each resource on her now, and the resource discarded once it is over (the Delay of a player attack on her, AfterAttack for her own).
  naasiyahBonus(),
  {
    id: "11078:forced:3",
    cardCode: "11078",
    lines: ["11078:A:3"],
    timing: "forced",
    trigger: "attacks",
    subject: "self",
    instructions: [...NAASIYAH_STATS, { verb: "AfterAttack", instructions: [{ verb: "DiscardResources", amount: 1, target: "self" }] }],
  },

  // 11079 Na'asiyah (objective ally side). The last player controls her; Action: while she attacks or defends, a resource from her gives her +2 Attack or +2 Defense for this attack; Action: a resource from a
  // hero you control places a resource on her once a round; the players lose if she leaves play.
  { id: "11079:constant:1", cardCode: "11079", lines: ["11079:A:1"], timing: "constant", instructions: [{ verb: "ControlledBy", who: "lastPlayer", card: "self" }] },
  {
    id: "11079:action:2",
    cardCode: "11079",
    lines: ["11079:A:2"],
    timing: "action",
    cost: { kind: "resources", amount: 1, from: "self" },
    condition: { kind: "any", conditions: [{ kind: "attacking", card: "self" }, { kind: "matches", card: "self", pick: { type: "character", control: "any", defending: true } }] },
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "attack", requires: { kind: "attacking", card: "self" }, instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "self" }] },
          { id: "defense", requires: { kind: "matches", card: "self", pick: { type: "character", control: "any", defending: true } }, instructions: [{ verb: "ModifyStat", stat: "defense", amount: 2, until: "endOfAttack", target: "self" }] },
        ],
      },
    ],
  },
  { ...resourceFromHero("11079", "11079:A:3"), id: "11079:action:1" },
  losesWhenLeaving("11079", "11079:A:4"),

  // 11188 Graxar (Immune to player card effects is a keyword). No more than 1 character can attack him each round; +1 Attack for each damage on him and +1 Defense for each resource on him; Forced: when
  // he is dealt a shadow card, 1 resource on him.
  { id: "11188:constant:1", cardCode: "11188", lines: ["11188:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attackerLimit", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "11188:constant:2",
    cardCode: "11188",
    lines: ["11188:A:3"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: { stat: "damage", of: "self" }, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "defense", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" },
    ],
  },
  {
    id: "11188:forced:1",
    cardCode: "11188",
    lines: ["11188:A:4"],
    timing: "forced",
    trigger: "shadowsDealt",
    eventSeat: "you",
    condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "engaged" }, { kind: "matches", card: "self", pick: { type: "enemy", control: "any", hasShadow: true } }] },
    instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }],
  },

  // 11182 Raid on the Grey Havens (campaign card). Setup (Campaign Mode): Spyglass and Black Key are set aside and attached to Calphon once the quest card's Setup has run (ScenarioDefinition.afterSetup); the first
  // player controls Calphon (the Campaign Expansion's reprint, 110013); Graxar is shuffled into the encounter deck; each player may take one Galdor's Counsel into hand (the campaign checklist asks; the copies are
  // earned at the Resolution). Forced: after stage 2B is revealed Calphon and his attachments leave the game. Resolution: Parrying Cutlass or Throwing Axe for a hero if Graxar is in the victory display,
  // the chosen Galdor's Counsel, and the XP list.
  {
    id: "11182:campaignSetup:1",
    cardCode: "11182",
    lines: ["11182:A:2"],
    timing: "campaignSetup",
    instructions: [
      { verb: "SetAside", code: "11180" },
      { verb: "SetAside", code: "11183" },
      { verb: "PutObjectiveAllyIntoPlay", code: "110013" },
      { verb: "ShuffleIntoEncounterDeck", code: "11188" },
      { verb: "AttachSetAsideTo", code: "11180", to: "Calphon" },
      { verb: "AttachSetAsideTo", code: "11183", to: "Calphon" },
      { verb: "ChooseCards", codes: ["11184", "11185", "11186", "11187"], who: "eachSeat", to: "hand", optional: true, unearned: true },
    ],
  },
  {
    id: "11182:forced:1",
    cardCode: "11182",
    lines: ["11182:A:3"],
    timing: "forced",
    trigger: "stageRevealed",
    condition: { kind: "matches", card: "subject", pick: { type: "card", control: "any", names: ["Sahír's Advance"] } },
    instructions: [{ verb: "RemoveNamedFromGame", name: "Calphon" }],
  },
  {
    id: "11182:resolution:1",
    cardCode: "11182",
    lines: ["11182:B:1"],
    timing: "resolution",
    instructions: [{ verb: "ChooseCards", codes: ["11189", "11190"], who: "firstPlayer", to: "hero", anyHero: true, when: { kind: "inVictory", code: "11188", is: true } }],
  },
  { id: "11182:resolution:2", cardCode: "11182", lines: ["11182:B:2"], timing: "resolution", instructions: [{ verb: "EarnDealt", codes: ["11184", "11185", "11186", "11187"] }] },
  { id: "11182:resolution:3", cardCode: "11182", lines: ["11182:B:3", "11182:B:4"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, each: { kind: "survivingPlayer" } }] },
  {
    id: "11182:resolution:4",
    cardCode: "11182",
    lines: ["11182:B:5"],
    timing: "resolution",
    instructions: [
      { verb: "GainXp", amount: 1, when: { kind: "underBurn", max: 2 } },
      { verb: "GainXp", amount: 1, when: { kind: "underBurn", max: 0 } },
    ],
  },
  { id: "11182:resolution:5", cardCode: "11182", lines: ["11182:B:6"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, each: { kind: "inVictory", codes: ["11046"] } }] },
  { id: "11182:resolution:6", cardCode: "11182", lines: ["11182:B:7"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: { kind: "inVictory", code: "11078", is: true } }] },
  { id: "11182:resolution:7", cardCode: "11182", lines: ["11182:B:8"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: { kind: "enemyInPlay", is: false } }] },
  { id: "11182:resolution:8", cardCode: "11182", lines: ["11182:B:9"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: { kind: "survivorsThreat", max: 40 } }] },
  {
    id: "11182:resolution:9",
    cardCode: "11182",
    lines: ["11182:B:10"],
    timing: "resolution",
    instructions: [{ verb: "GainXp", amount: -1, when: { kind: "count", pick: { type: "card", control: "any", from: "victory", names: ["Ominous Fate"] }, min: 1 } }],
  },
];

export const AUTHORED_REPLACES: readonly string[] = [];
