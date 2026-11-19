import type { Amount, Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";
import { consideredEngaged } from "../considered-engaged.ts";
import { AUTHORED_EFFECTS as LOST_IN_MIRKWOOD } from "../lost-in-mirkwood.ts";
import { copyLine, withCopies } from "../reprint.ts";
import { EACH_PLAYER, FEWER_LOOT_THAN, LOOT, X_AT_LEAST_1, discoverKeyword, lootRecords } from "../the-ghost-of-framsburg.ts";

// Records for The Ruins of Belegost (standalone-scenarios cycle part 6, no campaign card). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) or another card prints word for word needs no record here.
// The scenario shares Discover X and Loot with The Ghost of Framsburg: its Loot records, Discover keyword, Loot pick and Restrict conditions are that file's (the readings are in docs/brief.md, The Ruins of Belegost, Readings). A Loot objective attached to a hero counts as an attachment (the reading of 50629:A:2).
// The quest stages branch on the Loot objective attached to a hero (AdvanceIfAttached, read by the stage's `attachedNext`); Stalking the Ruins holds the resources Naurlhûg's X reads.
// Rules: emce.discover, emce.loot, emce.immune, rr.forced, rr.surge, rr.travel, rr.guarded, rr.quest-advancement, rr.in-play-and-out-of-play, rr.restricted, rr.victory, rr.cannot, rr.engaged, faq.additional-attacks, faq.next-player (data/rules/entries.json).
const STALKING = "50608";
const LURKER = "50616";
const NAURLHUG = "50615";
const LAIR = "50621";
const STAGE_1 = "50601";
const STAGE_2A = "50602";
const STAGE_2C = "50603";
const STAGE_3A = "50604";
const STAGE_3C = "50605";
const STAGE_3E = "50606";
const STAGE_4A = "50607";
const SWORD = "50609";
const MAP = "50610";
const KEYS = "50611";
const BOOK = "50612";
const TORCH = "50613";
const GEM = "50614";
// "the 5 remaining Loot objectives" the Setup hides and shuffles (50601:A:1): the Sword is set aside by the line before.
const OTHER_LOOT: readonly string[] = [MAP, KEYS, BOOK, TORCH, GEM];
// Naurlhûg in the staging area or engaged with a player.
const NAURLHUG_ANYWHERE: PickSpec = { type: "card", control: "any", names: ["Naurlhûg"], engagedEnemies: true };
const NAURLHUG_ENEMY: PickSpec = { type: "enemy", control: "any", names: ["Naurlhûg"] };
const YOUR_LOOT: PickSpec = { type: "objective", control: "you", controlled: true, lootKeyword: true };
// X of Naurlhûg and the check of Stalking the Ruins: the resources on Stalking the Ruins (50615:A:2, 50608:A:1).
const RESOURCES_ON_STALKING: Amount = { resourcesOn: { type: "card", control: "any", names: ["Stalking the Ruins"] } };
const THREE_ON_STALKING: Condition = { kind: "tokens", code: STALKING, min: 3 };
// "1 more than the Discover value on the active location" (50617:A:2, 50629:A:1): 1 with no Discover value.
const DISCOVER_PLUS_1: Amount = { discoverValue: true, plus: 1 };
const LOOT_ATTACHED: PickSpec = { type: "objective", control: "any", controlled: true, lootKeyword: true };
const LOOT_ON_HERE: PickSpec = { type: "objective", control: "any", lootKeyword: true, attachedTo: "source" };
const ATTACHMENTS_YOU_CONTROL: PickSpec = { type: "attachment", control: "you" };
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const NO_LOCATION_IN_PLAY: Condition = { kind: "count", pick: { type: "location", control: "any" }, max: 0 };
const NO_LOOT_YOURS: Condition = { kind: "not", condition: { kind: "count", pick: YOUR_LOOT, min: 1 } };
const NO_HAZARD_DISCOVERED: Condition = { kind: "not", condition: { kind: "x", min: 1 } };
const NO_LOOT_HERE: Condition = { kind: "not", condition: { kind: "count", pick: LOOT_ON_HERE, min: 1 } };
const HAZARD_ENEMY_ATTACKER: Condition = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", nonUnique: true } };
// The Loot cards print "If unattached, the first player claims ...": the claim (lootRecords) and the count as an attachment while a hero holds it.
// The ids are their own: the Sword's template record 50609:constant:1 (+4 Attack) holds the id lootRecords would give its Loot keyword.
const lootCards = (code: string, first = 1): Effect[] =>
  lootRecords(code).map((effect) => {
    const claim = effect.id === `${code}:constant:2`;
    return { ...effect, id: `${code}:constant:${first + (claim ? 1 : 0)}`, ...(claim ? { instructions: [...effect.instructions, { verb: "CountsAs" as const, cardType: "attachment" as const }] } : {}) };
  });
// "When this stage is defeated, if <Loot> is attached to a hero, advance to stage <then>. Otherwise, advance to stage <otherwise>." (50601:B:3 to 50606:B:3)
const stageBranch = (code: string, line: string, number: number, loot: string, then: string, otherwise: string): Effect => ({
  id: `${code}:forced:${number}`,
  cardCode: code,
  lines: [line],
  timing: "forced",
  trigger: "questCardDefeated",
  subject: "self",
  instructions: [{ verb: "AdvanceIfAttached", code: loot, then, otherwise }],
});
// "Shuffle the encounter discard pile into the encounter deck and reveal 1 encounter card per player" (50604:A:1, 50605:A:1, 50606:A:1).
const SHUFFLE_AND_REVEAL: Instruction[] = [{ verb: "ShuffleEncounterDiscard" }, EACH_PLAYER([{ verb: "RevealEncounter" }])];
const MUST_TRAVEL: Instruction = { verb: "ModifyStat", stat: "mustTravel", amount: 1, until: "whileSourceInPlay", target: "table" };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([
  // 50601 Ruins of the First Age (1A/1B). Setup: Stalking the Ruins and an Abandoned Mine for each player are staged, the four others are set aside (the piles); one of the five other Loot objectives lies facedown under Stalking the Ruins and the rest are shuffled into the encounter deck.
  // Side B: the players cannot advance with no Loot objective; at the beginning of the travel phase with no location in play the topmost location of the discard pile returns to the staging area; Keys of Belegost attached to a hero sends the quest to stage 2C, else 2A.
  { id: "50601:setup:1", cardCode: STAGE_1, lines: ["50601:A:1"], timing: "setup", instructions: [{ verb: "HideRandomLoot", codes: [...OTHER_LOOT], under: STALKING }, { verb: "ShuffleEncounterDeck" }] },
  { id: "50601:constant:1", cardCode: STAGE_1, lines: ["50601:B:1"], timing: "constant", condition: FEWER_LOOT_THAN(1), instructions: [{ verb: "Restrict", what: "advance" }] },
  {
    id: "50601:forced:1",
    cardCode: STAGE_1,
    lines: ["50601:B:2"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Travel" }, NO_LOCATION_IN_PLAY] },
    instructions: [{ verb: "PickDiscardTop", types: ["location"] }, { verb: "MoveEncounterCard", card: "picked", to: "staging" }],
  },
  stageBranch(STAGE_1, "50601:B:3", 2, KEYS, STAGE_2C, STAGE_2A),

  // 50602 Ancient Evils Disturbed (2A). Cannot advance without 2 Loot objectives and Lurker of the Depths in the victory display; Book of Aulë's Children sends the quest to 3C, else 3A.
  { id: "50602:constant:1", cardCode: STAGE_2A, lines: ["50602:B:1"], timing: "constant", condition: { kind: "any", conditions: [{ kind: "count", pick: LOOT, max: 1 }, { kind: "inVictory", code: LURKER, is: false }] }, instructions: [{ verb: "Restrict", what: "advance" }] },
  stageBranch(STAGE_2A, "50602:B:2", 1, BOOK, STAGE_3C, STAGE_3A),

  // 50603 Deeper into the Past (2C). When Revealed: Lurker of the Depths and the discard pile are shuffled into the deck, cards are discarded until a location is, and it is added to the staging area. Side B: 2 Loot objectives and 3 resources here to advance;
  // after the active location is explored 1 resource is placed here; Book of Aulë's Children sends the quest to 3E, else 3C.
  {
    id: "50603:whenRevealed:1",
    cardCode: STAGE_2C,
    lines: ["50603:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "ShuffleSetAsideIntoEncounterDeck", code: LURKER }, { verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntil", type: "location" }, { verb: "MoveEncounterCard", card: "picked", to: "staging" }],
  },
  {
    id: "50603:constant:1",
    cardCode: STAGE_2C,
    lines: ["50603:B:1"],
    timing: "constant",
    condition: { kind: "any", conditions: [{ kind: "count", pick: LOOT, max: 1 }, { kind: "less", left: { stat: "resources", of: "self" }, right: 3 }] },
    instructions: [{ verb: "Restrict", what: "advance" }],
  },
  { id: "50603:forced:1", cardCode: STAGE_2C, lines: ["50603:B:2"], timing: "forced", trigger: "activeExplored", instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }] },
  stageBranch(STAGE_2C, "50603:B:3", 2, BOOK, STAGE_3E, STAGE_3C),

  // 50604 The Servants of Morgoth (3A), 50605 The Roots of Ered Luin (3C), 50606 The Mines of Belegost (3E). Each When Revealed shuffles the discard pile into the deck and each player reveals a card. 3A: the first Hazard card revealed each round gains surge; the players must travel; Dwarven Torch sends the quest to 4A, else 3C.
  // 3C: the Discover value of the active location is up by 1; the players must travel; Map of Ered Luin sends the quest to 4A, else 3E. 3E: the players must travel; after the Discover keyword resolves with no Hazard revealed the first player reveals a card; Blue Mountain Gem sends the quest to 4A, else 3A.
  { id: "50604:whenRevealed:1", cardCode: STAGE_3A, lines: ["50604:A:1"], timing: "whenRevealed", instructions: SHUFFLE_AND_REVEAL },
  { id: "50604:constant:1", cardCode: STAGE_3A, lines: ["50604:B:1"], timing: "constant", instructions: [{ verb: "FirstTraitSurge", trait: "Hazard", type: "any" }] },
  { id: "50604:constant:2", cardCode: STAGE_3A, lines: ["50604:B:2"], timing: "constant", instructions: [MUST_TRAVEL] },
  stageBranch(STAGE_3A, "50604:B:3", 1, TORCH, STAGE_4A, STAGE_3C),
  { id: "50605:whenRevealed:1", cardCode: STAGE_3C, lines: ["50605:A:1"], timing: "whenRevealed", instructions: SHUFFLE_AND_REVEAL },
  { id: "50605:constant:1", cardCode: STAGE_3C, lines: ["50605:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "discoverValue", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", active: true } }] },
  { id: "50605:constant:2", cardCode: STAGE_3C, lines: ["50605:B:2"], timing: "constant", instructions: [MUST_TRAVEL] },
  stageBranch(STAGE_3C, "50605:B:3", 1, MAP, STAGE_4A, STAGE_3E),
  { id: "50606:whenRevealed:1", cardCode: STAGE_3E, lines: ["50606:A:1"], timing: "whenRevealed", instructions: SHUFFLE_AND_REVEAL },
  { id: "50606:constant:1", cardCode: STAGE_3E, lines: ["50606:B:1"], timing: "constant", instructions: [MUST_TRAVEL] },
  {
    id: "50606:forced:1",
    cardCode: STAGE_3E,
    lines: ["50606:B:2"],
    timing: "forced",
    trigger: "discovered",
    subject: { type: "location", control: "any" },
    instructions: [{ verb: "RevealEncounter", who: "firstPlayer", when: NO_HAZARD_DISCOVERED }],
  },
  stageBranch(STAGE_3E, "50606:B:3", 2, GEM, STAGE_4A, STAGE_3A),

  // 50607 The Beast of Belegost (4A, the last stage). When Revealed: Naurlhûg and its Lair are added to the staging area (not revealed) and the Sword of Belegost and the discard pile are shuffled into the deck. While the Lair is in the victory display Naurlhûg loses "Cannot take damage."
  // After Naurlhûg attacks, if it was dealt a shadow card with no shadow effect it engages the next player and makes an immediate attack with no shadow card (none with one player). The players win when Naurlhûg is defeated.
  {
    id: "50607:whenRevealed:1",
    cardCode: STAGE_4A,
    lines: ["50607:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "AddSetAsideToStaging", code: NAURLHUG }, { verb: "AddSetAsideToStaging", code: LAIR }, { verb: "ShuffleSetAsideIntoEncounterDeck", code: SWORD }, { verb: "ShuffleEncounterDiscard" }],
  },
  {
    id: "50607:constant:1",
    cardCode: STAGE_4A,
    lines: ["50607:B:1"],
    timing: "constant",
    condition: { kind: "inVictory", code: LAIR, is: true },
    instructions: [{ verb: "ModifyStat", stat: "losesNoDamage", amount: 1, until: "whileSourceInPlay", holders: NAURLHUG_ANYWHERE }],
  },
  {
    id: "50607:forced:1",
    cardCode: STAGE_4A,
    lines: ["50607:B:2"],
    timing: "forced",
    trigger: "attackResolved",
    subject: NAURLHUG_ENEMY,
    condition: { kind: "all", conditions: [{ kind: "shadowBlank" }, { kind: "otherPlayer" }] },
    instructions: [{ verb: "EngageNextPlayer" }, { verb: "ImmediateAttack", shadow: false }],
  },
  { id: "50607:triggered:1", cardCode: STAGE_4A, lines: ["50607:B:3"], timing: "triggered", trigger: "enemyDestroyed", subject: NAURLHUG_ENEMY, instructions: [{ verb: "WinGame" }] },

  // 50608 Stalking the Ruins. At the beginning of the quest phase 1 resource is placed on it and, with 3 or more, Naurlhûg is added from the set-aside pile or returned from its engagement to the staging area. When the players advance to a new stage its tokens are discarded and Naurlhûg is set aside.
  {
    id: "50608:forced:1",
    cardCode: STALKING,
    lines: ["50608:A:1"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Quest" },
    instructions: [
      { verb: "PlaceResourceTokens", amount: 1, on: "self" },
      { verb: "AddSetAsideToStaging", code: NAURLHUG, when: THREE_ON_STALKING },
      { verb: "Pick", pick: { type: "enemy", control: "any", names: ["Naurlhûg"], engagedEnemies: true }, when: THREE_ON_STALKING },
      { verb: "ReturnToStaging", target: { kind: "picked" }, when: THREE_ON_STALKING },
    ],
  },
  { id: "50608:forced:2", cardCode: STALKING, lines: ["50608:A:2"], timing: "forced", trigger: "stageRevealed", instructions: [{ verb: "RemoveResourceTokens", code: STALKING, amount: { stat: "resources", of: "self" } }, { verb: "SetAsideInPlay", code: NAURLHUG }] },

  // 50609 Sword of Belegost (Loot, Restricted). Attached hero gets +4 Attack (the template record 50609:A:3). Response: exhaust it to cancel a shadow effect just triggered.
  ...lootCards(SWORD, 2),
  { id: "50609:response:1", cardCode: SWORD, lines: ["50609:A:4"], timing: "response", trigger: "shadowPending", cost: { kind: "exhaustSelf" }, instructions: [{ verb: "CancelEffect" }] },
  // 50610 Map of Ered Luin. Action: exhaust it, a non-unique location gets -2 Threat until the end of the phase.
  ...lootCards(MAP),
  {
    id: "50610:action:1",
    cardCode: MAP,
    lines: ["50610:A:3"],
    timing: "action",
    cost: { kind: "exhaustSelf" },
    instructions: [{ verb: "Pick", pick: { type: "location", control: "any", nonUnique: true } }, { verb: "ModifyStat", stat: "threat", amount: -2, until: "endOfPhase", target: "picked" }],
  },
  // 50611 Keys of Belegost. Action: exhaust it, a hero gets 1 resource.
  ...lootCards(KEYS),
  { id: "50611:action:1", cardCode: KEYS, lines: ["50611:A:3"], timing: "action", cost: { kind: "exhaustSelf" }, instructions: [{ verb: "Pick", pick: { type: "hero", control: "any" } }, { verb: "AddResources", amount: 1, to: "picked" }] },
  // 50612 Book of Aulë's Children. Action: exhaust it, a player draws 1 card (the template record 50612:A:3).
  ...lootCards(BOOK),
  // 50613 Dwarven Torch. Action: exhaust it, a non-unique enemy gets -1 Attack and -1 Defense until the end of the phase.
  ...lootCards(TORCH),
  {
    id: "50613:action:1",
    cardCode: TORCH,
    lines: ["50613:A:3"],
    timing: "action",
    cost: { kind: "exhaustSelf" },
    instructions: [
      { verb: "Pick", pick: { type: "enemy", control: "any", nonUnique: true } },
      { verb: "ModifyStat", stat: "attack", amount: -1, until: "endOfPhase", target: "picked" },
      { verb: "ModifyStat", stat: "defense", amount: -1, until: "endOfPhase", target: "picked" },
    ],
  },
  // 50614 Blue Mountain Gem. Action: exhaust it, a player reduces their threat by 1.
  ...lootCards(GEM),
  { id: "50614:action:1", cardCode: GEM, lines: ["50614:A:3"], timing: "action", cost: { kind: "exhaustSelf" }, instructions: [{ verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "LowerThreat", amount: 1, who: "picked" }] },

  // 50615 Naurlhûg. Immune to player card effects and cannot take damage (until the Lair is in the victory display, 50607:B:1). X is the resources on Stalking the Ruins: when it makes an attack the defending player assigns X damage among the characters he controls.
  {
    id: "50615:constant:1",
    cardCode: NAURLHUG,
    lines: ["50615:A:1"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", target: "self" }],
  },
  {
    id: "50615:forced:1",
    cardCode: NAURLHUG,
    lines: ["50615:A:2", "50615:A:3"],
    timing: "forced",
    trigger: "attacks",
    subject: "self",
    instructions: [{ verb: "AssignDamage", amount: RESOURCES_ON_STALKING, pick: { type: "character", control: "you" } }],
  },

  // 50616 Lurker of the Depths. Cannot have attachments (template). Cannot be engaged or take more than 4 damage each round; in the staging area it is considered engaged with each player.
  { id: "50616:constant:2", cardCode: LURKER, lines: ["50616:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "damageCap", amount: 4, until: "whileSourceInPlay", target: "self" }] },
  { id: "50616:constant:3", cardCode: LURKER, lines: ["50616:A:3"], timing: "constant", condition: IN_STAGING, instructions: consideredEngaged() },

  // 50617 Nameless Cave Dweller. Threat, Attack and Defense X, 1 more than the Discover value of the active location. The Shadow: attacker +1 Attack, +2 instead if you control a Loot objective.
  {
    id: "50617:constant:2",
    cardCode: "50617",
    lines: ["50617:A:2"],
    timing: "constant",
    instructions: (["threat", "attack", "defense"] as const).map((stat) => ({ verb: "ModifyStat" as const, stat, amount: DISCOVER_PLUS_1, until: "whileSourceInPlay" as const, target: "self" as const })),
  },
  {
    id: "50617:shadow:1",
    cardCode: "50617",
    lines: ["50617:A:3"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "count", pick: YOUR_LOOT, min: 1 } },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: NO_LOOT_YOURS },
    ],
  },
  // 50618 Old Stone Troll. -10 engagement cost for each Loot objective attached to a hero; only the engaged player can declare attackers against it.
  { id: "50618:constant:2", cardCode: "50618", lines: ["50618:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: { count: LOOT_ATTACHED, times: -10 }, until: "whileSourceInPlay", target: "self" }] },
  { id: "50618:constant:3", cardCode: "50618", lines: ["50618:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attackOnlyByEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  // 50619 Orc of Ered Luin. When Revealed: it makes an immediate attack against each player who controls a Loot objective, in turn order. The Shadow: after this attack it engages the next player and attacks (Pathless Country's record 141072:shadow:1 says it in other words).
  {
    id: "50619:whenRevealed:1",
    cardCode: "50619",
    lines: ["50619:A:1"],
    timing: "whenRevealed",
    instructions: [EACH_PLAYER([{ verb: "AttackFromStaging", target: "self", when: { kind: "count", pick: YOUR_LOOT, min: 1 } }])],
  },
  {
    id: "50619:shadow:1",
    cardCode: "50619",
    lines: ["50619:A:2"],
    timing: "shadow",
    instructions: [{ verb: "AfterAttack", instructions: [{ verb: "EngageNextPlayer", when: { kind: "otherPlayer" } }, { verb: "ImmediateAttack", when: { kind: "otherPlayer" } }] }],
  },
  // 50620 Blue Mountain Goblin. While a Loot objective is attached to a hero it gains surge. The Shadow: with a Loot objective you control it is put into play engaged with you and is dealt a shadow card.
  { id: "50620:constant:1", cardCode: "50620", lines: ["50620:A:1"], timing: "constant", condition: { kind: "count", pick: LOOT_ATTACHED, min: 1 }, instructions: [{ verb: "ModifyStat", stat: "gainsSurge", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "50620:shadow:1",
    cardCode: "50620",
    lines: ["50620:A:2"],
    timing: "shadow",
    instructions: [{ verb: "EngageShadowCard", when: { kind: "count", pick: YOUR_LOOT, min: 1 } }, { verb: "DealShadow", when: { kind: "sourceIn", zone: "engaged" } }],
  },

  // 50621 Naurlhûg's Lair. Discover 5; immune to player card effects. When it is explored the Loot objective under Stalking the Ruins is added to the staging area faceup. Travel: X resources (X the players) go on Stalking the Ruins.
  discoverKeyword(LAIR, "50621:A:1", 5),
  { id: "50621:constant:2", cardCode: LAIR, lines: ["50621:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "50621:forced:2", cardCode: LAIR, lines: ["50621:A:3"], timing: "forced", trigger: "leftPlay", subject: "self", condition: { kind: "subjectExplored" }, instructions: [{ verb: "ReturnUnderToStaging", from: STALKING }] },
  { id: "50621:travel:1", cardCode: LAIR, lines: ["50621:A:4"], timing: "travel", instructions: [{ verb: "PlaceResourceTokens", amount: { players: true }, code: STALKING }] },

  // 50622 Abandoned Mine. Discover 2, looking at as many more cards as there are players. In the staging area no progress is placed on the other locations of the staging area.
  // The Forced effect comes before the keyword's own, so the amounts are set when the keyword resolves (they last to the end of the phase, which holds a travel's Discover).
  { id: "50622:forced:2", cardCode: "50622", lines: ["50622:A:3"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "ModifyStat", stat: "discoverLooked", amount: { players: true }, until: "endOfPhase", target: "self" }] },
  discoverKeyword("50622", "50622:A:1", 2),
  {
    id: "50622:constant:2",
    cardCode: "50622",
    lines: ["50622:A:2"],
    timing: "constant",
    condition: IN_STAGING,
    instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true, exceptNames: ["Abandoned Mine"] } }],
  },

  // 50623 Flooded Hall. Discover 4, revealing one more looked-at Hazard for each other player. In the staging area each ally costs 1 more to play.
  { id: "50623:forced:2", cardCode: "50623", lines: ["50623:A:3"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "ModifyStat", stat: "discoverHazards", amount: { players: true, plus: -1 }, until: "endOfPhase", target: "self" }] },
  discoverKeyword("50623", "50623:A:1", 4),
  {
    id: "50623:constant:2",
    cardCode: "50623",
    lines: ["50623:A:2"],
    timing: "constant",
    condition: IN_STAGING,
    instructions: [{ verb: "IncreaseCost", amount: 1, fromHand: true, pick: { type: "card", control: "any", cardType: "ally" } }],
  },

  // 50624 Darkened Tunnel. Discover 2. In the staging area it gains: after a "when revealed" effect is canceled, discard the top card of the encounter deck; a Hazard card so discarded is revealed from the discard pile. Travel: 1 resource on Stalking the Ruins.
  discoverKeyword("50624", "50624:A:1", 2),
  {
    id: "50624:forced:2",
    cardCode: "50624",
    lines: ["50624:A:2"],
    timing: "forced",
    trigger: "whenRevealedCanceled",
    condition: IN_STAGING,
    instructions: [{ verb: "DiscardEncounterTop", count: 1, reset: true }, { verb: "RevealDiscarded", trait: "Hazard", anyType: true }],
  },
  { id: "50624:travel:1", cardCode: "50624", lines: ["50624:A:3"], timing: "travel", instructions: [{ verb: "PlaceResourceTokens", amount: 1, code: STALKING }] },
  // 50625 Sunken Treasury. Discover 3; +1 Threat for each Loot objective attached to a hero. Travel: each player discards a random card from hand. The Shadow: exhaust a character you control.
  discoverKeyword("50625", "50625:A:1", 3),
  { id: "50625:constant:2", cardCode: "50625", lines: ["50625:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { count: LOOT_ATTACHED }, until: "whileSourceInPlay", target: "self" }] },
  { id: "50625:travel:1", cardCode: "50625", lines: ["50625:A:3"], timing: "travel", instructions: [{ verb: "DiscardRandomFromHand", who: "eachSeat" }] },
  { id: "50625:shadow:1", cardCode: "50625", lines: ["50625:A:4"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }] },
  // 50626 Secret Chamber. Discover 3. Response: after the players travel here, with no Loot objective attached to it, a Loot objective of the encounter discard pile is attached to it as a guarded objective. Travel: each player raises their threat by 2.
  discoverKeyword("50626", "50626:A:1", 3),
  {
    id: "50626:response:1",
    cardCode: "50626",
    lines: ["50626:A:2"],
    timing: "response",
    trigger: "traveled",
    subject: "self",
    condition: NO_LOOT_HERE,
    instructions: [{ verb: "AttachLootFromDiscard", to: "self" }],
  },
  { id: "50626:travel:1", cardCode: "50626", lines: ["50626:A:3"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },

  // 50627 Echoes in the Dark. When Revealed: the total Threat in the staging area is up, until the end of the phase, by the number of characters the first player controls. The Shadow: discard a random card from your hand; if it was an event the attacker gets +2 Attack.
  {
    id: "50627:whenRevealed:1",
    cardCode: "50627",
    lines: ["50627:A:2"],
    timing: "whenRevealed",
    instructions: [{ verb: "RaiseStagingThreat", amount: { count: { type: "character", control: "any", controlledBy: "firstPlayer" } }, until: "endOfPhase" }],
  },
  {
    id: "50627:shadow:1",
    cardCode: "50627",
    lines: ["50627:A:3"],
    timing: "shadow",
    instructions: [
      { verb: "DiscardRandomFromHand", remember: true },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "matches", card: "picked", pick: { type: "card", control: "any", cardType: "event" } } },
    ],
  },
  // 50628 Spawn of Thangorodrim. When Revealed: with Naurlhûg in play it attacks the first player; otherwise 1 resource goes on Stalking the Ruins; then with 3 or more Naurlhûg is added. The Shadow: an additional attack against you (the same words as Ravenous Spider's).
  {
    id: "50628:whenRevealed:1",
    cardCode: "50628",
    lines: ["50628:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: NAURLHUG_ANYWHERE, when: { kind: "inPlay", code: NAURLHUG, is: true } },
      { verb: "AttackFromStaging", who: "firstPlayer", orEngaged: true, when: { kind: "inPlay", code: NAURLHUG, is: true } },
      { verb: "PlaceResourceTokens", amount: 1, code: STALKING, when: { kind: "inPlay", code: NAURLHUG, is: false } },
      { verb: "AddSetAsideToStaging", code: NAURLHUG, when: THREE_ON_STALKING },
    ],
  },
  copyLine("18035:A:2", "50628:A:2"),
  // 50629 Concealed Spikes. When Revealed: each player assigns X damage among their characters, X 1 more than the Discover value of the active location. The Shadow: assign X damage, X the attachments you control, unless you discard the highest cost attachment you control.
  { id: "50629:whenRevealed:1", cardCode: "50629", lines: ["50629:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "AssignDamage", amount: DISCOVER_PLUS_1, pick: { type: "character", control: "you" } }])] },
  {
    id: "50629:shadow:1",
    cardCode: "50629",
    lines: ["50629:A:2"],
    timing: "shadow",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "damage", instructions: [{ verb: "AssignDamage", amount: { count: ATTACHMENTS_YOU_CONTROL }, pick: { type: "character", control: "you" } }] },
          { id: "discard", requires: { kind: "canPick", pick: ATTACHMENTS_YOU_CONTROL }, instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you", highestCost: true } }, { verb: "Discard", target: { kind: "picked" } }] },
        ],
      },
    ],
  },
  // 50630 Covered Pit. When Revealed: each player discards an ally they control. The Shadow: with a non-unique attacker, a Loot objective you control is attached to it as a guarded objective; if the attack destroys a character, the attacker returns to the staging area.
  { id: "50630:whenRevealed:1", cardCode: "50630", lines: ["50630:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "Pick", pick: { type: "ally", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }])] },
  {
    id: "50630:shadow:1",
    cardCode: "50630",
    lines: ["50630:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "Pick", pick: YOUR_LOOT, when: HAZARD_ENEMY_ATTACKER },
      { verb: "AttachGuard", guard: "attacker", to: "picked", stayEngaged: true, when: HAZARD_ENEMY_ATTACKER },
      { verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "attacker" }, when: X_AT_LEAST_1 }] },
    ],
  },
],
  { pool: LOST_IN_MIRKWOOD },
);

export const AUTHORED_REPLACES: readonly string[] = [];
