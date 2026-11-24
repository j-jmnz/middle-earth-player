import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { copyLine, withCopies } from "../reprint.ts";
import { AUTHORED_EFFECTS as PERIL } from "./peril-in-pelargir.ts";
import { AUTHORED_EFFECTS as CAIR_ANDROS } from "./the-siege-of-cair-andros.ts";

// Records for The Blood of Gondor (Against the Shadow part 8, no campaign card). Every line is read from the scan ledger (data/printed/against-the-shadow.json). Keywords (Battle, Surge) are the cards' own; the Battle stage keeps an empty record for the reminder text, as the stages of the earlier parts do.
// The piles place The Cross-roads and Black Númenorean in the staging area and set Faramir and Lord Alcaron aside; the Setup puts the two allies into the first player's play area and each ally's own Forced effect gives them to the new first player when the token passes (families/pelargir/hidden-sweep.ts). Hidden cards
// are the top cards of the encounter deck set aside facedown in a play area (families/pelargir/hidden.ts); Captured! puts the two allies under it in the captive zone, in play and controlled by nobody. The readings are in docs/scenarios/against-the-shadow/the-blood-of-gondor.md (Readings). The Ravaging Orcs (05062 to 05064) keep their records of The Siege of Cair Andros.
// Rules: ats.hidden-cards, ats.hidden-cards-turn-faceup, ats.ally-objectives, faq.blood-of-gondor-hidden-cards, faq.errata.06117, faq.errata.06123, hon.battle, hon.siege, hon.archery, rr.forced, rr.travel, rr.surge, rr.engaged, rr.shadow-effects, rr.lasting-effects, rr.reveal, rr.in-play-and-out-of-play,
// rr.running-out-of-cards, rr.player-elimination, rr.first-player (data/rules/entries.json).
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const TAKE: Instruction = { verb: "TakeHiddenCard" };
const PHASE = (is: "Quest" | "Combat") => ({ kind: "phase", is }) as const satisfies Condition;
// "After ~ attacks and destroys a character": the character's destruction by the attack names the attacking enemy as the other card (Brutal Uruk).
const THIS_ENEMY: PickSpec = { type: "enemy", control: "any", isSource: true };
const DESTROYS_A_CHARACTER = { trigger: "characterDestroyedByAttack", subject: { type: "character", control: "any" }, condition: { kind: "matches", card: "other", pick: THIS_ENEMY } } as const satisfies Partial<Effect>;
const WHEN_EXPLORED = { trigger: "leftPlay", subject: "self", condition: { kind: "subjectExplored" } } as const;
// Some hidden card lies in a play area (Faramir's Action is offered only then).
const SOME_HIDDEN = { kind: "less", left: 0, right: { hidden: "all" } } as const satisfies Condition;
// An objective ally belongs to the player who controls it, not to every player (ats.ally-objectives: it is used "the same as any other ally"), though its card type is objective: the Action is the controller's alone, and none while the card lies under Captured!.
const CONTROLLER_ONLY = (name: string) => ({ kind: "canPick", pick: { type: "ally", control: "you", names: [name] } }) as const satisfies Condition;
// No Orc enemy is engaged with any player (Conflict at the Crossroads gains surge).
const ORCS_ENGAGED: PickSpec = { type: "enemy", control: "any", trait: "Orc" };
// "If this attack destroys a character, that character's controller ...": read once the attack has dealt its damage; the player who controls the destroyed character acts, which a Sentinel defender may make another player than the defending one.
const SHADOW_TURN: Effect["instructions"] = [{ verb: "AfterAttack", instructions: [{ verb: "ActForDestroyedController", when: { kind: "x", min: 1 } }, { verb: "TurnHiddenCards", who: "actor", when: { kind: "x", min: 1 } }] }];
const LOSE_WHEN_GONE = (code: string, line: string, name: string): Effect => ({ id: `${code}:forced:2`, cardCode: code, lines: [line], timing: "forced", trigger: "leftPlay", subject: "self", instructions: [{ verb: "LoseGame", reason: `${name} left play` }] });
const ARCHERY_PLAYERS: Instruction = { verb: "ModifyStat", stat: "archeryPlayers", amount: 1, until: "whileSourceInPlay", target: "self" };
const FIVE_BONUS = (code: string, line: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [line], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: 5, until: "whileSourceInPlay", target: "self" }] });

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 06117 The Ambush (stage 1). A:1: the piles place the two staging cards; Faramir and Lord Alcaron come into the first player's play area, the deck is shuffled and each player reveals 1 card (a card revealed in Setup resolves as any revealed card). B:1: at the beginning of the quest phase each player takes 1
    // hidden card. B:2: at the beginning of the combat phase each player in turn chooses: turn each of his hidden cards faceup, or take 1 hidden card (a player with none may choose either).
    {
      id: "06117:setup:1",
      cardCode: "06117",
      lines: ["06117:A:1"],
      timing: "setup",
      instructions: [{ verb: "TakeControlOfSetAside", code: "06132" }, { verb: "TakeControlOfSetAside", code: "06133" }, { verb: "ShuffleEncounterDeck" }, EACH_PLAYER([{ verb: "RevealEncounter" }])],
    },
    { id: "06117:forced:1", cardCode: "06117", lines: ["06117:B:1"], timing: "forced", trigger: "beginningOfPhase", condition: PHASE("Quest"), instructions: [EACH_PLAYER([TAKE])] },
    {
      id: "06117:forced:2",
      cardCode: "06117",
      lines: ["06117:B:2"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: PHASE("Combat"),
      instructions: [EACH_PLAYER([{ verb: "Choose", who: "actor", options: [{ id: "turn", instructions: [{ verb: "TurnHiddenCards", who: "actor" }] }, { id: "take", instructions: [TAKE] }] }])],
    },

    // 06118 Captured! (stage 2, the last). A:1: Faramir and Lord Alcaron lie under it; then each player turns each of his hidden cards faceup, one card at a time, the first player first. B:1: Battle (reminder text). B:2: as 06117:B:1. B:3: a player who holds 5 hidden cards turns them faceup (a settle sweep).
    // B:4: defeating the last stage wins the game.
    { id: "06118:whenRevealed:1", cardCode: "06118", lines: ["06118:A:1"], timing: "whenRevealed", instructions: [{ verb: "HoldUnderStage", codes: ["06132", "06133"] }, { verb: "TurnHiddenCards", who: "eachPlayer" }] },
    copyLine("05065:B:1", "06118:B:1"),
    copyLine("06117:B:1", "06118:B:2"),
    { id: "06118:constant:2", cardCode: "06118", lines: ["06118:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "turnsAtFiveHidden", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    copyLine("05076:B:4", "06118:B:4"),

    // 06119 Black Númenorean. A:1: its Threat is the hidden cards in all play areas, read live. A:2: Forced at the end of the round, in the staging area too: each player raises his threat by the hidden cards in his own play area.
    { id: "06119:constant:1", cardCode: "06119", lines: ["06119:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { hidden: "all" }, until: "whileSourceInPlay" }] },
    { id: "06119:forced:1", cardCode: "06119", lines: ["06119:A:2"], timing: "forced", trigger: "endOfRound", instructions: [EACH_PLAYER([{ verb: "RaiseThreat", amount: { hidden: "own" }, who: "actor" }])] },

    // 06120 Orc Ambusher. A:1: after it engages you (by a hidden turn too) you choose a non-objective ally you control and discard it, if able. A:2 (Shadow): +1 Attack, or +3 Attack instead when the attack is undefended (a total of +3).
    {
      id: "06120:forced:1",
      cardCode: "06120",
      lines: ["06120:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [{ verb: "Pick", pick: { type: "ally", control: "you", nonObjective: true } }, { verb: "DiscardPicked" }],
    },
    {
      id: "06120:shadow:1",
      cardCode: "06120",
      lines: ["06120:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "attacker", when: { kind: "undefended" } },
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "undefended", is: false } },
      ],
    },

    // 06121 Brutal Uruk. A:1: after its own attack destroys a character, that character's controller turns every hidden card faceup, one at a time; each enemy so turned is dealt a shadow card and attacks as normal in this combat phase.
    { id: "06121:forced:1", cardCode: "06121", lines: ["06121:A:1"], timing: "forced", ...DESTROYS_A_CHARACTER, instructions: [{ verb: "TurnHiddenCards", who: "actor", shadow: true }] },

    // 06122 Evil Crow. A:1: when it engages a player (a hidden turn too) that player takes 1 hidden card, which stays facedown during a turn. A:2 (Shadow): the defending player takes 1 hidden card.
    { id: "06122:forced:1", cardCode: "06122", lines: ["06122:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [TAKE] },
    { id: "06122:shadow:1", cardCode: "06122", lines: ["06122:A:2"], timing: "shadow", instructions: [TAKE] },

    // 06123 The Cross-roads. A:1: the current quest card gains Siege and loses Battle while it is in play, staged or active. A:2: its Threat X is the number of players. A:3: Travel, the first player takes 1 hidden card, paid in full or the players cannot travel here.
    {
      id: "06123:constant:1",
      cardCode: "06123",
      lines: ["06123:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "siege", amount: 1, until: "whileSourceInPlay", target: "currentQuest" }, { verb: "ModifyStat", stat: "losesBattle", amount: 1, until: "whileSourceInPlay", target: "currentQuest" }],
    },
    { id: "06123:constant:2", cardCode: "06123", lines: ["06123:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { players: true }, until: "whileSourceInPlay", target: "self" }] },
    { id: "06123:travel:1", cardCode: "06123", lines: ["06123:A:3"], timing: "travel", instructions: [{ verb: "TakeHiddenCard", who: "firstPlayer" }] },

    // 06124 Southern Road, 06125 Western Road, 06126 Northern Road, 06127 Eastern Road: Travel costs of 1, 1, 1 and 2 hidden cards, taken by the first player; the Western and Eastern Road get +5 quest points while in the staging area.
    { id: "06124:travel:1", cardCode: "06124", lines: ["06124:A:1"], timing: "travel", instructions: [{ verb: "TakeHiddenCard", who: "firstPlayer" }] },
    FIVE_BONUS("06125", "06125:A:1"),
    copyLine("06124:A:1", "06125:A:2"),
    copyLine("06124:A:1", "06126:A:1"),
    FIVE_BONUS("06127", "06127:A:1"),
    { id: "06127:travel:1", cardCode: "06127", lines: ["06127:A:2"], timing: "travel", instructions: [{ verb: "TakeHiddenCard", who: "firstPlayer", amount: 2 }] },

    // 06128 The Dark Woods. A:1 and A:2: Archery X, X the players. A:3: after it leaves play as an explored location, the first player discards 1 hidden card of his own at random, unresolved.
    { id: "06128:constant:1", cardCode: "06128", lines: ["06128:A:1", "06128:A:2"], timing: "constant", instructions: [ARCHERY_PLAYERS] },
    { id: "06128:forced:1", cardCode: "06128", lines: ["06128:A:3"], timing: "forced", ...WHEN_EXPLORED, instructions: [{ verb: "DiscardHiddenCard", who: "firstPlayer" }] },

    // 06129 Lying in Wait. A:1: the first player turns each hidden card of his own faceup, one at a time; each card's When Revealed effects resolve (no surge) and a location is added to the staging area.
    { id: "06129:whenRevealed:1", cardCode: "06129", lines: ["06129:A:1"], timing: "whenRevealed", instructions: [{ verb: "TurnHiddenCards", who: "firstPlayer", resolve: true }] },

    // 06130 Mordor Looms (Surge is a keyword). A:2: each player takes 1 hidden card. A:3 (Shadow): after the attack destroys a character, its controller turns each of his hidden cards faceup.
    { id: "06130:whenRevealed:1", cardCode: "06130", lines: ["06130:A:2"], timing: "whenRevealed", instructions: [EACH_PLAYER([TAKE])] },
    { id: "06130:shadow:1", cardCode: "06130", lines: ["06130:A:3"], timing: "shadow", instructions: SHADOW_TURN },

    // 06131 Conflict at the Crossroads. A:1: until the end of the phase each Orc enemy engaged with a player adds its Threat to the staging area, those engaged later in the phase too (`engagedOrcThreat`, read live); with no Orc engaged it gains surge. A:2 (Shadow): the defending player takes 1 hidden card.
    {
      id: "06131:whenRevealed:1",
      cardCode: "06131",
      lines: ["06131:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ModifyStat", stat: "engagedOrcThreat", amount: 1, until: "endOfPhase", target: "table" }, { verb: "GainSurge", when: { kind: "count", pick: ORCS_ENGAGED, max: 0 } }],
    },
    copyLine("06122:A:2", "06131:A:2"),

    // 06132 Faramir. A:1: the first player gains control of him, each time the token passes (the Setup gave him to the first player). A:2: Combat Action, exhaust him: a player chosen among those who hold a hidden card has 1 of his hidden cards turned faceup; an enemy takes 3 damage first and one destroyed never engages.
    // A:3: if he leaves play, the players lose.
    { id: "06132:forced:1", cardCode: "06132", lines: ["06132:A:1"], timing: "forced", trigger: "firstPlayerTokenPassed", instructions: [{ verb: "GainControlOfSelf" }] },
    { id: "06132:action:1", cardCode: "06132", lines: ["06132:A:2"], timing: "action", condition: { kind: "all", conditions: [PHASE("Combat"), SOME_HIDDEN, CONTROLLER_ONLY("Faramir")] }, cost: { kind: "exhaustSelf" }, instructions: [{ verb: "TurnHiddenCard", damageEnemy: 3 }] },
    LOSE_WHEN_GONE("06132", "06132:A:3", "Faramir"),

    // 06133 Lord Alcaron. A:1: as Faramir's. A:2: Action, exhaust him: return an enemy engaged with you to the staging area. A:3: if he leaves play, the players lose.
    { id: "06133:forced:1", cardCode: "06133", lines: ["06133:A:1"], timing: "forced", trigger: "firstPlayerTokenPassed", instructions: [{ verb: "GainControlOfSelf" }] },
    {
      id: "06133:action:1",
      cardCode: "06133",
      lines: ["06133:A:2"],
      timing: "action",
      condition: { kind: "all", conditions: [CONTROLLER_ONLY("Lord Alcaron"), { kind: "canPick", pick: { type: "enemy", control: "any", engaged: "you" } }] },
      cost: { kind: "exhaustSelf" },
      instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", engaged: "you" } }, { verb: "ReturnToStaging", target: { kind: "picked" } }],
    },
    LOSE_WHEN_GONE("06133", "06133:A:3", "Lord Alcaron"),
  ],
  { pool: [...PERIL, ...CAIR_ANDROS] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
