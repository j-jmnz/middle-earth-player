import { describe, expect, it } from "vitest";

import { newCtx, type Obj } from "./kit.ts";
import { renderPick } from "./picks.ts";
import { checkPiece, type Render } from "./read-fields-piece.ts";

describe("effects render read fields, picks", () => {
  // Every key renderPick words, spread over samples because `captive` replaces the control words.
  const BIG: Obj = {
    type: "enemy",
    control: "any",
    state: "exhausted",
    sphere: "tactics",
    spheres: ["tactics", "spirit"],
    unique: true,
    nonUnique: true,
    trait: "Orc",
    traits: ["Orc", "Goblin"],
    damaged: true,
    from: "discard",
    top: 3,
    bottom: 2,
    staging: true,
    stagingOnly: true,
    engaged: "other",
    names: ["Urdug"],
    exceptNames: ["Ufthak"],
    notTraits: ["Elite"],
    other: true,
    nonObjective: true,
    objective: true,
    cardType: "hero",
    committed: true,
    attacking: true,
    defending: true,
    hasResources: true,
    progress: true,
    exceptSphere: "lore",
    who: "firstPlayer",
    engagedEnemies: true,
    hasShadow: true,
    copyInDiscard: true,
    controlled: true,
    questCard: true,
    questCardType: true,
    maxHitPointsLeft: 2,
    looked: true,
    lowestAttack: true,
    lowestThreat: true,
    highestCost: true,
    fortitudeDiscarded: true,
    isHost: true,
    determined: true,
    safe: true,
    reanimated: true,
    isSource: true,
    allInPlay: true,
    copyOfDefender: true,
    minDamage: 3,
    aboveThreat: true,
    different: true,
    guardsObjectiveLocation: true,
    hasAttachment: { names: ["Wormsbane"] },
    hasGuard: true,
    isGuard: true,
    active: true,
    questedThisRound: true,
    guardedByTrait: "Mordor",
    notGuardedByTrait: "Mordor",
    guardsTrait: "Clue",
    soleMostDamaged: true,
    attached: true,
    sideQuest: true,
  };
  const SAMPLES: readonly Obj[] = [
    BIG,
    { type: "attachment", control: "any", on: { type: "character", control: "you", minWillpower: 3 } },
    { type: "hero", control: "you", captive: "only" },
    { type: "hero", control: "you", captive: "free" },
    { type: "hero", control: "you", captive: "include" },
    { type: "hero", control: "you", committed: false, progress: false, damaged: false },
    { type: "hero", control: "you", hasAttachment: { trait: "Clue" }, hasGuard: false, isGuard: false },
    { type: "hero", control: "you", hasAttachment: { none: true }, attached: false },
  ];
  const render: Render = (value, ctx) => renderPick(value, ctx);

  it("says every field the template claims", () => {
    const result = checkPiece(render, SAMPLES);
    expect(result.unsampled).toEqual([]);
    expect(result.unclaimed).toEqual([]);
    expect(result.hidden).toEqual([]);
  });

  it("claims no field whose value it leaves unsaid", () => {
    // A false the template has no words for stays out of its claim, so it prints as `[also {...}]` in place of vanishing.
    for (const key of ["unique", "nonUnique", "hasResources", "attacking", "defending", "staging", "stagingOnly", "hasShadow", "copyInDiscard", "looked", "engagedEnemies", "objective", "nonObjective"]) {
      expect(renderPick({ type: "hero", control: "you", [key]: false }, newCtx()), key).toContain(`[also {"${key}":false}]`);
    }
  });
});
