// Rules: emce.caves-deck, emce.evil-creatures-deck, emce.treasure, rr.guarded, emce.discover (data/rules/entries.json). What the table says about the Wilderland family's pieces: the piles and their words, how a card
// moves to and from them, a treasure guarded in the staging area, and Discover's beats and look strip. The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { moveCard } from "../../rules/core/zones.ts";
import type { EngineStep } from "../../rules/core/intents.ts";

import { dungeonDetail, treasureSpeech } from "../cards/dungeon-preview.ts";
import { tableLayout } from "../layout/layout.ts";
import { motionsBetween } from "../motion/motion.ts";
import { pileSpeech } from "../canvas/pile-speech.ts";
import { logLines } from "../store/log.ts";
import { momentOf } from "../store/outcome.ts";
import { beatIds, setBeat, createBeats } from "../store/beat-store.ts";
import { isDiscardPile, opensList, PILE_WORDS, pileIds, pileSelector, secondPilesOf } from "../store/selectors.ts";
import { wilderlandFixture, wilderlandViews } from "../store/wilderland-fixture.ts";
import { seaFixture } from "../dream-chaser/sea-fixture.ts";
import { discoverLines, discoverLogLine, discoverTitle, lookBeat, lookIdsOf, lookStripWords } from "../words/wilderland.ts";
import { pileCountWords, secondSlotLine } from "../words/sea.ts";

describe("the Wilderland piles in selectors", () => {
  it("has the Evil Creatures pair once the game has dealt that deck, and the Caves deck alone once it has dealt that", () => {
    expect(secondPilesOf(wilderlandFixture({ staging: 1 }).state)).toEqual([]);
    expect(secondPilesOf(wilderlandFixture({ evilDeck: 3 }).state)).toEqual(["evilCreaturesDeck", "evilCreaturesDiscard"]);
    expect(secondPilesOf(wilderlandFixture({ caves: 4 }).state)).toEqual(["cavesDeck"]);
    // A dealt deck that is empty is still dealt.
    expect(secondPilesOf(wilderlandFixture({ caves: 0 }).state)).toEqual(["cavesDeck"]);
  });

  it("leaves the Dream-chaser box's piles as they were", () => {
    expect(secondPilesOf(seaFixture({ corsairDeck: 2, corsairDiscard: 1 }).state)).toEqual(["corsairDeck", "corsairDiscard"]);
    expect(secondPilesOf(seaFixture({}).state)).toEqual([]);
  });

  it("names each pile, and only the Evil Creatures discard pile opens a list", () => {
    expect(PILE_WORDS.evilCreaturesDeck).toBe("Evil Creatures deck");
    expect(PILE_WORDS.evilCreaturesDiscard).toBe("Evil Creatures discard pile");
    expect(PILE_WORDS.cavesDeck).toBe("Caves deck");
    expect(isDiscardPile("evilCreaturesDiscard")).toBe(true);
    expect(opensList("evilCreaturesDiscard")).toBe(true);
    expect(opensList("evilCreaturesDeck")).toBe(false);
    expect(opensList("cavesDeck")).toBe(false);
  });

  it("shows each pile's cards, the discard pile's top the last put there, and the same piles to either seat", () => {
    const fixture = wilderlandFixture({ seatCount: 2, evilDeck: 3, evilDiscard: 2, caves: undefined });
    expect(pileIds(fixture.state, "evilCreaturesDeck", 0)).toHaveLength(3);
    const discard = pileSelector("evilCreaturesDiscard", 0)(fixture.state);
    expect(discard.ids).toHaveLength(2);
    expect(discard.top?.id).toBe(fixture.ids.evilDiscard1);
    expect(pileSelector("evilCreaturesDeck", 0)(fixture.state).top).toBeNull();
    for (const pile of ["evilCreaturesDeck", "evilCreaturesDiscard"] as const) expect(pileSelector(pile, 1)(fixture.state).ids).toBe(pileSelector(pile, 0)(fixture.state).ids);
    const caves = wilderlandFixture({ caves: 5 });
    expect(pileSelector("cavesDeck", 0)(caves.state).ids).toHaveLength(5);
    expect(pileSelector("cavesDeck", 0)(caves.state).top).toBeNull();
  });

  it("returns the same view while the pile is the same object", () => {
    const fixture = wilderlandFixture({ evilDeck: 2 });
    const select = pileSelector("evilCreaturesDeck", 0);
    const first = select(fixture.state);
    expect(select({ ...fixture.state })).toBe(first);
  });
});

describe("what a reader hears of the Wilderland piles", () => {
  it("says the count with the pile's name, and the hint of a discard pile only", () => {
    expect(pileSpeech({ zone: "evilCreaturesDeck", count: 5 })).toEqual({ label: "Evil Creatures deck, 5 cards", hint: null });
    expect(pileSpeech({ zone: "evilCreaturesDiscard", count: 1 })).toEqual({ label: "Evil Creatures discard pile, 1 card", hint: "Opens the list of cards" });
    expect(pileSpeech({ zone: "cavesDeck", count: 6 })).toEqual({ label: "Caves deck, 6 cards", hint: null });
  });

  it("names the whole slot in the web list on one line", () => {
    const fixture = wilderlandFixture({ evilDeck: 5, evilDiscard: 2 });
    const pair = secondPilesOf(fixture.state).map((pile) => ({ name: PILE_WORDS[pile], count: pileIds(fixture.state, pile, 0).length }));
    expect(secondSlotLine(pair)).toContain("Evil Creatures deck");
    expect(secondSlotLine(pair)).toContain("Evil Creatures discard pile");
    expect(pileCountWords(PILE_WORDS.cavesDeck, 6)).toBe("Caves deck, 6 cards");
  });
});

describe("how a card moves to and from the Wilderland piles", () => {
  const screen = { width: 591, height: 338 };
  const layoutFor = (fixture: ReturnType<typeof wilderlandFixture>) => {
    const { views, piles } = wilderlandViews(fixture);
    return tableLayout(screen.width, screen.height, views, piles, {});
  };

  it("brings a revealed Evil Creature off the Evil Creatures deck, and a revealed Cave off the Caves deck, as a reveal does and 90 ms apart", () => {
    const before = wilderlandFixture({ evilDeck: 4, staging: 1 });
    const prev = layoutFor(before);
    const next = layoutFor({ ...before, state: moveCard(before.state, before.ids.evilDeck0 ?? "", { zone: "staging" }) });
    const where = (id: string) => before.state.cards[id]?.zone ?? null;
    const { motions } = motionsBetween(prev, next, () => null, { zoneWas: where });
    const revealed = motions.get(before.ids.evilDeck0 ?? "");
    const deck = prev.piles.evilCreaturesDeck;
    expect(revealed?.flip).toBe(true);
    expect(revealed?.land).toBe("pop");
    // It starts at the Evil Creatures deck, not the encounter deck.
    const slot = next.slots.find((candidate) => candidate.id === before.ids.evilDeck0);
    expect(revealed && slot && deck ? slot.x + slot.w / 2 + revealed.dx : null).toBeCloseTo((next.piles.evilCreaturesDeck?.x ?? 0) + (deck?.w ?? 0) / 2, 5);
    expect(deck).toBeDefined();
    const caves = wilderlandFixture({ caves: 3, staging: 1 });
    const cavesNext = layoutFor({ ...caves, state: moveCard(caves.state, caves.ids.caves0 ?? "", { zone: "staging" }) });
    const cavesMotion = motionsBetween(layoutFor(caves), cavesNext, () => null, { zoneWas: (id) => caves.state.cards[id]?.zone ?? null }).motions.get(caves.ids.caves0 ?? "");
    const cavesSlot = cavesNext.slots.find((candidate) => candidate.id === caves.ids.caves0);
    expect(cavesMotion && cavesSlot ? cavesSlot.x + cavesSlot.w / 2 + cavesMotion.dx : null).toBeCloseTo((cavesNext.piles.cavesDeck?.x ?? 0) + (cavesNext.piles.cavesDeck?.w ?? 0) / 2, 5);
  });

  it("sends an Evil Creature that leaves play to its own discard pile, shaking on the way", () => {
    const fixture = wilderlandFixture({ evilDeck: 2, engaged: 0, staging: 1 });
    const staged = fixture.state.staging[0] ?? "";
    const prev = layoutFor(fixture);
    const gone = updateCard(moveCard(fixture.state, staged, { zone: "evilCreaturesDiscard" }), staged, { face: "up" });
    const next = layoutFor({ ...fixture, state: gone });
    const ghost = motionsBetween(prev, next, (id) => (id === staged ? "evilCreaturesDiscard" : null)).ghosts.find((candidate) => candidate.slot.id === staged);
    const slot = prev.slots.find((candidate) => candidate.id === staged);
    const pile = next.piles.evilCreaturesDiscard;
    expect(ghost?.leave).toBe("shake");
    expect(ghost && slot && pile ? slot.x + slot.w / 2 + ghost.dx : null).toBeCloseTo((pile?.x ?? 0) + (pile?.w ?? 0) / 2, 5);
  });

  it("glides the discard pile's cards to the deck when it is shuffled back into an empty deck", () => {
    const fixture = wilderlandFixture({ evilDeck: 0, evilDiscard: 3 });
    const shuffled = {
      ...fixture.state,
      piles: { ...fixture.state.piles, evilCreaturesDeck: fixture.state.piles?.evilCreaturesDiscard ?? [], evilCreaturesDiscard: [] },
    };
    const prev = layoutFor(fixture);
    const next = layoutFor({ ...fixture, state: shuffled });
    const { ghosts } = motionsBetween(prev, next, () => null);
    const glide = ghosts.find((ghost) => ghost.slot.id === "pile:evilCreaturesDiscard");
    expect(glide?.leave).toBe("glide");
    expect(next.slots.find((slot) => slot.id === "pile:evilCreaturesDeck")?.count).toBe(3);
  });
});

describe("a treasure guarded in the staging area", () => {
  const name = (fixture: ReturnType<typeof wilderlandFixture>) => (id: string) => fixture.cards.get(fixture.state.cards[id]?.code ?? id)?.name ?? id;

  it("says who guards it in its preview, and that it is free to claim once nothing does", () => {
    const guarded = wilderlandFixture({ treasure: "guarded" });
    expect(dungeonDetail(guarded.state, guarded.ctx, guarded.ids.treasure ?? "", name(guarded))).toBe("Guarded by troll");
    const free = wilderlandFixture({ treasure: "free" });
    expect(dungeonDetail(free.state, free.ctx, free.ids.treasure ?? "", name(free))).toBe("Free of encounters: you can claim it");
    // The guard is a card of its own: it says nothing of the treasure.
    expect(dungeonDetail(guarded.state, guarded.ctx, guarded.ids.guard ?? "", name(guarded))).toBeNull();
  });

  it("is free to claim again once the guard has left play", () => {
    const fixture = wilderlandFixture({ treasure: "guarded" });
    const treasure = fixture.ids.treasure ?? "";
    const gone = updateCard(moveCard(fixture.state, fixture.ids.guard ?? "", { zone: "encounterDiscard" }), treasure, { attachments: [] });
    expect(dungeonDetail(gone, fixture.ctx, treasure, name(fixture))).toBe("Free of encounters: you can claim it");
  });

  it("is heard as guarded, or free of encounters, and only in the staging area", () => {
    const guarded = wilderlandFixture({ treasure: "guarded" });
    expect(treasureSpeech(guarded.state, guarded.ids.treasure ?? "", name(guarded))).toBe("guarded by troll");
    const free = wilderlandFixture({ treasure: "free" });
    expect(treasureSpeech(free.state, free.ids.treasure ?? "", name(free))).toBe("free of encounters, the players can claim it");
    const held = moveCard(free.state, free.ids.treasure ?? "", { zone: "discard", seat: 0 });
    expect(treasureSpeech(held, free.ids.treasure ?? "", name(free))).toBeNull();
    expect(treasureSpeech(free.state, "nobody", name(free))).toBeNull();
  });
});

describe("Discover on the table (emce.discover)", () => {
  const facts = { location: { id: "hill", name: "Plain Hill" }, looked: 3, loot: { id: "key", name: "Crypt Key" }, hazard: { id: "bad", name: "Rockfall" }, rest: ["orc"] };

  it("tells the keyword as a beat for the look, one for each result and one for the rest, ringing the cards each names", () => {
    expect(discoverTitle(3)).toBe("Discover 3");
    expect(discoverLines(facts)).toEqual([
      { text: "Plain Hill: looked at the top 3 cards of the encounter deck", cards: ["hill"] },
      { text: "Crypt Key is attached to Plain Hill as a guarded objective", cards: ["key"] },
      { text: "Rockfall is revealed and added to the staging area", cards: ["bad"] },
      { text: "1 card is placed in the encounter discard pile", cards: ["look:orc"] },
    ]);
    expect(discoverLines({ ...facts, rest: ["a", "b"] }).at(-1)?.text).toBe("2 cards are placed in the encounter discard pile");
    expect(discoverLines({ ...facts, loot: null, hazard: null, rest: [] })).toEqual([
      { text: "Plain Hill: looked at the top 3 cards of the encounter deck", cards: ["hill"] },
      { text: "No Loot objective or Hazard card was among them", cards: [] },
    ]);
  });

  it("tells the cards for the look strip apart from the cards a beat rings", () => {
    const beats = createBeats();
    setBeat(beats, ["hill", ...lookBeat(["a", "b"])]);
    const beat = beatIds(beats.getState().key);
    expect(lookIdsOf(beat)).toEqual(["a", "b"]);
    expect(lookIdsOf(beatIds(""))).toEqual([]);
    expect(lookStripWords(2)).toBe("Discover look, 2 cards placed in the encounter discard pile");
  });

  it("is a line of the log and a banner of its own", () => {
    expect(discoverLogLine({ location: "Plain Hill", looked: 3, loot: "Crypt Key", hazard: null })).toBe("Discover at Plain Hill: looked at 3 cards, attached Crypt Key");
    const step: EngineStep = { kind: "discover", locationId: "hill", looked: ["mist", "key", "bad", "orc"], loot: "key", hazard: "bad", cause: { rule: "emce.discover" } };
    const names = { card: (id: string) => ({ hill: "Plain Hill", key: "Crypt Key", bad: "Rockfall", mist: "Mist", orc: "Orc" })[id] ?? id };
    const fixture = wilderlandFixture();
    const moment = momentOf(fixture.state, fixture.state, [step], names);
    expect(moment?.title).toBe("Discover 4");
    expect(moment?.lines.map((line) => line.text)).toEqual([
      "Plain Hill: looked at the top 4 cards of the encounter deck",
      "Crypt Key is attached to Plain Hill as a guarded objective",
      "Rockfall is revealed and added to the staging area",
      "2 cards are placed in the encounter discard pile",
    ]);
    expect(moment?.lines.at(-1)?.cards).toEqual(["look:mist", "look:orc"]);
    const lines = logLines([step], { card: names.card, code: (code) => code, effectCard: () => null, rule: (rule) => rule, line: () => null });
    expect(lines[0]?.text).toBe("Discover at Plain Hill: looked at 4 cards, attached Crypt Key, revealed Rockfall");
  });
});
