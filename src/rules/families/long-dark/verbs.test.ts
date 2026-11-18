import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { parseKeywordTokens, isKeywordLine } from "../../../catalog/keyword-line.ts";
import { holds } from "../../interpret/conditions.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { settle } from "../../engine/machine.ts";
import { definePrinted } from "../../core/printed.ts";
import { seatBarred } from "../../interpret/restrictions.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import type { EngineStep } from "../../core/intents.ts";
import { announceProgress } from "../burden/effects.ts";
import { placeProgress } from "../../interpret/effect-verbs.ts";
import { makeActiveIn, placeOnActive } from "../south/locations.ts";
import { enemy, hero, send, table, treachery, type TableSpec } from "../defense/table.ts";
import { opening } from "../../../../test/harness/scene-kit.ts";
import { STOP as PARK } from "../mount-doom/stop.ts";
import { markProgressHeld } from "./hold.ts";
import { STOP } from "./locate.ts";

// Rules: dwd.locate-test, dwd.revealing-enemies, rr.forced, rr.active-location, rr.travel, rr.step-4-2, rr.next-player, rr.cannot, rr.surge, rr.reveal (data/rules/entries.json); ledger lines 04092:A:1, 04095:A:1, 04086:B:1, 04098:A:1, 901601:A:2, 901602:A:2, 901603:A:2, 901604:A:1, 901605:A:1, 04093:A:1.
// The smaller verbs, flags, conditions and filters the long-dark family adds, on small tables.

const spot = (code: string, stats: Partial<Parameters<typeof definePrinted>[0]> = {}) => definePrinted({ code, name: code, type: "location", threat: 1, questPoints: 3, ...stats });
const passing = definePrinted({ code: "p1", name: "p1", type: "location", keywords: { pass: true } });
const record = (id: string, code: string, rest: Partial<Effect> & Pick<Effect, "timing" | "instructions">): Effect => ({ id, cardCode: code, lines: [`${code}:A:1`], ...rest });
const instructions = (...list: Instruction[]) => list;

describe("PASS (04089:A:2 and every other line that prints only it)", () => {
  it("is a keyword: the line is keyword-owned and the card passes", () => {
    expect(parseKeywordTokens(["PASS."])).toEqual({ keywords: { pass: true }, unknown: [] });
    expect(isKeywordLine("PASS.")).toBe(true);
    expect(passing.keywords.pass).toBe(true);
    expect(definePrinted({ code: "x", name: "x", type: "location" }).keywords.pass).toBe(false);
  });
});

const forced04092 = (): Effect => record("tp:forced:1", "tp", { timing: "forced", trigger: "progressWouldBePlaced", instructions: instructions({ verb: "LocateTest", who: "firstPlayer" }, { verb: "PlaceHeldProgress", when: { kind: "lastLocatePassed" } }, PARK) });

describe("holding progress (04092:A:1): PlaceHeldProgress and progressWouldBePlaced", () => {
  const FAILED: Instruction = { verb: "RaiseThreat", amount: 4, when: { kind: "lastLocateFailed" } };
  const forced = record("tp:forced:1", "tp", { timing: "forced", trigger: "progressWouldBePlaced", instructions: instructions({ verb: "LocateTest", who: "firstPlayer" }, { verb: "PlaceHeldProgress", when: { kind: "lastLocatePassed" } }, FAILED, PARK) });

  function staged(extra: Partial<TableSpec> = {}) {
    const base = table({ cards: [hero("a"), spot("tp"), treachery("h1"), treachery("e0"), passing], effects: [forced], heroes: [{ code: "a" }], staging: [{ code: "tp" }], hand: [{ code: "h1" }], encounter: ["p1", "e0"], threat: 30, ...extra });
    const state = markProgressHeld({ ...base.state, window: null, phase: "Quest" }, base.ctx);
    return { ...base, state, id: base.ids.tp ?? "" };
  }

  it("is noted at the start of a game that deals a card with such a record, and only then", () => {
    expect(staged().state.progressHeldBy).toEqual(["tp"]);
    const none = table({ cards: [hero("a")], effects: [], heroes: [{ code: "a" }] });
    expect(markProgressHeld(none.state, none.ctx).progressHeldBy).toBeUndefined();
  });

  it("holds the placement of an effect: nothing is placed and the record hears the amount", () => {
    const run = staged();
    const held = placeProgress(run.state, run.id, 2, run.ctx, []);
    expect(held.cards[run.id]?.progress).toBe(0);
    expect(held.pendingEvents).toEqual([{ trigger: "progressWouldBePlaced", seat: null, cardId: run.id, amount: 2 }]);
  });

  it("places it all when the test is passed, and none when it is failed", () => {
    const run = staged();
    const asked = settle(placeProgress(run.state, run.id, 2, run.ctx, []), run.ctx, []);
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0 });
    const passed = send(asked, { type: "Choose", optionId: run.ids.h1 ?? "" }, run.ctx);
    expect(passed.cards[run.id]?.progress).toBe(2);
    const failed = send(settle(placeProgress(run.state, run.id, 2, run.ctx, []), run.ctx, []), { type: "Choose", optionId: STOP }, run.ctx);
    expect(failed.cards[run.id]?.progress).toBe(0);
    expect(failed.seats[0]?.threat).toBe(34);
  });

  it("makes the test again for each placement, and explores the location when the placement fills it", () => {
    const run = staged();
    const first = send(settle(placeProgress(run.state, run.id, 2, run.ctx, []), run.ctx, []), { type: "Choose", optionId: run.ids.h1 ?? "" }, run.ctx);
    expect(first.cards[run.id]?.progress).toBe(2);
    const again = placeProgress({ ...first, window: null }, run.id, 1, run.ctx, []);
    expect(again.cards[run.id]?.progress).toBe(2);
    expect(again.pendingEvents?.at(-1)).toMatchObject({ trigger: "progressWouldBePlaced", amount: 1 });
  });

  it("holds the whole of the quest phase's progress on the active location, the quest's share too", () => {
    const run = staged();
    const active = makeActiveIn(run.state, run.id);
    const out = placeOnActive(active, 5, run.ctx.cards, []);
    expect(out.remaining).toBe(0);
    expect(out.state.cards[run.id]?.progress).toBe(0);
    expect(out.state.pendingEvents).toEqual([{ trigger: "progressWouldBePlaced", seat: null, cardId: run.id, amount: 5 }]);
  });

  it("explores the location when a passed test lets the quest phase's total fill it", () => {
    const run = staged();
    const active = makeActiveIn(run.state, run.id);
    const asked = settle(placeOnActive(active, 5, run.ctx.cards, []).state, run.ctx, []);
    const done = send(asked, { type: "Choose", optionId: run.ids.h1 ?? "" }, run.ctx);
    expect(done.cards[run.id]?.zone).toBe("encounterDiscard");
  });
});

describe("04092:A:1 the progress beyond its room goes to the quest in every phase (rr.active-location)", () => {
  it("sends what a passed test's placement leaves over to the current quest outside the quest phase too", () => {
    const stage = definePrinted({ code: "qs", name: "qs", type: "quest", questPoints: 10 });
    const base = table({ cards: [hero("a"), spot("tp"), treachery("h1"), treachery("e0"), passing, stage], effects: [forced04092()], heroes: [{ code: "a" }], staging: [{ code: "tp" }, { code: "qs" }], hand: [{ code: "h1" }], encounter: ["p1", "e0"], threat: 30 });
    const id = base.ids.tp ?? "";
    const questId = base.ids.qs ?? "";
    const ready = markProgressHeld({ ...makeActiveIn(base.state, id), window: null, phase: "Combat", questStage: questId }, base.ctx);
    const asked = settle(placeOnActive(ready, 5, base.ctx.cards, []).state, base.ctx, []);
    const done = send(asked, { type: "Choose", optionId: base.ids.h1 ?? "" }, base.ctx);
    expect(done.cards[id]?.zone).toBe("encounterDiscard");
    expect(done.cards[questId]?.progress).toBe(2);
  });
});

describe("901605:A:1 Eastern Mines: the locate test after it becomes the active location", () => {
  function traveled(failed: boolean) {
    const mines = record("mines:travel:1", "mines", { timing: "travel", instructions: instructions({ verb: "Travel", to: "self" }, { verb: "LocateTest", who: "firstPlayer" }, { verb: "ReturnToStaging", target: { kind: "self" }, when: { kind: "lastLocateFailed" } }) });
    const base = table({ cards: [hero("a"), spot("mines"), treachery("h1"), passing], effects: [mines], heroes: [{ code: "a" }], staging: [{ code: "mines" }], hand: [{ code: "h1" }], encounter: ["p1"] });
    const id = base.ids.mines ?? "";
    const asked = send({ ...base.state, ...opening("Travel") }, { type: "Travel", locationId: id }, base.ctx);
    // The test is asked with the location already the active location: it is not in the staging area.
    expect(asked.cards[id]?.zone).toBe("activeLocation");
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0 });
    return { state: send(asked, { type: "Choose", optionId: failed ? STOP : (base.ids.h1 ?? "") }, base.ctx), id };
  }

  it("asks the test with the location already active, and returns it to the staging area with the travel used when the test is failed", () => {
    const { state, id } = traveled(true);
    expect(state.cards[id]?.zone).toBe("staging");
    expect(state.failure ?? null).toBeNull();
    expect(state.phase).not.toBe("Travel");
  });

  it("lets the travel go on when the test is passed", () => {
    const { state, id } = traveled(false);
    expect(state.cards[id]?.zone).toBe("activeLocation");
  });
});

describe("04097:A:1 the discard after \"then\" resolves only when the draw did (rr.then)", () => {
  const run = (deck: boolean) => {
    const base = table({ cards: [hero("a"), treachery("h1"), treachery("h2"), treachery("h3"), treachery("h4"), treachery("h5"), treachery("dk")], effects: [], heroes: [{ code: "a" }], hand: ["h1", "h2", "h3", "h4", "h5"].map((code) => ({ code })) });
    const stocked = deck ? spawn(base.state, "dk", { zone: "deck", seat: 0 }).state : base.state;
    const steps: Instruction[] = [{ verb: "Draw", who: "firstPlayer" }, { verb: "ActAs", who: "firstPlayer" }, { verb: "DiscardFromHand", amount: 4, when: { kind: "drew" } }];
    const pushed = pushEffectFrame({ ...stocked, window: null }, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "spider", instructions: [...steps, PARK], cancel: null, blockCancel: null }, []);
    return settle(pushed, base.ctx, []);
  };

  it("discards nothing when no card could be drawn", () => {
    const state = run(false);
    expect(state.seats[0]?.hand).toHaveLength(5);
  });

  it("asks for the 4 discards when a card was drawn", () => {
    const state = run(true);
    expect(state.seats[0]?.hand).toHaveLength(6);
    expect(state.window).toMatchObject({ kind: "choose", seat: 0 });
  });
});

describe("901606:A:1 progressPlacedOnSelf hears every placement, the one that explores the card too", () => {
  const chasm = record("ch:forced:1", "ch", { timing: "forced", trigger: "progressPlacedOnSelf", instructions: instructions({ verb: "RaiseThreat", amount: 1, who: "eachSeat" }) });
  const heard = (state: ScenarioState) => (state.pendingEvents ?? []).filter((event) => event.trigger === "progressPlacedOnSelf" || event.trigger === "progressPlaced");
  const run = (amount: number) => {
    const base = table({ cards: [hero("a"), spot("ch", { questPoints: 3 })], effects: [chasm], heroes: [{ code: "a" }], staging: [{ code: "ch" }], threat: 30 });
    const steps: EngineStep[] = [];
    const placed = placeProgress({ ...base.state, window: null }, base.ids.ch ?? "", amount, base.ctx, steps);
    return { base, placed, steps };
  };

  it("queues the amount for a card the placement explored, which has left play", () => {
    const { base, placed, steps } = run(3);
    expect(placed.cards[base.ids.ch ?? ""]?.zone).toBe("encounterDiscard");
    expect(heard(announceProgress(placed, steps, base.ctx))).toEqual([{ trigger: "progressPlacedOnSelf", seat: null, cardId: base.ids.ch, amount: 3 }]);
  });

  it("queues it for a card that stays in play too", () => {
    const { base, placed, steps } = run(2);
    expect(heard(announceProgress(placed, steps, base.ctx))).toEqual([{ trigger: "progressPlacedOnSelf", seat: null, cardId: base.ids.ch, amount: 2 }]);
  });

  it("is raised only in a game that deals a record that hears it", () => {
    const base = table({ cards: [hero("a"), spot("ch", { questPoints: 3 })], effects: [], heroes: [{ code: "a" }], staging: [{ code: "ch" }] });
    const steps: EngineStep[] = [];
    const placed = placeProgress({ ...base.state, window: null }, base.ids.ch ?? "", 3, base.ctx, steps);
    expect(heard(announceProgress(placed, steps, base.ctx))).toEqual([]);
  });
});

describe("EnemiesGainSurge (04095:A:1)", () => {
  const marker = record("gg:constant:1", "gg", { timing: "constant", instructions: instructions({ verb: "EnemiesGainSurge" }) });
  const reveal = (withMarker: boolean) => {
    const cards = [hero("a"), enemy("e1"), enemy("e3"), treachery("t1"), definePrinted({ code: "gg", name: "gg", type: "treachery" })];
    const base = table({ cards, effects: [marker], heroes: [{ code: "a" }], staging: withMarker ? [{ code: "gg" }] : [], encounter: ["e1", "t1", "e3"] });
    const synced = syncConstants({ ...base.state, window: null, phase: "Quest" }, base.ctx);
    const pushed = pushEffectFrame(synced, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: [{ verb: "RevealEncounter" }, PARK], cancel: null, blockCancel: null }, []);
    return settle(pushed, base.ctx, []);
  };

  it("gives surge to an enemy the encounter deck reveals: the next card is revealed too", () => {
    const state = reveal(true);
    expect(state.encounterDeck.map((id) => state.cards[id]?.code)).toEqual(["e3"]);
    expect(state.staging.some((id) => state.cards[id]?.code === "e1")).toBe(true);
  });

  it("gives nothing without the marker", () => {
    const state = reveal(false);
    expect(state.encounterDeck.map((id) => state.cards[id]?.code)).toEqual(["t1", "e3"]);
  });
});

describe("highestThreatPlusRemaining (04095:A:1)", () => {
  const pick = { type: "location" as const, control: "any" as const, stagingOnly: true, highestThreatPlusRemaining: true as const };

  it("keeps the location with the highest Threat plus remaining quest points, all of those tied", () => {
    const base = table({ cards: [hero("a"), spot("l1", { threat: 2, questPoints: 3 }), spot("l2", { threat: 1, questPoints: 5 }), spot("l3", { threat: 1, questPoints: 3 })], effects: [], heroes: [{ code: "a" }], staging: [{ code: "l1" }, { code: "l2" }, { code: "l3" }] });
    expect(pickCandidates(base.state, pick, 0, [], null, base.ctx)).toEqual([base.ids.l2]);
    const tied = table({ cards: [hero("a"), spot("l1", { threat: 2, questPoints: 3 }), spot("l2", { threat: 1, questPoints: 4 })], effects: [], heroes: [{ code: "a" }], staging: [{ code: "l1" }, { code: "l2" }] });
    expect(pickCandidates(tied.state, pick, 0, [], null, tied.ctx)).toEqual([tied.ids.l1, tied.ids.l2]);
  });

  it("counts the quest points left after the progress on the card, and none for a card with no quest points", () => {
    const base = table({ cards: [hero("a"), spot("l1", { threat: 1, questPoints: 6 }), spot("l2", { threat: 3, questPoints: undefined })], effects: [], heroes: [{ code: "a" }], staging: [{ code: "l1" }, { code: "l2" }] });
    const worn = updateCard(base.state, base.ids.l1 ?? "", { progress: 5 });
    // l1 is worth 1 + 1, l2 is worth 3 + 0.
    expect(pickCandidates(worn, pick, 0, [], null, base.ctx)).toEqual([base.ids.l2]);
  });
});

describe("DiscardUntilEnemies atLeast and returnOthers (04086:B:1)", () => {
  const journey: Instruction = { verb: "DiscardUntilEnemies", perPlayer: 1, less: 1, atLeast: 1, to: "staging", cardType: "location", returnOthers: true };
  const cards = [hero("a"), treachery("t1"), treachery("t2"), spot("l1"), spot("l2"), spot("l3")];

  it("counts one location with one or two players, and shuffles the other discarded cards back with nothing else from the pile", () => {
    const base = table({ cards, effects: [], heroes: [{ code: "a" }], discard: [], encounter: ["t1", "t2", "l1", "l2"] });
    const filler = moveCard(base.state, base.state.encounterDeck[0] ?? "", { zone: "encounterDiscard" });
    const done = runInstruction({ ...filler, window: null }, journey, { seat: 0, sourceId: null }, base.ctx, []);
    expect(done.staging.map((id) => done.cards[id]?.code)).toEqual(["l1"]);
    // The card that was in the discard pile before stays; the card discarded without counting went back.
    expect(done.encounterDiscard.map((id) => done.cards[id]?.code)).toEqual(["t1", "l1"].filter((code) => code === "t1"));
    expect(done.encounterDeck.map((id) => done.cards[id]?.code).sort()).toEqual(["l2", "t2"]);
  });

  it("counts players less one for more players", () => {
    const base = table({ cards, effects: [], heroes: [{ code: "a" }], seatCount: 2, encounter: ["l1", "t2", "l2", "l3"] });
    const done = runInstruction({ ...base.state, window: null }, { ...journey, less: 1, atLeast: 1 }, { seat: 0, sourceId: null }, base.ctx, []);
    expect(done.staging).toHaveLength(1);
    const three = runInstruction({ ...base.state, window: null, seatCount: 3 as never }, { ...journey, less: 1 }, { seat: 0, sourceId: null }, base.ctx, []);
    expect(three.staging.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Restrict draw engagedPlayer (901604:A:1)", () => {
  const sentinel = record("s:constant:1", "s", { timing: "constant", instructions: instructions({ verb: "Restrict", what: "draw", engagedPlayer: true }) });

  it("bars the player the Sentinel is engaged with from drawing by a card effect, and only while it is engaged", () => {
    const cards = [hero("a"), hero("b"), enemy("s")];
    const base = table({ seatCount: 2, cards, effects: [sentinel], heroes: [{ code: "a" }, { code: "b", seat: 1 }], enemies: [{ code: "s", seat: 0 }] });
    expect(seatBarred(base.state, base.ctx, 0, "draw")).toBe(true);
    expect(seatBarred(base.state, base.ctx, 1, "draw")).toBe(false);
    const staged = moveCard(base.state, base.ids.s ?? "", { zone: "staging" });
    expect(seatBarred(staged, base.ctx, 0, "draw")).toBe(false);
  });
});

describe("EngageLastPlayer from another player's side (901603:A:2) and EngageNextPlayer announces (04098:A:1)", () => {
  const two = { seatCount: 2 as const, cards: [hero("a"), hero("b"), enemy("s")], effects: [] as Effect[], heroes: [{ code: "a" }, { code: "b", seat: 1 }] };

  it("moves an enemy engaged with the first player to the last player, and leaves one already with him", () => {
    const base = table({ ...two, enemies: [{ code: "s", seat: 0 }] });
    const moved = runInstruction({ ...base.state, window: null }, { verb: "EngageLastPlayer" }, { seat: 0, sourceId: base.ids.s ?? "" }, base.ctx, []);
    expect(moved.cards[base.ids.s ?? ""]?.controller).toBe(1);
    const stays = runInstruction(moved, { verb: "EngageLastPlayer" }, { seat: 0, sourceId: base.ids.s ?? "" }, base.ctx, []);
    expect(stays).toBe(moved);
  });

  it("announces the engagement of the next player only with `announces`", () => {
    const base = table({ ...two, enemies: [{ code: "s", seat: 0 }] });
    const quiet = runInstruction({ ...base.state, window: null }, { verb: "EngageNextPlayer" }, { seat: 0, sourceId: base.ids.s ?? "" }, base.ctx, []);
    expect(quiet.pendingEvents ?? []).toEqual([]);
    const loud = runInstruction({ ...base.state, window: null }, { verb: "EngageNextPlayer", announces: true }, { seat: 0, sourceId: base.ids.s ?? "" }, base.ctx, []);
    expect(loud.pendingEvents).toEqual([{ trigger: "engaged", seat: 1, subject: base.ids.s }]);
  });
});

describe("the conditions hasPass and playerWithoutReady (901602:A:2, 04093:A:1)", () => {
  it("reads PASS on the card the condition names", () => {
    const base = table({ cards: [hero("a"), passing, treachery("e0")], effects: [], heroes: [{ code: "a" }], staging: [{ code: "p1" }, { code: "e0" }] });
    const scope = (other: string) => ({ actor: 0, sourceId: null, returned: 0, other });
    expect(holds(base.state, { kind: "hasPass", card: "other" }, scope(base.ids.p1 ?? ""), base.ctx)).toBe(true);
    expect(holds(base.state, { kind: "hasPass", card: "other" }, scope(base.ids.e0 ?? ""), base.ctx)).toBe(false);
    expect(holds(base.state, { kind: "hasPass", card: "subject" }, { actor: 0, sourceId: null, returned: 0, subject: base.ids.p1 ?? "" }, base.ctx)).toBe(true);
  });

  it("is true when some player controls no unexhausted character, not every player", () => {
    const base = table({ seatCount: 2, cards: [hero("a"), hero("b")], effects: [], heroes: [{ code: "a" }, { code: "b", seat: 1 }] });
    const scope = { actor: 0, sourceId: null, returned: 0 };
    const condition = { kind: "playerWithoutReady" } as const;
    expect(holds(base.state, condition, scope, base.ctx)).toBe(false);
    const one = updateCard(base.state, base.ids.a ?? "", { exhausted: true });
    expect(holds(one, condition, scope, base.ctx)).toBe(true);
    const state = updateCard(one, base.ids.b ?? "", { exhausted: true });
    expect(holds(state, condition, scope, base.ctx)).toBe(true);
  });
});

describe("901603:A:2 engagedWithLastPlayer: the attack follows only an engagement of the last player", () => {
  const condition = { kind: "engagedWithLastPlayer" } as const;
  const two = { seatCount: 2 as const, cards: [hero("a"), hero("b"), enemy("s")], effects: [] as Effect[], heroes: [{ code: "a" }, { code: "b", seat: 1 }] };

  it("is true for an enemy engaged with the last player, false for one engaged with another player or in the staging area", () => {
    const withLast = table({ ...two, enemies: [{ code: "s", seat: 1 }] });
    const scope = (id: string) => ({ actor: 0, sourceId: id, returned: 0 });
    expect(holds(withLast.state, condition, scope(withLast.ids.s ?? ""), withLast.ctx)).toBe(true);
    const withFirst = table({ ...two, enemies: [{ code: "s", seat: 0 }] });
    expect(holds(withFirst.state, condition, scope(withFirst.ids.s ?? ""), withFirst.ctx)).toBe(false);
    const staged = table({ ...two, staging: [{ code: "s" }] });
    expect(holds(staged.state, condition, scope(staged.ids.s ?? ""), staged.ctx)).toBe(false);
  });

  it("is the first player's in a one-player game", () => {
    const solo = table({ cards: [hero("a"), enemy("s")], effects: [], heroes: [{ code: "a" }], enemies: [{ code: "s", seat: 0 }] });
    expect(holds(solo.state, condition, { actor: 0, sourceId: solo.ids.s ?? "", returned: 0 }, solo.ctx)).toBe(true);
  });
});
