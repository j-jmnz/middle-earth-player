// Rules: rm.time-x, rm.parallel-stages, rr.first-player (data/rules/entries.json); ledger lines 08095:B:1, 08095:B:2, 08095:B:3, 08096:B:3, 08097:B:3, 08098:B:2, 08099:B:3, 08100:B:3, 08101:B:2, 08102:A:1, 08102:A:2, 08103:A:2, 08103:A:3.
// What the table says of The Nîn-in-Eilph's pieces: the time dial of the random stages (the stage that replaces one, what is lost, each stage's standing rule), the Marsh-dweller's attacks near stage 4B's last counter, Nalir under the first player and the Marsh-dweller's resource tokens. The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { questTitle } from "../cards/table-preview.ts";
import { heldStage } from "../cards/earlier-stages.ts";
import { commitSheet } from "../choice/bar-sheets.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";

const ID = "the-nin-in-eilph";
const built = (layout: Layout = {}) => tableFromLayout(ID, { phase: "Quest", deckOf: ["filler", "filler", "filler"], ...layout });
type Made = ReturnType<typeof built>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const timeDial = (stage: string, left: number) => {
  const made = built({ stage });
  const state = updateCard(made.state, idOf(made.state, stage), { resources: left });
  return scenarioDials(state, made.ctx, nameOf(made)).find((dial) => dial.testID?.startsWith("ring-maker-time:"));
};
const detail = (made: Made, code: string) => dungeonDetail(made.state, made.ctx, idOf(made.state, code), (id) => made.cards.get(made.state.cards[id]?.code ?? "")?.name ?? id);

describe("the time dial of the random stages", () => {
  it("08095:B:1 reads the counters against Time 3 and 08101:B:1 against Time 2", () => {
    expect(timeDial("08095", 3)).toMatchObject({ label: "Time", value: 3, limit: 3, limitWords: "Time 3: it starts with 3 time counters" });
    expect(timeDial("08101", 2)).toMatchObject({ value: 2, limit: 2, limitWords: "Time 2: it starts with 2 time counters" });
  });

  it("08095:B:2 and 08098:B:2 warn before the last counter that a different stage of the same number replaces the stage, and what is lost", () => {
    expect(timeDial("08095", 3)?.warn).toBeUndefined();
    expect(timeDial("08095", 2)?.warn?.words).toBe("2 time counters are left.");
    expect(timeDial("08095", 1)?.warn?.words).toBe("The next refresh phase takes the last time counter. With the last gone, this stage goes back to the quest deck, losing its progress and counters, and a different stage 2 chosen at random replaces it.");
    expect(timeDial("08099", 1)?.warn?.words).toContain("a different stage 3 chosen at random replaces it");
  });

  it("08101:B:2 warns that the Marsh-dweller attacks each player and 2 counters are placed", () => {
    expect(timeDial("08101", 1)?.warn?.words).toBe("The next refresh phase takes the last time counter. With the last gone, Ancient Marsh-dweller attacks each player in player order, and 2 time counters are placed on this stage.");
  });

  it("08095:B:3, 08096:B:3, 08097:B:3, 08098:B:3, 08099:B:3 and 08100:B:3 lead the note with the stage's standing rule, so the stages with one name read apart", () => {
    expect(timeDial("08095", 3)?.note).toMatch(/^Player card effects cannot gain resources or draw cards\. 3 time counters left\./);
    expect(timeDial("08096", 3)?.note).toMatch(/^Before committing characters to the quest, a player discards a card at random from his hand\. With no card, he cannot commit\. 3 time counters left\./);
    expect(timeDial("08097", 3)?.note).toMatch(/^Each player can play only 1 card each round\./);
    expect(timeDial("08098", 3)?.note).toMatch(/^Each location in play gets \+1 Threat\./);
    expect(timeDial("08099", 3)?.note).toMatch(/^Each player readies at most 5 characters in the refresh phase\./);
    expect(timeDial("08100", 3)?.note).toMatch(/^Each enemy in the staging area gets -20 engagement cost\./);
  });
});

describe("Nalir and the Ancient Marsh-dweller", () => {
  it("08102:A:1 and 08102:A:2 say who controls Nalir, that he follows the first player and the threat the refresh phase costs", () => {
    expect(detail(built({ play: ["08102"] }), "08102")).toBe("You control Nalir. He passes to the first player each round, and if he leaves play the players lose. At the start of each refresh phase the first player raises their threat by 1.");
    expect(detail(built({ seats: 2, play: ["08102"] }), "08102")).toMatch(/^Player 1 controls Nalir\..*raises their threat by 2\.$/);
  });

  it("08103:A:2 and 08103:A:3 say the resource tokens are Threat and Attack and that time counters removed add one", () => {
    const made = built({ staging: ["08103"] });
    const held = updateCard(made.state, idOf(made.state, "08103"), { resources: 2 });
    expect(dungeonDetail(held, made.ctx, idOf(held, "08103"), (id) => id)).toBe("Ancient Marsh-dweller has 2 resource tokens: +2 Threat and +2 Attack. It gets one more whenever time counters come off the current quest.");
  });
});

describe("the commit sheet under stage 08096", () => {
  it("08096:B:3 says a random card is discarded before the commit, and only while 08096 is current", () => {
    const sheetNote = (stage: string): string | null => {
      const made = built({ stage, deck: [], hand: ["ally"] });
      return commitSheet(made.state, made.ctx, { card: nameOf(made), line: () => null }).note;
    };
    expect(sheetNote("08096")).toContain("discards a card at random from his hand");
    expect(sheetNote("08095")).not.toContain("at random");
  });
});

describe("the stage preview and the 4B dial", () => {
  const preview = (stage: string, left: number) => {
    const made = built({ stage });
    const state = updateCard(made.state, idOf(made.state, stage), { resources: left });
    return questTitle(state, made.ctx, idOf(state, stage), nameOf(made)(stage), () => null);
  };

  it("08096:B:3 the preview of the stage leads with its standing rule and says the count once", () => {
    expect(preview("08096", 3)?.detail).toMatch(/^Before committing characters to the quest, a player discards a card at random/);
    const two = preview("08095", 2)?.detail ?? "";
    expect(two).toMatch(/^Player card effects cannot gain resources or draw cards\./);
    expect(two).not.toContain("time counters are left");
  });

  it("08101:B:1 the 4B dial warms only when the next refresh phase takes the last counter", () => {
    expect(timeDial("08101", 2)?.warn).toBeUndefined();
    expect(timeDial("08101", 1)?.warn?.words).toContain("Ancient Marsh-dweller attacks");
  });
});

describe("the stage numbers", () => {
  it("08094:B:1 the printed stages are 1 to 4 of 4: the three stages 2 share a place, and so do the three stages 3", () => {
    const made = built({ stage: "08096" });
    const places = ["08094", "08095", "08096", "08097", "08098", "08099", "08100", "08101"].map((code) => heldStage(made.state, made.ctx, code));
    expect(places.map((place) => `${place?.at}/${place?.of}`)).toEqual(["1/4", "2/4", "2/4", "2/4", "3/4", "3/4", "3/4", "4/4"]);
  });
});
