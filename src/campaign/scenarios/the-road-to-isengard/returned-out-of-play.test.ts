// Rules: rr.staging, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 143049:A:2, 143067:A:2.
// Saruman's Orders' Shadow returns the attacker after the attack destroyed a character; Gríma's Forced effect shuffled itself into the encounter deck first. A card that is out of play is not
// returned to the staging area: it stays in the deck and no card lies facedown in a play zone.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { pushCardEffects } from "../../../rules/interpret/effect-frames.ts";
import { faceProblems } from "../../../../test/harness/face-check.ts";
import { finish, idOf, tableFromLayout, where } from "../../../../test/harness/scene-kit.ts";

const ID = "the-road-to-isengard";
const GRIMA = "143049";

describe("143067:A:2 the Shadow returns the attacker to the staging area", () => {
  const returnSelf = (zone: "staging" | "encounterDeck") => {
    const made = tableFromLayout(ID, { stage: "143079", phase: "Combat", deck: ["f0", "f0"], staging: [{ code: GRIMA }] });
    const id = idOf(made.state, GRIMA);
    const placed = zone === "staging" ? made.state : moveCard(made.state, id, { zone });
    const effect: Effect = { id: "t:shadow:1", cardCode: GRIMA, lines: ["t:A:1"], timing: "forced", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] };
    const pushed = pushCardEffects(placed, "forced", id, 0, false, [effect], made.ctx, []);
    return finish({ state: settle({ ...pushed, window: null, mode: "stopped" }, made.ctx, []), steps: [] }, made.ctx).state;
  };

  it("143049:A:2 leaves a card that an earlier Forced effect shuffled into the encounter deck in the deck", () => {
    const state = returnSelf("encounterDeck");
    expect(where(state, GRIMA)).toBe("encounterDeck");
    expect(faceProblems(state)).toEqual([]);
  });

  it("143067:A:2 still returns a card that is in play", () => {
    const state = returnSelf("staging");
    expect(where(state, GRIMA)).toBe("staging");
    expect(faceProblems(state)).toEqual([]);
  });
});
