// Rules: rr.player-elimination, mec108.side-quests-in-play, rr.step-6-4-3 (data/rules/entries.json); ledger line 02042:A:1 (Conflict at the Carrock).
import { describe, expect, it } from "vitest";

import { clearEliminated, eliminateEmpties } from "./eliminate.ts";
import { hero, table } from "../families/defense/table.ts";
import { definePrinted } from "./printed.ts";
import { updateCard, withSeat } from "./state.ts";

// A seat eliminated while an attack on it is begun: the window an event frame holds aside for it is not given back (a Forced effect that discards the last hero runs after a Wolf Rider's shadow attack has begun).
describe("a seat eliminated in the middle of an attack on it", () => {
  it("02042:A:1 drops the defense window an event frame holds for the seat, with the attack", () => {
    const base = table({ seatCount: 2, cards: [hero("a"), hero("b")], effects: [], heroes: [{ code: "a", seat: 0 }, { code: "b", seat: 1 }] });
    const heroId = base.state.seats[1]?.heroes[0] ?? "";
    const [first, second] = base.state.seats;
    const gone = { ...base.state, seats: [first, { ...second, heroes: [] }] as typeof base.state.seats };
    const waiting = {
      ...gone,
      pendingAttack: { enemyId: "e1", seat: 1 },
      stack: [{ id: "f1", step: 0, frame: "event" as const, cardId: null, seat: 1, peril: false, data: { kind: "resume" as const, window: { kind: "defense" as const, enemyId: "e1", seat: 1 }, seat: 1, passed: [] } }],
    };
    const out = clearEliminated(eliminateEmpties(waiting, []), base.ctx.cards);
    expect(heroId).not.toBe("");
    expect(out.seats[1]?.eliminated).toBe(true);
    expect(out.pendingAttack).toBeNull();
    expect(out.stack).toEqual([]);
  });
});

// A player side quest lies in the staging area while in play (mec108.side-quests-in-play); it goes with the seat that controls it, to its owner's discard pile, not to the encounter discard pile.
describe("an eliminated seat's side quest in the staging area", () => {
  it("goes to its owner's discard pile and an encounter card at the staging area stays", () => {
    const quest = definePrinted({ code: "psq", name: "Player Quest", type: "player-side-quest", questPoints: 4 });
    const grunt = definePrinted({ code: "grunt", name: "Grunt", type: "enemy", attack: 1, defense: 1, health: 2, engagementCost: 30, threat: 1 });
    const base = table({ seatCount: 2, cards: [hero("a"), hero("b"), quest, grunt], effects: [], heroes: [{ code: "a", seat: 0 }, { code: "b", seat: 1 }], staging: [{ code: "psq" }, { code: "grunt" }] });
    const questId = base.ids.psq ?? "";
    const staged = updateCard(base.state, questId, { controller: 1, owner: 1 });
    const out = clearEliminated(withSeat(staged, 1, { ...staged.seats[1], heroes: [], eliminated: true }), base.ctx.cards);
    expect(out.cards[questId]?.zone).toBe("discard");
    expect(out.seats[1]?.discard).toContain(questId);
    expect(out.staging).not.toContain(questId);
    expect(out.cards[base.ids.grunt ?? ""]?.zone).toBe("staging");
  });
});
