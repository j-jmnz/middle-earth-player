import { beforeAll, describe, expect, it } from "vitest";

import { attackBarred } from "../rules/constants.ts";
import { legalIntents } from "../rules/reduce.ts";
import { updateCard } from "../rules/state.ts";
import { begin, buildTable, frameNames, FRODO, idsOf, MERRY, RIDER, SAM, sceneCards, send, type Run, type Scene, type Table } from "../../scripts/test-scene.ts";

let base: Awaited<ReturnType<typeof sceneCards>>;

beforeAll(async () => {
  base = await sceneCards();
});

function triggers(run: Run, table: Table) {
  return legalIntents(run.state, table.ctx).filter((intent) => intent.type === "Trigger");
}

// Reveals the Black Rider on top of the deck, commits both heroes to its Hide test, and passes the action window.
function succeedHide(scene: Scene): { run: Run; table: Table } {
  const table = buildTable(base, { deck: [RIDER, "f0", "f0", "f0", "f0"], ...scene });
  let run = begin(table.state);
  for (let seat = 0; seat < (scene.seats ?? 1); seat += 1) run = send(run, { type: "Pass" }, table.ctx);
  run = send(run, { type: "CommitHide", cardIds: [idsOf(table, FRODO), idsOf(table, SAM)] }, table.ctx);
  for (let seat = 0; seat < (scene.seats ?? 1); seat += 1) run = send(run, { type: "Pass" }, table.ctx);
  return { run, table };
}

describe("141024 Escape to Buckland Response", () => {
  const scene: Scene = { stage: "141024", staging: ["141036", "141037"] };

  it("offered after a successful Hide test; 2 progress per player on a chosen location", () => {
    const { run, table } = succeedHide(scene);
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    const quest = idsOf(table, "141024");
    expect(triggers(run, table)).toEqual([{ type: "Trigger", cardId: quest, effectId: "141024:response:1" }]);
    expect(legalIntents(run.state, table.ctx)).toContainEqual({ type: "Pass" });
    // Two different locations: the player picks one.
    let next = send(run, { type: "Trigger", cardId: quest, effectId: "141024:response:1" }, table.ctx);
    expect(next.state.window?.kind).toBe("choose");
    const hill = idsOf(table, "141036");
    next = send(next, { type: "Choose", optionId: hill }, table.ctx);
    expect(next.state.cards[hill]?.progress).toBe(2);
    expect(next.steps).toContainEqual({ kind: "progress", targetId: hill, amount: 2 });
    expect(next.state.cards[idsOf(table, "141037")]?.progress).toBe(0);
    expect(next.state.stack).toEqual([]);
  });

  it("4 progress with two players; a full location is explored", () => {
    const { run, table } = succeedHide({ ...scene, seats: 2, staging: ["141036"] });
    const quest = idsOf(table, "141024");
    const hill = idsOf(table, "141036");
    const next = send(run, { type: "Trigger", cardId: quest, effectId: "141024:response:1" }, table.ctx);
    // 3 quest points: 3 are placed, and the location is explored.
    expect(next.steps).toContainEqual({ kind: "progress", targetId: hill, amount: 3 });
    expect(next.state.cards[hill]?.zone).toBe("encounterDiscard");
  });

  it("can be passed", () => {
    const { run, table } = succeedHide(scene);
    const next = send(run, { type: "Pass" }, table.ctx);
    expect(next.state.cards[idsOf(table, "141036")]?.progress).toBe(0);
    expect(next.state.window?.kind).not.toBe("response");
    expect(next.state.stack).toEqual([]);
  });

  it("not offered after a failed Hide test", () => {
    const table = buildTable(base, { ...scene, deck: [RIDER, "f3", "f3", "f3"] });
    let run = send(begin(table.state), { type: "Pass" }, table.ctx);
    run = send(run, { type: "CommitHide", cardIds: [] }, table.ctx);
    run = send(run, { type: "Pass" }, table.ctx);
    expect(run.steps.some((step) => step.kind === "hideTest" && !step.success)).toBe(true);
    expect(run.state.window?.kind).not.toBe("response");
  });

  it("not offered to a seat that Peril locks out", () => {
    // Seat 1 reveals the card with Hide, and succeeds. The first player is seat 0.
    function seatOneTests(hideCard: string) {
      const table = buildTable(base, { ...scene, staging: ["141036"], seats: 2, deck: ["f0", hideCard, "f0", "f0", "f0", "f0"] });
      let run = begin(table.state);
      run = send(run, { type: "Pass" }, table.ctx);
      run = send(run, { type: "Pass" }, table.ctx);
      expect(run.state.window).toEqual({ kind: "hideCommit", seat: 1 });
      run = send(run, { type: "CommitHide", cardIds: [] }, table.ctx);
      return { run, table };
    }
    // Without Peril both seats act in the Hide action window, and the first player is offered it.
    let plain = seatOneTests(RIDER);
    plain.run = send(send(plain.run, { type: "Pass" }, plain.table.ctx), { type: "Pass" }, plain.table.ctx);
    expect(plain.run.state.window).toEqual({ kind: "response", seat: 0 });
    // 141041 has Peril: only seat 1 acts, and the offer for seat 0 is not made.
    const perilous = seatOneTests("141041");
    const run = send(perilous.run, { type: "Pass" }, perilous.table.ctx);
    expect(run.steps.some((step) => step.kind === "hideTest" && step.success)).toBe(true);
    expect(run.state.window?.kind).not.toBe("response");
  });
});

describe("141031 Bag End Response", () => {
  const scene: Scene = { stage: "141022", active: "141031", playerDeck: [], deck: ["f0", "f0", "f0"] };

  function explore(extra: Partial<Scene> = {}): { run: Run; table: Table } {
    const table = buildTable(base, {
      ...scene,
      playerDeck: [{ code: "card", seat: 0 }, { code: "card", seat: 0 }, { code: "card", seat: 0 }, { code: "card", seat: 1 }, { code: "card", seat: 1 }],
      ...extra,
    });
    const state = updateCard(table.state, idsOf(table, SAM), { committed: false });
    let run = send(begin(state), { type: "Commit", cardIds: [idsOf(table, SAM)] }, table.ctx);
    for (let seat = 0; seat < (extra.seats ?? 1); seat += 1) run = send(run, { type: "Pass" }, table.ctx);
    return { run, table };
  }

  it("offered when explored; draws once per Hobbit hero", () => {
    const { run, table } = explore();
    const bagEnd = idsOf(table, "141031");
    expect(run.state.cards[bagEnd]?.zone).toBe("victory");
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    expect(triggers(run, table)).toEqual([{ type: "Trigger", cardId: bagEnd, effectId: "141031:response:1" }]);
    const drawn = send(run, { type: "Trigger", cardId: bagEnd, effectId: "141031:response:1" }, table.ctx);
    // Frodo and Sam are Hobbits.
    expect(drawn.steps.filter((step) => step.kind === "draw")).toHaveLength(2);
    expect(drawn.state.seats[0].hand).toHaveLength(2);
    expect(drawn.state.window?.kind).not.toBe("response");
  });

  it("two players: first player draws first", () => {
    const { run, table } = explore({ seats: 2 });
    const bagEnd = idsOf(table, "141031");
    const drawn = send(run, { type: "Trigger", cardId: bagEnd, effectId: "141031:response:1" }, table.ctx);
    const seats = drawn.steps.flatMap((step) => (step.kind === "draw" ? [step.seat] : []));
    expect(seats).toEqual([0, 0, 1]);
    expect(MERRY).toBe("141003");
  });

  it("a pass draws nothing", () => {
    const { run, table } = explore();
    const passed = send(run, { type: "Pass" }, table.ctx);
    expect(passed.steps.some((step) => step.kind === "draw")).toBe(false);
    expect(passed.state.seats[0].hand).toHaveLength(0);
  });
});

describe("141034 Bamfurlong Response", () => {
  const scene: Scene = { start: "travel", staging: ["141034", "f3"], engaged: [{ code: RIDER, seat: 0 }] };

  function traveled(extra: Partial<Scene> = {}): { run: Run; table: Table } {
    const table = buildTable(base, { ...scene, ...extra });
    const exhausted = updateCard(table.state, idsOf(table, SAM), { exhausted: true });
    const run = send(begin(exhausted), { type: "Travel", locationId: idsOf(table, "141034") }, table.ctx);
    return { run, table };
  }

  it("offered after travel; readies a hero on a yes", () => {
    const { run, table } = traveled();
    const location = idsOf(table, "141034");
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    let next = send(run, { type: "Trigger", cardId: location, effectId: "141034:response:1" }, table.ctx);
    expect(next.state.window).toEqual({ kind: "choose", seat: 0, options: ["ready", "skip"] });
    next = send(next, { type: "Choose", optionId: "ready" }, table.ctx);
    expect(next.state.cards[idsOf(table, SAM)]?.exhausted).toBe(false);
    expect(next.state.stack).toEqual([]);
  });

  it("a skip readies nothing", () => {
    const { run, table } = traveled();
    let next = send(run, { type: "Trigger", cardId: idsOf(table, "141034"), effectId: "141034:response:1" }, table.ctx);
    next = send(next, { type: "Choose", optionId: "skip" }, table.ctx);
    expect(next.state.cards[idsOf(table, SAM)]?.exhausted).toBe(true);
  });

  it("asks which hero when several are exhausted", () => {
    const table = buildTable(base, scene);
    let state = updateCard(table.state, idsOf(table, SAM), { exhausted: true });
    state = updateCard(state, idsOf(table, FRODO), { exhausted: true });
    let run = send(begin(state), { type: "Travel", locationId: idsOf(table, "141034") }, table.ctx);
    run = send(run, { type: "Trigger", cardId: idsOf(table, "141034"), effectId: "141034:response:1" }, table.ctx);
    run = send(run, { type: "Choose", optionId: "ready" }, table.ctx);
    expect(run.state.window?.kind).toBe("choose");
    run = send(run, { type: "Choose", optionId: idsOf(table, FRODO) }, table.ctx);
    expect(run.state.cards[idsOf(table, FRODO)]?.exhausted).toBe(false);
    expect(run.state.cards[idsOf(table, SAM)]?.exhausted).toBe(true);
  });

  it("a seat with no Nazgul engaged gets no choice", () => {
    const { run, table } = traveled({ engaged: [] });
    const next = send(run, { type: "Trigger", cardId: idsOf(table, "141034"), effectId: "141034:response:1" }, table.ctx);
    expect(next.state.cards[idsOf(table, SAM)]?.exhausted).toBe(true);
    expect(next.state.window?.kind).not.toBe("choose");
  });
});

describe("141017 Mr. Underhill Action", () => {
  const scene: Scene = {
    start: "planning",
    attached: [{ code: "141017", host: FRODO }],
    engaged: [{ code: RIDER, seat: 0 }],
    deck: ["f0", "f0", "f0", "f0", "f0", "f0"],
  };

  it("offered only while an enemy is engaged with the player", () => {
    const table = buildTable(base, scene);
    const underhill = idsOf(table, "141017");
    const run = begin(table.state);
    expect(triggers(run, table)).toContainEqual({ type: "Trigger", cardId: underhill, effectId: "141017:action:1" });
    const alone = buildTable(base, { ...scene, engaged: [] });
    expect(triggers(begin(alone.state), alone)).toEqual([]);
  });

  it("cost moves the card to the victory display; bars the chosen enemy until the end of the round", () => {
    const table = buildTable(base, scene);
    const underhill = idsOf(table, "141017");
    const rider = idsOf(table, RIDER);
    const used = send(begin(table.state), { type: "Trigger", cardId: underhill, effectId: "141017:action:1" }, table.ctx);
    expect(used.state.cards[underhill]?.zone).toBe("victory");
    expect(attackBarred(used.state, rider, 0)).toBe(true);
    expect(attackBarred(used.state, rider, 1)).toBe(false);
    expect(used.state.modifiers.find((modifier) => modifier.stat === "cannotAttack")?.until).toBe("endOfRound");
    // The window it was used in is open again, and the Action is gone.
    expect(used.state.window).toEqual({ kind: "pass" });
    expect(frameNames(used.steps)).toEqual(["push:ResolveEffect", "pop:ResolveEffect"]);
    expect(triggers(used, table)).toEqual([]);
  });

  it("a barred enemy makes no attack in the Combat phase", () => {
    const table = buildTable(base, { ...scene, deck: ["f0", "f0", "card", "card", "card", "card"] });
    const underhill = idsOf(table, "141017");
    let run = send(begin(table.state), { type: "Trigger", cardId: underhill, effectId: "141017:action:1" }, table.ctx);
    // Planning, then the quest commit, staging, travel, and the encounter step.
    run = send(run, { type: "Pass" }, table.ctx);
    run = send(run, { type: "Pass" }, table.ctx);
    if (run.state.window?.kind === "travel") run = send(run, { type: "DeclineTravel" }, table.ctx);
    if (run.state.window?.kind === "optionalEngage") run = send(run, { type: "DeclineEngage" }, table.ctx);
    expect(run.steps.some((step) => step.kind === "attack" && step.side === "enemy")).toBe(false);
    expect(run.state.window?.kind).toBe("playerAttack");
  });
});
