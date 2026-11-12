// Rules: mec113.setup-the-tower-of-cirith-ungol, mec113.the-one-ring, mec113.multiplayer-the-one-ring, rr.guarded, rr.travel, rr.quest-advancement (data/rules/entries.json); ledger lines 146014:A:1, 146015:A:2, 146066:A:1, 146067:B:2, 146068:B:1, 146069:B:1, 146070:A:2, 146063:A:1.
// What the table says of The Tower of Cirith Ungol's pieces: the progress toward the 18 and the 12 that open the travel to Topmost Chamber and to The Two Watchers, the Watchers' X, the seat whose hero carries Last of the Company, the Ring-bearer under Topmost Chamber and the boons
// Shagrat guards with their owners. The engine decided each number; nothing here changes one.
import { beforeAll, describe, expect, it } from "vitest";

import { emptyLog, poolCard } from "../../campaign/log.ts";
import { opened } from "../../../test/harness/campaign-kit.ts";
import { ungolStart, ungolWorld } from "../../../test/scenarios/the-tower-of-cirith-ungol/game.ts";
import { reduce, type ReduceContext, type ScenarioState } from "../../rules/engine/reduce.ts";
import { settle } from "../../rules/engine/machine.ts";
import { holds } from "../../rules/interpret/conditions.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { runInstruction } from "../../rules/interpret/interpret.ts";
import { updateCard } from "../../rules/core/state.ts";
import { moveCard } from "../../rules/core/zones.ts";

import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { dialProps } from "../readouts/dials.ts";
import { ungolDials, ungolHands } from "../readouts/ungol.ts";
import { heldDial } from "../readouts/widgets.ts";
import { scenarioDials, seatMarks } from "../readouts/scenario-dials.ts";
import { zoneSelector } from "../store/selectors.ts";
import { ASKS } from "../words/asks/the-tower-of-cirith-ungol.ts";

const STING = "142011";
const GLAMDRING = "142013";
let ctx: ReduceContext;
let world: Awaited<ReturnType<typeof ungolWorld>>;
const names = (code: string) => world.cards.get(code)?.name ?? code;

beforeAll(async () => {
  world = await ungolWorld("strong");
  ctx = world.ctx;
}, 240_000);

const byCode = (state: ScenarioState, code: string) => Object.values(state.cards).find((card) => card.code === code)!;
const nameOfId = (state: ScenarioState) => (id: string) => names(state.cards[id]?.code ?? id);
function open(seats: 1 | 2 = 1): ScenarioState {
  const log = { ...emptyLog(seats), campaignPool: [poolCard(world.cards.get(STING)!, STING, null, 0), poolCard(world.cards.get(GLAMDRING)!, GLAMDRING, null, seats === 2 ? 1 : 0)] };
  return syncConstants(opened(ungolStart(seats, 1, "Normal", undefined, log, undefined, { choices: seats === 2 ? [STING, GLAMDRING] : [STING] }), ctx), ctx);
}
// The Two Watchers' enemy side defeated, so stage 1 gives way to stage 2; then Topmost Chamber explored, so stage 3 comes with Shagrat in play.
function stage2(seats: 1 | 2 = 1): ScenarioState {
  const state = open(seats);
  const flipped = runInstruction(state, { verb: "FlipToEnemySide", code: "146070", into: "146071" }, { seat: 0, sourceId: byCode(state, "146070").id }, ctx, []);
  return settle(syncConstants({ ...moveCard(flipped, byCode(flipped, "146071").id, { zone: "victory" }), window: null }, ctx), ctx, []);
}
function stage3(seats: 1 | 2 = 1): ScenarioState {
  const two = stage2(seats);
  const state = updateCard(two, two.questStage!, { progress: 18 });
  const ready = syncConstants({ ...state, phase: "Travel", mode: "travel", window: { kind: "travel" } } as ScenarioState, ctx);
  const traveled = reduce(ready, { type: "Travel", locationId: byCode(ready, "146015").id }, ctx);
  if (!traveled.ok) throw new Error(traveled.reason);
  return settle(syncConstants({ ...moveCard(traveled.state, byCode(traveled.state, "146015").id, { zone: "victory" }), window: null, activeLocation: null }, ctx), ctx, []);
}
const dial = (state: ScenarioState, id: string) => ungolDials(state, ctx, names).find((one) => one.id === id);

describe("the progress that opens the travel", () => {
  it("146015:A:2 is a goal dial of the progress on stage 2B against the 18 that lets the players travel to Topmost Chamber", () => {
    const state = updateCard(stage2(), stage2().questStage!, { progress: 7 });
    expect(dial(state, "chamber")).toMatchObject({ testID: "ungol-chamber", label: "Chamber", value: 7, limit: 18, goal: true });
    expect(dial(state, "chamber")?.limitWords).toContain("7 of 18 progress");
    expect(dialProps(dial(state, "chamber")!)).toMatchObject({ elimination: false, goal: true, testID: "ungol-chamber" });
  });

  it("146015:A:2 is not shown on stage 1, whatever the stage holds, and a standalone-less scenario's dials are empty elsewhere", () => {
    expect(dial(open(), "chamber")).toBeUndefined();
    expect(ungolDials({ ...open(), scenarioId: "the-battle-of-the-pelennor-fields" }, ctx, names)).toEqual([]);
  });

  it("146068:B:1 is a goal dial of the progress on stage 3B against the 12 that lets the players travel to The Two Watchers", () => {
    const at3 = stage3();
    const state = updateCard(at3, at3.questStage!, { progress: 5 });
    expect(dial(state, "watchers")).toMatchObject({ testID: "ungol-watchers", label: "Gate", value: 5, limit: 12, goal: true });
    expect(dial(at3, "chamber")).toBeUndefined();
  });
});

describe("the Watchers' X", () => {
  it("146070:A:2 shows X, twice the stage number, while the location side is in play", () => {
    expect(dial(open(), "x")).toMatchObject({ testID: "ungol-x", label: "X", value: 2 });
    expect(dial(stage3(), "x")?.value).toBe(6);
    expect(dial(stage3(), "x")?.note).toContain("twice the stage number, 3");
  });

  it("146070:A:2 is gone once the Watchers' location has flipped to its enemy side", () => {
    expect(dial(updateCard(open(), byCode(open(), "146070").id, { code: "146071" }), "x")).toBeUndefined();
  });

  it("146070:A:2 comes with the other dials of the scenario", () => {
    expect(scenarioDials(open(), ctx, names).map((one) => one.id)).toEqual(["x"]);
  });
});

describe("Last of the Company's hero", () => {
  it("146014:A:1 puts a mark on the seat whose hero carries it, naming the Ring and the Burden", () => {
    expect(ungolHands(open(), ctx)).toEqual([{ seat: 0, label: "Company", note: expect.stringContaining("carries Last of the Company, The One Ring and A Heavy Burden") }]);
    expect(seatMarks(open(2), ctx).map((mark) => mark.label)).toEqual(["P1 · Company"]);
  });

  it("146068:A:1 takes the mark away once Last of the Company has gone to the victory display", () => {
    expect(ungolHands(stage3(), ctx)).toEqual([]);
  });
});

describe("the Ring-bearer under Topmost Chamber", () => {
  it("146066:A:1 is the first player's held dial, wearing the Ring, and says where Frodo lies", () => {
    const state = open();
    expect(heldDial(state, names)).toEqual({ seat: 0, words: "Frodo Baggins, the Ring-bearer, lies faceup under Topmost Chamber. The first player takes control when it is explored", mark: "oneRing" });
  });

  it("146066:A:1 draws the Ring-bearer under Topmost Chamber in the staging area and as the active location", () => {
    const state = open();
    const frodo = byCode(state, "141001").id;
    const chamber = byCode(state, "146015").id;
    const inStaging = zoneSelector("staging", 0)(state).entries.find((entry) => entry.card.id === chamber);
    expect(inStaging?.attached.map((card) => card.id)).toContain(frodo);
    const active = { ...moveCard(state, chamber, { zone: "activeLocation" }), activeLocation: chamber };
    const inActive = zoneSelector("activeLocation", 0)(active).entries.find((entry) => entry.card.id === chamber);
    expect(inActive?.attached.map((card) => card.id)).toContain(frodo);
  });

  it("146067:B:2 says in the preview what Topmost Chamber holds and that its explorer's first player gains control, not that it holds a hero facedown", () => {
    const state = open();
    const chamber = dungeonDetail(state, ctx, byCode(state, "146015").id, nameOfId(state));
    expect(chamber).toContain("Guards Frodo Baggins, Your Ring-bearer, faceup");
    expect(chamber).not.toContain("facedown");
    expect(dungeonDetail(state, ctx, byCode(state, "141001").id, nameOfId(state))).toBe("The Ring-bearer, a guarded objective under Topmost Chamber. No one controls it and it takes no damage. It returns with its attachments when Topmost Chamber leaves play");
  });
});

describe("the boons Shagrat guards", () => {
  it("146069:B:1 names each boon's owner on Shagrat and on the boon, two-handed", () => {
    const at3 = stage3();
    const solo = dungeonDetail(at3, ctx, byCode(at3, "146020").id, nameOfId(at3));
    expect(solo).toContain("Guards Sting (Your)");
    expect(solo).toContain("lost from the campaign pool if he is in play");
    expect(dungeonDetail(at3, ctx, byCode(at3, STING).id, nameOfId(at3))).toContain("Your boon, guarded by Shagrat");
  });

  it("146069:B:1 says Player 1 and Player 2 when two players' boons are on him", () => {
    const at3 = stage3(2);
    expect(dungeonDetail(at3, ctx, byCode(at3, "146020").id, nameOfId(at3))).toContain("Guards Sting (Player 1's), Glamdring (Player 2's)");
    expect(dungeonDetail(at3, ctx, byCode(at3, GLAMDRING).id, nameOfId(at3))).toContain("Player 2's boon, guarded by Shagrat");
  });
});

describe("the Tap again warning of the rows that can lose the game", () => {
  // 146063:A:1: discarding the questing hero that carries The One Ring takes it out of play, which loses the game (mec113.the-one-ring).
  it("146063:A:1 arms only on the hero that carries The One Ring", () => {
    const state = open();
    const carrier = byCode(state, "q1").id;
    const other = byCode(state, "q2").id;
    const when = ASKS["146063:whenRevealed:1 @0.0.discard.0 Pick"]!.caution!.when;
    expect(holds(state, when, { actor: 0, sourceId: null, returned: 0, picked: [carrier] }, ctx)).toBe(true);
    expect(holds(state, when, { actor: 0, sourceId: null, returned: 0, picked: [other] }, ctx)).toBe(false);
  });

  it("146059:A:2 arms when the 2 damage destroys the hero that carries The One Ring, and not before", () => {
    const state = open();
    const carrier = byCode(state, "q1").id;
    const when = ASKS["146059:forced:1 @0 Pick"]!.caution!.when;
    const hit = (damage: number) => holds(updateCard(state, carrier, { damage }), when, { actor: 0, sourceId: null, returned: 0, picked: [carrier] }, ctx);
    const hitPoints = world.cards.get("q1")!.health ?? 0;
    expect(hit(hitPoints - 2)).toBe(true);
    expect(hit(hitPoints - 3)).toBe(false);
  });
});
