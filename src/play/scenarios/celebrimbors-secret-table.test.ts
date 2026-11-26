// Rules: rm.scour, rm.the-orcs-search, rm.time-x, rr.cannot, rr.immune (data/rules/entries.json); ledger lines 08122:B:1, 08122:B:3, 08122:B:4, 08123:B:1, 08123:B:3, 08123:B:4, 08124:A:1, 08125:A:1, 08125:A:2, 08126:A:1, 08126:A:3, 08127:A:1, 08127:A:2.
// What the table says of Celebrimbor's Secret's pieces: the Search dial with its warning, the Mould in each place it can lie, the stage gate on the time dial and the stage preview, Bellach's immunity, and the Time 3 dial. The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { idOf, opened, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { questTitle } from "../cards/table-preview.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { ringMakerHeldMark } from "../cards/ring-maker/held-mark.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";

const ID = "celebrimbors-secret";
const MOULD = "08127";
const CHAMBER = "08126";
const BELLACH = "08124";
const SEARCH = "08125";
const built = (layout: Layout = {}) => tableFromLayout(ID, { phase: "Quest", deckOf: ["filler", "filler", "filler"], ...layout });
type Made = ReturnType<typeof built>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const dials = (made: Made, state = made.state) => scenarioDials(state, made.ctx, nameOf(made));
const searchDial = (made: Made, state = made.state) => dials(made, state).find((dial) => dial.testID === "ring-maker-search");
const detail = (made: Made, state: Made["state"], code: string) => dungeonDetail(state, made.ctx, idOf(state, code), (id) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id);
const under = (made: Made, count: number) => {
  let state = made.state;
  for (let index = 0; index < count; index++) {
    const id = Object.keys(state.cards).find((one) => state.cards[one]?.code === "08128" && state.cards[one]?.zone !== "under") ?? "";
    state = updateCard(state, id, { zone: "under", host: idOf(state, SEARCH) });
  }
  return state;
};

describe("the cards underneath The Orcs' Search (08125:A:1, 08125:A:2, 08124:A:1)", () => {
  it("08125:A:2 reads the count, what each player's threat rises by and Bellach's Threat X", () => {
    const made = built({ staging: [SEARCH, BELLACH, "08128", "08128", "08128"] });
    expect(searchDial(made)).toMatchObject({ label: "Search", value: 0 });
    const three = under(made, 3);
    expect(searchDial(made, three)).toMatchObject({ value: 3, note: "3 cards lie facedown underneath The Orcs' Search. At the end of the refresh phase each player raises their threat by 3. Bellach's Threat is 3." });
    expect(detail(made, three, BELLACH)).toContain("Bellach's Threat is 3, one for each card underneath The Orcs' Search.");
  });

  it("08125:A:1 warns before a damaged location goes underneath, and says The Secret Chamber there loses the game", () => {
    const calm = built({ staging: [SEARCH, { code: "08129", damage: 0 }] });
    expect(searchDial(calm)?.warn).toBeUndefined();
    const chamber = built({ staging: [SEARCH, { code: CHAMBER, damage: 4 }] });
    expect(searchDial(chamber)?.warn).toMatchObject({ level: "critical", words: "The Secret Chamber has 4 of 6 damage. At 6 it goes underneath The Orcs' Search, and the players lose the game." });
    const far = built({ staging: [SEARCH, { code: CHAMBER, damage: 2 }] });
    expect(searchDial(far)?.warn).toBeUndefined();
  });

  it("08125:A:1 the Search dial has its own icon, and the preview of The Orcs' Search names a location near its quest points", () => {
    const made = built({ staging: [SEARCH, { code: CHAMBER, damage: 4 }] });
    expect(searchDial(made)?.icon).toBe("shadow");
    expect(detail(made, made.state, SEARCH)).toContain("The Secret Chamber has 4 of 6 damage. At 6 it goes underneath The Orcs' Search, and the players lose the game.");
    const calm = built({ staging: [SEARCH] });
    expect(detail(calm, calm.state, SEARCH)).not.toContain("damage.");
  });

  it("08126:A:3 says The Secret Chamber's damage and its risk first in its preview, without the printed face's words", () => {
    const made = built({ staging: [SEARCH, { code: CHAMBER, damage: 1 }] });
    expect(detail(made, made.state, CHAMBER)).toBe("1 of 6 damage. At 6 it goes underneath The Orcs' Search, and the players lose the game.");
  });
});

describe("Celebrimbor's Mould (08127:A:1, 08127:A:2)", () => {
  it("08127:A:2 on a hero says that losing the hero loses the game, and the hero wears the pill", () => {
    const made = built({ attached: [{ code: MOULD, to: "dh1", encounter: true }] });
    expect(detail(made, made.state, MOULD)).toMatch(/is held by .*\. If .* leaves play, the players lose the game\.$/);
    expect(ringMakerHeldMark(made.state, made.ctx, made.hero)).toMatchObject({ text: "Mould" });
  });

  it("08127:A:1 on The Secret Chamber says it is not free while the Chamber is in play", () => {
    const made = built({ staging: [CHAMBER], attached: [{ code: MOULD, to: CHAMBER, encounter: true }] });
    expect(detail(made, made.state, MOULD)).toContain("It is not free of encounters while The Secret Chamber is in play.");
    expect(detail(made, made.state, CHAMBER)).toContain("The Secret Chamber holds Celebrimbor's Mould.");
    expect(ringMakerHeldMark(made.state, made.ctx, idOf(made.state, CHAMBER))).toMatchObject({ text: "Mould" });
  });

  it("08123:A:1 on Bellach says no hero holds it, and stage 2 cannot be defeated", () => {
    const made = built({ stage: "08123", staging: [BELLACH], attached: [{ code: MOULD, to: BELLACH, encounter: true }] });
    expect(detail(made, made.state, MOULD)).toContain("No hero holds it, so the stage cannot be defeated.");
    expect(detail(made, made.state, BELLACH)).toContain("Bellach holds Celebrimbor's Mould. No hero holds it, so the stage cannot be defeated.");
  });
});

describe("the stage gate and the time dial (08122:B:1, 08122:B:4, 08123:B:1, 08123:B:4)", () => {
  const timeDial = (made: Made, stage: string, left: number) => {
    const state = updateCard(made.state, idOf(made.state, stage), { resources: left });
    return dials(made, state).find((dial) => dial.testID?.startsWith("ring-maker-time:"));
  };

  it("08122:B:1 and 08123:B:1 read the counters against Time 3 and say what the last one does", () => {
    const one = built({ stage: "08122", staging: [CHAMBER] });
    expect(timeDial(one, "08122", 3)).toMatchObject({ label: "Time", value: 3, limit: 3, limitWords: "Time 3: it starts with 3 time counters" });
    expect(timeDial(one, "08122", 1)?.warn?.words).toBe("The next refresh phase takes the last time counter. With the last gone, each Scour effect in play is triggered, and 3 time counters return.");
    const two = built({ stage: "08123", staging: [BELLACH] });
    expect(timeDial(two, "08123", 2)?.warn?.words).toBe("2 time counters are left.");
  });

  it("08122:B:4 says progress is held while no hero holds the Mould, and that a hero holding it lets the stage advance", () => {
    const held = built({ stage: "08122", staging: [CHAMBER], attached: [{ code: MOULD, to: CHAMBER, encounter: true }] });
    expect(timeDial(held, "08122", 3)?.note).toContain("No hero holds the Mould, so the stage cannot advance. It keeps its progress and advances the moment a hero holds it.");
    const free = built({ stage: "08122", staging: [CHAMBER], attached: [{ code: MOULD, to: "dh1", encounter: true }] });
    expect(timeDial(free, "08122", 3)?.note).toContain("A hero holds the Mould, so the stage advances as it fills.");
  });

  it("08123:B:4 says the last stage is not defeated while no hero holds the Mould, and the stage preview names the printed line", () => {
    const made = built({ stage: "08123", staging: [BELLACH], progress: 12, attached: [{ code: MOULD, to: BELLACH, encounter: true }] });
    expect(timeDial(made, "08123", 3)?.note).toContain("No hero holds the Mould, so the stage cannot be defeated.");
    const state = opened(made).state;
    // The generic hold line (advanceHold) names the printed line that holds the stage: the table adds no sentence of its own.
    const title = questTitle(state, made.ctx, idOf(state, "08123"), nameOf(made)("08123"), (id) => `printed ${id}`);
    expect(title?.detail).toContain("printed 08123:B:4");
  });
});

describe("Bellach's immunity (08122:B:3, 08123:B:3)", () => {
  it("08122:B:3 says Bellach is immune and cannot be engaged on stage 1", () => {
    const made = built({ stage: "08122", staging: [BELLACH, SEARCH] });
    const state = opened(made).state;
    expect(detail(made, state, BELLACH)).toContain("He is immune to player card effects and cannot be engaged.");
  });

  it("08123:B:3 says it holds until stage 2 has 12 progress, with the progress now, and then that he can be engaged", () => {
    const low = built({ stage: "08123", staging: [BELLACH, SEARCH], progress: 5 });
    expect(detail(low, opened(low).state, BELLACH)).toContain("until stage 2 has at least 12 progress (5 now).");
    const high = built({ stage: "08123", staging: [BELLACH, SEARCH], progress: 12 });
    expect(detail(high, opened(high).state, BELLACH)).toContain("The stage has at least 12 progress, so players can engage Bellach");
  });
});
