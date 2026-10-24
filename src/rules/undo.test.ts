import { describe, expect, it } from "vitest";

import { cardMap, codes, expectOk, fixtureDefinition, hero } from "./fixture.ts";
import { definePrinted } from "./printed.ts";
import { reduce, replay, startScenario } from "./reduce.ts";

describe("undo", () => {
  it("replays a phase-boundary snapshot to the same state and seed cursor", () => {
    const deck = codes("d", 12);
    const cards = cardMap([
      hero("aragorn", "leadership", 8, 1),
      definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 8 }),
      ...deck.map((code) => definePrinted({ code, name: code, type: "event", cost: 0, sphere: "neutral" })),
    ]);
    const ctx = { effects: [], cards };
    const start = startScenario(
      {
        seatCount: 1,
        seed: 42,
        threatModifier: 0,
        definition: fixtureDefinition(["stage"]),
        seats: [{ heroes: ["aragorn"], deck }],
        encounterDeck: [],
        questDeck: ["stage"],
      },
      ctx,
    );
    const boundary = start.undo.snapshot;
    const instances = start.undo.cards;
    if (!boundary || !instances) throw new Error("missing phase snapshot");
    const heroId = Object.keys(start.cards).find((id) => start.cards[id]?.code === "aragorn") ?? "";
    expect(boundary.cards).toEqual({});
    expect(boundary.cards[heroId]).toBeUndefined();
    expect(instances[heroId]?.code).toBe("aragorn");
    const played = expectOk(reduce(start, { type: "Mulligan" }, ctx));
    const again = replay(boundary, [{ type: "Mulligan" }], ctx, instances);
    expect(again.seedCursor).toBe(played.state.seedCursor);
    expect(again.phase).toBe(played.state.phase);
    expect(again.seats[0].deck).toEqual(played.state.seats[0].deck);
    expect(again.seats[0].hand).toEqual(played.state.seats[0].hand);
    expect(again.cards[Object.keys(again.cards).find((id) => again.cards[id]?.code === "aragorn") ?? ""]?.resources).toBe(
      played.state.cards[Object.keys(played.state.cards).find((id) => played.state.cards[id]?.code === "aragorn") ?? ""]?.resources,
    );
  });
});
