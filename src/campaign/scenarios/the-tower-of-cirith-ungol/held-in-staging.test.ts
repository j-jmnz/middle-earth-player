// Rules: rr.cannot, rr.staging, rr.cancel (data/rules/entries.json); ledger lines 146066:B:1, 141001:A:1.
// Stage 1B holds each location in the staging area. A card that cannot leave it is not shuffled into the encounter deck (Frodo Baggins' cancel, 141001:A:1, shuffles the revealed card back): it stays where it is and keeps its
// face, so no card lies facedown in the staging area.
import { describe, expect, it } from "vitest";

import type { EngineStep, PlayerIntent } from "../../../rules/core/intents.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { legalIntents } from "../../../rules/engine/legal.ts";
import { moveEncounter } from "../../../rules/families/encounter/moves.ts";
import { shuffleIntoEncounterDeck } from "../../../rules/interpret/verbs.ts";
import { faceProblems } from "../../../../test/harness/face-check.ts";
import { finish, idOf, opened, revealFromTop, send, tableFromLayout, where } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-tower-of-cirith-ungol";
const PASSAGE = "146016";

describe("a staged location that stage 1B holds (146066:B:1)", () => {
  const table = (stage: string) => {
    const t = tableFromLayout(SCENARIO, { stage, staging: [{ code: PASSAGE }] });
    return { t, state: opened(t).state };
  };

  it("146066:B:1 is not shuffled into the encounter deck while stage 1B holds it, and stays faceup", () => {
    const { state } = table("146066");
    const after = shuffleIntoEncounterDeck(state, idOf(state, PASSAGE));
    expect(where(after, PASSAGE)).toBe("staging");
    expect(after.cards[idOf(state, PASSAGE)]?.face).toBe("up");
    expect(faceProblems(after)).toEqual([]);
  });

  it("146066:B:1 is not put on the encounter deck while stage 1B holds it", () => {
    const { t, state } = table("146066");
    const steps: EngineStep[] = [];
    const after = moveEncounter(state, idOf(state, PASSAGE), "deckTop", 0, t.ctx, steps);
    expect(where(after, PASSAGE)).toBe("staging");
    expect(faceProblems(after)).toEqual([]);
  });

  it("146066:B:1 once stage 1B has gone the location is shuffled in facedown", () => {
    const { state } = table("146067");
    const after = shuffleIntoEncounterDeck(state, idOf(state, PASSAGE));
    expect(where(after, PASSAGE)).toBe("encounterDeck");
    expect(after.cards[idOf(state, PASSAGE)]?.face).toBe("down");
  });
});

// Frodo Baggins' Response cancels an encounter card just revealed: "Shuffle that card back into the encounter deck and reveal another encounter card" (141001:A:1). A location that stage 1B holds in
// the staging area cannot be shuffled back (rr.cannot): it stays there, faceup, and one more card is revealed.
describe("141001:A:1 Frodo Baggins cancels a revealed location that stage 1B holds", () => {
  it("141001:A:1 the location stays in the staging area faceup and another encounter card is revealed", () => {
    const t = tableFromLayout(SCENARIO, { stage: "146066", phase: "Quest", deck: ["f0", "f0"], attached: [{ code: "146065", to: "dh1" }] }, { extra: ["141001"] });
    const frodo = spawn(t.state, "141001", { zone: "heroes", seat: 0 });
    const stocked = updateCard(frodo.state, frodo.id, { resources: 2 });
    const encounter = stocked.encounterDeck.length;
    const revealed = revealFromTop(stocked, t.ctx, PASSAGE, []);
    const offer = legalIntents(revealed.state, t.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "141001:response:1");
    expect(offer).toBeDefined();
    const after = finish(send({ state: revealed.state, steps: [] }, { ...(offer as PlayerIntent & { type: "Trigger" }), payments: [{ heroId: frodo.id, amount: 1 }] }, t.ctx), t.ctx).state;
    const passage = after.cards[revealed.id];
    expect([passage?.zone, passage?.face]).toEqual(["staging", "up"]);
    expect(faceProblems(after)).toEqual([]);
    // The one more card is revealed: the Passage came off the deck and stayed out of it, and one more card came off.
    expect(after.encounterDeck.length).toBeLessThan(encounter);
  });
});
