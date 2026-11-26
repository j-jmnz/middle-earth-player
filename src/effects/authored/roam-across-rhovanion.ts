import type { Condition, Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as JOURNEY_UP_THE_ANDUIN } from "./journey-up-the-anduin.ts";
import { AUTHORED_EFFECTS as LOST_IN_MIRKWOOD } from "./lost-in-mirkwood.ts";
import { AUTHORED_EFFECTS as THE_KINGS_QUEST } from "./the-kings-quest.ts";
import { AUTHORED_EFFECTS as THE_OATH } from "./the-oath.ts";
import { AUTHORED_EFFECTS as THE_THING_IN_THE_DEPTHS } from "./the-thing-in-the-depths.ts";
import { AUTHORED_EFFECTS as THE_WITHERED_HEATH } from "./the-withered-heath.ts";
import { copyLine, withCopies } from "./reprint.ts";

// Records for Roam Across Rhovanion (Ered Mithrin part 5, campaign card 12184): the encounter cards no template reads, the four objectives Urdug, Tiny, Durin's Key and Urdug's Horn, the five quest stages and the campaign card. Urdug's Cunning (12185) and Misplaced Trust (12186) are in pool/EMCE.ts.
// Every line is read from the scan ledger (data/printed/ered-mithrin.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here. The piles place the objectives set aside (Durin's Key, Urdug's Horn, Urdug with his enemy side, Tiny with his enemy side);
// stage 1A's Setup puts Urdug under the first player. The campaign card's Setup is dealt by src/campaign/checklist.ts (the boon ally search, the Melanwar removal) and src/rules/setup/setup.ts (the trust in Urdug, after the quest card's Setup); its back stays in the campaign zone all game.
// Rules: emce.setup-roam-across-rhovanion, emce.indestructible, emce.guarded-x, emce.deep, emce.caves-deck, rr.objective-cards, rr.guarded, rr.cancel, rr.search, rr.victory (data/rules/entries.json).
const URDUG = "19052";
const TINY = "19054";
const NAMED = (name: string): PickSpec => ({ type: "card", control: "any", names: [name] });
const ENGAGEABLE: PickSpec = { type: "enemy", control: "any", stagingOnly: true, engageable: true };
// Urdug wherever he is in play: in the staging area on either side, under a player, or engaged with one on his enemy side (stage 3).
const URDUG_ANYWHERE: PickSpec = { type: "card", control: "any", names: ["Urdug"], engagedEnemies: true };
const STAGING_LOCATIONS = { type: "location", control: "any", stagingOnly: true } as const;
// "the first player controls Urdug" / "Tiny": a card in the first player's play area.
const FIRST_PLAYER_CONTROLS = (name: string): Extract<Condition, { kind: "count" }> => ({ kind: "count", pick: { type: "card", control: "you", names: [name], who: "firstPlayer" }, min: 1 });
const CONTROLS_URDUG = FIRST_PLAYER_CONTROLS("Urdug");
const CONTROLS_TINY = FIRST_PLAYER_CONTROLS("Tiny");
const PICKED_LOCATION: Extract<Condition, { kind: "matches" }> = { kind: "matches", card: "picked", pick: { type: "location", control: "any" } };
const PICKED_IS = (type: "location" | "treachery" | "enemy"): Condition => ({ kind: "matches", card: "picked", pick: { type, control: "any" }, inPlay: false });
// Each player in turn order: the instructions with a question for them.
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]) => ({ verb: "ForEachPlayer" as const, order: "firstFirst" as const, instructions });
// "discard cards from the top until X locations are discarded, where X is the number of players. Add each discarded location to the staging area": one location for each player.
const LOCATIONS_TO_STAGING = EACH_PLAYER([{ verb: "DiscardUntil", type: "location" }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: PICKED_IS("location") }]);
// "Each other player reveals an encounter card." (19048:A:1, 19049:A:1, 19050:A:1, 19051:A:1)
const EACH_OTHER_REVEALS = EACH_PLAYER([{ verb: "RevealEncounter", when: { kind: "not", condition: { kind: "firstPlayer" } } }]);
// "Look at the top 3 cards of the encounter deck, choose 1 to reveal, and discard the rest." (19036:A:3)
const LOOK_AT_THREE: Instruction[] = [{ verb: "LookAtTop", count: 3 }, { verb: "PickEncounter", from: "looked" }, { verb: "DiscardOtherLooked" }, { verb: "RevealEncounter" }];
const NOT_FIVE_PROGRESS: Extract<Condition, { kind: "not" }> = { kind: "not", condition: { kind: "stageProgress", min: 5 } };
// The stage 2 cards (19048 to 19050) are played in a random order, then stage 3 (19051): the Forced effect all three share.
const STAGE_TWOS = ["19048", "19049", "19050"];
const RANDOM_STAGE = (id: string, code: string, line: string): Effect => ({
  id,
  cardCode: code,
  lines: [line],
  timing: "forced",
  trigger: "questCardDefeated",
  subject: "self",
  instructions: [{ verb: "AdvanceToRandomStage", codes: STAGE_TWOS, otherwise: "19051", remove: true, onDefeat: true }],
});
// When Revealed of a stage 2 (19048:A:1, 19049:A:1, 19050:A:1): the first player searches for the guard, which joins the staging area, and the set-aside objective is attached to it as a guarded objective. A search that finds no copy still brings the objective into the staging area, unguarded, and the first player claims it at once (settle sweep; user ruling, 2026-11-05).
const FOUND = (title: string): Condition => ({ kind: "matches", card: "picked", pick: { type: "card", control: "any", names: [title] }, inPlay: true });
const GUARD_OBJECTIVE = (id: string, code: string, line: string, guard: string, guardTitle: string, objective: string, objectiveTitle: string): Effect => ({
  id,
  cardCode: code,
  lines: [line],
  timing: "whenRevealed",
  instructions: [
    { verb: "SearchMove", code: guard, to: "staging", remember: true },
    { verb: "AddSetAsideToStaging", code: objective },
    { verb: "Pick", pick: { type: "card", control: "any", stagingOnly: true, names: [objectiveTitle] }, when: FOUND(guardTitle) },
    { verb: "AttachGuard", guard: "previous", to: "picked", when: FOUND(objectiveTitle) },
    { verb: "ShuffleEncounterDeck" },
    EACH_OTHER_REVEALS,
  ],
});

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 12184 Roam Across Rhovanion (campaign card). Setup: a player may search their deck for a unique boon ally; with Melanwar's line the first player removes 3 non-unique enemies other than Grey Mountain Giant from the encounter deck; once the quest card's Setup has put Urdug into play the first
    // player puts their trust in Urdug (a resource on him) or a copy of Urdug's Cunning is shuffled into the encounter deck. Side B stays in play: the same choice after the first player claims an objective; Urdug gets +1 Willpower, Threat, Attack and Defense for each resource on him, and Deep is ignored.
    // Resolution: with 3 or more resources on Urdug each player adds Misplaced Trust to the pool (and their deck), else Urdug's Cunning; each player chooses a location in the staging area, a different one if able, and a copy of it joins the pool.
    {
      id: "12184:campaignSetup:1",
      cardCode: "12184",
      lines: ["12184:A:2"],
      timing: "campaignSetup",
      instructions: [
        { verb: "SearchBoonAllyToHand" },
        { verb: "RemoveFromEncounterDeckIfLogged", line: "melanwar", count: 3, cardType: "enemy", nonUnique: true, except: ["Grey Mountain Giant"] },
        { verb: "PutTrust", code: URDUG, burden: "12185" },
      ],
    },
    { id: "12184:forced:1", cardCode: "12184", lines: ["12184:B:1"], timing: "forced", trigger: "claimed", subject: { type: "objective", control: "any" }, condition: { kind: "firstPlayer" }, instructions: [{ verb: "PutTrust", code: URDUG, burden: "12185" }] },
    {
      id: "12184:constant:1",
      cardCode: "12184",
      lines: ["12184:B:2"],
      timing: "constant",
      instructions: [
        { verb: "IgnoreKeyword", keywords: ["deep"] },
        ...(["willpower", "threat", "attack", "defense"] as const).map((stat) => ({ verb: "ModifyStat" as const, stat, amount: { resourcesOn: URDUG_ANYWHERE }, until: "whileSourceInPlay" as const, holders: URDUG_ANYWHERE })),
      ],
    },
    {
      id: "12184:resolution:1",
      cardCode: "12184",
      lines: ["12184:B:3"],
      timing: "resolution",
      instructions: [
        { verb: "Earn", codes: ["12186"], eachPlayer: true, afterHand: true, when: { kind: "less", left: 2, right: { resourcesOn: URDUG_ANYWHERE } } },
        { verb: "Earn", codes: ["12185"], eachPlayer: true, when: { kind: "not", condition: { kind: "less", left: 2, right: { resourcesOn: URDUG_ANYWHERE } } } },
      ],
    },
    { id: "12184:resolution:2", cardCode: "12184", lines: ["12184:B:4"], timing: "resolution", instructions: [{ verb: "ChooseStagedLocationForPool" }] },

    // 19036 Durin's Key: claimed by the first player once nothing guards it (attached to one of their heroes); Action: exhaust it to give each location -1 Threat; at the beginning of the quest phase the player who controls it looks at the top 3 cards of the encounter deck, reveals 1 and discards the rest.
    { id: "19036:constant:1", cardCode: "19036", lines: ["19036:A:1"], timing: "constant", instructions: [{ verb: "ClaimWhenFree" }, { verb: "ModifyStat", stat: "returnsToStagingArea", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "19036:action:1", cardCode: "19036", lines: ["19036:A:2"], timing: "action", cost: { kind: "exhaustSelf" }, instructions: [{ verb: "ModifyStat", stat: "threat", amount: -1, until: "endOfPhase", holders: { type: "location", control: "any" } }] },
    {
      id: "19036:forced:1",
      cardCode: "19036",
      lines: ["19036:A:3"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "count", pick: { type: "objective", control: "any", controlled: true, names: ["Durin's Key"] }, min: 1 }] },
      instructions: LOOK_AT_THREE,
    },
    // 19037 Urdug's Horn: attached to Urdug once nothing guards it; when Urdug attacks (as an ally, or as an enemy) the top card of the encounter deck is discarded and its Threat added to his Attack until the end of the phase.
    { id: "19037:constant:1", cardCode: "19037", lines: ["19037:A:1"], timing: "constant", instructions: [{ verb: "ClaimWhenFree", host: "Urdug" }, { verb: "ModifyStat", stat: "returnsToStagingArea", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "19037:forced:1",
      cardCode: "19037",
      lines: ["19037:A:2"],
      timing: "forced",
      trigger: "declaredAttacker",
      subject: "host",
      instructions: [{ verb: "DiscardEncounterTop", count: 1 }, { verb: "ModifyStat", stat: "attack", amount: { stat: "threat", of: "discardTop", printed: true }, until: "endOfPhase", target: "host" }],
    },
    {
      id: "19037:forced:2",
      cardCode: "19037",
      lines: ["19037:A:2"],
      timing: "forced",
      trigger: "attacks",
      subject: "host",
      instructions: [{ verb: "DiscardEncounterTop", count: 1 }, { verb: "ModifyStat", stat: "attack", amount: { stat: "threat", of: "discardTop", printed: true }, until: "endOfPhase", target: "host" }],
    },

    // 19038 Grey Mountain Giant: when it engages a player, the top 5 cards of their deck are discarded and they assign damage among their characters equal to the allies discarded.
    {
      id: "19038:forced:1",
      cardCode: "19038",
      lines: ["19038:A:2"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [{ verb: "DiscardFromDeck", amount: 5, count: { type: "ally", control: "any", looked: true } }, { verb: "AssignDamage", amount: { x: true }, pick: { type: "character", control: "you" } }],
    },
    // 19039 Hunting Eagle (Surge is a keyword): cannot be optionally engaged; engages the first player when the encounter phase begins; the Shadow gives the attacker +1 Attack, +2 against a Creature.
    copyLine("18021:A:1", "19039:A:1"),
    {
      id: "19039:forced:1",
      cardCode: "19039",
      lines: ["19039:A:2"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: { kind: "phase", is: "Encounter" },
      instructions: [EACH_PLAYER([{ verb: "Engage", target: "self", when: { kind: "firstPlayer" } }])],
    },
    {
      id: "19039:shadow:1",
      cardCode: "19039",
      lines: ["19039:A:3"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Creature" } } } },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Creature" } } },
      ],
    },
    // 19040 Wilderland Bear: the first player chooses between the Bear's immediate attack against them and each player discarding a card from hand at random.
    {
      id: "19040:whenRevealed:1",
      cardCode: "19040",
      lines: ["19040:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "attack", instructions: [{ verb: "AttackFromStaging", target: "self", who: "firstPlayer" }] },
            { id: "discard", instructions: [{ verb: "DiscardRandomFromHand", amount: 1, who: "eachSeat" }] },
          ],
        },
      ],
    },
    // 19041 Grey Moorland (the Shadow is a template): after it becomes the active location the discard pile goes back into the encounter deck and cards are discarded until a treachery is, whose When Revealed effect resolves.
    {
      id: "19041:forced:1",
      cardCode: "19041",
      lines: ["19041:A:1"],
      timing: "forced",
      trigger: "becameActive",
      subject: "self",
      instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntil", type: "treachery" }, { verb: "ResolveWhenRevealed", when: PICKED_IS("treachery") }],
    },
    // 19042 Deep Ravine: while in the staging area at most 1 progress a round goes on the locations there, all together; Travel: the first player exhausts Urdug or every player raises their threat by 2.
    { id: "19042:constant:1", cardCode: "19042", lines: ["19042:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "progressCapShared", amount: 1, until: "whileSourceInPlay", holders: STAGING_LOCATIONS }] },
    {
      id: "19042:travel:1",
      cardCode: "19042",
      lines: ["19042:A:2"],
      timing: "travel",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            {
              id: "exhaust",
              requires: { kind: "canPick", pick: { type: "card", control: "you", names: ["Urdug"], state: "ready", who: "firstPlayer" } },
              instructions: [{ verb: "Pick", pick: { type: "card", control: "you", names: ["Urdug"], state: "ready", who: "firstPlayer" } }, { verb: "Exhaust", target: { kind: "picked" } }],
            },
            { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },
          ],
        },
      ],
    },
    // 19043 Slopes of Ered Mithrin (Doomed is a keyword): after the players travel here the first player may ready a character; the Shadow exhausts Urdug when the first player controls him.
    {
      id: "19043:response:1",
      cardCode: "19043",
      lines: ["19043:A:2"],
      timing: "response",
      trigger: "traveled",
      condition: { kind: "canPick", pick: { type: "character", control: "you", state: "exhausted", who: "firstPlayer" } },
      instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "exhausted", who: "firstPlayer" } }, { verb: "Ready", target: "picked" }],
    },
    {
      id: "19043:shadow:1",
      cardCode: "19043",
      lines: ["19043:A:3"],
      timing: "shadow",
      instructions: [
        { verb: "Pick", pick: { type: "card", control: "you", names: ["Urdug"], who: "firstPlayer" }, when: CONTROLS_URDUG },
        { verb: "Exhaust", target: { kind: "picked" }, when: CONTROLS_URDUG },
      ],
    },
    // 19044 Sneaking Off: the first player loses control of Urdug, who is attached to a location in the staging area (their choice) as a guarded objective; without one, or without Urdug under their control, 5 is added to the Threat in the staging area until the end of the phase. Sneaking Off leaves the game.
    {
      id: "19044:whenRevealed:1",
      cardCode: "19044",
      lines: ["19044:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: { type: "location", control: "any", stagingOnly: true, who: "firstPlayer" }, when: CONTROLS_URDUG },
        { verb: "GuardReturnedBy", code: URDUG, when: PICKED_LOCATION },
        { verb: "RaiseStagingThreat", amount: 5, until: "endOfPhase", when: { kind: "not", condition: PICKED_LOCATION } },
        { verb: "RemoveSourceFromGame" },
      ],
    },
    // 19045 Harsh Weather: for each ready character, its player exhausts it or raises their threat by 1; the Shadow gives the attacker +1 Attack and, if the attack destroys a character, its player exhausts a character.
    { id: "19045:whenRevealed:1", cardCode: "19045", lines: ["19045:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "ExhaustOrDamageEachReady", amount: 1, or: "threat" }])] },
    {
      id: "19045:shadow:1",
      cardCode: "19045",
      lines: ["19045:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" },
        { verb: "AfterAttack", instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" }, when: { kind: "x", min: 1 } }, { verb: "Exhaust", target: { kind: "picked" }, when: { kind: "x", min: 1 } }] },
      ],
    },
    // 19046 Wild Creatures: each player in turn chooses an enemy in the staging area and engages it; if a player has none to engage, cards are discarded until a Creature enemy is, and it joins the staging area.
    {
      id: "19046:whenRevealed:1",
      cardCode: "19046",
      lines: ["19046:A:1"],
      timing: "whenRevealed",
      instructions: [
        EACH_PLAYER([
          // A player with no enemy left in the staging area to choose counts toward X (read before the choice, which takes an enemy out).
          { verb: "AddToX", amount: 1, when: { kind: "not", condition: { kind: "canPick", pick: ENGAGEABLE } } },
          { verb: "Pick", pick: ENGAGEABLE, when: { kind: "canPick", pick: ENGAGEABLE } },
          { verb: "Engage", target: "picked", when: { kind: "canPick", pick: ENGAGEABLE } },
        ]),
        { verb: "DiscardUntil", type: "enemy", trait: "Creature", when: { kind: "x", min: 1 } },
        { verb: "MoveEncounterCard", card: "picked", to: "staging", when: PICKED_IS("enemy") },
      ],
    },

    // 19047 The Goblin's Task (stage 1). Setup: Urdug (set aside with his enemy side) comes under the first player, objective side up; the other objectives wait set aside; the encounter deck is shuffled and a location for each player joins the staging area.
    // Side B: no progress goes on the locations in the staging area; when the active location is explored with the first player controlling Urdug, the quest proceeds to a random stage 2.
    { id: "19047:setup:1", cardCode: "19047", lines: ["19047:A:1"], timing: "setup", instructions: [{ verb: "TakeControlOfSetAside", code: URDUG }, { verb: "ShuffleEncounterDeck" }, LOCATIONS_TO_STAGING] },
    { id: "19047:constant:1", cardCode: "19047", lines: ["19047:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", holders: STAGING_LOCATIONS }] },
    {
      id: "19047:forced:1",
      cardCode: "19047",
      lines: ["19047:B:2"],
      timing: "forced",
      trigger: "activeExplored",
      condition: CONTROLS_URDUG,
      instructions: [{ verb: "AdvanceToRandomStage", codes: STAGE_TWOS, otherwise: "19051", onDefeat: true }],
    },
    // 19048 Rescue Tiny (stage 2). A Grey Moorland guards Tiny. Side B: the When Revealed effects of treacheries cannot be canceled; the stage leaves the game when defeated and the quest proceeds to another stage 2 at random, else stage 3; the players cannot travel to the Grey Moorland guarding Tiny
    // without 5 progress on this stage, and cannot defeat it unless the first player controls Urdug and Tiny.
    GUARD_OBJECTIVE("19048:whenRevealed:1", "19048", "19048:A:1", "19041", "Grey Moorland", TINY, "Tiny"),
    { id: "19048:constant:1", cardCode: "19048", lines: ["19048:B:1"], timing: "constant", instructions: [{ verb: "UncancelableWhenRevealed", cardType: "treachery" }] },
    RANDOM_STAGE("19048:forced:1", "19048", "19048:B:2"),
    { id: "19048:constant:2", cardCode: "19048", lines: ["19048:B:3"], timing: "constant", condition: NOT_FIVE_PROGRESS, instructions: [{ verb: "Restrict", what: "travel", location: "19041", guarding: "Tiny" }] },
    { id: "19048:constant:3", cardCode: "19048", lines: ["19048:B:3"], timing: "constant", condition: { kind: "not", condition: CONTROLS_URDUG }, instructions: [{ verb: "Restrict", what: "advance" }] },
    { id: "19048:constant:4", cardCode: "19048", lines: ["19048:B:3"], timing: "constant", condition: { kind: "not", condition: CONTROLS_TINY }, instructions: [{ verb: "Restrict", what: "advance" }] },
    // 19049 Retrieve Urdug's Horn (stage 2). A Grey Mountain Giant guards Urdug's Horn. Side B: each enemy guarding a card gets +2 Threat and +2 Defense; the Giant guarding the Horn takes no damage without 5 progress here; the stage cannot be defeated unless the first player controls Urdug with the Horn attached.
    GUARD_OBJECTIVE("19049:whenRevealed:1", "19049", "19049:A:1", "19038", "Grey Mountain Giant", "19037", "Urdug's Horn"),
    { id: "19049:constant:1", cardCode: "19049", lines: ["19049:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, guardsCard: true } }, { verb: "ModifyStat", stat: "defense", amount: 2, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, guardsCard: true } }] },
    RANDOM_STAGE("19049:forced:1", "19049", "19049:B:2"),
    { id: "19049:constant:2", cardCode: "19049", lines: ["19049:B:3"], timing: "constant", condition: NOT_FIVE_PROGRESS, instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, names: ["Grey Mountain Giant"], guardsNamed: "Urdug's Horn" } }] },
    {
      id: "19049:constant:3",
      cardCode: "19049",
      lines: ["19049:B:3"],
      timing: "constant",
      condition: { kind: "not", condition: { kind: "count", pick: { type: "card", control: "you", names: ["Urdug"], who: "firstPlayer", hasAttachment: { names: ["Urdug's Horn"] } }, min: 1 } },
      instructions: [{ verb: "Restrict", what: "advance" }],
    },
    // 19050 Find Durin's Key (stage 2). A Deep Ravine guards Durin's Key. Side B: each encounter card guarding a card is immune to player card effects; the players cannot travel to the Deep Ravine guarding the Key without 5 progress here, and cannot defeat the stage unless they control Urdug and the Key.
    GUARD_OBJECTIVE("19050:whenRevealed:1", "19050", "19050:A:1", "19042", "Deep Ravine", "19036", "Durin's Key"),
    { id: "19050:constant:1", cardCode: "19050", lines: ["19050:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: { type: "card", control: "any", engagedEnemies: true, guardsCard: true } }] },
    RANDOM_STAGE("19050:forced:1", "19050", "19050:B:2"),
    { id: "19050:constant:2", cardCode: "19050", lines: ["19050:B:3"], timing: "constant", condition: NOT_FIVE_PROGRESS, instructions: [{ verb: "Restrict", what: "travel", location: "19042", guarding: "Durin's Key" }] },
    { id: "19050:constant:3", cardCode: "19050", lines: ["19050:B:3"], timing: "constant", condition: { kind: "not", condition: CONTROLS_URDUG }, instructions: [{ verb: "Restrict", what: "advance" }] },
    { id: "19050:constant:4", cardCode: "19050", lines: ["19050:B:3"], timing: "constant", condition: { kind: "not", condition: { kind: "count", pick: { type: "objective", control: "any", controlled: true, names: ["Durin's Key"] }, min: 1 } }, instructions: [{ verb: "Restrict", what: "advance" }] },
    // 19051 Urdug's Gambit (stage 3). Urdug and Tiny turn to their enemy sides in the staging area, without damage. Side B: progress cannot be placed on the quest by questing; when the players quest unsuccessfully they do not raise their threat but place the amount on this stage, and lose the game when it holds as much
    // as its quest points; the players win the game when Urdug has no hit points remaining.
    {
      id: "19051:whenRevealed:1",
      cardCode: "19051",
      lines: ["19051:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "FlipToEnemySide", code: URDUG, into: "19053" }, { verb: "FlipToEnemySide", code: TINY, into: "19055" }, EACH_OTHER_REVEALS],
    },
    // Stage 3 is never defeated by progress (it has none from questing, and the progress it keeps is a loss): only Urdug's hit points end it, in a win.
    { id: "19051:constant:1", cardCode: "19051", lines: ["19051:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noQuestProgress", amount: 1, until: "whileSourceInPlay", target: "table" }, { verb: "Restrict", what: "advance" }] },
    // The failed quest answers before the threat is raised: the stage waives it and keeps the amount (the event's X) as progress; the players lose the game once it holds as much as the quest points. Only the first player's failed quest is heard, so a table of several players places it once. The stage is never defeated by progress.
    {
      id: "19051:forced:1",
      cardCode: "19051",
      lines: ["19051:B:2"],
      timing: "forced",
      trigger: "questFailed",
      eventSeat: "you",
      instructions: [{ verb: "WaiveQuestThreat", who: "eachSeat", until: "endOfPhase" }, { verb: "AddStageProgress", amount: { x: true } }, { verb: "LoseGame", reason: "Urdug's Gambit holds as much progress as it has quest points", when: { kind: "stageProgress", min: 5 } }],
    },
    {
      id: "19051:constant:3",
      cardCode: "19051",
      lines: ["19051:B:3"],
      timing: "constant",
      // Urdug has no hit points remaining: his damage is as much as his hit points (hit points less than damage plus 1).
      condition: { kind: "all", conditions: [{ kind: "canPick", pick: { type: "enemy", control: "any", staging: true, names: ["Urdug"] } }, { kind: "less", left: { stat: "hitPoints", ofNamed: "Urdug" }, right: { stat: "damage", ofNamed: "Urdug", plus: 1 } }] },
      instructions: [{ verb: "WinGame" }],
    },

    // 19052 Urdug (objective ally): Immune is a keyword; the first player gains control of him once nothing guards him (a claim); the players lose the game if he is destroyed.
    { id: "19052:constant:1", cardCode: "19052", lines: ["19052:A:2"], timing: "constant", instructions: [{ verb: "GainControlWhenFree", who: "firstPlayer", claim: true }] },
    { id: "19052:forced:1", cardCode: "19052", lines: ["19052:A:3"], timing: "forced", trigger: "characterDestroyed", subject: "self", instructions: [{ verb: "LoseGame", reason: "Urdug was destroyed" }] },
    // 19053 Urdug (enemy; Indestructible and Immune are keywords): while engaged with a player he makes an immediate attack at the beginning of the quest phase; if it deals damage Urdug and Tiny return to the staging area.
    { id: "19053:forced:1", cardCode: "19053", lines: ["19053:A:2"], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "sourceIn", zone: "engaged" }] }, instructions: [{ verb: "ImmediateAttack" }] },
    {
      id: "19053:forced:2",
      cardCode: "19053",
      lines: ["19053:A:2"],
      timing: "forced",
      trigger: "damagedByAttack",
      subject: { type: "character", control: "any" },
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "sourceIn", zone: "engaged" }, { kind: "matches", card: "other", pick: { type: "enemy", control: "any", names: ["Urdug"] } }] },
      instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", staging: true, names: ["Tiny"] } }, { verb: "ReturnToStaging", target: { kind: "picked" }, when: { kind: "matches", card: "picked", pick: NAMED("Tiny") } }, { verb: "ReturnToStaging", target: { kind: "self" } }],
    },
    // 19054 Tiny (objective ally): the first player gains control of him once nothing guards him (a claim); after he exhausts the first player raises their threat by 2; the players lose the game if he is destroyed.
    { id: "19054:constant:1", cardCode: "19054", lines: ["19054:A:2"], timing: "constant", instructions: [{ verb: "GainControlWhenFree", who: "firstPlayer", claim: true }] },
    { id: "19054:forced:1", cardCode: "19054", lines: ["19054:A:3"], timing: "forced", trigger: "exhausted", subject: "self", instructions: [{ verb: "RaiseThreat", amount: 2, who: "firstPlayer" }] },
    { id: "19054:forced:2", cardCode: "19054", lines: ["19054:A:4"], timing: "forced", trigger: "characterDestroyed", subject: "self", instructions: [{ verb: "LoseGame", reason: "Tiny was destroyed" }] },
    // 19055 Tiny (enemy; Immune is a keyword): Urdug takes no damage while Tiny is in play; after Urdug engages a player, Tiny engages that player.
    { id: "19055:constant:1", cardCode: "19055", lines: ["19055:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, names: ["Urdug"] } }] },
    { id: "19055:forced:1", cardCode: "19055", lines: ["19055:A:3"], timing: "forced", trigger: "engaged", subject: { type: "enemy", control: "any", names: ["Urdug"] }, instructions: [{ verb: "Engage", target: "self" }] },
  ],
  { pool: [...JOURNEY_UP_THE_ANDUIN, ...LOST_IN_MIRKWOOD, ...THE_KINGS_QUEST, ...THE_OATH, ...THE_THING_IN_THE_DEPTHS, ...THE_WITHERED_HEATH] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
