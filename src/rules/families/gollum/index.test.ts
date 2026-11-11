// Rules: mec112.gollum-smeagol, rr.first-player, faq.additional-attacks (data/rules/entries.json); ledger lines 144075:A:1, 144075:A:2, 144075:A:3, 144076:A:1, 144076:A:2, 144076:A:3, 144055:A:2. Gollum and Sméagol on a table of The Passage of the Marshes.
import { beforeAll, describe, expect, it } from "vitest";

import { settle } from "../../engine/machine.ts";
import { legalIntents, reduce, startScenario, type PlayerIntent } from "../../engine/reduce.ts";
import { expectOk } from "../../core/test-fixture.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { immuneToSource } from "../misc/guards.ts";
import type { ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { probeTable } from "../../../../scripts/card-smoke/encounter.ts";
import { encounterStart, encounterWorld, type EncounterWorld } from "../../../../scripts/card-smoke/encounter-world.ts";
import { idOf } from "../../../../test/harness/scene-kit.ts";

let world: EncounterWorld;
let table: ScenarioState;
const ctxOf = () => world.contexts.strong;

beforeAll(async () => {
  world = await encounterWorld("the-passage-of-the-marshes");
  table = probeTable(world);
});

/** The scenario dealt to two seats, the opening hands kept and the Setup's searches answered with the first intent offered. */
function twoSeats(): ScenarioState {
  let state = startScenario(encounterStart(world, 2, 1), ctxOf());
  for (let guard = 0; guard < 40 && (state.window?.kind === "mulligan" || (state.window?.kind === "choose" && state.phase !== "Planning")); guard += 1) {
    const intent = legalIntents(state, ctxOf())[0];
    if (!intent) break;
    state = expectOk(reduce(state, intent as PlayerIntent, ctxOf())).state;
  }
  return state;
}

const flip = (state: ScenarioState, to: "smeagol" | "gollum") => runInstruction(state, { verb: "FlipGollum", to }, { seat: 0, sourceId: null }, ctxOf(), []);
const quiet = (state: ScenarioState): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, ctxOf(), []);

describe("the Setup (144064:A:1)", () => {
  it("puts Gollum into play engaged with the first player", () => {
    const gollum = idOf(table, "144075");
    expect(table.cards[gollum]?.zone).toBe("engaged");
    expect(table.cards[gollum]?.controller).toBe(table.firstPlayer);
  });
});

describe("FlipGollum", () => {
  it("flips Gollum to Sméagol: damage discarded, exhausted, in play under the first player (144075:A:3)", () => {
    const gollum = idOf(table, "144075");
    const hurt = { ...table, cards: { ...table.cards, [gollum]: { ...table.cards[gollum]!, damage: 4 } } };
    const flipped = flip(hurt, "smeagol");
    const card = flipped.cards[gollum];
    expect(card?.code).toBe("144076");
    expect(card?.zone).toBe("play");
    expect(card?.exhausted).toBe(true);
    expect(card?.damage).toBe(0);
    expect(card?.controller).toBe(table.firstPlayer);
    expect(flipped.seats[table.firstPlayer]?.engaged).not.toContain(gollum);
    expect(flipped.encounterDiscard).not.toContain(gollum);
    expect(flipped.victory).not.toContain(gollum);
  });

  it("flips Sméagol back to Gollum: damage discarded, ready, engaged with the first player (144076:A:2)", () => {
    const gollum = idOf(table, "144075");
    const smeagol = flip(table, "smeagol");
    const hurt = { ...smeagol, cards: { ...smeagol.cards, [gollum]: { ...smeagol.cards[gollum]!, damage: 3 } } };
    const back = flip(hurt, "gollum");
    const card = back.cards[gollum];
    expect(card?.code).toBe("144075");
    expect(card?.zone).toBe("engaged");
    expect(card?.exhausted).toBe(false);
    expect(card?.damage).toBe(0);
    expect(back.seats[table.firstPlayer]?.engaged).toContain(gollum);
  });

  it("does nothing when the card does not show the other side", () => {
    expect(flip(table, "gollum")).toBe(table);
    const smeagol = flip(table, "smeagol");
    expect(flip(smeagol, "smeagol")).toBe(smeagol);
  });

  it("flips a defeated Gollum, wherever the defeat left him (the Forced effect, 144075:A:3)", () => {
    const gollum = idOf(table, "144075");
    const defeated = moveCard({ ...table, cards: { ...table.cards, [gollum]: { ...table.cards[gollum]!, damage: 5 } } }, gollum, { zone: "encounterDiscard" });
    const settled = quiet({ ...defeated, pendingEvents: [{ trigger: "enemyDestroyed", seat: 0, subject: gollum }] });
    expect(settled.cards[gollum]?.code).toBe("144076");
    expect(settled.cards[gollum]?.zone).toBe("play");
    expect(settled.cards[gollum]?.exhausted).toBe(true);
    expect(settled.lost).toBeFalsy();
  });

  it("loses the game when Sméagol is destroyed, not when he flips (144076:A:3)", () => {
    const gollum = idOf(table, "144075");
    const smeagol = syncConstants(flip(table, "smeagol"), ctxOf());
    expect(quiet(smeagol).lost).toBeFalsy();
    const destroyed = moveCard(smeagol, gollum, { zone: "encounterDiscard" });
    expect(quiet({ ...destroyed, pendingEvents: [{ trigger: "characterDestroyed", seat: 0, subject: gollum }] }).lost).toBe(true);
  });
});

describe("FollowFirstPlayer (144075:A:1)", () => {
  const two = twoSeats;

  it("moves Gollum to the new first player and announces the engagement", () => {
    const base = two();
    const gollum = idOf(base, "144075");
    const passed = { ...base, firstPlayer: 1 };
    const moved = runInstruction(passed, { verb: "FollowFirstPlayer" }, { seat: 1, sourceId: gollum }, ctxOf(), []);
    expect(moved.cards[gollum]?.controller).toBe(1);
    expect(moved.seats[1]?.engaged).toContain(gollum);
    expect(moved.seats[0]?.engaged).not.toContain(gollum);
    expect(moved.pendingEvents?.some((event) => event.trigger === "engaged" && event.subject === gollum && event.seat === 1)).toBe(true);
  });

  it("144075:A:2 runs through the refresh phase: the token passes, Gollum engages the new first player and attacks them", () => {
    const base = two();
    const gollum = idOf(base, "144075");
    const refresh: ScenarioState = { ...base, mode: "refresh", phase: "Refresh", boundaryPhase: "Refresh", window: null };
    const settled = settle(refresh, ctxOf(), []);
    expect(settled.firstPlayer).toBe(1);
    expect(settled.cards[gollum]?.controller).toBe(1);
    expect(settled.pendingAttack?.enemyId).toBe(gollum);
  });

  it("144075:A:2 makes no attack in a game of one player, where the token never moves", () => {
    const gollum = idOf(table, "144075");
    const refresh: ScenarioState = { ...table, mode: "refresh", phase: "Refresh", boundaryPhase: "Refresh", window: null };
    const settled = settle(refresh, ctxOf(), []);
    expect(settled.cards[gollum]?.controller).toBe(0);
    expect(settled.pendingAttack).toBeFalsy();
  });

  it("does nothing for a Gollum already engaged with the first player", () => {
    const gollum = idOf(table, "144075");
    expect(runInstruction(table, { verb: "FollowFirstPlayer" }, { seat: 0, sourceId: gollum }, ctxOf(), [])).toBe(table);
  });
});

describe("GollumAttacks (144055:A:2)", () => {
  it("starts an immediate attack by the Gollum in play against the player he is engaged with", () => {
    const attacked = runInstruction(table, { verb: "GollumAttacks" }, { seat: 0, sourceId: null }, ctxOf(), []);
    expect(attacked.pendingAttack?.enemyId).toBe(idOf(table, "144075"));
  });

  it("does nothing while Sméagol is showing", () => {
    const smeagol = flip(table, "smeagol");
    expect(runInstruction(smeagol, { verb: "GollumAttacks" }, { seat: 0, sourceId: null }, ctxOf(), [])).toBe(smeagol);
  });
});

describe("Immune to non-Fellowship player card effects (144075:A:1)", () => {
  it("shuts out the effects of player cards that are not Fellowship cards, and no others", () => {
    const gollum = idOf(table, "144075");
    const synced = syncConstants(table, ctxOf());
    const heroId = synced.seats[0]?.heroes[0] ?? "";
    const hero = synced.cards[heroId];
    const printed = ctxOf().cards.get(hero?.code ?? "");
    // The table's hero is a Fellowship hero: its effects reach Gollum; the same card as a Leadership one does not.
    expect(printed?.sphere).toBe("fellowship");
    expect(immuneToSource(synced, gollum, heroId, ctxOf())).toBe(false);
    const leadership = { ...ctxOf(), cards: new Map([...ctxOf().cards, [hero?.code ?? "", { ...printed!, sphere: "leadership" as const }]]) };
    expect(immuneToSource(synced, gollum, heroId, leadership)).toBe(true);
    // An encounter card's effect is not a player card effect.
    expect(immuneToSource(synced, gollum, idOf(synced, "144064"), ctxOf())).toBe(false);
  });
});
