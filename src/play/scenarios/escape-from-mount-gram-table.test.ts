// Rules: mec108.captured-deck, mec108.captured-cards, mec108.capture-x, mec108.create-staging-area, mec108.joining-another-player, mec108.time-x, mec108.side-quests-in-play (data/rules/entries.json); ledger lines 10038:A:1, 10038:B:1, 10039:A:1, 10039:B:2, 10053:A:1, 10053:A:3, 10174:A:2, 10175:A:1. The Campaign Log's stolen row and the deck builder's refusal are in the scenario's campaign test.
// What the table says of Escape from Mount Gram's pieces: each seat's captured deck on its dial (count and owner), the cards captured under a host drawn under it with their count and owners in its preview, each seat's separate staging area and stage, a joined seat shown joined, Loot the Dungeons in every
// area, Stop the Executioners' time, the starting threat the quest card sets, the owner named on each row of a pick that spans seats. The engine decided each; nothing here changes one. No control types damage, resources, threat, progress or life.
import { beforeAll, describe, expect, it } from "vitest";

import { legalIntents, reduce, type ReduceContext } from "../../rules/engine/reduce.ts";
import { expectOk } from "../../rules/core/test-fixture.ts";
import { settle } from "../../rules/engine/machine.ts";
import { updateCard } from "../../rules/core/state.ts";
import { moveCard, spawn } from "../../rules/core/zones.ts";
import { capturedByHost, capturedDeck } from "../../rules/families/captured/pile.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { begin } from "../../../test/scenarios/escape-from-mount-gram/begun.ts";
import { gramWorld } from "../../../test/scenarios/escape-from-mount-gram/game.ts";

import { angmarDetail } from "../cards/angmar-preview.ts";
import { slotNumbers } from "../cards/card-effects.ts";
import { marksText } from "../canvas/table-canvas-views.ts";
import { sheetFor } from "../choice/sheets.ts";
import { tiedLabel } from "../choice/sheet-parts.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";
import { angmarDials } from "../readouts/angmar.ts";
import { gramHands } from "../readouts/gram.ts";
import { seatMarks } from "../readouts/scenario-dials.ts";
import { stacksUnder, zoneIds, zoneSelector } from "../store/selectors.ts";
import { areaWords, seatTag, stagingWord } from "../words/scenarios/area.ts";

const LOOT = "10175";
const PRISON_CELL = "10046";
const EXECUTIONERS = "10053";
const DUNGEON_GUARD = "10044";
let world: Awaited<ReturnType<typeof gramWorld>>;
let ctx: ReduceContext;
beforeAll(async () => {
  world = await gramWorld("strong");
  ctx = world.ctx;
}, 120_000);

const two = (): ScenarioState => ({ ...begin(ctx, 2), sideQuests: true });
const solo = (): ScenarioState => ({ ...begin(ctx, 1), sideQuests: true });
const nameOf = (code: string) => world.cards.get(code)?.name ?? code;
const idName = (state: ScenarioState) => (id: string) => nameOf(state.cards[id]?.code ?? "");
const idOf = (state: ScenarioState, code: string, zone?: string) => Object.values(state.cards).find((card) => card.code === code && (zone == null || card.zone === zone))?.id ?? "";
const detail = (state: ScenarioState, id: string) => angmarDetail(state, ctx, id, idName(state));
const namesOf = (state: ScenarioState): SheetNames => ({ card: idName(state), line: () => null });

describe("each seat's captured deck", () => {
  it("10038:A:1 says the size of the captured deck on each seat's dial and whose it is, 'P1 ·' only with two players", () => {
    const pair = two();
    const marks = seatMarks(pair, ctx);
    expect(marks.map((mark) => mark.seat)).toEqual([0, 1]);
    for (const mark of marks) {
      const count = capturedDeck(pair, mark.seat).length;
      expect(count).toBeGreaterThan(0);
      expect(mark.label).toBe(`P${mark.seat + 1} · Captured ${String(count).padStart(2, "\u2007")}`);
      // The mark keeps its width as the count falls from 10 to 9.
      expect(mark.label).toHaveLength(`P${mark.seat + 1} · Captured 12`.length);
      expect(mark.note).toContain(`Player ${mark.seat + 1}'s captured deck holds ${count} cards, out of play.`);
    }
    const alone = solo();
    expect(seatMarks(alone, ctx)[0]?.label).toBe(`Captured ${String(capturedDeck(alone, 0).length).padStart(2, "\u2007")}`);
    expect(seatMarks(alone, ctx)[0]?.note).toContain("Your captured deck holds");
  });

  it("10038:A:1 says the starting threat the quest card set, in round 1 only, and the dial shows that number", () => {
    const state = solo();
    const hero = state.seats[0]?.heroes.map((id) => state.cards[id]).find((card) => card?.zone === "heroes");
    const cost = world.cards.get(hero?.code ?? "")?.threat;
    expect(cost).toBeTypeOf("number");
    expect(state.seats[0]?.threat).toBe(cost);
    expect(seatMarks(state, ctx)[0]?.note).toContain(`Starting threat is ${cost}, the threat cost of ${nameOf(hero?.code ?? "")}. It is not raised again when other heroes are rescued.`);
    expect(seatMarks({ ...state, round: 2 }, ctx)[0]?.note).not.toContain("Starting threat");
  });

  it("10038:A:1 says an empty captured deck is empty,", () => {
    const state = two();
    const emptied = { ...state, seats: state.seats.map((seat, index) => (index === 1 ? { ...seat, captured: [] } : seat)) } as unknown as ScenarioState;
    expect(seatMarks(emptied, ctx).find((mark) => mark.seat === 1)).toMatchObject({ label: "P2 · Captured \u20070", note: expect.stringContaining("Player 2's captured deck is empty.") });
  });

  it("shows nothing in another scenario's game", () => {
    const other = { ...two(), capture: undefined } as unknown as ScenarioState;
    expect(gramHands(other, ctx)).toEqual([]);
  });
});

describe("the cards captured under a host", () => {
  const prison = (state: ScenarioState, seat: number) => state.seats[seat]?.staging.find((id) => state.cards[id]?.code === PRISON_CELL) ?? "";

  it("10039:A:2 draws the 3 cards captured under a Prison Cell facedown under it, one counted peek, and says the count and owners in its preview", () => {
    const state = two();
    const cell = prison(state, 1);
    const held = capturedByHost(state).get(cell) ?? [];
    expect(held).toHaveLength(3);
    const entry = zoneSelector("staging", 1)(state).entries.find((one) => one.card.id === cell);
    expect(entry?.attached.map((card) => card.id)).toEqual(held);
    expect(entry?.attached.every((card) => card.face === "down")).toBe(true);
    expect(stacksUnder({ game: state })).toBe(true);
    expect(detail(state, cell)).toBe("3 cards captured underneath, out of play and facedown (3 of Player 2's). They are rescued to their owners when this leaves play.");
    expect(slotNumbers(state, ctx, cell, 1).under).toMatchObject({ text: "3 captured", loses: false, speech: "3 cards captured underneath: 3 of Player 2's" });
    // The web list says what the native reader says (the pill is only drawn on the canvas).
    expect(marksText(slotNumbers(state, ctx, cell, 1) as never)).toContain(" · 3 cards captured underneath: 3 of Player 2's");
  });

  it("10038:B:1 draws the 7 cards of stage 2A's Capture under each seat's own stage, and names the owners of a host that holds two players' cards", () => {
    const state = two();
    for (const seat of [0, 1]) {
      const stage = state.seats[seat]?.stage ?? "";
      expect(zoneSelector("questStage", seat)(state).entries.find((one) => one.card.id === stage)?.attached).toHaveLength(7);
      expect(detail(state, stage)).toContain(`7 of Player ${seat + 1}'s`);
    }
    // A host holding cards of both players says each owner once.
    const cell = prison(state, 0);
    const other = Object.values(state.cards).find((card) => card.zone === "captured" && card.owner === 1 && card.host !== cell);
    const mixed = moveCard(state, other?.id ?? "", { zone: "captured", hostId: cell, seat: 1 });
    expect(detail(mixed, cell)).toContain("(3 of Player 1's, 1 of Player 2's)");
    expect(detail(solo(), prison(solo(), 0))).toContain("(3 of yours)");
  });

  it("10039:A:2 tells a captured card what holds it and whose it is, not what it is", () => {
    const state = two();
    const cell = prison(state, 0);
    const card = capturedByHost(state).get(cell)?.[0] ?? "";
    expect(detail(state, card)).toBe("Captured, facedown under Prison Cell, out of play, Player 1's card. It is rescued when Prison Cell leaves play.");
  });

  it("10053:A:1 draws a host's captured cards in a game that holds none as nothing", () => {
    const state = two();
    const quiet = { ...state, capture: undefined } as unknown as ScenarioState;
    expect(stacksUnder({ game: quiet })).toBe(false);
    expect(capturedByHost(quiet).size).toBe(0);
  });
});

describe("the separate staging areas", () => {
  it("10038:B:1 names each seat's area and stage while the players are apart, and labels the staging row with the seat", () => {
    const state = two();
    expect(seatTag(state, 0)).toBe("P1");
    expect(stagingWord(state, 1)).toBe("P2 staging");
    const first = areaWords(state, 0, nameOf);
    const second = areaWords(state, 1, nameOf);
    expect(first).toMatch(/^Player 1's staging area · Stage .+ · \d+ cards · No active location$/);
    expect(second).toMatch(/^Player 2's staging area · Stage .+ · \d+ cards · No active location$/);
    expect(first).not.toBe(second);
    expect(areaWords(solo(), 0, nameOf)).toMatch(/^Staging area · Stage /);
  });

  it("10039:B:2 draws a joined seat's area as the area it joined, and its dial says whose area it shares", () => {
    const state = two();
    const { stage: _stage, active: _active, ...rest } = state.seats[0]!;
    const joined = { ...state, seats: [{ ...rest, staging: [], joined: 1 }, state.seats[1]] } as unknown as ScenarioState;
    expect(areaWords(joined, 0, nameOf)?.replace("Player 1's", "")).toBe(areaWords(joined, 1, nameOf)?.replace("Player 2's", ""));
    expect(zoneIds(joined, "questStage", 0)).toEqual(zoneIds(joined, "questStage", 1));
    const mark = seatMarks(joined, ctx).find((one) => one.seat === 0);
    expect(mark?.label).toBe(`P1 · Captured ${String(capturedDeck(joined, 0).length).padStart(2, "\u2007")}`);
    expect(mark?.label).not.toContain("joined");
    expect(mark?.note).toContain("Player 1's stage 2B was emptied, so Player 2's area is shared: its staging cards, its stage and its progress.");
    expect(seatMarks(joined, ctx).find((one) => one.seat === 1)?.label).not.toContain("joined");
  });
});

describe("Loot the Dungeons in every area", () => {
  it("10175:A:1 is one card that every seat's staging row draws, with the 5 cards of each captured deck under it counted by owner in its preview", () => {
    const state = two();
    const loot = idOf(state, LOOT);
    expect(zoneIds(state, "staging", 0)).toContain(loot);
    expect(zoneIds(state, "staging", 1)).toContain(loot);
    expect(state.seats[0]?.staging).not.toContain(loot);
    expect(areaWords(state, 0, nameOf)).toMatch(/cards/);
    expect(detail(state, loot)).toBe("In every player's staging area at once: one card, one set of progress. It has 12 quest points: 4, and 4 more for each of the 2 players. 10 cards captured underneath, out of play and facedown (5 of Player 1's, 5 of Player 2's). They are rescued to their owners when this leaves play.");
    const alone = detail(solo(), idOf(solo(), LOOT));
    expect(alone).toContain("It has 8 quest points: 4, and 4 more for you.");
    expect(alone).not.toContain("every");
  });
});

describe("Stop the Executioners' time", () => {
  const timed = (counters: number): { state: ScenarioState; id: string } => {
    const made = spawn(two(), EXECUTIONERS, { zone: "staging", area: 0 }, "up");
    const id = made.id;
    return { id, state: { ...made.state, cards: { ...made.state.cards, [id]: { ...made.state.cards[id]!, resources: counters } } } };
  };
  const dialOf = (state: ScenarioState) => angmarDials(state, ctx, nameOf).find((one) => one.id.startsWith("time:"));

  it("10053:A:3 says what the last time counter does for this card: the cards under it are discarded and threat rises, the game is not lost", () => {
    const { state, id } = timed(4);
    expect(dialOf(state)).toMatchObject({ value: 4, label: "Time", note: "4 time counters left. One comes off at the end of each refresh phase. With the last gone, the quest leaves the game." });
    expect(dialOf(state)?.warn).toBeUndefined();
    expect(detail(state, id)).toBe("4 time counters on it. With the last gone, the quest leaves the game.");
  });

  it("10053:A:3 warns near at 2 and at 1 and never says the players lose", () => {
    for (const counters of [2, 1]) {
      const { state } = timed(counters);
      const dial = dialOf(state);
      expect(dial?.warn?.level).toBe("near");
      expect(dial?.note).not.toContain("lose");
    }
    expect(dialOf(timed(1).state)?.warn?.words).toBe("The next refresh phase takes the last time counter: the quest leaves the game.");
    expect(dialOf(timed(2).state)?.warn?.words).toBe("2 time counters are left.");
  });
});

describe("Stop the Executioners' dial counts the characters under it by owner", () => {
  const dialOf = (state: ScenarioState) => angmarDials(state, ctx, nameOf).find((one) => one.id.startsWith("time:"));
  // Puts the executioners in play with `counters` time counters and a captured card of each (code, seat) under it.
  const held = (counters: number, cards: readonly (readonly [string, number])[], base: ScenarioState = two()): { state: ScenarioState; id: string } => {
    const made = spawn(base, EXECUTIONERS, { zone: "staging", area: 0 }, "up");
    let state: ScenarioState = { ...made.state, cards: { ...made.state.cards, [made.id]: { ...made.state.cards[made.id]!, resources: counters } } };
    for (const [code, seat] of cards) state = spawn(state, code, { zone: "captured", hostId: made.id, seat }, "down").state;
    return { state, id: made.id };
  };
  const ALLY = "10178";

  it("10053:A:3 says each owner's threat rise (3 for each character of theirs under it) and nothing of discarding while nothing lies under it", () => {
    const { state } = held(4, [[ALLY, 0], [ALLY, 0], [ALLY, 1]]);
    expect(dialOf(state)?.note).toContain("the cards under it are discarded and the quest leaves the game. Player 1's threat rises by 6, Player 2's threat rises by 3.");
    expect(dialOf(held(4, []).state)?.note).not.toContain("discarded");
  });

  it("10053:A:3 is critical and names the seat the raise eliminates, and says the game is lost only for a solo player the raise eliminates", () => {
    const two1 = held(1, [[ALLY, 1], [ALLY, 1], [ALLY, 1]]);
    const high = { ...two1.state, seats: two1.state.seats.map((seat, index) => (index === 1 ? { ...seat, threat: 42 } : seat)) } as unknown as ScenarioState;
    expect(dialOf(high)?.warn).toMatchObject({ level: "critical" });
    expect(dialOf(high)?.warn?.words).toContain("That eliminates Player 2.");
    expect(dialOf(two1.state)?.warn?.level).toBe("near");
    const alone = held(1, [[ALLY, 0], [ALLY, 0]], solo());
    expect(dialOf(alone.state)?.warn?.level).toBe("near");
    expect(dialOf(alone.state)?.warn?.words).not.toContain("game is lost");
    const doomed = { ...alone.state, seats: alone.state.seats.map((seat, index) => (index === 0 ? { ...seat, threat: 45 } : seat)) } as unknown as ScenarioState;
    expect(dialOf(doomed)?.warn?.level).toBe("critical");
    expect(dialOf(doomed)?.warn?.words).toContain("Your threat rises by 6. That eliminates you, and the game is lost.");
  });
});

describe("what a pick and a preview say apart", () => {
  it("10038:A:1 reads the round-1 starting threat from the hero the Setup recorded, not the first hero in play", () => {
    const state = two();
    const seat = state.seats[0]!;
    const start = seat.startHero ?? "";
    expect(state.cards[start]?.zone).toBe("heroes");
    const reordered = { ...state, seats: [{ ...seat, heroes: [...seat.heroes].reverse() }, state.seats[1]] } as unknown as ScenarioState;
    expect(seatMarks(reordered, ctx)[0]?.note).toContain(`the threat cost of ${nameOf(state.cards[start]?.code ?? "")}`);
  });

  it("10053:A:3 says the current-quest line as well as the captured cards under a side quest that is the current quest", () => {
    const made = spawn(two(), EXECUTIONERS, { zone: "staging", area: 0 }, "up");
    const state = spawn(made.state, "10178", { zone: "captured", hostId: made.id, seat: 0 }, "down").state;
    const flagged = { ...state, modifiers: [...state.modifiers, { instanceId: made.id, sourceId: made.id, stat: "currentQuest", amount: 1, until: "endOfPhase" }] } as ScenarioState;
    expect(detail(flagged, made.id)).toContain("captured underneath");
    expect(detail(flagged, made.id)).toContain("The current quest until the end of the phase.");
    expect(detail(state, made.id)).not.toContain("The current quest");
  });

  it("10051:A:1 tells two encounter cards of one name apart by their place and Threat in the Captives of Gornákh pick", () => {
    const state = two();
    const first = spawn(state, "10049", { zone: "staging", area: 0 }, "up");
    const second = spawn(updateCard(first.state, first.id, {}), "10049", { zone: "staging", area: 1 }, "up");
    const names = namesOf(second.state);
    const options = [first.id, second.id];
    expect(tiedLabel(second.state, ctx, names, first.id, options)).toMatch(/ · staging area · \d+ Threat$/);
    expect(tiedLabel(second.state, ctx, names, first.id, [first.id])).toBeUndefined();
  });
});

describe("a pick that spans seats names the owner on each row", () => {
  it("10044:A:2 Dungeon Guard: the rescued cards of both players, each row naming the player whose card it is", () => {
    const base = two();
    const made = spawn(base, DUNGEON_GUARD, { zone: "staging", area: 1 }, "up");
    let state = spawn(made.state, "10176", { zone: "captured", hostId: made.id, seat: 0 }, "down").state;
    state = spawn(state, "10178", { zone: "captured", hostId: made.id, seat: 1 }, "down").state;
    const gone = settle({ ...moveCard(state, made.id, { zone: "encounterDiscard" }), window: null }, ctx, []);
    const trigger = legalIntents(gone, ctx).find((intent) => intent.type === "Trigger");
    expect(trigger).toBeTruthy();
    const run = expectOk(reduce(gone, trigger!, ctx)).state;
    const sheet = sheetFor(run, ctx, legalIntents(run, ctx), namesOf(run)) as PickSheet | null;
    expect(sheet?.kind).toBe("pick");
    expect(sheet?.options.map((option) => option.label)).toEqual([`${nameOf("10176")} · Player 1's ally`, `${nameOf("10178")} · Player 2's ally`]);
  });
});
