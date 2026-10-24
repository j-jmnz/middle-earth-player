import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import { printedOf } from "../rules/printed.ts";
import { legalIntents, legalTargets, reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import { withThreat } from "../rules/state.ts";
import { nextIntent } from "../../scripts/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld } from "../../scripts/starter-game.ts";

import { cardSize, hitSlot, tableLayout } from "./layout.ts";
import { threatSelector, zoneSelector, type ZoneId } from "./selectors.ts";
import { draggableIds, dropOutcome, dropRects, dropTargets, targetFromKey, targetKey } from "./selection.ts";
import { createTableStore, nextRoundSteps } from "./store.ts";

// The table's screen state: the store reads the reducer, keeps references for zones that did not change, and moves nothing
// until the reducer accepts the intent a drop maps to (docs/architecture.md, State and Play loop).
let ctx: ReduceContext;
let kept: ScenarioState;

const POLICY = { scout: "141004", prefer: "141035", protect: RING_BEARER };

function advance(state: ScenarioState, until: (state: ScenarioState) => boolean): ScenarioState {
  let current = state;
  for (let turn = 0; turn < 400 && !until(current); turn += 1) current = expectOk(reduce(current, nextIntent(current, ctx, POLICY), ctx)).state;
  if (!until(current)) throw new Error("The game never reached that window");
  return current;
}

beforeAll(async () => {
  ctx = (await starterWorld("stealth-and-steadfastness")).ctx;
  kept = expectOk(reduce(startScenario(starterStart("stealth-and-steadfastness", 1), ctx), { type: "Keep" }, ctx)).state;
});

function views(game: ScenarioState) {
  const zones: ZoneId[] = ["questStage", "staging", "activeLocation", "secondActiveLocation", "engaged", "play", "hand"];
  return Object.fromEntries(zones.map((zone) => [zone, zoneSelector(zone, 0)(game)])) as Record<ZoneId, ReturnType<ReturnType<typeof zoneSelector>>>;
}

describe("reducer references", () => {
  it("an intent that only commits characters keeps the hand, staging and decks as the same objects", () => {
    const commit = advance(kept, (state) => state.mode === "questCommit" && state.window?.kind === "pass");
    const ids = legalIntents(commit, ctx).some((intent) => intent.type === "Commit") ? nextIntent(commit, ctx, POLICY) : null;
    expect(ids?.type).toBe("Commit");
    const next = expectOk(reduce(commit, ids ?? { type: "Pass" }, ctx)).state;
    expect(next.seats[0].hand).toBe(commit.seats[0].hand);
    expect(next.seats[0].deck).toBe(commit.seats[0].deck);
    expect(next.staging).toBe(commit.staging);
    expect(next.encounterDeck).toBe(commit.encounterDeck);
  });
});

describe("zone selectors", () => {
  it("a threat change returns the same hand, staging and play views and a new threat slice", () => {
    const hand = zoneSelector("hand", 0);
    const play = zoneSelector("play", 0);
    const staging = zoneSelector("staging", 0);
    const threat = threatSelector();
    const before = { hand: hand(kept), play: play(kept), staging: staging(kept), threat: threat(kept) };
    const raised = withThreat(kept, 0, kept.seats[0].threat + 3);
    expect(hand(raised)).toBe(before.hand);
    expect(play(raised)).toBe(before.play);
    expect(staging(raised)).toBe(before.staging);
    expect(threat(raised)).not.toBe(before.threat);
    expect(threat(raised)[0]?.threat).toBe(kept.seats[0].threat + 3);
  });

  it("damage on a hero changes the play view and leaves the hand view", () => {
    const hand = zoneSelector("hand", 0);
    const play = zoneSelector("play", 0);
    const before = { hand: hand(kept), play: play(kept) };
    const heroId = kept.seats[0].heroes[1] ?? "";
    const hurt = { ...kept, cards: { ...kept.cards, [heroId]: { ...kept.cards[heroId]!, damage: 1 } } };
    expect(hand(hurt)).toBe(before.hand);
    expect(play(hurt)).not.toBe(before.play);
  });

  it("the play view lists heroes with the cards attached to them", () => {
    const frodo = views(kept).play.entries.find((entry) => entry.card.code === RING_BEARER);
    expect(frodo?.attached.map((card) => card.code)).toContain("141085");
  });
});

describe("table store", () => {
  it("a refused intent leaves the game object and names the reason", () => {
    const store = createTableStore({ ctx, game: kept });
    const before = store.getState().game;
    expect(store.getState().dispatch({ type: "Travel", locationId: "nowhere" })).toBe(false);
    expect(store.getState().game).toBe(before);
    expect(store.getState().refusal).toBeTruthy();
  });

  it("an accepted intent replaces the game, reports the commit and recomputes the legal list", () => {
    const committed: string[] = [];
    const commit = advance(kept, (state) => state.mode === "questCommit" && state.window?.kind === "pass");
    const store = createTableStore({ ctx, game: commit, onCommit: (intent) => committed.push(intent.type) });
    expect(store.getState().dispatch({ type: "Pass" })).toBe(true);
    expect(store.getState().game).not.toBe(commit);
    expect(committed).toEqual(["Pass"]);
    expect(store.getState().legal).toEqual(legalIntents(store.getState().game, ctx));
    expect(store.getState().roundSteps.length).toBeGreaterThan(0);
  });

  it("selecting a card computes drop targets for that card only", () => {
    const planning = advance(kept, (state) => state.mode === "planning" && legalIntents(state, ctx).some((intent) => intent.type === "PlayCard"));
    const store = createTableStore({ ctx, game: planning });
    const play = store.getState().legal.find((intent) => intent.type === "PlayCard");
    const cardId = play?.type === "PlayCard" ? play.cardId : "";
    expect(store.getState().draggable).toContain(cardId);
    store.getState().select(cardId);
    expect(store.getState().targets).toEqual(dropTargets(planning, ctx, store.getState().legal, cardId));
    expect(store.getState().targets.length).toBeGreaterThan(0);
    store.getState().select(null);
    expect(store.getState().targets).toEqual([]);
  });

  it("starts the round's steps again when a reduce crosses into a new round", () => {
    const step = { kind: "commit" as const, cardId: "x" };
    expect(nextRoundSteps([step], kept, { ...kept, round: kept.round + 1 }, [step, step])).toHaveLength(2);
    expect(nextRoundSteps([step], kept, kept, [step])).toHaveLength(2);
  });
});

describe("drops", () => {
  it("a drop on a target the card did not list moves nothing; on its target it maps to the intent or a pay sheet", () => {
    const planning = advance(kept, (state) => state.mode === "planning" && legalIntents(state, ctx).some((intent) => intent.type === "PlayCard"));
    const legal = legalIntents(planning, ctx);
    const play = legal.find((intent) => intent.type === "PlayCard");
    const cardId = play?.type === "PlayCard" ? play.cardId : "";
    expect(dropOutcome(planning, ctx, legal, cardId, { kind: "zone", zone: "staging" })).toEqual({ kind: "none" });
    const target = dropTargets(planning, ctx, legal, cardId)[0] ?? null;
    const outcome = dropOutcome(planning, ctx, legal, cardId, target);
    const printed = printedOf(ctx.cards, planning.cards[cardId]?.code ?? "");
    expect(outcome.kind).toBe((printed.cost ?? 0) > 0 ? "pay" : "intent");
  });

  it("a character dropped on the quest stage joins the commit being built, not the quest", () => {
    const commit = advance(kept, (state) => state.mode === "questCommit" && state.window?.kind === "pass");
    const legal = legalIntents(commit, ctx);
    const heroId = legalTargets(commit, { type: "Commit" }, ctx)[0] ?? "";
    expect(draggableIds(commit, ctx, legal)).toContain(heroId);
    expect(dropOutcome(commit, ctx, legal, heroId, { kind: "zone", zone: "questStage" })).toEqual({ kind: "commit", cardId: heroId });
    const store = createTableStore({ ctx, game: commit });
    store.getState().toggleCommit(heroId);
    expect(store.getState().pendingCommit).toEqual([heroId]);
    expect(store.getState().game.cards[heroId]?.committed).toBe(false);
  });

  it("a target survives its string form, and the rectangles put card targets first", () => {
    const key = targetKey({ kind: "zone", zone: "play" });
    expect(targetFromKey(key)).toEqual({ kind: "zone", zone: "play" });
    expect(targetFromKey("zone:nowhere")).toBeNull();
    const layout = tableLayout(390, 600, views(kept));
    const heroId = kept.seats[0].heroes[0] ?? "";
    const rects = dropRects(layout, [{ kind: "zone", zone: "play" }, { kind: "card", cardId: heroId }]);
    expect(rects.map((rect) => rect.target)).toEqual([`card:${heroId}`, "zone:play"]);
  });
});

describe("layout", () => {
  it("fits five cards across a phone and keeps every slot inside the canvas width", () => {
    const size = cardSize(390, 600);
    expect(size.w * 5).toBeLessThanOrEqual(390);
    const layout = tableLayout(390, 600, views(kept));
    for (const slot of layout.slots) expect(slot.x + slot.w).toBeLessThanOrEqual(390);
  });

  it("finds the topmost card under a finger", () => {
    const layout = tableLayout(390, 600, views(kept));
    const frodo = layout.slots.findIndex((slot) => slot.code === RING_BEARER);
    const slot = layout.slots[frodo];
    expect(slot).toBeDefined();
    if (!slot) return;
    expect(layout.slots[hitSlot(layout.slots, slot.x + 2, slot.y + 2)]?.code).toBe(RING_BEARER);
    expect(hitSlot(layout.slots, -10, -10)).toBe(-1);
  });
});
