// Rules: rr.attacks-outside-the-combat-phase, rr.damage, rr.doomed-x, dcce.heading, dcce.ship-enemies (data/rules/entries.json); ledger line 12131:A:1.
// Ramming Speed!: off-course, the engaged Ship enemy with the highest Attack makes an immediate attack, the total Threat in the staging area is raised until the end of the phase by the damage it dealt, and with no
// attack made the card gains doomed 2. The Pick filter highestAttack and the verb AttackWithPicked, each on the table of the scenario.
import { beforeAll, describe, expect, it } from "vitest";

import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { addStandIns } from "../../../../test/harness/scene-kit.ts";
import { CODES, havenTable, idOf, loadHavenWorld, resolveRecords, send, type HavenLayout, type HavenWorld } from "../../../../test/scenarios/a-storm-on-cobas-haven/scene.ts";
import type { ScenarioState } from "../../core/state.ts";
import { expireModifiers } from "../../core/state.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { stagingThreat } from "../../quest/quest.ts";
import type { Heading } from "./types.ts";

let world: HavenWorld;
beforeAll(async () => {
  world = await loadHavenWorld();
  addStandIns(world.cards, ["mild"]);
  for (const [code, card] of await loadPrinted([CODES.dreamChaser, CODES.dawnStar])) world.cards.set(code, card);
});

type Table = ReturnType<typeof havenTable>;
const make = (at: Heading | null, layout: HavenLayout = {}): Table => {
  const made = havenTable(world, { phase: "Quest", ...layout });
  return { ...made, state: syncConstants({ ...made.state, sea: { heading: at, headingCard: null, routes: made.state.sea?.routes ?? {} } }, made.ctx) };
};
// Ramming Speed! is revealed (the first option answers every choice, `pick` the tied enemies), and the attack it starts, if any, is defended by the Dream-chaser. The state when everything has resolved.
function reveal(made: Table, pick?: (state: ScenarioState) => string): ScenarioState {
  const run = resolveRecords(made.state, made.ctx, CODES.rammingSpeed, "whenRevealed", undefined, pick);
  let state = run.state;
  for (let guard = 0; guard < 10 && (state.window?.kind === "defense" || state.window?.kind === "choose"); guard += 1) {
    state = state.window?.kind === "defense"
      ? send({ state, steps: [] }, { type: "DeclareDefender", defenderId: idOf(state, CODES.dreamChaser) }, made.ctx).state
      : send({ state, steps: [] }, { type: "Choose", optionId: state.window.options[0] ?? "" }, made.ctx).state;
  }
  return state;
}
const threatOf = (made: Table, state: ScenarioState): number => stagingThreat(syncConstants(state, made.ctx), made.ctx.cards);
const damageOn = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.damage ?? 0;
const threatPaid = (state: ScenarioState): number => state.seats[0]?.threat ?? 0;
const RAMMING = { engaged: [CODES.lightCruiser, CODES.corsairWarship], play: [CODES.dreamChaser] } as const;

describe("12131:A:1 Ramming Speed!", () => {
  it("off-course, the engaged Ship enemy with the highest Attack attacks, and the Threat in the staging area rises by the damage it dealt", () => {
    const made = make("Storm", RAMMING);
    const before = threatOf(made, made.state);
    const state = reveal(made);
    // The Corsair Warship (Attack 8) attacked the Dream-chaser, not the Light Cruiser (Attack 6).
    const damage = damageOn(state, CODES.dreamChaser);
    expect(damage).toBeGreaterThan(0);
    expect(threatOf(made, state)).toBe(before + damage);
    // An attack was made, so the card has no doom.
    expect(threatPaid(state)).toBe(threatPaid(made.state));
  });

  it("the raise lasts until the end of the phase", () => {
    const made = make("Rain", RAMMING);
    const before = threatOf(made, made.state);
    const state = reveal(made);
    expect(threatOf(made, state)).toBeGreaterThan(before);
    expect(threatOf(made, expireModifiers(state, ["endOfPhase"]))).toBe(before);
  });

  it("asks the revealing player which enemy attacks when two are tied for the highest Attack", () => {
    const made = make("Cloud", { engaged: [CODES.lightCruiser, CODES.lightCruiser], play: [CODES.dreamChaser] });
    const asked: string[][] = [];
    const first = (state: ScenarioState): string => {
      if (state.window?.kind === "choose") asked.push([...state.window.options]);
      return state.window?.kind === "choose" ? (state.window.options[1] ?? "") : "";
    };
    const state = reveal(made, first);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toHaveLength(2);
    expect(damageOn(state, CODES.dreamChaser)).toBeGreaterThan(0);
  });

  it("on-course no attack is made: Ramming Speed! gains doomed 2 and the Threat does not rise", () => {
    const made = make("Sun", RAMMING);
    const state = reveal(made);
    expect(damageOn(state, CODES.dreamChaser)).toBe(0);
    expect(threatOf(made, state)).toBe(threatOf(made, made.state));
    expect(threatPaid(state)).toBe(threatPaid(made.state) + 2);
  });

  it("off-course with no Ship enemy engaged with the revealing player no attack is made, and it gains doomed 2", () => {
    const made = make("Storm", { engaged: ["mild"], staging: [CODES.lightCruiser], play: [CODES.dreamChaser] });
    const state = reveal(made);
    expect(damageOn(state, CODES.dreamChaser)).toBe(0);
    expect(threatPaid(state)).toBe(threatPaid(made.state) + 2);
  });

  it("only an enemy engaged with the revealing player is chosen: a Ship enemy engaged with another player does not attack", () => {
    const made = make("Storm", { seats: 2, engaged: [{ code: CODES.lightCruiser, seat: 1 }], play: [CODES.dreamChaser] });
    const state = reveal(made);
    expect(damageOn(state, CODES.dreamChaser)).toBe(0);
    expect(threatPaid(state)).toBe(threatPaid(made.state) + 2);
  });
});
