// Rules: docs/brief.md (The Stone of Erech); ledger lines 50301:A:1, 50303:B:2, 50304:A:1, 50308:A:2, 50309:A:2, 50310:A:1.
// The top-bar dials of The Stone of Erech: the progress on the Night objective in play against the 4 that brings the next Night in (it warms near the limit; Midnight has none), and Derufin, free or held, with the mark of the seat that controls him.
import { describe, expect, it } from "vitest";

import { cardKeywords } from "../../cards/card-keywords.ts";
import { KEYWORD_RULES } from "../../cards/keyword-rules.ts";
import { idOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { erechDials, erechHands } from "./erech.ts";

const ID = "the-stone-of-erech";
const nameOfIn = (made: ReturnType<typeof tableFromLayout>) => (code: string) => made.cards.get(code)?.name ?? code;
const dialsOf = (layout: Layout) => {
  const made = tableFromLayout(ID, layout);
  return erechDials(made.state, made.ctx, nameOfIn(made));
};
const byId = (layout: Layout, id: string) => dialsOf(layout).find((dial) => dial.id === id);

describe("the Night objective dial", () => {
  it("50308:A:2 counts Eventide's progress against the 4 that brings Dusk in, and does not warm far from it", () => {
    const dial = byId({ night: { code: "50308", progress: 1 } }, "night");
    expect(dial).toMatchObject({ value: 1, limit: 4, warms: true, label: "Eventide", limitWords: "4 progress brings Dusk into play" });
    expect(dial?.warn).toBeUndefined();
    expect(dial?.note).toBe("Eventide holds 1 of 4 progress. At 4 it goes to the victory display and Dusk comes into play.");
  });

  it("50308:A:2 warms within 2 of the limit and turns critical at 1", () => {
    expect(byId({ night: { code: "50308", progress: 2 } }, "night")?.warn).toEqual({ level: "near", words: "2 more progress and Dusk comes into play." });
    expect(byId({ night: { code: "50308", progress: 3 } }, "night")?.warn).toEqual({ level: "critical", words: "1 more progress and Dusk comes into play." });
  });

  it("50309:A:2 counts Dusk against the 4 that brings Midnight in", () => {
    expect(byId({ night: { code: "50309", progress: 3 } }, "night")).toMatchObject({ value: 3, limit: 4, label: "Dusk", warn: { level: "critical", words: "1 more progress and Midnight comes into play." } });
  });

  it("50310:A:1 gives Midnight no limit and says what the end of the round does: 1 more progress, and that much threat", () => {
    const dial = byId({ night: { code: "50310", progress: 2 } }, "night");
    expect(dial).toMatchObject({ value: 2, label: "Midnight" });
    expect(dial?.limit).toBeUndefined();
    expect(dial?.warms).toBeUndefined();
    expect(dial?.warn).toBeUndefined();
    expect(dial?.note).toBe("Midnight holds 2 progress and has no limit. At the end of the round it gets 1 more, and each player raises their threat by 3.");
  });

  it("50301:A:1 is absent while no Night objective is in play", () => {
    expect(byId({}, "night")).toBeUndefined();
  });
});

describe("the Derufin dial and mark", () => {
  it("50304:A:1 reads Free while he is attached to the Stone, and no seat wears a mark", () => {
    const made = tableFromLayout(ID, { staging: ["50306"], attached: [{ code: "50304", to: "50306" }] });
    // The layout attaches him controlled by the first player; a card nobody controls is the Stone's.
    const free = { ...made.state, cards: Object.fromEntries(Object.entries(made.state.cards).map(([id, card]) => [id, card.code === "50304" ? { ...card, controller: null } : card])) };
    const dial = erechDials(free, made.ctx, nameOfIn(made)).find((one) => one.id === "derufin");
    expect(dial).toMatchObject({ value: 0, word: "Free" });
    expect(dial?.note).toContain("No player controls Derufin");
    expect(erechHands(free)).toEqual([]);
  });

  it("50303:B:2 warns on the last stage while no player controls him", () => {
    const made = tableFromLayout(ID, { stage: "50303", staging: ["50306"], attached: [{ code: "50304", to: "50306" }] });
    const free = { ...made.state, cards: Object.fromEntries(Object.entries(made.state.cards).map(([id, card]) => [id, card.code === "50304" ? { ...card, controller: null } : card])) };
    expect(erechDials(free, made.ctx, nameOfIn(made)).find((one) => one.id === "derufin")?.warn).toEqual({ level: "near", words: "No progress can be placed on this stage while no player controls Derufin." });
  });

  it("50304:A:1 reads Held once a player controls him and marks that seat", () => {
    const made = tableFromLayout(ID, { seats: 2, play: [{ code: "50304", seat: 1 }] });
    const dial = erechDials(made.state, made.ctx, nameOfIn(made)).find((one) => one.id === "derufin");
    expect(dial).toMatchObject({ value: 1, word: "Held" });
    expect(dial?.warn).toBeUndefined();
    expect(dial?.note).toBe("Player 2 controls Derufin. If he leaves play the players lose the game.");
    expect(erechHands(made.state)).toEqual([{ seat: 1, label: "P2 · Derufin", note: "Derufin: if he leaves play the players lose the game." }]);
  });

  it("50304:A:1 says You and wears a plain mark in a solo game", () => {
    const made = tableFromLayout(ID, { play: ["50304"] });
    expect(erechDials(made.state, made.ctx, nameOfIn(made)).find((one) => one.id === "derufin")?.note).toBe("You control Derufin. If he leaves play the players lose the game.");
    expect(erechHands(made.state)[0]?.label).toBe("Derufin");
  });

  it("has no dial before Derufin comes into play", () => {
    expect(byId({ setAside: ["50304"] }, "derufin")).toBeUndefined();
  });
});

describe("another scenario", () => {
  it("has no Erech dial or mark", () => {
    const made = tableFromLayout("the-massing-at-osgiliath", {});
    expect(erechDials(made.state, made.ctx, nameOfIn(made))).toEqual([]);
    expect(erechHands(made.state)).toEqual([]);
  });
});

describe("the Spectral keyword chip", () => {
  const chips = (layout: Layout, code: string) => {
    const made = tableFromLayout(ID, layout);
    return cardKeywords(made.state, made.ctx, idOf(made.state, code)).map((chip) => (chip.lost ? `${chip.word} (lost)` : chip.word));
  };

  it("50312:A:1 shows on a Spectral enemy, with a rule of its own to read", () => {
    expect(chips({ engaged: ["50312"] }, "50312")).toEqual(["Spectral"]);
    expect(KEYWORD_RULES.spectral.text?.paragraphs[0]).toContain("Willpower instead of their Attack");
  });

  it("50311:A:1 is struck through once an Oathbreaker has lost it to the Relic, and absent on an enemy without it", () => {
    const made = tableFromLayout(ID, { engaged: ["50312"] });
    const enemy = idOf(made.state, "50312");
    const lost = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: enemy, sourceId: enemy, stat: "losesSpectral" as const, amount: 1, until: "endOfPhase" as const }] };
    expect(cardKeywords(lost, made.ctx, enemy).map((chip) => (chip.lost ? `${chip.word} (lost)` : chip.word))).toEqual(["Spectral (lost)"]);
    expect(chips({ engaged: ["f3"] }, "f3")).toEqual([]);
  });
});
