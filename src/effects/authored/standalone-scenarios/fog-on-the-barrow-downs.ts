import type { Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";
import { AUTHORED_EFFECTS as PASSAGE_OF_THE_MARSHES } from "../the-passage-of-the-marshes.ts";
import { AUTHORED_EFFECTS as BLACK_GATE } from "../return-of-the-king/the-black-gate-opens.ts";
import { copyLine, withCopies } from "../reprint.ts";
import { AUTHORED_EFFECTS as OLD_FOREST } from "./the-old-forest.ts";

// Records for Fog on the Barrow-downs (standalone-scenarios cycle part 5, no campaign card). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) needs no record here.
// Setup: the data's piles set Great Barrow, Standing Stones and Hollow Circle aside (148001:A:1's first sentence); only the shuffle is a record. The campaign card and the boon are Campaign Mode only (every line inert).
// The partial split of the staging areas (a player who reveals a Great Barrow leaves for a stage 4A of his own while the others stay at 3B, which stays in play) is src/rules/families/breaking/barrow.ts; the readings are in docs/brief.md, Fog on the Barrow-downs, Line readings.
// Rules: rr.forced, rr.surge, mec109.peril, rr.immune, rr.doomed-x, rr.engaged, rr.victory, rr.in-play-and-out-of-play, rr.quest-advancement, rr.player-elimination, rr.lasting-effects, rr.cancel, mec108.create-staging-area, mec109.multiple-staging-areas (data/rules/entries.json).
const STAGE_3 = "148003";
const STAGE_4 = "148004";
const HOLLOW_CIRCLE = "148005";
const STANDING_STONES = "148006";
const GREAT_BARROW = "148007";
const WIGHT = "Wight";
const IN_STAGING = { kind: "sourceIn", zone: "staging" } as const;
// A Great Barrow in play, in the staging area or active (the stage's own area once the areas are separate).
const BARROW: PickSpec = { type: "location", control: "any", names: ["Great Barrow"] };
// Any Great Barrow in play, in any staging area.
const ANY_BARROW: PickSpec = { type: "location", control: "any", names: ["Great Barrow"], stagingArea: "any" };
// The Wights engaged with a player at the source's stage, and the players there.
const WIGHT_AT_STAGE: PickSpec = { type: "enemy", control: "any", trait: WIGHT, atStage: true };
const PLAYERS_AT_STAGE: PickSpec = { type: "player", control: "any", atStage: true };
const HEROES_AT_STAGE: PickSpec = { type: "hero", control: "any", atStage: true };
const HEROES_YOU: PickSpec = { type: "hero", control: "you" };
const ALLY_YOU: PickSpec = { type: "ally", control: "you" };
const QUESTER_YOU: PickSpec = { type: "character", control: "you", committed: true };
const ENGAGED_WITH_YOU: PickSpec = { type: "enemy", control: "any", engaged: "you" };
// A questing hero the revealer controls that carries no Dreadful Song.
const SONG_HERO: PickSpec = { type: "hero", control: "you", committed: true, hasAttachment: { names: ["Dreadful Song"], none: true } };
const NAMED_WIGHT_AT_STAGE = (name: string) => ({ kind: "count" as const, pick: { type: "enemy" as const, control: "any" as const, names: [name], atStage: true as const }, min: 1 });
type ForEachPlayer = Extract<Instruction, { verb: "ForEachPlayer" }>;
const EACH_PLAYER = (instructions: ForEachPlayer["instructions"]): ForEachPlayer => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
// A Wight's Forced effect: after it attacks and destroys a character (143050:A:1's shape); the character's controller is the actor.
const WIGHT_DESTROYS = {
  timing: "forced",
  trigger: "characterDestroyedByAttack",
  subject: { type: "character", control: "any" },
  condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } },
} as const;

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 148001 The House of Tom Bombadil. 1B skips the quest phase and places 1 progress on itself at the end of each round, advancing when it holds its quest points.
    { id: "148001:setup:1", cardCode: "148001", lines: ["148001:A:1"], timing: "setup", instructions: [{ verb: "ShuffleEncounterDeck" }] },
    { id: "148001:constant:1", cardCode: "148001", lines: ["148001:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "skipQuestPhase", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    { id: "148001:forced:1", cardCode: "148001", lines: ["148001:B:2"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "AddStageProgress", amount: 1 }] },

    // 148002 Across the Downs. 2A adds Hollow Circle and each player reveals 1 card; 2B raises every player's threat at the end of the refresh phase (nobody is apart yet) and cannot be defeated until Hollow Circle is in the victory display.
    {
      id: "148002:whenRevealed:1",
      cardCode: "148002",
      lines: ["148002:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "AddSetAsideToStaging", code: HOLLOW_CIRCLE }, EACH_PLAYER([{ verb: "RevealEncounter" }])],
    },
    { id: "148002:forced:1", cardCode: "148002", lines: ["148002:B:1"], timing: "forced", trigger: "endOfPhase", condition: { kind: "phase", is: "Refresh" }, instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }] },
    { id: "148002:constant:1", cardCode: "148002", lines: ["148002:B:2"], timing: "constant", condition: { kind: "inVictory", code: HOLLOW_CIRCLE, is: false }, instructions: [{ verb: "Restrict", what: "advance" }] },

    // 148003 Lost in the Fog (stage 3, the shared stage the others stay at). 3A: the first player adds Standing Stones, each other player reveals 1 card, then the discard pile and each Great Barrow are shuffled in (so none of those cards is a Great Barrow). 3B: no progress here while a Great Barrow is in play;
    // after any player's elimination the players at this stage raise their threat by 10 (it stays in play, parked, when the player at it is eliminated: `staysInPlay`); it cannot be defeated unless every player in the game is at this stage and Standing Stones is in the victory display, and defeating it wins the game
    // (`holdsWin`: no stage follows it, its own Forced effect wins).
    {
      id: "148003:whenRevealed:1",
      cardCode: STAGE_3,
      lines: ["148003:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "AddSetAsideToStaging", code: STANDING_STONES },
        EACH_PLAYER([{ verb: "RevealEncounter", when: { kind: "not", condition: { kind: "firstPlayer" } } }]),
        { verb: "ShuffleEncounterDiscard" },
        { verb: "ShuffleSetAsideIntoEncounterDeck", code: GREAT_BARROW, all: true },
      ],
    },
    { id: "148003:constant:1", cardCode: STAGE_3, lines: ["148003:B:1"], timing: "constant", condition: { kind: "count", pick: BARROW, min: 1 }, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "148003:forced:1", cardCode: STAGE_3, lines: ["148003:B:2"], timing: "forced", trigger: "playerEliminated", instructions: [{ verb: "RaiseThreatAtStage", amount: 10 }] },
    {
      id: "148003:constant:2",
      cardCode: STAGE_3,
      lines: ["148003:B:3"],
      timing: "constant",
      condition: { kind: "any", conditions: [{ kind: "allAtStage", is: false }, { kind: "inVictory", code: STANDING_STONES, is: false }] },
      instructions: [{ verb: "Restrict", what: "advance" }],
    },
    {
      id: "148003:constant:3",
      cardCode: STAGE_3,
      lines: ["148003:B:3"],
      timing: "constant",
      // Defeating it wins the game itself (no stage follows it), and it stays in play, parked, when the player at it is eliminated: the line says each player "in the game" is at this stage, and a Forced effect of 3B hears every elimination.
      instructions: [
        { verb: "ModifyStat", stat: "holdsWin", amount: 1, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "staysInPlay", amount: 1, until: "whileSourceInPlay", target: "self" },
      ],
    },
    { id: "148003:forced:2", cardCode: STAGE_3, lines: ["148003:B:3"], timing: "forced", trigger: "questCardDefeated", subject: "self", instructions: [{ verb: "WinGame" }] },

    // 148004 Trapped Inside a Barrow (stage 4, one copy for each player who enters a Great Barrow). 4A: the player's own quest phase ends, cards are discarded until a Wight is, which joins his staging area, and he keeps only as many allies as enemies are engaged with him.
    // 4B: a location revealed at it is canceled and discarded (`CancelRevealed`) and its player raises his threat by its Threat; once defeated (`holdsWin`: it does not win) it sends the player back to stage 3B when the travel phase begins and 1 progress goes on a Great Barrow there.
    // When 4B leaves play because its player is eliminated, 1 Great Barrow in play goes to the victory display (the FFG designer, Semi-official FAQ 3.181).
    {
      id: "148004:whenRevealed:1",
      cardCode: STAGE_4,
      lines: ["148004:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "EndQuestPhase", own: true },
        { verb: "DiscardUntil", type: "enemy", trait: WIGHT },
        { verb: "MoveEncounterCard", card: "picked", to: "staging" },
        { verb: "Each", pick: ALLY_YOU, upTo: { count: ENGAGED_WITH_YOU }, instructions: [], rest: [{ verb: "Discard", target: { kind: "picked" } }] },
      ],
    },
    // The raise is read before the location is discarded: its Threat, modifiers included, is what it counted in the staging area (a discarded card has no modifier left).
    {
      id: "148004:forced:1",
      cardCode: STAGE_4,
      lines: ["148004:B:1"],
      timing: "forced",
      trigger: "locationRevealed",
      subject: { type: "location", control: "any" },
      eventSeat: "you",
      instructions: [{ verb: "RaiseThreat", amount: { stat: "threat", of: "subject" }, who: "actor" }, { verb: "CancelRevealed" }],
    },
    // The stage prints no constant line: the flag that keeps its defeat from winning the game is claimed by the Forced line that says what the defeat does (the effect coverage test allows it).
    { id: "148004:constant:1", cardCode: STAGE_4, lines: ["148004:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "holdsWin", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "148004:forced:2",
      cardCode: STAGE_4,
      lines: ["148004:B:2"],
      timing: "forced",
      trigger: "questCardDefeated",
      subject: "self",
      instructions: [{ verb: "Delay", until: "beginningOfTravel", instructions: [{ verb: "ReturnToSharedStage", code: STAGE_3 }, { verb: "Pick", pick: BARROW }, { verb: "PlaceProgressOn", amount: 1, target: "picked" }] }],
    },
    { id: "148004:forced:3", cardCode: STAGE_4, lines: ["148004:B:2"], timing: "forced", trigger: "playerEliminated", eventSeat: "you", instructions: [{ verb: "Pick", pick: ANY_BARROW }, { verb: "AddToVictory", target: "picked" }] },

    // 148005 Hollow Circle and 148006 Standing Stones (both immune to player card effects, read by their keyword line). Travel: each player (the first player) searches the deck and discard pile (the deck, discard pile and victory display) for a Wight (a Great Barrow); the deck is shuffled.
    {
      id: "148005:travel:1",
      cardCode: HOLLOW_CIRCLE,
      lines: ["148005:A:2"],
      timing: "travel",
      instructions: [EACH_PLAYER([{ verb: "SearchMove", trait: WIGHT, type: "enemy", to: "engaged" }]), { verb: "ShuffleEncounterDeck" }],
    },
    { id: "148006:travel:1", cardCode: STANDING_STONES, lines: ["148006:A:2"], timing: "travel", instructions: [{ verb: "SearchToStaging", code: GREAT_BARROW }, { verb: "ShuffleEncounterDeck" }] },

    // 148007 Great Barrow (copy: 146024:A:1). After it enters the staging area its player's characters leave the quest and he leaves for a stage 4A of his own (the others stay at 3B with this card).
    copyLine("146024:A:1", "148007:A:1"),
    {
      id: "148007:forced:1",
      cardCode: GREAT_BARROW,
      lines: ["148007:A:2"],
      timing: "forced",
      trigger: "addedToStaging",
      subject: "self",
      instructions: [{ verb: "Each", pick: QUESTER_YOU, instructions: [{ verb: "RemoveFromQuest" }] }, { verb: "SplitToOwnStage", code: STAGE_4 }],
    },

    // 148008 Ancient Barrow. Threat X is 1 plus the facedown cards under it; after it enters play each player at its stage places an ally he controls facedown under it, and they return to their owners' hands when it leaves play explored.
    { id: "148008:constant:1", cardCode: "148008", lines: ["148008:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { facedown: true, plus: 1 }, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "148008:forced:1",
      cardCode: "148008",
      lines: ["148008:A:2"],
      timing: "forced",
      trigger: "encounterEnteredPlay",
      subject: "self",
      instructions: [EACH_PLAYER([{ verb: "Pick", pick: ALLY_YOU }, { verb: "PlaceFacedownUnder", host: "self", target: "picked", when: { kind: "canPick", pick: ALLY_YOU } }])],
    },
    { id: "148008:forced:2", cardCode: "148008", lines: ["148008:A:2"], timing: "forced", trigger: "locationExplored", subject: "self", instructions: [{ verb: "ReturnFacedownToHands" }] },
    { id: "148008:forced:3", cardCode: "148008", lines: ["148008:A:2"], timing: "forced", trigger: "activeExplored", subject: "self", instructions: [{ verb: "ReturnFacedownToHands" }] },

    // 148009 Stone Ring. While it is in the staging area each Wight engaged with a player at its stage gets +1 Attack and +1 Defense, and the first sentence of each Wight name engaged with one applies to each player at the stage.
    {
      id: "148009:constant:1",
      cardCode: "148009",
      lines: ["148009:A:1"],
      timing: "constant",
      condition: IN_STAGING,
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: WIGHT_AT_STAGE },
        { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", holders: WIGHT_AT_STAGE },
      ],
    },
    {
      id: "148009:constant:2",
      cardCode: "148009",
      lines: ["148009:A:1"],
      timing: "constant",
      condition: { kind: "all", conditions: [IN_STAGING, NAMED_WIGHT_AT_STAGE("Barrow-wight")] },
      instructions: [{ verb: "ModifyStat", stat: "threatReductionBarred", amount: 1, until: "whileSourceInPlay", holders: PLAYERS_AT_STAGE }],
    },
    {
      id: "148009:constant:3",
      cardCode: "148009",
      lines: ["148009:A:1"],
      timing: "constant",
      condition: { kind: "all", conditions: [IN_STAGING, NAMED_WIGHT_AT_STAGE("Cold-wight")] },
      instructions: [{ verb: "ModifyStat", stat: "noCardDraw", amount: 1, until: "whileSourceInPlay", holders: PLAYERS_AT_STAGE }],
    },
    {
      id: "148009:constant:4",
      cardCode: "148009",
      lines: ["148009:A:1"],
      timing: "constant",
      condition: { kind: "all", conditions: [IN_STAGING, NAMED_WIGHT_AT_STAGE("Dark-wight")] },
      instructions: [{ verb: "ModifyStat", stat: "noCardResources", amount: 1, until: "whileSourceInPlay", holders: HEROES_AT_STAGE }],
    },

    // 148010 North Downs. While it is in the staging area the characters of the players at its stage use their Willpower for Defense against Wights; Shadow: +2 Attack, and each player at the defender's stage raises his threat by 2 if the attack destroys a character.
    {
      id: "148010:constant:1",
      cardCode: "148010",
      lines: ["148010:A:1"],
      timing: "constant",
      condition: IN_STAGING,
      instructions: [{ verb: "ModifyStat", stat: "defenseFromWillpower", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any", atStage: true }, when: { kind: "defendingAgainst", trait: WIGHT } }],
    },
    {
      id: "148010:shadow:1",
      cardCode: "148010",
      lines: ["148010:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker" },
        { verb: "AfterAttack", instructions: [EACH_PLAYER([{ verb: "RaiseThreat", amount: 2, who: "actor", when: { kind: "x", min: 1 } }])] },
      ],
    },

    // 148011 Barrow-wight, 148012 Cold-wight, 148013 Dark-wight. The first sentence holds for the player the Wight is engaged with; the Forced effect hears the attack that destroys a character and acts for that character's controller.
    {
      id: "148011:constant:1",
      cardCode: "148011",
      lines: ["148011:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "engaged" },
      instructions: [{ verb: "ModifyStat", stat: "threatReductionBarred", amount: 1, until: "whileSourceInPlay", target: "engagedSeat" }],
    },
    { id: "148011:forced:1", cardCode: "148011", lines: ["148011:A:2"], ...WIGHT_DESTROYS, instructions: [{ verb: "RaiseThreat", amount: 2, who: "actor" }] },
    {
      id: "148012:constant:1",
      cardCode: "148012",
      lines: ["148012:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "engaged" },
      instructions: [{ verb: "ModifyStat", stat: "noCardDraw", amount: 1, until: "whileSourceInPlay", target: "engagedSeat" }],
    },
    { id: "148012:forced:1", cardCode: "148012", lines: ["148012:A:2"], ...WIGHT_DESTROYS, instructions: [{ verb: "DiscardRandomFromHand" }] },
    {
      id: "148013:constant:1",
      cardCode: "148013",
      lines: ["148013:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "engaged" },
      instructions: [{ verb: "ModifyStat", stat: "noCardResources", amount: 1, until: "whileSourceInPlay", holders: HEROES_YOU }],
    },
    { id: "148013:forced:1", cardCode: "148013", lines: ["148013:A:2"], ...WIGHT_DESTROYS, instructions: [{ verb: "Each", pick: HEROES_YOU, instructions: [{ verb: "DiscardResources", all: true, target: "picked" }] }] },

    // 148014 I'm Waiting for You! Each Wight engaged with a player at the revealer's stage attacks; none made, surge. Shadow: +1 Attack, +3 against an ally.
    { id: "148014:whenRevealed:1", cardCode: "148014", lines: ["148014:A:1"], timing: "whenRevealed", instructions: [{ verb: "ImmediateAttackEach", trait: WIGHT }, { verb: "GainSurge", when: { kind: "noneReturned" } }] },
    {
      id: "148014:shadow:1",
      cardCode: "148014",
      lines: ["148014:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "matches", card: "defender", pick: { type: "ally", control: "any" } } } },
        { verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "attacker", when: { kind: "matches", card: "defender", pick: { type: "ally", control: "any" } } },
      ],
    },

    // 148015 Long Groping Arm (Peril). Until the end of the phase each Wight engaged with the revealer contributes its Threat to his staging area, a Wight engaged afterwards included (an encounter card's lasting effect, rr.lasting-effects); with no enemy engaged with him, a Wight is searched for and put into play engaged with him.
    {
      id: "148015:whenRevealed:1",
      cardCode: "148015",
      lines: ["148015:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "ModifyStat", stat: "engagedThreatSeat", amount: 1, until: "endOfPhase", target: "actorSeat", trait: WIGHT },
        { verb: "SearchMove", trait: WIGHT, type: "enemy", to: "engaged", when: { kind: "count", pick: ENGAGED_WITH_YOU, max: 0 } },
        { verb: "ShuffleEncounterDeck" },
      ],
    },

    // 148016 Chill Fog. Each player at the revealer's stage discards the resources in his heroes' pools and raises his threat by 1 for each; none discarded in all, surge. Shadow: raise your threat by the damage dealt.
    {
      id: "148016:whenRevealed:1",
      cardCode: "148016",
      lines: ["148016:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "GainSurge", when: { kind: "less", left: { resourcesOn: HEROES_AT_STAGE }, right: 1 } },
        EACH_PLAYER([{ verb: "RaiseThreat", amount: { resourcesOn: HEROES_YOU }, who: "actor" }]),
        { verb: "Each", pick: HEROES_AT_STAGE, instructions: [{ verb: "DiscardResources", all: true, target: "picked" }] },
      ],
    },
    { id: "148016:shadow:1", cardCode: "148016", lines: ["148016:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "RaiseThreat", amount: { dealt: true }, who: "actor" }] }] },

    // 148017 Frozen by Fear (Surge, Doomed 1: the Doomed raises every player's threat, an encounter card's does). Players at the revealer's stage cannot trigger Action or Response effects until the end of the round (copy of 144018:A:3 for the Shadow).
    {
      id: "148017:whenRevealed:1",
      cardCode: "148017",
      lines: ["148017:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "ModifyStat", stat: "cannotTriggerEffects", amount: 1, until: "endOfRound", holders: PLAYERS_AT_STAGE }],
    },
    copyLine("144018:A:3", "148017:A:3"),

    // 148018 Dreadful Song (Peril). Attach to a questing hero you control with no Dreadful Song (with none, it is discarded): a Condition attachment; the hero's Willpower is 0; at the end of the round its controller raises his threat by 1 for each Wight engaged with him.
    {
      id: "148018:whenRevealed:1",
      cardCode: "148018",
      lines: ["148018:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "Pick", pick: SONG_HERO, when: { kind: "canPick", pick: SONG_HERO } }, { verb: "AttachSelfToPicked" }],
    },
    {
      id: "148018:constant:1",
      cardCode: "148018",
      lines: ["148018:A:2"],
      timing: "constant",
      instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "SetStat", stat: "willpower", value: 0, target: "host" }],
    },
    {
      id: "148018:forced:1",
      cardCode: "148018",
      lines: ["148018:A:2"],
      timing: "forced",
      trigger: "endOfRound",
      condition: { kind: "not", condition: IN_STAGING },
      instructions: [{ verb: "RaiseThreat", amount: { count: { type: "enemy", control: "any", engaged: "you", trait: WIGHT } }, who: "hostController" }],
    },

    // 148019 Tom Bombadil (copy of The Old Forest's 147022:A:1: the player is chosen by the first player of the revealer's area).
    copyLine("147022:A:1", "148019:A:1"),
  ],
  { pool: [...BLACK_GATE, ...PASSAGE_OF_THE_MARSHES, ...OLD_FOREST] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
