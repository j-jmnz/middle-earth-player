// Rules: emce.caves-deck, emce.evil-creatures-deck, emce.treasure, rr.guarded, emce.discover (data/rules/entries.json). What the table says about the Wilderland family's pieces: the piles and their words, how a card
// moves to and from them, a treasure guarded in the staging area, and Discover's beats and look strip. The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { updateCard, withMode, type ScenarioState } from "../../rules/core/state.ts";
import { moveCard, spawn } from "../../rules/core/zones.ts";
import { expectOk } from "../../rules/core/test-fixture.ts";
import { reduce } from "../../rules/engine/reduce.ts";
import { CARDS, codesOf, ctxOf, deal, marker, record, table } from "../../rules/families/wilderland/fixture.ts";
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

  it("brings a Cave placed at the active location off the Caves deck, as a Cave revealed into staging comes, and leaves other arrivals alone", () => {
    const caves = wilderlandFixture({ caves: 3 });
    const prev = layoutFor(caves);
    const cave = caves.ids.caves0 ?? "";
    const placed = layoutFor({ ...caves, state: moveCard(caves.state, cave, { zone: "activeLocation" }) });
    const motion = motionsBetween(prev, placed, () => null, { zoneWas: (id) => caves.state.cards[id]?.zone ?? null }).motions.get(cave);
    const slot = placed.slots.find((candidate) => candidate.id === cave);
    expect(slot?.zone).toBe("activeLocation");
    expect([motion?.flip, motion?.land]).toEqual([true, "pop"]);
    const deck = placed.piles.cavesDeck;
    expect(motion && slot && deck ? slot.x + slot.w / 2 + motion.dx : null).toBeCloseTo((deck?.x ?? 0) + (deck?.w ?? 0) / 2, 5);
    // A card that arrives at the active location from nowhere in particular still grows in where it lands.
    const elsewhere = motionsBetween(prev, placed, () => null, { zoneWas: () => null }).motions.get(cave);
    expect([elsewhere?.flip, elsewhere?.land]).not.toEqual([true, "pop"]);
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

  it("says who guards it in its preview, and that it is free of encounters once nothing does", () => {
    const guarded = wilderlandFixture({ treasure: "guarded" });
    expect(dungeonDetail(guarded.state, guarded.ctx, guarded.ids.treasure ?? "", name(guarded))).toBe("Guarded by troll");
    const free = wilderlandFixture({ treasure: "free" });
    expect(dungeonDetail(free.state, free.ctx, free.ids.treasure ?? "", name(free))).toBe("Free of encounters: the players claim it");
    // The guard is a card of its own: it says nothing of the treasure.
    expect(dungeonDetail(guarded.state, guarded.ctx, guarded.ids.guard ?? "", name(guarded))).toBeNull();
  });

  it("is free of encounters again once the guard has left play", () => {
    const fixture = wilderlandFixture({ treasure: "guarded" });
    const treasure = fixture.ids.treasure ?? "";
    const gone = updateCard(moveCard(fixture.state, fixture.ids.guard ?? "", { zone: "encounterDiscard" }), treasure, { attachments: [] });
    expect(dungeonDetail(gone, fixture.ctx, treasure, name(fixture))).toBe("Free of encounters: the players claim it");
  });

  it("is heard as guarded, or free of encounters, and only in the staging area", () => {
    const guarded = wilderlandFixture({ treasure: "guarded" });
    expect(treasureSpeech(guarded.state, guarded.ids.treasure ?? "", name(guarded))).toBe("guarded by troll");
    const free = wilderlandFixture({ treasure: "free" });
    expect(treasureSpeech(free.state, free.ids.treasure ?? "", name(free))).toBe("free of encounters");
    const held = moveCard(free.state, free.ids.treasure ?? "", { zone: "discard", seat: 0 });
    expect(treasureSpeech(held, free.ids.treasure ?? "", name(free))).toBeNull();
    expect(treasureSpeech(free.state, "nobody", name(free))).toBeNull();
  });
});

describe("Discover on the table (emce.discover)", () => {
  const facts = { location: { id: "hill", name: "Plain Hill" }, looked: 3, loot: { id: "key", name: "Crypt Key" }, hazard: { id: "bad", name: "Rockfall", staged: true }, rest: ["orc"] };

  it("tells the keyword as a beat for the look, one for each result and one for the rest, ringing the cards each names", () => {
    expect(discoverTitle(3)).toBe("Discover 3");
    expect(discoverLines(facts)).toEqual([
      { text: "Plain Hill: looked at the top 3 cards of the encounter deck", cards: ["hill"] },
      { text: "Crypt Key is attached to Plain Hill as a guarded objective", cards: ["key"] },
      { text: "Rockfall is revealed and added to the staging area", cards: ["bad"] },
      // The last line lays the strip and rings the Loot objective and the staged Hazard, which stand above the veil.
      { text: "1 card is placed in the encounter discard pile", cards: ["look:orc", "key", "bad"] },
    ]);
    // A treachery is resolved and discarded: "revealed", with no ring and not among the cards above the veil.
    expect(discoverLines({ ...facts, hazard: { id: "bad", name: "Rockfall", staged: false } })).toEqual([
      { text: "Plain Hill: looked at the top 3 cards of the encounter deck", cards: ["hill"] },
      { text: "Crypt Key is attached to Plain Hill as a guarded objective", cards: ["key"] },
      { text: "Rockfall is revealed", cards: [] },
      { text: "1 card is placed in the encounter discard pile", cards: ["look:orc", "key"] },
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
    // The state holds none of the cards, so the Hazard is not in the staging area: it reads as a revealed treachery.
    expect(moment?.lines.map((line) => line.text)).toEqual([
      "Plain Hill: looked at the top 4 cards of the encounter deck",
      "Crypt Key is attached to Plain Hill as a guarded objective",
      "Rockfall is revealed",
      "2 cards are placed in the encounter discard pile",
    ]);
    expect(moment?.lines.at(-1)?.cards).toEqual(["look:mist", "look:orc", "key"]);
    const lines = logLines([step], { card: names.card, code: (code) => code, effectCard: () => null, rule: (rule) => rule, line: () => null });
    expect(lines[0]?.text).toBe("Discover at Plain Hill: looked at 4 cards, attached Crypt Key, revealed Rockfall");
  });
});

// The real path: Travel to a location with Discover, which the banner tells in one moment (rules/families/wilderland/discover.test.ts builds the same table).
describe("the banner of a Travel to a Discover location", () => {
  const LOOT = [marker("loot1", { verb: "Loot" }), marker("loot2", { verb: "Loot" })];
  const discover = (amount: number) => record("plain:forced:1", "plain", "forced", [{ verb: "Discover", amount }], { trigger: "becameActive", subject: "self" });

  function travelled(deck: readonly string[], amount = 3): { before: ScenarioState; after: ScenarioState; steps: readonly EngineStep[] } {
    const hill = spawn(table(), "plain", { zone: "staging" });
    const dealt = deal(hill.state, deck, { zone: "encounterDeck" });
    const before = { ...withMode(dealt.state, "travel"), boundaryPhase: "Travel" as const, window: { kind: "travel" as const } };
    const result = expectOk(reduce(before, { type: "Travel", locationId: hill.id }, ctxOf([...LOOT, discover(amount)])));
    return { before, after: result.state, steps: result.steps.flat() };
  }
  const names = (state: ScenarioState) => ({ card: (id: string) => CARDS.get(state.cards[id]?.code ?? "")?.name ?? id });

  it("tells the Discover lines together, uncut and last, once, and ends on the line that lays the look strip", () => {
    const { before, after, steps } = travelled(["mist", "loot1", "stalker", "orc"]);
    const moment = momentOf(before, after, steps, names(after));
    expect(moment?.title).toBe("Traveled to Plain Hill");
    const texts = moment?.lines.map((line) => line.text) ?? [];
    expect(texts).toEqual([
      "It is the active location now",
      "Discover 3",
      "Plain Hill: looked at the top 3 cards of the encounter deck",
      "Crypt Key is attached to Plain Hill as a guarded objective",
      "Crypt Stalker is revealed and added to the staging area",
      "1 card is placed in the encounter discard pile",
    ]);
    // The Hazard's own reveal is told in Discover's lines, once.
    expect(texts.some((text) => text.startsWith("Revealed"))).toBe(false);
    const last = moment?.lines.at(-1);
    const discarded = codesOf(after, after.encounterDiscard);
    expect(discarded).toEqual(["mist"]);
    expect(lookIdsOf(new Set(last?.cards))).toEqual(after.encounterDiscard);
    // The Loot objective and the Hazard are ringed on that line too, above the strip's veil.
    const staged = codesOf(after, after.staging);
    expect(staged.sort()).toEqual(["loot1", "stalker"]);
    expect(last?.cards).toEqual(expect.arrayContaining([...after.staging]));
    // Nothing was cut.
    expect(texts.some((text) => text.startsWith("And "))).toBe(false);
  });

  it("shows the strip under reduced motion, which rings only the last line's cards, and holds it on the last beat", () => {
    const { before, after, steps } = travelled(["mist", "loot1", "stalker", "orc"]);
    const moment = momentOf(before, after, steps, names(after));
    // Reduced motion shows every line at once and rings the last one's cards (readouts/moment-banner.tsx).
    const rung = moment?.lines[(moment?.lines.length ?? 1) - 1]?.cards ?? [];
    expect(lookIdsOf(new Set(rung))).toEqual(after.encounterDiscard);
    // Every earlier line leaves the strip out, so it shows on the last beat alone.
    expect(moment?.lines.slice(0, -1).every((line) => lookIdsOf(new Set(line.cards)).length === 0)).toBe(true);
  });

  it("says a Hazard treachery is revealed, without a ring or the staging area, and still ends on the strip", () => {
    const { before, after, steps } = travelled(["hazard", "orc", "mist"], 2);
    const moment = momentOf(before, after, steps, names(after));
    const texts = moment?.lines.map((line) => line.text) ?? [];
    expect(texts).toContain("Rockfall is revealed");
    expect(texts.some((text) => text.includes("added to the staging area"))).toBe(false);
    const hazard = moment?.lines.find((line) => line.text === "Rockfall is revealed");
    expect(hazard?.cards).toBeUndefined();
    const last = moment?.lines.at(-1);
    expect(lookIdsOf(new Set(last?.cards))).toEqual(after.encounterDiscard.filter((id) => after.cards[id]?.code === "orc"));
    expect(last?.cards?.some((id) => after.cards[id]?.code === "hazard")).toBe(false);
  });
});
