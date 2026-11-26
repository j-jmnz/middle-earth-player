// Rules: rr.staging, rr.in-play-and-out-of-play, rr.step-6-4-3 (data/rules/entries.json); ledger lines 143049:A:2, 143067:A:2.
// Gríma attacks with Saruman's Orders as his Shadow and destroys a character. The Shadow returns the attacker to the staging area after the attack, but Gríma's Forced effect shuffled him into the
// encounter deck first: a card that left play is not returned (an ability acts on cards in play, rr.in-play-and-out-of-play), so no card lies facedown in the staging area.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { pushCardEffects } from "../../../rules/interpret/effect-frames.ts";
import { faceProblems } from "../../../../test/harness/face-check.ts";
import { fightEnemy, finish, idOf, tableFromLayout, where, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-road-to-isengard";
const GRIMA = "143049";
const ORDERS = "143067";
const table = (layout: Layout) => tableFromLayout(ID, { stage: "143079", ...layout });

describe("143049:A:2 Gríma shuffles himself back in after his attack", () => {
  it("143067:A:2 the Shadow does not return him to the staging area after he destroyed a character: he stays in the encounter deck", () => {
    const fight = fightEnemy(table, ORDERS, GRIMA, { play: ["ally"] }, { defender: (made) => idOf(made.state, "ally") });
    const state = fight.run.state;
    expect(where(state, "ally")).toBe("discard");
    expect(where(state, GRIMA)).toBe("encounterDeck");
    expect(faceProblems(state)).toEqual([]);
  });
});

describe("143067:A:2 returns the attacker to the staging area", () => {
  const returnSelf = (zone: "engaged" | "encounterDiscard" | "encounterDeck") => {
    const made = table({ phase: "Combat", deck: ["f0", "f0"], engaged: [{ code: GRIMA, seat: 0 }] });
    const id = idOf(made.state, GRIMA);
    const placed = zone === "engaged" ? made.state : moveCard(made.state, id, { zone });
    const effect: Effect = { id: "t:forced:1", cardCode: GRIMA, lines: ["t:A:1"], timing: "forced", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] };
    const pushed = pushCardEffects(placed, "forced", id, 0, false, [effect], made.ctx, []);
    return finish({ state: settle({ ...pushed, window: null, mode: "stopped" }, made.ctx, []), steps: [] }, made.ctx).state;
  };

  it("143067:A:2 returns an attacker that is in play", () => {
    expect(where(returnSelf("engaged"), GRIMA)).toBe("staging");
  });

  it("143067:A:2 leaves a card in the encounter discard pile where it is (rr.in-play-and-out-of-play)", () => {
    const state = returnSelf("encounterDiscard");
    expect(where(state, GRIMA)).toBe("encounterDiscard");
    expect(faceProblems(state)).toEqual([]);
  });
});
