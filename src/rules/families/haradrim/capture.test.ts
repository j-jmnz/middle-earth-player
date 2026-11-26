// Rules: rr.attachment-cards, rr.in-play-and-out-of-play, rr.engaged, rr.ownership-and-control (data/rules/entries.json); ledger lines 17027:A:1, 17011:A:1, 17012:A:1.
// AttachRandomSetAside (stage 2A's Captures: random, seeded, lying uncontrolled on a Wild Mûmak) (the Response's seat is `answeredBy`, tested in the scenario's lines.test.ts).
import { describe, expect, it } from "vitest";

import { destroyCard } from "../../core/destroy.ts";
import type { ScenarioState } from "../../core/state.ts";
import { countMatching } from "../../interpret/pick.ts";
import { idOf, opened, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const CAPTURES = ["17011", "17012", "17013", "17014"];
const MUMAK = "17015";
const table = (layout: Layout = {}) => tableFromLayout("the-mumakil", { seats: 2, stage: "17027", side: "A", phase: "Quest", setAside: CAPTURES, staging: [MUMAK], ...layout });

// Stage 2A's When Revealed: each player picks a Mûmak and attaches the next random Capture to it.
const attachAll = (layout: Layout = {}) => {
  const made = table(layout);
  return { made, state: resolveRecords(opened(made).state, made.ctx, "17027", "whenRevealed", idOf(made.state, "17027")).state };
};
const attachedCodes = (state: ScenarioState): string[] => (state.cards[idOf(state, MUMAK)]?.attachments ?? []).map((id) => state.cards[id]?.code ?? "");

describe("17027:A:1 AttachRandomSetAside: each player attaches one random set-aside Capture to a Wild Mûmak in play", () => {
  it("each Capture lies attached to the Mûmak faceup, controlled by nobody, and leaves the set-aside pile", () => {
    const { state } = attachAll();
    const codes = attachedCodes(state);
    expect(codes).toHaveLength(2);
    expect(new Set(codes).size).toBe(2);
    for (const id of state.cards[idOf(state, MUMAK)]?.attachments ?? []) expect(state.cards[id]).toMatchObject({ zone: "attached", face: "up", host: idOf(state, MUMAK) });
    expect(state.cards[(state.cards[idOf(state, MUMAK)]?.attachments ?? [])[0] ?? ""]?.controller ?? null).toBeNull();
    expect(state.setAside.map((id) => state.cards[id]?.code).filter((code) => CAPTURES.includes(code ?? "")).sort()).toEqual(CAPTURES.filter((code) => !codes.includes(code)));
  });

  it("the draw is the game seed's: the same seed gives the same Captures, other seeds give others", () => {
    const drawn = (seed: number) => attachedCodes(attachAll({ seed }).state).join();
    expect(drawn(7)).toBe(drawn(7));
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(drawn)).size).toBeGreaterThan(1);
  });

  it("with no Mûmak picked or no Capture set aside nothing is attached", () => {
    expect(attachedCodes(attachAll({ setAside: [] }).state)).toEqual([]);
    const made = table({ staging: [] });
    const state = resolveRecords(opened(made).state, made.ctx, "17027", "whenRevealed", idOf(made.state, "17027")).state;
    expect(state.setAside.filter((id) => CAPTURES.includes(state.cards[id]?.code ?? ""))).toHaveLength(4);
  });

  it("a Capture is no player's card: no player filter picks or counts it", () => {
    const { made, state } = attachAll();
    const before = table().state;
    for (const seat of [0, 1]) {
      for (const type of ["objective", "attachment", "card", "hero", "ally"] as const) {
        for (const control of ["you", "any"] as const) expect(countMatching(state, { type, control }, seat, null, made.ctx)).toBe(countMatching(before, { type, control }, seat, null, made.ctx));
      }
    }
    expect(countMatching(state, { type: "card", control: "any", allInPlay: true, trait: "Capture" }, 0, null, made.ctx)).toBe(2);
  });

  it("a Mûmak that leaves play takes its Captures to the encounter discard pile, two on one Mûmak included", () => {
    const { made, state } = attachAll();
    const left = destroyCard(state, idOf(state, MUMAK), made.ctx.cards, []);
    for (const code of attachedCodes(state)) expect(left.cards[idOf(left, code)]?.zone).toBe("encounterDiscard");
    expect(countMatching(left, { type: "card", control: "any", allInPlay: true, trait: "Capture" }, 0, null, made.ctx)).toBe(0);
  });
});
