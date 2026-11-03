import { describe, expect, it } from "vitest";

import type { Condition, Effect } from "../../../catalog/boundary.ts";
import { holds } from "../../interpret/conditions.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { definePrinted } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { headingIs, headingOf, shiftHeading } from "./heading.ts";
import { hero, seaTable, send, ship, type Table } from "./table.ts";

// Rules: dcce.heading (data/rules/entries.json). The Heading card has four settings: Sun is the only on-course one, Cloud and Rain are off-course,
// Storm is the worst. A shift off-course moves one step toward Storm and a shift on-course one step toward Sun; neither goes past its end.

const shift = (id: string, direction: "onCourse" | "offCourse"): Effect => ({ id: `${id}:action:1`, cardCode: id, lines: [`${id}:A:1`], timing: "action", instructions: [{ verb: "ShiftHeading", direction }] });

function table(effects: readonly Effect[] = []): Table {
  const built = seaTable({
    cards: [hero("aragorn"), ship("dc", "Dream-chaser"), definePrinted({ code: "wind", name: "wind", type: "event", sphere: "tactics", cost: 0 }), definePrinted({ code: "calm", name: "calm", type: "event", sphere: "tactics", cost: 0 })],
    effects,
    heroes: [{ code: "aragorn" }],
    allies: [{ code: "dc" }],
    hand: [{ code: "wind" }, { code: "calm" }],
  });
  return { ...built, state: { ...built.state, mode: "combatActions", phase: "Combat", boundaryPhase: "Combat", window: { kind: "pass" }, passed: [], sea: { heading: "Sun", headingCard: null, routes: {} } } };
}

const at = (state: ScenarioState, heading: "Sun" | "Cloud" | "Rain" | "Storm"): ScenarioState => ({ ...state, sea: { heading, headingCard: null, routes: state.sea?.routes ?? {} } });
const is = (state: ScenarioState, test: Extract<Condition, { kind: "heading" }>["is"]): boolean => headingIs(state, test);

describe("the heading (dcce.heading)", () => {
  it("shifts one step off-course at a time, down to Storm, and not past it", () => {
    const { state } = table();
    const steps: (string | null)[] = [];
    let current = state;
    for (let step = 0; step < 5; step += 1) {
      current = shiftHeading(current, "offCourse");
      steps.push(headingOf(current));
    }
    expect(steps).toEqual(["Cloud", "Rain", "Storm", "Storm", "Storm"]);
  });

  it("shifts one step on-course, not all the way, and not past Sun", () => {
    const { state } = table();
    const steps = [shiftHeading(at(state, "Storm"), "onCourse"), shiftHeading(at(state, "Rain"), "onCourse"), shiftHeading(at(state, "Cloud"), "onCourse"), shiftHeading(at(state, "Sun"), "onCourse")].map(headingOf);
    expect(steps).toEqual(["Rain", "Cloud", "Sun", "Sun"]);
  });

  it("reads on-course as Sun alone, off-course as the other three, and the worst setting as Storm", () => {
    const { state } = table();
    const rows = (["Sun", "Cloud", "Rain", "Storm"] as const).map((heading) => [heading, is(at(state, heading), "onCourse"), is(at(state, heading), "offCourse"), is(at(state, heading), "worst")]);
    expect(rows).toEqual([
      ["Sun", true, false, false],
      ["Cloud", false, true, false],
      ["Rain", false, true, false],
      ["Storm", false, true, true],
    ]);
  });

  it("is on neither side while the game has no Heading card", () => {
    const { state } = table();
    const none = { ...state, sea: undefined };
    expect(["onCourse", "offCourse", "worst"].map((test) => headingIs(none, test as "onCourse"))).toEqual([false, false, false]);
    expect(shiftHeading(none, "offCourse")).toBe(none);
  });

  it("answers the heading condition of an effect record", () => {
    const { state, ctx } = table();
    const scope = { actor: 0, sourceId: null, returned: 0 };
    expect(holds(state, { kind: "heading", is: "onCourse" }, scope, ctx)).toBe(true);
    expect(holds(at(state, "Rain"), { kind: "heading", is: "onCourse" }, scope, ctx)).toBe(false);
    expect(holds(at(state, "Rain"), { kind: "heading", is: "offCourse" }, scope, ctx)).toBe(true);
    expect(holds(at(state, "Cloud"), { kind: "heading", is: "worst" }, scope, ctx)).toBe(false);
  });

  it("shifts through the ShiftHeading verb, in either direction", () => {
    const { state, ids, ctx } = table([shift("wind", "offCourse"), shift("calm", "onCourse")]);
    const off = send(state, { type: "PlayCard", cardId: ids.wind!, payments: [] }, ctx);
    expect(headingOf(off)).toBe("Cloud");
    const back = send({ ...off, window: { kind: "pass" }, passed: [] }, { type: "PlayCard", cardId: ids.calm!, payments: [] }, ctx);
    expect(headingOf(back)).toBe("Sun");
  });

  it("changes what a constant effect reads: +2 Willpower while on-course (11016:B:2, 110102:A:2)", () => {
    const boost: Effect = { id: "dc:constant:1", cardCode: "dc", lines: ["dc:A:1"], timing: "constant", condition: { kind: "heading", is: "onCourse" }, instructions: [{ verb: "ModifyStat", stat: "willpower", amount: 2, until: "whileSourceInPlay" }] };
    const { state, ids, ctx } = table([boost, shift("wind", "offCourse")]);
    // The constants are rebuilt after each intent (constants.ts): on-course the ship has the bonus, one step off-course it has not.
    const sunny = syncConstants(state, ctx);
    expect(modifiedStat(sunny, sunny.cards[ids.dc!]!, "willpower", ctx.cards)).toBe(5);
    const shifted = send(state, { type: "PlayCard", cardId: ids.wind!, payments: [] }, ctx);
    expect(headingOf(shifted)).toBe("Cloud");
    expect(modifiedStat(shifted, shifted.cards[ids.dc!]!, "willpower", ctx.cards)).toBe(3);
  });
});
