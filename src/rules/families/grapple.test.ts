// Rules: dcce.grapple (data/rules/entries.json); ledger lines 12051:A:1, 12052:A:2, 12052:A:3, 12053:A:1, 12054:A:1. Grapple X: a revealed enemy with the keyword attaches facedown to the location in the staging area the keyword names.
import { beforeAll, describe, expect, it } from "vitest";

import { modifiedStat, printedStat } from "../keywords.ts";
import { legalIntents } from "../legal.ts";
import type { ScenarioState } from "../state.ts";
import { grappledWith } from "./grapple-values.ts";
import { holds } from "../conditions.ts";
import { moveCard, spawn } from "../zones.ts";
import { pushCardEffects } from "../effect-frames.ts";
import type { EngineStep } from "../intents.ts";
import { settle } from "../machine.ts";
import { CODES, depthsTable, finish, idOf, idsOf, loadDepthsWorld, resolveRecords, send, start, type DepthsLayout, type DepthsWorld } from "../../../scripts/depths-scene.ts";

const resolveRecordsOf = (made: ReturnType<typeof depthsTable>, code: string) => resolveRecords(made.state, made.ctx, code, "whenRevealed", idOf(made.state, code));

let world: DepthsWorld;

beforeAll(async () => {
  world = await loadDepthsWorld();
});

const make = (layout: DepthsLayout = {}) => depthsTable(world, layout);
const zoneOf = (state: ScenarioState, code: string, at = 0) => state.cards[idsOf(state, code)[at] ?? ""]?.zone;

// The staging step reveals the top card of the encounter deck for the committed hero; the run stops at the first choice a revealed card opens, or at the travel phase.
const reveal = (made: ReturnType<typeof make>) => {
  let run = send(start(made.state), { type: "Commit", cardIds: [made.hero] }, made.ctx);
  run = send(run, { type: "Pass" }, made.ctx);
  return run;
};

describe("Grapple", () => {
  it("attaches a revealed Thrashing Arm facedown to the location with the lowest printed Threat, and adds 2 Threat to it (12051:A:1)", () => {
    const made = make({ deck: [CODES.thrashing, "f0"], staging: [CODES.weatherDeck, CODES.forecastle, CODES.cargoHold] });
    const run = reveal(made);
    const arm = run.state.cards[idsOf(run.state, CODES.thrashing)[0] ?? ""];
    // Weather Deck 2, Forecastle Deck 3, Cargo Hold 2: tied at 2, the first player chooses between Weather Deck and Cargo Hold.
    expect(run.state.window).toMatchObject({ kind: "choose" });
    const options = run.state.window?.kind === "choose" ? run.state.window.options : [];
    expect(options).toEqual([idOf(run.state, CODES.weatherDeck), idOf(run.state, CODES.cargoHold)]);
    const chosen = finish(send(run, { type: "Choose", optionId: idOf(run.state, CODES.cargoHold) }, made.ctx), made.ctx);
    const placed = chosen.state.cards[arm?.id ?? ""];
    expect(placed).toMatchObject({ zone: "grappled", host: idOf(chosen.state, CODES.cargoHold), face: "down", controller: null });
    expect(grappledWith(chosen.state, idOf(chosen.state, CODES.cargoHold))).toEqual([arm?.id]);
    expect(modifiedStat(chosen.state, chosen.state.cards[idOf(chosen.state, CODES.cargoHold)]!, "threat", made.ctx.cards)).toBe(4);
    expect(chosen.state.staging).not.toContain(arm?.id);
  });

  it("takes the location with the highest printed quest points for Crushing Arm and surges (12052:A:2)", () => {
    const made = make({ deck: [CODES.crushing, CODES.thrashing, "f0"], staging: [CODES.weatherDeck, CODES.forecastle] });
    const run = reveal(made);
    // Forecastle Deck has 5 quest points, Weather Deck 3: no tie. Surge reveals Thrashing Arm next (lowest Threat: Weather Deck 2).
    expect(zoneOf(run.state, CODES.crushing)).toBe("grappled");
    expect(grappledWith(run.state, idOf(run.state, CODES.forecastle))).toHaveLength(1);
    expect(grappledWith(run.state, idOf(run.state, CODES.weatherDeck))).toHaveLength(1);
  });

  it("adds the enemy to the staging area when there is no location in it (dcce.grapple)", () => {
    const made = make({ deck: [CODES.thrashing, "f0"], staging: [] });
    const run = reveal(made);
    expect(zoneOf(run.state, CODES.thrashing)).toBe("staging");
  });

  it("is not in the staging area: it is not a card an engagement check or a player card effect can reach, and it is immune", () => {
    const made = make({ staging: [CODES.weatherDeck], grappled: [[CODES.thrashing, CODES.weatherDeck]], phase: "Encounter" });
    const arm = idOf(made.state, CODES.thrashing);
    expect(made.state.staging).not.toContain(arm);
    expect(legalIntents(made.state, made.ctx).some((intent) => intent.type === "Engage")).toBe(false);
  });
});

describe("detaching", () => {
  const withArms = () => make({ phase: "Travel", staging: [CODES.cargoHold, CODES.weatherDeck], grappled: [[CODES.thrashing, CODES.cargoHold], [CODES.crushing, CODES.cargoHold], [CODES.giant, CODES.weatherDeck]] });

  it("flips the enemies grappled with a location faceup and adds them to the staging area when the location is explored from the staging area", () => {
    const made = withArms();
    const cargo = idOf(made.state, CODES.cargoHold);
    const arms = grappledWith(made.state, cargo);
    expect(arms).toHaveLength(2);
    const explored = moveCard(made.state, cargo, { zone: "victory" });
    for (const arm of arms) expect(explored.cards[arm]).toMatchObject({ zone: "staging", face: "up", host: null, controller: null });
    expect(explored.staging).toEqual(expect.arrayContaining([...arms]));
    // The other location keeps its enemy, and a detached enemy is announced to the Forced effects that hear it.
    expect(grappledWith(explored, idOf(explored, CODES.weatherDeck))).toHaveLength(1);
    expect((explored.pendingEvents ?? []).filter((event) => event.trigger === "grappleDetached").map((event) => event.cardId).sort()).toEqual([...arms].sort());
  });

  it("detaches them when the location becomes the active location, with the Threat they added gone, and leaves a location that stays in the staging area alone", () => {
    const made = withArms();
    const cargo = idOf(made.state, CODES.cargoHold);
    expect(modifiedStat(made.state, made.state.cards[cargo]!, "threat", made.ctx.cards)).toBe(2 + 4);
    const run = send(start(made.state), { type: "Travel", locationId: cargo }, made.ctx);
    expect(idsOf(run.state, CODES.thrashing).map((id) => run.state.cards[id]?.zone)).not.toContain("grappled");
    expect(modifiedStat(run.state, run.state.cards[cargo]!, "threat", made.ctx.cards)).toBe(2);
    expect(grappledWith(run.state, idOf(run.state, CODES.weatherDeck))).toHaveLength(1);
  });

  it("detaches them to the staging area when the location leaves the staging area in any other way", () => {
    const made = withArms();
    const cargo = idOf(made.state, CODES.cargoHold);
    const left = moveCard(made.state, cargo, { zone: "encounterDiscard" });
    expect(grappledWith(left, cargo)).toEqual([]);
    expect(idsOf(left, CODES.thrashing).map((id) => left.cards[id]?.zone)).toEqual(["staging"]);
  });
});

describe("the first player chooses among tied locations", () => {
  it("asks the first player, whoever reveals or discards the enemy (dcce.grapple)", () => {
    const made = make({ seats: 2, deck: [CODES.thrashing, "f0", "f0"], staging: [CODES.weatherDeck, CODES.cargoHold] });
    const state: ScenarioState = { ...made.state, firstPlayer: 1 };
    const spawned = spawn(state, CODES.fromTheDepths, { zone: "staging" });
    const effects = made.ctx.effects.filter((effect) => effect.cardCode === CODES.fromTheDepths && effect.timing === "whenRevealed");
    const steps: EngineStep[] = [];
    const pushed = pushCardEffects(spawned.state, "whenRevealed", spawned.id, 0, false, effects, made.ctx, steps);
    const run = settle({ ...pushed, window: null, mode: "stopped" }, made.ctx, steps);
    expect(run.window).toMatchObject({ kind: "choose", seat: 1 });
  });

  it("prints the lowest of the printed numbers, not the current ones: a location with progress or a modifier is still its printed self", () => {
    const made = make({ deck: [CODES.thrashing, "f0"], staging: [CODES.weatherDeck, CODES.cargoHold, CODES.quarterDeck] });
    const boosted = { ...made.state, modifiers: [{ instanceId: idOf(made.state, CODES.weatherDeck), sourceId: "t", stat: "threat" as const, amount: 5, until: "endOfRound" as const }] };
    const run = reveal({ ...made, state: boosted });
    // Weather Deck prints 2 Threat and so does Cargo Hold: tied despite the modifier on one of them.
    expect(run.state.window).toMatchObject({ kind: "choose" });
    expect(printedStat(made.ctx.cards.get(CODES.weatherDeck)!, "threat")).toBe(2);
    expect(printedStat(made.ctx.cards.get(CODES.quarterDeck)!, "threat")).toBe(4);
  });
});

describe("Captain Sahír and Na'asiyah flipping (dcce.stormcaller-elite)", () => {
  it("does nothing to a card out of play or to a card that has no objective side", () => {
    const made = make({ stage: "12040", setAside: [CODES.thing], staging: ["raider"] });
    const run = resolveRecordsOf(made, "12040");
    expect(idsOf(run.state, CODES.sahirAlly)).toEqual([]);
    expect(idsOf(run.state, "raider")).toHaveLength(1);
  });

  it("is announced to the cards that hear a flip: the campaign card's Forced effect and none other", () => {
    const made = make({ stage: "12040", setAside: [CODES.thing], engaged: [CODES.sahir] });
    const run = resolveRecordsOf(made, "12040");
    expect(run.state.cards[idOf(run.state, CODES.sahirAlly)]?.zone).toBe("play");
    expect(holds).toBeDefined();
  });
});
