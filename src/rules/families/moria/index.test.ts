// Rules: rr.damage, rr.attachment-cards, rr.destroy, rr.engaged (data/rules/entries.json). The moria family's verbs (src/catalog/families/moria.ts)
// and the engine reads around them; the cards that use them are tested in src/campaign/moria-*.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import { pushCardEffects } from "../../interpret/effect-frames.ts";
import type { EngineStep } from "../../core/intents.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { causeProblems } from "../../../../scripts/cause-check.ts";
import { BALROG, DOOM, loadMoriaWorld, makeTable, recordOf, runOne, settled, WOUND, type MoriaWorld } from "../../../../scripts/moria-scene.ts";
import { first } from "../../../../scripts/past-scene.ts";

let world: MoriaWorld;

beforeAll(async () => {
  world = await loadMoriaWorld();
}, 60_000);

describe("PlaceDamageOn and RemoveDamageFrom", () => {
  it("place and remove damage tokens on the card in play with the code, to a floor of 0, naming the record in the step", () => {
    const table = makeTable(world, { doom: 3 });
    const doom = first(table.state, DOOM);
    const steps: EngineStep[] = [];
    const pushed = pushCardEffects({ ...table.state, window: null }, "forced", doom, 0, false, [recordOf("142043:forced:1")], table.ctx, steps);
    const after = settled(table, pushed, steps);
    expect(after.cards[doom]?.damage).toBe(2);
    const change = steps.find((step) => step.kind === "damage" && step.targetId === doom);
    expect(change && change.kind === "damage" ? change.amount : 0).toBe(-1);
    expect(change && "cause" in change ? change.cause : null).toEqual({ effect: "142043:forced:1", line: "142043:A:1" });
    expect(causeProblems(steps)).toEqual([]);
    const placed = runOne(table, table.state, { verb: "PlaceDamageOn", code: DOOM, amount: 7 }, doom);
    expect(placed.cards[doom]?.damage).toBe(10);
    const emptied = runOne(table, table.state, { verb: "RemoveDamageFrom", code: DOOM, amount: 99 }, doom);
    expect(emptied.cards[doom]?.damage).toBe(0);
  });

  it("do nothing, without a step, when the card is not in play or holds none", () => {
    const table = makeTable(world, { doom: 0 });
    const steps: EngineStep[] = [];
    const same = runInstruction({ ...table.state, window: null }, { verb: "RemoveDamageFrom", code: DOOM, amount: 1 }, { seat: 0, sourceId: null }, table.ctx, steps);
    expect(same.cards[first(same, DOOM)]?.damage).toBe(0);
    const absent = runInstruction({ ...table.state, window: null }, { verb: "PlaceDamageOn", code: BALROG, amount: 1 }, { seat: 0, sourceId: null }, table.ctx, steps);
    expect(absent.cards).toBe(table.state.cards);
    expect(steps).toEqual([]);
  });
});

describe("AttachToSubject", () => {
  it("attaches the source from the staging area to the hero the answered event names, and nothing else", () => {
    const table = makeTable(world, { staging: [WOUND], heroes: ["strong"] });
    const wound = first(table.state, WOUND);
    // Without a subject nothing happens; a subject that is not a hero in play changes nothing.
    const none = runOne(table, table.state, { verb: "AttachToSubject" }, wound);
    expect(none.cards[wound]?.zone).toBe("staging");
  });
});
