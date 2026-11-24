// Rules: rr.active-location, rr.step-3-4, rr.travel, rr.explored, faq.two-active-locations, ats.losing-control-of-locations (data/rules/entries.json); ledger lines 06103:A:1, 06103:A:2, 06106:A:2.
// Ruined Tower is the second active location of Assault on Osgiliath: the players travel to it with one active location at the cost of exhausting a character, the first player divides the progress of a quest between it and the other active location (as for Fisherman's Dock,
// families/smaug/split.ts), and it returns to the staging area when its controller loses control of another location (Counter-attack makes him). Built on a real travel, a real quest resolution and a real reveal.
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { finish, idOf, legalIntents, revealFromTop, send, type LayoutTable, type Run } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { CODES, cardOf, controlled, drive, opened, table, where } from "../../../../test/scenarios/assault-on-osgiliath/table.ts";

/** The players travel to Ruined Tower (one active location, `first`), then both heroes quest for 4 (Willpower 2 each) until the split is asked or the quest phase is over. */
function toTheQuest(first: { code: string; progress: number }, towerProgress: number, effects: readonly Effect[]): { made: LayoutTable; run: Run } {
  const made = table({ phase: "Travel", active: first, staging: [{ code: CODES.tower, progress: towerProgress }] }, effects);
  let run = send(opened(made), { type: "Travel", locationId: idOf(made.state, CODES.tower) } as PlayerIntent, made.ctx);
  // The cost is a character that is exhausted: the player is asked which one.
  expect(run.state.window?.kind).toBe("choose");
  run = drive(made, run, (state) => state.phase === "Quest" && state.mode === "questCommit");
  run = send(run, { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
  return { made, run };
}
const splitAsked = (state: ScenarioState): boolean => state.window?.kind === "choose" && state.window.options.some((option) => option.startsWith("split:"));

lineSpec("06103:A:1", "is traveled to with one active location, at the cost of exhausting a character, and becomes the second active location", (effects) => {
  const made = table({ phase: "Travel", active: { code: CODES.westQuarter, progress: 0 }, staging: [CODES.tower] }, effects);
  const tower = idOf(made.state, CODES.tower);
  expect(legalIntents(made.state, made.ctx).map((intent) => intent.type)).toContain("Travel");
  let run = send(opened(made), { type: "Travel", locationId: tower } as PlayerIntent, made.ctx);
  // The cost: the player chooses which of his ready characters to exhaust, before the Tower becomes active.
  expect(run.state.window).toMatchObject({ kind: "choose", options: [made.hero, made.hero2] });
  expect(run.state.secondActiveLocation).toBeNull();
  run = send(run, { type: "Choose", optionId: made.hero }, made.ctx);
  expect(run.state.activeLocation).toBe(idOf(made.state, CODES.westQuarter));
  expect(run.state.secondActiveLocation).toBe(tower);
});

lineSpec("06103:A:1", "has the progress of a quest divided between it and the other active location, the first player choosing the share of the first", (effects) => {
  const { made, run } = toTheQuest({ code: CODES.harbor, progress: 0 }, 0, effects);
  const asked = drive(made, run, splitAsked);
  expect(asked.state.window).toMatchObject({ kind: "choose", seat: 0, options: ["split:2", "split:3", "split:4"] });
  // Nothing is placed before he answers.
  expect(cardOf(asked.state, CODES.harbor)?.progress).toBe(0);
  expect(cardOf(asked.state, CODES.tower)?.progress).toBe(0);
  const done = drive(made, send(asked, { type: "Choose", optionId: "split:3" }, made.ctx), (state) => state.phase !== "Quest");
  expect(cardOf(done.state, CODES.harbor)?.progress).toBe(3);
  expect(cardOf(done.state, CODES.tower)?.progress).toBe(1);
});

lineSpec("06103:A:1", "is explored by the share that fills its 2 quest points, and the first player takes it; with 1 progress on it, only 3 or 4 may go on the other location", (effects) => {
  const { made, run } = toTheQuest({ code: CODES.harbor, progress: 0 }, 0, effects);
  const done = drive(made, send(drive(made, run, splitAsked), { type: "Choose", optionId: "split:2" }, made.ctx), (state) => state.phase !== "Quest");
  expect(cardOf(done.state, CODES.tower)).toMatchObject({ zone: "play", controller: 0 });
  expect(cardOf(done.state, CODES.harbor)).toMatchObject({ zone: "activeLocation", progress: 2 });
  const partly = toTheQuest({ code: CODES.harbor, progress: 0 }, 1, effects);
  expect(drive(partly.made, partly.run, splitAsked).state.window).toMatchObject({ kind: "choose", options: ["split:3", "split:4"] });
});

lineSpec("06103:A:1", "takes both locations when the progress fills both", (effects) => {
  const { made, run } = toTheQuest({ code: CODES.westQuarter, progress: 2 }, 1, effects);
  const done = drive(made, run, (state) => state.phase !== "Quest");
  expect(controlled(done.state).sort()).toEqual([CODES.westQuarter, CODES.tower].sort());
  expect(done.state.activeLocation).toBeNull();
  expect(done.state.secondActiveLocation).toBeNull();
});

/** Counter-attack is revealed: the first player returns the location the pick names, or takes the option the pick names. */
function counterAttack(made: LayoutTable, state: ScenarioState, pick: (state: ScenarioState) => string): ScenarioState {
  const revealed = revealFromTop({ ...state, window: null }, made.ctx, CODES.counter, []);
  return finish({ state: revealed.state, steps: [] }, made.ctx, pick).state;
}
const returning = (location: string) => (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options.includes("return") ? "return" : idOf(state, location)) : "");
const first = (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "");

lineSpec("06103:A:2", "returns to the staging area, with no progress, after its controller loses control of another location", (effects) => {
  const { made, run } = toTheQuest({ code: CODES.westQuarter, progress: 2 }, 1, effects);
  const quested = drive(made, run, (state) => state.phase !== "Quest");
  const done = counterAttack(made, quested.state, returning(CODES.westQuarter));
  expect(where(done, CODES.westQuarter)).toBe("staging");
  expect(where(done, CODES.tower)).toBe("staging");
  expect(cardOf(done, CODES.tower)).toMatchObject({ progress: 0, controller: null });
  expect(controlled(done)).toEqual([]);
});

lineSpec("06106:A:2", "lets the first player return the location he controls with the highest Threat, or raise his threat by the total Threat of the locations he controls", (effects) => {
  const { made, run } = toTheQuest({ code: CODES.westQuarter, progress: 2 }, 1, effects);
  const quested = drive(made, run, (state) => state.phase !== "Quest");
  const threat = quested.state.seats[0]?.threat ?? 0;
  const returned = counterAttack(made, quested.state, returning(CODES.westQuarter));
  expect(controlled(returned)).toEqual([]);
  expect(returned.seats[0]?.threat).toBe(threat);
  // West Quarter (Threat 2) and Ruined Tower (Threat 2) are controlled: the raise is their total.
  const raised = counterAttack(made, quested.state, (state) => (state.window?.kind === "choose" ? "raise" : ""));
  expect(raised.seats[0]?.threat).toBe(threat + 4);
  expect(controlled(raised).sort()).toEqual([CODES.westQuarter, CODES.tower].sort());
});

lineSpec("06106:A:2", "returns the location the first player controls, not one that lies in the staging area, and Ruined Tower's own loss returns no other", (effects) => {
  // Ancient Harbor is explored and controlled; West Quarter (Threat 2, higher than the Harbor's 1) lies in the staging area.
  const made = table({ phase: "Quest", active: { code: CODES.harbor, progress: 4 }, committed: ["dh1", "dh2"], staging: [CODES.westQuarter] }, effects);
  const quested = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.phase === "Travel");
  expect(controlled(quested.state)).toEqual([CODES.harbor]);
  const done = counterAttack(made, quested.state, returning(CODES.harbor));
  expect(where(done, CODES.harbor)).toBe("staging");
  expect(controlled(done)).toEqual([]);
  expect(where(done, CODES.westQuarter)).toBe("staging");
});

lineSpec("06106:A:2", "returns Ruined Tower, the highest Threat location, and leaves Ancient Harbor", (effects) => {
  const { made, run } = toTheQuest({ code: CODES.harbor, progress: 4 }, 1, effects);
  const quested = drive(made, run, (state) => state.phase !== "Quest");
  expect(controlled(quested.state).sort()).toEqual([CODES.harbor, CODES.tower].sort());
  // Ruined Tower (Threat 2) is the highest: it is the only one offered, and Ancient Harbor (Threat 1) stays.
  const done = counterAttack(made, quested.state, first);
  expect(where(done, CODES.tower)).toBe("staging");
  expect(where(done, CODES.harbor)).toBe("play");
  expect(controlled(done)).toEqual([CODES.harbor]);
});
