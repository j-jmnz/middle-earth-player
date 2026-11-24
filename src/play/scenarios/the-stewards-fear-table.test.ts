// Rules: ats.underworld, ats.underworld-example, ats.setup-the-stewards-fear-underworld-deck, rr.in-play-and-out-of-play, rr.running-out-of-cards, rr.quest-advancement (data/rules/entries.json); ledger lines 06011:A:1, 06011:B:3, 06012:B:3, 06013:A:1, 06013:B:1, 06013:B:2, 06018:A:1, 06019:A:1, 06020:A:1, 06021:A:1, 06022:A:1, 06029:A:1, 06030:A:1, 06030:A:2, 06031:A:1.
// What the table says for The Steward's Fear: the underworld deck's count and its end at stage 3B, the facedown cards under an Underworld location (a counted peek, a pill, a preview line and the Underworld X chip, never a face), the hidden Villain and Plot (counted
// in the Set aside list, never named, in no step either), the Clue tokens against the 4 that advance stages 1 and 2, Up in Flames' tokens and its loss warning, and the lines of the two other Plots. Each hook is empty in another scenario; the last tests prove it.
// The engine decided each number; nothing here changes one.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../rules/core/intents.ts";
import { expectOk } from "../../rules/core/test-fixture.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { reduce, startScenario, type PlayerIntent } from "../../rules/engine/reduce.ts";
import { idOf, tableFromLayout } from "../../../test/harness/scene-kit.ts";
import { fearStart, fearWorld } from "../../../test/scenarios/the-stewards-fear/game.ts";
import { CODES, DECK_CODES, PLOTS, VILLAINS, deckCodes, table, underCodes, withDeck } from "../../../test/scenarios/the-stewards-fear/table.ts";

import { cardKeywords } from "../cards/card-keywords.ts";
import { slotNumbers } from "../cards/card-effects.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { previewKeywords } from "../cards/preview-keywords.ts";
import { questTitle } from "../cards/table-preview.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";
import { stewardsFearDials } from "../readouts/against-the-shadow/stewards-fear.ts";
import { setAsideKey, setAsideList } from "../store/set-aside.ts";
import { hidesFace, inspectTargets, zoneSelector } from "../store/selectors.ts";

type Made = ReturnType<typeof table>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const say = (made: Made, state: ScenarioState, code: string) => dungeonDetail(state, made.ctx, idOf(state, code), (id) => made.cards.get(state.cards[id]?.code ?? id)?.name ?? id);
const dialsOf = (made: Made, state: ScenarioState) => scenarioDials(state, made.ctx, nameOf(made));
const stageLine = (made: Made, state: ScenarioState) => questTitle(state, made.ctx, state.questStage ?? "", "Stage", () => null)?.detail;

// The game started and each seat's mulligan and every choice of the Setup answered, with the steps they gave: nothing else is played.
async function started(seats: 1 | 2, seed: number) {
  const { ctx } = await fearWorld();
  const steps: EngineStep[] = [];
  let state = startScenario(fearStart(seats, seed, "Normal"), ctx);
  for (let guard = 0; guard < 12 && (state.window?.kind === "mulligan" || state.window?.kind === "choose"); guard += 1) {
    const intent: PlayerIntent = state.window.kind === "mulligan" ? { type: "Keep" } : { type: "Choose", optionId: state.window.options[0] ?? "" };
    const done = expectOk(reduce(state, intent, ctx));
    steps.push(...done.steps);
    state = done.state;
  }
  return { ctx, state, steps };
}

describe("the underworld deck (06011:A:1, 06013:B:1)", () => {
  it("06011:A:1 a dial counts the cards left in the underworld deck after the Setup, and says only the count", async () => {
    const { ctx, state } = await started(1, 3);
    const dial = scenarioDials(state, ctx, (code) => ctx.cards.get(code)?.name ?? code).find((one) => one.id === "underworld-deck");
    expect(dial).toMatchObject({ value: deckCodes(state).length, label: "Deck", name: "Cards in the underworld deck:" });
    expect(dial?.note).toBe(`${deckCodes(state).length} cards left in the underworld deck, facedown and out of play. An Underworld location that enters play takes its top cards. Stage 3B shuffles what is left into the encounter deck.`);
    // One card went under The Fourth Star at stage 1B: the deck holds one fewer than it was built with.
    expect(deckCodes(state)).toHaveLength(11);
  });

  it("06013:B:1 the dial is gone once stage 3B has shuffled the deck into the encounter deck, and the stage says so", () => {
    const made = withDeck({ stage: CODES.confrontation, side: "B", staging: [CODES.sewers] });
    expect(dialsOf(made, made.state).some((dial) => dial.id === "underworld-deck")).toBe(false);
    expect(stageLine(made, made.state)).toContain("The underworld deck is in the encounter deck now. An Underworld location takes no cards.");
    // Stage 3A, before the shuffle, still has the deck.
    const before = withDeck({ stage: CODES.confrontation, side: "A" });
    expect(dialsOf(before, before.state).find((dial) => dial.id === "underworld-deck")?.value).toBe(DECK_CODES.length);
  });
});

describe("the facedown cards under an Underworld location (06018:A:1, 06019:A:1, 06020:A:1, 06021:A:1, 06022:A:1)", () => {
  it("06022:A:1 The Fourth Star as the active location holds its card under it: a counted peek, the pill, never the face", async () => {
    const { ctx, state } = await started(2, 3);
    const star = idOf(state, CODES.star);
    const under = underCodes(state, star);
    expect(under).toHaveLength(2);
    const mark = slotNumbers(state, ctx, star).under;
    expect(mark).toMatchObject({ text: "2 underworld", count: 2, loses: false, speech: "2 facedown underworld cards underneath" });
    // The card is drawn under its host as a facedown card; the zone's entry lists it and no code of it leaves the speech of the table.
    const entry = zoneSelector("activeLocation", 0)(state).entries.find((one) => one.card.id === star);
    expect(entry?.attached.map((card) => card.face)).toEqual(["down", "down"]);
    // The table and the reader both hide the face of a facedown card, and a press on one opens its host, not it.
    for (const card of entry?.attached ?? []) expect(hidesFace(card)).toBe(true);
    expect(inspectTargets(state, entry?.attached[0]?.id ?? "")).toEqual([star]);
  });

  it("06021:A:1 Houses of the Dead in the staging area says what lies under it and that the cards are staged when it leaves play", () => {
    const made = withDeck({ staging: [CODES.houses] });
    const houses = idOf(made.state, CODES.houses);
    const state = [0, 1].reduce((now) => ({ ...now }), made.state);
    expect(say(made, state, CODES.houses)).toBe("No facedown cards lie under it.");
    const loaded = table({ staging: [CODES.houses], under: [{ code: "05037", to: CODES.houses }, { code: "05042", to: CODES.houses }] });
    expect(say(loaded, loaded.state, CODES.houses)).toBe("2 facedown underworld cards lie under it, out of play. They are staged one at a time when the location leaves play, however it leaves.");
    expect(slotNumbers(loaded.state, loaded.ctx, idOf(loaded.state, CODES.houses)).under).toMatchObject({ text: "2 underworld", count: 2 });
    expect(houses).toBeTruthy();
  });

  it("06018:A:1 the preview and the pill never name or show a card under a location", async () => {
    const { ctx, state } = await started(1, 3);
    const star = idOf(state, CODES.star);
    const hidden = underCodes(state, star).map((code) => ctx.cards.get(code ?? "")?.name ?? "");
    const made = { ctx, state, cards: ctx.cards } as unknown as Made;
    const line = dungeonDetail(state, ctx, star, (id) => ctx.cards.get(state.cards[id]?.code ?? id)?.name ?? id) ?? "";
    const mark = JSON.stringify(slotNumbers(state, ctx, star).under);
    for (const name of hidden) {
      expect(line).not.toContain(name);
      expect(mark).not.toContain(name);
    }
    expect(made).toBeTruthy();
  });

  it("06018:A:2 the card Sewers puts under the active location shows on it as a stack, whatever location that is", () => {
    const made = table({ active: "05038", staging: [CODES.sewers], under: [{ code: "05037", to: "05038" }] });
    const city = idOf(made.state, "05038");
    expect(slotNumbers(made.state, made.ctx, city).under).toMatchObject({ text: "1 underworld", count: 1 });
    expect(say(made, made.state, "05038")).toBe("1 facedown underworld card lies under it, out of play. It is staged when the location leaves play, however it leaves.");
    expect(zoneSelector("activeLocation", 0)(made.state).entries[0]?.attached.map((card) => card.face)).toEqual(["down"]);
  });

  it("the Underworld X chip says the value from the card's own record: 1 on Sewers, 2 on Houses of the Dead, the players on The Fourth Star, none on a card without it", async () => {
    const made = table({ staging: [CODES.sewers, CODES.houses, CODES.roots, CODES.storehouse, "05038"], active: CODES.star });
    const chip = (code: string) => cardKeywords(made.state, made.ctx, idOf(made.state, code)).find((keyword) => keyword.key === "underworld")?.word;
    expect(chip(CODES.sewers)).toBe("Underworld 1");
    expect(chip(CODES.houses)).toBe("Underworld 2");
    expect(chip(CODES.roots)).toBe("Underworld 1");
    expect(chip(CODES.storehouse)).toBe("Underworld 1");
    expect(chip(CODES.star)).toBe("Underworld 1");
    expect(chip("05038")).toBeUndefined();
    const two = table({ seats: 2, active: CODES.star });
    expect(cardKeywords(two.state, two.ctx, idOf(two.state, CODES.star)).find((keyword) => keyword.key === "underworld")?.word).toBe("Underworld 2");
    expect(previewKeywords(made.state, made.ctx, idOf(made.state, CODES.houses), null, "tsf").find((keyword) => keyword.word === "Underworld 2")?.ruleId).toBe("ats.underworld");
  });
});

describe("the hidden Villain and Plot (06011:A:1, 06012:A:1, 06013:A:1)", () => {
  it("the Set aside list counts them facedown with the deck, names only Roots of Mindolluin, and the four removed cards are not listed", async () => {
    const { ctx, state } = await started(1, 3);
    const list = setAsideList(state, ctx);
    expect(list.rows.map((row) => row.code)).toEqual([CODES.roots]);
    // The deck still in the set-aside zone (11 cards) and the hidden Villain and Plot make 13 facedown cards.
    expect(list.facedown).toBe(deckCodes(state).length + 2);
    const key = setAsideKey(state, ctx);
    for (const code of [...VILLAINS, ...PLOTS, ...DECK_CODES]) expect(key).not.toContain(code);
  });

  it("no step of the Setup, and no line a player reads, names or points at a hidden Villain or Plot, the removed ones or a card of the underworld deck", async () => {
    for (const seed of [3, 4, 5]) {
      const { ctx, state, steps } = await started(1, seed);
      const secret = Object.values(state.cards).filter((card) => (card.zone === "setAside" && (VILLAINS.includes(card.code) || PLOTS.includes(card.code) || card.stackedAt != null)) || (card.zone === "removed" && (VILLAINS.includes(card.code) || PLOTS.includes(card.code))));
      expect(secret.length).toBeGreaterThan(10);
      const said = JSON.stringify(steps);
      for (const card of secret) expect(said).not.toMatch(new RegExp(`"${card.id}"`));
      const names = secret.map((card) => ctx.cards.get(card.code)?.name ?? "").filter((name) => name !== "");
      const read = JSON.stringify(steps.map((step) => ("text" in step ? step.text : "")));
      for (const name of new Set(names)) expect(read).not.toContain(name);
    }
  });

  it("the hidden cards are no card of the table: set aside, they are in no zone the table draws", async () => {
    const { state } = await started(1, 3);
    const shown = new Set([...state.staging, state.activeLocation ?? "", ...state.encounterDeck, ...state.encounterDiscard]);
    for (const card of Object.values(state.cards)) {
      if (card.zone === "setAside" || card.zone === "removed") expect(shown.has(card.id)).toBe(false);
    }
  });
});

describe("the Clue tokens toward stages 1 and 2 (06011:B:3, 06012:B:3)", () => {
  it("06011:B:3 a dial counts the resource tokens on stage 1 against the 4 that advance it, and the stage says it", () => {
    const made = table({ stage: CODES.conspiracy });
    const at = (tokens: number) => {
      const stage = made.state.questStage ?? "";
      const state = updateCard(made.state, stage, { resources: tokens });
      return { state, dial: dialsOf(made, state).find((dial) => dial.id === "clue-tokens") };
    };
    expect(at(0).dial).toMatchObject({ value: 0, limit: 4, goal: true, label: "Clues" });
    expect(at(0).dial?.warn).toBeUndefined();
    expect(at(3).dial).toMatchObject({ value: 3, limit: 4, goal: true });
    expect(at(3).dial?.note).toBe("3 of 4 resource tokens on this quest. A location explored while it is active adds 1, and a Clue adds its own. At 4 the stage advances at once.");
    expect(stageLine(made, at(2).state)).toBe("No quest points. 2 of 4 resource tokens: at 4 it advances at once, in any phase.");
  });

  it("06012:B:3 stage 2 counts its own tokens, and stage 3 has no such dial", () => {
    const two = table({ stage: CODES.design });
    expect(dialsOf(two, two.state).find((dial) => dial.id === "clue-tokens")).toMatchObject({ value: 0, limit: 4 });
    const three = table({ stage: CODES.confrontation });
    expect(dialsOf(three, three.state).some((dial) => dial.id === "clue-tokens")).toBe(false);
  });

  it("06013:B:2 stage 3B says the players cannot defeat it while a Villain is in play, from its printed line", () => {
    const made = table({ stage: CODES.confrontation, staging: [CODES.daughter] });
    const line = (id: string) => (id === "06013:B:2" ? "The players cannot defeat this stage while a Villain is in play." : null);
    const title = questTitle(made.state, made.ctx, made.state.questStage ?? "", "Confrontation", line);
    expect(title?.detail).toContain("The players cannot defeat this stage while a Villain is in play.");
  });
});

describe("Up in Flames and the other Plots (06030:A:1, 06030:A:2, 06029:A:1, 06031:A:1)", () => {
  const flames = (tokens: number, decks: number) => {
    const made = table({ staging: [{ code: CODES.flames, resources: tokens }], deckOf: Array.from({ length: decks }, () => "f0") });
    return { made, dial: dialsOf(made, made.state).find((dial) => dial.id === "flames") };
  };

  it("06030:A:1 a dial shows the tokens on Up in Flames and says the next discard is one more", () => {
    const { dial } = flames(2, 20);
    expect(dial).toMatchObject({ value: 2, label: "Flames", name: "Resource tokens on Up in Flames, 2, the next discard is 3:" });
    expect(dial?.warn).toBeUndefined();
    expect(dial?.note).toBe("Up in Flames holds 2. At the end of the round it gets 1 more, then each player discards that many cards from the top of their deck. Any player with no cards left loses the game for all.");
  });

  it("06030:A:2 the dial warns before the loss: a deck of the next discard or fewer cards is emptied at the end of the round", () => {
    expect(flames(2, 4).dial?.warn).toBeUndefined();
    expect(flames(2, 3).dial?.warn).toEqual({ level: "critical", words: "Your deck holds 3 cards. The next discard is 3, which empties it, and the game is lost." });
    expect(flames(0, 1).dial?.warn?.words).toBe("Your deck holds 1 card. The next discard is 1, which empties it, and the game is lost.");
  });

  it("06030:A:1 the preview of Up in Flames says its tokens, the discard and the loss; Unholy Alliance and Poisoned Counsels say theirs", () => {
    const made = table({ staging: [{ code: CODES.flames, resources: 3 }, CODES.alliance, CODES.counsels] });
    expect(say(made, made.state, CODES.flames)).toBe("3 resource tokens. At the end of the round it gets 1 more, then each player discards that many cards. An empty deck loses the game.");
    expect(say(made, made.state, CODES.alliance)).toBe("Each staging step reveals 1 additional card, not 1 for each player. A hero destroyed by an enemy attack loses the game.");
    expect(say(made, made.state, CODES.counsels)).toBe("At the end of each round each player raises their threat by 2.");
  });
});

describe("no other scenario shows these pieces", () => {
  it("a card of this scenario on another scenario's table has no pill, chip, dial, stack or line", () => {
    const made = tableFromLayout("peril-in-pelargir", { staging: [CODES.sewers, CODES.houses, { code: CODES.flames, resources: 2 }, CODES.alliance, CODES.counsels], stage: "05065" }, { extra: [CODES.sewers, CODES.houses, CODES.flames, CODES.alliance, CODES.counsels] });
    const state = made.state;
    expect(stewardsFearDials(state, made.ctx, (code) => code)).toEqual([]);
    for (const code of [CODES.sewers, CODES.houses]) {
      const id = idOf(state, code);
      expect(slotNumbers(state, made.ctx, id).under).toBeNull();
      expect(cardKeywords(state, made.ctx, id).some((keyword) => keyword.key === "underworld")).toBe(false);
      expect(dungeonDetail(state, made.ctx, id, (card) => card)).toBeNull();
    }
    for (const code of [CODES.flames, CODES.alliance, CODES.counsels]) expect(dungeonDetail(state, made.ctx, idOf(state, code), (card) => card)).toBeNull();
    expect(dialsOf(made as unknown as Made, state).filter((dial) => ["underworld-deck", "clue-tokens", "flames"].includes(dial.id))).toEqual([]);
  });

  it("a card under another card in a game of another scenario is no underworld stack", () => {
    const made = tableFromLayout("the-black-gate-opens", { staging: ["146029"], under: [{ code: "146001", to: "146029" }] });
    expect(slotNumbers(made.state, made.ctx, idOf(made.state, "146029")).under?.text ?? "").not.toContain("underworld");
  });
});
