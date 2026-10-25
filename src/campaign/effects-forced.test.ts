import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import type { EngineStep } from "../rules/intents.ts";
import { reduce, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import { settle } from "../rules/machine.ts";
import { updateCard } from "../rules/state.ts";
import { fireForced } from "../rules/triggers.ts";
import {
  first, frames, FRODO, loadWorld, reveal, RIDER, SAM, send, table,
  type Layout, type World,
} from "../../scripts/past-scene.ts";

let world: World;

beforeAll(async () => {
  world = await loadWorld();
});

function make(layout: Layout = {}) {
  return table(world, layout);
}

describe("hideFailed triggered and forced events", () => {
  it("141022 triggered resolves before the 141039 forced, then play goes on", () => {
    // The spare f0 keeps the encounter deck from running out during the quest phase.
    const made = make({ deck: [RIDER, "f3", "f3", "f0", "f0"] });
    // Sam Gamgee's Response to an engagement (141002:response:1) is not what this test is about.
    const ctx = { ...made.ctx, effects: made.ctx.effects.filter((effect) => effect.id !== "141002:response:1") };
    const { state } = made;
    let run = reveal(state, ctx);
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
    run = send(run, { type: "CommitHide", cardIds: [] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    const rider = first(run.state, RIDER);
    const sam = first(run.state, SAM);
    expect(run.state.hideFailures).toEqual([{ seat: 0, round: 0, phase: "Quest" }]);
    expect(run.state.cards[rider]?.zone).toBe("engaged");
    expect(run.state.cards[rider]?.controller).toBe(0);
    expect(run.state.window).toEqual({ kind: "defense", enemyId: rider, seat: 0 });
    // 141022 resolves before 141039.
    const engageAt = run.steps.findIndex((step) => step.kind === "engage");
    const attackAt = run.steps.findIndex((step) => step.kind === "attack");
    expect(engageAt).toBeGreaterThanOrEqual(0);
    expect(attackAt).toBeGreaterThan(engageAt);
    expect(frames(run.steps)).toEqual(["push:reveal", "push:hide", "push:event", "push:forced", "pop:forced", "push:forced"]);
    // An attack outside the combat phase is dealt a shadow card (rr.attacks-outside-the-combat-phase), which is
    // discarded once the attack resolves (faq.enemy-attacks-outside-combat).
    const shadow = run.state.cards[rider]?.shadowId;
    expect(shadow).toBeTruthy();
    run = send(run, { type: "Undefended", heroId: sam }, ctx);
    expect(frames(run.steps).slice(6)).toEqual(["push:shadow", "pop:shadow", "pop:forced", "pop:event", "pop:hide", "pop:reveal"]);
    expect(run.state.cards[shadow ?? ""]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[rider]?.shadowId).toBeNull();
    expect(run.state.cards[sam]?.damage).toBe(5);
    expect(run.state.stack).toEqual([]);
    expect(run.state.lost).toBe(false);
    expect(run.state.resolvedAttacks).toEqual([]);
    expect(run.state.mode).toBe("travel");
  });

  it("141039 forced: the engagedWithActor condition fails for a Rider engaged with another seat", () => {
    const { state, ctx } = make({
      seats: 2,
      deck: ["141041", "f3", "f3", "f0"],
      engaged: [{ code: RIDER, seat: 1 }],
    });
    let run = reveal(state, ctx, 2);
    // 141041 has Hide 2. Seat 0 commits nobody and fails.
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
    run = send(run, { type: "CommitHide", cardIds: [] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    expect(run.state.hideFailures).toHaveLength(1);
    const rider = first(run.state, RIDER);
    expect(run.state.cards[rider]?.zone).toBe("engaged");
    expect(run.state.cards[rider]?.controller).toBe(1);
    expect(run.steps.some((step) => step.kind === "attack")).toBe(false);
  });

  it("141038 forced: ShuffleIntoDeck returns the trait match from the discard pile", () => {
    const { state, ctx } = make({ deck: ["141041", "f3", "f3", "f0"], discard: [RIDER], staging: ["141038"] });
    let run = reveal(state, ctx);
    const rider = first(run.state, RIDER);
    expect(run.state.cards[rider]?.zone).toBe("encounterDiscard");
    run = send(run, { type: "CommitHide", cardIds: [] }, ctx);
    const cursor = run.state.seedCursor;
    run = send(run, { type: "Pass" }, ctx);
    expect(run.state.cards[rider]?.zone).toBe("encounterDeck");
    // A deck is face down: the card shuffled in is turned over.
    expect(run.state.cards[rider]?.face).toBe("down");
    expect(run.state.seedCursor).toBeGreaterThan(cursor);
  });
});

describe("forced on attached cards", () => {
  it("141043 forced on hideFailed: Discard the host, then the source", () => {
    const { state, ctx } = make({ deck: ["141043", "f0"] });
    const opened = reveal(state, ctx);
    const sam = first(opened.state, SAM);
    const frodo = first(opened.state, FRODO);
    const attached = send(opened, { type: "Choose", optionId: sam }, ctx);
    const card = first(attached.state, "141043");
    const steps: EngineStep[] = [];
    const idle = { ...attached.state, window: null, mode: "stopped" as const };
    const failed = settle(fireForced(idle, { trigger: "hideFailed", seat: 0 }, ctx, steps), ctx, steps);
    expect(failed.cards[sam]?.zone).toBe("discard");
    expect(failed.cards[card]?.zone).toBe("encounterDiscard");
    expect(failed.cards[frodo]?.zone).toBe("heroes");
  });

  it("141074 forced on endOfPhase: ReturnToStaging the host when the Refresh phase ends", () => {
    const { state, ctx } = make({ deck: ["141074", "f0"], engaged: [{ code: RIDER, seat: 0 }] });
    const run = reveal(state, ctx);
    const rider = first(run.state, RIDER);
    const steed = first(run.state, "141074");
    // Only the end of the Refresh phase matters here.
    const refresh = { ...run.state, window: null, stack: [], mode: "stopped" as const, phase: "Refresh" as const, boundaryPhase: "Refresh" as const };
    const steps: EngineStep[] = [];
    const ended = settle({ ...refresh, phase: "End of round" }, ctx, steps);
    expect(ended.cards[rider]?.zone).toBe("staging");
    expect(ended.cards[rider]?.controller).toBeNull();
    expect(ended.cards[steed]).toMatchObject({ zone: "attached", host: rider });
    // A different phase ending does not fire it.
    const other = settle({ ...refresh, boundaryPhase: "Combat", phase: "Refresh" }, ctx, []);
    expect(other.cards[rider]?.zone).toBe("engaged");
  });
});

describe("141077 forced on endOfRound", () => {
  function gildorInPlay(resources: number) {
    const { state, ctx } = make({ deck: ["141077", "f0"], resources });
    let run = reveal(state, ctx);
    // With a resource and the Ring ready, Frodo may cancel the card just revealed (141001:response:1); he passes.
    if (run.state.window?.kind === "response") run = send(run, { type: "Pass" }, ctx);
    const gildor = first(run.state, "141077");
    return { run, ctx, gildor, frodo: first(run.state, FRODO), sam: first(run.state, SAM) };
  }

  function atEndOfRound(run: ScenarioState, ctx: ReduceContext): ScenarioState {
    const steps: EngineStep[] = [];
    const idle = { ...run, window: null, stack: [], mode: "stopped" as const, phase: "End of round" as const, boundaryPhase: "End of round" as const };
    return settle({ ...idle, phase: "Beginning of round" }, ctx, steps);
  }

  it("the cancel offer takes an exact payment from the right sphere; paying keeps the card, a pass runs Discard", () => {
    const { run, ctx, gildor, frodo, sam } = gildorInPlay(1);
    const offered = atEndOfRound(run.state, ctx);
    expect(offered.window).toEqual({ kind: "cancelOffer", seat: 0 });
    const wrong = reduce(
      updateCard(offered, sam, { resources: 2 }),
      { type: "Trigger", cardId: gildor, effectId: "141077:forced:1", payments: [{ heroId: sam, amount: 1 }] },
      ctx,
    );
    expect(wrong.ok).toBe(false);
    const paid = expectOk(
      reduce(offered, { type: "Trigger", cardId: gildor, effectId: "141077:forced:1", payments: [{ heroId: frodo, amount: 1 }] }, ctx),
    );
    expect(paid.state.cards[gildor]?.zone).toBe("play");
    expect(paid.state.cards[frodo]?.resources).toBe(0);
    const passed = expectOk(reduce(offered, { type: "Pass" }, ctx));
    // Gildor came from the encounter deck, so he goes to the encounter discard pile (rr.discard-pile-and-victory-display).
    expect(passed.state.cards[gildor]?.zone).toBe("encounterDiscard");
    expect(passed.state.seats[0]?.discard).not.toContain(gildor);
  });

  it("no cancel offer is made when nobody can pay", () => {
    const { run, ctx, gildor } = gildorInPlay(0);
    const ended = atEndOfRound(run.state, ctx);
    expect(ended.window).toBeNull();
    expect(ended.cards[gildor]?.zone).toBe("encounterDiscard");
  });
});
