import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { recordInstructions } from "../catalog/scenario-data.ts";
import { holds } from "../rules/conditions.ts";
import { legalIntents, reduce } from "../rules/reduce.ts";
import { printedOf, type PrintedCard } from "../rules/printed.ts";
import { openResolution, resolutionResult } from "../rules/resolution.ts";
import type { ScenarioState } from "../rules/state.ts";
import { attachTo, moveCard, spawn } from "../rules/zones.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";
import { first, loadWorld, send, start, table, type World } from "../../scripts/past-scene.ts";


// The resolution verbs the cards use, run against the real records of the campaign cards (142019, 142039, 142060,
// 141044, 141056) on a small table. Each test opens the Resolution of one card at the moment the scenario is won.
const FRODO = "141001";
const SAM = "141002";
const MERRY = "141003";
const EXTRA = ["141018", "141019", "141020", "141021", "141080", "141081", "141082", "142044", "142083", "142084", "142085", "142086", "142087", "142088", "142089", "142090", "141004"];

let world: World;
let cards: Map<string, PrintedCard>;

beforeAll(async () => {
  world = await loadWorld();
  cards = new Map([...world.cards, ...(await loadPrinted(EXTRA))]);
  world = { ...world, cards };
});

function won(code: string, seats: 1 | 2 = 1, place: (state: ScenarioState) => ScenarioState = (state) => state) {
  const { state, ctx } = table(world, { seats });
  const resolving: ScenarioState = {
    ...place(state),
    phase: "Quest",
    window: null,
    stageCleared: true,
    resolution: recordInstructions(EFFECTS, code, "resolution"),
  };
  return { state: openResolution(resolving, ctx), ctx };
}

function put(state: ScenarioState, code: string, dest: Parameters<typeof spawn>[2]): ScenarioState {
  return spawn(state, code, dest).state;
}

function options(state: ScenarioState, ctx: ReturnType<typeof table>["ctx"]): string[] {
  return legalIntents(state, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
}

function attachedTo(state: ScenarioState, code: string, hostCode: string): ScenarioState {
  const spawned = spawn(state, code, { zone: "attached" });
  return attachTo(spawned.state, spawned.id, first(spawned.state, hostCode));
}

describe("Earn with a condition (142019 Resolution, attachedToHero)", () => {
  it("earns Lust for the Ring when it is attached to a hero", () => {
    const { state, ctx } = won("142019", 1, (s) => attachedTo(s, "142084", FRODO));
    expect(state.window).toBeNull();
    expect(resolutionResult(state)?.earned.map((item) => item.code)).toEqual(["142084"]);
    expect(ctx).toBeDefined();
  });

  it("earns nothing when it is not attached, or when it hangs on a card that is not a hero", () => {
    expect(resolutionResult(won("142019").state)?.earned).toEqual([]);
    const loose = won("142019", 1, (s) => attachedTo(put(s, "142044", { zone: "staging" }), "142084", "142044")).state;
    expect(resolutionResult(loose)?.earned).toEqual([]);
  });

  it("attachedToHero reads the final state directly", () => {
    const { state, ctx } = table(world, {});
    const withBurden = attachedTo(state, "142084", FRODO);
    const scope = { actor: 0, sourceId: null, returned: 0 };
    expect(holds(withBurden, { kind: "attachedToHero", code: "142084", is: true }, scope, ctx)).toBe(true);
    expect(holds(state, { kind: "attachedToHero", code: "142084", is: true }, scope, ctx)).toBe(false);
  });
});

describe("inPlay and Earn (142039 Resolution)", () => {
  it("earns the four cards when The Balrog is in play", () => {
    const { state } = won("142039", 1, (s) => put(s, "142044", { zone: "staging" }));
    expect(resolutionResult(state)?.earned.map((item) => item.code)).toEqual(["142086", "142085", "142088", "142087"]);
  });

  it("asks the first player to choose one of each pair when The Balrog is not in play", () => {
    const { state, ctx } = won("142039");
    expect(options(state, ctx)).toEqual(["142086", "142085"]);
    const next = send(start(state), { type: "ChooseResolution", optionId: "142085" }, ctx);
    expect(options(next.state, ctx)).toEqual(["142088", "142087"]);
    const done = send(next, { type: "ChooseResolution", optionId: "142088" }, ctx);
    expect(resolutionResult(done.state)?.earned.map((item) => item.code)).toEqual(["142085", "142088"]);
  });

  it("inPlay is false for a card in the encounter discard pile", () => {
    const { state, ctx } = table(world, { discard: ["142044"] });
    expect(holds(state, { kind: "inPlay", code: "142044", is: true }, { actor: 0, sourceId: null, returned: 0 }, ctx)).toBe(false);
  });
});

describe("EarnAllBurdens (141056 Resolution)", () => {
  it("earns every burden in play, attached or still in the encounter deck or discard pile, and nothing else", () => {
    const { state } = won("141056", 1, (s) => {
      let next = put(s, "141080", { zone: "encounterDeck" });
      next = put(next, "141081", { zone: "staging" });
      next = put(next, "141082", { zone: "encounterDiscard" });
      next = put(next, "142044", { zone: "staging" });
      return next;
    });
    expect(resolutionResult(state)?.earned.map((item) => item.code).sort()).toEqual(["141080", "141081", "141082"]);
  });

  it("does not earn a burden that sits in the victory display or the set-aside zone", () => {
    const { state } = won("141056", 1, (s) => put(put(s, "141080", { zone: "victory" }), "141081", { zone: "setAside" }));
    expect(resolutionResult(state)?.earned).toEqual([]);
  });
});

describe("MarkFallen (142060 Resolution)", () => {
  it("marks the hero who carries Fallen Into Evil, then asks for the cards and the captives", () => {
    const { state } = won("142060", 1, (s) => attachedTo(s, "142083", SAM));
    expect(state.resolutionLog.fallen).toEqual([SAM]);
    expect(state.window).toMatchObject({ kind: "resolution", step: 1 });
  });

  it("marks nobody when the card is not attached to a hero", () => {
    expect(won("142060").state.resolutionLog.fallen).toEqual([]);
  });
});

describe("ChooseCards for each seat (141044 Resolution, to a hero)", () => {
  it("asks each seat in turn for a hero to carry a title, may be skipped, and never offers a title twice", () => {
    const { state, ctx } = won("141044", 2);
    expect(state.window).toEqual({ kind: "resolution", step: 0, seat: 0 });
    const frodo = first(state, FRODO);
    const sam = first(state, SAM);
    expect(options(state, ctx)).toEqual([
      ...["141018", "141019", "141020", "141021"].flatMap((code) => [`${code}>${frodo}`, `${code}>${sam}`]),
      "skip",
    ]);
    const second = send(start(state), { type: "ChooseResolution", optionId: `141018>${sam}` }, ctx);
    expect(second.state.window).toEqual({ kind: "resolution", step: 0, seat: 1 });
    const merry = first(state, MERRY);
    expect(options(second.state, ctx)).not.toContain(`141018>${merry}`);
    expect(options(second.state, ctx)).toContain(`141019>${merry}`);
    const done = send(second, { type: "ChooseResolution", optionId: "skip" }, ctx);
    expect(resolutionResult(done.state)?.earned).toEqual([{ code: "141018", to: "hero", seat: 0, hero: SAM, step: 0 }]);
  });

  it("refuses a title that is not on the card, and a hero of another seat", () => {
    const { state, ctx } = won("141044", 2);
    expect(reduce(state, { type: "ChooseResolution", optionId: `141018>${first(state, MERRY)}` }, ctx).ok).toBe(false);
    expect(reduce(state, { type: "ChooseResolution", optionId: `141085>${first(state, FRODO)}` }, ctx).ok).toBe(false);
  });
});

describe("NameCaptives (142060 Resolution)", () => {
  it("lets each seat name a captive among its heroes, never the Ring-bearer or Aragorn", () => {
    const { state, ctx } = won("142060", 2);
    // Step 1 (the cards of 142089 and 142090) comes first, then the captives.
    let run = send(start(state), { type: "ChooseResolution", optionId: "142089" }, ctx);
    expect(run.state.resolutionLog.earned.map((item) => item.code)).toEqual(["142089"]);
    const sam = first(state, SAM);
    expect(options(run.state, ctx)).toEqual([sam]);
    run = send(run, { type: "ChooseResolution", optionId: sam }, ctx);
    expect(run.state.window).toMatchObject({ kind: "resolution", seat: 1 });
    expect(options(run.state, ctx)).toEqual([first(state, MERRY)]);
    run = send(run, { type: "ChooseResolution", optionId: first(state, MERRY) }, ctx);
    expect(resolutionResult(run.state)?.captives).toEqual([
      { seat: 0, hero: SAM },
      { seat: 1, hero: MERRY },
    ]);
  });

  it("starts with the first player and skips a seat that has no hero left to name", () => {
    const { state } = won("142060", 2);
    expect(state.window).toMatchObject({ kind: "resolution", seat: 0 });
    expect(printedOf(cards, FRODO).traits).toContain("Ring-bearer");
  });
});

describe("a hero in the discard pile", () => {
  it("is not offered to carry a title", () => {
    const { state, ctx } = won("141044", 1, (s) => moveCard(s, first(s, SAM), { zone: "discard", seat: 0 }));
    expect(options(state, ctx).filter((id) => id.endsWith(first(state, SAM)))).toEqual([]);
  });
});
