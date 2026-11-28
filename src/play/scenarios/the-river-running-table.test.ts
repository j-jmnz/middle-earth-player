// Rules: rr.forced, rr.quest-advancement, rr.attachment-cards, rr.first-player (data/rules/entries.json); ledger lines 21012:A:1, 21076:B:2, 21029:A:1, 21029:A:2, 21075:A:1, 21013:A:2, 21017:A:2.
// What the table says of The River Running's pieces: the resources on Easterling Pursuit against the 3 that add enemies, stage 2B's progress cap, and the owner named on each row of a pick that spans seats.
// The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { dialProps } from "../readouts/dials.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";
import { ASKS } from "../words/asks/the-river-running.ts";

const ID = "the-river-running";
const built = (layout: Layout) => tableFromLayout(ID, { phase: "Quest", ...layout });
const dials = (layout: Layout) => {
  const made = built(layout);
  return scenarioDials(made.state, made.ctx, (code) => made.cards.get(code)?.name ?? code);
};

describe("the Pursuit dial", () => {
  it("21012:A:1 counts the resources on Easterling Pursuit toward the 3 that add enemies, and warms at 2 or more", () => {
    const none = dials({ stage: "21075", staging: ["21012"] }).find((dial) => dial.id === "pursuit");
    expect(none).toMatchObject({ testID: "river-pursuit", label: "Pursuit", value: 0, limit: 3 });
    expect(none?.warn).toBeUndefined();
    const two = dials({ stage: "21075", staging: [{ code: "21012", resources: 2 }] }).find((dial) => dial.id === "pursuit");
    expect(two).toMatchObject({ value: 2, limit: 3, warms: true, warn: { level: "near" } });
    expect(dialProps(two!).limit).toBe(3);
    expect(two?.note).toContain("2 resources on Easterling Pursuit.");
    expect(two?.warn?.words).toBe("At the end of this round it reaches 3: 1 enemy for each player is added to the staging area.");
    expect(two?.limitWords).toBe("3 resources add 1 enemy for each player at the end of the round");
  });

  it("21012:A:1 stays warm at 3 or more (a card adds resources during the round) and says the end of the round takes 3 off", () => {
    for (const resources of [3, 4]) {
      const dial = dials({ stage: "21075", staging: [{ code: "21012", resources }] }).find((item) => item.id === "pursuit");
      expect(dial, String(resources)).toMatchObject({ value: resources, limit: 3, warms: true, warn: { level: "near", words: "At the end of this round 3 come off and 1 enemy for each player is added to the staging area." } });
      expect(dial?.note, String(resources)).not.toContain("of the 3");
    }
  });

  it("21012:A:1 shows no dial with Easterling Pursuit out of play, nor in another scenario", () => {
    expect(dials({ stage: "21075", staging: [] })).toEqual([]);
    const other = tableFromLayout("the-weather-hills", { deck: ["09032"] });
    expect(scenarioDials(other.state, other.ctx, (code) => code).filter((dial) => dial.testID?.startsWith("river"))).toEqual([]);
  });
});

describe("the progress cap dial of stage 2B", () => {
  it("21076:B:2 shows no cap while nobody is engaged with an enemy", () => {
    expect(dials({ stage: "21076", staging: ["21013"] }).find((dial) => dial.id === "cap")).toBeUndefined();
  });

  it("21076:B:2 fills toward the 5 a round while a player is engaged with an enemy", () => {
    const cap = dials({ stage: "21076", engaged: ["21013"] }).find((dial) => dial.id === "cap");
    expect(cap).toMatchObject({ testID: "river-cap", label: "Cap", value: 0, limit: 5, limitWords: "No more than 5 progress each round" });
    expect(cap?.note).toContain("0 of the 5 progress");
  });

  it("21076:B:2 comes before the Pursuit dial, so it shows when the bar is short of room", () => {
    const ids = dials({ stage: "21076", engaged: ["21013"], staging: ["21012"] }).map((dial) => dial.id);
    expect(ids).toEqual(["cap", "pursuit"]);
  });
});

describe("the asks name their owner", () => {
  it("21029:A:1 and 21029:A:2 are each player's own choice, so two-handed the sentence leads with the player", () => {
    expect(ASKS["21029:forced:1 @0.0 CapRefresh"]?.owned).toBe(true);
    expect(ASKS["21029:response:1 @0.0 Choose"]?.owned).toBe(true);
    expect(ASKS["21029:response:1 @0.0.ready.0 Pick"]?.owned).toBe(true);
  });

  it("21075:A:1 and 21013:A:3 are the player's own pick; the Travel and tie picks are the first player's for the group", () => {
    expect(ASKS["21075:setup:1 @0.0 SearchMove"]?.owned).toBe(true);
    expect(ASKS["21013:shadow:1 @0 Pick"]?.owned).toBe(true);
    expect(ASKS["21014:travel:1 @0 Pick"]?.owned).toBeUndefined();
    expect(ASKS["21024:forced:2 @0 Pick"]?.owned).toBeUndefined();
  });
});
