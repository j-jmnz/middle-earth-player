import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../rules/core/test-fixture.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { legalIntents, reduce, startScenario, type ReduceContext } from "../../rules/engine/reduce.ts";
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld, STARTER_SEEDS } from "../../../test/scenarios/a-shadow-of-the-past/game.ts";

import { windowSheet } from "../choice/bar-sheets.ts";
import type { SheetNames } from "../choice/sheet-types.ts";
import { pictureCode } from "./picture-key.ts";
import { stagingThreatOf, zoneSpeech } from "../words/card-speech.ts";
import { READER_ZONES, readerRows, type ReaderItem, type ReaderRowsDeps, type ReaderSection } from "./reader-table-rows.ts";

// Rules: rr.staging-area (data/rules/entries.json). The reader table lists the board in a fixed order, on the states of seeded games of A Shadow of the Past
// (scenario 1) with its starter deck.
let ctx: ReduceContext;
const names: SheetNames = { card: (id) => id, line: () => null };

beforeAll(async () => {
  ctx = (await starterWorld("wisdom-and-wizardry")).ctx;
});

function* states(): Generator<ScenarioState> {
  for (const seed of STARTER_SEEDS) {
    let state = startScenario(starterStart("wisdom-and-wizardry", seed), ctx);
    for (let turn = 0; turn < 600 && !state.lost && !state.stageCleared; turn += 1) {
      yield state;
      state = expectOk(reduce(state, nextIntent(state, ctx, { scout: "01002", prefer: "141035", protect: RING_BEARER, play: true, act: true }), ctx)).state;
    }
  }
}

function find(match: (state: ScenarioState) => boolean): ScenarioState {
  for (const state of states()) if (match(state)) return state;
  throw new Error("no state of the seeded games matches");
}

const depsOf = (over: Partial<ReaderRowsDeps> = {}): ReaderRowsDeps => ({
  facts: { typeOf: (code) => ctx.cards.get(code)?.type ?? null, shipRank: () => null },
  cards: ctx.cards,
  nameOf: (key) => printedOf(ctx.cards, pictureCode(key)).name,
  playable: new Set(),
  discover: 0,
  ...over,
});

const section = (rows: readonly ReaderSection[], key: string): ReaderSection => {
  const found = rows.find((row) => row.key === key);
  if (!found) throw new Error(`no section ${key}`);
  return found;
};
const cardIds = (row: ReaderSection): string[] => row.items.flatMap((item: ReaderItem) => (item.kind === "card" ? [item.id] : []));

describe("readerRows order", () => {
  it("lists the quest and the active location, staging, engaged, play, the hand and the piles, in that order", () => {
    const state = find((game) => game.mode === "planning" && game.staging.length > 0 && game.activeLocation != null && game.seats[0]?.hand.length !== 0);
    const rows = readerRows(state, 0, depsOf());
    expect(rows.map((row) => row.key)).toEqual(["questStage", "activeLocation", "staging", "engaged", "play", "hand", "piles"]);
    expect(READER_ZONES).toEqual(["questStage", "activeLocation", "secondActiveLocation", "staging", "engaged", "play", "hand"]);
  });

  it("puts each zone's cards under its heading, as the zone selectors give them", () => {
    const state = find((game) => game.mode === "planning" && game.staging.length > 0 && game.activeLocation != null);
    const rows = readerRows(state, 0, depsOf());
    expect(cardIds(section(rows, "questStage"))).toEqual([state.questStage]);
    expect(cardIds(section(rows, "activeLocation"))).toEqual([state.activeLocation]);
    expect(cardIds(section(rows, "staging"))).toEqual(expect.arrayContaining([...state.staging]));
    expect(cardIds(section(rows, "hand"))).toEqual([...(state.seats[0]?.hand ?? [])]);
    expect(cardIds(section(rows, "play"))).toEqual(expect.arrayContaining([...(state.seats[0]?.heroes ?? [])]));
  });

  it("says each heading with zoneSpeech, the staging area's with its threat", () => {
    const state = find((game) => game.mode === "planning" && game.staging.length >= 2);
    const rows = readerRows(state, 0, depsOf());
    const staging = section(rows, "staging");
    expect(staging.heading).toBe(zoneSpeech("staging", staging.items.length, 0, state, stagingThreatOf(state, 0, ctx.cards)));
    expect(staging.heading).toMatch(/^Staging area, \d+ cards, threat \d+$/);
    expect(section(rows, "hand").heading).toBe(`Your hand, ${state.seats[0]?.hand.length} cards`);
  });

  it("keeps staging, engaged and the hand when they are empty, and leaves out a quest stage or location that is not there", () => {
    const state = find((game) => game.mode === "planning" && (game.seats[0]?.engaged.length ?? 0) === 0);
    const [first, second] = state.seats;
    const bare: ScenarioState = { ...state, staging: [], activeLocation: null, seats: [{ ...first, hand: [] }, second] };
    const rows = readerRows(bare, 0, depsOf());
    expect(section(rows, "engaged").heading).toBe("Engaged with you, no enemies");
    expect(section(rows, "hand").heading).toBe("Your hand, no cards");
    expect(rows.map((row) => row.key)).not.toContain("secondActiveLocation");
  });

  it("follows an enemy by the cards attached to it, and lists a card once", () => {
    const state = find((game) => game.mode === "planning" && game.staging.length > 0);
    const enemy = state.staging[0] ?? "";
    const attachment = Object.values(state.cards).find((card) => ctx.cards.get(card.code)?.type === "attachment" && card.zone !== "attached");
    const dressed = updateCard(updateCard(state, enemy, { attachments: [attachment?.id ?? ""] }), attachment?.id ?? "", { zone: "attached", host: enemy });
    const ids = cardIds(section(readerRows(dressed, 0, depsOf()), "staging"));
    expect(ids.indexOf(attachment?.id ?? "")).toBe(ids.indexOf(enemy) + 1);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("readerRows piles", () => {
  it("lists the deck, the discard pile and the encounter piles last, each with a tap id the canvas uses", () => {
    const state = find((game) => game.mode === "planning");
    const piles = section(readerRows(state, 0, depsOf()), "piles");
    expect(piles.heading).toBe("Piles");
    const ids = piles.items.flatMap((item) => (item.kind === "pile" ? [item.id] : []));
    expect(ids).toEqual(expect.arrayContaining(["pile:deck", "pile:discard", "pile:encounterDeck", "pile:encounterDiscard"]));
    const deck = piles.items.find((item) => item.kind === "pile" && item.id === "pile:deck");
    expect(deck).toMatchObject({ label: `Deck, ${state.seats[0]?.deck.length} cards`, opens: false });
    const discard = piles.items.find((item) => item.kind === "pile" && item.id === "pile:discard");
    expect(discard).toMatchObject({ opens: true, hint: "Opens the list of cards" });
  });

  it("says a discard pile that holds a playable card", () => {
    const state = find((game) => game.mode === "planning");
    const piles = section(readerRows(state, 0, depsOf({ playable: new Set(["pile:discard"]) })), "piles");
    const discard = piles.items.find((item) => item.kind === "pile" && item.id === "pile:discard");
    expect(discard && discard.kind === "pile" ? discard.label : "").toContain("a card playable now");
  });

  it("adds the victory display only once it holds a card", () => {
    const state = find((game) => game.mode === "planning");
    const none = section(readerRows(state, 0, depsOf()), "piles").items.map((item) => (item.kind === "pile" ? item.id : ""));
    expect(none).not.toContain("pile:victory");
    const withCard: ScenarioState = { ...state, victory: [state.staging[0] ?? Object.keys(state.cards)[0] ?? ""] };
    const shown = section(readerRows(withCard, 0, depsOf()), "piles").items.map((item) => (item.kind === "pile" ? item.id : ""));
    expect(shown.at(-1)).toBe("pile:victory");
  });
});

describe("readerRows with a window", () => {
  it("lists every card the window lets be played, in the hand section", () => {
    const state = find((game) => game.mode === "planning" && legalIntents(game, ctx).some((intent) => intent.type === "PlayCard"));
    const sheet = windowSheet(state, ctx, legalIntents(state, ctx), names);
    const listed = new Set(cardIds(section(readerRows(state, 0, depsOf()), "hand")));
    for (const id of sheet.plays) if (state.cards[id]?.zone === "hand") expect(listed.has(id)).toBe(true);
  });
});

describe("readerRows speech", () => {
  it("separates a pile's words with commas, never a middle dot, which a reader says aloud", () => {
    const state = find((game) => game.mode === "planning" && game.encounterDiscard.length > 0);
    const piles = section(readerRows(state, 0, depsOf()), "piles");
    const labels = piles.items.flatMap((item) => (item.kind === "pile" ? [item.label] : []));
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(label).not.toContain("·");
  });
});
