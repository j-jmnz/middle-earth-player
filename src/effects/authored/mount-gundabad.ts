import type { Condition, Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as FIRE_IN_THE_NIGHT } from "./fire-in-the-night.ts";
import { AUTHORED_EFFECTS as THE_WITHERED_HEATH } from "./the-withered-heath.ts";
import { copyLine, withCopies } from "./reprint.ts";

// Records for Mount Gundabad (Ered Mithrin part 8, campaign card 12193): the quest cards, Dagnir, the cards of the scenario's own encounter set, the First Forge and the Caves cards it adds, Wormsbane's Reforged side and the campaign card. Dragon-sickness (12194) is in pool/EMCE.ts.
// Every line is read from the scan ledger (data/printed/ered-mithrin.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here. The piles place Dagnir in the staging area and set The First Forge aside; the quest card's Setup builds
// the quest deck: the seven Exploring Gundabad stage 2s are shuffled with side A up (`FlipAtQuestPhase`, which marks each as a stage of a quest deck: families/quest/order.ts), the Caves deck is shuffled and Wormsbane, Broken side up, is attached to a hero. The current stage is flipped
// to side B at the beginning of the quest phase, may be bypassed at the end of the combat phase (families/wilderland/gundabad.ts) and goes to the victory display when it is defeated.
// Rules: emce.gundabad-quest-deck, emce.bypassing, emce.setup-mount-gundabad, emce.caves-deck-gundabad, emce.treasure, emce.campaign-log, emce.campaign-pool-encounter, emce.immune, emce.indestructible, rr.guarded, rr.quest-advancement, rr.first-player (data/rules/entries.json).
// "The quest cards in the victory display" (X is 1 more than their number, 19125:A:1) counts The Side Door and each stage 2 defeated.
const QUESTS_IN_VICTORY: PickSpec = { type: "card", control: "any", from: "victory", questCardType: true };
const X = { count: QUESTS_IN_VICTORY, plus: 1 } as const;
const AT_LEAST_QUESTS = (min: number): Extract<Condition, { kind: "count" }> => ({ kind: "count", pick: QUESTS_IN_VICTORY, min });
// Dagnir wherever she is in play, in the staging area or engaged: the holder of a lasting effect, and the enemy a Forced effect or a When Revealed picks.
const DAGNIR_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Dagnir"] };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]) => ({ verb: "ForEachPlayer" as const, order: "firstFirst" as const, instructions });
// "Each player may ...": the player takes the first option when it can be done, or leaves.
type Simple = Extract<Instruction, { verb: "Choose" }>["options"][number]["instructions"];
const MAY = (requires: Condition | undefined, instructions: Simple) => ({
  verb: "Choose" as const,
  who: "actor" as const,
  options: [{ id: "do", ...(requires ? { requires } : {}), instructions }, { id: "decline", instructions: [] }],
});
const NOT_FIRST_PLAYER: Condition = { kind: "not", condition: { kind: "firstPlayer" } };
// Dagnir "has no hit points remaining": her damage has reached her hit points.
const DAGNIR_SPENT: Condition = { kind: "less", left: { stat: "hitPoints", ofNamed: "Dagnir", plus: -1 }, right: { stat: "damage", ofNamed: "Dagnir" } };
const PICKED_IS_LOCATION: Condition = { kind: "matches", card: "picked", pick: { type: "location", control: "any" }, inPlay: false };
// The stages 2: Exploring Gundabad 2A, shuffled into the quest deck at Setup.
const STAGE_TWOS = ["19135", "19137", "19138", "19139", "19140", "19141", "19142"];
const WORMSBANE = "19143";
const REFORGED = "19144";
// "Return Dagnir to the staging area." (When Revealed of every stage 2)
const RETURN_DAGNIR: Instruction[] = [{ verb: "Pick", pick: DAGNIR_ENEMY }, { verb: "ReturnToStaging", target: { kind: "picked" } }];
// "Forced: When this stage is defeated, ...": the stage is out of play by then and hears its own defeat.
const DEFEATED = { trigger: "questCardDefeated", subject: "self" } as const;
// "After characters are committed to the quest": as the staging step begins (families/wilderland/gundabad.ts notes the reading).
const COMMITTED = { trigger: "stagingStepBegins" } as const;

// A stage 2's side A: Dagnir returns to the staging area when it is revealed, and it is flipped at the beginning of the quest phase, not when it arrives (19135:A:1 and A:2 on each).
const sideA = (code: string): Effect[] => [
  { id: `${code}:whenRevealed:1`, cardCode: code, lines: [`${code}:A:1`], timing: "whenRevealed", instructions: RETURN_DAGNIR },
  { id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:2`], timing: "constant", instructions: [{ verb: "FlipAtQuestPhase" }] },
  { id: `${code}:forced:1`, cardCode: code, lines: [`${code}:A:2`], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "phase", is: "Quest" }, instructions: [{ verb: "FlipCurrentQuest" }] },
];
// "At the end of the combat phase, the players may bypass this stage." The first player answers for the group; with no other stage in the quest deck there is nothing to bypass to.
export const mayBypass = (id: string, code: string, line: string): Effect => ({
  id,
  cardCode: code,
  lines: [line],
  timing: "forced",
  trigger: "endOfPhase",
  condition: { kind: "phase", is: "Combat" },
  instructions: [{ verb: "Choose", who: "firstPlayer", options: [{ id: "bypass", requires: { kind: "questDeck" }, instructions: [{ verb: "BypassStage" }] }, { id: "stay", instructions: [] }] }],
});
// "Forced: When this stage is defeated, ...": the record of one stage's defeat.
export const whenDefeated = (id: string, code: string, line: string, instructions: Instruction[]): Effect => ({ id, cardCode: code, lines: [line], timing: "forced", ...DEFEATED, instructions });

// "The first player looks at the top 2 cards of the quest deck and chooses 1 to place on the bottom of the quest deck" (19134:B:1, 19140:B:2): the stage names LookAtStages, so advancing from it asks first (families/quest/order.ts), in a frame of this record.
const LOOK_AT_STAGES = (id: string, code: string, line: string): Effect => whenDefeated(id, code, line, [{ verb: "LookAtStages", count: 2, bottom: true }]);

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 12193 Mount Gundabad (campaign card). Setup: with 6 or more treasures in the log Dragon-sickness is shuffled into the encounter deck; a player may search their deck for a unique boon ally; with Melanwar's line the first player removes 2 non-unique locations from the encounter
    // deck and 1 location from the Caves deck, with Beldis's 3 treacheries. Side B: the Discover keyword is ignored and unique locations cannot be discarded from play by encounter card effects. Resolution: the players look at 3 random undiscovered treasures and choose 1;
    // they discover each treasure they control; A Growing Threat leaves the pool; with 6 or more treasures in the log (the ones just discovered included) Dragon-sickness joins the pool.
    {
      id: "12193:campaignSetup:1",
      cardCode: "12193",
      lines: ["12193:A:2"],
      timing: "campaignSetup",
      instructions: [
        { verb: "ShuffleIntoEncounterDeck", code: "12194", when: { kind: "treasuresLogged", min: 6 } },
        { verb: "SearchBoonAllyToHand" },
        { verb: "RemoveFromEncounterDeckIfLogged", line: "melanwar", count: 2, cardType: "location", nonUnique: true },
        { verb: "RemoveFromCavesIfLogged", line: "melanwar", count: 1, cardType: "location" },
        { verb: "RemoveFromEncounterDeckIfLogged", line: "beldis", count: 3, cardType: "treachery" },
      ],
    },
    { id: "12193:constant:1", cardCode: "12193", lines: ["12193:B:1"], timing: "constant", instructions: [{ verb: "IgnoreKeyword", keywords: ["discover"] }] },
    {
      id: "12193:constant:2",
      cardCode: "12193",
      lines: ["12193:B:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "cannotBeDiscardedByEncounter", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", staging: true, unique: true } }],
    },
    { id: "12193:resolution:1", cardCode: "12193", lines: ["12193:B:2"], timing: "resolution", instructions: [{ verb: "ChooseRandomTreasure", count: 3 }] },
    copyLine("12187:B:3", "12193:B:3"),
    { id: "12193:resolution:3", cardCode: "12193", lines: ["12193:B:4"], timing: "resolution", instructions: [{ verb: "RemoveFromPool", codes: ["12167"] }] },
    { id: "12193:resolution:4", cardCode: "12193", lines: ["12193:B:5"], timing: "resolution", instructions: [{ verb: "AddEncounterToPool", codes: ["12194"], when: { kind: "treasuresLogged", min: 6 } }] },

    // 19134 The Side Door (stage 1). Setup: Dagnir and The First Forge are placed by the piles; the Caves deck is shuffled, the stage 2s are shuffled into the quest deck with side A up, Wormsbane (Broken side up) is attached to a hero the first player
    // chooses, the encounter deck is shuffled and a location for each player but the first joins the staging area. Side B: at the end of the planning phase the first player looks at the top 2 stages of the quest deck and puts 1 on the bottom, then The Side Door goes to
    // the victory display and the quest advances to the top stage 2A (the defeated stage goes to the victory display and the look at the stages below makes the advance ask: families/quest/order.ts).
    {
      id: "19134:setup:1",
      cardCode: "19134",
      lines: ["19134:A:1"],
      timing: "setup",
      instructions: [
        { verb: "ShufflePile", pile: "caves" },
        { verb: "ShuffleStages", codes: STAGE_TWOS },
        { verb: "SetAside", code: WORMSBANE },
        { verb: "Pick", pick: { type: "hero", control: "you", attachable: WORMSBANE } },
        { verb: "AttachSetAside", code: WORMSBANE },
        { verb: "ShuffleEncounterDeck" },
        EACH_PLAYER([
          { verb: "DiscardUntil", type: "location", when: NOT_FIRST_PLAYER },
          { verb: "MoveEncounterCard", card: "picked", to: "staging", when: PICKED_IS_LOCATION },
        ]),
      ],
    },
    {
      id: "19134:forced:1",
      cardCode: "19134",
      lines: ["19134:B:1"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "phase", is: "Planning" },
      instructions: [{ verb: "AdvanceStage" }, { verb: "FlipCurrentQuest" }],
    },
    LOOK_AT_STAGES("19134:forced:2", "19134", "19134:B:1"),

    // 19135 Exploring Gundabad (The Upper Levels, 3 quest points). After the characters are committed each player raises their threat by 1; defeated, The First Forge is shuffled into the Caves deck.
    ...sideA("19135"),
    { id: "19135:forced:2", cardCode: "19135", lines: ["19135:B:1"], timing: "forced", ...COMMITTED, instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }] },
    whenDefeated("19135:forced:3", "19135", "19135:B:2", [{ verb: "ShuffleSetAsideIntoPile", pile: "caves", code: "19122", count: 1 }]),
    mayBypass("19135:forced:4", "19135", "19135:B:3"),

    // 19137 Exploring Gundabad (The Lower Deeps, 3). The When Revealed effects of the first treachery revealed each round cannot be canceled; defeated, the first player searches the Caves deck for a location, which becomes the active location, and the deck is shuffled.
    ...sideA("19137"),
    { id: "19137:constant:2", cardCode: "19137", lines: ["19137:B:1"], timing: "constant", instructions: [{ verb: "UncancelableWhenRevealed", cardType: "treachery", firstRevealedEachRound: true }] },
    whenDefeated("19137:forced:2", "19137", "19137:B:2", [{ verb: "ActivateFromCaves" }, { verb: "ShufflePile", pile: "caves" }]),
    mayBypass("19137:forced:3", "19137", "19137:B:3"),

    // 19138 Exploring Gundabad (Frenzied Warrens, 3). After the characters are committed the top 5 cards of the encounter deck are discarded and a random enemy among them joins the staging area; defeated, each player's threat is reduced by 5.
    ...sideA("19138"),
    { id: "19138:forced:2", cardCode: "19138", lines: ["19138:B:1"], timing: "forced", ...COMMITTED, instructions: [{ verb: "DiscardEncounterTop", count: 5 }, { verb: "StageRandomDiscarded", type: "enemy" }] },
    whenDefeated("19138:forced:3", "19138", "19138:B:2", [{ verb: "LowerThreat", amount: 5, who: "eachSeat" }]),
    mayBypass("19138:forced:4", "19138", "19138:B:3"),

    // 19139 Exploring Gundabad (Dagnir's Wrath, 3). After the characters are committed Dagnir attacks each player with 6 or more characters; defeated, 5 damage are dealt to Dagnir, which Dagnir's text does not limit (the damage of a quest card's effect is not held to her cap nor counted
    // against it: 19125:A:2).
    ...sideA("19139"),
    {
      id: "19139:forced:2",
      cardCode: "19139",
      lines: ["19139:B:1"],
      timing: "forced",
      ...COMMITTED,
      instructions: [{ verb: "Pick", pick: DAGNIR_ENEMY }, EACH_PLAYER([{ verb: "AttackFromStaging", orEngaged: true, when: { kind: "count", pick: { type: "character", control: "you" }, min: 6 } }])],
    },
    whenDefeated("19139:forced:3", "19139", "19139:B:2", [{ verb: "Pick", pick: DAGNIR_ENEMY }, { verb: "DamageCard", amount: 5, target: "picked" }]),
    mayBypass("19139:forced:4", "19139", "19139:B:3"),

    // 19140 Exploring Gundabad (Foreboding Darkness, 3). Each player cannot play more than 1 card each phase; defeated, the first player looks at the top 2 stages of the quest deck, puts 1 on the bottom and the quest advances to the top stage 2A (the stage names LookAtStages, so its defeat asks first: families/quest/order.ts).
    ...sideA("19140"),
    { id: "19140:constant:2", cardCode: "19140", lines: ["19140:B:1"], timing: "constant", instructions: [{ verb: "LimitPlaysPerPhase", max: 1 }] },
    LOOK_AT_STAGES("19140:forced:2", "19140", "19140:B:2"),
    mayBypass("19140:forced:3", "19140", "19140:B:3"),

    // 19141 Exploring Gundabad (Imminent Pursuit, 3). After the characters are committed each player deals 2 damage to a questing character they control; defeated, the first player discards a non-unique enemy from play.
    ...sideA("19141"),
    {
      id: "19141:forced:2",
      cardCode: "19141",
      lines: ["19141:B:1"],
      timing: "forced",
      ...COMMITTED,
      instructions: [
        EACH_PLAYER([
          { verb: "Pick", pick: { type: "character", control: "you", committed: true }, when: { kind: "canPick", pick: { type: "character", control: "you", committed: true } } },
          { verb: "DamageCard", amount: 2, target: "picked", when: { kind: "canPick", pick: { type: "character", control: "you", committed: true } } },
        ]),
      ],
    },
    whenDefeated("19141:forced:3", "19141", "19141:B:2", [
      { verb: "Pick", pick: { type: "enemy", control: "any", staging: true, nonUnique: true, who: "firstPlayer" }, when: { kind: "canPick", pick: { type: "enemy", control: "any", staging: true, nonUnique: true } } },
      { verb: "Discard", target: { kind: "picked" }, when: { kind: "canPick", pick: { type: "enemy", control: "any", staging: true, nonUnique: true } } },
    ]),
    mayBypass("19141:forced:4", "19141", "19141:B:3"),

    // 19142 Exploring Gundabad (The Great Worm, no quest points). Dagnir gets -5 engagement cost for each character the first player controls. Response: after a player resolves an attack against Dagnir with no hit points remaining on her, that player may discard a Reforged Wormsbane they
    // control to add Dagnir to the victory display, and the players win. At the end of the combat phase with 4 or fewer quest cards in the victory display the players must bypass this stage.
    ...sideA("19142"),
    {
      id: "19142:constant:2",
      cardCode: "19142",
      lines: ["19142:B:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: { count: { type: "character", control: "you", who: "firstPlayer" }, times: 5, negative: true }, until: "whileSourceInPlay", holders: DAGNIR_ENEMY }],
    },
    {
      id: "19142:response:1",
      cardCode: "19142",
      lines: ["19142:B:2"],
      timing: "response",
      trigger: "attacked",
      subject: { type: "character", control: "any" },
      answeredBy: "eventSeat",
      condition: { kind: "all", conditions: [{ kind: "matches", card: "other", pick: DAGNIR_ENEMY }, DAGNIR_SPENT] },
      instructions: [
        MAY({ kind: "canPick", pick: { type: "card", control: "you", names: ["Wormsbane"], trait: "Reforged" } }, [
          { verb: "Pick", pick: { type: "card", control: "you", names: ["Wormsbane"], trait: "Reforged" } },
          { verb: "Discard", target: { kind: "picked" } },
          { verb: "Pick", pick: DAGNIR_ENEMY },
          { verb: "AddToVictory", target: "picked" },
          { verb: "WinGame" },
        ]),
      ],
    },
    {
      id: "19142:forced:2",
      cardCode: "19142",
      lines: ["19142:B:3"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "count", pick: QUESTS_IN_VICTORY, max: 4 }] },
      instructions: [{ verb: "BypassStage" }],
    },

    // 19122 The First Forge (Immune to player card effects is a keyword). After it becomes the active location the hero with Wormsbane attached is exhausted, and cannot ready while it is the active location. Response: after it is explored, Wormsbane is flipped to its Reforged side and attached to any hero.
    {
      id: "19122:forced:1",
      cardCode: "19122",
      lines: ["19122:A:2"],
      timing: "forced",
      trigger: "becameActive",
      subject: "self",
      instructions: [
        { verb: "Pick", pick: { type: "hero", control: "any", hasAttachment: { names: ["Wormsbane"] } } },
        { verb: "Exhaust", target: { kind: "picked" } },
        { verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "whileSourceActive", target: "picked" },
      ],
    },
    {
      id: "19122:response:1",
      cardCode: "19122",
      lines: ["19122:A:3"],
      timing: "response",
      trigger: "leftPlay",
      subject: "self",
      condition: { kind: "subjectExplored" },
      instructions: [{ verb: "Pick", pick: { type: "hero", control: "any" } }, { verb: "FlipInPlace", code: WORMSBANE, into: REFORGED, attachTo: "picked" }],
    },

    // 19123 Dagnir's Hoard (Caves deck, unique). When it is explored Dagnir returns to the staging area and attacks each player in turn order; Response: after it is explored each player may search their deck for an Item attachment, add it to hand and shuffle.
    {
      id: "19123:forced:1",
      cardCode: "19123",
      lines: ["19123:A:1"],
      timing: "forced",
      trigger: "locationExplored",
      subject: "self",
      instructions: [...RETURN_DAGNIR, EACH_PLAYER([{ verb: "AttackFromStaging" }])],
    },
    {
      id: "19123:response:1",
      cardCode: "19123",
      lines: ["19123:A:2"],
      timing: "response",
      trigger: "leftPlay",
      subject: "self",
      condition: { kind: "subjectExplored" },
      instructions: [
        EACH_PLAYER([
          // The deck is shuffled by the search: a player who does not search leaves it as it is.
          MAY({ kind: "canPick", pick: { type: "card", control: "you", from: "deck", cardType: "attachment", trait: "Item" } }, [{ verb: "Pick", pick: { type: "card", control: "you", from: "deck", cardType: "attachment", trait: "Item" } }, { verb: "MovePicked", to: "hand" }, { verb: "ShuffleDeck" }]),
        ]),
      ],
    },
    // 19124 Throat of the Mountain (Caves deck, unique). Response: when it is explored the players search the quest deck for a quest card, make it the current main quest and flip it over; the quest deck is shuffled.
    { id: "19124:response:1", cardCode: "19124", lines: ["19124:A:1"], timing: "response", trigger: "leftPlay", subject: "self", condition: { kind: "subjectExplored" }, instructions: [{ verb: "SearchQuestDeck" }] },

    // 19125 Dagnir (Indestructible and Immune to player card effects are keywords). X is 1 more than the number of quest cards in the victory display: she takes at most X damage each round from effects other than a quest card's (a quest card's damage is neither held to the cap nor counted
    // against it). With 5 or more quest cards in the victory display she cannot leave the staging area and is considered engaged with each player, as the Watcher in the Water is.
    {
      id: "19125:constant:1",
      cardCode: "19125",
      lines: ["19125:A:1", "19125:A:2"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "damageCap", amount: X, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "damageCapSparesQuest", amount: 1, until: "whileSourceInPlay", target: "self" }],
    },
    {
      id: "19125:constant:2",
      cardCode: "19125",
      lines: ["19125:A:3"],
      timing: "constant",
      condition: AT_LEAST_QUESTS(5),
      instructions: [
        { verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "engagedWithAll", amount: 1, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "attackableByAny", amount: 1, until: "whileSourceInPlay", target: "self" },
      ],
    },

    // 19126 Guardian of Gundabad. +2 Defense with 3 or more quest cards in the victory display. Shadow: the attacker gets +2 Defense until the end of the phase.
    { id: "19126:constant:1", cardCode: "19126", lines: ["19126:A:1"], timing: "constant", condition: AT_LEAST_QUESTS(3), instructions: [{ verb: "ModifyStat", stat: "defense", amount: 2, until: "whileSourceInPlay", target: "self" }] },
    { id: "19126:shadow:1", cardCode: "19126", lines: ["19126:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: 2, until: "endOfPhase", target: "attacker" }] },

    // 19127 Dagnir's Slave. Dagnir takes no damage from effects other than a quest card's. Shadow: the attacker gets +1 Attack, +2 instead if Dagnir is engaged with the defending player.
    { id: "19127:constant:1", cardCode: "19127", lines: ["19127:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotTakeNonQuestDamage", amount: 1, until: "whileSourceInPlay", holders: DAGNIR_ENEMY }] },
    {
      id: "19127:shadow:1",
      cardCode: "19127",
      lines: ["19127:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "canPick", pick: { type: "enemy", control: "any", engaged: "you", names: ["Dagnir"] } } } },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "canPick", pick: { type: "enemy", control: "any", engaged: "you", names: ["Dagnir"] } } },
      ],
    },

    // 19128 Deep-dweller. When it engages a player it makes an immediate attack; after it takes damage and survives it returns to the staging area.
    { id: "19128:forced:1", cardCode: "19128", lines: ["19128:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "ImmediateAttack" }] },
    { id: "19128:forced:2", cardCode: "19128", lines: ["19128:A:2"], timing: "forced", trigger: "damaged", subject: "self", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] },

    // 19129 Mines of Gundabad (Deep). Dagnir gets -10 engagement cost. Shadow: if the attacker is Dagnir the defending player assigns X damage among the characters they control, X 1 more than the quest cards in the victory display.
    copyLine("19016:A:1", "19129:A:1"),
    { id: "19129:constant:2", cardCode: "19129", lines: ["19129:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -10, until: "whileSourceInPlay", holders: DAGNIR_ENEMY }] },
    {
      id: "19129:shadow:1",
      cardCode: "19129",
      lines: ["19129:A:3"],
      timing: "shadow",
      instructions: [{ verb: "AssignDamage", amount: X, pick: { type: "character", control: "you" }, when: { kind: "matches", card: "attacker", pick: DAGNIR_ENEMY } }],
    },

    // 19130 Narrow Stair (Deep). With no active location the players must travel to it. Shadow: the defending character cannot be readied by player card effects until the end of the round.
    copyLine("19016:A:1", "19130:A:1"),
    { id: "19130:constant:2", cardCode: "19130", lines: ["19130:A:2"], timing: "constant", instructions: [{ verb: "Restrict", what: "travelOnly" }] },
    { id: "19130:shadow:1", cardCode: "19130", lines: ["19130:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotReadyByPlayerCard", amount: 1, until: "endOfRound", target: "defender" }] },

    // 19131 Desecrated Ruins (Deep). +2 Threat with 3 or more quest cards in the victory display. Shadow: the attacker gets +1 Attack; if the attack destroys a character, each player discards a card at random from their hand.
    copyLine("19016:A:1", "19131:A:1"),
    { id: "19131:constant:2", cardCode: "19131", lines: ["19131:A:2"], timing: "constant", condition: AT_LEAST_QUESTS(3), instructions: [{ verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "19131:shadow:1",
      cardCode: "19131",
      lines: ["19131:A:3"],
      timing: "shadow",
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "AfterAttack", instructions: [{ verb: "DiscardRandomFromHand", who: "eachSeat", when: { kind: "x", min: 1 } }] }],
    },

    // 19132 Wilderland's Bane. When Revealed: Dagnir attacks each player she is engaged with (the player she is engaged with, or every player once she is considered engaged with each); if she made no attack she gets -30 engagement cost until the end of the round. Shadow: the attacker makes an additional attack against the defending player.
    {
      id: "19132:whenRevealed:1",
      cardCode: "19132",
      lines: ["19132:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: DAGNIR_ENEMY },
        EACH_PLAYER([{ verb: "AttackFromStaging", orEngaged: true, when: { kind: "any", conditions: [{ kind: "canPick", pick: { type: "enemy", control: "any", engaged: "you", names: ["Dagnir"] } }, AT_LEAST_QUESTS(5)] } }]),
        { verb: "ModifyStat", stat: "engagementCost", amount: -30, until: "endOfRound", holders: DAGNIR_ENEMY, when: { kind: "noneReturned" } },
      ],
    },
    copyLine("19081:A:2", "19132:A:2"),

    // 19133 Suffocating Shadows. When Revealed: each player assigns X damage among the allies they control, X 1 more than the quest cards in the victory display. Shadow: the attacker gets +1 Attack, +3 instead with 3 or more quest cards in the victory display.
    { id: "19133:whenRevealed:1", cardCode: "19133", lines: ["19133:A:1"], timing: "whenRevealed", instructions: [{ verb: "AssignDamage", amount: X, pick: { type: "ally", control: "you" }, who: "eachSeat" }] },
    {
      id: "19133:shadow:1",
      cardCode: "19133",
      lines: ["19133:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: AT_LEAST_QUESTS(3) } },
        { verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "attacker", when: AT_LEAST_QUESTS(3) },
      ],
    },

    // 19144 Wormsbane, Reforged side. Attached hero gets +X Attack, X 1 more than the number of quest cards in the victory display; if the attached hero leaves play, the players lose the game (its hero holds the flag the engine reads as it is destroyed, as the template writes it for the Broken side,
    // 19143:A:3). Attach to a hero and Restricted (19144:A:1) and the whole Broken side are templates.
    { id: "19144:constant:2", cardCode: REFORGED, lines: ["19144:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: X, until: "whileSourceInPlay", target: "host" }] },
    { id: "19144:constant:3", cardCode: REFORGED, lines: ["19144:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "lossOnLeavingPlay", amount: 1, until: "whileSourceInPlay", target: "host" }] },
  ],
  { pool: [...FIRE_IN_THE_NIGHT, ...THE_WITHERED_HEATH] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
