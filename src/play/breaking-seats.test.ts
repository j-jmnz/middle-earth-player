// Rules: mec109.multiple-staging-areas, rr.player-elimination, rr.travel (data/rules/entries.json). What the table says about whose area, stage and dial it draws
// once stage 2B has split the table (Breaking of the Fellowship): the owner labels, the dials' own ticks, the quest advance screen's seat, a peek's hint, the quest
// scale's seat, a fallen hero's preview line, the choice words naming the first player's seat and the outcome lines for a seat's travel and an enemy sent away.
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../catalog/boundary.ts";
import { moveCard } from "../rules/zones.ts";
import { withSeat } from "../rules/state.ts";
import { printedOf } from "../rules/printed.ts";
import { loadBreakingWorld, makeBreaking, type BreakingLayout, type BreakingWorld } from "../../scripts/breaking-scene.ts";
import { first } from "../../scripts/past-scene.ts";

import { areaWords, seatTag, stagingWord } from "./area-words.ts";
import { breakingBranchWords, breakingPickWords, breakingWords } from "./breaking-words.ts";
import { standInText } from "./dungeon-preview.ts";
import { moriaWords } from "./moria-words.ts";
import { momentOf } from "./outcome.ts";
import { seatDial } from "./peek.ts";
import { advancedTo, advanceWords } from "./quest-advance.ts";
import { questScaleOf } from "./quest-scale.ts";
import { dialTicksSelector } from "./selectors.ts";
import type { TableMoment } from "./store.ts";

let world: BreakingWorld;

beforeAll(async () => {
  world = await loadBreakingWorld();
}, 60_000);

const heroes = [["strong"], ["weak"]] as const;
const make = (layout: BreakingLayout = {}) => makeBreaking(world, { seats: 2, stage: "separate", frodo: false, heroes, threats: [30, 30], ...layout });
const nameOf = (code: string) => world.cards.get(code)?.name ?? code;

describe("whose area the table draws", () => {
  it("labels the staging row with the seat while the table is split between players, and not in true solo or before the split", () => {
    const pair = make();
    expect(seatTag(pair.state, 1)).toBe("P2");
    expect(stagingWord(pair.state, 1)).toBe("P2 staging");
    const solo = make({ seats: 1, heroes: [["strong"]] });
    expect(seatTag(solo.state, 0)).toBeNull();
    expect(stagingWord(solo.state, 0)).toBe("Staging");
    const shared = makeBreaking(world, { seats: 2, stage: 2, heroes, threats: [30, 30] });
    expect(stagingWord(shared.state, 0)).toBe("Staging");
  });

  it("says the stage in the area's words", () => {
    const pair = make({ stages: ["142063", "142064"] });
    expect(areaWords(pair.state, 1, nameOf)).toContain(`Stage ${nameOf("142064")}`);
  });

  it("puts the seat on the quest scale", () => {
    const pair = make();
    expect(questScaleOf(pair.state, pair.ctx, null).seat).toBe(0);
    const solo = make({ seats: 1, heroes: [["strong"]] });
    expect(questScaleOf(solo.state, solo.ctx, null).seat).toBeNull();
  });
});

describe("a dial's ticks", () => {
  it("are its own seat's staging area once stages are separate, and the one staging area's before", () => {
    const pair = make({ areas: [["grunt"], ["brute", "scout"]] });
    const ticks = dialTicksSelector(pair.ctx)(pair.state).split("|");
    expect(ticks).toEqual(["10", "20,40"]);
    const shared = makeBreaking(world, { seats: 2, stage: 2, heroes, threats: [30, 30], staging: ["grunt", "scout"] });
    expect(dialTicksSelector(shared.ctx)(shared.state)).toBe("10,20|10,20");
  });

  it("a dial that is not shown says it shows the seat's area once the table is split", () => {
    expect(seatDial(2, 0, null, 1, true).hint).toBe("Shows Player 2's area");
    expect(seatDial(2, 0, null, 1).hint).toBe("Shows Player 2's cards");
    expect(seatDial(2, 0, null, 0, true).hint).toBeNull();
  });
});

describe("the quest advance screen", () => {
  it("reads the stage as the seat that holds it, and names the seat in two-handed play", () => {
    const pair = make({ stages: ["142063", "142064"] });
    const [one, two] = [pair.state.seats[0].stage ?? "", pair.state.seats[1].stage ?? ""];
    const words = advanceWords(pair.state, pair.ctx, two, nameOf("142064"), () => null);
    expect(words.eyebrow?.startsWith("Player 2 · Stage ")).toBe(true);
    expect(advanceWords(pair.state, pair.ctx, one, nameOf("142063"), () => null).eyebrow?.startsWith("Player 1 · Stage ")).toBe(true);
    const solo = make({ seats: 1, heroes: [["strong"]], stages: ["142063"] });
    expect(advanceWords(solo.state, solo.ctx, solo.state.seats[0].stage ?? "", nameOf("142063"), () => null).eyebrow?.startsWith("Stage ")).toBe(true);
  });

  it("keeps each seat's advance when one intent advances two", () => {
    const pair = make({ stages: ["142063", "142064"] });
    const [one, two] = [pair.state.seats[0].stage ?? "", pair.state.seats[1].stage ?? ""];
    const moment: TableMoment = { seq: 3, kind: "sent", before: pair.state, after: pair.state, steps: [{ kind: "advance", cardId: one }, { kind: "advance", cardId: two }] };
    const reached = advancedTo(moment, { questStage: null, seatStages: `${one}|${two}` });
    expect(reached).toEqual({ seq: 3, stageId: two, also: [one] });
    const words = advanceWords(pair.state, pair.ctx, two, nameOf("142064"), () => null, reached?.also, nameOf);
    expect(words.also).toEqual([`Player 1 advanced to ${nameOf("142063")}`]);
  });
});

describe("the choice words", () => {
  it("name the first player's seat in two-handed play", () => {
    const pair = make();
    const lead = withSeat({ ...pair.state, firstPlayer: 1 }, 1, pair.state.seats[1]);
    const names = { code: nameOf, card: (id: string) => id };
    expect(breakingWords({ verb: "MoveToFirstStaging", target: "picked" }, names, lead)).toBe("move it to Player 2's staging area (first player)");
    expect(breakingWords({ verb: "FallIntoEvil" }, names, lead)).toBe("the attached hero becomes an enemy in Player 2's staging area (first player)");
    const move: Instruction[] = [{ verb: "Pick", pick: { type: "enemy", control: "you", engaged: "you" } }, { verb: "MoveToFirstStaging", target: "picked" }];
    expect(breakingBranchWords(move, names, null, lead)).toBe("Move an enemy engaged with you to Player 2's staging area (first player)");
    expect(breakingPickWords(move[0]!, move[1], lead)?.prompt).toBe("Choose an enemy engaged with you to move to Player 2's staging area (first player).");
    const solo = make({ seats: 1, heroes: [["strong"]] });
    expect(breakingWords({ verb: "MoveToFirstStaging", target: "picked" }, names, solo.state)).toBe("move it to the first player's staging area");
  });

  it("Place Damage On says one damage token in the singular", () => {
    const names = { code: nameOf };
    expect(moriaWords({ verb: "PlaceDamageOn", code: "142030", amount: 1 }, names)).toBe(`place 1 damage token on ${nameOf("142030")}`);
    expect(moriaWords({ verb: "PlaceDamageOn", code: "142030", amount: 2 }, names)).toBe(`place 2 damage tokens on ${nameOf("142030")}`);
  });
});

describe("a hero Fallen Into Evil in the preview", () => {
  it("says it is an enemy now, with its enemy stats", () => {
    const text = standInText(world.cards, "strong~enemy");
    const printed = printedOf(world.cards, "strong~enemy");
    expect(text).toBe(`Fallen into evil: an enemy now. Attack ${printed.attack}, Defense ${printed.defense}, ${printed.health} hit points, Threat ${printed.threat}.`);
    expect(standInText(world.cards, "strong")).toBeNull();
  });
});

describe("the outcome of a split table", () => {
  it("names the seat that traveled", () => {
    const pair = make({ staging: [], areas: [[], ["place"]] });
    const place = first(pair.state, "place");
    const traveled = withSeat(moveCard(pair.state, place, { zone: "activeLocation", seat: 1 }), 1, { ...pair.state.seats[1], active: place });
    const moment = momentOf(pair.state, { ...traveled, seats: [traveled.seats[0], { ...traveled.seats[1], active: place }] }, [], { card: (id) => pair.state.cards[id]?.code ?? id });
    expect(moment?.title).toBe("Player 2 traveled to place");
  });

  it("says where an enemy went when it left another seat's engagement area", () => {
    const pair = make({ engaged: [{ code: "grunt", seat: 1 }] });
    const grunt = first(pair.state, "grunt");
    const after = moveCard(pair.state, grunt, { zone: "staging", area: 0 });
    const moment = momentOf(pair.state, after, [], { card: (id) => pair.state.cards[id]?.code ?? id });
    expect(moment?.title).toBe("grunt leaves Player 2");
    expect(moment?.lines.map((line) => line.text)).toContain("It is in Player 1's staging area now");
  });
});
