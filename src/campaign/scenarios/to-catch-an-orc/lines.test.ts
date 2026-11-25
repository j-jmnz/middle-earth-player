// Rules: rr.then, rr.surge, rr.running-out-of-cards, rr.quest-advancement (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { quest, respond, reveal } from "../../../../test/harness/card-spec.ts";
import { playedLayout } from "../../../../test/harness/card-spec-play.ts";
import type { Layout } from "../../../../test/harness/layout.ts";
import { idOf } from "../../../../test/harness/scene-kit.ts";

// What a spec row cannot show (a row must fail without the line's records): the cases where the records change nothing the table shows.
const SCENARIO = "to-catch-an-orc";
const STAGE_2 = "07063";
const PARTY = "07041";

describe("To Catch an Orc: the lines whose records leave the table as the engine has it", () => {
  const taken: Layout = { stage: STAGE_2, timeCounters: 1, active: "07054", deck: ["f0"] };

  it("07063:B:3 when the active location took all the progress nothing is cancelled and the Response offers no time counter (rr.then)", () => {
    const done = playedLayout(SCENARIO, taken, [quest("success"), respond(STAGE_2)]);
    expect(done.run.state.cards[idOf(done.run.state, STAGE_2)]?.resources).toBe(1);
    expect(done.run.state.cards[idOf(done.run.state, "07054")]?.progress).toBe(4);
  });

  it("07063:B:3 when some progress reaches the stage the Response is offered and places the counter after the cancel", () => {
    const done = playedLayout(SCENARIO, { ...taken, active: undefined }, [quest("success"), respond(STAGE_2)]);
    const stage = done.run.state.cards[idOf(done.run.state, STAGE_2)];
    expect(stage?.resources).toBe(2);
    expect(stage?.progress ?? 0).toBe(0);
  });

  it("07041:A:1 Orc Hunting Party that surges with nothing else to reveal ends the chain: the reset shuffles it back once and the round engine does not loop", () => {
    const done = playedLayout(SCENARIO, { engaged: ["07039"], deck: [] }, reveal(PARTY));
    expect(done.run.state.lost).toBeFalsy();
    expect(done.run.state.window).toBeNull();
    expect(done.run.state.cards[idOf(done.run.state, PARTY)]?.zone).toBe("encounterDeck");
  });
});
