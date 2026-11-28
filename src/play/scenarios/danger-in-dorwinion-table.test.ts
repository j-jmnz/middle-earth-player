// Rules: rr.forced, rr.quest-advancement, rr.first-player (data/rules/entries.json); ledger lines 21077:B:2, 21078:B:2, 21033:A:1, 21035:A:2, 21037:A:1, 21038:A:2, 21039:A:1, 21044:A:1, 21047:A:3.
// What the table says of Danger in Dorwinion's pieces: the stage gate, Bribes, Sauron Worship, Hillside Manor's cap on each seat, and the owner named on each row of a pick that spans seats.
// The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { allyCard, idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { slotNumbers } from "../cards/card-effects.ts";
import { dialProps } from "../readouts/dials.ts";
import { scenarioDials, seatMarks } from "../readouts/scenario-dials.ts";
import { spawn } from "../../rules/core/zones.ts";
import { EFFECTS } from "../../effects/index.ts";
import { rowStats } from "../choice/sheet-parts.ts";
import type { Instruction } from "../../catalog/boundary.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { asksOption, asksPick, type AskFacts } from "../words/asks.ts";
import { ASKS } from "../words/asks/danger-in-dorwinion.ts";

const ID = "danger-in-dorwinion";
const built = (layout: Layout) => tableFromLayout(ID, { phase: "Quest", ...layout });
const nameOf = (made: ReturnType<typeof built>) => (code: string) => made.cards.get(code)?.name ?? code;
const dials = (layout: Layout) => {
  const made = built(layout);
  return scenarioDials(made.state, made.ctx, nameOf(made));
};

describe("the stage gate", () => {
  it("21077:B:2 counts the resources on stage 1B toward the 2 that let it be defeated, a goal dial", () => {
    const gate = dials({ stage: "21077" }).find((dial) => dial.id === "gate");
    expect(gate).toMatchObject({ testID: "dorwinion-gate", label: "Gate", value: 0, limit: 2, goal: true });
    expect(gate?.warn).toBeUndefined();
    expect(gate?.limitWords).toBe("2 resources let this stage be defeated");
    expect(dialProps(gate!).limit).toBe(2);
  });

  it("21077:B:2 warns only when the stage's progress fills its quest points with too few resources, and not on side A", () => {
    const some = built({ stage: "21077", progress: 3 });
    expect(scenarioDials(some.state, some.ctx, nameOf(some)).find((dial) => dial.id === "gate")?.warn).toBeUndefined();
    const made = built({ stage: "21077", progress: 5 });
    const gate = scenarioDials(made.state, made.ctx, nameOf(made)).find((dial) => dial.id === "gate");
    expect(gate?.warn?.level).toBe("near");
    expect(gate?.warn?.words).toBe("A City in Turmoil has all its progress but needs 2 more resources before it can be defeated.");
    expect(dials({ stage: "21077", side: "A" }).find((dial) => dial.id === "gate")).toBeUndefined();
  });

  it("21078:B:2 prints 0 quest points, so any progress with too few resources warns", () => {
    const none = dials({ stage: "21078" }).find((dial) => dial.id === "gate");
    expect(none?.warn).toBeUndefined();
    const made = built({ stage: "21078", progress: 1 });
    const gate = scenarioDials(made.state, made.ctx, nameOf(made)).find((dial) => dial.id === "gate");
    expect(gate?.warn?.words).toBe("The Shadow of Mordor holds progress but needs 4 more resources before it can be defeated.");
  });

  it("the gate's spoken words repeat the count once in the note and once in the limit, and join with no \".,\"", () => {
    const gate = dials({ stage: "21077" }).find((dial) => dial.id === "gate");
    expect(`${gate?.name} ${gate?.note} ${gate?.limitWords}`.match(/\b2\b/g)).toHaveLength(2);
    expect(gate?.note?.endsWith(".")).toBe(false);
  });

  it("21078:B:2 needs 3 more resources than there are players", () => {
    const gate = dials({ stage: "21078" }).find((dial) => dial.id === "gate");
    expect(gate).toMatchObject({ value: 0, limit: 4, goal: true });
    expect(gate?.note).toContain("cannot be defeated with fewer than 4");
  });
});

describe("the tokens of the plots", () => {
  it("21033:A:1 shows the resources on Bribes, each adding 1 Threat, only while it is in play", () => {
    expect(dials({ stage: "21077" }).find((dial) => dial.id === "bribes")).toBeUndefined();
    const bribes = dials({ stage: "21077", staging: [{ code: "21033", resources: 2 }] }).find((dial) => dial.id === "bribes");
    expect(bribes).toMatchObject({ testID: "dorwinion-bribes", label: "Bribes", value: 2 });
    expect(bribes?.note).toContain("2 resources on Bribes. Each adds 1 Threat");
  });

  it("21035:A:2 shows the damage on Sauron Worship, each lowering every elimination level by 1", () => {
    const worship = dials({ stage: "21077", staging: [{ code: "21035", damage: 2 }] }).find((dial) => dial.id === "worship");
    expect(worship).toMatchObject({ testID: "dorwinion-worship", value: 2 });
    expect(worship?.note).toContain("Each lowers every player's elimination threat level by 1");
  });

  it("shows none of them in another scenario", () => {
    const other = tableFromLayout("the-river-running", { stage: "21075" });
    expect(scenarioDials(other.state, other.ctx, (code) => code).filter((dial) => dial.testID?.startsWith("dorwinion"))).toEqual([]);
  });
});

describe("Hillside Manor's cap", () => {
  it("21037:A:1 marks each seat with the threat player card effects lowered this round against the 1 allowed", () => {
    const made = built({ stage: "21077", staging: ["21037"] });
    const marks = seatMarks(made.state, made.ctx);
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ seat: 0, label: "Cap 0/1" });
    const pair = built({ seats: 2, stage: "21077", staging: ["21037"] });
    expect(seatMarks(pair.state, pair.ctx).map((mark) => mark.label)).toEqual(["P1 0/1", "P2 0/1"]);
    expect(marks[0]?.warn).toBeUndefined();
    const spent = { ...made.state, playerThreatLoweredBy: { 0: 1 } };
    expect(seatMarks(spent, made.ctx)[0]).toMatchObject({ label: "Cap 1/1" });
    expect(seatMarks(spent, made.ctx)[0]?.warn).toBeUndefined();
  });

  it("21037:A:1 marks no seat once Hillside Manor is not in the staging area", () => {
    const made = built({ stage: "21077", staging: [] });
    expect(seatMarks(made.state, made.ctx)).toEqual([]);
  });
});

describe("the asks name their owner", () => {
  it("21038:A:2, 21042:A:3, 21044:A:1 and 21077:A:1 are the player's own choice, so two-handed the sentence leads with the player", () => {
    for (const key of ["21038:shadow:1 @0 Pick", "21042:shadow:1 @0 Choose", "21044:forced:1 @0 Choose", "21044:forced:1 @0.discard.0 Pick", "21077:setup:1 @0.0 SearchMove"]) expect(ASKS[key]?.owned, key).toBe(true);
  });

  it("21039:A:1, 21040:A:1 and 21047:A:3 are the first player's for the group, so the sheet adds who chooses", () => {
    for (const key of ["21039:whenRevealed:1 @0 Pick", "21040:whenRevealed:1 @0 Choose", "21047:travel:1 @1 PickEncounter"]) expect(ASKS[key]?.owned, key).toBeUndefined();
  });
});

describe("the cards facedown under Seedy Tavern", () => {
  it("21047:A:3 wears a pill with the count of facedown cards, never which, and none with nothing under it", () => {
    const empty = built({ stage: "21077", staging: ["21047"] });
    expect(slotNumbers(empty.state, empty.ctx, idOf(empty.state, "21047")).under).toBeNull();
    const held = built({ stage: "21077", staging: ["21047"], under: [{ code: "21034", to: "21047" }, { code: "21035", to: "21047" }] });
    const pill = slotNumbers(held.state, held.ctx, idOf(held.state, "21047")).under;
    expect(pill).toMatchObject({ text: "2 facedown", count: 2, loses: false, belowName: true });
    expect(pill?.speech).toContain("2 encounter cards facedown underneath");
  });
});

// The choice words read off a table: the record's own instruction at path 0, the window asking `seat`.
describe("the words of the choices", () => {
  const names = { card: (key: string) => key, code: (code: string) => code };
  const instructionOf = (id: string, at = 0): Instruction => EFFECTS.find((effect) => effect.id === id)!.instructions[at]!;
  const asking = (layout: Layout, id: string, code: string, seat: number): AskFacts => {
    const made = built(layout);
    const game = { ...made.state, window: { kind: "choose", seat, options: [] } } as unknown as ScenarioState;
    return { game, ctx: made.ctx, names: { card: (key) => made.cards.get(game.cards[key]?.code ?? key)?.name ?? key, code: names.code }, instruction: instructionOf(id), source: idOf(made.state, code) };
  };

  it("21042:A:3 the raise row arms the caution for the player who would be eliminated, not for the other", () => {
    const layout: Layout = { seats: 2, stage: "21077", threat: [30, 49], staging: ["21042"] };
    expect(asksOption(asking(layout, "21042:shadow:1", "21042", 1), "threat")?.caution).toBe("Tap again: Player 2 is eliminated. If no player is left, the game is lost");
    expect(asksOption(asking(layout, "21042:shadow:1", "21042", 0), "threat")?.caution).toBeUndefined();
  });

  it("21040:A:1 the raise row arms its caution when the active location's Threat takes a player to the elimination level, and says the number", () => {
    const near = asking({ stage: "21077", threat: [48, 30], active: "21037", staging: ["21040"] }, "21040:whenRevealed:1", "21040", 0);
    expect(asksOption(near, "threat")).toMatchObject({ label: "Each player raises threat by 2", caution: "Tap again: you are eliminated and the game is lost" });
    const far = asking({ stage: "21077", threat: [47, 30], active: "21037", staging: ["21040"] }, "21040:whenRevealed:1", "21040", 0);
    expect(asksOption(far, "threat")?.caution).toBeUndefined();
    const none = asking({ stage: "21077", threat: [49, 30], staging: ["21040"] }, "21040:whenRevealed:1", "21040", 0);
    expect(asksOption(none, "threat")).toMatchObject({ label: "Each player raises threat by 0 (no active location)" });
    expect(asksOption(none, "threat")?.caution).toBeUndefined();
    expect(asksOption(near, "attack")?.label).toContain("attacks Player 1 now (");
  });

  it("21039:A:1 the Secret Cultist's tie says how many allies tie and for what Attack", () => {
    const made = built({ stage: "21077", play: ["ally"] });
    made.cards.set("twin", allyCard("twin", 3, { attack: 4 }));
    const one = spawn(made.state, "twin", { zone: "play", seat: 0 });
    const two = spawn(one.state, "twin", { zone: "play", seat: 0 });
    const facts: AskFacts = { game: two.state, ctx: made.ctx, names: { card: (key) => made.cards.get(two.state.cards[key]?.code ?? key)?.name ?? key, code: names.code }, instruction: instructionOf("21039:whenRevealed:1"), source: "21039", options: [one.id, two.id] };
    expect(asksPick(facts)?.prompt).toContain("2 allies are tied for the highest Attack (4).");
  });

  it("21077:A:1 the Setup search rows show a location's Threat and quest points", () => {
    const made = built({ stage: "21077", seats: 1, staging: ["21037"] });
    const stats = rowStats(made.state, made.ctx, idOf(made.state, "21037"), ASKS["21077:setup:1 @0.0 SearchMove"]?.rowStats);
    expect(stats.map((stat) => [stat.icon, stat.value])).toEqual([["threat", 2], ["questPoints", 4]]);
  });
});
