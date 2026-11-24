// Rules: rr.active-location, rr.step-3-4, faq.two-active-locations (data/rules/entries.json); ledger lines 06103:A:1, 06103:A:2.
// Ruined Tower is the second active location of Assault on Osgiliath: the first player divides the progress of a quest between it and the other active location, as he does with Fisherman's Dock (families/smaug/split.ts). Built on a real travel and a real quest resolution.
import { describe, expect, it } from "vitest";

import { idOf, send, type LayoutTable, type Run } from "../../../../test/harness/scene-kit.ts";
import { CODES, cardOf, drive, opened, table } from "../../../../test/scenarios/assault-on-osgiliath/table.ts";
import type { PlayerIntent } from "../../engine/reduce.ts";

/** The players travel to Ruined Tower (one active location: Ancient Harbor, which needs 5, so the Tower, which needs 2, is the second), and both heroes quest for 4 (Willpower 2 each) until the split is asked. */
function toTheSplit(towerProgress: number): { made: LayoutTable; run: Run } {
  const made = table({ phase: "Travel", active: { code: CODES.harbor, progress: 0 }, staging: [{ code: CODES.tower, progress: towerProgress }] });
  let run = send(opened(made), { type: "Travel", locationId: idOf(made.state, CODES.tower) } as PlayerIntent, made.ctx);
  run = drive(made, run, (state) => state.phase === "Quest" && state.mode === "questCommit");
  run = send(run, { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
  run = drive(made, run, (state) => state.window?.kind === "choose" && state.window.options.some((option) => option.startsWith("split:")));
  return { made, run };
}

describe("06103:A:1 Ruined Tower: the progress of a quest is divided between the two active locations", () => {
  it("asks the first player how much of the 4 progress goes on the first active location, the rest going on Ruined Tower", () => {
    const { made, run } = toTheSplit(0);
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 0, options: ["split:2", "split:3", "split:4"] });
    // Nothing is placed before he answers.
    expect(cardOf(run.state, CODES.harbor)?.progress).toBe(0);
    expect(cardOf(run.state, CODES.tower)?.progress).toBe(0);
    const done = drive(made, send(run, { type: "Choose", optionId: "split:3" }, made.ctx), (state) => state.phase !== "Quest");
    expect(cardOf(done.state, CODES.harbor)?.progress).toBe(3);
    expect(cardOf(done.state, CODES.tower)?.progress).toBe(1);
  });

  it("explores Ruined Tower when the share it gets fills its 2 quest points, and leaves the other location active", () => {
    const { made, run } = toTheSplit(0);
    const done = drive(made, send(run, { type: "Choose", optionId: "split:2" }, made.ctx), (state) => state.phase !== "Quest");
    expect(cardOf(done.state, CODES.tower)).toMatchObject({ zone: "play", controller: 0 });
    expect(cardOf(done.state, CODES.harbor)).toMatchObject({ zone: "activeLocation", progress: 2 });
  });

  it("takes what the Tower has room for into account: with 1 progress on it, only 3 or 4 may go on the first location", () => {
    const { run } = toTheSplit(1);
    expect(run.state.window).toMatchObject({ kind: "choose", options: ["split:3", "split:4"] });
  });
});
