// Rules: dcce.ship-enemies, dcce.ship-objectives, rr.ownership-and-control, rr.destroy, rr.response (data/rules/entries.json); ledger line 12125:A:3.
// Corsair Skirmisher's Response: after it is destroyed as an enemy, the engaged player may discard allies with a total of at least 3 Willpower to take control of it as a Ship-objective with Willpower equal to
// its Threat. The verbs DiscardAlliesForWillpower and TakeControlAsShip, the condition alliesWillpower, the Response's `answeredBy` and the card `<code>~ship` they make, each on the table of the scenario.
import { beforeAll, describe, expect, it } from "vitest";

import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { addStandIns, allyCard } from "../../../../test/harness/scene-kit.ts";
import type { PickSpec } from "../../../catalog/boundary.ts";
import { ruleCause } from "../../core/cause.ts";
import { CODES, havenTable, idOf, loadHavenWorld, send, type HavenLayout, type HavenWorld } from "../../../../test/scenarios/a-storm-on-cobas-haven/scene.ts";
import { legalIntents } from "../../engine/legal.ts";
import { modifiedStat, placeDamage } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import { countMatching } from "../../interpret/pick.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { alliesWillpowerHolds } from "./skirmisher.ts";
import { shipMayAttack, shipMayDefend, shipObjectivesAmong } from "./ships.ts";

let world: HavenWorld;
beforeAll(async () => {
  world = await loadHavenWorld();
  addStandIns(world.cards, ["mild"]);
  world.cards.set("ally2", allyCard("ally2", 1, { willpower: 2 }));
  world.cards.set("ally1", allyCard("ally1", 1, { willpower: 1 }));
  for (const [code, card] of await loadPrinted([CODES.dreamChaser])) world.cards.set(code, card);
});

type Table = ReturnType<typeof havenTable>;
const SKIRMISHER = CODES.corsairSkirmisher;
const make = (layout: HavenLayout = {}): Table => havenTable(world, { phase: "Combat", ...layout });
// The seat controls allies of these codes.
function allies(made: Table, seat: number, codes: readonly string[]): Table {
  return { ...made, state: codes.reduce((state, code) => spawn(state, code, { zone: "play", seat }).state, made.state) };
}
// The Skirmisher takes more damage than it has hit points, and the table settles (the Response window opens when someone may use it).
function destroyed(made: Table): ScenarioState {
  const hurt = placeDamage(made.state, idOf(made.state, SKIRMISHER), 99, made.ctx.cards, [], "combat", ruleCause("rr.step-6-4-3"));
  return settle({ ...hurt, window: null, mode: "stopped" }, made.ctx, []);
}
const triggers = (state: ScenarioState, made: Table) => legalIntents(state, made.ctx).filter((intent) => intent.type === "Trigger");
// Answers each choice the effect opens with the option `pick` names.
function choose(state: ScenarioState, made: Table, pick: (options: readonly string[]) => string): ScenarioState {
  let current = state;
  for (let guard = 0; guard < 10 && current.window?.kind === "choose"; guard += 1) current = send({ state: current, steps: [] }, { type: "Choose", optionId: pick(current.window.options) }, made.ctx).state;
  return current;
}
const takeResponse = (state: ScenarioState, made: Table): ScenarioState => {
  const trigger = triggers(state, made)[0];
  if (!trigger || trigger.type !== "Trigger") throw new Error("no Response to use");
  return send({ state, steps: [] }, { type: "Trigger", cardId: trigger.cardId, effectId: trigger.effectId }, made.ctx).state;
};

describe("12125:A:3 Corsair Skirmisher: the Response", () => {
  it("is offered to the engaged player, not the first player, once they have allies with a total Willpower of 3", () => {
    const made = allies(make({ seats: 2, engaged: [{ code: SKIRMISHER, seat: 1 }] }), 1, ["ally2", "ally1"]);
    const after = destroyed(made);
    expect(after.window).toMatchObject({ kind: "response", seat: 1 });
    expect(triggers(after, made)).toHaveLength(1);
  });

  it("is not offered when the engaged player's allies total less than 3, whatever the other player holds", () => {
    const poor = allies(allies(make({ seats: 2, engaged: [{ code: SKIRMISHER, seat: 1 }] }), 1, ["ally2"]), 0, ["ally2", "ally2"]);
    expect(destroyed(poor).window?.kind).not.toBe("response");
  });

  it("is not offered when the Skirmisher is destroyed in the staging area, where no player is engaged with it", () => {
    const made = allies(make({ staging: [SKIRMISHER] }), 0, ["ally2", "ally1"]);
    expect(destroyed(made).window?.kind).not.toBe("response");
  });

  it("asks for the allies one at a time, discards them once they total 3 Willpower, and takes control of the Skirmisher as a Ship-objective", () => {
    const made = allies(make({ engaged: [SKIRMISHER] }), 0, ["ally1", "ally1", "ally2", "ally2"]);
    const enemy = idOf(made.state, SKIRMISHER);
    const used = takeResponse(destroyed(made), made);
    expect(used.window?.kind).toBe("choose");
    const options = used.window?.kind === "choose" ? used.window.options : [];
    expect(options).toHaveLength(4);
    // A Willpower 2 ally, then a Willpower 1 ally: 3 in all, and the second ally ends the choice.
    const two = options.find((id) => used.cards[id]?.code === "ally2") ?? "";
    const one = options.find((id) => used.cards[id]?.code === "ally1") ?? "";
    const asked = send({ state: used, steps: [] }, { type: "Choose", optionId: two }, made.ctx).state;
    expect(asked.window?.kind).toBe("choose");
    expect(asked.window?.kind === "choose" ? asked.window.options : []).not.toContain(two);
    const done = send({ state: asked, steps: [] }, { type: "Choose", optionId: one }, made.ctx).state;
    expect(done.cards[two]?.zone).toBe("discard");
    expect(done.cards[one]?.zone).toBe("discard");
    expect(Object.values(done.cards).filter((card) => (card.code === "ally1" || card.code === "ally2") && card.zone === "play")).toHaveLength(2);
    const ship = done.cards[enemy];
    expect(ship).toMatchObject({ code: "12125~ship", zone: "play", controller: 0, damage: 0, exhausted: false });
    expect(done.encounterDiscard).not.toContain(enemy);
  });

  it("the discarded allies are the ones the player chose: Willpower 2 and 2 are enough, and nothing is asked once one choice is left", () => {
    const made = allies(make({ engaged: [SKIRMISHER] }), 0, ["ally2", "ally1"]);
    // Two allies of Willpower 3 in all: the first choice leaves one ally, who is taken without a question.
    const used = takeResponse(destroyed(made), made);
    const first = used.window?.kind === "choose" ? used.window.options[0] ?? "" : "";
    const done = send({ state: used, steps: [] }, { type: "Choose", optionId: first }, made.ctx).state;
    expect(done.window?.kind).not.toBe("choose");
    expect(Object.values(done.cards).filter((card) => card.zone === "discard" && card.code.startsWith("ally"))).toHaveLength(2);
    expect(done.cards[idOf(done, "12125~ship")]?.zone).toBe("play");
  });

  it("declining leaves the Skirmisher destroyed, in the encounter discard pile, as the enemy it was", () => {
    const made = allies(make({ engaged: [SKIRMISHER] }), 0, ["ally2", "ally1"]);
    const declined = send({ state: destroyed(made), steps: [] }, { type: "Pass" }, made.ctx).state;
    const enemy = idOf(made.state, SKIRMISHER);
    expect(declined.cards[enemy]).toMatchObject({ code: SKIRMISHER, zone: "encounterDiscard" });
    expect(declined.cards[enemy]?.controller).toBeNull();
  });
});

// dcce.ship-objectives: Ship-objectives "are considered to be allies (and characters) for all purposes". A controlled ship is offered for the discard although it prints "Immune to player card effects": the
// Skirmisher is an encounter card, so the immunity does not apply.
describe("12125:A:3 the discard offers controlled Ship-objectives as allies", () => {
  it("a Dream-chaser (Willpower 5) and a Willpower 1 ally are both offered, and together hold the total of 3", () => {
    const made = allies(make({ engaged: [SKIRMISHER], play: [CODES.dreamChaser] }), 0, ["ally1"]);
    const ship = idOf(made.state, CODES.dreamChaser);
    expect(alliesWillpowerHolds(made.state, 0, 3, idOf(made.state, SKIRMISHER), made.ctx)).toBe(true);
    const used = takeResponse(destroyed(made), made);
    const options = used.window?.kind === "choose" ? used.window.options : [];
    expect(options).toHaveLength(2);
    expect(options).toContain(ship);
    expect(options.map((id) => used.cards[id]?.code)).toContain("ally1");
  });

  it("when the allies chosen cannot reach the total nothing is discarded and the Skirmisher is not taken", () => {
    const made = allies(make({ engaged: [SKIRMISHER] }), 0, ["ally2", "ally1"]);
    const used = takeResponse(destroyed(made), made);
    const lost = Object.values(used.cards).find((card) => card.code === "ally1");
    // One ally leaves play while the choice is open: Willpower 2 is all that is left to give.
    const short = moveCard(used, lost?.id ?? "", { zone: "discard", seat: 0 });
    const two = used.window?.kind === "choose" ? used.window.options.find((id) => used.cards[id]?.code === "ally2") ?? "" : "";
    const done = send({ state: short, steps: [] }, { type: "Choose", optionId: two }, made.ctx).state;
    expect(done.cards[two]?.zone).toBe("play");
    expect(done.cards[idOf(done, SKIRMISHER)]).toMatchObject({ code: SKIRMISHER, zone: "encounterDiscard" });
  });
});

describe("12125:A:3 the Ship-objective it becomes (rules/core/printed.ts)", () => {
  const taken = (): { state: ScenarioState; made: Table; id: string } => {
    const made = allies(make({ engaged: [SKIRMISHER], play: [CODES.dreamChaser] }), 0, ["ally2", "ally1"]);
    const used = takeResponse(destroyed(made), made);
    const state = choose(used, made, (options) => options[0] ?? "");
    return { state, made, id: idOf(state, "12125~ship") };
  };

  it("loses the Ship-enemy card type and gains the Ship-objective type, with Willpower equal to its Threat and its Attack, Defense and hit points", () => {
    const enemy = printedOf(world.cards, SKIRMISHER);
    const ship = printedOf(world.cards, "12125~ship");
    expect(enemy).toMatchObject({ ship: "enemy", type: "enemy", threat: 3, attack: 4, defense: 4, health: 6 });
    expect(ship).toMatchObject({ ship: "objective", type: "objective", name: "Corsair Skirmisher", willpower: 3, attack: 4, defense: 4, health: 6, threat: null, engagementCost: null });
    expect(ship.traits).toEqual(enemy.traits);
    expect(ship.keywords.immuneToPlayerCardEffects).toBe(true);
    expect(ship.keywords.boarding).toBeNull();
    const { state, id, made } = taken();
    expect(modifiedStat(state, state.cards[id]!, "willpower", made.ctx.cards)).toBe(3);
  });

  it("is a Ship-objective of its controller's: it can defend only a Ship-enemy's attack, attack only a Ship-enemy, and takes the damage of an undefended Ship-enemy attack", () => {
    const { state, id, made } = taken();
    const ship = printedOf(made.ctx.cards, "12125~ship");
    const cruiser = printedOf(made.ctx.cards, CODES.lightCruiser);
    expect(shipMayAttack(ship, cruiser)).toBe(true);
    expect(shipMayAttack(ship, printedOf(made.ctx.cards, CODES.southronSailor))).toBe(false);
    expect(shipMayDefend({ ...state, pendingAttack: null }, ship, made.ctx.cards)).toBe(true);
    expect(shipObjectivesAmong([id, made.hero], state, made.ctx.cards)).toEqual([id]);
  });

  it("is counted as a Corsair Skirmisher the players control, and an engaged Skirmisher is not", () => {
    const { state, made } = taken();
    const pick: PickSpec = { type: "character", control: "any", names: ["Corsair Skirmisher"] };
    expect(countMatching(state, pick, 0, null, made.ctx)).toBe(1);
    const enemy = make({ engaged: [SKIRMISHER] });
    expect(countMatching(enemy.state, pick, 0, null, enemy.ctx)).toBe(0);
  });

  it("destroyed as a Ship-objective it is the enemy again in the discard pile, a destroyed character and not a destroyed enemy: no Response", () => {
    const { state, id, made } = taken();
    const hurt = placeDamage(state, id, 99, made.ctx.cards, [], "combat", ruleCause("rr.step-6-4-3"));
    const after = settle({ ...hurt, window: null, mode: "stopped" }, made.ctx, []);
    expect(after.cards[id]).toMatchObject({ code: SKIRMISHER, zone: "encounterDiscard" });
    expect(after.window?.kind).not.toBe("response");
  });

  it("a Ship-objective that leaves play by any route is the enemy again (restoreShipEnemies)", () => {
    const { state, id, made } = taken();
    const gone = settle({ ...state, cards: { ...state.cards, [id]: { ...state.cards[id]!, zone: "removed" } } }, made.ctx, []);
    expect(gone.cards[id]?.code).toBe(SKIRMISHER);
  });
});
