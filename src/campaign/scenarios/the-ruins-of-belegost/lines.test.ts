// Rules: rr.travel, rr.shadow-effects, rr.cancel, rr.attachment-cards, emce.loot (data/rules/entries.json); docs/scenarios/standalone-scenarios.md (The Ruins of Belegost).
// The lines a card-spec row cannot express (spec.test.ts holds the rest): the table-wide must-travel stat, a Response in the Shadow window, the printed cost of a card in a zone, a record that must not fire.
import { describe, expect, it } from "vitest";

import { legalIntents } from "../../../rules/engine/legal.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { playCost } from "../../../rules/player/attach.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { first, idOf, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const table = (layout: Layout) => tableFromLayout("the-ruins-of-belegost", layout);
const mustTravel = (layout: Layout): boolean => table(layout).state.modifiers.some((modifier) => modifier.stat === "mustTravel");

describe("the stages that make the players travel", () => {
  it("50604:B:2 the players must travel while stage 3A is the current stage, and not while stage 2A is", () => {
    expect(mustTravel({ stage: "50604", staging: ["50622"], phase: "Travel" })).toBe(true);
    expect(mustTravel({ stage: "50602", staging: ["50622"], phase: "Travel" })).toBe(false);
  });
  it("50605:B:2 the players must travel while stage 3C is the current stage", () => {
    expect(mustTravel({ stage: "50605", staging: ["50622"], phase: "Travel" })).toBe(true);
  });
  it("50606:B:1 the players must travel while stage 3E is the current stage", () => {
    expect(mustTravel({ stage: "50606", staging: ["50622"], phase: "Travel" })).toBe(true);
  });
});

describe("Sword of Belegost", () => {
  it("50609:A:3 gives no Attack to a card that is not a hero", () => {
    const made = table({ staging: ["f3"], attached: [{ code: "50609", to: "f3" }] });
    expect(modifiedStat(made.state, made.state.cards[idOf(made.state, "f3")]!, "attack", made.cards)).toBe(1);
  });

  it("50609:A:4 the Response is offered when a shadow effect is triggered, and exhausting the Sword cancels the effect", () => {
    const made = table({ phase: "Encounter", engaged: ["f3"], attached: [{ code: "50609", to: "dh1" }], deck: ["50627", "f0", "f0", "f0"], hand: ["event"] });
    let run = start(made.state);
    for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    expect(run.state.window?.kind).toBe("defense");
    run = send(run, { type: "Undefended", heroId: made.hero }, made.ctx);
    const trigger = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && run.state.cards[intent.cardId]?.code === "50609");
    expect(trigger).toBeDefined();
    run = send(run, { ...(trigger as Extract<PlayerIntent, { type: "Trigger" }>), payments: [] }, made.ctx);
    expect(run.state.cards[first(run.state, "50609")]?.exhausted).toBe(true);
    // The canceled Shadow card of Echoes in the Dark discards nothing: the event is still in the hand and the attack deals its own 1 damage.
    expect(run.state.seats[0]?.hand.some((id) => run.state.cards[id]?.code === "event")).toBe(true);
    while (run.state.pendingAttack != null || run.state.window?.kind === "defense") {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    expect(run.state.cards[made.hero]?.damage).toBe(1);
  });
});

describe("Flooded Hall", () => {
  it("50623:A:2 makes every ally cost 1 more to play while it is in the staging area, from the hand or from another zone", () => {
    const quiet = table({ hand: ["ally"], phase: "Planning" });
    const busy = table({ hand: ["ally"], staging: ["50623"], phase: "Planning" });
    const cost = (made: typeof quiet) => playCost(made.state, first(made.state, "ally"), 0, made.ctx) ?? 0;
    expect(cost(busy) - cost(quiet)).toBe(1);
    const discarded = (made: typeof quiet) => {
      const id = first(made.state, "ally");
      return playCost(updateCard(made.state, id, { zone: "discard" }), id, 0, made.ctx) ?? 0;
    };
    expect(discarded(busy) - discarded(quiet)).toBe(1);
  });
});
