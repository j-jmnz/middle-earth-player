import type { Condition, Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as FLIGHT_TO_THE_FORD } from "./flight-to-the-ford.ts";
import { AUTHORED_EFFECTS as THE_URUK_HAI } from "./the-uruk-hai.ts";
import { AUTHORED_EFFECTS as TEMPLE } from "./temple-of-the-deceived.ts";
import { copyLine, withCopies } from "./reprint.ts";

// Records for The Road to Isengard (the-two-towers part 3, campaign card 143081, whose records are in the-two-towers.ts): the Wizardry timing (mec112.wizardry: the wizardry family), the pressure on the players' hands
// (the deck family: draws, discards, the elimination at an empty hand), Saruman and the last stage's win gate, and the encounter cards no template reads. Every line is read from the scan ledger
// (data/printed/the-two-towers.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here. The piles place Gates of Isengard, Orthanc, Saruman and
// Saruman's Staff aside and the Ents of Fangorn in the staging area (the first two sentences of 143078:A:1); its record shuffles the encounter deck. See docs/brief.md, The Two Towers, for each reading.
// A Wizardry line's record is a `forced` effect with the trigger `wizardry`: it answers the exploring of its location (in the staging area too), and TriggerWizardry runs it for Machines of Isengard and Saruman.
// Rules: mec112.wizardry, mec112.saga-staging-rules, mec112.peril, rr.explored, rr.forced, faq.triggering-forced-effects, rr.triggered-ability, rr.constant-ability, rr.lasting-effects, faq.lasting-effects, rr.player-elimination, rr.resources, rr.objective-cards,
// faq.additional-attacks (data/rules/entries.json).
const ENT = "143046";
const SARUMAN = "143047";
const STAFF = "143048";
const ORTHANC = "143053";
const GATES = "143054";
const STAGE_2 = "143079";
const STAGE_3 = "143080";
const A_CHARACTER: PickSpec = { type: "character", control: "any" };
const THIS_ENEMY: PickSpec = { type: "enemy", control: "any", isSource: true };
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const THREE_RESOURCES: Condition = { kind: "less", left: 2, right: { stat: "resources", of: "self" } };
const ENT_PICK: PickSpec = { type: "ally", control: "you", names: ["Ent of Fangorn"], state: "ready" };
const NON_UNIQUE_LOCATION: PickSpec = { type: "location", control: "any", nonUnique: true };
const ORTHANC_PICK: PickSpec = { type: "location", control: "any", names: ["Orthanc"] };
const SARUMAN_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Saruman"] };
const HAS_CARDS_IN_HAND: PickSpec = { type: "card", control: "you", from: "hand" };
// "That character's Willpower is greater than the discarded card's Threat" (the Ent and the Palantír, one shape: 142058:A:2): the discarded card has no Threat unless it prints one (a Threat of 0).
const THREAT_BELOW = (willpowerOf: "previous" | "host"): Condition => ({ kind: "less", left: { stat: "threat", of: "discardTop" }, right: { stat: "willpower", of: willpowerOf } });
// "After ~ attacks and destroys a character": the character's destruction by the attack names the attacking enemy as the other card, and `isSource` keeps it to the copy that attacked.
const DESTROYS_A_CHARACTER = { trigger: "characterDestroyedByAttack", subject: A_CHARACTER, condition: { kind: "matches", card: "other", pick: THIS_ENEMY } } as const satisfies Partial<Effect>;
// A location's Wizardry line: answers the exploring of the card itself (mec112.wizardry) and is the effect TriggerWizardry runs.
const WIZARDRY = { timing: "forced", trigger: "wizardry", subject: "self", condition: { kind: "subjectExplored" } } as const satisfies Partial<Effect>;
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 143020 Palantír of Orthanc (the boon of the campaign card's Resolution). It attaches to Fellowship Aragorn. Its Quest Action exhausts Aragorn and itself, discards the top encounter card and, when Aragorn's
    // Willpower beats that card's Threat, may go to the victory display and out of the campaign pool to make a chosen player reveal 1 fewer encounter card this phase.
    { id: "143020:constant:1", cardCode: "143020", lines: ["143020:A:1"], timing: "constant", instructions: [{ verb: "AttachesTo", hosts: [{ type: "hero", control: "you", names: ["Aragorn"], spheres: ["fellowship"] }] }] },
    {
      id: "143020:action:1",
      cardCode: "143020",
      lines: ["143020:A:2"],
      timing: "action",
      condition: { kind: "phase", is: "Quest" },
      cost: [{ kind: "exhaustSelf" }, { kind: "exhaustHost" }],
      instructions: [
        { verb: "MoveEncounterCard", card: "deckTop", to: "discard" },
        {
          verb: "Choose",
          who: "actor",
          options: [
            {
              id: "use",
              requires: THREAT_BELOW("host"),
              instructions: [{ verb: "RemoveFromCampaignPool" }, { verb: "AddSourceToVictory" }, { verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "RevealFewer", amount: 1, min: 0, who: "picked" }],
            },
            { id: "skip", instructions: [] },
          ],
        },
      ],
    },

    // 143046 Ent of Fangorn (objective ally). In the staging area it gains a Quest Action any player may trigger: exhaust a hero, discard the top encounter card, place a resource when the hero's Willpower beats its
    // Threat; at 3 the triggering player takes control and the resources are discarded.
    {
      id: "143046:action:1",
      cardCode: ENT,
      lines: ["143046:A:1"],
      timing: "action",
      anyPlayer: true,
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, IN_STAGING, { kind: "canPick", pick: { type: "hero", control: "you", state: "ready" } }] },
      instructions: [
        { verb: "Pick", pick: { type: "hero", control: "you", state: "ready" } },
        { verb: "Exhaust", target: { kind: "picked" } },
        { verb: "MoveEncounterCard", card: "deckTop", to: "discard" },
        { verb: "PlaceToken", amount: 1, when: THREAT_BELOW("previous") },
        { verb: "TakeControl", who: "actor", when: THREE_RESOURCES },
        { verb: "DiscardResources", amount: 3, target: "self", when: THREE_RESOURCES },
      ],
    },

    // 143047 Saruman: cannot leave the staging area (Indestructible and Immune are keywords). When he is dealt a shadow card with a Wizardry effect, the defending player resolves it as the only player.
    { id: "143047:constant:1", cardCode: SARUMAN, lines: ["143047:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "143047:forced:1", cardCode: SARUMAN, lines: ["143047:A:2"], timing: "forced", trigger: "shadowWizardry", subject: "self", instructions: [{ verb: "TriggerWizardry", target: "shadowCard", asOnlyPlayer: true }] },

    // 143048 Saruman's Staff (attached to Saruman by stage 3A). After a player draws any number of cards Saruman attacks that player from the staging area with 2 shadow cards, then 1 damage comes off him. While he has
    // hit points left the players cannot win: the last stage cannot be defeated (the stage's advance is restricted, as 19083:B:2 holds its stage).
    { id: "143048:forced:1", cardCode: STAFF, lines: ["143048:A:1"], timing: "forced", trigger: "cardsDrawn", instructions: [{ verb: "AttackFromStaging", target: "host", shadows: 2 }, { verb: "Heal", amount: 1, target: "host" }] },
    {
      id: "143048:constant:1",
      cardCode: STAFF,
      lines: ["143048:A:2"],
      timing: "constant",
      condition: { kind: "less", left: { stat: "damage", ofNamed: "Saruman" }, right: { stat: "hitPoints", ofNamed: "Saruman" } },
      instructions: [{ verb: "Restrict", what: "advance" }],
    },

    // 143049 Gríma, 143050 Lieutenant of Orthanc, 143051 Isengard Orc, 143052 Wolf of Isengard.
    { id: "143049:forced:1", cardCode: "143049", lines: ["143049:A:2"], timing: "forced", trigger: "attackResolved", subject: "self", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "shuffle" }, { verb: "RevealEncounter", who: "eventSeat" }] },
    { id: "143049:shadow:1", cardCode: "143049", lines: ["143049:A:3"], timing: "shadow", instructions: [{ verb: "ConsiderUndefended" }] },
    { id: "143050:forced:1", cardCode: "143050", lines: ["143050:A:1"], timing: "forced", ...DESTROYS_A_CHARACTER, instructions: [{ verb: "DiscardRandomFromHand" }] },
    {
      id: "143051:whenRevealed:1",
      cardCode: "143051",
      lines: ["143051:A:2"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "discard", requires: { kind: "handHasCard" }, instructions: [{ verb: "DiscardRandomFromHand" }] },
            { id: "reveal", instructions: [{ verb: "RevealEncounter" }] },
          ],
        },
      ],
    },
    { id: "143051:shadow:1", cardCode: "143051", lines: ["143051:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: 2, until: "endOfRound", target: "attacker" }] },
    {
      id: "143052:forced:1",
      cardCode: "143052",
      lines: ["143052:A:1"],
      timing: "forced",
      trigger: "shadowWizardry",
      subject: "self",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "discard", requires: { kind: "handHasCard" }, instructions: [{ verb: "DiscardFromHand", amount: 1 }] },
            { id: "attack", instructions: [{ verb: "ImmediateAttack", afterThis: true }] },
          ],
        },
      ],
    },
    copyLine("141082:A:3", "143052:A:2"),

    // 143053 Orthanc, 143054 Gates of Isengard (both Immune): Orthanc in the staging area gains a Forced effect after the players quest successfully (it fires once, for the first player: the chosen card is revealed and resolved, then the others looked at are discarded, as printed); the Gates put an enemy
    // into play engaged with each player when they are explored.
    {
      id: "143053:forced:1",
      cardCode: ORTHANC,
      lines: ["143053:A:2"],
      timing: "forced",
      trigger: "questSucceeded",
      condition: { kind: "all", conditions: [IN_STAGING, { kind: "firstPlayer" }] },
      instructions: [{ verb: "LookAtTop", count: 3 }, { verb: "PickEncounter", from: "looked" }, { verb: "MoveEncounterCard", to: "deckTop" }, { verb: "RevealEncounter" }, { verb: "DiscardOtherLooked" }],
    },
    {
      id: "143054:forced:1",
      cardCode: GATES,
      lines: ["143054:A:2"],
      timing: "forced",
      trigger: "leftPlay",
      subject: "self",
      condition: { kind: "subjectExplored" },
      instructions: [EACH_PLAYER([{ verb: "SearchMove", type: "enemy", to: "engaged" }]), { verb: "ShuffleEncounterDeck" }],
    },

    // 143055 to 143059 the locations with a Wizardry line, 143058 Plain of Isengard (Threat X is the number of players, a copy of Temple Guardian's line).
    { id: "143055:forced:1", cardCode: "143055", lines: ["143055:A:1"], timing: "forced", trigger: "healed", subject: A_CHARACTER, condition: IN_STAGING, instructions: [{ verb: "DiscardFromHand", amount: 1 }] },
    { id: "143055:forced:2", cardCode: "143055", lines: ["143055:A:2"], ...WIZARDRY, instructions: [EACH_PLAYER([{ verb: "DiscardRandomFromHand" }])] },
    { id: "143056:forced:1", cardCode: "143056", lines: ["143056:A:1"], timing: "forced", trigger: "engaged", subject: { type: "enemy", control: "any" }, condition: IN_STAGING, instructions: [{ verb: "DealShadowTo", target: "subject" }] },
    {
      id: "143056:forced:2",
      cardCode: "143056",
      lines: ["143056:A:2"],
      ...WIZARDRY,
      instructions: [EACH_PLAYER([{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }])],
    },
    {
      id: "143057:forced:1",
      cardCode: "143057",
      lines: ["143057:A:1"],
      timing: "forced",
      trigger: "commitmentMade",
      condition: IN_STAGING,
      instructions: [
        { verb: "Pick", pick: { type: "character", control: "you", committed: true }, when: { kind: "canPick", pick: { type: "character", control: "you", committed: true } } },
        { verb: "DamageCard", amount: 1, target: "picked", when: { kind: "canPick", pick: { type: "character", control: "you", committed: true } } },
      ],
    },
    { id: "143057:forced:2", cardCode: "143057", lines: ["143057:A:2"], ...WIZARDRY, instructions: [{ verb: "AssignDamage", amount: { players: true, plus: 1 }, pick: A_CHARACTER }] },
    copyLine("110077:A:1", "143058:A:1"),
    { id: "143058:constant:2", cardCode: "143058", lines: ["143058:A:2"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "archeryToAllies", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    { id: "143058:forced:1", cardCode: "143058", lines: ["143058:A:3"], ...WIZARDRY, instructions: [EACH_PLAYER([{ verb: "Pick", pick: { type: "ally", control: "you" } }, { verb: "DiscardPicked" }])] },
    {
      id: "143059:forced:1",
      cardCode: "143059",
      lines: ["143059:A:1"],
      timing: "forced",
      trigger: "cardsDrawn",
      condition: { kind: "all", conditions: [IN_STAGING, { kind: "byPlayerCard" }] },
      instructions: [{ verb: "RaiseThreat", amount: 2, who: "eventSeat" }],
    },
    { id: "143059:forced:2", cardCode: "143059", lines: ["143059:A:2"], ...WIZARDRY, instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },

    // 143060 Blast of Sorcery, 143061 Poisoned Vapour, 143062 Machines of Isengard.
    {
      id: "143060:whenRevealed:1",
      cardCode: "143060",
      lines: ["143060:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "AssignDamage", amount: { players: true, plus: 1 }, pick: { type: "character", control: "any", committed: true } }],
    },
    {
      id: "143060:shadow:1",
      cardCode: "143060",
      lines: ["143060:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "count", pick: HAS_CARDS_IN_HAND, max: 1 } } },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "count", pick: HAS_CARDS_IN_HAND, max: 1 } },
      ],
    },
    {
      id: "143061:whenRevealed:1",
      cardCode: "143061",
      lines: ["143061:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "ExhaustEach", pick: { type: "character", control: "any", damaged: true } },
        { verb: "ModifyStat", stat: "blankText", amount: 1, until: "endOfCombat", target: "damagedCharacters" },
      ],
    },
    copyLine("143064:A:3", "143061:A:3"),
    {
      id: "143062:whenRevealed:1",
      cardCode: "143062",
      lines: ["143062:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "GainSurge", when: { kind: "not", condition: { kind: "hasWizardry" } } }, { verb: "TriggerWizardry", target: "activeLocation" }],
    },
    {
      id: "143062:shadow:1",
      cardCode: "143062",
      lines: ["143062:A:2"],
      timing: "shadow",
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "AfterAttack", instructions: [{ verb: "DiscardRandomFromHand", when: { kind: "x", min: 1 } }] }],
    },

    // 143068 Saruman's Voice (Peril, Doomed 2). The revealing player removes a committed hero, any player's, from the quest and attaches it; with none committed it is discarded. It counts as a Condition attachment
    // whose Forced effect hears the hero commit, be declared as an attacker or defender, or trigger its own ability (Action, Response or Forced).
    {
      id: "143068:whenRevealed:1",
      cardCode: "143068",
      lines: ["143068:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: { type: "hero", control: "any", committed: true }, when: { kind: "canPick", pick: { type: "hero", control: "any", committed: true } } },
        { verb: "AttachSelfToPicked", when: { kind: "canPick", pick: { type: "hero", control: "any", committed: true } } },
        { verb: "RemoveFromQuest", when: { kind: "canPick", pick: { type: "hero", control: "any", committed: true } } },
      ],
    },
    { id: "143068:constant:1", cardCode: "143068", lines: ["143068:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
    ...(["committed", "declaredAttacker", "declaredDefender", "abilityTriggered"] as const).map((trigger, at): Effect => ({ id: `143068:forced:${at + 1}`, cardCode: "143068", lines: ["143068:A:2"], timing: "forced", trigger, subject: "host", instructions: [{ verb: "DiscardFromHand", amount: 1 }] })),

    // 143078 Rouse the Ents (stage 1). Side B: no cards or resources for the players, no commitment and no staging. At the end of each round a resource goes on the stage and the players may advance: stage 2A makes
    // Gates of Isengard active and stages Saruman and Orthanc, then the first player shuffles the discard pile in and reveals a card for each resource, and the Ents in the staging area leave the game.
    { id: "143078:setup:1", cardCode: "143078", lines: ["143078:A:1"], timing: "setup", instructions: [{ verb: "ShuffleEncounterDeck" }] },
    {
      id: "143078:constant:1",
      cardCode: "143078",
      lines: ["143078:B:1"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "cannotDraw", amount: 1, until: "whileSourceInPlay", target: "table" },
        { verb: "ModifyStat", stat: "cannotGainResources", amount: 1, until: "whileSourceInPlay", target: "table" },
        { verb: "ModifyStat", stat: "cannotCommit", amount: 1, until: "whileSourceInPlay", target: "table" },
        { verb: "ModifyStat", stat: "skipStaging", amount: 1, until: "whileSourceInPlay", target: "table" },
      ],
    },
    {
      id: "143078:forced:1",
      cardCode: "143078",
      lines: ["143078:B:2"],
      timing: "forced",
      trigger: "endOfRound",
      instructions: [
        { verb: "PlaceToken", amount: 1 },
        {
          verb: "Choose",
          who: "actor",
          options: [
            {
              id: "advance",
              instructions: [
                { verb: "AdvanceToStage", code: STAGE_2 },
                { verb: "ShuffleEncounterDiscard" },
                { verb: "RevealEncounter", times: { stat: "resources", of: "self" } },
                { verb: "Each", pick: { type: "objective", control: "any", stagingOnly: true, names: ["Ent of Fangorn"] }, instructions: [{ verb: "RemoveFromGame" }] },
              ],
            },
            { id: "stay", instructions: [] },
          ],
        },
      ],
    },

    // 143079 Breaking Isengard (stage 2). Side B: no travel to Orthanc; each non-unique location explored puts a damage here (5 advance to stage 3A); an Ent exhausts to put 2 progress on a non-unique location.
    {
      id: "143079:whenRevealed:1",
      cardCode: STAGE_2,
      lines: ["143079:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "MakeSetAsideActive", code: GATES }, { verb: "AddSetAsideToStaging", code: SARUMAN }, { verb: "AddSetAsideToStaging", code: ORTHANC }],
    },
    { id: "143079:constant:1", cardCode: STAGE_2, lines: ["143079:B:1"], timing: "constant", instructions: [{ verb: "Restrict", what: "travel", location: ORTHANC }] },
    {
      id: "143079:forced:1",
      cardCode: STAGE_2,
      lines: ["143079:B:2"],
      timing: "forced",
      trigger: "locationExplored",
      subject: NON_UNIQUE_LOCATION,
      instructions: [{ verb: "PlaceDamage", amount: 1, card: "self" }, { verb: "AdvanceToStage", code: STAGE_3, when: { kind: "less", left: 4, right: { stat: "damage", of: "self" } } }],
    },
    {
      id: "143079:action:1",
      cardCode: STAGE_2,
      lines: ["143079:B:3"],
      timing: "action",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "canPick", pick: ENT_PICK }, { kind: "canPick", pick: NON_UNIQUE_LOCATION }] },
      instructions: [
        { verb: "Pick", pick: ENT_PICK },
        { verb: "Exhaust", target: { kind: "picked" } },
        { verb: "Pick", pick: NON_UNIQUE_LOCATION },
        { verb: "PlaceProgressOn", amount: 2, target: "picked" },
      ],
    },

    // 143080 The Voice of Saruman (stage 3). Stage 3A draws 6 cards for each player, discards down to 6 and attaches the Staff to Saruman (the draw is not heard by the Staff, which is not in play yet). Side B: Saruman is
    // engaged with the first player while Orthanc is the active location; when Orthanc is explored the progress placed this phase is canceled and Orthanc returns to the staging area; a player with no cards
    // in hand is eliminated (checked at each settle, trackQuestProgress keeps the progress the cancel reads); the players win once the stage is defeated.
    {
      id: "143080:whenRevealed:1",
      cardCode: STAGE_3,
      lines: ["143080:A:1"],
      timing: "whenRevealed",
      instructions: [
        EACH_PLAYER([{ verb: "Draw", amount: 6 }]),
        EACH_PLAYER([{ verb: "DiscardFromHand", amount: { hand: true, plus: -6 } }]),
        { verb: "AttachSetAsideTo", code: STAFF, to: "Saruman" },
      ],
    },
    {
      id: "143080:constant:1",
      cardCode: STAGE_3,
      lines: ["143080:B:1"],
      timing: "constant",
      condition: { kind: "matches", card: "activeLocation", pick: ORTHANC_PICK },
      instructions: [{ verb: "ModifyStat", stat: "engagedWithFirst", amount: 1, until: "whileSourceInPlay", holders: SARUMAN_ENEMY }],
    },
    {
      id: "143080:forced:1",
      cardCode: STAGE_3,
      lines: ["143080:B:2"],
      timing: "forced",
      trigger: "leftPlay",
      subject: ORTHANC_PICK,
      condition: { kind: "subjectExplored" },
      instructions: [{ verb: "CancelPhaseProgress" }, { verb: "MoveEncounterCard", card: "subject", to: "staging" }],
    },
    {
      id: "143080:constant:2",
      cardCode: STAGE_3,
      lines: ["143080:B:3"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "eliminatedAtEmptyHand", amount: 1, until: "whileSourceInPlay", target: "table" },
        { verb: "ModifyStat", stat: "trackQuestProgress", amount: 1, until: "whileSourceInPlay", target: "table" },
      ],
    },
  ],
  { pool: [...FLIGHT_TO_THE_FORD, ...THE_URUK_HAI, ...TEMPLE] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
