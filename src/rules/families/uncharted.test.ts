// Rules: dcce.uncharted, dcce.uncharted-deck, dcce.setup-the-fate-of-numenor, rr.explored, rr.travel, rr.active-location, rr.quest-advancement, rr.winning-the-game (data/rules/entries.json). The
// Uncharted deck and its double-sided locations, on a table of plain-number heroes and the Campaign Expansion's cards (scripts/fate-scene.ts): the Lost Island side (Threat 2, no quest points,
// no player card attachments), the deck and its top cards, flipping on travel, the shuffle back, the quest card's progress, the stage that ends the game, and the Action that looks.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../constants.ts";
import { runInstruction } from "../interpret.ts";
import { modifiedStat } from "../keywords.ts";
import { settle } from "../machine.ts";
import { holds } from "../conditions.ts";
import { attachBlocked } from "../restrictions.ts";
import { questPointsOf, stagingThreat } from "../quest.ts";
import type { ScenarioState } from "../state.ts";
import { CODES, codesIn, fateTable, finish, idOf, idsOf, loadFateWorld, send, start, type FateLayout, type FateWorld, type Run } from "../../../scripts/fate-scene.ts";
import { AUTHORED_EFFECTS } from "../../effects/authored/the-fate-of-numenor.ts";
import { isLostIsland } from "./uncharted-pick.ts";

let world: FateWorld;

beforeAll(async () => {
  world = await loadFateWorld();
});

function make(layout: FateLayout = {}) {
  const made = fateTable(world, { calphon: "up", ...layout });
  return { ...made, state: syncConstants(made.state, made.ctx) };
}
type Table = ReturnType<typeof make>;

const L = (code: string, progress = 0) => ({ code, face: "B" as const, progress });
const stageCode = (state: ScenarioState) => state.cards[state.questStage ?? ""]?.code;
const faceOf = (state: ScenarioState, code: string) => state.cards[idOf(state, code)]?.face;
const deckCodes = (state: ScenarioState) => (state.uncharted?.deck ?? []).map((id) => state.cards[id]?.code);

// A verb run in the effect frame of the quest card, as its record would.
function run(made: Table, instruction: Parameters<typeof runInstruction>[1], state: ScenarioState = made.state): Run {
  const next = runInstruction({ ...state, window: null }, instruction, { seat: 0, sourceId: state.questStage }, made.ctx, []);
  return start(settle(syncConstants(next, made.ctx), made.ctx, []));
}

// The players travel to the card in the Travel phase and every question the arrival opens is answered (the first option by default).
function travel(made: Table, id: string, pick?: (state: ScenarioState) => string): Run {
  return finish(send(start(made.state), { type: "Travel", locationId: id }, made.ctx), made.ctx, pick);
}

// Progress placed by questing: the active location takes it first.
function quest(made: Table, progress: number, state: ScenarioState = made.state): Run {
  const next = runInstruction({ ...state, window: null }, { verb: "ProgressQuest", amount: progress }, { seat: 0, sourceId: state.questStage }, made.ctx, []);
  return finish(start(settle(syncConstants(next, made.ctx), made.ctx, [])), made.ctx);
}

describe("the Lost Island side (11030:B:1 to B:4, dcce.uncharted)", () => {
  it("prints Threat 2 and no quest points, so it cannot be explored by progress, and shows the real side's numbers once flipped", () => {
    const made = make({ staging: [L(CODES.lushJungle), CODES.lushJungle] });
    const [hidden, shown] = idsOf(made.state, CODES.lushJungle) as [string, string];
    const stat = (id: string, which: "threat" | "questPoints") => modifiedStat(made.state, made.state.cards[id]!, which, made.ctx.cards);
    expect(isLostIsland(made.state.cards[hidden]!, made.ctx)).toBe(true);
    expect(stat(hidden, "threat")).toBe(2);
    expect(questPointsOf(made.state, made.state.cards[hidden]!, made.ctx.cards)).toBeNull();
    expect(stat(shown, "threat")).toBe(4);
    expect(questPointsOf(made.state, made.state.cards[shown]!, made.ctx.cards)).toBe(4);
    // The staging area's Threat counts the side each card lies on: 2 for the Lost Island, 4 for the Lush Jungle.
    expect(stagingThreat(made.state, made.ctx.cards)).toBe(6);
  });

  it("cannot have player card attachments, but an encounter attachment is not barred (B:2)", () => {
    const made = make({ staging: [L(CODES.lushJungle), CODES.lushJungle] });
    const [hidden, shown] = idsOf(made.state, CODES.lushJungle) as [string, string];
    expect(attachBlocked(made.state, made.ctx, hidden, "blade")).toBe(true);
    expect(attachBlocked(made.state, made.ctx, shown, "blade")).toBe(false);
    expect(attachBlocked(made.state, made.ctx, hidden, CODES.ominousFate)).toBe(false);
  });
});

describe("an active location that contributes its Threat (11072:A:1)", () => {
  it("adds it to the staging area's, unless the card does not contribute its Threat", () => {
    const made = make({ active: { code: CODES.floodedRuins, face: "up" as const, progress: 0 } });
    const id = idOf(made.state, CODES.floodedRuins);
    const threat = (state: ScenarioState) => stagingThreat(state, made.ctx.cards);
    const printed = modifiedStat(made.state, made.state.cards[id]!, "threat", made.ctx.cards);
    expect(printed).toBeGreaterThan(0);
    expect(threat(made.state)).toBe(printed);
    const silent = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: id, sourceId: id, stat: "noThreatContribution" as const, amount: 1, until: "whileSourceInPlay" as const }] };
    expect(threat(silent)).toBe(0);
  });
});

describe("Explore the Island, Setup (11025:A:1, dcce.uncharted-deck)", () => {
  it("prepares the deck, adds 2 Lost Islands from the top (3 with 3 or 4 players), and brings Calphon into play under the first player", () => {
    const setup = AUTHORED_EFFECTS.find((effect) => effect.id === "11025:setup:1")!;
    const adds = setup.instructions.flatMap((instruction) => (instruction.verb === "AddLostIslands" ? [instruction] : []));
    expect(adds.map((instruction) => instruction.count)).toEqual([2, 3]);
    const made = make({ calphon: undefined, uncharted: [CODES.lushJungle, CODES.forbiddenCoast, CODES.floodedRuins, CODES.drownedGraves, CODES.cursedTemple], setAside: ["11028", CODES.shrine], phase: "Quest" });
    // The conditions: two players are "fewer than 3", so 2 copies join.
    const few = adds[0]?.when;
    const many = adds[1]?.when;
    expect(few && holds(made.state, few, { actor: 0, sourceId: null, returned: 0 }, made.ctx)).toBe(true);
    expect(many && holds(made.state, many, { actor: 0, sourceId: null, returned: 0 }, made.ctx)).toBe(false);
    const staged = run(made, { verb: "AddLostIslands", count: 2 });
    expect(staged.state.staging.map((id) => staged.state.cards[id]?.code)).toEqual([CODES.lushJungle, CODES.forbiddenCoast]);
    expect(staged.state.staging.every((id) => staged.state.cards[id]?.face === "B")).toBe(true);
    expect(deckCodes(staged.state)).toEqual([CODES.floodedRuins, CODES.drownedGraves, CODES.cursedTemple]);
    // Calphon is set aside by the scenario's piles and the Setup puts him into play under the first player.
    const put = run(made, { verb: "PutSetAsideInPlay", name: "Calphon" });
    expect(put.state.cards[idOf(put.state, "11028")]).toMatchObject({ zone: "play", controller: 0 });
  });

  it("prepares the Uncharted deck by shuffling it", () => {
    const codes = [CODES.lushJungle, CODES.forbiddenCoast, CODES.floodedRuins, CODES.drownedGraves, CODES.cursedTemple];
    const made = make({ uncharted: codes });
    const shuffled = run(made, { verb: "PrepareUnchartedDeck" });
    expect(deckCodes(shuffled.state).sort()).toEqual([...codes].sort());
    expect(deckCodes(shuffled.state)).not.toEqual(codes);
    // Every card in it lies Lost Island side up.
    expect((shuffled.state.uncharted?.deck ?? []).every((id) => shuffled.state.cards[id]?.face === "B" && shuffled.state.cards[id]?.zone === "unchartedDeck")).toBe(true);
  });
});

describe("Explore the Island, side B (11025:B:1 to B:3) and flipping (11030:B:3)", () => {
  it("adds a Lost Island when an Uncharted location becomes active, then flips that location, which loses its progress (11025:B:3, 11030:B:3)", () => {
    const made = make({ phase: "Travel", uncharted: [CODES.drownedGraves, CODES.cursedTemple], staging: [L(CODES.floodedRuins, 3)] });
    const island = idOf(made.state, CODES.floodedRuins);
    const arrived = travel(made, island);
    const state = arrived.state;
    expect(state.activeLocation).toBe(island);
    // The stage's Forced effect resolved before the Lost Island's own: one more Lost Island joined the staging area from the top of the deck.
    expect(state.staging.map((id) => state.cards[id]?.code)).toEqual([CODES.drownedGraves]);
    expect(deckCodes(state)).toEqual([CODES.cursedTemple]);
    // The location was flipped over, bare of progress, and now shows its real side: Flooded Ruins, Threat 3, 5 quest points.
    expect(state.cards[island]).toMatchObject({ face: "A", progress: 0 });
    expect(questPointsOf(state, state.cards[island]!, made.ctx.cards)).toBe(5);
    // Flooded Ruins contributes its Threat to the staging area while active (11072:A:1): 3 for it and 2 for the Lost Island.
    expect(stagingThreat(state, made.ctx.cards)).toBe(5);
  });

  it("does not add a Lost Island when a location that is not Uncharted becomes active", () => {
    const made = make({ phase: "Travel", uncharted: [CODES.drownedGraves], staging: [CODES.steepPlateau] });
    const arrived = travel(made, idOf(made.state, CODES.steepPlateau));
    expect(arrived.state.activeLocation).toBe(idOf(made.state, CODES.steepPlateau));
    expect(deckCodes(arrived.state)).toEqual([CODES.drownedGraves]);
  });

  it("puts no questing progress on the quest card, and the progress left after the location is full is lost (11025:B:1)", () => {
    const made = make({ active: { code: "place", progress: 0 }, staging: [], progress: 0 });
    const done = quest(made, 5);
    // The 2-point location was explored; the 3 left over did not reach the stage, which holds only the 2 quest points its Forced effect added.
    expect(done.state.cards[done.state.questStage ?? ""]?.progress).toBe(2);
    const empty = quest(make({ staging: [], progress: 0 }), 5);
    expect(empty.state.cards[empty.state.questStage ?? ""]?.progress).toBe(0);
  });

  it("adds the explored location's printed quest points to the stage, and a double-sided one goes back into the Uncharted deck, Lost Island side up (11025:B:2, dcce.uncharted)", () => {
    const made = make({ active: { code: CODES.lushJungle, face: "up", progress: 3 }, uncharted: [CODES.drownedGraves, CODES.cursedTemple] });
    const done = quest(made, 1);
    const state = done.state;
    expect(state.activeLocation).toBeNull();
    // Lush Jungle has 4 quest points.
    expect(state.cards[state.questStage ?? ""]?.progress).toBe(4);
    expect(state.uncharted?.deck.map((id) => state.cards[id]?.code).sort()).toEqual([CODES.cursedTemple, CODES.drownedGraves, CODES.lushJungle].sort());
    expect(state.cards[idOf(state, CODES.lushJungle)]).toMatchObject({ zone: "unchartedDeck", face: "B", progress: 0 });
    expect(codesIn(state, "encounterDiscard")).toEqual([]);
  });

  it("counts a location explored in the staging area too (\"after a location is explored\", 11025:B:2)", () => {
    const made = make({ staging: [{ code: CODES.lushJungle, face: "up" as const, progress: 0 }], uncharted: [CODES.drownedGraves] });
    const done = finish(run(made, { verb: "PlaceProgressOn", amount: 4, target: "eachStagingLocation" }), made.ctx);
    expect(done.state.cards[done.state.questStage ?? ""]?.progress).toBe(4);
    expect(done.state.cards[idOf(done.state, CODES.lushJungle)]?.zone).toBe("unchartedDeck");
  });

  it("adds the printed quest points of a single-sided location too, and the stage advances at 20 (11025:B:2)", () => {
    const made = make({ active: { code: CODES.steepPlateau, progress: 2 }, progress: 18, uncharted: [CODES.lushJungle, CODES.forbiddenCoast, CODES.floodedRuins], setAside: [CODES.shrine] });
    const done = quest(made, 1);
    const state = done.state;
    expect(codesIn(state, "encounterDiscard")).toEqual([CODES.steepPlateau]);
    expect(stageCode(state)).toBe("11026");
    // A Fateful Discovery is revealed: 2 more Lost Islands and the Shrine to Morgoth, Lost Island side up, join the staging area (11026:A:1).
    expect(state.staging.map((id) => state.cards[id]?.code).sort()).toEqual([CODES.forbiddenCoast, CODES.lushJungle, CODES.shrine].sort());
    expect(state.staging.every((id) => state.cards[id]?.face === "B")).toBe(true);
    expect(deckCodes(state)).toEqual([CODES.floodedRuins]);
  });
});

describe("A Fateful Discovery (11026:A:1, 11026:B:1, 11026:B:2)", () => {
  it("removes all progress from the Lost Islands in the staging area and shuffles their places (11026:A:1, 11035:A:2)", () => {
    const names = [CODES.lushJungle, CODES.forbiddenCoast, CODES.floodedRuins, CODES.drownedGraves, CODES.cursedTemple];
    const staging = [L(names[0]!, 2), CODES.steepPlateau, L(names[1]!, 4), L(names[2]!, 1), CODES.fog, L(names[3]!), L(names[4]!, 3)];
    const made = make({ staging });
    const before = made.state.staging.map((id) => made.state.cards[id]?.code);
    const after = run(made, { verb: "ScrambleUncharted" }).state;
    const codes = after.staging.map((id) => after.cards[id]?.code);
    // Only the cards behind the Lost Islands change, among themselves; every instance stays at its place, so the shuffle cannot be followed; none keeps its progress.
    expect(after.staging).toEqual(made.state.staging);
    expect(codes[1]).toBe(CODES.steepPlateau);
    expect(codes[4]).toBe(CODES.fog);
    expect([...codes].sort()).toEqual([...before].sort());
    expect(codes).not.toEqual(before);
    expect(after.staging.every((id) => (after.cards[id]?.progress ?? 0) === 0)).toBe(true);
    // The seed decides the order: the same table gives the same result.
    expect(run(make({ staging }), { verb: "ScrambleUncharted" }).state.staging.map((id) => after.cards[id]?.code)).toEqual(codes);
  });

  it("sends an explored double-sided location to the victory display instead of the Uncharted deck (11026:B:1)", () => {
    const made = make({ stage: "11026", active: { code: CODES.lushJungle, progress: 3 }, uncharted: [CODES.floodedRuins] });
    const done = quest(made, 1);
    expect(codesIn(done.state, "victory")).toEqual([CODES.lushJungle]);
    expect(deckCodes(done.state)).toEqual([CODES.floodedRuins]);
  });

  it("puts a location explored in the staging area in the victory display on its real side, face A (11026:B:1)", () => {
    const made = make({ stage: "11026", staging: [{ code: CODES.lushJungle, face: "up" as const, progress: 0 }], uncharted: [CODES.floodedRuins] });
    const done = finish(run(made, { verb: "PlaceProgressOn", amount: 4, target: "eachStagingLocation" }), made.ctx);
    expect(codesIn(done.state, "victory")).toEqual([CODES.lushJungle]);
    expect(done.state.cards[idOf(done.state, CODES.lushJungle)]).toMatchObject({ zone: "victory", face: "A" });
    expect(deckCodes(done.state)).toEqual([CODES.floodedRuins]);
  });

  it("wins the game when the Shrine to Morgoth is added to the victory display, and not before (11026:B:2)", () => {
    const made = make({ stage: "11026", active: { code: CODES.shrine, progress: 7 }, uncharted: [CODES.floodedRuins] });
    expect(made.state.lost).toBe(false);
    expect(made.state.stageCleared).toBe(false);
    const done = quest(made, 1);
    expect(codesIn(done.state, "victory")).toEqual([CODES.shrine]);
    expect(done.state.stageCleared).toBe(true);
    // A stage with no quest points is not defeated by progress alone.
    const room = make({ stage: "11026", active: { code: "place" }, progress: 0 });
    expect(questPointsOf(room.state, room.state.cards[room.state.questStage ?? ""]!, room.ctx.cards)).toBeNull();
    expect(quest(room, 9).state.stageCleared).toBe(false);
  });
});

describe("Action: remove 4 progress from Lost Island to look at its facedown side (11030:B:4, dcce.uncharted)", () => {
  it("is offered only with 4 progress on the Lost Island, takes the progress, and shows the facedown side without turning the card or triggering it", () => {
    const few = make({ staging: [L(CODES.lushJungle, 3)] });
    const enough = make({ staging: [L(CODES.lushJungle, 5)], phase: "Planning" });
    const island = idOf(enough.state, CODES.lushJungle);
    const offered = (table: Table) => ((): string[] => {
      const effects = table.ctx.effects.filter((effect) => effect.cardCode === CODES.lushJungle && effect.timing === "action");
      return effects.filter((effect) => effect.condition == null || holds(table.state, effect.condition, { actor: 0, sourceId: idOf(table.state, CODES.lushJungle), returned: 0 }, table.ctx)).map((effect) => effect.id);
    })();
    expect(offered(few)).toEqual([]);
    expect(offered(enough)).toEqual(["11030:action:1"]);
    const effect = enough.ctx.effects.find((item) => item.id === "11030:action:1")!;
    const frame = runInstruction({ ...enough.state, window: null }, effect.instructions[0]!, { seat: 0, sourceId: island }, enough.ctx, []);
    expect(frame.window).toMatchObject({ kind: "look", cardIds: [island], side: "A" });
    expect(frame.cards[island]).toMatchObject({ face: "B", progress: 1 });
    // The Forced effects of the other side did not happen and the card did not flip: nothing was queued for it.
    expect(frame.pendingEvents ?? []).toEqual([]);
    expect(frame.activeLocation).toBeNull();
  });
});

describe("the Uncharted deck is hidden information", () => {
  it("shows every Lost Island alike (side B) and flips only when the location becomes active", () => {
    const made = make({ phase: "Travel", uncharted: [CODES.cursedTemple], staging: [L(CODES.lushJungle), L(CODES.forbiddenCoast)] });
    for (const id of made.state.staging) expect(made.state.cards[id]?.face).toBe("B");
    const hidden = idOf(made.state, CODES.forbiddenCoast);
    const arrived = travel(made, hidden, (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    expect(faceOf(arrived.state, CODES.forbiddenCoast)).toBe("A");
    expect(faceOf(arrived.state, CODES.lushJungle)).toBe("B");
  });
});
