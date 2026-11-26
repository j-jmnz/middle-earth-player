// Rules: rm.time-x, rm.raven-deck, rr.first-player, rr.cannot (data/rules/entries.json); ledger lines 08147:B:1, 08147:B:2, 08148:B:2, 08149:B:1, 08149:B:2, 08149:B:3, 08150:A:1, 08150:A:3, 08151:A:1, 08152:A:1, 08152:A:2, 08155:A:1, 08158:A:1.
// What the table says of The Antlered Crown's pieces: the Raven deck and its discard pile as the second piles, the time dial of stages 1B, 2B and 3B, the time dial of each location that prints Time X, Chief Turch under the first player's control, Raven Chief and his Camp, and Raven Chief's win on stage 3. The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { idOf, legalIntents, resolveRecords, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { sheetFor } from "../choice/sheets.ts";
import type { SheetNames } from "../choice/sheet-types.ts";
import { questTitle } from "../cards/table-preview.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";
import { isDiscardPile, PILE_WORDS, pileIds, secondPilesOf } from "../store/pile-ids.ts";

const ID = "the-antlered-crown";
const built = (layout: Layout = {}) => tableFromLayout(ID, { deckOf: ["filler", "filler", "filler"], ...layout });
type Made = ReturnType<typeof built>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const detail = (made: Made, code: string) => dungeonDetail(made.state, made.ctx, idOf(made.state, code), (id) => made.cards.get(made.state.cards[id]?.code ?? "")?.name ?? id);
const dials = (made: Made, prefix: string) => scenarioDials(made.state, made.ctx, nameOf(made)).filter((dial) => dial.testID?.startsWith(prefix));
const stageDial = (stage: string, left: number) => dials(built({ stage, timeCounters: left }), "ring-maker-time:")[0];

describe("the Raven deck and its discard pile", () => {
  it("08147:A:1 the Raven pair is the second slot once the deck is built: the deck and a discard pile that opens its list", () => {
    const made = built({ stage: "08147", piles: { ravenDeck: ["08153", "08154"], ravenDiscard: ["08154"] } });
    expect(secondPilesOf(made.state)).toEqual(["ravenDeck", "ravenDiscard"]);
    expect(PILE_WORDS.ravenDeck).toBe("Raven deck");
    expect(PILE_WORDS.ravenDiscard).toBe("Raven discard pile");
    expect(pileIds(made.state, "ravenDeck", 0)).toHaveLength(2);
    expect(pileIds(made.state, "ravenDiscard", 0)).toHaveLength(1);
    expect(isDiscardPile("ravenDiscard")).toBe(true);
  });

  it("08147:A:1 the other named decks keep their own pair", () => {
    expect(secondPilesOf(tableFromLayout("shadow-and-flame", {}).state)).not.toContain("ravenDeck");
  });
});

describe("the time dial of the stages", () => {
  it("08147:B:1 reads the counters against Time 3 and says the last one takes a counter off each location and returns 3", () => {
    expect(stageDial("08147", 3)).toMatchObject({ label: "Time", value: 3, limit: 3, limitWords: "Time 3: it starts with 3 time counters" });
    expect(stageDial("08147", 1)?.warn?.words).toBe("The next refresh phase takes the last time counter. With the last gone, 1 time counter comes off each location in play, and 3 time counters return.");
  });

  it("08148:B:2 says the last counter reveals a Raven card and adds it to the staging area", () => {
    expect(stageDial("08148", 1)?.warn?.words).toMatch(/the top card of the Raven deck is revealed and added to the staging area, and 3 time counters return\.$/);
    expect(stageDial("08148", 3)?.note).toContain("Each location in the staging area gets +2 quest points");
  });

  it("08149:B:2 warns that the last counter makes each engaged enemy attack, with no win line on the dial, the stage preview says it", () => {
    expect(stageDial("08149", 2)).toMatchObject({ value: 2, limit: 2 });
    expect(stageDial("08149", 1)?.warn?.words).toContain("each engaged enemy makes an attack, and 2 time counters return.");
  });
});

describe("the time dial of the locations", () => {
  it("08155:A:1 gives each location in play that prints Time X a dial of its own, with what its last counter does", () => {
    const made = built({ stage: "08147", staging: [{ code: "08155", resources: 3 }], active: { code: "08157", resources: 3 } });
    const found = dials(made, "crown-time:");
    expect(found.map((dial) => dial.name)).toEqual(expect.arrayContaining(["Time counters left on Raven War-camp:", "Time counters left on Dunland Battlefield:"]));
    expect(found.find((dial) => dial.name.includes("War-camp"))?.note).toBe("3 time counters left. One comes off at the end of each refresh phase. With the last gone, each player in turn, the first player first, draws the top Raven card and it enters play engaged with him.");
    expect(found.every((dial) => dial.warn == null)).toBe(true);
  });

  it("08158:A:1 warns once the next refresh phase takes the last counter, before it falls", () => {
    const made = built({ stage: "08147", staging: [{ code: "08158", resources: 1 }] });
    expect(dials(made, "crown-time:")[0]?.warn).toMatchObject({ level: "near", words: "The next refresh phase takes the last time counter. Each player raises his threat by the cards in his hand." });
  });

  it("08152:A:2 the Camp's dial says it exhausts each damaged character and returns 3 counters", () => {
    const made = built({ stage: "08149", staging: [{ code: "08152", resources: 1 }] });
    expect(dials(made, "crown-time:")[0]?.warn?.words).toContain("Each damaged character is exhausted, and 3 time counters return.");
  });

  it("08147:B:1 leaves a location with no Time X out, and any other scenario has none of these dials", () => {
    expect(dials(built({ stage: "08147", staging: ["08160"] }), "crown-time:")).toEqual([]);
    expect(dials(tableFromLayout("the-dunland-trap", {}), "crown-time:")).toEqual([]);
  });
});

describe("Chief Turch (08150:A:1, 08150:A:3)", () => {
  it("08150:A:1 solo he is yours; two-handed the player is named; he follows the first player and the players lose if he leaves", () => {
    expect(detail(built({ stage: "08147", play: ["08150"] }), "08150")).toBe("You control Chief Turch. He passes to the first player each round, does not exhaust to defend and is immune to player card effects. If he leaves play, the players lose.");
    expect(detail(built({ stage: "08147", seats: 2, play: ["08150"] }), "08150")).toContain("Player 1 controls Chief Turch.");
  });
});

describe("Raven Chief and his Camp (08151:A:1, 08152:A:1, 08149:B:3)", () => {
  it("08151:A:1 says whether the Camp keeps Raven Chief from damage, and his place in the victory display", () => {
    const withCamp = detail(built({ stage: "08149", staging: ["08151", "08152"] }), "08151");
    expect(withCamp).toMatch(/^While Raven Chief's Camp is in play, Raven Chief cannot be damaged\./);
    expect(withCamp).toContain("In the victory display at the end of the round on stage 3, the players win.");
    expect(detail(built({ stage: "08149", staging: ["08151"] }), "08151")).toMatch(/^Raven Chief's Camp is not in play, so he can be damaged\./);
  });

  it("08152:A:1 the Camp's preview says it is immune and shields Raven Chief", () => {
    expect(detail(built({ stage: "08149", staging: ["08152"] }), "08152")).toBe("Raven Chief's Camp is immune to player card effects. While it is in play, Raven Chief cannot be damaged.");
  });

  it("08149:B:3 the stage 3 preview says no quest points and that Raven Chief in the victory display wins at the end of the round", () => {
    const made = built({ stage: "08149", timeCounters: 2 });
    const stage = questTitle(made.state, made.ctx, idOf(made.state, "08149"), "The Last Stage", (id) => (id === "08149:B:3" ? "At the end of the round, if Raven Chief is in the victory display, the players win the game." : null));
    expect(stage?.detail).toBe("To win: At the end of the round, if Raven Chief is in the victory display, the players win the game.");
    const two = built({ stage: "08148", timeCounters: 1 });
    expect(questTitle(two.state, two.ctx, idOf(two.state, "08148"), "The Raven Clan", () => null)?.detail).toMatch(/^Each location in the staging area gets \+2 quest points, until it becomes the active location\. The next refresh phase takes the last time counter\./);
  });
});

describe("the picks of the Raven cards", () => {
  const namesOf = (made: Made, state: Made["state"]): SheetNames => ({ card: (id) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null });
  it("08153:A:1 the first player divides the counters among the locations: the sheet names the card and the count", () => {
    const made = built({ seats: 2, stage: "08147", staging: [{ code: "08156", resources: 2 }], active: { code: "08157", resources: 3 }, engaged: [{ code: "08153", seat: 1 }], hand: [{ code: "filler", seat: 1 }, { code: "filler", seat: 1 }] });
    const seen: unknown[] = [];
    resolveRecords(made.state, made.ctx, "08153", "forced", idOf(made.state, "08153"), (state) => {
      seen.push(sheetFor(state, made.ctx, legalIntents(state, made.ctx), namesOf(made, state)));
      return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
    }, true, 1);
    expect(seen[0]).toMatchObject({ note: "Raven Warrior engaged: choose a location in play to lose a time counter. Player 1 chooses.", options: [{ label: "Raven Village" }, { label: "Dunland Battlefield" }] });
  });

  it("08154:A:1 the first player chooses between a counter off the active location and an extra reveal", () => {
    const made = built({ stage: "08147", staging: ["08154"], active: { code: "08157", resources: 3 }, deck: ["f0", "f0"] });
    const seen: unknown[] = [];
    resolveRecords(made.state, made.ctx, "08154", "whenRevealed", idOf(made.state, "08154"), (state) => {
      seen.push(sheetFor(state, made.ctx, legalIntents(state, made.ctx), namesOf(made, state)));
      return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
    });
    expect(seen[0]).toMatchObject({ note: "Raven Skirmisher: remove 1 time counter from the active location, or reveal an additional encounter card.", options: [{ label: "Remove 1 time counter from the active location" }, { label: "Reveal an additional encounter card" }] });
  });
});
