import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { resolveAmount } from "../../interpret/amounts.ts";
import { holds } from "../../interpret/conditions.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { dealOneShadow, runInstruction } from "../../interpret/interpret.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { discardShadowOf } from "../../combat/shadow.ts";
import { dealShadows } from "../../combat/combat.ts";
import { finish, start, idOf, idsOf, send, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { stagingAttackers } from "../south/watcher.ts";

// Rules: dwd.durins-bane, rr.hit-points, rr.shadow-effects, rr.cancel (data/rules/entries.json); ledger lines 04150:A:2, 04141:A:1, 04139:B:1, 901801:A:2, 901801:A:3, 901801:A:4, 901806:A:1.
// The flame family and the flag engagedWithThreatening on tables of the scenario's own cards.
const table = (layout: Parameters<typeof tableFromLayout>[1] = {}) => tableFromLayout("shadow-and-flame", layout);
const focus = (seat: number, sourceId: string | null = null) => ({ seat, sourceId });
const synced = (state: ScenarioState, ctx: Parameters<typeof syncConstants>[1]) => syncConstants({ ...state, window: null, mode: "stopped" }, ctx);
const run = (state: ScenarioState, instruction: Instruction, t: ReturnType<typeof table>, source: string | null = null) => runInstruction({ ...state, window: null }, instruction, focus(0, source), t.ctx, []);

describe("04150:A:2 engagedWithThreatening", () => {
  it("04150:A:2 is considered engaged with each seat whose threat is 1 or greater, read live", () => {
    const t = table({ seats: 2, staging: ["04150"], threat: [25, 0] });
    const bane = idOf(t.state, "04150");
    const state = synced(t.state, t.ctx);
    expect(stagingAttackers(state, 0)).toEqual([bane]);
    expect(stagingAttackers(state, 1)).toEqual([]);
    const raised = { ...state, seats: [state.seats[0], { ...state.seats[1], threat: 1 }] as ScenarioState["seats"] };
    expect(stagingAttackers(raised, 1)).toEqual([bane]);
  });

  it("04150:A:2 deals no shadow card to a seat that was below threat 1 when the combat phase began", () => {
    const t = table({ seats: 2, staging: ["04150"], threat: [25, 0] });
    const state = synced(t.state, t.ctx);
    const begun = dealShadows({ ...state, phase: "Combat" }, t.ctx, []);
    expect(begun.belowThreat).toEqual([1]);
  });
});

describe("The Balrog deck (901801:A:2, A:3, A:4)", () => {
  it("901801:A:2 forms the Balrog deck from the encounter cards with the Attack trait, facedown, and a Balrog discard pile", () => {
    const t = table({ nightmare: "901801", staging: ["04150"], deck: [] });
    const attacks = [spawn(t.state, "901802", { zone: "encounterDeck" }), ] as const;
    let state = attacks[0].state;
    state = spawn(state, "901803", { zone: "encounterDeck" }).state;
    const other = spawn(state, "04144", { zone: "encounterDeck" });
    const formed = run(other.state, { verb: "FormBalrogDeck", trait: "Attack" }, t);
    expect(formed.piles?.balrogDeck).toHaveLength(2);
    expect(formed.piles?.balrogDiscard).toEqual([]);
    expect(formed.encounterDeck.map((id) => formed.cards[id]?.code)).toContain("04144");
    expect(formed.encounterDeck.map((id) => formed.cards[id]?.code)).not.toContain("901802");
  });

  it("901801:A:3 deals Durin's Bane its shadow card from the Balrog deck, and it goes to the Balrog discard pile", () => {
    const t = table({ nightmare: "901801", staging: ["04150"], piles: { balrogDeck: ["901802", "901803"], balrogDiscard: [] } });
    const bane = idOf(t.state, "04150");
    const state = synced(t.state, t.ctx);
    const encounterBefore = state.encounterDeck.length;
    const dealt = dealOneShadow(state, bane, [], t.ctx);
    const card = dealt.cards[bane]?.shadowId ?? "";
    expect(["901802", "901803"]).toContain(dealt.cards[card]?.code);
    expect(dealt.encounterDeck).toHaveLength(encounterBefore);
    expect(dealt.piles?.balrogDeck).toHaveLength(1);
    const discarded = discardShadowOf(dealt, bane);
    expect(discarded.piles?.balrogDiscard).toEqual([card]);
    expect(discarded.encounterDiscard).not.toContain(card);
  });

  it("901801:A:4 refills an empty Balrog deck from its discard pile at a deal, and shuffles the discard pile back with ShuffleBalrogDiscard", () => {
    const t = table({ nightmare: "901801", staging: ["04150"], piles: { balrogDiscard: ["901802", "901803"] } });
    const bane = idOf(t.state, "04150");
    const state = synced({ ...t.state, piles: { ...t.state.piles, balrogDeck: [] } }, t.ctx);
    const dealt = dealOneShadow(state, bane, [], t.ctx);
    expect(dealt.cards[bane]?.shadowId).toBeTruthy();
    expect(dealt.piles?.balrogDiscard).toEqual([]);
    const withDeck = table({ nightmare: "901801", piles: { balrogDeck: ["901802"], balrogDiscard: ["901803"] } });
    const shuffled = run(withDeck.state, { verb: "ShuffleBalrogDiscard" }, withDeck);
    expect(shuffled.piles?.balrogDeck).toHaveLength(2);
    expect(shuffled.piles?.balrogDiscard).toEqual([]);
  });

  it("901806:A:1 deals an additional shadow card from the encounter deck, not the Balrog deck", () => {
    const t = table({ nightmare: "901801", staging: ["04150"], piles: { balrogDeck: ["901802", "901803"], balrogDiscard: [] } });
    const bane = idOf(t.state, "04150");
    const state = synced(t.state, t.ctx);
    const dealt = run(state, { verb: "DealShadowTo", target: "picked", from: "encounter" }, t, bane);
    expect(dealt.cards[bane]?.shadowId).toBeFalsy();
    const attacking = runInstruction({ ...state, window: null, pendingAttack: { enemyId: bane, seat: 0 } }, { verb: "DealShadowTo", target: "attacker", from: "encounter" }, focus(0, bane), t.ctx, []);
    expect(attacking.piles?.balrogDeck).toHaveLength(2);
    expect(attacking.cards[bane]?.shadowId).toBeDefined();
  });
});

describe("Dark Pit and the hit points left (04141:A:1)", () => {
  it("04141:A:1 discards Durin's Bane from play although it cannot leave the staging area", () => {
    const t = table({ staging: ["04150"] });
    const bane = idOf(t.state, "04150");
    const state = synced(t.state, t.ctx);
    expect(moveCard(state, bane, { zone: "encounterDiscard" }).cards[bane]?.zone).toBe("staging");
    const gone = run(state, { verb: "DiscardNamedFromPlay", name: "Durin's Bane" }, t);
    expect(gone.cards[bane]?.zone).toBe("encounterDiscard");
  });

  it("04141:A:1 reads the remaining hit points as its hit points less its damage, never below 0 (FAQ 3.057)", () => {
    const t = table({ staging: [{ code: "04150", damage: 30 }] });
    const state = synced(t.state, t.ctx);
    const scope = { actor: 0, sourceId: null, returned: 0 };
    expect(resolveAmount(state, { stat: "hitPoints", ofNamed: "Durin's Bane", remaining: true }, scope, t.ctx)).toBe(0);
    const hurt = updateCard(state, idOf(state, "04150"), { damage: 20 });
    expect(resolveAmount(hurt, { stat: "hitPoints", ofNamed: "Durin's Bane", remaining: true }, scope, t.ctx)).toBe(7);
  });
});

describe("04139:B:1 committedThisRound", () => {
  it("04139:B:1 counts a hero committed this round after it is removed from the quest", () => {
    const t = table({ stage: "04139" });
    const hero = t.hero;
    const base = { ...t.state, round: 2 };
    expect(holds(base, { kind: "committedThisRound" }, { actor: 0, sourceId: null, returned: 0 }, t.ctx)).toBe(false);
    const noted = { ...base, quested: { round: 2, committed: [hero], succeeded: [] } };
    expect(holds(noted, { kind: "committedThisRound" }, { actor: 0, sourceId: null, returned: 0 }, t.ctx)).toBe(true);
    expect(idsOf(noted, "04150")).toEqual([]);
  });
});

describe("04145:A:1 Counter-Spell", () => {
  it("04145:A:1 cancels the effects of an event when the discarded card is a treachery, discards the event player's hand and Counter-Spell", () => {
    const t = table({ phase: "Planning", staging: ["04150"], attached: [{ code: "04145", to: "04150" }], deck: ["treachery", "f0"], hand: ["filler", "f0"], deckOf: ["f0", "f0"] });
    const filler = idOf(t.state, "filler");
    const draw: Effect = { id: "filler:action:1", cardCode: "filler", lines: ["filler:A:1"], timing: "action", instructions: [{ verb: "Draw", amount: 1 }] };
    const ctx = { ...t.ctx, effects: [...t.ctx.effects.filter((effect) => effect.cardCode !== "filler"), draw] };
    const state = syncConstants(t.state, ctx);
    const spell = idOf(state, "04145");
    let run = send(start(state), { type: "PlayCard", cardId: filler, payments: [] }, ctx);
    for (let guard = 0; guard < 8 && run.state.window?.kind !== "frameAction" && run.state.stack.length > 0; guard += 1) run = finish(run, ctx);
    expect(run.state.cards[filler]?.zone).toBe("discard");
    expect(run.state.seats[0].hand).toEqual([]);
    expect(run.state.seats[0].deck).toHaveLength(2);
    expect(run.state.cards[spell]?.zone).toBe("encounterDiscard");
  });

  it("04145:A:1 leaves the event and Counter-Spell alone when the discarded card is not a treachery", () => {
    const t = table({ phase: "Planning", staging: ["04150"], attached: [{ code: "04145", to: "04150" }], deck: ["f0", "f0"], hand: ["filler", "f0"], deckOf: ["f0", "f0"] });
    const filler = idOf(t.state, "filler");
    const ctx = t.ctx;
    const state = syncConstants(t.state, ctx);
    const spell = idOf(state, "04145");
    let run = send(start(state), { type: "PlayCard", cardId: filler, payments: [] }, ctx);
    for (let guard = 0; guard < 8 && run.state.stack.length > 0; guard += 1) run = finish(run, ctx);
    expect(run.state.seats[0].hand).toHaveLength(1);
    expect(run.state.cards[filler]?.zone).toBe("discard");
    expect(run.state.cards[spell]?.zone).not.toBe("encounterDiscard");
  });
});
