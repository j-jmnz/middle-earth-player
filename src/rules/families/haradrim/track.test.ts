// Rules: hrd.track, hrd.track-example, hrd.search-objective, rr.running-out-of-cards (data/rules/entries.json); ledger lines 17069:A:1, 17075:A:1, 17075:A:2, 17080:A:1, 17068:A:3. Beneath the Sands' Search objective on its own: each verb of the haradrim family's track.ts.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";
import { codesIn, idOf, opened, run, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const OFF = "17079";
const ON = "17080";
const MARKED = ["17066", "17067", "17069", "17070", "17072"];
const BLOCK = { instanceId: "table", sourceId: "table", stat: "cannotFlipSearch", amount: 1, until: "endOfGame" } as const;
const table = (layout: Layout = {}) => tableFromLayout("beneath-the-sands", { seats: 1, stage: "17076", side: "B", ...layout });
const flip = (to: "onTrack" | "offTrack", despiteBlock?: true): Effect["instructions"][number] => ({ verb: "FlipSearchObjective", to, ...(despiteBlock ? { despiteBlock } : {}) });
const withBlock = (state: ScenarioState): ScenarioState => ({ ...state, modifiers: [...state.modifiers, BLOCK] });
const discarded = (state: ScenarioState): string[] => codesIn(state, "encounterDiscard").sort();
const side = (state: ScenarioState, id: string): string | undefined => state.cards[id]?.code;
const flippedEvents = (state: ScenarioState): number => (state.pendingEvents ?? []).filter((event) => event.trigger === "searchFlippedOff").length;

describe("FlipSearchObjective: the Search objective shows its other side", () => {
  it("Off Track flips to On Track, discarding each resource on it, and queues no event", () => {
    const made = table({ staging: [{ code: OFF, resources: 3 }] });
    const id = idOf(made.state, OFF);
    const done = run(made, opened(made).state, flip("onTrack"));
    expect(done.cards[id]).toMatchObject({ code: ON, other: OFF, resources: 0, zone: "staging" });
    expect(flippedEvents(done)).toBe(flippedEvents(opened(made).state));
  });

  it("On Track flips to Off Track and keeps its place", () => {
    const made = table({ staging: [ON] });
    const done = run(made, opened(made).state, flip("offTrack"));
    expect(side(done, idOf(made.state, ON))).toBe(OFF);
  });

  it("a flip to the side already up changes nothing", () => {
    const made = table({ staging: [{ code: OFF, resources: 2 }] });
    const state = opened(made).state;
    const done = run(made, state, flip("offTrack"));
    expect(done.cards[idOf(state, OFF)]).toMatchObject({ code: OFF, resources: 2 });
    expect(flippedEvents(done)).toBe(flippedEvents(state));
  });

  it("while cannotFlipSearch is held the objective does not flip either way, unless the card's own text flips it", () => {
    const off = table({ staging: [{ code: OFF, resources: 1 }] });
    const blocked = withBlock(opened(off).state);
    expect(flagged(blocked, "table", "cannotFlipSearch")).toBe(true);
    expect(side(run(off, blocked, flip("onTrack")), idOf(blocked, OFF))).toBe(OFF);
    expect(side(run(off, blocked, flip("onTrack", true)), idOf(blocked, OFF))).toBe(ON);
    const on = table({ staging: [ON] });
    const onBlocked = withBlock(opened(on).state);
    expect(side(run(on, onBlocked, flip("offTrack")), idOf(onBlocked, ON))).toBe(ON);
    expect(side(run(on, onBlocked, flip("offTrack", true)), idOf(onBlocked, ON))).toBe(OFF);
  });
});

describe("17078:B:2 searchFlippedOff: only a flip to Off Track is heard", () => {
  it("a flip to Off Track removes all progress from the stage, a flip to On Track leaves it", () => {
    const off = table({ stage: "17078", side: "B", progress: 4, staging: [ON] });
    const offState = opened(off).state;
    expect(run(off, offState, flip("offTrack")).cards[off.state.questStage ?? ""]?.progress).toBe(0);
    const on = table({ stage: "17078", side: "B", progress: 4, staging: [OFF] });
    const onState = opened(on).state;
    expect(run(on, onState, flip("onTrack")).cards[on.state.questStage ?? ""]?.progress).toBe(4);
  });
});

describe("17069:A:1 ResolveTrack: X cards are discarded and a marked card flips the objective", () => {
  const track = (amount: number): Effect["instructions"][number] => ({ verb: "ResolveTrack", amount, marked: MARKED });

  it("discards X cards from the top, and a marked one among them flips Off Track to On Track", () => {
    const made = table({ staging: [OFF], deck: ["16047", "17070", "16046", "16046"] });
    const state = opened(made).state;
    const done = run(made, state, track(3));
    expect(discarded(done)).toEqual(["16047", "17070", "16046"].sort());
    expect(side(done, idOf(state, OFF))).toBe(ON);
    expect(done.encounterDeck).toHaveLength(1);
  });

  it("with no marked card among them the objective stays Off Track", () => {
    const made = table({ staging: [OFF], deck: ["16047", "16046", "17070"] });
    const done = run(made, opened(made).state, track(2));
    expect(discarded(done)).toEqual(["16047", "16046"].sort());
    expect(side(done, idOf(made.state, OFF))).toBe(OFF);
  });

  it("an empty deck gets the discard pile shuffled in, in any phase, and the discard goes on (hrd.track-example)", () => {
    const made = table({ staging: [OFF], phase: "Travel", deck: ["16047"], discard: ["16046", "16046"] });
    const state = opened(made).state;
    const done = run(made, state, track(3));
    expect(done.encounterDeck).toHaveLength(1);
    expect(done.encounterDiscard).toHaveLength(2);
  });

  it("a marked card discarded before the shuffle still counts", () => {
    const made = table({ staging: [OFF], phase: "Travel", deck: ["17067"], discard: ["16046", "16046"] });
    const done = run(made, opened(made).state, track(3));
    expect(side(done, idOf(made.state, OFF))).toBe(ON);
  });

  it("a deck and a discard pile that both run out stop the discard", () => {
    const made = table({ staging: [OFF], deck: ["16047"] });
    const done = run(made, opened(made).state, track(3));
    expect(discarded(done)).toEqual(["16047"].sort());
  });

  it("17075:A:1 while Lost Underground is in play the Track keyword does not resolve at all: no card is discarded", () => {
    const made = table({ staging: [OFF], deck: ["17070", "16046"] });
    const blocked = withBlock(opened(made).state);
    const done = run(made, blocked, track(1));
    expect(discarded(done)).toEqual([]);
    expect(done.encounterDeck).toHaveLength(2);
    expect(side(done, idOf(blocked, OFF))).toBe(OFF);
  });
});

describe("17080:A:1 StageMarkedFromTop: the first marked card of the top cards is added to the staging area", () => {
  const search: Effect["instructions"][number] = { verb: "StageMarkedFromTop", count: 3, marked: MARKED };

  it("adds the first marked card, not revealed, and discards the rest of the top cards", () => {
    const made = table({ staging: [ON], deck: ["16047", "17072", "17066", "16046", "16046"] });
    const state = opened(made).state;
    const done = run(made, state, search);
    expect(codesIn(done, "staging")).toContain("17072");
    expect(discarded(done)).toEqual(["16047", "17066"].sort());
    expect(done.encounterDeck).toHaveLength(2);
    expect(side(done, idOf(state, ON))).toBe(ON);
  });

  it("with no marked card the top cards are discarded and the objective flips to Off Track", () => {
    const made = table({ staging: [ON], deck: ["16047", "16046", "16046", "17070"] });
    const state = opened(made).state;
    const done = run(made, state, search);
    expect(discarded(done)).toEqual(["16047", "16046", "16046"].sort());
    expect(side(done, idOf(state, ON))).toBe(OFF);
  });

  it("a deck of fewer cards is looked at in full, with no shuffle", () => {
    const made = table({ staging: [ON], deck: ["16047"], discard: ["17070"] });
    const state = opened(made).state;
    const done = run(made, state, search);
    expect(codesIn(done, "encounterDiscard").sort()).toEqual(["16047", "17070"]);
    expect(side(done, idOf(state, ON))).toBe(OFF);
  });
});

describe("17079:A:1 AddTopmostFromDiscard: the location put on the discard pile last returns to the staging area", () => {
  it("takes the last location of the discard pile, not the last card", () => {
    const made = table({ staging: [OFF], discard: ["17071", "17068", "16047", "16054"] });
    const done = run(made, opened(made).state, { verb: "AddTopmostFromDiscard", cardType: "location" });
    expect(codesIn(done, "staging")).toContain("17068");
    expect(discarded(done)).toEqual(["17071", "16047", "16054"].sort());
  });

  it("with no location in the discard pile nothing happens", () => {
    const made = table({ staging: [OFF], discard: ["16047"] });
    const state = opened(made).state;
    expect(codesIn(run(made, state, { verb: "AddTopmostFromDiscard", cardType: "location" }), "encounterDiscard")).toEqual(["16047"]);
  });
});

describe("17068:A:3 SetAsideCode: the card in play with the code goes out of play", () => {
  it("sets Brood Mother aside from the staging area and from an engagement, with no damage", () => {
    const staged = table({ staging: ["17065"] });
    expect(codesIn(run(staged, opened(staged).state, { verb: "SetAsideCode", code: "17065" }), "setAside")).toContain("17065");
    const engaged = table({ engaged: [{ code: "17065", damage: 0 }] });
    const done = run(engaged, opened(engaged).state, { verb: "SetAsideCode", code: "17065" });
    expect(codesIn(done, "setAside")).toContain("17065");
    expect(done.seats[0]?.engaged).toEqual([]);
  });

  it("changes nothing when no card has the code in play", () => {
    const made = table({ setAside: ["17065"] });
    const state = opened(made).state;
    expect(run(made, state, { verb: "SetAsideCode", code: "17065" }).setAside).toEqual(state.setAside);
  });
});

describe("hrd.track the steps that tell Track and the flips", () => {
  it("17069:A:1 ResolveTrack pushes one track step: the discarded cards, those that print On Track, and whether the objective flipped", () => {
    const made = table({ staging: ["17070", OFF], deck: ["16047", "17067", "16046"] });
    const steps: EngineStep[] = [];
    const state = opened(made).state;
    const done = run(made, state, { verb: "ResolveTrack", amount: 2, marked: MARKED }, { steps, sourceId: idOf(state, "17070") });
    const step = steps.find((item) => item.kind === "track");
    expect(step).toMatchObject({ kind: "track", locationId: idOf(state, "17070"), amount: 2, discarded: [expect.any(String), expect.any(String)], flipped: true });
    expect(step?.kind === "track" ? step.marked.map((id) => done.cards[id]?.code) : []).toEqual(["17067"]);
    // The flip to On Track is told by the track step, not by a second step.
    expect(steps.filter((item) => item.kind === "searchFlip")).toHaveLength(0);
  });

  it("17069:A:1 a Track with no marked card says it flipped nothing, and a blocked Track pushes no step", () => {
    const made = table({ staging: [OFF], deck: ["16047", "16046"] });
    const steps: EngineStep[] = [];
    run(made, opened(made).state, { verb: "ResolveTrack", amount: 2, marked: MARKED }, { steps });
    expect(steps.find((item) => item.kind === "track")).toMatchObject({ marked: [], flipped: false });
    const blocked: EngineStep[] = [];
    run(made, withBlock(opened(made).state), { verb: "ResolveTrack", amount: 2, marked: MARKED }, { steps: blocked });
    expect(blocked.filter((item) => item.kind === "track")).toHaveLength(0);
  });

  it("17073:A:1 each flip that happens is a searchFlip step, and a flip that changes nothing is none", () => {
    const made = table({ staging: [ON] });
    const state = opened(made).state;
    const steps: EngineStep[] = [];
    run(made, state, flip("offTrack"), { steps });
    expect(steps.filter((item) => item.kind === "searchFlip")).toEqual([expect.objectContaining({ kind: "searchFlip", to: "offTrack", cardId: idOf(state, ON) })]);
    const quiet: EngineStep[] = [];
    run(made, state, flip("onTrack"), { steps: quiet });
    expect(quiet.filter((item) => item.kind === "searchFlip")).toHaveLength(0);
    const blocked: EngineStep[] = [];
    run(made, withBlock(state), flip("offTrack"), { steps: blocked });
    expect(blocked.filter((item) => item.kind === "searchFlip")).toHaveLength(0);
  });

  it("17080:A:1 StageMarkedFromTop with no marked card flips the objective to Off Track and says so", () => {
    const made = table({ staging: [ON], deck: ["16047", "16046", "16046"] });
    const steps: EngineStep[] = [];
    run(made, opened(made).state, { verb: "StageMarkedFromTop", count: 3, marked: MARKED }, { steps });
    expect(steps.filter((item) => item.kind === "searchFlip")).toHaveLength(1);
  });
});
