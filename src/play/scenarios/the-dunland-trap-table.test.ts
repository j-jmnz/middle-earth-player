// Rules: rm.time-x, rr.cannot, rr.engaged, rr.first-player, rm.does-not-stack, rr.refresh-phase (data/rules/entries.json); ledger lines 08011:B:2, 08013:B:1, 08013:B:3, 08014:A:1, 08014:A:2, 08014:A:3, 08015:A:1, 08016:A:1, 08020:A:1.
// What the table says of The Dunland Trap's pieces: the time dial of stages 1B and 3B (Time 5 x players), Chief Turch, Hills of Dunland's draw effect, Munuv Dûv Ravine's bonus on Dunland enemies and Old South Road. The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { addModifier } from "../../rules/core/modified-stat.ts";
import { updateCard } from "../../rules/core/state.ts";
import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";

const ID = "the-dunland-trap";
const built = (layout: Layout = {}) => tableFromLayout(ID, { phase: "Quest", deckOf: ["filler", "filler", "filler"], ...layout });
type Made = ReturnType<typeof built>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const detail = (made: Made, code: string) => dungeonDetail(made.state, made.ctx, idOf(made.state, code), (id) => made.cards.get(made.state.cards[id]?.code ?? "")?.name ?? id);
const timeDial = (stage: string, left: number, seats?: 1 | 2, layout: Layout = {}, counted?: number) => {
  const made = built({ stage, ...(seats ? { seats } : {}), ...layout });
  const id = idOf(made.state, stage);
  const held = updateCard(made.state, id, { resources: left });
  // The count 3B made when it turned, kept on the stage (the flag timePlayers) while the players leave.
  const state = counted == null ? held : addModifier(held, id, id, "timePlayers", counted, "endOfGame");
  return scenarioDials(state, made.ctx, nameOf(made)).find((dial) => dial.testID?.startsWith("ring-maker-time:"));
};

describe("the time dial of stages 1B and 3B", () => {
  it("08011:B:1 reads the counters against Time 2 and says the last one makes each player discard the hand and draw 2", () => {
    expect(timeDial("08011", 2)).toMatchObject({ label: "Time", value: 2, limit: 2, limitWords: "Time 2: it starts with 2 time counters" });
    expect(timeDial("08011", 1)?.warn?.words).toBe("The next refresh phase takes the last time counter. With the last gone, each player discards the hand and draws 2 cards, and 2 time counters return.");
  });

  it("08013:B:1 reads the limit as 5 times the players", () => {
    expect(timeDial("08013", 5, 1)).toMatchObject({ value: 5, limit: 5, limitWords: "Time 5 x 1 player: it starts with 5 time counters" });
    expect(timeDial("08013", 10, 2)).toMatchObject({ value: 10, limit: 10, limitWords: "Time 5 x 2 players: it starts with 10 time counters" });
  });

  it("08013:B:1 keeps the limit of the count 3B made when a player leaves later (9 counters left of 10, a limit of 10)", () => {
    const dial = timeDial("08013", 9, 2, {}, 2);
    expect(dial).toMatchObject({ value: 9, limit: 10, limitWords: "Time 5 x 2 players: it starts with 10 time counters" });
  });

  it("08011:B:2 and 08016:A:1 warn that the next refresh phase takes both counters while Old South Road is in play", () => {
    expect(timeDial("08011", 2, undefined, { active: "08016" })?.warn?.words).toBe("The next refresh phase takes the last 2 time counters. With the last gone, each player discards the hand and draws 2 cards, and 2 time counters return.");
    expect(timeDial("08011", 2, undefined, { staging: ["08016"] })?.warn?.words).toMatch(/^The next refresh phase takes the last 2 time counters\./);
    expect(timeDial("08011", 2)?.warn?.words).toBe("2 time counters are left.");
    expect(timeDial("08011", 3, undefined, { active: "08016" })?.warn?.words).toBeUndefined();
    expect(timeDial("08011", 3, undefined, { active: "08016" })?.note).toMatch(/^3 time counters left\. 2 come off at the end of each refresh phase\./);
  });

  it("08014:A:3 adds that an engagement takes a counter on 3B at 2 and at 1 counter while Chief Turch is in play", () => {
    const turch = { engaged: [{ code: "08014", seat: 0 }] };
    expect(timeDial("08013", 2, 1, turch)?.warn?.words).toBe("2 time counters are left. Any enemy that engages a player also takes one.");
    expect(timeDial("08013", 1, 1, turch)?.warn?.words).toMatch(/^The next refresh phase takes the last time counter\. Any enemy that engages a player also takes one\. With the last gone, /);
    expect(timeDial("08013", 2, 1)?.warn?.words).toBe("2 time counters are left.");
  });

  it("08013:B:3 says the last counter makes the checks and attacks, then wins or loses by the heroes", () => {
    expect(timeDial("08013", 1, 1)?.note).toBe("1 time counter left. One comes off at the end of each refresh phase. With the last gone, the players make engagement checks and each engaged enemy attacks. The players win if no hero is destroyed, and lose if one is.");
  });
});

describe("the preview lines", () => {
  it("08014:A:1, 08014:A:2 and 08014:A:3 say Turch cannot leave play or be destroyed, follows the first player and takes a counter each engagement", () => {
    const made = built({ stage: "08013", engaged: ["08014"] });
    expect(detail(made, "08014")).toMatch(/^Chief Turch cannot leave play or be destroyed\. He engages the first player and follows the first player token\. Each time an enemy engages a player, 1 time counter comes off the current quest\.$/);
  });

  it("08020:A:1 says the draw effect works in the staging area, once for all copies, and not elsewhere", () => {
    expect(detail(built({ stage: "08012", staging: ["08020"] }), "08020")).toMatch(/Copies do not stack: only one acts\.$/);
    expect(detail(built({ stage: "08012", active: "08020" }), "08020")).toMatch(/works only in the staging area/);
  });

  it("08015:A:1 reads the Ravine's bonus from its record, and a Dunland enemy has no line of its own (the card sheet lists the bonus)", () => {
    const made = built({ stage: "08012", active: "08015", staging: ["07046"] });
    expect(detail(made, "08015")).toBe("Dunland enemies in play, staged or engaged, get +1 Attack and +1 Defense.");
    expect(detail(made, "07046")).toBeNull();
  });

  it("08016:A:1 says Old South Road takes a second counter at the end of each refresh phase, with the stage's own only on a stage that prints Time", () => {
    expect(detail(built({ stage: "08011", active: "08016" }), "08016")).toBe("At the end of each refresh phase, 1 time counter comes off the current quest, besides the one the stage takes.");
    expect(detail(built({ stage: "08012", active: "08016" }), "08016")).toBe("At the end of each refresh phase, 1 time counter comes off the current quest. The current stage has none.");
  });
});
