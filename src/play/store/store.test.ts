import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../rules/core/test-fixture.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { legalIntents, legalTargets, reduce, startScenario, type ReduceContext, type ScenarioState } from "../../rules/engine/reduce.ts";
import { withThreat } from "../../rules/core/state.ts";
import { deckPlayHero, markDeckPlay } from "../../rules/player/deck-play.ts";
import { moveCard } from "../../rules/core/zones.ts";
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld } from "../../../test/scenarios/a-shadow-of-the-past/game.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { buildTable } from "../../../test/harness/scene.ts";

import { cardSize, HAND_SHOW, handCardSize, tableLayout } from "../layout/layout.ts";
import { hitSlot } from "../layout/hits.ts";
import { inspectTargets, onTableFor, pileSelector, PILES, threatSelector, zoneSelector, type PileId, type PileView, type ZoneId } from "./selectors.ts";
import { draggableIds, dropOutcome, dropRects, dropTargets, targetFromKey, targetKey } from "./selection.ts";
import { intentWords } from "./outcome.ts";
import { playSheet } from "../choice/bar-sheets.ts";
import { createTableStore, nextRoundSteps } from "./store.ts";
import { EFFECTS } from "../../effects/index.ts";
import { attachmentCtx, put as putCard, seat as seatTable } from "../../rules/families/attachments/fixture.ts";

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

function piles(game: ScenarioState): Record<PileId, PileView> {
  return Object.fromEntries(PILES.map((pile) => [pile, pileSelector(pile, 0)(game)])) as Record<PileId, PileView>;
}

// A landscape phone's table: the canvas beside the command column, under the top bar.
const WIDE = 560;
const TALL = 330;

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

  it("the play view lists heroes with the cards attached to them, and each attachment once, under its host", () => {
    const play = views(kept).play.entries;
    const frodo = play.find((entry) => entry.card.code === RING_BEARER);
    expect(frodo?.attached.map((card) => card.code)).toContain("141085");
    // The One Ring is in the seat's play list and on Frodo: it is drawn on Frodo only.
    expect(play.some((entry) => entry.card.code === "141085")).toBe(false);
    const layout = tableLayout(WIDE, TALL, views(kept), piles(kept));
    expect(layout.slots.filter((slot) => slot.code === "141085").map((slot) => slot.kind)).toEqual(["attachment"]);
  });

  it("a pile view keeps its object until its list changes, and shows the top of a discard pile", () => {
    const discard = pileSelector("discard", 0);
    const first = discard(kept);
    expect(discard(withThreat(kept, 0, 40))).toBe(first);
    const cardId = kept.seats[0].hand[0] ?? "";
    const discarded = { ...kept, seats: [{ ...kept.seats[0], discard: [...kept.seats[0].discard, cardId] }, kept.seats[1]] as const };
    expect(discard(discarded).top?.id).toBe(cardId);
    expect(pileSelector("deck", 0)(kept).top).toBeNull();
    expect(pileSelector("deck", 0)(kept).ids.length).toBe(kept.seats[0].deck.length);
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
  it("a drop on a target the card did not list moves nothing; on its target it picks the card to play, never plays it", () => {
    const planning = advance(kept, (state) => state.mode === "planning" && legalIntents(state, ctx).some((intent) => intent.type === "PlayCard"));
    const legal = legalIntents(planning, ctx);
    const play = legal.find((intent) => intent.type === "PlayCard");
    const cardId = play?.type === "PlayCard" ? play.cardId : "";
    expect(dropOutcome(planning, ctx, legal, cardId, { kind: "zone", zone: "staging" })).toEqual({ kind: "none" });
    const target = dropTargets(planning, ctx, legal, cardId)[0] ?? null;
    const outcome = dropOutcome(planning, ctx, legal, cardId, target);
    const printed = printedOf(ctx.cards, planning.cards[cardId]?.code ?? "");
    expect(outcome).toEqual({ kind: "play", cardId, hostId: printed.type === "attachment" && target?.kind === "card" ? target.cardId : null });
  });

  it("a Trap played into your play area unattached is dropped on the play area, and the drop names your area as its host (19062:A:1)", () => {
    const trapCtx = attachmentCtx(EFFECTS);
    const trap = putCard(seatTable().state, "19062", "hand");
    const legal = legalIntents(trap.state, trapCtx);
    expect(dropTargets(trap.state, trapCtx, legal, trap.id)).toEqual([{ kind: "zone", zone: "play" }]);
    expect(dropOutcome(trap.state, trapCtx, legal, trap.id, { kind: "zone", zone: "play" })).toEqual({ kind: "play", cardId: trap.id, hostId: "seat:0" });
  });

  it("a host that is not a card is named in words: the confirm sheet and the Undo banner (Sting on the staging area, a Trap in your play area)", () => {
    const sctx = attachmentCtx(EFFECTS);
    const sting = putCard(seatTable().state, "19117", "hand");
    const names = { card: (id: string) => (id === sting.id ? "Sting" : id), line: () => null };
    const legal = legalIntents(sting.state, sctx);
    expect(dropOutcome(sting.state, sctx, legal, sting.id, { kind: "zone", zone: "staging" })).toEqual({ kind: "play", cardId: sting.id, hostId: "staging" });
    expect(playSheet(sting.state, sctx, legal, names, sting.id, "staging")?.title).toBe("Attach Sting to the staging area");
    expect(intentWords({ type: "PlayCard", cardId: sting.id, payments: [], hostId: "staging" }, names.card)).toBe("Played Sting on the staging area");
    expect(intentWords({ type: "PlayCard", cardId: sting.id, payments: [], hostId: "seat:0" }, names.card)).toBe("Played Sting on Player 1");
  });

  it("a character dropped on the quest stage joins the commit being built, not the quest", () => {
    const commit = advance(kept, (state) => state.mode === "questCommit" && state.window?.kind === "pass");
    const legal = legalIntents(commit, ctx);
    const heroId = legalTargets(commit, { type: "Commit" }, ctx)[0] ?? "";
    expect(draggableIds(commit, ctx, legal)).toContain(heroId);
    expect(dropOutcome(commit, ctx, legal, heroId, { kind: "zone", zone: "questStage" })).toEqual({ kind: "commit", cardId: heroId });
    expect(commit.cards[heroId]?.committed).toBe(false);
  });

  it("a target survives its string form, and the rectangles put card targets first", () => {
    const key = targetKey({ kind: "zone", zone: "play" });
    expect(targetFromKey(key)).toEqual({ kind: "zone", zone: "play" });
    expect(targetFromKey("zone:nowhere")).toBeNull();
    const layout = tableLayout(WIDE, TALL, views(kept), piles(kept));
    const heroId = kept.seats[0].heroes[0] ?? "";
    const rects = dropRects(layout, [{ kind: "zone", zone: "play" }, { kind: "card", cardId: heroId }]);
    expect(rects.map((rect) => rect.target)).toEqual([`card:${heroId}`, "zone:play"]);
  });
});

describe("layout", () => {
  it("fits the left column and six cards across a landscape table, and keeps every slot inside the canvas width", () => {
    for (const [width, height] of [[WIDE, TALL], [470, 316], [640, 380]] as const) {
      const size = cardSize(width, height);
      expect(size.w * 7.5).toBeLessThanOrEqual(width);
      const layout = tableLayout(width, height, views(kept), piles(kept));
      for (const slot of layout.slots) expect(slot.x + slot.w, `${slot.code} at ${width}`).toBeLessThanOrEqual(width);
      // Staging, the engagement area and the play area are stacked above the hand's strip.
      expect(layout.zones.engaged.y).toBeGreaterThanOrEqual(layout.zones.staging.y + layout.zones.staging.h);
      expect(layout.zones.play.y).toBeGreaterThanOrEqual(layout.zones.engaged.y + layout.zones.engaged.h);
      // Each hand card shows at least a 44 pt target above the bottom edge, its fan drop included.
      expect(height - layout.zones.hand.y).toBe(Math.max(52, Math.round(size.h * HAND_SHOW)));
      for (const slot of layout.slots.filter((candidate) => candidate.zone === "hand")) expect(height - slot.y).toBeGreaterThanOrEqual(44);
      // Laid out above a bottom inset, the hand leaves that zone clear.
      const inset = tableLayout(width, height, views(kept), piles(kept), { bottomInset: 21 });
      for (const slot of inset.slots.filter((candidate) => candidate.zone === "hand")) expect(height - 21 - slot.y).toBeGreaterThanOrEqual(44);
    }
  });

  it("draws the four piles with their counts, and a raised hand card whole", () => {
    const layout = tableLayout(WIDE, TALL, views(kept), piles(kept));
    const counts = Object.fromEntries(layout.slots.filter((slot) => slot.kind === "pile").map((slot) => [slot.zone, slot.count]));
    expect(counts).toEqual({ deck: kept.seats[0].deck.length, discard: 0, encounterDeck: kept.encounterDeck.length, encounterDiscard: kept.encounterDiscard.length });
    const handId = kept.seats[0].hand[0] ?? "";
    const raised = tableLayout(WIDE, TALL, views(kept), piles(kept), { raised: handId }).slots.find((slot) => slot.id === handId);
    expect(raised && raised.y + raised.h).toBeLessThanOrEqual(TALL);
  });

  it("puts a declared defender beside the enemy it defends against, and out of the play area", () => {
    // An enemy engaged with the seat and attacking it, with a hero declared as its defender.
    const enemyId = kept.encounterDeck.find((id) => printedOf(ctx.cards, kept.cards[id]?.code ?? "").type === "enemy") ?? "";
    const defenderId = kept.seats[0].heroes[1] ?? "";
    const engaged = moveCard(kept, enemyId, { zone: "engaged", seat: 0 });
    const declared: ScenarioState = { ...engaged, pendingAttack: { enemyId, seat: 0, defenderId } };
    const layout = tableLayout(WIDE, TALL, views(declared), piles(declared));
    const slot = layout.slots.find((candidate) => candidate.id === defenderId && candidate.kind === "card");
    const enemy = layout.slots.find((candidate) => candidate.id === enemyId);
    expect(slot?.zone).toBe("engaged");
    expect(enemy && slot && slot.x).toBeGreaterThan(enemy?.x ?? 0);
    expect(layout.marks).toEqual([expect.objectContaining({ enemyId, kind: "defense" })]);
    expect(views(declared).play.entries.some((entry) => entry.card.id === defenderId)).toBe(false);
    expect(onTableFor(declared, 0)(defenderId)).toBe(true);
    // Once the attack is over, the defender is back in the play area.
    expect(views(engaged).play.entries.some((entry) => entry.card.id === defenderId)).toBe(true);
  });

  it("finds the topmost card under a finger", () => {
    const layout = tableLayout(WIDE, TALL, views(kept), piles(kept));
    const frodo = layout.slots.findIndex((slot) => slot.code === RING_BEARER);
    const slot = layout.slots[frodo];
    expect(slot).toBeDefined();
    if (!slot) return;
    expect(layout.slots[hitSlot(layout.slots, slot.x + 2, slot.y + 2)]?.code).toBe(RING_BEARER);
    expect(hitSlot(layout.slots, -10, -10)).toBe(-1);
  });
});

describe("touch targets", () => {
  it("keeps a 44 pt strip of each of eight hand cards across a landscape table", () => {
    const card = cardSize(WIDE, TALL);
    const width = WIDE - 16;
    const hand = handCardSize(card, width, 8);
    const step = (width - hand.w) / 7;
    expect(step).toBeGreaterThanOrEqual(44);
    expect(hand.w).toBeGreaterThanOrEqual(44);
  });

  it("a long press on a host lists the host and each card attached to it", () => {
    const frodo = kept.seats[0].heroes.find((id) => kept.cards[id]?.code === RING_BEARER) ?? "";
    const attached = kept.cards[frodo]?.attachments ?? [];
    expect(attached.length).toBeGreaterThan(0);
    expect(inspectTargets(kept, frodo)).toEqual([frodo, ...attached]);
    expect(inspectTargets(kept, attached[0] ?? "")).toEqual([frodo, ...attached]);
  });
});

describe("motion", () => {
  it("a drawn card comes off the deck, a card that stays put does not move, a discarded card goes to the discard pile", async () => {
    const { motionsBetween, still } = await import("../motion/motion.ts");
    const before = tableLayout(WIDE, TALL, views(kept), piles(kept));
    const [first = "", ...rest] = kept.seats[0].hand;
    const drawn = kept.seats[0].deck[0] ?? "";
    // The first hand card is discarded and the top of the deck drawn.
    const seat = { ...kept.seats[0], hand: [...rest, drawn], deck: kept.seats[0].deck.slice(1), discard: [first] };
    const cards = { ...kept.cards, [first]: { ...kept.cards[first]!, zone: "discard" as const }, [drawn]: { ...kept.cards[drawn]!, zone: "hand" as const } };
    const after: ScenarioState = { ...kept, seats: [seat, kept.seats[1]], cards };
    const next = tableLayout(WIDE, TALL, views(after), piles(after));
    const { motions, ghosts } = motionsBetween(before, next, (id) => after.cards[id]?.zone ?? null);
    const deck = next.piles.deck;
    const slot = next.slots.find((candidate) => candidate.id === drawn);
    const motion = motions.get(drawn);
    expect(slot && motion && slot.x + slot.w / 2 + motion.dx).toBeCloseTo(deck.x + deck.w / 2);
    const hero = kept.seats[0].heroes[0] ?? "";
    expect(still(motions.get(hero) ?? { dx: 1, dy: 0, scale: 1, fromRot: 0, toRot: 0, fromOpacity: 1, flip: false, delay: 0, arc: 0, land: null })).toBe(true);
    const ghost = ghosts.find((candidate) => candidate.slot.id === first);
    expect(ghost && ghost.slot.x + ghost.slot.w / 2 + ghost.dx).toBeCloseTo(next.piles.discard.x + next.piles.discard.w / 2);
    // The first draw of a table moves nothing.
    expect([...motionsBetween(null, next, () => null).motions.values()].every(still)).toBe(true);
  });
});

// Rules: rr.initiating-abilities-playing-cards. Gandalf (142002:A:1): "Play with the top card of your deck faceup", playable now or not.
describe("a deck played with its top card faceup", () => {
  it("stays face up as a pile, not a card to pick up, once the phase's play from it is spent", async () => {
    const base = await starterBase();
    // Two seats, Gandalf on the second: the store names that seat only.
    const tab = buildTable(base, { ring: "none", start: "planning", seats: 2, heroes: [{ code: "141002", seat: 0 }, { code: "142002", seat: 1 }], playerDeck: [{ code: "142004", seat: 1 }, { code: "01028", seat: 1 }] });
    const permission = deckPlayHero(tab.state, 1, tab.ctx);
    if (!permission) throw new Error("Gandalf is not in play");
    const spent = markDeckPlay(tab.state, permission);
    const state = createTableStore({ ctx: tab.ctx, game: spent }).getState();
    const top = spent.seats[1]?.deck[0] ?? "";
    expect(state.faceUpDecks).toEqual([1]);
    expect(state.draggable).not.toContain(top);
    const deck = tableLayout(560, 330, views(spent), piles(spent), { deckShown: spent.cards[top] }).slots.find((slot) => slot.zone === "deck");
    expect(deck).toMatchObject({ id: "pile:deck", kind: "pile", code: spent.cards[top]?.code, faceDown: false });
  });
});
