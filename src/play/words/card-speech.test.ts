import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../rules/core/test-fixture.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { legalIntents, reduce, startScenario, type ReduceContext } from "../../rules/engine/reduce.ts";
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld, STARTER_SEEDS } from "../../../test/scenarios/a-shadow-of-the-past/game.ts";

import { slotNumbers } from "../cards/card-effects.ts";
import { windowSheet } from "../choice/bar-sheets.ts";
import type { Sheet, SheetNames } from "../choice/sheet-types.ts";
import { sheetFor } from "../choice/sheets.ts";
import { choiceFor } from "../choice/table-choice.ts";
import { highlightKeys, highlightOf } from "../canvas/highlight-of.ts";
import { pictureCode } from "../canvas/picture-key.ts";
import { NO_HIGHLIGHT } from "../store/peek.ts";
import { twoHanded } from "../store/seat-fixture.ts";
import { cardSpeech, stagingThreatOf, zoneSpeech, type CardSpeechDeps } from "./card-speech.ts";

// Rules: rr.damage, rr.exhausted, rr.resources, rr.engagement-check (data/rules/entries.json). A card says its whole state in its label and what a
// tap does in the open moment in its hint, on the states of whole seeded games of A Shadow of the Past (scenario 1) with its starter deck.
let ctx: ReduceContext;
const names: SheetNames = { card: (id) => id, line: () => null };

beforeAll(async () => {
  ctx = (await starterWorld("wisdom-and-wizardry")).ctx;
});

type Moment = { state: ScenarioState; sheet: Sheet };

// Every moment of the seeded games, in play order.
function* moments(): Generator<Moment> {
  for (const seed of STARTER_SEEDS) {
    let state = startScenario(starterStart("wisdom-and-wizardry", seed), ctx);
    for (let turn = 0; turn < 600 && !state.lost && !state.stageCleared; turn += 1) {
      const legal = legalIntents(state, ctx);
      yield { state, sheet: sheetFor(state, ctx, legal, names) ?? windowSheet(state, ctx, legal, names) };
      state = expectOk(reduce(state, nextIntent(state, ctx, { scout: "01002", prefer: "141035", protect: RING_BEARER, play: true, act: true }), ctx)).state;
    }
  }
}

function find(match: (moment: Moment) => boolean): Moment {
  for (const moment of moments()) if (match(moment)) return moment;
  throw new Error("no moment of the seeded games matches");
}

function depsOf({ state, sheet }: Moment, over: Partial<CardSpeechDeps> = {}): CardSpeechDeps {
  const keys = highlightKeys({ game: state, seat: 0, sheet, choice: choiceFor(sheet, null), panel: false });
  return {
    nameOf: (key) => printedOf(ctx.cards, pictureCode(key)).name,
    inactive: () => false,
    facts: { typeOf: (code) => ctx.cards.get(code)?.type ?? null, shipRank: () => null },
    info: (game, seat, cardId) => slotNumbers(game, ctx, cardId, seat),
    highlight: highlightOf(keys),
    cards: ctx.cards,
    sheet,
    peeking: false,
    ...over,
  };
}

const nameOf = (code: string) => printedOf(ctx.cards, code).name;

describe("cardSpeech label", () => {
  it("says a hero's damage against hit points, its resources, its numbers and what is attached", () => {
    const moment = find(({ state }) => state.mode === "planning");
    const hero = moment.state.seats[0]?.heroes[0] ?? "";
    const attachment = Object.values(moment.state.cards).find((card) => ctx.cards.get(card.code)?.type === "attachment");
    expect(attachment).toBeDefined();
    const state = updateCard(updateCard(moment.state, hero, { damage: 2, resources: 3, exhausted: true, attachments: [attachment?.id ?? ""] }), attachment?.id ?? "", { zone: "attached", host: hero });
    const { label } = cardSpeech(state, 0, hero, depsOf({ ...moment, state }));
    const printed = printedOf(ctx.cards, state.cards[hero]?.code ?? "");
    expect(label).toContain(`${printed.name}, hero`);
    expect(label).toContain("exhausted");
    expect(label).toContain(`2 damage of ${printed.health} hit points`);
    expect(label).toContain("3 resources");
    expect(label).toContain(`${printed.willpower} willpower`);
    // The attachment is a button of its own after the host, which says its name; the host says how many.
    expect(label).toContain("1 attachment");
    expect(label).not.toContain(nameOf(attachment?.code ?? ""));
  });

  it("says an enemy in the staging area with its engagement cost against the threat", () => {
    const moment = find(({ state }) => state.staging.some((id) => ctx.cards.get(state.cards[id]?.code ?? "")?.type === "enemy"));
    const enemy = moment.state.staging.find((id) => ctx.cards.get(moment.state.cards[id]?.code ?? "")?.type === "enemy") ?? "";
    const deps = depsOf(moment);
    const { label } = cardSpeech(moment.state, 0, enemy, deps);
    const cost = deps.info(moment.state, 0, enemy).engagement;
    expect(cost).not.toBeNull();
    expect(label).toContain(", enemy");
    expect(label).toContain(`engagement cost ${cost?.cost}, ${cost?.engages ? "engages you" : "does not engage you"}`);
    expect(label).toContain(`${printedOf(ctx.cards, moment.state.cards[enemy]?.code ?? "").attack} attack`);
  });

  it("says a location's progress against its quest points", () => {
    const moment = find(({ state }) => state.activeLocation != null);
    const location = moment.state.activeLocation ?? "";
    const state = updateCard(moment.state, location, { progress: 2 });
    const deps = depsOf({ ...moment, state });
    const points = deps.info(state, 0, location).questPoints;
    expect(points).not.toBeNull();
    expect(cardSpeech(state, 0, location, deps).label).toContain(`2 of ${points} progress`);
  });

  it("says a committed character and the willpower it brings", () => {
    const moment = find(({ state }) => Object.values(state.cards).some((card) => card.committed));
    const card = Object.values(moment.state.cards).find((other) => other.committed);
    const deps = depsOf(moment);
    const { label } = cardSpeech(moment.state, 0, card?.id ?? "", deps);
    expect(label).toContain(`committed to the quest, ${deps.info(moment.state, 0, card?.id ?? "").willpower} willpower`);
  });

  it("says a facedown card as the web list does, naming nothing", () => {
    const moment = find(({ state }) => state.mode === "planning");
    const id = moment.state.seats[0]?.hand[0] ?? "";
    const state = updateCard(moment.state, id, { face: "down" });
    expect(cardSpeech(state, 0, id, depsOf({ ...moment, state })).label).toBe("Face down");
    const prisoner = updateCard(state, id, { prisoner: true });
    expect(cardSpeech(prisoner, 0, id, depsOf({ ...moment, state: prisoner })).label).toBe("Face down, held with the prisoner");
  });

  it("marks a card whose printed line the app does not apply", () => {
    const moment = find(({ state }) => state.mode === "planning");
    const hero = moment.state.seats[0]?.heroes[0] ?? "";
    expect(cardSpeech(moment.state, 0, hero, depsOf(moment, { inactive: () => true })).label).toContain("Not applied");
    expect(cardSpeech(moment.state, 0, hero, depsOf(moment)).label).not.toContain("Not applied");
  });

  it("names a hand card's cost", () => {
    const moment = find(({ state }) => state.mode === "planning");
    const id = moment.state.seats[0]?.hand.find((card) => (printedOf(ctx.cards, moment.state.cards[card]?.code ?? "").cost ?? 0) > 0) ?? "";
    expect(cardSpeech(moment.state, 0, id, depsOf(moment)).label).toMatch(/costs \d/);
  });

  it("says the controller only at a table of two seats", () => {
    const duo = twoHanded();
    const hero = duo.seats[1].hero;
    const sheet = windowSheet(duo.state, duo.ctx, legalIntents(duo.state, duo.ctx), names);
    const deps: CardSpeechDeps = {
      nameOf: (key) => printedOf(duo.ctx.cards, pictureCode(key)).name,
      inactive: () => false,
      facts: { typeOf: (code) => duo.ctx.cards.get(code)?.type ?? null, shipRank: () => null },
      info: (game, seat, cardId) => slotNumbers(game, duo.ctx, cardId, seat),
      highlight: NO_HIGHLIGHT,
      cards: duo.ctx.cards,
      sheet,
      peeking: true,
    };
    // Told only when the controller is not the seat the zone is listed for.
    expect(cardSpeech(duo.state, 0, hero, deps).label).toContain("controlled by player 2");
    expect(cardSpeech(duo.state, 0, duo.seats[1].engaged[0] ?? "", deps).label).toContain("engaged with player 2");
    expect(cardSpeech(duo.state, 1, hero, deps).label).not.toContain("controlled by");
    expect(cardSpeech(duo.state, 1, duo.seats[1].engaged[0] ?? "", deps).label).not.toContain("engaged with player");
    const solo = find(({ state }) => state.mode === "planning");
    expect(cardSpeech(solo.state, 0, solo.state.seats[0]?.heroes[0] ?? "", depsOf(solo)).label).not.toContain("player");
  });
});

describe("cardSpeech hint", () => {
  it("says a hand card that can be played, with its cost, and one that cannot", () => {
    const moment = find(({ state, sheet }) => state.mode === "planning" && sheet.kind === "window" && sheet.plays.length > 0 && (state.seats[0]?.hand ?? []).some((id) => !sheet.plays.includes(id)));
    if (moment.sheet.kind !== "window") throw new Error("a window");
    const deps = depsOf(moment);
    const playable = moment.sheet.plays.find((id) => moment.state.cards[id]?.zone === "hand") ?? "";
    const blocked = (moment.state.seats[0]?.hand ?? []).find((id) => !(moment.sheet.kind === "window" && moment.sheet.plays.includes(id))) ?? "";
    // The cost is in the label, not said twice.
    expect(cardSpeech(moment.state, 0, playable, deps).hint).toBe("Can be played");
    expect(cardSpeech(moment.state, 0, playable, deps).label).toMatch(/costs \d/);
    expect(cardSpeech(moment.state, 0, blocked, deps).hint).toBe("Cannot be played now, double tap to hear why");
  });

  it("says a character that can commit, its willpower being in the label", () => {
    const moment = find(({ state, sheet }) => state.mode === "questCommit" && sheet.kind === "window" && sheet.commit != null);
    if (moment.sheet.kind !== "window" || !moment.sheet.commit) throw new Error("a commit window");
    const option = moment.sheet.commit.options[0];
    const will = option?.stats?.find((stat) => stat.icon === "willpower")?.value;
    expect(will).toBeDefined();
    const said = cardSpeech(moment.state, 0, option?.id ?? "", depsOf(moment));
    expect(said.hint).toBe("Can commit");
    expect(said.label).toContain(`${will} willpower`);
  });

  it("says a defender pick with its mark", () => {
    // The seeded games have every hero worn out by the attack, so the heroes are readied and the sheet is read again.
    const worn = find(({ sheet }) => sheet.kind === "pick" && sheet.verb === "Defend with");
    const state = Object.values(worn.state.cards).reduce((game, card) => (card.zone === "heroes" ? updateCard(game, card.id, { exhausted: false }) : game), worn.state);
    const sheet = sheetFor(state, ctx, legalIntents(state, ctx), names);
    if (sheet?.kind !== "pick") throw new Error("a pick");
    const moment = { state, sheet };
    const option = sheet.options[0];
    const mark = option?.mark;
    expect(mark).toBeDefined();
    const deps = depsOf(moment);
    const tail = `takes ${mark?.value} damage${mark?.danger ? ", destroyed" : ""}`;
    expect(cardSpeech(state, 0, option?.id ?? "", deps).hint).toBe(`Pick to defend, ${tail}`);
    // Picked, the button's state says so; the hint says how to take the pick back.
    const picked = depsOf(moment, { highlight: { ...deps.highlight, picked: new Map([[option?.id ?? "", 1]]) } });
    expect(cardSpeech(state, 0, option?.id ?? "", picked).hint).toBe(`${tail}. Double tap to unpick`);
  });

  it("promises only the card shown large while peeking at the other seat", () => {
    const moment = find(({ state, sheet }) => state.mode === "planning" && sheet.kind === "window" && sheet.plays.length > 0);
    if (moment.sheet.kind !== "window") throw new Error("a window");
    const id = moment.sheet.plays[0] ?? "";
    expect(cardSpeech(moment.state, 0, id, depsOf(moment)).hint).not.toBeNull();
    expect(cardSpeech(moment.state, 0, id, depsOf(moment, { peeking: true, highlight: NO_HIGHLIGHT })).hint).toBe("Double tap to show the card");
    expect(cardSpeech(moment.state, 0, id, depsOf(moment, { peeking: true })).hint).toBe("Double tap to show the card");
  });

  it("offers the card shown large for a card the moment does not ask about", () => {
    const moment = find(({ sheet }) => sheet.kind === "pick" && sheet.verb === "Defend with");
    const idle = Object.keys(moment.state.cards).find((id) => !depsOf(moment).highlight.tappable.has(id) && moment.state.cards[id]?.zone === "staging") ?? "";
    expect(cardSpeech(moment.state, 0, idle, depsOf(moment)).hint).toBe("Double tap to show the card");
    // A facedown card shows nothing.
    const down = updateCard(moment.state, idle, { face: "down" });
    expect(cardSpeech(down, 0, idle, depsOf({ ...moment, state: down })).hint).toBeNull();
  });
});

describe("zoneSpeech", () => {
  it("says the staging area's cards and threat", () => {
    const moment = find(({ state }) => state.staging.length >= 2);
    const threat = stagingThreatOf(moment.state, 0, ctx.cards);
    expect(zoneSpeech("staging", moment.state.staging.length, 0, moment.state, threat)).toBe(`Staging area, ${moment.state.staging.length} cards, threat ${threat}`);
    expect(zoneSpeech("staging", 1, 0, moment.state, 2)).toBe("Staging area, 1 card, threat 2");
  });

  it("says who the enemies are engaged with, and whose hand and play area", () => {
    const moment = find(({ state }) => state.mode === "planning");
    expect(zoneSpeech("engaged", 2, 0, moment.state)).toBe("Engaged with you, 2 enemies");
    expect(zoneSpeech("engaged", 0, 0, moment.state)).toBe("Engaged with you, no enemies");
    expect(zoneSpeech("hand", 6, 0, moment.state)).toBe("Your hand, 6 cards");
    expect(zoneSpeech("play", 4, 0, moment.state)).toBe("Your heroes and play area, 4 cards");
    expect(zoneSpeech("activeLocation", 1, 0, moment.state)).toBe("Active location, 1 card");
    // The quest stage is one card: its heading is its name, with no count.
    expect(zoneSpeech("questStage", 1, 0, moment.state)).toBe("Quest stage");
  });

  it("names the other seat of a table of two", () => {
    const duo = twoHanded();
    expect(zoneSpeech("hand", 3, 0, duo.state)).toBe("Your hand, 3 cards");
    expect(zoneSpeech("hand", 3, 1, duo.state)).toBe("Player 2's hand, 3 cards");
    expect(zoneSpeech("engaged", 1, 1, duo.state)).toBe("Engaged with player 2, 1 enemy");
  });
});
