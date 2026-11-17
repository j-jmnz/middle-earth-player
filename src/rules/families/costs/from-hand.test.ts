// Rules: rr.resource-match, rr.resources, rr.ally-cards, rr.event-cards (data/rules/entries.json); ledger lines 02018:A:1, 02019:A:1.
// The costs family's IncreaseCost with `fromHand`: a card played from its owner's hand costs more, one played from another zone does not, on a table of The Hunt for Gollum (The East Bank and The West Bank).
import { describe, expect, it } from "vitest";

import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { playCost } from "../../player/attach.ts";

import { first, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const table = (layout: Layout) => tableFromLayout("the-hunt-for-gollum", layout);

describe("02018:A:1 The East Bank", () => {
  it("02018:A:1 makes an ally card cost 1 more to play from the hand while it is the active location, and an event card nothing", () => {
    const quiet = table({ hand: ["ally", "event"], phase: "Planning" });
    const busy = table({ hand: ["ally", "event"], active: "02018", phase: "Planning" });
    const ally = (made: typeof quiet) => playCost(made.state, first(made.state, "ally"), 0, made.ctx);
    const event = (made: typeof quiet) => playCost(made.state, first(made.state, "event"), 0, made.ctx);
    expect((ally(busy) ?? 0) - (ally(quiet) ?? 0)).toBe(1);
    expect(event(busy)).toBe(event(quiet));
  });

  it("02018:A:1 does not charge it while The East Bank is in the staging area", () => {
    const quiet = table({ hand: ["ally"], phase: "Planning" });
    const staged = table({ hand: ["ally"], staging: ["02018"], phase: "Planning" });
    expect(playCost(staged.state, first(staged.state, "ally"), 0, staged.ctx)).toBe(playCost(quiet.state, first(quiet.state, "ally"), 0, quiet.ctx));
  });

  it("02018:A:1 does not charge a card that is played from the discard pile", () => {
    const busy = table({ hand: ["ally"], active: "02018", phase: "Planning" });
    const id = first(busy.state, "ally");
    const inHand = playCost(busy.state, id, 0, busy.ctx);
    const inDiscard = playCost(updateCard(moveCard(busy.state, id, { zone: "discard", seat: 0 }), id, {}), id, 0, busy.ctx);
    expect((inHand ?? 0) - (inDiscard ?? 0)).toBe(1);
  });
});

describe("02019:A:1 The West Bank", () => {
  it("02019:A:1 makes an attachment card and an event card cost 1 more to play from the hand while it is the active location, and an ally card nothing", () => {
    const quiet = table({ hand: ["ally", "event", "attachment"], phase: "Planning" });
    const busy = table({ hand: ["ally", "event", "attachment"], active: "02019", phase: "Planning" });
    const cost = (made: typeof quiet, code: string) => playCost(made.state, first(made.state, code), 0, made.ctx) ?? 0;
    expect(cost(busy, "event") - cost(quiet, "event")).toBe(1);
    expect(cost(busy, "attachment") - cost(quiet, "attachment")).toBe(1);
    expect(cost(busy, "ally")).toBe(cost(quiet, "ally"));
  });
});
