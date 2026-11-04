// Rules: rr.guarded, wor.guarded-x, rr.objective-cards, rr.ownership-and-control, rr.action, mec109.archery, rr.attachment-cards (data/rules/entries.json).
// The towers of Cobas Haven and the cards that attach a Ship enemy to an objective as its guard, each read straight from its record (ledger lines 12134:A:1 to 12137:A:3, 12121:A:1, 12121:B:3, 12126:A:3, 12127:A:3,
// 12133:A:1) on the table of A Storm on Cobas Haven (test/scenarios/a-storm-on-cobas-haven/scene.ts). The family's verbs, its pick filters and its sweep are exercised through those records.
import { beforeAll, describe, expect, it } from "vitest";

import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { addStandIns } from "../../../../test/harness/scene-kit.ts";
import { CODES, havenTable, idOf, idsOf, legalIntents, loadHavenWorld, resolveRecords, send, start, type HavenLayout, type HavenWorld } from "../../../../test/scenarios/a-storm-on-cobas-haven/scene.ts";
import { archeryTotal } from "../../combat/combat.ts";
import { destroyCard } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { heldAmount, updateCard } from "../../core/state.ts";
import { attachTo, spawn } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { freeOfEncounters } from "./index.ts";
import { controlledByPlayers, controlSweep } from "./control.ts";

let world: HavenWorld;
beforeAll(async () => {
  world = await loadHavenWorld();
  addStandIns(world.cards, ["ship"]);
  for (const [code, card] of await loadPrinted([CODES.dolAmrothWarship])) world.cards.set(code, card);
});
const make = (layout: HavenLayout = {}) => havenTable(world, { phase: "Quest", ...layout });

const TOWERS = [CODES.seaWardTower, CODES.towerOfTheGull, CODES.theBeacon, CODES.towerOfTheHeron];

// A table with the tower in the staging area, guarded by a "ship" enemy attached to it the way a guard is.
function guarded(code: string, layout: HavenLayout = {}) {
  const made = make({ ...layout, staging: [code, "ship", ...(layout.staging ?? [])] });
  const tower = idOf(made.state, code);
  const ship = idOf(made.state, "ship");
  const attached = updateCard(attachTo(made.state, ship, tower), ship, { guard: true });
  return { ...made, tower, ship, state: syncConstants(attached, made.ctx) };
}

const settled = (state: ScenarioState, ctx: ReturnType<typeof make>["ctx"]) => syncConstants(settle({ ...state, window: state.window }, ctx, []), ctx);

describe("Guarded towers (12134:A:1, 12134:A:2 and their twins)", () => {
  it.each(TOWERS)("%s: Guarded attaches the next card of the encounter deck as its guard, and the tower is not the players' while it is guarded", (code) => {
    const made = make({ staging: [code], deck: ["f3", "f0"] });
    const tower = idOf(made.state, code);
    const done = resolveRecords(made.state, made.ctx, code, "whenRevealed", tower);
    const guard = idOf(done.state, "f3");
    expect(done.state.cards[guard]?.host).toBe(tower);
    expect(done.state.cards[guard]?.guard).toBe(true);
    expect(freeOfEncounters(done.state, tower)).toBe(false);
    expect(done.state.cards[tower]?.claimed).toBeUndefined();
    expect(done.state.cards[tower]?.zone).toBe("staging");
  });

  it.each(TOWERS)("%s: when its guard leaves play it stays in the staging area, claimed, with no controller", (code) => {
    const { state, ctx, tower, ship } = guarded(code);
    expect(state.cards[tower]?.claimed).toBeUndefined();
    const killed = settled(destroyCard(state, ship, ctx.cards, []), ctx);
    expect(freeOfEncounters(killed, tower)).toBe(true);
    expect(killed.cards[tower]?.zone).toBe("staging");
    expect(killed.cards[tower]?.claimed).toBe(true);
    expect(killed.cards[tower]?.controller).toBeNull();
    expect(controlledByPlayers(killed, tower)).toBe(true);
    expect(killed.staging).toContain(tower);
  });

  it("is controlled at once when the card Guarded reveals is a treachery, which attaches nothing", () => {
    const made = make({ staging: [CODES.seaWardTower], deck: ["treachery", "f0"] });
    const tower = idOf(made.state, CODES.seaWardTower);
    const done = resolveRecords(made.state, made.ctx, CODES.seaWardTower, "whenRevealed", tower);
    expect(done.state.cards[tower]?.attachments).toEqual([]);
    expect(settled(done.state, made.ctx).cards[tower]?.claimed).toBe(true);
  });

  it("is not controlled by the sweep while an effect is resolving (a tower just revealed is free before its Guarded keyword attaches)", () => {
    const made = make({ staging: [CODES.towerOfTheHeron], deck: ["f3"] });
    const tower = idOf(made.state, CODES.towerOfTheHeron);
    const withFrame = { ...made.state, stack: [{ frame: "reveal" } as unknown as ScenarioState["stack"][number]] };
    expect(controlSweep(withFrame, made.ctx).cards[tower]?.claimed).toBeUndefined();
    expect(controlSweep({ ...withFrame, stack: [] }, made.ctx).cards[tower]?.claimed).toBe(true);
  });

  it("a controlled tower can be guarded again and stays the players' (the control is not taken back)", () => {
    const { state, ctx, tower, ship } = guarded(CODES.seaWardTower);
    const freed = settled(destroyCard(state, ship, ctx.cards, []), ctx);
    const again = spawn(freed, "ship", { zone: "staging" });
    const attached = updateCard(attachTo(again.state, again.id, tower), again.id, { guard: true });
    expect(freeOfEncounters(attached, tower)).toBe(false);
    expect(settled(attached, ctx).cards[tower]?.claimed).toBe(true);
  });
});

describe("While the players control the tower (A:3)", () => {
  it("12134 Sea-ward Tower: each Sailing test looks at 2 more cards, only while the players control it", () => {
    const { state, ctx, tower, ship } = guarded(CODES.seaWardTower);
    expect(heldAmount(state, "table", "sailingLook")).toBe(0);
    const freed = settled(destroyCard(state, ship, ctx.cards, []), ctx);
    expect(freed.cards[tower]?.claimed).toBe(true);
    expect(heldAmount(freed, "table", "sailingLook")).toBe(2);
  });

  it("12137 Tower of the Heron: the archery total is 4 lower, and never below 0", () => {
    const made = make({ staging: [CODES.towerOfTheHeron, CODES.siegeShip, CODES.siegeShip, CODES.siegeShip], phase: "Combat" });
    const tower = idOf(made.state, CODES.towerOfTheHeron);
    const before = archeryTotal(made.state, made.ctx.cards);
    expect(before).toBe(6);
    const owned = syncConstants(updateCard(made.state, tower, { claimed: true, controller: null }), made.ctx);
    expect(archeryTotal(owned, made.ctx.cards)).toBe(2);
    const alone = syncConstants(updateCard(make({ staging: [CODES.towerOfTheHeron, CODES.siegeShip] }).state, tower, { claimed: true, controller: null }), made.ctx);
    expect(archeryTotal(alone, made.ctx.cards)).toBe(0);
  });
});

describe("The Actions of the towers (12135:A:3, 12136:A:3)", () => {
  const owned = (code: string, layout: HavenLayout) => {
    const made = make({ ...layout, staging: [code, ...(layout.staging ?? [])] });
    const tower = idOf(made.state, code);
    return { ...made, tower, state: syncConstants(updateCard(made.state, tower, { claimed: true, controller: null }), made.ctx) };
  };
  const intentFor = (state: ScenarioState, ctx: ReturnType<typeof make>["ctx"], effectId: string) => legalIntents(state, ctx).find((item) => item.type === "Trigger" && item.effectId === effectId);

  it("12135 Tower of the Gull: in the combat phase, exhausts to deal 2 damage to a non-unique Ship enemy; not before it is the players', not outside combat", () => {
    const layout = { staging: ["ship"], phase: "Combat" } satisfies HavenLayout;
    const free = make({ ...layout, staging: [CODES.towerOfTheGull, "ship"] });
    expect(intentFor(free.state, free.ctx, "12135:action:1")).toBeUndefined();
    const { state, ctx, tower } = owned(CODES.towerOfTheGull, layout);
    const intent = intentFor(state, ctx, "12135:action:1");
    expect(intent).toBeDefined();
    if (intent?.type !== "Trigger") throw new Error("no trigger");
    const done = send({ state, steps: [] }, intent, ctx).state;
    expect(done.cards[tower]?.exhausted).toBe(true);
    expect(done.cards[idOf(done, "ship")]?.damage).toBe(2);
    expect(intentFor(done, ctx, "12135:action:1")).toBeUndefined();
    const quest = owned(CODES.towerOfTheGull, { staging: ["ship"], phase: "Quest" });
    expect(intentFor(quest.state, quest.ctx, "12135:action:1")).toBeUndefined();
  });

  it("12135 Tower of the Gull: any player may trigger it, and it is not offered without a non-unique Ship enemy", () => {
    const { state, ctx } = owned(CODES.towerOfTheGull, { seats: 2, staging: ["ship"], phase: "Combat" });
    expect(intentFor({ ...state, activeSeat: 1 }, ctx, "12135:action:1")).toBeDefined();
    const none = owned(CODES.towerOfTheGull, { staging: ["f3"], phase: "Combat" });
    expect(intentFor(none.state, none.ctx, "12135:action:1")).toBeUndefined();
  });

  it("12136 The Beacon: in the planning phase, exhausts and spends 5 resources to take control of a set aside Dol Amroth Warship", () => {
    const { state, ctx, tower, hero } = owned(CODES.theBeacon, { phase: "Planning", setAside: [CODES.dolAmrothWarship] });
    const funded = updateCard(state, hero, { resources: 5 });
    const intent = intentFor(funded, ctx, "12136:action:1");
    expect(intent).toBeDefined();
    if (intent?.type !== "Trigger") throw new Error("no trigger");
    const warship = idOf(funded, CODES.dolAmrothWarship);
    expect(funded.cards[warship]?.zone).toBe("setAside");
    const done = send({ state: funded, steps: [] }, { ...intent, payments: [{ heroId: hero, amount: 5 }] }, ctx).state;
    expect(done.cards[tower]?.exhausted).toBe(true);
    expect(done.cards[hero]?.resources).toBe(0);
    expect(done.cards[warship]?.zone).toBe("play");
    expect(done.cards[warship]?.controller).toBe(0);
    // Not with fewer than 5 resources, and not before the players control it.
    expect(intentFor(updateCard(state, hero, { resources: 4 }), ctx, "12136:action:1")).toBeUndefined();
    const free = make({ phase: "Planning", staging: [CODES.theBeacon], setAside: [CODES.dolAmrothWarship] });
    expect(intentFor(updateCard(free.state, free.hero, { resources: 5 }), free.ctx, "12136:action:1")).toBeUndefined();
  });
});

describe("Attaching a Ship enemy to an objective, guarding it", () => {
  const stage2 = (layout: HavenLayout = {}) => make({ stage: "12121", ...layout });

  it("12121:A:1 adds a Ship enemy from the encounter deck to the staging area and guards each unguarded objective with a non-unique Ship enemy there", () => {
    const made = stage2({ staging: [CODES.seaWardTower, CODES.towerOfTheHeron], deck: ["f3", "ship", "f0"], discard: [CODES.heavyCruiser] });
    const done = resolveRecords(made.state, made.ctx, "12121", "whenRevealed", idOf(made.state, "12121"), (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    const towers = [CODES.seaWardTower, CODES.towerOfTheHeron].map((code) => idOf(done.state, code));
    const guards = towers.map((id) => done.state.cards[id]?.attachments ?? []);
    // One Ship enemy was found (1 player), so one tower is guarded; the other has no Ship enemy left.
    expect(guards.flat().length).toBe(1);
    const guard = guards.flat()[0] ?? "";
    expect(done.state.cards[guard]?.guard).toBe(true);
    expect(done.state.cards[guard]?.zone).toBe("staging");
  });

  it("12121:A:1 with two Ship enemies already in the staging area guards both objectives, and an enemy that guards one is not moved to another", () => {
    const made = stage2({ staging: [CODES.seaWardTower, CODES.towerOfTheHeron, "ship", "ship"], deck: ["f0"] });
    const done = resolveRecords(made.state, made.ctx, "12121", "whenRevealed", idOf(made.state, "12121"));
    const [a, b] = [CODES.seaWardTower, CODES.towerOfTheHeron].map((code) => done.state.cards[idOf(done.state, code)]?.attachments ?? []);
    expect(a?.length).toBe(1);
    expect(b?.length).toBe(1);
    expect(a?.[0]).not.toBe(b?.[0]);
  });

  it("12121:B:3 bars advancing while an objective is guarded by an encounter, and only then", () => {
    const { state, ctx } = guarded(CODES.seaWardTower, { stage: "12121" });
    expect(restricted(state, ctx, "advance").length).toBeGreaterThan(0);
    const freed = make({ stage: "12121", staging: [CODES.seaWardTower] });
    expect(restricted(freed.state, freed.ctx, "advance")).toEqual([]);
  });

  it("12126 Siege Ship: at the end of the quest phase it attaches to an unguarded objective in the staging area, only when it guards nothing", () => {
    const made = make({ staging: [CODES.siegeShip, CODES.seaWardTower] });
    const ship = idOf(made.state, CODES.siegeShip);
    const tower = idOf(made.state, CODES.seaWardTower);
    const done = resolveRecords(made.state, made.ctx, CODES.siegeShip, "forced", ship);
    expect(done.state.cards[ship]?.host).toBe(tower);
    expect(done.state.cards[ship]?.guard).toBe(true);
    // Already guarding: nothing more happens (a second objective stays unguarded).
    const two = make({ staging: [CODES.siegeShip, CODES.seaWardTower, CODES.towerOfTheHeron] });
    const first = resolveRecords(two.state, two.ctx, CODES.siegeShip, "forced", idOf(two.state, CODES.siegeShip));
    const again = resolveRecords(first.state, two.ctx, CODES.siegeShip, "forced", idOf(first.state, CODES.siegeShip));
    expect(again.state.cards[idOf(again.state, CODES.siegeShip)]?.host).toBe(first.state.cards[idOf(first.state, CODES.siegeShip)]?.host);
    // No unguarded objective: it stays in the staging area unattached.
    const lone = make({ staging: [CODES.siegeShip] });
    expect(resolveRecords(lone.state, lone.ctx, CODES.siegeShip, "forced", idOf(lone.state, CODES.siegeShip)).state.cards[idOf(lone.state, CODES.siegeShip)]?.host).toBeNull();
  });

  it("12127 Heavy Cruiser: finds a Dol Amroth objective in the encounter deck or discard pile, adds it to the staging area and guards it", () => {
    const made = make({ staging: [CODES.heavyCruiser], deck: ["f0", CODES.towerOfTheGull] });
    const cruiser = idOf(made.state, CODES.heavyCruiser);
    const done = resolveRecords(made.state, made.ctx, CODES.heavyCruiser, "whenRevealed", cruiser);
    const tower = idOf(done.state, CODES.towerOfTheGull);
    expect(done.state.cards[tower]?.zone).toBe("staging");
    expect(done.state.cards[cruiser]?.host).toBe(tower);
    expect(done.state.cards[cruiser]?.guard).toBe(true);
    expect(done.state.cards[tower]?.claimed).toBeUndefined();
    expect(settled(done.state, made.ctx).cards[tower]?.claimed).toBeUndefined();
    // With no such objective to find, the Cruiser stays in the staging area unattached.
    const empty = make({ staging: [CODES.heavyCruiser], deck: ["f0"] });
    const none = resolveRecords(empty.state, empty.ctx, CODES.heavyCruiser, "whenRevealed", idOf(empty.state, CODES.heavyCruiser));
    expect(none.state.cards[idOf(none.state, CODES.heavyCruiser)]?.host).toBeNull();
  });

  // The treachery is revealed from the top of the encounter deck by the first seat, with the next card behind it for its surge.
  const revealAssault = (layout: HavenLayout) => {
    const made = make({ ...layout, deck: [CODES.theRaidersAssault, "f3", "f0"] });
    return { made, state: send(start(made.state), { type: "Pass" }, made.ctx).state };
  };

  it("12133 The Raiders' Assault: a Ship enemy in the staging area guards an unguarded objective, and the treachery gains surge (nothing was returned)", () => {
    const { state } = revealAssault({ staging: ["ship", CODES.towerOfTheHeron] });
    expect(state.cards[idOf(state, "ship")]?.host).toBe(idOf(state, CODES.towerOfTheHeron));
    expect(state.cards[idOf(state, "ship")]?.guard).toBe(true);
    // The surge revealed the next card.
    expect(state.cards[idOf(state, "f3")]?.zone).toBe("staging");
    expect(state.cards[idOf(state, "f0")]?.zone).toBe("encounterDeck");
  });

  it("12133 The Raiders' Assault: an engaged Ship enemy returns to the staging area first, so the treachery does not gain surge", () => {
    const { state } = revealAssault({ engaged: [{ code: "ship", seat: 0 }], staging: [CODES.towerOfTheHeron] });
    expect(state.cards[idOf(state, "ship")]?.zone).toBe("staging");
    expect(state.cards[idOf(state, "ship")]?.host).toBe(idOf(state, CODES.towerOfTheHeron));
    expect(state.cards[idOf(state, "f3")]?.zone).toBe("encounterDeck");
  });

  it("12133 The Raiders' Assault: with no unguarded objective nothing is chosen or returned, and it gains surge", () => {
    const { state } = revealAssault({ engaged: [{ code: "ship", seat: 0 }] });
    expect(state.cards[idOf(state, "ship")]?.zone).toBe("engaged");
    expect(state.cards[idOf(state, "f3")]?.zone).toBe("staging");
  });

  it("an enemy that already guards is not offered to The Raiders' Assault", () => {
    const { state, ctx } = guarded(CODES.towerOfTheHeron, { staging: [CODES.towerOfTheGull] });
    const assault = spawn(state, CODES.theRaidersAssault, { zone: "staging" });
    const done = resolveRecords(assault.state, ctx, CODES.theRaidersAssault, "whenRevealed", assault.id);
    expect(done.state.cards[idOf(done.state, CODES.towerOfTheGull)]?.attachments).toEqual([]);
    expect(idsOf(done.state, "ship").length).toBe(1);
  });
});
