// Rules: rm.time-x, rm.threat-elimination-level, rm.attacks-against-nalir, rr.first-player (data/rules/entries.json); ledger lines 08066:B:1, 08066:B:2, 08067:B:1, 08067:B:2, 08068:A:1, 08068:A:3.
// What the table says of Trouble in Tharbad's pieces: the time dial of stages 1B and 2B, the lowered threat elimination level in each seat's threat dial, and Nalir held by the first player. The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { AUTHORED_EFFECTS } from "../../effects/authored/the-ring-maker/trouble-in-tharbad.ts";
import { ELIMINATION_DROP } from "../words/scenarios/ring-maker/fords-table.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";
import { seatDialLimit, threatLevel } from "../readouts/threat-level.ts";

const ID = "trouble-in-tharbad";
const NALIR = "08068";
const built = (layout: Layout = {}) => tableFromLayout(ID, { phase: "Quest", deckOf: ["filler", "filler", "filler"], ...layout });
type Made = ReturnType<typeof built>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const timeDial = (stage: string, left: number) => {
  const made = built({ stage });
  const state = updateCard(made.state, idOf(made.state, stage), { resources: left });
  return scenarioDials(state, made.ctx, nameOf(made)).find((dial) => dial.testID?.startsWith("ring-maker-time:"));
};

describe("the time dial of the stages", () => {
  it("08066:B:1 reads the counters against Time 4 and warms at 2; its last counter lowers the elimination level and loses nothing", () => {
    expect(timeDial("08066", 4)).toMatchObject({ label: "Time", value: 4, limit: 4, limitWords: "Time 4: it starts with 4 time counters" });
    expect(timeDial("08066", 4)?.warn).toBeUndefined();
    expect(timeDial("08066", 2)?.warn).toMatchObject({ level: "near", words: "2 time counters are left." });
    const last = timeDial("08066", 1);
    expect(last?.warn?.level).toBe("near");
    expect(last?.warn?.words).toContain("threat elimination level goes down by 10");
  });

  it("08066:B:2 the last counter says that a player at or above the new level is eliminated at once, with the level read for each seat", () => {
    const words = (reductionOfSecond: number): string => {
      const made = built({ stage: "08066", seats: 2 });
      const held = [{ instanceId: "seat:1", sourceId: "08066", stat: "eliminationReduction" as const, amount: reductionOfSecond, until: "endOfGame" as const }];
      const state = updateCard({ ...made.state, modifiers: [...made.state.modifiers, ...(reductionOfSecond > 0 ? held : [])] }, idOf(made.state, "08066"), { resources: 1 });
      return scenarioDials(state, made.ctx, nameOf(made)).find((dial) => dial.testID?.startsWith("ring-maker-time:"))?.warn?.words ?? "";
    };
    expect(words(0)).toContain("goes down by 10 for the rest of the game (to 40), a player whose threat is at or above his new level is eliminated at once");
    expect(words(5)).toContain("(to 40 for Player 1, 35 for Player 2)");
  });

  it("08066:B:2 the amount the words say is the amount of the record", () => {
    const record = AUTHORED_EFFECTS.find((effect) => effect.id === "08066:forced:1");
    expect(JSON.stringify(record?.instructions)).toContain(`"stat":"eliminationReduction","amount":${ELIMINATION_DROP}`);
  });

  it("08067:B:1 reads Time 3; 08067:B:2 its last counter names the first player's choice and the 3 counters that return", () => {
    expect(timeDial("08067", 3)).toMatchObject({ value: 3, limit: 3 });
    const words = timeDial("08067", 1)?.warn?.words ?? "";
    expect(words).toContain("the first player chooses");
    expect(words).toContain("Bellach attacks Nalir");
    expect(words).toContain("3 time counters return");
  });
});

describe("the threat elimination level (08066:B:2)", () => {
  // The level the stage's record sets: each seat 10 lower for the rest of the game, as the table's modifier holds it.
  const lowered = () => {
    const made = built({ seats: 2 });
    const modifiers = [0, 1].map((seat) => ({ instanceId: `seat:${seat}`, sourceId: "08066", stat: "eliminationReduction" as const, amount: 10, until: "endOfGame" as const }));
    return { ...made.state, modifiers: [...made.state.modifiers, ...modifiers] };
  };

  it("08066:B:2 the threat dial of each seat fills toward 40 and warms near it, so it is hot from 32", () => {
    const state = lowered();
    for (const seat of [0, 1]) expect(seatDialLimit(state, seat)).toBe(40);
    expect(threatLevel(31, 40)).toBe("calm");
    expect(threatLevel(32, 40)).toBe("near");
    expect(threatLevel(36, 40)).toBe("critical");
  });

  it("08066:B:2 before the stage turns the dial keeps its default limit", () => {
    expect(seatDialLimit(built({ seats: 2 }).state, 0)).toBeUndefined();
  });
});

describe("Nalir held by the first player (08068:A:1)", () => {
  const detail = (made: Made) => dungeonDetail(made.state, made.ctx, idOf(made.state, NALIR), (id) => made.cards.get(made.state.cards[id]?.code ?? "")?.name ?? id);

  it("08068:A:1 solo he is yours; two-handed the player is named", () => {
    expect(detail(built({ play: [NALIR] }))).toBe("You control Nalir. He passes to the first player each round, and if he leaves play the players lose. An attack against Nalir sends undefended damage to him.");
    expect(detail(built({ seats: 2, play: [NALIR] }))).toContain("Player 1 controls Nalir.");
  });
});

describe("The Crossing at Tharbad (08071:A:2)", () => {
  const detail = (made: Made) => dungeonDetail(made.state, made.ctx, idOf(made.state, "08071"), (id) => made.cards.get(made.state.cards[id]?.code ?? "")?.name ?? id);

  it("08071:A:2 the preview states the total quest points and how they are made up, for each count of players", () => {
    expect(detail(built({ stage: "08067", staging: ["08071"] }))).toBe("12 quest points (10, +2 for each player)");
    expect(detail(built({ stage: "08067", seats: 2, staging: ["08071"] }))).toBe("14 quest points (10, +2 for each player)");
  });
});
