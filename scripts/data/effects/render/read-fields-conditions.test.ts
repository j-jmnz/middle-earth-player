import { describe, expect, it } from "vitest";

import { CONDITION_TEMPLATES, ESCAPE_CONDITION_SAMPLES, GUARDIAN_CONDITION_SAMPLES, renderCondition } from "./conditions.ts";
import type { Obj } from "./kit.ts";
import { checkPiece, type Render } from "./read-fields-piece.ts";

describe("effects render read fields, conditions", () => {
  const SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
    sourceIn: [{ kind: "sourceIn", zone: "staging" }],
    less: [{ kind: "less", left: 2, right: 3 }],
    subjectExplored: [{ kind: "subjectExplored" }],
    x: [{ kind: "x", min: 2 }],
    shadowBlank: [{ kind: "shadowBlank" }],
    namedFlag: [{ kind: "namedFlag", name: "A Card", stat: "blankText" }],
    flag: [{ kind: "flag", stat: "blankText", holder: "seat", is: false }, { kind: "flag", stat: "refreshOnce", holder: "table" }],
    canPick: [{ kind: "canPick", pick: { type: "hero", control: "you" } }],
    attackedThisPhase: [{ kind: "attackedThisPhase", name: "A Card" }],
    phase: [{ kind: "phase", is: "combat" }],
    hasEngaged: [{ kind: "hasEngaged", trait: "Orc" }],
    exhausted: [{ kind: "exhausted", code: "12345", is: true }],
    count: [{ kind: "count", pick: { type: "hero", control: "you" }, min: 1, max: 3 }],
    threat: [{ kind: "threat", min: 20, max: 30 }],
    inPlay: [{ kind: "inPlay", code: "12345", is: true }],
    faceUp: [{ kind: "faceUp", side: "B" }],
    firstPlayer: [{ kind: "firstPlayer" }],
    lastPlayer: [{ kind: "lastPlayer" }],
    otherPlayer: [{ kind: "otherPlayer" }],
    handHasCard: [{ kind: "handHasCard" }],
    undefended: [{ kind: "undefended" }],
    questSucceeded: [{ kind: "questSucceeded" }],
    questFailed: [{ kind: "questFailed" }],
    logged: [{ kind: "logged", line: "A line", is: false }],
    onStage: [{ kind: "onStage", stage: 2 }],
    onDial: [{ kind: "onDial", code: "145016" }],
    canAttachToDial: [{ kind: "canAttachToDial", code: "145016" }],
    pursuit: [{ kind: "pursuit", min: 3, max: 6 }],
    tokens: [{ kind: "tokens", code: "09072", min: 1, perPlayer: true }],
    currentQuest: [{ kind: "currentQuest", is: "side" }, { kind: "currentQuest", is: "self" }, { kind: "currentQuest", is: "other" }],
    questLeads: [{ kind: "questLeads" }],
    enemyInPlay: [{ kind: "enemyInPlay", trait: "Troll", is: true }, { kind: "enemyInPlay", is: false }],
    questProgressNoted: [{ kind: "questProgressNoted", is: true }, { kind: "questProgressNoted", is: false }],
    currentQuestProgress: [{ kind: "currentQuestProgress", is: "some" }, { kind: "currentQuestProgress", is: "none" }],
    defendingAgainst: [{ kind: "defendingAgainst", trait: "Undead" }],
    attacking: [{ kind: "attacking", card: "host", enemy: { type: "enemy", control: "any" }, notEnemy: { type: "enemy", control: "any" }, alone: true, ranged: true }],
    timeOfDay: [{ kind: "timeOfDay", is: "day" }, { kind: "timeOfDay", is: "night" }],
    safeActive: [{ kind: "safeActive", is: true }, { kind: "safeActive", is: false }],
    setAsideHas: [{ kind: "setAsideHas", code: "10183" }],
    searchable: [{ kind: "searchable", trait: "Troll", type: "enemy", code: "10074", deckOnly: true, victory: true }],
    stageProgress: [{ kind: "stageProgress", min: 5 }],
    victoryPoints: [{ kind: "victoryPoints", min: 20 }],
    firstTreachery: [{ kind: "firstTreachery" }],
    hitPointsLeft: [{ kind: "hitPointsLeft", code: "09033" }],
    pileHas: [{ kind: "pileHas", pile: "harad", min: 1, max: 3 }],
    facedownUnder: [{ kind: "facedownUnder", code: "144027", min: 3, max: 8, players: true }],
    soleAttacker: [{ kind: "soleAttacker" }],
    lastFortitudeFailed: [{ kind: "lastFortitudeFailed" }],
    ...ESCAPE_CONDITION_SAMPLES,
    ...GUARDIAN_CONDITION_SAMPLES,
    lastFortitudePassed: [{ kind: "lastFortitudePassed" }],
    fortitudeFailed: [{ kind: "fortitudeFailed", scope: "round", who: "any" }],
    hostControlledByActor: [{ kind: "hostControlledByActor" }],
    captives: [{ kind: "captives", min: 1, max: 2, of: "actor" }],
    matches: [{ kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: false, inStaging: true }],
    controls: [{ kind: "controls", code: "12345" }],
    freeOfEncounters: [{ kind: "freeOfEncounters" }],
    // The combinators are not in the table: renderCondition words them.
    not: [{ kind: "not", condition: { kind: "firstPlayer" } }],
    all: [{ kind: "all", conditions: [{ kind: "firstPlayer" }, { kind: "otherPlayer" }] }],
    any: [{ kind: "any", conditions: [{ kind: "firstPlayer" }, { kind: "otherPlayer" }] }],
  };
  const render: Render = (value, ctx) => renderCondition(value, ctx);

  it("has a sample for every condition kind with a template", () => {
    expect(Object.keys(SAMPLES).filter((kind) => !["not", "all", "any"].includes(kind)).sort()).toEqual(Object.keys(CONDITION_TEMPLATES).sort());
  });

  it("says every field a template claims", () => {
    const found = Object.entries(SAMPLES).map(([kind, samples]) => [kind, checkPiece(render, samples)] as const);
    expect(found.filter(([, result]) => result.hidden.length > 0 || result.unsampled.length > 0 || result.unclaimed.length > 0)).toEqual([]);
  });
});
