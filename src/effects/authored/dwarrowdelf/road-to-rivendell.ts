import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as THE_REDHORN_GATE } from "./the-redhorn-gate.ts";
import { AUTHORED_EFFECTS as WEATHER } from "../angmar-awakened/the-weather-hills.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for Road to Rivendell (Dwarrowdelf part 5, no campaign card). Every line is read from the scan ledger (data/printed/dwarrowdelf.json). Ambush is a keyword (the build reads it from the printed line, src/rules/families/encounter/ambush.ts), so the lines that print only
// it have no record; Goblin Gate gives it to the round's first enemy (a marker and a Forced line), Barren Hills ignores it. The quest 2B's When Revealed is the same as Up the Pass's (the Redhorn Gate), Arwen's three lines are the Redhorn Gate Arwen's, and the Wild Bear's
// immediate attack is Cornered Orc's. The Nightmare deck's records are in ../nightmare/road-to-rivendell.ts. The readings are in docs/scenarios/dwarrowdelf/road-to-rivendell.md (Road to Rivendell).
// Rules: dwd.ambush, dwd.setup-road-to-rivendell, dwd.ally-objective-arwen-road-to-rivendell, rr.engagement-check, rr.engaged, rr.guarded, rr.explored, rr.search, rr.reveal, rr.defending-player, rr.exhausted, faq.first-player-elimination (data/rules/entries.json).
const ARWEN = "04041";
const GOBLIN_GATE = "04043";
const ORC_IN_STAGING: PickSpec = { type: "enemy", control: "any", stagingOnly: true, trait: "Orc" };
const GATE_IN_STAGING: PickSpec = { type: "location", control: "any", stagingOnly: true, names: ["Goblin Gate"] };
const NO_ACTIVE_LOCATION: Condition = { kind: "not", condition: { kind: "matches", card: "activeLocation", pick: { type: "location", control: "any" } } };
const IN_ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const EVERY_ALLY: PickSpec = { type: "ally", control: "any" };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 04038 Along the Misty Mountains. Setup: Arwen enters play under the first player's control, the encounter deck is shuffled, then each player reveals a card (Ambush makes its checks for an enemy revealed). Side B prints no line.
    {
      id: "04038:setup:1",
      cardCode: "04038",
      lines: ["04038:A:1"],
      timing: "setup",
      instructions: [{ verb: "TakeControlOfSetAside", code: ARWEN }, { verb: "ShuffleEncounterDeck" }, { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] }],
    },

    // 04039 Orc Outpost (stage 2). B:1: Goblin Gate is searched for in the encounter deck and discard pile (not the victory display) and added to the staging area without being revealed, the deck is not shuffled (the card prints no shuffle); then, with no active location, the Gate in the
    // staging area (the one just found or one already there) becomes the active location.
    {
      id: "04039:whenRevealed:1",
      cardCode: "04039",
      lines: ["04039:B:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "SearchMove", code: GOBLIN_GATE, to: "staging" },
        { verb: "Pick", pick: GATE_IN_STAGING, when: NO_ACTIVE_LOCATION },
        { verb: "MakeActive", when: NO_ACTIVE_LOCATION },
      ],
    },

    // 04040 Approaching Rivendell (stage 3). B:1 is Up the Pass's When Revealed. B:2: no heal effect takes damage off any character (the stage is the current stage: no condition). B:3: defeating the stage wins the game, as the Redhorn Gate's last stage.
    copyLine("04011:B:1", "04040:B:1"),
    { id: "04040:constant:1", cardCode: "04040", lines: ["04040:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeHealed", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } }] },
    copyLine("04013:B:4", "04040:B:3"),

    // 04041 Arwen Undómiel: the Redhorn Gate Arwen's three lines (dwd.ally-objective-arwen-road-to-rivendell, faq.first-player-elimination).
    copyLine("04014:A:1", "04041:A:1"),
    copyLine("04014:A:2", "04041:A:2"),
    copyLine("04014:A:3", "04041:A:3"),

    // 04042 Ruined Road. A:1: after the players travel here, the first player chooses 2 progress on Ruined Road or readying a hero he controls (an option that does nothing may be chosen: agent recommendation). A:2: the attacker returns to the staging area after it attacks, if it survived.
    {
      id: "04042:response:1",
      cardCode: "04042",
      lines: ["04042:A:1"],
      timing: "response",
      trigger: "traveled",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "progress", instructions: [{ verb: "PlaceProgressOn", amount: 2, target: "self" }] },
            { id: "ready", instructions: [{ verb: "Pick", pick: { type: "hero", control: "you", who: "firstPlayer" } }, { verb: "Ready", target: "picked" }] },
          ],
        },
      ],
    },
    { id: "04042:shadow:1", cardCode: "04042", lines: ["04042:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] },

    // 04043 Goblin Gate. A:1: while it is the active location the first enemy the encounter deck reveals each round gains ambush for the round (a marker the reveal reads, counted whether or not the Gate was active then), and when that enemy engages a player, whether by the
    // ambush checks or any other engagement, it makes an immediate attack (a shadow card dealt and resolved).
    { id: "04043:constant:1", cardCode: GOBLIN_GATE, lines: ["04043:A:1"], timing: "constant", condition: IN_ACTIVE, instructions: [{ verb: "FirstEnemyGains", keyword: "ambush" }] },
    {
      id: "04043:forced:1",
      cardCode: GOBLIN_GATE,
      lines: ["04043:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: { type: "enemy", control: "any", keyword: "gainedAmbush" },
      condition: IN_ACTIVE,
      instructions: [{ verb: "ImmediateAttackBy", target: "subject" }],
    },

    // 04044 Pathless Country. A:1: each placement of progress on it (one removal however many tokens; the card must still be in play, so one that is explored is not hit) removes 1 progress. A:2: 1 damage to each ally in play, every player's.
    { id: "04044:forced:1", cardCode: "04044", lines: ["04044:A:1"], timing: "forced", trigger: "progressPlaced", subject: "self", instructions: [{ verb: "RemoveProgressFrom", amount: 1, target: "self" }] },
    { id: "04044:shadow:1", cardCode: "04044", lines: ["04044:A:2"], timing: "shadow", instructions: [{ verb: "DamageEach", amount: 1, pick: EVERY_ALLY }] },

    // 04045 Barren Hills. A:1: while active the ambush keyword has no effect, printed or gained (no check is made).
    { id: "04045:constant:1", cardCode: "04045", lines: ["04045:A:1"], timing: "constant", condition: IN_ACTIVE, instructions: [{ verb: "ModifyStat", stat: "ignoreAmbush", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    copyLine("04042:A:2", "04045:A:2"),

    // 04046 Sleeping Sentry. A:1: 1 damage to each exhausted character of every player, then every ready character exhausts (so none of those is damaged). A:2: the defending player discards each exhausted character he controls, heroes and the defender itself included.
    {
      id: "04046:whenRevealed:1",
      cardCode: "04046",
      lines: ["04046:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "DamageEach", amount: 1, pick: { type: "character", control: "any", state: "exhausted" } },
        { verb: "Each", pick: { type: "character", control: "any", state: "ready" }, instructions: [{ verb: "Exhaust", target: { kind: "picked" } }] },
      ],
    },
    { id: "04046:shadow:1", cardCode: "04046", lines: ["04046:A:2"], timing: "shadow", instructions: [{ verb: "DiscardEach", pick: { type: "character", control: "you", state: "exhausted" } }] },

    // 04047 Followed by Night. A:1: the first player chooses (an option that does nothing may be chosen: agent recommendation): 1 damage to each ally in play and Followed by Night gains surge, or each enemy engaged with a player makes an immediate attack, each dealt its own shadow card.
    {
      id: "04047:whenRevealed:1",
      cardCode: "04047",
      lines: ["04047:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "damage", instructions: [{ verb: "DamageEach", amount: 1, pick: EVERY_ALLY }, { verb: "GainSurge" }] },
            { id: "attack", instructions: [{ verb: "ImmediateAttackEach" }] },
          ],
        },
      ],
    },
    copyLine("04042:A:2", "04047:A:2"),

    // 04048 Orc Ambush (Surge is a keyword). A:2: each Orc enemy in the staging area engages the first player, in the order he chooses (agent recommendation), whatever its engagement cost; with none in the staging area, every Orc enemy in the encounter discard pile
    // returns to the staging area and makes its ambush checks (it does not engage the first player). The number of Orcs in the staging area is read first: it decides the second sentence.
    {
      id: "04048:whenRevealed:1",
      cardCode: "04048",
      lines: ["04048:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "AddToX", amount: { count: ORC_IN_STAGING } },
        { verb: "ActAs", who: "firstPlayer" },
        { verb: "Repeat", times: { x: true }, instructions: [{ verb: "Pick", pick: ORC_IN_STAGING }, { verb: "Engage", target: "picked" }] },
        { verb: "ReturnFromDiscard", trait: "Orc", when: { kind: "not", condition: { kind: "x", min: 1 } } },
      ],
    },

    // 04049 Goblin Taskmaster (Ambush is a keyword). A:2: the engaged player deals 2 damage to 1 character he controls, hero or ally, even one the damage destroys.
    { id: "04049:forced:1", cardCode: "04049", lines: ["04049:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "Pick", pick: { type: "character", control: "you" } }, { verb: "DamageCard", amount: 2, target: "picked" }] },

    // 04050 Orc Raiders (Ambush is a keyword). A:2: the engaged player chooses and discards 2 attachments he controls, on any card (1 when he controls one, none when none).
    {
      id: "04050:forced:1",
      cardCode: "04050",
      lines: ["04050:A:2"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [{ verb: "Repeat", times: 2, instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you" } }, { verb: "DiscardPicked" }] }],
    },

    // 04051 Crebain (Surge is a keyword). A:2: while in the staging area no encounter card effect can be canceled. A:3: the attacker returns to the staging area after it attacks.
    { id: "04051:constant:1", cardCode: "04051", lines: ["04051:A:2"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "encounterUncancelable", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    copyLine("04042:A:2", "04051:A:3"),

    // 04052 Wild Bear (Ambush is a keyword). A:2: after it engages a player it makes an immediate attack, as Cornered Orc.
    copyLine("09025:A:1", "04052:A:2"),
  ],
  { pool: [...THE_REDHORN_GATE, ...WEATHER] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
