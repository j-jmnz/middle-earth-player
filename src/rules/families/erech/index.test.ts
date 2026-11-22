// Rules: docs/scenarios/standalone-scenarios.md (The Stone of Erech); ledger lines 50301:A:1, 50302:A:1, 50304:A:1, 50308:A:1, 50308:A:2, 50309:A:2, 50310:A:1, 50317:A:2, 50321:A:1, 50324:A:1, 50303:B:2, 50312:A:2, 50302:B:1, 50311:A:1. The erech family's verbs, flags and conditions on the scenario's own opening: the Night objectives and
// their passive check, Derufin attached to the Stone and freed to the first player, the hand passed to the left, and the table flags (no quest progress, no planning phase, no collection, no events, lost icons).
import { beforeAll, describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { settle } from "../../engine/machine.ts";
import { reduce } from "../../engine/reduce.ts";
import { holds } from "../../interpret/conditions.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { crossBoundary } from "../../windows/triggers.ts";
import { familyPlayBarred } from "../../interpret/family-hooks.ts";
import { heroPays } from "../../player/payments.ts";
import type { Instruction } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../core/state.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { attackStrength } from "../../combat/combat.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { definePrinted } from "../../core/printed.ts";
import { encounterStart, encounterWorld, kept, type EncounterWorld } from "../../../../scripts/card-smoke/encounter-world.ts";
import { probeTable } from "../../../../scripts/card-smoke/encounter.ts";
import { currentQuestHas } from "../quest/conditions.ts";
import { nightCard } from "./night.ts";

let world: EncounterWorld;
let table: ScenarioState;
const ctxOf = () => world.contexts.strong;

beforeAll(async () => {
  world = await encounterWorld("the-stone-of-erech");
  table = probeTable(world);
});

const run = (state: ScenarioState, instruction: Instruction, sourceId: string | null = null, steps: EngineStep[] = []) => runInstruction(state, instruction, { seat: 0, sourceId }, ctxOf(), steps);
const quiet = (state: ScenarioState): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, ctxOf(), []);
const at = (state: ScenarioState, code: string) => Object.values(state.cards).find((card) => card.code === code);
const night = (state: ScenarioState, is: "dusk" | "midnight" | "duskOrMidnight") => holds(state, { kind: "night", is }, { actor: 0, sourceId: null, returned: 0 }, ctxOf());
// The Night in play moved on to the one with this code: Eventide to the victory display, the rest set aside.
function nightIs(state: ScenarioState, code: string): ScenarioState {
  const current = nightCard(state);
  const left = current ? moveCard(state, current.id, { zone: "victory" }) : state;
  return syncConstants(run(left, { verb: "PutNightObjective", code }), ctxOf());
}

describe("50301:A:1 the Night slot", () => {
  it("holds Eventide from Setup, with Dusk and Midnight and the rest set aside", () => {
    expect(nightCard(table)?.code).toBe("50308");
    expect(at(table, "50309")?.zone).toBe("setAside");
    expect(at(table, "50310")?.zone).toBe("setAside");
    expect(at(table, "50304")?.zone).toBe("setAside");
    expect(night(table, "duskOrMidnight")).toBe(false);
  });

  it("is in play and controlled by nobody: its constants are live", () => {
    expect(nightCard(table)?.controller).toBeNull();
    expect(syncConstants(table, ctxOf()).cards[nightCard(table)?.id ?? ""]?.zone).toBe("nightObjective");
  });

  it("puts a card in only while no other Night objective lies there", () => {
    expect(nightCard(run(table, { verb: "PutNightObjective", code: "50309" }))?.code).toBe("50308");
  });
});

describe("the night condition (50309:A:2, 50310:A:1)", () => {
  it("reads the Night in play: Dusk, Midnight, or either", () => {
    const dusk = nightIs(table, "50309");
    expect([night(dusk, "dusk"), night(dusk, "midnight"), night(dusk, "duskOrMidnight")]).toEqual([true, false, true]);
    const midnight = nightIs(table, "50310");
    expect([night(midnight, "dusk"), night(midnight, "midnight"), night(midnight, "duskOrMidnight")]).toEqual([false, true, true]);
  });
});

describe("50308:A:2 and 50309:A:2 the passive check", () => {
  it("does nothing below 4 progress", () => {
    const three = quiet(run(table, { verb: "PlaceNightProgress", amount: 3 }));
    expect(nightCard(three)?.code).toBe("50308");
    expect(nightCard(three)?.progress).toBe(3);
  });

  it("sends Eventide to the victory display with its progress at 4 and puts Dusk in play with none", () => {
    const four = quiet(run(table, { verb: "PlaceNightProgress", amount: 4 }));
    const eventide = at(four, "50308");
    expect(eventide?.zone).toBe("victory");
    expect(eventide?.progress).toBe(4);
    expect(nightCard(four)?.code).toBe("50309");
    expect(nightCard(four)?.progress).toBe(0);
    expect(night(four, "dusk")).toBe(true);
  });

  it("sends Dusk to the victory display at 4 and puts Midnight in play, the progress that passed the limit lost", () => {
    const dusk = nightIs(table, "50309");
    const past = quiet(run(dusk, { verb: "PlaceNightProgress", amount: 6 }));
    expect(at(past, "50309")?.zone).toBe("victory");
    expect(nightCard(past)?.code).toBe("50310");
    expect(nightCard(past)?.progress).toBe(0);
  });

  it("gives Midnight no limit", () => {
    const midnight = nightIs(table, "50310");
    const many = quiet(run(midnight, { verb: "PlaceNightProgress", amount: 9 }));
    expect(nightCard(many)?.code).toBe("50310");
    expect(nightCard(many)?.progress).toBe(9);
  });

  it("places nothing with no Night objective in play", () => {
    const none = moveCard(table, nightCard(table)?.id ?? "", { zone: "victory" });
    expect(run(none, { verb: "PlaceNightProgress", amount: 1 })).toBe(none);
  });
});

describe("50308:A:1, 50309:A:1 and 50310:A:1 at the end of the round", () => {
  const endOfRound = (state: ScenarioState): ScenarioState => quiet(crossBoundary({ ...state, boundaryPhase: "End of round", phase: "Beginning of round", window: null }, ctxOf(), []));

  it("places 1 progress on the Night in play", () => {
    expect(nightCard(endOfRound(table))?.progress).toBe(1);
  });

  it("does not give the Dusk that Eventide made room for a progress of its own that round (rr.forced)", () => {
    const three = quiet(run(table, { verb: "PlaceNightProgress", amount: 3 }));
    const ended = endOfRound(three);
    expect(at(ended, "50308")?.zone).toBe("victory");
    expect(nightCard(ended)?.code).toBe("50309");
    expect(nightCard(ended)?.progress).toBe(0);
  });

  it("raises each player's threat by the progress on Midnight after placing its own (50310:A:1)", () => {
    const midnight = quiet(run(nightIs(table, "50310"), { verb: "PlaceNightProgress", amount: 2 }));
    const before = midnight.seats[0]?.threat ?? 0;
    const ended = endOfRound(midnight);
    expect(nightCard(ended)?.progress).toBe(3);
    expect(ended.seats[0]?.threat).toBe(before + 3);
  });
});

describe("50317:A:2 and 50327:A:2 progress on the current Night objective", () => {
  it("goes on whichever Night is in play", () => {
    const dusk = nightIs(table, "50309");
    const done = run(run(dusk, { verb: "PlaceNightProgress", amount: 1 }), { verb: "PlaceNightProgress", amount: 1 });
    expect(nightCard(done)?.progress).toBe(2);
  });
});

describe("Spectral (50312:A:1, 50311:A:1)", () => {
  function engaged(code: string): { state: ScenarioState; enemy: string; hero: string } {
    const spawned = spawn(table, code, { zone: "engaged", seat: 0 });
    return { state: syncConstants(spawned.state, ctxOf()), enemy: spawned.id, hero: table.seats[0]?.heroes[0] ?? "" };
  }

  it("makes a character's Willpower its attack strength against the enemy", () => {
    const { state, enemy, hero } = engaged("50312");
    const card = state.cards[hero]!;
    const willpower = modifiedStat(state, card, "willpower", ctxOf().cards);
    expect(willpower).not.toBe(modifiedStat(state, card, "attack", ctxOf().cards));
    expect(attackStrength(state, [hero], enemy, ctxOf().cards)).toBe(willpower);
  });

  it("counts the attack of an enemy without the keyword as usual", () => {
    const { state, enemy, hero } = engaged("50305");
    const plain = spawn(state, "f0", { zone: "engaged", seat: 0 });
    expect(attackStrength(plain.state, [hero], plain.id, ctxOf().cards)).toBe(modifiedStat(plain.state, plain.state.cards[hero]!, "attack", ctxOf().cards));
    expect(enemy).not.toBe(plain.id);
  });

  it("goes back to Attack while the enemy has lost the keyword (losesSpectral)", () => {
    const { state, enemy, hero } = engaged("50313");
    const flagged = { ...state, modifiers: [...state.modifiers, { instanceId: enemy, sourceId: enemy, stat: "losesSpectral" as const, amount: 1, until: "endOfPhase" as const }] };
    expect(attackStrength(flagged, [hero], enemy, ctxOf().cards)).toBe(modifiedStat(flagged, flagged.cards[hero]!, "attack", ctxOf().cards));
  });
});

describe("50302:A:1 and 50304:A:1 Derufin", () => {
  function stoneAndDerufin(): { state: ScenarioState; stone: string; derufin: string } {
    const staged = run(table, { verb: "AddSetAsideToStaging", code: "50306" });
    const stone = staged.staging.find((id) => staged.cards[id]?.code === "50306") ?? "";
    const attached = run(staged, { verb: "AttachSetAsideTo", code: "50304", to: "The Stone of Erech", uncontrolled: true });
    return { state: attached, stone, derufin: at(attached, "50304")?.id ?? "" };
  }

  it("attaches the set aside Derufin to the Stone in the staging area, controlled by nobody", () => {
    const { state, stone, derufin } = stoneAndDerufin();
    expect(state.cards[derufin]?.zone).toBe("attached");
    expect(state.cards[derufin]?.host).toBe(stone);
    expect(state.cards[stone]?.attachments).toContain(derufin);
    expect(state.cards[derufin]?.controller).toBeNull();
    expect(state.setAside).not.toContain(derufin);
  });

  it("attaches nothing when the Stone is not in play or Derufin is not set aside", () => {
    expect(run(table, { verb: "AttachSetAsideTo", code: "50304", to: "The Stone of Erech", uncontrolled: true })).toBe(table);
    expect(run(table, { verb: "AttachSetAsideTo", code: "50299", to: "Tarlang's Neck", uncontrolled: true })).toBe(table);
  });

  it("is gained by the first player: he leaves the Stone and joins that player's area ready", () => {
    const { state, stone, derufin } = stoneAndDerufin();
    const hurt = { ...state, cards: { ...state.cards, [derufin]: { ...state.cards[derufin]!, exhausted: true } } };
    const freed = run(hurt, { verb: "FreeAttachedObjective", who: "firstPlayer" }, derufin);
    expect(freed.cards[derufin]?.zone).toBe("play");
    expect(freed.cards[derufin]?.controller).toBe(hurt.firstPlayer);
    expect(freed.cards[derufin]?.host).toBeNull();
    expect(freed.cards[derufin]?.exhausted).toBe(false);
    expect(freed.cards[stone]?.attachments).not.toContain(derufin);
    expect(freed.seats[hurt.firstPlayer]?.play).toContain(derufin);
  });

  it("does nothing to a card that is not attached", () => {
    const hero = table.seats[0]?.heroes[0] ?? "";
    expect(run(table, { verb: "FreeAttachedObjective", who: "firstPlayer" }, hero)).toBe(table);
  });

  it("is the condition controls (anyPlayer) that 50303:B:2 reads: false while attached, true once controlled", () => {
    const { state, derufin } = stoneAndDerufin();
    const scope = { actor: 0, sourceId: null, returned: 0 };
    expect(holds(state, { kind: "controls", code: "50304", who: "anyPlayer" }, scope, ctxOf())).toBe(false);
    expect(holds(run(state, { verb: "FreeAttachedObjective", who: "firstPlayer" }, derufin), { kind: "controls", code: "50304", who: "anyPlayer" }, scope, ctxOf())).toBe(true);
  });
});

describe("50303:B:2 no progress on the stage unless a player controls Derufin", () => {
  // Stage 3 is the current quest; Tarlang's Neck is explored away so the progress goes to the stage.
  function onStageThree(): ScenarioState {
    const stage = spawn(table, "50303", { zone: "questStage" });
    return syncConstants(moveCard(stage.state, table.activeLocation ?? "", { zone: "encounterDiscard" }), ctxOf());
  }

  it("places none while Derufin is attached to the Stone, and some once the first player controls him", () => {
    const state = onStageThree();
    const stage = state.questStage ?? "";
    expect(state.cards[stage]?.code).toBe("50303");
    expect(run(state, { verb: "PlaceQuestProgress", perPlayer: 3 }).cards[stage]?.progress).toBe(0);
    const derufin = spawn(state, "50304", { zone: "play", seat: 0 });
    const freed = syncConstants(derufin.state, ctxOf());
    expect(run(freed, { verb: "PlaceQuestProgress", perPlayer: 3 }).cards[stage]?.progress).toBe(3);
  });
});

describe("50303:B:1 Midnight. Battle", () => {
  it("gives stage 3B the Battle keyword only while Midnight is in play", () => {
    const stage = spawn(table, "50303", { zone: "questStage" }).state;
    const at = (state: ScenarioState) => currentQuestHas(syncConstants(state, ctxOf()), "battle", ctxOf().cards);
    expect(at(stage)).toBe(false);
    expect(at(nightIs(stage, "50309"))).toBe(false);
    expect(at(nightIs(stage, "50310"))).toBe(true);
  });
});

describe("50324:A:1 PassHand", () => {
  const handOf = (state: ScenarioState, seat: number) => [...(state.seats[seat]?.hand ?? [])];

  it("moves each hand to the next seat at once, the cards staying their owner's", () => {
    const two = kept(encounterStart(world, 2, 1), ctxOf());
    const before = [handOf(two, 0), handOf(two, 1)];
    const passed = run(two, { verb: "PassHand", direction: "left" });
    expect(new Set(handOf(passed, 0))).toEqual(new Set(before[1]));
    expect(new Set(handOf(passed, 1))).toEqual(new Set(before[0]));
    for (const id of handOf(passed, 1)) expect(passed.cards[id]?.owner).toBe(0);
    for (const id of handOf(passed, 0)) expect(passed.cards[id]?.owner).toBe(1);
  });

  it("passes a hand back to its owner on a second pass, the owner mark gone", () => {
    const two = kept(encounterStart(world, 2, 1), ctxOf());
    const back = run(run(two, { verb: "PassHand", direction: "left" }), { verb: "PassHand", direction: "left" });
    expect(new Set(handOf(back, 0))).toEqual(new Set(handOf(two, 0)));
    for (const id of handOf(back, 0)) expect(back.cards[id]?.owner).toBeUndefined();
  });

  it("makes the only player discard his hand", () => {
    const hand = handOf(table, 0);
    expect(hand.length).toBeGreaterThan(0);
    const gone = run(table, { verb: "PassHand", direction: "left" });
    expect(handOf(gone, 0)).toEqual([]);
    for (const id of hand) expect(gone.cards[id]?.zone).toBe("discard");
  });
});

describe("the table flags", () => {
  const flag = (state: ScenarioState, stat: "skipPlanning" | "noCollect" | "cannotPlayEvents" | "losesIcons", target: string): ScenarioState =>
    ({ ...state, modifiers: [...state.modifiers, { instanceId: target, sourceId: target, stat, amount: 1, until: "endOfRound" as const }] });

  it("cannotPlayEvents: an event cannot be played, an ally can (50312:A:2)", () => {
    const cards = new Map(ctxOf().cards).set("q-event", definePrinted({ code: "q-event", name: "Event", type: "event" })).set("q-ally", definePrinted({ code: "q-ally", name: "Ally", type: "ally" }));
    const ctx = { ...ctxOf(), cards };
    const barred = flag(table, "cannotPlayEvents", "table");
    const event = spawn(barred, "q-event", { zone: "hand", seat: 0 });
    const ally = spawn(event.state, "q-ally", { zone: "hand", seat: 0 });
    expect(familyPlayBarred(ally.state, event.id, ctx)).toBe(true);
    expect(familyPlayBarred(ally.state, ally.id, ctx)).toBe(false);
    expect(familyPlayBarred(table, event.id, ctx)).toBe(false);
  });

  it("skipPlanning: the planning phase opens no window and the round goes on to the quest phase (50302:B:1)", () => {
    const skipped = reduce(flag(table, "skipPlanning", "table"), { type: "Pass" }, ctxOf());
    expect(skipped.ok).toBe(true);
    if (skipped.ok) expect(skipped.state.phase).toBe("Quest");
    const played = reduce(table, { type: "Pass" }, ctxOf());
    if (played.ok) expect(played.state.phase).toBe("Planning");
  });

  it("noCollect: no hero collects a resource in the resource phase (50302:B:1)", () => {
    const hero = table.seats[0]?.heroes[0] ?? "";
    const start = { ...table, mode: "resourceGrant" as const, window: null };
    const collected = settle(start, ctxOf(), []);
    expect(collected.cards[hero]?.resources).toBe((table.cards[hero]?.resources ?? 0) + 1);
    const barred = settle(flag(start, "noCollect", "table"), ctxOf(), []);
    expect(barred.cards[hero]?.resources).toBe(table.cards[hero]?.resources);
  });

  it("losesIcons: a hero pays no Lore, Leadership, Spirit or Tactics resource, and still pays a neutral one (50321:A:1)", () => {
    const hero = table.seats[0]?.heroes[0] ?? "";
    const sphere = ctxOf().cards.get(table.cards[hero]?.code ?? "")?.sphere ?? null;
    expect(sphere).not.toBeNull();
    expect(heroPays(table, hero, sphere, ctxOf())).toBe(true);
    const lost = flag(table, "losesIcons", hero);
    expect(heroPays(lost, hero, sphere, ctxOf())).toBe(false);
    expect(heroPays(lost, hero, "neutral", ctxOf())).toBe(true);
  });
});
