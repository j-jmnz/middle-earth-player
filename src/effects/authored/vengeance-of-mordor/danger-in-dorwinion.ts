import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Records for Danger in Dorwinion (Vengeance of Mordor part 2, A Shadow in the East, no campaign card): the three Cultist enemies and the three Plot objectives set aside at Setup, Evidence of the Cult, the City, Servants of Sauron and Under Guard encounter cards, the two encounter side quests and the
// three quest stages. Every line is read from the scan ledger (data/printed/vengeance-of-mordor.json); a line a template already writes (pnpm data build) needs no record here. The scenario's readings are in docs/scenarios/vengeance-of-mordor/danger-in-dorwinion.md; the vocabulary the
// box adds is in src/catalog/families/mordor.ts (a Secret Cultist's ally made an enemy, the Travel of the active location resolved as an effect, the shadow cards Black Númenórean keeps, the cards facedown under Seedy Tavern).
// Rules: rr.forced, rr.shadow-effects, rr.travel, rr.guarded, rr.victory, rr.explored, rr.active-location, rr.attachment-cards, rr.first-player, rr.engaged, rr.damage, rr.destroy, rr.threat-elimination-level, rr.doomed-x, rr.reveal, rr.search, rr.lasting-effects, faq.lasting-effects
// (data/rules/entries.json).
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const A_LOCATION = { type: "location", control: "any" } as const satisfies PickSpec;
const ACTIVE_LOCATION = { kind: "canPick", pick: { ...A_LOCATION, active: true } } as const satisfies Condition;
const NO_ACTIVE_LOCATION = { kind: "not", condition: ACTIVE_LOCATION } as const satisfies Condition;
const CULTIST: PickSpec = { type: "enemy", control: "any", trait: "Cultist" };
const AN_ENEMY: PickSpec = { type: "enemy", control: "any" };
// "The enemy this effect picked last is in the encounter deck or discard pile": a card DiscardUntil found is added without a reveal.
const PICKED_IS = (pick: PickSpec) => ({ kind: "matches", card: "picked", pick, inPlay: false }) as const satisfies Condition;
// "Raise each player's threat by X, where X is the active location's Threat".
const ACTIVE_THREAT: Instruction = { verb: "RaiseThreat", amount: { stat: "threat", of: "activeLocation" }, who: "eachSeat" };
// "This stage cannot be defeated unless there are at least N resources here" (21077:B:2, 21078:B:2).
const CANNOT_DEFEAT_UNLESS = (right: number | { players: true; plus: number }): Condition => ({ kind: "less", left: { stat: "resources", of: "self" }, right });
// "The engaged player raises his threat" (21041:A:3, 21045:A:2): the actor of a threat raise is the player who raised it.
const ENGAGED_PLAYER_RAISED: Condition = { kind: "engagedWithActor" };
// "The ally in play with the highest Attack": the first player chooses among those tied (21039:A:1).
const HIGHEST_ALLY: PickSpec = { type: "ally", control: "any", highestAttack: true, who: "firstPlayer" };
const OWN_ATTACHMENT: PickSpec = { type: "attachment", control: "you", controlled: true };

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 21030 Priest of Sauron (Cultist). Cannot be optionally engaged. Forced: after it attacks and destroys an ally, each player's threat is raised by 2.
  { id: "21030:constant:1", cardCode: "21030", lines: ["21030:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "21030:forced:1", cardCode: "21030", lines: ["21030:A:3"], timing: "forced", trigger: "characterDestroyedByAttack", subject: { type: "ally", control: "any" }, condition: { kind: "matches", card: "other", pick: { ...AN_ENEMY, isSource: true } }, instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },

  // 21031 The Governor (Cultist). Forced: after a location is revealed from the encounter deck he engages the first player (from another player's area too) and makes an immediate attack.
  { id: "21031:forced:1", cardCode: "21031", lines: ["21031:A:2"], timing: "forced", trigger: "revealed", byEncounterDeck: true, subject: A_LOCATION, instructions: [{ verb: "EngageFirstPlayer", moves: true }, { verb: "ImmediateAttack" }] },

  // 21032 Black Númenórean (Cultist). A shadow card with a shadow effect dealt to him stays faceup on him (KeepDealtShadow, as it is dealt); when the shadow effects of his attack have resolved (the new card's own first) each older faceup shadow card he holds resolves its shadow effect against that attack, in the order dealt.
  { id: "21032:forced:1", cardCode: "21032", lines: ["21032:A:2"], timing: "forced", trigger: "shadowDealtTo", subject: "self", instructions: [{ verb: "KeepDealtShadow" }] },
  { id: "21032:forced:2", cardCode: "21032", lines: ["21032:A:3"], timing: "forced", trigger: "shadowsResolved", subject: "self", instructions: [{ verb: "ResolveHeldShadowEffects" }] },

  // 21033 Bribes (Plot). +1 total Threat in the staging area for each resource here. Forced: when the active location is explored, the top X cards of each player's deck are discarded (X its Threat), then 1 resource is placed here for each event discarded.
  { id: "21033:constant:1", cardCode: "21033", lines: ["21033:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "moreStagingThreat", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "table" }] },
  { id: "21033:forced:1", cardCode: "21033", lines: ["21033:A:2"], timing: "forced", trigger: "activeExplored", instructions: [EACH_PLAYER([{ verb: "DiscardFromDeck", amount: { stat: "threat", of: "subject" } }]), { verb: "PlaceResourcePerDiscarded", cardType: "event", when: { kind: "thenResolves" } }] },

  // 21034 Submit or Die (Plot). Each non-unique enemy gets +1 Attack. Forced: after an enemy attacks and destroys a character it gets 1 damage token; with X (4 more than the players) the players lose.
  { id: "21034:constant:1", cardCode: "21034", lines: ["21034:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: { ...AN_ENEMY, staging: true, nonUnique: true } }] },
  {
    id: "21034:forced:1",
    cardCode: "21034",
    lines: ["21034:A:2"],
    timing: "forced",
    trigger: "characterDestroyedByAttack",
    subject: { type: "character", control: "any" },
    instructions: [{ verb: "PlaceDamage", amount: 1, card: "self" }, { verb: "LoseGame", when: { kind: "not", condition: { kind: "less", left: { stat: "damage", of: "self" }, right: { players: true, plus: 4 } } } }],
  },

  // 21035 Sauron Worship (Plot). Enters play with 1 damage token; each player's threat elimination level is reduced by 1 for each damage token here (a player at the new level is eliminated at once); Forced: at the end of the round it gets 1 more.
  { id: "21035:triggered:1", cardCode: "21035", lines: ["21035:A:1"], timing: "triggered", trigger: "encounterEnteredPlay", subject: "self", instructions: [{ verb: "PlaceDamage", amount: 1, card: "self" }, { verb: "EliminateAtLevel" }] },
  { id: "21035:constant:1", cardCode: "21035", lines: ["21035:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "eliminationReduction", amount: { stat: "damage", of: "self" }, until: "whileSourceInPlay", target: "eachSeat" }] },
  { id: "21035:forced:1", cardCode: "21035", lines: ["21035:A:3"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "PlaceDamage", amount: 1, card: "self" }, { verb: "EliminateAtLevel" }] },

  // 21036 Evidence of the Cult (Clue). Guarded (enemy): when revealed it is guarded by the first enemy discarded. The attached enemy gets +1 Threat, +1 Attack and +1 Defense. Free of encounters it goes to the victory display and the main quest gets 1 resource.
  { id: "21036:whenRevealed:1", cardCode: "21036", lines: ["21036:A:1"], timing: "whenRevealed", instructions: [{ verb: "GuardObjective", types: ["enemy"] }] },
  { id: "21036:constant:1", cardCode: "21036", lines: ["21036:A:2"], timing: "constant", instructions: (["threat", "attack", "defense"] as const).map((stat): Instruction => ({ verb: "ModifyStat", stat, amount: 1, until: "whileSourceInPlay", holders: { ...AN_ENEMY, staging: true, linkedToSource: true } })) },
  { id: "21036:constant:2", cardCode: "21036", lines: ["21036:A:3"], timing: "constant", instructions: [{ verb: "VictoryWhenFreeAddsResource", amount: 1 }] },

  // 21037 Hillside Manor. While in the staging area no player's threat is lowered by more than 1 each round by player card effects. Travel: each player discards 1 random card from his hand.
  { id: "21037:constant:1", cardCode: "21037", lines: ["21037:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "playerThreatReductionCap", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },
  { id: "21037:travel:1", cardCode: "21037", lines: ["21037:A:2"], timing: "travel", instructions: [EACH_PLAYER([{ verb: "DiscardRandomFromHand", when: { kind: "handHasCard" } }])] },

  // 21038 Disappearances. When Revealed: each player discards all allies from his hand; if no card is discarded it gains Doomed 2. Shadow: discard an attachment you control.
  { id: "21038:whenRevealed:1", cardCode: "21038", lines: ["21038:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "DiscardEach", pick: { type: "ally", control: "you", from: "hand" } }]), { verb: "Doomed", amount: 2, when: { kind: "noneDiscarded" } }] },
  { id: "21038:shadow:1", cardCode: "21038", lines: ["21038:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: OWN_ATTACHMENT }, { verb: "DiscardPicked" }] },

  // 21039 Secret Cultist. When Revealed: it attaches to the ally in play with the highest Attack (the first player chooses among those tied) and the ally becomes an enemy engaged with its owner, its text box blank; with no ally it is discarded. It counts as a Condition attachment.
  // When it leaves play, or the ally's owner is eliminated, the ally goes back to its owner's discard pile.
  { id: "21039:whenRevealed:1", cardCode: "21039", lines: ["21039:A:1"], timing: "whenRevealed", instructions: [{ verb: "Pick", pick: HIGHEST_ALLY }, { verb: "AttachSelfToPicked", when: { kind: "canPick", pick: HIGHEST_ALLY } }, { verb: "ConvertAttachedAlly" }] },
  { id: "21039:constant:1", cardCode: "21039", lines: ["21039:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
  { id: "21039:triggered:1", cardCode: "21039", lines: ["21039:A:1"], timing: "triggered", trigger: "leftPlay", subject: "self", instructions: [{ verb: "ReturnConvertedAlly" }] },
  { id: "21039:triggered:2", cardCode: "21039", lines: ["21039:A:1"], timing: "triggered", trigger: "playerEliminated", instructions: [{ verb: "ReturnConvertedAlly", ifOwnerGone: true }] },

  // 21040 Messenger from Mordor. When Revealed: the first player chooses: each player's threat is raised by the active location's Threat, or it makes an immediate attack against the first player (from the staging area).
  {
    id: "21040:whenRevealed:1",
    cardCode: "21040",
    lines: ["21040:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Choose", who: "firstPlayer", options: [{ id: "threat", instructions: [ACTIVE_THREAT] }, { id: "attack", instructions: [{ verb: "AttackFromStaging", target: "self", who: "firstPlayer" }] }] }],
  },

  // 21041 Servant of Sauron (Surge). It engages the first player. Forced: after the engaged player raises his threat it makes an immediate attack (limit once per phase).
  { id: "21041:forced:1", cardCode: "21041", lines: ["21041:A:2"], timing: "forced", trigger: "addedToStaging", subject: "self", instructions: [{ verb: "EngageFirstPlayer" }] },
  { id: "21041:forced:2", cardCode: "21041", lines: ["21041:A:3"], timing: "forced", trigger: "threatRaised", condition: ENGAGED_PLAYER_RAISED, limit: "oncePerPhase", instructions: [{ verb: "ImmediateAttack" }] },

  // 21042 Overwhelmed. When Revealed: until the end of the round the enemies engaged with the first player cannot take damage. Shadow: either raise your threat by 2, or the attacking enemy cannot take damage this round.
  { id: "21042:whenRevealed:1", cardCode: "21042", lines: ["21042:A:2"], timing: "whenRevealed", instructions: [{ verb: "BarDamageToEngaged", who: "firstPlayer", until: "endOfRound" }] },
  {
    id: "21042:shadow:1",
    cardCode: "21042",
    lines: ["21042:A:3"],
    timing: "shadow",
    instructions: [{ verb: "Choose", who: "actor", options: [{ id: "threat", instructions: [{ verb: "RaiseThreat", amount: 2, who: "actor" }] }, { id: "damage", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfRound", target: "attacker" }] }] }],
  },

  // 21043 Shadow of Fear (encounter side quest, Surge). Forced: after an enemy engages a player that player raises his threat by 1. Response: when it is defeated each player's threat is reduced by 3.
  { id: "21043:forced:1", cardCode: "21043", lines: ["21043:A:2"], timing: "forced", trigger: "engaged", subject: AN_ENEMY, instructions: [{ verb: "RaiseThreat", amount: 1, who: "eventSeat" }] },
  { id: "21043:response:1", cardCode: "21043", lines: ["21043:A:3"], timing: "response", trigger: "questDefeated", subject: "self", instructions: [{ verb: "LowerThreat", amount: 3, who: "eachSeat" }] },

  // 21044 Rhûn Backstabber. Forced: after it engages you, either raise your threat by 2 or discard an ally you control with printed cost 2 or higher. Shadow: raise your threat by 1 for each enemy engaged with you (one raise).
  {
    id: "21044:forced:1",
    cardCode: "21044",
    lines: ["21044:A:1"],
    timing: "forced",
    trigger: "engaged",
    subject: "self",
    instructions: [{ verb: "Choose", who: "actor", options: [{ id: "threat", instructions: [{ verb: "RaiseThreat", amount: 2, who: "actor" }] }, { id: "discard", requires: { kind: "canPick", pick: { type: "ally", control: "you", minCost: 2 } }, instructions: [{ verb: "Pick", pick: { type: "ally", control: "you", minCost: 2 } }, { verb: "DiscardPicked" }] }] }],
  },
  { id: "21044:shadow:1", cardCode: "21044", lines: ["21044:A:2"], timing: "shadow", instructions: [{ verb: "RaiseThreat", amount: { count: { ...AN_ENEMY, engaged: "you" } } }] },

  // 21045 Treacherous Easterling. +1 Attack and +1 Defense for each resource on it (limit +3). Forced: after the engaged player raises his threat it gets 1 resource.
  { id: "21045:constant:1", cardCode: "21045", lines: ["21045:A:1"], timing: "constant", instructions: (["attack", "defense"] as const).map((stat): Instruction => ({ verb: "ModifyStat", stat, amount: { stat: "resources", of: "self", limit: 3 }, until: "whileSourceInPlay", target: "self" })) },
  { id: "21045:forced:1", cardCode: "21045", lines: ["21045:A:2"], timing: "forced", trigger: "threatRaised", condition: ENGAGED_PLAYER_RAISED, instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }] },

  // 21046 City Forum. +1 Threat for each resource here. In the staging area: after a location is explored it gets 1 resource. Travel: each player raises his threat by 1 for each resource here (a cost of 0 with none).
  { id: "21046:constant:1", cardCode: "21046", lines: ["21046:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" }] },
  { id: "21046:forced:1", cardCode: "21046", lines: ["21046:A:2"], timing: "forced", trigger: "locationExplored", condition: IN_STAGING, instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }] },
  { id: "21046:travel:1", cardCode: "21046", lines: ["21046:A:3"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: { stat: "resources", of: "self" }, who: "eachSeat" }] },

  // 21047 Seedy Tavern (immune to player card effects). Travel: look at the top 5 cards of the encounter deck, put one of them facedown under it and shuffle the rest back. Forced: when it is explored each facedown card under it is revealed.
  { id: "21047:forced:1", cardCode: "21047", lines: ["21047:A:2"], timing: "forced", trigger: "locationExplored", subject: "self", instructions: [{ verb: "RevealFacedownUnder" }] },
  { id: "21047:travel:1", cardCode: "21047", lines: ["21047:A:3"], timing: "travel", instructions: [{ verb: "LookAtTop", count: 5 }, { verb: "PickEncounter", from: "looked" }, { verb: "PlaceUnderSelf" }, { verb: "ShuffleEncounterDeck" }] },

  // 21048 Darkness in the East. When Revealed: each player's threat is raised by the active location's Threat; with no active location it gains surge. Shadow: +1 Attack (+2 instead if you raised your threat this round).
  { id: "21048:whenRevealed:1", cardCode: "21048", lines: ["21048:A:1"], timing: "whenRevealed", instructions: [{ verb: "GainSurge", when: NO_ACTIVE_LOCATION }, ACTIVE_THREAT] },
  {
    id: "21048:shadow:1",
    cardCode: "21048",
    lines: ["21048:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "raisedThreatThisRound" } },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "raisedThreatThisRound" } } },
    ],
  },

  // 21049 Side Street. While it is in the staging area no progress is placed on the other locations there. Travel: the discard pile is shuffled into the deck and cards are discarded until a location is, which is added to the staging area (not revealed).
  { id: "21049:constant:1", cardCode: "21049", lines: ["21049:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true, other: true } }] },
  { id: "21049:travel:1", cardCode: "21049", lines: ["21049:A:2"], timing: "travel", instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntil", type: "location" }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: PICKED_IS(A_LOCATION) }] },

  // 21050 Catacombs. While it is in the staging area the enemies there cannot take damage. Travel: each player discards the top card of the encounter deck; an enemy discarded is put into play engaged with that player.
  { id: "21050:constant:1", cardCode: "21050", lines: ["21050:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: { ...AN_ENEMY, stagingOnly: true } }] },
  { id: "21050:travel:1", cardCode: "21050", lines: ["21050:A:2"], timing: "travel", instructions: [EACH_PLAYER([{ verb: "MoveEncounterCard", card: "deckTop", to: "discard" }, { verb: "MoveEncounterCard", card: "picked", to: "engaged", when: PICKED_IS(AN_ENEMY) }])] },

  // 21051 Under Guard. When Revealed: the Travel effect of the active location resolves (its cost unpaid, the location not moved); with no active location cards are discarded until a location is, and it is added to the staging area. Shadow: if the attack destroys a character, the same Travel effect resolves.
  {
    id: "21051:whenRevealed:1",
    cardCode: "21051",
    lines: ["21051:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "ResolveActiveTravel" }, { verb: "DiscardUntil", type: "location", when: NO_ACTIVE_LOCATION }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: PICKED_IS(A_LOCATION) }],
  },
  { id: "21051:shadow:1", cardCode: "21051", lines: ["21051:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ResolveActiveTravel", when: { kind: "x", min: 1 } }] }] },

  // 21052 Unwelcome Travelers (encounter side quest). Each location in the staging area gets +1 Threat. Forced: after it becomes the current quest the first player discards cards from the top of the encounter deck until an enemy is discarded and puts it into play engaged with him.
  { id: "21052:constant:1", cardCode: "21052", lines: ["21052:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: { ...A_LOCATION, stagingOnly: true } }] },
  {
    id: "21052:forced:1",
    cardCode: "21052",
    lines: ["21052:A:2"],
    timing: "forced",
    trigger: "becameCurrentQuest",
    subject: "self",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", limit: 1, instructions: [{ verb: "DiscardUntil", type: "enemy" }, { verb: "MoveEncounterCard", card: "picked", to: "engaged", when: PICKED_IS(AN_ENEMY) }] }],
  },

  // 21077 A City in Turmoil (stage 1). Setup: the Plot objectives and the Cultist enemies are set aside (the piles of the scenario); each player in turn takes a different location from the encounter deck (the first player takes Side Street, which is searched first) and the deck is shuffled. The
  // table notes the threat raised each round (Darkness in the East). 1B: Forced: when the active location leaves play explored, 1 resource here; the stage cannot be defeated with fewer than 2.
  {
    id: "21077:setup:1",
    cardCode: "21077",
    lines: ["21077:A:1"],
    timing: "setup",
    instructions: [EACH_PLAYER([{ verb: "SearchMove", type: "location", to: "staging", different: true, deckOnly: true, require: "21049" }]), { verb: "ShuffleEncounterDeck" }, { verb: "ModifyStat", stat: "noteThreatRaised", amount: 1, until: "endOfGame", target: "table" }],
  },
  { id: "21077:forced:1", cardCode: "21077", lines: ["21077:B:1"], timing: "forced", trigger: "activeExplored", instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }] },
  { id: "21077:constant:1", cardCode: "21077", lines: ["21077:B:2"], timing: "constant", condition: CANNOT_DEFEAT_UNLESS(2), instructions: [{ verb: "Restrict", what: "advance" }] },

  // 21078 The Shadow of Mordor (stage 2). When Revealed: 1 random set-aside Plot objective is added to the staging area and each player reveals 1 encounter card. 2B: Forced: when the active location leaves play explored, the top card of the encounter deck is revealed and 1 resource is placed here; the stage
  // cannot be defeated with fewer than X (3 more than the players).
  { id: "21078:whenRevealed:1", cardCode: "21078", lines: ["21078:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddRandomSetAsideToStaging", trait: "Plot" }, EACH_PLAYER([{ verb: "RevealEncounter" }])] },
  { id: "21078:forced:1", cardCode: "21078", lines: ["21078:B:1"], timing: "forced", trigger: "activeExplored", instructions: [{ verb: "RevealEncounter" }, { verb: "PlaceResourceTokens", amount: 1, on: "self", when: { kind: "thenResolves" } }] },
  { id: "21078:constant:1", cardCode: "21078", lines: ["21078:B:2"], timing: "constant", condition: CANNOT_DEFEAT_UNLESS({ players: true, plus: 3 }), instructions: [{ verb: "Restrict", what: "advance" }] },

  // 21079 Leader of the Cult (stage 3). When Revealed: 1 random set-aside Cultist is added to the staging area, the discard pile is shuffled into the deck and cards are discarded until X enemies (one less than the players) are discarded, each added to the staging area. 3B: a Cultist takes at most X damage a round, X the
  // printed quest points of the active location (none with no active location); when a Cultist is defeated the players win.
  { id: "21079:whenRevealed:1", cardCode: "21079", lines: ["21079:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddRandomSetAsideToStaging", trait: "Cultist" }, { verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntilEnemies", perPlayer: 1, less: 1, to: "staging" }] },
  { id: "21079:constant:1", cardCode: "21079", lines: ["21079:B:1"], timing: "constant", condition: ACTIVE_LOCATION, instructions: [{ verb: "ModifyStat", stat: "damageCap", amount: { stat: "questPoints", of: "activeLocation", printed: true }, until: "whileSourceInPlay", holders: { ...CULTIST, staging: true } }] },
  { id: "21079:constant:2", cardCode: "21079", lines: ["21079:B:1"], timing: "constant", condition: NO_ACTIVE_LOCATION, instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: { ...CULTIST, staging: true } }] },
  { id: "21079:triggered:1", cardCode: "21079", lines: ["21079:B:2"], timing: "triggered", trigger: "enemyDestroyed", subject: CULTIST, instructions: [{ verb: "WinGame" }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
