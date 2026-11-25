// Rules: mec113.minas-tirith, mec113.assault, mec113.multiplayer-aragorn, mec113.saga-staging-rules, rr.active-location, rr.quest-advancement, rr.damage (data/rules/entries.json); ledger lines 145043:A:1, 145043:A:2, 145044:A:2, 145044:A:3, 145046:A:1, 145046:A:2, 145072:A:1, 145074:B:1, 145075:B:1, 145076:B:1.
// What the table says of The Battle of the Pelennor Fields' pieces: Minas Tirith's damage against its hit points, City Wall's damage against its quest points, The Corsair Fleet's and Grond's resources, the cost of the allies in the staging area on stage 2B, and the quest
// result on stages 3B (Assault) and 4B. The engine decided each number; nothing here changes one.
import { describe, expect, it } from "vitest";

import { holds } from "../../rules/interpret/conditions.ts";
import { updateCard } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { dialProps } from "../readouts/dials.ts";
import { pelennorDetail } from "../cards/pelennor-preview.ts";
import { seatedLabel, stagedAllyLabel } from "../choice/sheet-parts.ts";
import { pelennorDials, pelennorHands, pelennorQuestWords } from "../readouts/pelennor.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";
import { ASKS } from "../words/asks/the-battle-of-the-pelennor-fields.ts";
import { alliesWords, aragornLabel, ARAGORN_WORDS, assaultQuestWords, cityDestroyedWords, cityNearWords, cityWords, fleetWords, grondWords, rohanQuestWords, wallNearWords, wallWords } from "../words/scenarios/pelennor.ts";

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

describe("Grond's next hit in the City's forecast", () => {
  // 145044:A:3: at the beginning of the quest phase Grond gets 1 resource and deals its resources to Minas Tirith (through the active City Wall); before the quest phase it is still to come this round.
  const grond = (resources: number) => ({ code: "145044", resources });

  it("adds Grond's resources plus 1 to the damage to come while the quest phase has not begun, and names Grond", () => {
    const before = table({ phase: "Planning", staging: [{ code: CITY, damage: 35 }, grond(3)] });
    expect(dial(before, "city")?.warn).toEqual({ level: "near", words: cityNearWords(35, 40, 4, true) });
    expect(cityNearWords(35, 40, 4, true)).toContain("Grond");
    const critical = table({ phase: "Planning", staging: [{ code: CITY, damage: 35 }, grond(4)] });
    expect(dial(critical, "city")?.warn).toEqual({ level: "critical", words: cityDestroyedWords(35, 40, 5, true) });
    expect(cityDestroyedWords(35, 40, 5, true)).toContain("Grond");
  });

  it("leaves it out once the quest phase has begun, and takes the active City Wall's room off it", () => {
    expect(dial(table({ staging: [{ code: CITY, damage: 35 }, grond(4)] }), "city")?.warn).toEqual({ level: "near", words: cityNearWords(35, 40, 0) });
    expect(dial(table({ phase: "Planning", active: WALL, staging: [{ code: CITY, damage: 35 }, grond(3)] }), "city")?.warn).toEqual({ level: "near", words: cityNearWords(35, 40, 0) });
  });
});

describe("Aragorn and the Fleet's two-handed words", () => {
  it("145072:A:1 names the seat that takes control two-handed, and stage 5B by its title", () => {
    const made = table({ seats: 2, firstPlayer: 1, staging: [{ code: "145072", resources: 2 }] });
    expect(dial(made, "fleet")?.note).toBe(fleetWords(2, 1, "Fighting in the Fields"));
    expect(fleetWords(2, 1, "Fighting in the Fields")).toContain("Player 2, the first player, takes control of Aragorn");
    expect(fleetWords(2, null, "Fighting in the Fields")).toContain("the first player takes control");
    expect(fleetWords(2, null, "Fighting in the Fields")).not.toContain("145077");
    expect(dial(table({ staging: [{ code: "145072", resources: 2 }] }), "fleet")?.note).toContain("the first player takes control");
  });

  it("mec113.multiplayer-aragorn marks the seat that holds Aragorn, merged into its dial, and none while he is out of play", () => {
    const made = table({ seats: 2 });
    expect(pelennorHands(made.state)).toEqual([]);
    const held = spawn(made.state, "145001", { zone: "heroes", seat: 1 }).state;
    expect(pelennorHands(held)).toEqual([{ seat: 1, label: aragornLabel(1), note: ARAGORN_WORDS }]);
    expect(aragornLabel(1)).toBe("P2 · Aragorn");
    expect(aragornLabel(null)).toBe("Aragorn");
    expect(ARAGORN_WORDS).toBe("Aragorn passes with the first player token.");
    const solo = spawn(table().state, "145001", { zone: "heroes", seat: 0 }).state;
    expect(pelennorHands(solo)).toEqual([{ seat: 0, label: "Aragorn", note: ARAGORN_WORDS }]);
    expect(pelennorHands({ ...held, scenarioId: "the-siege-of-gondor" })).toEqual([]);
  });
});

describe("a staged ally on stage 2B", () => {
  const staged = () => {
    const made = table({ seats: 2, stage: "145074", staging: ["ally", "ally"] });
    const [first, second] = made.state.staging;
    let state = updateCard(made.state, first!, { controller: null, owner: 0 });
    state = updateCard(state, second!, { controller: null, owner: 1 });
    return { made, state, first: first!, second: second! };
  };

  it("145074:B:2 says whose it is, that no one controls it and that its owner takes control at stage 3", () => {
    const { made, state, second } = staged();
    expect(pelennorDetail(state, made.ctx, state.cards[second]!)).toBe("Player 2's ally. No one controls it, it is immune to player card effects and its text box is blank while it lies in the staging area. Its owner takes control at stage 3.");
    const solo = table({ stage: "145074", staging: ["ally"] });
    const id = solo.state.staging[0]!;
    expect(pelennorDetail(updateCard(solo.state, id, { controller: null, owner: 0 }), solo.ctx, updateCard(solo.state, id, { controller: null, owner: 0 }).cards[id]!)).toContain("Your ally.");
    const later = table({ stage: "145075", staging: ["ally"] });
    expect(pelennorDetail(later.state, later.ctx, later.state.cards[later.state.staging[0]!]!)).toBeNull();
  });

  it("145074:B:3 names the owner in each row of the damage pick when the allies are two players'", () => {
    const { made, state, first, second } = staged();
    const names = { card: (id: string) => `Ally ${id}` } as never;
    expect(stagedAllyLabel(state, made.ctx, names, second, [first, second])).toContain("Player 2's ally");
    expect(stagedAllyLabel(state, made.ctx, names, first, [first])).toBeUndefined();
  });
});

describe("the Tap again warning of the rows that damage Minas Tirith", () => {
  // 145043:A:2: the players lose when it has no hit points left; 145046:A:1: City Wall takes the damage first only while it is the active location, and only up to its room.
  const armed = (layout: Layout, key: string): boolean => {
    const made = table(layout);
    return holds(syncConstants(made.state, made.ctx), ASKS[key]!.caution!.when, { actor: 0, sourceId: null, returned: 0 }, made.ctx);
  };
  const THREE = "145052:forced:1 @0 city";
  const TWO = "145054:whenRevealed:1 @0 city";

  it("arms when the damage reaches the hit points left, and not before", () => {
    expect(armed({ staging: [{ code: CITY, damage: 38 }] }, THREE)).toBe(true);
    expect(armed({ staging: [{ code: CITY, damage: 38 }] }, TWO)).toBe(true);
    expect(armed({ staging: [{ code: CITY, damage: 37 }] }, TWO)).toBe(false);
    expect(armed({ staging: [{ code: CITY, damage: 20 }] }, THREE)).toBe(false);
  });

  it("145046:A:1 arms for a City Wall in the staging area, which shields nothing", () => {
    expect(armed({ staging: [WALL, { code: CITY, damage: 38 }] }, THREE)).toBe(true);
  });

  it("145046:A:1 does not arm while the active City Wall has the room, and arms for the damage beyond it", () => {
    expect(armed({ active: WALL, staging: [{ code: CITY, damage: 38 }] }, THREE)).toBe(false);
    const made = table({ active: WALL, staging: [{ code: CITY, damage: 38 }] });
    const wallId = made.state.activeLocation ?? "";
    const damaged = { ...made.state, cards: { ...made.state.cards, [wallId]: { ...made.state.cards[wallId]!, damage: 3 } } };
    const when = (key: string) => ASKS[key]!.caution!.when;
    const scope = { actor: 0, sourceId: null, returned: 0 };
    expect(holds(syncConstants(damaged, made.ctx), when(THREE), scope, made.ctx)).toBe(true);
    expect(holds(syncConstants(damaged, made.ctx), when(TWO), scope, made.ctx)).toBe(false);
  });

  it("145046:A:1 says City Wall takes the damage first only while it is the active location", () => {
    const variants = ASKS[THREE]!.label as readonly { when?: Parameters<typeof holds>[1]; text: string }[];
    expect(variants[0]!.text).toBe("Deal 3 damage to Minas Tirith ({held} damage of its {total} hit points): City Wall takes it first");
    expect(variants[1]!.text).toBe("Deal 3 damage to Minas Tirith ({held} damage of its {total} hit points)");
    const says = (layout: Layout) => {
      const made = table(layout);
      return holds(syncConstants(made.state, made.ctx), variants[0]!.when!, { actor: 0, sourceId: null, returned: 0 }, made.ctx);
    };
    expect(says({ active: WALL, staging: [CITY] })).toBe(true);
    expect(says({ staging: [WALL, CITY] })).toBe(false);
  });

  it("does not arm while Minas Tirith is out of play", () => {
    expect(armed({ setAside: [CITY] }, THREE)).toBe(false);
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

  it("145046:A:1 has no dial while Minas Tirith is out of play: the Wall has nothing to shield", () => {
    expect(dial(table({ active: WALL }), "wall")).toBeUndefined();
    expect(dial(table({ active: WALL, staging: [CITY] }), "wall")).toBeDefined();
  });
});

describe("the Fleet's, Grond's and the allies' dials", () => {
  it("145072:A:1 The Corsair Fleet's resources are a dial with no limit, so it never warms, and its words say Aragorn returns when none are left", () => {
    const made = table({ staging: [{ code: "145072", resources: 3 }] });
    expect(dial(made, "fleet")).toMatchObject({ testID: "pelennor-fleet", label: "Fleet", value: 3, note: fleetWords(3, null, "Fighting in the Fields") });
    expect(dial(made, "fleet")?.limit).toBeUndefined();
    expect(dial(made, "fleet")?.warms).toBeUndefined();
    expect(dial(made, "fleet")?.note).toContain("takes control of Aragorn");
    expect(dial(made, "fleet")?.note).toContain("Fighting in the Fields cannot be defeated without Aragorn");
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
    expect(pelennorQuestWords(bare.state, bare.ctx, 3)).not.toContain("Assault");
    const located = assault({ active: "place" });
    expect(pelennorQuestWords(located.state, located.ctx, 3)).toBe(assaultQuestWords(3, true, null, null));
    expect(pelennorQuestWords(located.state, located.ctx, 3)).toContain("3 progress on the active location, none on the stage");
  });

  it("145075:B:1 says a failed quest deals the shortfall to Minas Tirith and raises no threat, and warns when it destroys it", () => {
    const calm = assault({ staging: [{ code: CITY, damage: 5 }] });
    expect(pelennorQuestWords(calm.state, calm.ctx, -4)).toBe("4 damage to Minas Tirith, no threat raised, if nothing changes; each enemy destroyed places its Threat as progress, the active location first");
    const falling = assault({ staging: [{ code: CITY, damage: 38 }] });
    expect(pelennorQuestWords(falling.state, falling.ctx, -2)).toContain("Minas Tirith is destroyed and the players lose the game");
    expect(pelennorQuestWords(falling.state, falling.ctx, -1)).not.toContain("Minas Tirith is destroyed");
    const out = assault();
    expect(pelennorQuestWords(out.state, out.ctx, -2)).toContain("Minas Tirith is not in play");
    expect(pelennorQuestWords(calm.state, calm.ctx, 0)).toBe("No progress and no threat if nothing changes; each enemy destroyed places its Threat as progress, the active location first");
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

describe("145073:A:1 the Esquires' pick of a hero", () => {
  it("145073:A:1 names the owner on each hero of the pick when two players play, and on none with one player", () => {
    const two = table({ seats: 2, setAside: ["145014", "145015"], stage: "145073", side: "A" });
    const state = two.state;
    const heroes = [...(state.seats[0]?.heroes ?? []), ...(state.seats[1]?.heroes ?? [])];
    const labels = heroes.map((id) => seatedLabel(state, two.ctx, { card: (card: string) => two.ctx.cards.get(state.cards[card]?.code ?? "")?.name ?? card, line: () => null }, id, heroes));
    expect(labels.every((label) => label != null && /Player [12]'s hero$/.test(label))).toBe(true);
    expect(labels[0]).toContain("Player 1's hero");
    expect(labels.at(-1)).toContain("Player 2's hero");
  });
});
