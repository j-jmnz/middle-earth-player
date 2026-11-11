// Rules: mec113.minas-tirith, mec113.assault, mec113.multiplayer-aragorn, mec113.saga-staging-rules, rr.active-location, rr.quest-advancement, rr.damage (data/rules/entries.json); ledger lines 145043:A:1, 145043:A:2, 145044:A:2, 145044:A:3, 145046:A:1, 145046:A:2, 145072:A:1, 145074:B:1, 145075:B:1, 145076:B:1.
// What the table says of The Battle of the Pelennor Fields' pieces: Minas Tirith's damage against its hit points, City Wall's damage against its quest points, The Corsair Fleet's and Grond's resources, the cost of the allies in the staging area on stage 2B, and the quest
// result on stages 3B (Assault) and 4B. The engine decided each number; nothing here changes one.
import { describe, expect, it } from "vitest";

import { syncConstants } from "../../rules/interpret/constants.ts";
import { tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { dialProps } from "../readouts/dials.ts";
import { pelennorDials, pelennorQuestWords } from "../readouts/pelennor.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";
import { alliesWords, assaultQuestWords, cityDestroyedWords, cityNearWords, cityWords, fleetWords, grondWords, rohanQuestWords, wallNearWords, wallWords } from "../words/scenarios/pelennor.ts";

const ID = "the-battle-of-the-pelennor-fields";
const CITY = "145043";
const WALL = "145046";
const table = (layout: Layout = {}) => tableFromLayout(ID, layout);
const names = (made: ReturnType<typeof table>) => (code: string) => made.cards.get(code)?.name ?? code;
const dial = (made: ReturnType<typeof table>, id: string) => pelennorDials(made.state, made.ctx, names(made)).find((one) => one.id === id);

describe("Minas Tirith's damage", () => {
  it("145043:A:1 is a dial of its damage against its hit points, 30 plus 10 for each player, that warms toward the loss", () => {
    const solo = table({ staging: [{ code: CITY, damage: 5 }] });
    expect(dial(solo, "city")).toMatchObject({ testID: "pelennor-city", label: "City", value: 5, limit: 40, warms: true, limitWords: cityWords(40) });
    expect(dial(solo, "city")?.warn).toBeUndefined();
    expect(dialProps(dial(solo, "city")!)).toMatchObject({ elimination: true, testID: "pelennor-city" });
    expect(dial(table({ seats: 2, staging: [CITY] }), "city")).toMatchObject({ limit: 50 });
  });

  it("145043:A:1 is gone while Minas Tirith is out of play", () => {
    expect(dial(table({ setAside: [CITY] }), "city")).toBeUndefined();
    expect(dial(table(), "city")).toBeUndefined();
  });

  it("145043:A:2 warns with the last 10 hit points, and says the end of the round destroys it when the enemies in the staging area deal what is left", () => {
    const near = table({ staging: [{ code: CITY, damage: 31 }, "f3"] });
    expect(dial(near, "city")?.warn).toEqual({ level: "near", words: cityNearWords(31, 40, 1) });
    const critical = table({ staging: [{ code: CITY, damage: 38 }, "f3", "f3", "f3"] });
    expect(dial(critical, "city")?.warn).toEqual({ level: "critical", words: cityDestroyedWords(38, 40, 3) });
    expect(cityDestroyedWords(38, 40, 3)).toContain("Minas Tirith");
  });

  it("145046:A:1 counts the damage City Wall takes first when it is the active location: the end of the round does not destroy it while the Wall has room", () => {
    const walled = table({ active: WALL, staging: [{ code: CITY, damage: 38 }, "f3", "f3"] });
    expect(dial(walled, "city")?.warn).toEqual({ level: "near", words: cityNearWords(38, 40, 0) });
  });
});

describe("City Wall's damage", () => {
  it("145046:A:1 is a dial of the active City Wall's damage against its quest points, 4, warming one point short and saying the threat raise", () => {
    const calm = table({ active: WALL, staging: [CITY] });
    expect(dial(calm, "wall")).toMatchObject({ testID: "pelennor-wall", label: "Wall", value: 0, limit: 4, warms: true, limitWords: wallWords(4) });
    expect(dial(calm, "wall")?.warn).toBeUndefined();
    const made = table({ active: WALL, staging: [CITY] });
    const damaged = { ...made.state, cards: { ...made.state.cards, [made.state.activeLocation ?? ""]: { ...made.state.cards[made.state.activeLocation ?? ""]!, damage: 3 } } };
    expect(pelennorDials(damaged, made.ctx, names(made)).find((one) => one.id === "wall")).toMatchObject({ value: 3, warn: { level: "near", words: wallNearWords(3, 4) } });
  });

  it("145046:A:2 has no dial while City Wall is in the staging area: it takes no damage there", () => {
    expect(dial(table({ staging: [WALL, CITY] }), "wall")).toBeUndefined();
  });
});

describe("the Fleet's, Grond's and the allies' dials", () => {
  it("145072:A:1 The Corsair Fleet's resources are a dial with no limit, so it never warms, and its words say Aragorn returns when none are left", () => {
    const made = table({ staging: [{ code: "145072", resources: 3 }] });
    expect(dial(made, "fleet")).toMatchObject({ testID: "pelennor-fleet", label: "Fleet", value: 3, note: fleetWords(3) });
    expect(dial(made, "fleet")?.limit).toBeUndefined();
    expect(dial(made, "fleet")?.warms).toBeUndefined();
    expect(dial(made, "fleet")?.note).toContain("takes control of Aragorn");
    expect(dial(made, "fleet")?.note).toContain("Stage 5B cannot be defeated without Aragorn");
    expect(dial(table({ victory: ["145072"] }), "fleet")).toBeUndefined();
  });

  it("145044:A:2 Grond's resources are X, a dial with no limit", () => {
    const made = table({ staging: [{ code: "145044", resources: 4 }] });
    expect(dial(made, "grond")).toMatchObject({ testID: "pelennor-grond", label: "Grond", value: 4, note: grondWords(4) });
    expect(dial(made, "grond")?.limit).toBeUndefined();
  });

  it("145074:B:1 the allies' dial is the total cost of the allies in the staging area, on stage 2B only", () => {
    const made = table({ stage: "145074", staging: ["ally", "ally"] });
    expect(dial(made, "allies")).toMatchObject({ testID: "pelennor-allies", label: "Allies", value: 2, note: alliesWords(2) });
    expect(dial(table({ staging: ["ally"] }), "allies")).toBeUndefined();
  });

  it("145043:A:2 draws the dials that can warn (City, Wall) before the Fleet, Grond and the allies, and the top bar lists them", () => {
    const made = table({ stage: "145074", active: WALL, staging: [CITY, "145044", { code: "145072", resources: 2 }, "ally"] });
    const shown = pelennorDials(made.state, made.ctx, names(made)).map((one) => one.id);
    expect(shown).toEqual(["city", "wall", "fleet", "grond", "allies"]);
    expect(scenarioDials(made.state, made.ctx, names(made)).map((one) => one.id)).toEqual(shown);
  });

  it("145043:A:1 draws no piece in another scenario", () => {
    const made = tableFromLayout("the-siege-of-gondor", { staging: ["145071"] });
    expect(pelennorDials(made.state, made.ctx, names(made))).toEqual([]);
  });
});

describe("the quest result", () => {
  const assault = (layout: Layout = {}) => {
    const made = table({ stage: "145075", ...layout });
    return { ...made, state: syncConstants(made.state, made.ctx) };
  };

  it("145075:B:1 says Assault places no progress on the stage from questing, and the active location takes it", () => {
    const bare = assault();
    expect(pelennorQuestWords(bare.state, bare.ctx, 3)).toBe(assaultQuestWords(3, false, null, null));
    expect(pelennorQuestWords(bare.state, bare.ctx, 3)).toContain("No progress on the stage");
    const located = assault({ active: "place" });
    expect(pelennorQuestWords(located.state, located.ctx, 3)).toBe(assaultQuestWords(3, true, null, null));
    expect(pelennorQuestWords(located.state, located.ctx, 3)).toContain("3 progress on the active location, none on the stage");
  });

  it("145075:B:1 says a failed quest deals the shortfall to Minas Tirith and raises no threat, and warns when it destroys it", () => {
    const calm = assault({ staging: [{ code: CITY, damage: 5 }] });
    expect(pelennorQuestWords(calm.state, calm.ctx, -4)).toBe("4 damage to Minas Tirith, no threat raised, if nothing changes");
    const falling = assault({ staging: [{ code: CITY, damage: 38 }] });
    expect(pelennorQuestWords(falling.state, falling.ctx, -2)).toContain("Minas Tirith is destroyed and the players lose the game");
    expect(pelennorQuestWords(falling.state, falling.ctx, -1)).not.toContain("destroyed");
    const out = assault();
    expect(pelennorQuestWords(out.state, out.ctx, -2)).toContain("Minas Tirith is not in play");
    expect(pelennorQuestWords(calm.state, calm.ctx, 0)).toBe("No progress and no threat if nothing changes");
  });

  it("145076:B:1 says on stage 4B that the progress is dealt as damage among the enemies in play, and says nothing of a failed quest", () => {
    const made = table({ stage: "145076" });
    const state = syncConstants(made.state, made.ctx);
    expect(pelennorQuestWords(state, made.ctx, 2)).toBe(rohanQuestWords(2));
    expect(pelennorQuestWords(state, made.ctx, -2)).toBeNull();
  });

  it("145075:B:1 says nothing on any other stage", () => {
    const made = table({ stage: "145074" });
    expect(pelennorQuestWords(syncConstants(made.state, made.ctx), made.ctx, 3)).toBeNull();
  });
});

describe("the words", () => {
  it("145046:A:2 each sentence names the card and its number", () => {
    expect(wallWords(4)).toContain("City Wall");
    expect(wallWords(4)).toContain("raises their threat by 3");
    expect(cityWords(40)).toContain("40 hit points");
  });
});
