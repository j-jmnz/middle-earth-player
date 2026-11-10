// Rules: rr.player-elimination, rr.ownership-and-control, mec112.permanent (data/rules/entries.json); ledger lines 143022:A:1, 143024:A:1, 143024:A:2, 143069:A:1. The captives family's verbs on a table of The Uruk-hai.
import { beforeAll, describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { constantWin, syncConstants } from "../../interpret/constants.ts";
import { holds } from "../../interpret/conditions.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { settle } from "../../engine/machine.ts";
import { eliminateEmpties } from "../../core/keywords.ts";
import { moveCard } from "../../core/zones.ts";
import { fireForced } from "../../windows/triggers.ts";
import { textBlank } from "../attachments/hold.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { probeTable } from "../../../../scripts/card-smoke/encounter.ts";
import { encounterWorld, type EncounterWorld } from "../../../../scripts/card-smoke/encounter-world.ts";
import { finish, idOf, revealFromTop, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { holdCaptive, rescueCaptives } from "./index.ts";
import { captivesOf } from "./values.ts";

let world: EncounterWorld;
let table: ScenarioState;
const ctxOf = () => world.contexts.strong;

beforeAll(async () => {
  world = await encounterWorld("the-uruk-hai");
  table = probeTable(world);
});

const run = (state: ScenarioState, instruction: Parameters<typeof runInstruction>[1], sourceId: string | null = null) => runInstruction(state, instruction, { seat: 0, sourceId }, ctxOf(), [] as EngineStep[]);

describe("the Captive chosen at Setup (143069:A:1)", () => {
  it("lies faceup under To Isengard!, in play, controlled by nobody and out of its owner's heroes", () => {
    const [captive] = captivesOf(table);
    expect(captivesOf(table)).toHaveLength(1);
    expect(captive?.zone).toBe("captive");
    expect(captive?.host).toBe(idOf(table, "143022"));
    expect(captive?.face).toBe("up");
    expect(captive?.controller).toBeNull();
    expect(captive?.owner).toBe(0);
    expect(table.seats[0].heroes).not.toContain(captive?.id);
    // Not a Fellowship hero: the Ring-bearer stays a hero.
    expect(table.seats[0].heroes.some((id) => table.cards[id]?.code === "141001")).toBe(true);
  });

  it("is blank under To Isengard!'s constant, picked only by a filter that asks for it, and not found by 'you control'", () => {
    const state = syncConstants(table, ctxOf());
    const [captive] = captivesOf(state);
    expect(textBlank(state, captive?.id ?? "")).toBe(true);
    expect(pickCandidates(state, { type: "hero", control: "any", captive: "only" }, 0, [], null, ctxOf())).toEqual([captive?.id]);
    expect(pickCandidates(state, { type: "hero", control: "any", captive: "include" }, 0, [], null, ctxOf())).toContain(captive?.id);
    expect(pickCandidates(state, { type: "hero", control: "any" }, 0, [], null, ctxOf())).not.toContain(captive?.id);
    expect(pickCandidates(state, { type: "hero", control: "any", captive: "free" }, 0, [], null, ctxOf())).toEqual([captive?.id]);
    expect(pickCandidates(state, { type: "hero", control: "you", captive: "include" }, 0, [], null, ctxOf())).not.toContain(captive?.id);
  });

  it("keeps its owner in the game when it is the only hero left (rr.player-elimination: a held hero is not killed)", () => {
    const alone: ScenarioState = { ...table, seats: [{ ...table.seats[0], heroes: [] }, table.seats[1]] };
    expect(eliminateEmpties(alone, []).seats[0].eliminated).not.toBe(true);
    const gone = eliminateEmpties({ ...alone, cards: Object.fromEntries(Object.entries(alone.cards).map(([id, card]) => [id, card.captive ? { ...card, captive: undefined } : card])) }, []);
    expect(gone.seats[0].eliminated).toBe(true);
  });

  it("is counted by the condition: any, or the acting seat's own", () => {
    expect(holds(table, { kind: "captives", min: 1 }, { actor: 0, sourceId: null, returned: 0 }, ctxOf())).toBe(true);
    expect(holds(table, { kind: "captives", max: 0, of: "actor" }, { actor: 0, sourceId: null, returned: 0 }, ctxOf())).toBe(false);
    expect(holds(table, { kind: "captives", max: 0, of: "actor" }, { actor: 1, sourceId: null, returned: 0 }, ctxOf())).toBe(true);
  });
});

describe("the rescue at the win (143070:B:3)", () => {
  it("returns each Captive among its owner's heroes in its place, controlled again, with its damage, tokens and text no longer blank", () => {
    const [captive] = captivesOf(table);
    const id = captive?.id ?? "";
    const slot = captive?.heroSlot;
    const hurt = updateCard(table, id, { damage: 2, resources: 1 });
    const rescued = rescueCaptives(hurt);
    expect(captivesOf(rescued)).toHaveLength(0);
    expect(rescued.cards[id]).toMatchObject({ zone: "heroes", controller: 0, face: "up", damage: 2, resources: 1 });
    expect(rescued.cards[id]?.captive).toBeUndefined();
    expect(rescued.cards[id]?.host ?? null).toBeNull();
    expect(slot).toBeDefined();
    expect(rescued.seats[0].heroes.indexOf(id)).toBe(slot);
    expect(textBlank(syncConstants(rescued, ctxOf()), id)).toBe(false);
  });

  it("changes nothing when no Captive is held", () => {
    const none = rescueCaptives(table);
    expect(rescueCaptives(none)).toBe(none);
  });
});

describe("TakeLoggedCaptives", () => {
  it("takes the hero the Campaign Log names for the seat, and nobody else", () => {
    const logged = table.seats[0].heroes.map((id) => table.cards[id]).find((card) => card?.code === "q2");
    const fresh = { ...table, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, heroLog: { heroes: [], fallen: [], fellowship: [], captives: [{ seat: 0, hero: "q2" }] } } };
    const first = captivesOf(fresh).map((card) => card.id);
    const next = run(fresh, { verb: "TakeLoggedCaptives", under: "143022" });
    expect(logged).toBeDefined();
    expect(captivesOf(next).map((card) => card.id).sort()).toEqual([...first, logged?.id ?? ""].sort());
  });

  it("does nothing for a log with no captive", () => {
    expect(run(table, { verb: "TakeLoggedCaptives", under: "143022" })).toBe(table);
  });
});

describe("a Captive held by Grishnákh (143024)", () => {
  // Grishnákh is revealed, the first player picks the Captive he holds (143024:A:1) and the choice is answered.
  const holding = (): { state: ScenarioState; grishnakh: string; captive: string } => {
    const steps: EngineStep[] = [];
    const revealed = revealFromTop(table, ctxOf(), "143024", steps);
    const state = finish({ state: revealed.state, steps }, ctxOf()).state;
    return { state, grishnakh: revealed.id, captive: captivesOf(state)[0]?.id ?? "" };
  };

  it("is attached to him, damaged, and returns under To Isengard! when he leaves play in any way", () => {
    const held = holding();
    expect(captivesOf(held.state)[0]?.host).toBe(held.grishnakh);
    const damaged = run(held.state, { verb: "DamageHeldCaptive", amount: 1 }, held.grishnakh);
    expect(damaged.cards[held.captive]?.damage).toBe(1);
    // He is discarded (any way out of play): the Captive lies under To Isengard! again with its damage.
    const gone = settle({ ...moveCard(damaged, held.grishnakh, { zone: "encounterDiscard" }), window: null }, ctxOf(), []);
    expect(gone.cards[held.grishnakh]?.zone).toBe("encounterDiscard");
    expect(gone.cards[held.captive]?.host).toBe(idOf(table, "143022"));
    expect(gone.cards[held.captive]?.damage).toBe(1);
    expect(gone.cards[held.captive]?.captive).toBe(true);
  });

  it("goes to its owner's discard pile when destroyed, and with no Captive left the constant loses the game (143022:A:1)", () => {
    const [captive] = captivesOf(table);
    const settled = (state: ScenarioState): ScenarioState => settle(syncConstants(state, ctxOf()), ctxOf(), []);
    expect(constantWin(syncConstants(table, ctxOf()), ctxOf()).lost).toBe(false);
    // 100 damage is the stand-in hero's hit points: it is destroyed in the captive zone and goes to the discard pile of the seat it belongs to.
    const hurt = run({ ...table, window: null }, { verb: "DamageHeldCaptive", amount: 100 }, idOf(table, "143022"));
    const destroyed = settled(hurt);
    expect(destroyed.cards[captive?.id ?? ""]?.zone).toBe("discard");
    expect(destroyed.seats[0].discard).toContain(captive?.id);
    expect(captivesOf(destroyed)).toHaveLength(0);
    // It is a Captive no more: nothing holds its owner in the game.
    expect(destroyed.cards[captive?.id ?? ""]?.captive).toBeUndefined();
    expect(destroyed.cards[captive?.id ?? ""]?.owner).toBeUndefined();
    expect(constantWin(syncConstants(destroyed, ctxOf()), ctxOf()).lost).toBe(true);
  });

  it("two-handed: a seat whose only Captive Grishnákh's damage destroys is out of heroes and eliminated, while the other seat's Captive stays under To Isengard! (rr.player-elimination)", () => {
    const made = tableFromLayout("the-uruk-hai", { seats: 2, stage: "143069", staging: ["143022", "143024"], captive: { hero: "dh2", under: "143022" } }, {});
    const grishnakh = idOf(made.state, "143024");
    const underIsengard = idOf(made.state, "dh2");
    const seat1 = made.seat1Hero ?? "";
    expect(made.state.seats[1].heroes).toEqual([seat1]);
    // Seat 1's only hero is held by Grishnákh and almost dead; his quest phase damage destroys it.
    const holding = updateCard(holdCaptive(made.state, seat1, grishnakh), seat1, { damage: 99 });
    expect(captivesOf(holding).map((card) => [card.owner, card.host])).toEqual([[0, idOf(made.state, "143022")], [1, grishnakh]]);
    expect(eliminateEmpties(holding, []).seats[1].eliminated).not.toBe(true);
    const fired = fireForced({ ...holding, window: null, phase: "Quest" }, { trigger: "endOfPhase", seat: null, phase: "Quest" }, made.ctx, []);
    const destroyed = eliminateEmpties(settle(fired, made.ctx, []), []);
    expect(destroyed.cards[seat1]?.zone).toBe("discard");
    expect(destroyed.seats[1].discard).toContain(seat1);
    expect(destroyed.cards[seat1]?.captive).toBeUndefined();
    expect(destroyed.seats[1].eliminated).toBe(true);
    expect(destroyed.seats[0].eliminated).not.toBe(true);
    expect(destroyed.cards[underIsengard]?.zone).toBe("captive");
  });
});
