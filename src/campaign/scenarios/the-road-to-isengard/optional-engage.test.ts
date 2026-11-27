// Rules: rr.optional-engagement, rr.cannot (data/rules/entries.json). An enemy that cannot leave the staging area is not offered for optional engagement: it would not leave.
import { describe, expect, it } from "vitest";

import { optionalEnemies } from "../../../rules/quest/quest.ts";
import { rejectionReason } from "../../../rules/engine/legal.ts";
import { first, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const SARUMAN = "143047";

describe("143047:A:1 Saruman cannot leave the staging area", () => {
  const made = tableFromLayout("the-road-to-isengard", { staging: [SARUMAN, "f3"] });
  const state = { ...made.state, phase: "Encounter" as const, mode: "optionalEngage" as const, window: { kind: "optionalEngage" as const } };

  it("rr.cannot: he is not offered for optional engagement, and another enemy in the staging area is", () => {
    expect(optionalEnemies(state, made.ctx.cards)).toEqual([first(state, "f3")]);
  });

  it("rr.optional-engagement: an Engage intent for him is refused with the reason", () => {
    expect(rejectionReason(state, { type: "Engage", enemyId: first(state, SARUMAN) }, made.ctx)).toBe("That enemy cannot be optionally engaged");
  });
});
