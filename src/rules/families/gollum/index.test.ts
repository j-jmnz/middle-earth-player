// Rules: mec112.gollum-smeagol, rr.first-player, faq.additional-attacks (data/rules/entries.json); ledger lines 144075:A:1, 144075:A:2, 144075:A:3, 144076:A:1, 144076:A:2, 144076:A:3, 144055:A:2. Gollum and Sméagol on a table of The Passage of the Marshes.
import { beforeAll, describe, expect, it } from "vitest";

import { clearEliminated, eliminateSeat } from "../../core/eliminate.ts";
import { settle } from "../../engine/machine.ts";
import { legalIntents, reduce, startScenario, type PlayerIntent } from "../../engine/reduce.ts";
import type { EngineStep } from "../../core/intents.ts";
import { expectOk } from "../../core/test-fixture.ts";
import { resetEncounterDeck } from "../../interpret/verbs.ts";
import { runInstruction, type ReduceContext } from "../../interpret/interpret.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { placeDamage, playerCardEffectCanChoose } from "../../core/keywords.ts";
import { attachmentHostIds } from "../../player/attach.ts";
import type { ScenarioState } from "../../core/state.ts";
import { definePrinted } from "../../core/printed.ts";
import { moveCard, spawn } from "../../core/zones.ts";
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

  it("rr.step-7-4 before rr.step-7-5: Gollum engages the new first player before Mire discards at the end of the refresh phase", () => {
    const base = two();
    const gollum = idOf(base, "144075");
    const soft = Object.values(base.cards).find((card) => card.code === "144023" && card.zone !== "staging")!.id;
    const refresh: ScenarioState = { ...moveCard(base, soft, { zone: "staging" }), mode: "refresh", phase: "Refresh", boundaryPhase: "Refresh", window: null };
    const steps: EngineStep[] = [];
    const settled = settle(refresh, ctxOf(), steps);
    // The attack by Gollum is pending and the Mire location is still in staging: its token is placed after the pass frames resolve.
    expect(settled.pendingAttack?.enemyId).toBe(gollum);
    expect(settled.cards[gollum]?.controller).toBe(1);
    expect(settled.cards[soft]?.zone).toBe("staging");
    expect(settled.cards[soft]?.resources).toBe(0);
    const kinds = steps.map((step) => step.kind);
    expect(kinds.indexOf("engage")).toBeGreaterThanOrEqual(0);
    expect(kinds).not.toContain("reveal");
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

describe("the first player is eliminated (144075:A:1, 144076:A:1, agent recommendation)", () => {
  const out = (state: ScenarioState): ScenarioState => clearEliminated(eliminateSeat(state, 0, []), ctxOf().cards);

  it("Gollum is engaged with the new first player, damage kept", () => {
    const base = twoSeats();
    const gollum = idOf(base, "144075");
    const hurt = { ...base, cards: { ...base.cards, [gollum]: { ...base.cards[gollum]!, damage: 2 } } };
    const left = out(hurt);
    expect(left.firstPlayer).toBe(1);
    expect(left.cards[gollum]?.zone).toBe("engaged");
    expect(left.cards[gollum]?.controller).toBe(1);
    expect(left.cards[gollum]?.damage).toBe(2);
    expect(left.seats[1]?.engaged).toContain(gollum);
    expect(left.staging).not.toContain(gollum);
  });

  it("Sméagol passes to the new first player, exhausted and with his damage", () => {
    const base = twoSeats();
    const gollum = idOf(base, "144075");
    const smeagol = flip(base, "smeagol");
    const hurt = { ...smeagol, cards: { ...smeagol.cards, [gollum]: { ...smeagol.cards[gollum]!, damage: 1 } } };
    expect(hurt.cards[gollum]?.controller).toBe(0);
    const left = out(hurt);
    expect(left.cards[gollum]?.code).toBe("144076");
    expect(left.cards[gollum]?.zone).toBe("play");
    expect(left.cards[gollum]?.controller).toBe(1);
    expect(left.cards[gollum]?.exhausted).toBe(true);
    expect(left.cards[gollum]?.damage).toBe(1);
    expect(left.encounterDiscard).not.toContain(gollum);
    expect(left.lost).toBeFalsy();
  });
});

describe("the encounter deck refill", () => {
  it("never shuffles Gollum into the encounter deck (mec112.gollum-smeagol)", () => {
    const gollum = idOf(table, "144075");
    const other = idOf(table, "144022");
    const emptied = { ...moveCard(moveCard(table, gollum, { zone: "encounterDiscard" }), other, { zone: "encounterDiscard" }), phase: "Quest" as const, encounterDeck: [] };
    const refilled = resetEncounterDeck(emptied, [], ctxOf());
    expect(refilled.encounterDeck).toEqual([other]);
    expect(refilled.encounterDiscard).toEqual([gollum]);
    // With only Gollum in the discard pile the refill does nothing.
    const only = { ...moveCard(table, gollum, { zone: "encounterDiscard" }), phase: "Quest" as const, encounterDeck: [], encounterDiscard: [gollum] };
    expect(resetEncounterDeck(only, [], ctxOf())).toBe(only);
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
    const gollumPrinted = ctxOf().cards.get("144075")!;
    const heroId = synced.seats[0]?.heroes[0] ?? "";
    const printed = ctxOf().cards.get(synced.cards[heroId]?.code ?? "");
    // The table's hero is a Fellowship hero: its effects reach Gollum; the same card as a Leadership one does not.
    expect(printed?.sphere).toBe("fellowship");
    expect(playerCardEffectCanChoose(gollumPrinted, synced, gollum, printed)).toBe(true);
    expect(playerCardEffectCanChoose(gollumPrinted, synced, gollum, { ...printed!, sphere: "leadership" })).toBe(false);
    // An encounter card's effect is not a player card effect.
    expect(playerCardEffectCanChoose(gollumPrinted, synced, gollum, ctxOf().cards.get("144064"))).toBe(true);
  });

  it("an attachment of another sphere has no host in Gollum (Forest Snare, 01069), a Fellowship one has", () => {
    const synced = syncConstants(table, ctxOf());
    const gollum = idOf(synced, "144075");
    const withSnare = (sphere: "lore" | "fellowship") => ({ ...ctxOf(), cards: new Map([...ctxOf().cards, ["01069", definePrinted({ code: "01069", name: "Forest Snare", type: "attachment", sphere, cost: 3 })]]) });
    expect(attachmentHostIds(synced, 0, "01069", withSnare("lore"))).not.toContain(gollum);
    const asFellowship = withSnare("fellowship");
    expect(attachmentHostIds(synced, 0, "01069", asFellowship)).toContain(gollum);
  });

  it("a Tactics ally's damage response cannot hurt Gollum (Gondorian Spearman, 01029); a Fellowship card's damage can", () => {
    const withSpearman = (sphere: "tactics" | "fellowship") => ({ ...ctxOf(), cards: new Map([...ctxOf().cards, ["01029", definePrinted({ code: "01029", name: "Gondorian Spearman", type: "ally", sphere, cost: 2, attack: 1, defense: 1, health: 1 })]]) });
    const made = spawn(syncConstants(table, ctxOf()), "01029", { zone: "play", seat: 0 });
    const gollum = idOf(made.state, "144075");
    const hit = (state: ScenarioState, ctx: ReduceContext) => placeDamage(state, gollum, 1, ctx.cards, [], "player", { rule: "rr.effects" }, made.id).cards[gollum]?.damage ?? 0;
    expect(hit(made.state, withSpearman("tactics"))).toBe(0);
    expect(hit(made.state, withSpearman("fellowship"))).toBe(1);
  });
});
