// Rules: mec113.saga-staging-rules, mec113.dire, rr.first-player (data/rules/entries.json); ledger lines 146024:A:3, 146029:A:1, 146041:A:2, 146072:B:1, 146073:B:1.
import { describe, expect, it } from "vitest";

import { moveCard } from "../../rules/core/zones.ts";
import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { holds } from "../../rules/interpret/conditions.ts";
import { withThreat } from "../../rules/core/state.ts";
import { resolveAmount } from "../../rules/interpret/amounts.ts";
import { ASKS } from "../words/asks/the-black-gate-opens.ts";
import { blackGateDials, blackGateHands, blackGateQuestEnd, embassyPairCards, embassyPairNow, embassyPairs } from "./black-gate.ts";
import { dialLimit, threatLevel } from "./threat-level.ts";

const ID = "the-black-gate-opens";
const at = (layout: Layout = {}) => tableFromLayout(ID, layout);
const name = (code: string) => code;

describe("the pieces of The Black Gate Opens' table", () => {
  it("146024:A:3 the resources on The Black Gate are a dial that says what they mean on stage 1 and on stage 2B, and no goal", () => {
    const first = blackGateDials(at({ staging: [{ code: "146024", resources: 3 }] }).state, name);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ id: "gate", testID: "gate-tokens", value: 3 });
    expect(first[0]?.goal).toBeUndefined();
    expect(first[0]?.note).toContain("From stage 2B");
    const second = blackGateDials(at({ stage: "146073", staging: [{ code: "146024", resources: 2 }] }).state, name);
    expect(second[0]?.note).toContain("reveals 2 encounter cards in each staging step, and Jaws of Steel deals 2 damage");
  });

  it("146073:B:3 stage 2B says it cannot be defeated and what ends the scenario, in the gate dial and the quest readout, and stage 1 does not", () => {
    const second = at({ stage: "146073", staging: [{ code: "146024", resources: 2 }] }).state;
    // The table kit deals no campaign card, so the end is a loss, as in a standalone game.
    expect(blackGateDials(second, name)[0]?.note).toContain("This stage cannot be defeated. The scenario ends when the last player is eliminated, and the game is lost");
    expect(blackGateQuestEnd(second)).toBe(". This stage cannot be defeated: the scenario ends when the last player is eliminated, and the game is lost");
    const campaign = at({ stage: "146073", staging: [{ code: "146024", resources: 2 }], campaign: true }).state;
    expect(blackGateDials(campaign, name)[0]?.note).toContain("and the Resolution follows");
    expect(blackGateQuestEnd(campaign)).not.toContain("game is lost");
    const first = at({ staging: [{ code: "146024", resources: 2 }] }).state;
    expect(blackGateDials(first, name)[0]?.note).not.toContain("cannot be defeated");
    expect(blackGateQuestEnd(first)).toBe("");
  });

  it("146037:A:2 The Hour of Doom's raise arms the Tap again when the characters it counts take the threat to 99 or more, and the Nazgul's 4 at 95", () => {
    const made = at({ play: ["ally"] });
    const scope = { actor: 0, sourceId: null, returned: 0 };
    const characters = resolveAmount(made.state, { count: { type: "character", control: "you" } }, scope, made.ctx);
    expect(characters).toBeGreaterThan(1);
    const hour = ASKS["146037:whenRevealed:1 @0.0 threat"]!.caution!.when;
    expect(holds(withThreat(made.state, 0, 99 - characters), hour, scope, made.ctx)).toBe(true);
    expect(holds(withThreat(made.state, 0, 98 - characters), hour, scope, made.ctx)).toBe(false);
    const nazgul = ASKS["146032:forced:1 @0 threat"]!.caution!.when;
    expect(holds(withThreat(made.state, 0, 95), nazgul, scope, made.ctx)).toBe(true);
    expect(holds(withThreat(made.state, 0, 94), nazgul, scope, made.ctx)).toBe(false);
  });

  it("146072:B:1 the Embassy dial waits for the paired row, and the pair's two cards open from the choice", () => {
    const made = at({ staging: ["f3"], hand: ["c3"] });
    const unpaired = { ...made.state, embassy: { players: [], encounter: [], pairs: [], at: 0 } };
    expect(blackGateDials(unpaired, name).find((dial) => dial.id === "embassy")).toBeUndefined();
    expect(embassyPairCards(unpaired)).toEqual([]);
    const player = idOf(made.state, "c3");
    const encounter = idOf(made.state, "f3");
    const paired = { ...made.state, embassy: { players: [player], encounter: [encounter], pairs: [{ player, encounter }], at: 1 } };
    expect(embassyPairCards(paired)).toEqual([player, encounter]);
  });

  it("146029:A:1 the enemies under Reeking Moat are a dial counting them, and there is none with nothing under it", () => {
    const made = at({ staging: ["146029"], under: [{ code: "f3", to: "146029" }, { code: "f0", to: "146029" }] });
    expect(blackGateDials(made.state, name).find((dial) => dial.id === "moat")).toMatchObject({ value: 2, label: "Moat" });
    expect(blackGateDials(at({ staging: ["146029"] }).state, name).find((dial) => dial.id === "moat")).toBeUndefined();
  });

  it("146072:B:1 the Embassy's pairs are a dial while Setup decides them, each with its owner, and the pair being decided is named", () => {
    const made = at({ seats: 2, hand: [{ code: "ally", seat: 1 }, { code: "c3", seat: 0 }], staging: ["f3", "f0"] });
    const player = idOf(made.state, "ally");
    const other = idOf(made.state, "c3");
    const state = { ...made.state, embassy: { players: [player, other], encounter: [idOf(made.state, "f3"), idOf(made.state, "f0")], pairs: [{ player, encounter: idOf(made.state, "f3") }, { player: other, encounter: idOf(made.state, "f0") }], at: 1 } };
    const owned = moveCard(moveCard(state, player, { zone: "setAside" }), other, { zone: "setAside" });
    const cards = { ...owned, cards: { ...owned.cards, [player]: { ...owned.cards[player]!, controller: 1 }, [other]: { ...owned.cards[other]!, controller: 0 } } };
    expect(embassyPairs(cards, name)).toEqual(["Player 2's ally with f3", "Player 1's c3 with f0"]);
    expect(embassyPairNow(cards, (id) => cards.cards[id]?.code ?? id)).toBe("Player 2's ally with f3");
    expect(blackGateDials(cards, name).find((dial) => dial.id === "embassy")).toMatchObject({ value: 2, label: "Embassy" });
    expect(embassyPairNow(made.state, name)).toBeNull();
  });

  it("146041:A:2 the seat that controls Gwaihir wears a mark, and the first player's says he is earned if he stays", () => {
    const made = at({ seats: 2, play: [{ code: "146041", seat: 0 }] });
    const marks = blackGateHands(made.state);
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ seat: 0, label: "P1 · Gwaihir" });
    expect(marks[0]?.note).toContain("joins the campaign pool");
    expect(blackGateHands(at({ seats: 2, staging: ["f3"] }).state)).toEqual([]);
  });

  it("146072:B:1 the threat dials read 99 under Dire: the meter, the warming and the words", () => {
    expect(dialLimit(true)).toBe(99);
    expect(dialLimit(false)).toBeUndefined();
    expect(threatLevel(60, dialLimit(true))).toBe("calm");
    expect(threatLevel(80, dialLimit(true))).toBe("near");
    expect(threatLevel(90, dialLimit(true))).toBe("critical");
    expect(threatLevel(45, dialLimit(false))).toBe("critical");
  });
});
