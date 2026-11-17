// Rules: rr.forced, rr.engaged, rr.staging, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 02011:B:1, 02012:B:1, 900402:A:1, 900403:A:1.
// The encounter family's `lookedAt` trigger (a card of the encounter deck with a Forced effect for being looked at acts at once, out of the cards the effect goes on with) and the flag `enteredThisRound`, on a table of The Hunt for Gollum.
import { describe, expect, it } from "vitest";

import { settle } from "../../engine/machine.ts";
import { fireForced } from "../../windows/triggers.ts";

import { first, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const HAWK = "900402";
const table = (layout: Layout) => tableFromLayout("the-hunt-for-gollum", layout);

describe("900402:A:1 Ravenous Hawk", () => {
  it("900402:A:1 comes into play engaged with the player looking when stage 1B looks at the top 3 cards, and the stage still reveals 1 of the other 2 and discards the other", () => {
    const made = table({ stage: "02011", deck: ["f0", HAWK, "f3", "place"], phase: "Quest" });
    const run = resolveRecords(made.state, made.ctx, "02011", "forced", made.state.questStage ?? undefined);
    const hawk = first(run.state, HAWK);
    expect(run.state.cards[hawk]).toMatchObject({ zone: "engaged", controller: 0 });
    expect(run.state.seats[0]?.engaged).toContain(hawk);
    // Of the 2 other cards looked at, 1 was revealed (f0, the first option) and 1 discarded.
    const zones = ["f0", "f3"].map((code) => run.state.cards[first(run.state, code)]?.zone).sort();
    expect(zones).toEqual(["encounterDiscard", "staging"]);
    // The card below the cards looked at is untouched.
    expect(run.state.cards[first(run.state, "place")]?.zone).toBe("encounterDeck");
  });

  it("900402:A:1 acts for stage 2B's look at the top 2 as well, and with the Hawk alone the stage reveals nothing", () => {
    const made = table({ stage: "02012", deck: [HAWK, "place"], phase: "Quest" });
    const run = resolveRecords(made.state, made.ctx, "02012", "forced", made.state.questStage ?? undefined);
    expect(run.state.cards[first(run.state, HAWK)]?.zone).toBe("engaged");
    // 2 cards were looked at: the Hawk and `place`; `place` is the one left to reveal.
    expect(run.state.cards[first(run.state, "place")]?.zone).toBe("staging");
  });

  it("900402:A:1 does not act out of a player's own deck being looked at, or while it is not among the cards looked at", () => {
    const made = table({ stage: "02012", deck: ["f0", "f3", HAWK], phase: "Quest" });
    const run = resolveRecords(made.state, made.ctx, "02012", "forced", made.state.questStage ?? undefined);
    expect(run.state.cards[first(run.state, HAWK)]?.zone).toBe("encounterDeck");
  });
});

describe("900403:A:1 Hunting Warg", () => {
  const warg = "900403";

  it("900403:A:1 fetches Hunters from Mordor at the beginning of the refresh phase when it entered play this round", () => {
    const made = table({ deck: ["f0"], staging: [], discard: ["02021"], phase: "Refresh" });
    // The Warg enters play (revealed): its Forced effect notes it for the round.
    const entered = resolveRecords(made.state, made.ctx, warg, "forced", undefined);
    expect(entered.state.cards[entered.id]?.zone).toBe("staging");
    const noted = fireForced({ ...entered.state, window: null }, { trigger: "encounterEnteredPlay", seat: 0, subject: entered.id }, made.ctx, []);
    const ready = settle({ ...noted, mode: "stopped" }, made.ctx, []);
    const refreshed = fireForced(ready, { trigger: "beginningOfPhase", seat: null, phase: "Refresh" }, made.ctx, []);
    const run = settle({ ...refreshed, mode: "stopped" }, made.ctx, []);
    expect(run.cards[first(run, "02021")]?.zone).toBe("staging");
  });

  it("900403:A:1 does nothing when it did not enter play this round", () => {
    const made = table({ deck: ["f0"], staging: [warg], discard: ["02021"], phase: "Refresh" });
    const refreshed = fireForced(made.state, { trigger: "beginningOfPhase", seat: null, phase: "Refresh" }, made.ctx, []);
    const run = settle({ ...refreshed, mode: "stopped" }, made.ctx, []);
    expect(run.cards[first(run, "02021")]?.zone).toBe("encounterDiscard");
  });
});
