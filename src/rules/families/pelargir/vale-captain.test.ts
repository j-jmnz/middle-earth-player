// Rules: ats.captain-enemies, rr.cannot, rr.destroy, rr.in-play-and-out-of-play, rr.quest-advancement, rr.step-3-3, rr.winning-the-game (data/rules/entries.json); ledger lines 06144:B:1, 06145:B:1, 06146:B:2, 06146:B:3, 06147:A:1, 06147:A:3, 05061:A:2
// "Cannot leave play unless destroyed" of the three Captains and "cannot leave the staging area" of To the Tower, on the table of the scenario: a pick that feeds a discard or a shuffle leaves the Captain out and the ability is not offered with no other target, an effect that
// sweeps cards skips him, the staging area shuffled keeps both cards and their tokens and still counts them, an effect with no pick that moves him out of play is undone, and his destruction advances the quest and wins the game.
import { describe, expect, it } from "vitest";

import { flagged } from "../../core/state.ts";
import { noTargetReason } from "../../player/potential.ts";
import { idOf, resolveRecords, revealedTop } from "../../../../test/harness/scene-kit.ts";
import { CODES, engagedCodes, fight, opened, run, table, tokens, where } from "../../../../test/scenarios/the-morgul-vale/table.ts";

const { rearguard, rider, tower, bodyguard, tracker, murzag, alcaron, nazgul, vale, powerOfMordor } = CODES;
const LIE_LOW = "10081";
const FORD = "141059";

describe("a Pick that feeds a verb taking the Captain out of play", () => {
  const lieLow = (layout: Parameters<typeof table>[0]) => {
    const t = table(layout, undefined, [LIE_LOW]);
    const record = t.ctx.effects.find((effect) => effect.id === "10081:response:1");
    if (!record) throw new Error("no record for Lie Low");
    return { t, record };
  };

  it("leaves the Captain out of the choice of a shuffle into the encounter deck: only the other enemy in the staging area is taken", () => {
    const { t } = lieLow({ staging: [tower, murzag, tracker], deck: [bodyguard] });
    const done = resolveRecords(t.state, t.ctx, LIE_LOW, "response");
    expect(where(done.state, tracker)).toBe("encounterDeck");
    expect(where(done.state, murzag)).toBe("staging");
    expect(flagged(done.state, idOf(done.state, murzag), "cannotLeavePlay")).toBe(true);
  });

  it("finds no target when the Captain is the only enemy, so the effect does nothing and the Captain stays", () => {
    const { t, record } = lieLow({ staging: [tower, murzag], deck: [bodyguard] });
    const done = resolveRecords(t.state, t.ctx, LIE_LOW, "response");
    expect(where(done.state, murzag)).toBe("staging");
    expect(done.state.encounterDeck).toHaveLength(1);
    // The ability is not offered either (rr.the-word-choose): the card has no legal target.
    expect(noTargetReason(t.state, record.instructions, idOf(t.state, tower), 0, t.ctx)).toMatch(/no legal target/);
  });

  it("is offered while another enemy can be chosen", () => {
    const { t, record } = lieLow({ staging: [tower, murzag, tracker] });
    expect(noTargetReason(t.state, record.instructions, idOf(t.state, tower), 0, t.ctx)).toBeNull();
  });

  it("is inert for a Captain of an earlier stage that is no longer held: at stage 2 Murzag, back in play, can be chosen", () => {
    const { t, record } = lieLow({ stage: CODES.betrayal, staging: [tower, murzag] });
    expect(noTargetReason(t.state, record.instructions, idOf(t.state, tower), 0, t.ctx)).toBeNull();
  });

  it("leaves the Captain out of an effect that discards each enemy engaged: Ford of Bruinen discards the Tracker and keeps Murzag engaged", () => {
    const t = table({ engaged: [murzag, tracker], staging: [tower] }, undefined, [FORD]);
    const done = resolveRecords(t.state, t.ctx, FORD, "response");
    expect(engagedCodes(done.state)).toEqual([murzag]);
    expect(where(done.state, tracker)).toBe("encounterDiscard");
  });
});

describe("The Power of Mordor with the Captain and To the Tower in the staging area (05061:A:2)", () => {
  it("counts both in X, shuffles neither, keeps the tokens on To the Tower and reveals as many cards as it counted", () => {
    const t = table({ staging: [{ code: tower, progress: 4 }, murzag, tracker, vale], deck: [bodyguard, bodyguard, bodyguard, bodyguard, bodyguard, bodyguard], threat: [20, 20] }, undefined, [powerOfMordor]);
    const after = revealedTop(t, powerOfMordor);
    expect(where(after, tower)).toBe("staging");
    expect(where(after, murzag)).toBe("staging");
    expect(tokens(after)).toBe(4);
    // Tracker and Morgul Vale went back into the deck; X is 4, so 4 cards are revealed from the six cards plus the two shuffled in.
    const deckLeft = after.encounterDeck.length;
    expect(deckLeft).toBe(8 - 4);
  });
});

describe("an effect with no pick that moves the Captain out of play", () => {
  it("is undone: Murzag, engaged, put in the encounter discard pile returns to the staging area, face up", () => {
    const t = table({ engaged: [murzag], staging: [tower] });
    const id = idOf(t.state, murzag);
    const moved = run(t, t.state, { verb: "MoveEncounterCard", card: "self", to: "discard" }, { sourceId: id });
    expect(where(moved, murzag)).toBe("staging");
    expect(moved.cards[id]).toMatchObject({ face: "up", controller: null });
    expect(engagedCodes(moved)).toEqual([]);
  });

  it("is not undone when the Captain was destroyed: he stays in the encounter discard pile, the quest advances and the next Captain is added (06144:B:1, 06145:A:1)", () => {
    const t = table({ engaged: [murzag], staging: [tower], setAside: [alcaron], deck: [bodyguard] });
    const id = idOf(t.state, murzag);
    const done = run(t, t.state, { verb: "DamageCard", amount: 7, target: "self" }, { sourceId: id });
    expect(where(done, murzag)).toBe("encounterDiscard");
    expect(done.cards[done.questStage ?? ""]?.code).toBe(CODES.betrayal);
    expect(where(done, alcaron)).toBe("staging");
    expect(flagged(done, idOf(done, alcaron), "cannotLeavePlay")).toBe(true);
    expect(flagged(done, id, "cannotLeavePlay")).toBe(false);
  });

  it("holds each Captain only while his stage is current: Lord Alcaron at stage 2 is undone, Murzag at stage 2 is an ordinary enemy", () => {
    const t = table({ stage: CODES.betrayal, staging: [tower, alcaron, murzag] });
    const kept = run(t, t.state, { verb: "MoveEncounterCard", card: "self", to: "discard" }, { sourceId: idOf(t.state, alcaron) });
    expect(where(kept, alcaron)).toBe("staging");
    const gone = run(t, t.state, { verb: "MoveEncounterCard", card: "self", to: "discard" }, { sourceId: idOf(t.state, murzag) });
    expect(where(gone, murzag)).toBe("encounterDiscard");
  });
});

describe("the last stage and the end of the game", () => {
  it("wins the game as soon as the Nazgûl is destroyed (06146:B:3), after five separate damage of 1 (06153:A:2) with no Bodyguard in play", () => {
    const t = table({ stage: rider, staging: [tower], engaged: [nazgul] });
    const id = idOf(t.state, nazgul);
    let state = t.state;
    for (let blow = 1; blow <= 5; blow += 1) {
      state = run(t, state, { verb: "DamageCard", amount: 6, target: "self" }, { sourceId: id });
      expect(state.cards[id]?.damage ?? 5).toBe(Math.min(blow, 5));
    }
    expect(state.stageCleared).toBe(true);
  });

  it("is lost when the tenth progress token lies on To the Tower, after the placement that made it, not before (06147:A:3)", () => {
    const t = table({ staging: [{ code: tower, progress: 7 }, murzag] });
    const nine = run(t, t.state, { verb: "PlaceProgressOnNamed", name: "To the Tower", amount: 2 });
    expect(nine.lost).toBe(false);
    const ten = run(t, nine, { verb: "PlaceProgressOnNamed", name: "To the Tower", amount: 1 });
    expect(ten.lost).toBe(true);
    expect(ten.lossReason).toMatch(/10 progress tokens/);
  });

  it("does not advance the quest by progress: the stages print no quest points, so a successful quest leaves stage 1 current (06144:B:1)", () => {
    const t = table({ phase: "Quest", staging: [tower, murzag], committed: ["dh1", "dh2"] });
    const after = fight(t, opened(t), (state) => state.phase !== "Quest" && state.phase !== "Planning" && state.phase !== "Resource");
    const stage = after.state.cards[after.state.questStage ?? ""];
    expect(stage?.code).toBe(rearguard);
    expect(stage?.progress).toBeGreaterThan(0);
    expect(after.state.lost).toBe(false);
  });
});
