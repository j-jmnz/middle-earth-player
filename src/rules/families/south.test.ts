// Rules: mec109.stage-4, rr.active-location, rr.travel, rr.explored, rr.engaged, rr.ownership-and-control, mec109.immune-to-player-card-effects,
// rr.winning-the-game (data/rules/entries.json). The south family's verbs on a table of The Ring Goes South.
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { ruleCause } from "../cause.ts";
import { nextEnemyGroup } from "../combat.ts";
import { syncConstants } from "../constants.ts";
import type { EngineStep } from "../intents.ts";
import { runInstruction } from "../interpret.ts";
import { placeDamage } from "../keywords.ts";
import { legalIntents, legalTargets } from "../legal.ts";
import { settle } from "../machine.ts";
import { reduce } from "../reduce.ts";
import { flagged, type ScenarioState } from "../state.ts";
import { DOORS, loadSouthWorld, REDHORN_PASS, southTable, WATCHER, type SouthLayout, type SouthWorld } from "../../../scripts/south-scene.ts";
import { codesOf, first, send } from "../../../scripts/past-scene.ts";

let world: SouthWorld;

beforeAll(async () => {
  world = await loadSouthWorld();
});

function make(layout: SouthLayout = {}) {
  const made = southTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

type Table = ReturnType<typeof make>;

function run(state: ScenarioState, instruction: Instruction, sourceId: string | null, ctx: Table["ctx"], steps: EngineStep[] = []): ScenarioState {
  return settle(syncConstants({ ...runInstruction(state, instruction, { seat: 0, sourceId }, ctx, steps), window: null }, ctx), ctx, steps);
}

function hit(state: ScenarioState, id: string, amount: number, ctx: Table["ctx"]): ScenarioState {
  return settle(syncConstants(placeDamage(state, id, amount, ctx.cards, [], "combat", ruleCause("rr.step-6-8-3")), ctx), ctx, []);
}

describe("two active locations (mec109.stage-4)", () => {
  it("travels into the second slot while Doors of Durin is active, and offers no decline while a location can be traveled to", () => {
    const { state, ctx } = make({ stage: "142023", phase: "Travel", active: DOORS, staging: ["place", "place2"] });
    expect(legalIntents(state, ctx).map((intent) => intent.type)).toEqual(["Travel"]);
    const place = first(state, "place");
    expect([...legalTargets(state, { type: "Travel" }, ctx)].sort()).toEqual([place, first(state, "place2")].sort());
    const traveled = send({ state, steps: [] }, { type: "Travel", locationId: place }, ctx).state;
    expect(codesOf(traveled, [traveled.activeLocation ?? ""])).toEqual([DOORS]);
    expect(traveled.secondActiveLocation).toBe(place);
    expect(codesOf(traveled, traveled.staging)).toEqual(["place2"]);
    // Both slots are taken: no further travel.
    const again = { ...traveled, window: { kind: "travel" as const }, mode: "travel" as const };
    expect(legalTargets(again, { type: "Travel" }, ctx)).toEqual([]);
    expect(reduce(again, { type: "Travel", locationId: first(again, "place2") }, ctx).ok).toBe(false);
  });

  it("must travel on stages 2 to 4 if able, and may decline when no location is in the staging area or on stage 1", () => {
    for (const stage of ["142021", "142022", "142023"] as const) {
      const able = make({ stage, phase: "Travel", staging: ["place"] });
      expect(legalIntents(able.state, able.ctx).map((intent) => intent.type), stage).toEqual(["Travel"]);
      expect(reduce(able.state, { type: "DeclineTravel" }, able.ctx).ok, stage).toBe(false);
      const bare = make({ stage, phase: "Travel", staging: ["grunt"] });
      expect(legalIntents(bare.state, bare.ctx).map((intent) => intent.type), stage).toEqual(["DeclineTravel"]);
    }
    const one = make({ stage: "142020", phase: "Travel", staging: ["place"] });
    expect(legalIntents(one.state, one.ctx).map((intent) => intent.type)).toEqual(["Travel", "DeclineTravel"]);
  });

  it("with one active location slot, a second location cannot be traveled to", () => {
    const { state, ctx } = make({ stage: "142022", phase: "Travel", active: "place", staging: ["place2"] });
    expect(legalIntents(state, ctx).map((intent) => intent.type)).toEqual(["DeclineTravel"]);
  });

  it("places progress on the other active location before Doors of Durin, and on the quest after both", () => {
    const { state, ctx, frodo } = make({ stage: "142023", active: DOORS, second: "place" });
    const placed = run(state, { verb: "ProgressQuest", amount: 6 }, frodo, ctx);
    // 4 fill the other location (explored); 2 go on Doors.
    expect(placed.cards[first(state, DOORS)]?.progress).toBe(2);
    expect(placed.secondActiveLocation).toBeNull();
    expect(codesOf(placed, placed.encounterDiscard)).toContain("place");
    // Doors takes the 7 it still needs and is explored: the players win.
    const more = run(placed, { verb: "ProgressQuest", amount: 20 }, frodo, ctx);
    expect(more.stageCleared).toBe(true);
    expect(codesOf(more, more.victory)).toContain(DOORS);
  });

  it("Doors of Durin takes no progress unless the first player controls the Ring-bearer; the progress goes on the quest instead", () => {
    const hidden = make({ stage: "142023", active: DOORS, captive: true });
    const blocked = run(hidden.state, { verb: "ProgressQuest", amount: 3 }, hidden.frodo, hidden.ctx);
    expect(blocked.cards[first(hidden.state, DOORS)]?.progress).toBe(0);
    expect(blocked.cards[blocked.questStage ?? ""]?.progress).toBe(3);
    const held = make({ stage: "142023", active: DOORS });
    const taken = run(held.state, { verb: "ProgressQuest", amount: 3 }, held.frodo, held.ctx);
    expect(taken.cards[first(held.state, DOORS)]?.progress).toBe(3);
    // Two players: Frodo is controlled by seat 0. When seat 1 holds the first player token, Doors takes none.
    const other = make({ stage: "142023", active: DOORS, seats: 2 });
    const second = run({ ...other.state, firstPlayer: 1 }, { verb: "ProgressQuest", amount: 3 }, other.frodo, other.ctx);
    expect(second.cards[first(other.state, DOORS)]?.progress).toBe(0);
  });

  it("the players lose the game at 9 damage tokens on Doors of Durin (142030:A:3)", () => {
    const { state, ctx } = make({ stage: "142023", active: DOORS });
    const doors = first(state, DOORS);
    const withDamage = (damage: number): ScenarioState => settle(syncConstants({ ...state, cards: { ...state.cards, [doors]: { ...state.cards[doors]!, damage } } }, ctx), ctx, []);
    expect(withDamage(8).lost).toBe(false);
    const nine = withDamage(9);
    expect(nine.lost).toBe(true);
    expect(nine.lossReason).toContain("Doors of Durin");
  });

  it("an explored second active location hears its own Forced effect (Redhorn Pass: each player assigns X damage)", () => {
    const { state, ctx, frodo } = make({ stage: "142023", active: DOORS, second: REDHORN_PASS });
    const pass = first(state, REDHORN_PASS);
    const hurt = { ...state, cards: { ...state.cards, [pass]: { ...state.cards[pass]!, damage: 1 } } };
    // 6 progress explores it; Frodo (his wound turns the damage into life) and Sam are the options: the player assigns the 1 damage.
    const explored = run(hurt, { verb: "PlaceProgressOn", amount: 6, target: "activeLocation" }, frodo, ctx);
    expect(explored.secondActiveLocation).toBeNull();
    expect(codesOf(explored, explored.victory)).toContain(REDHORN_PASS);
    expect(explored.window?.kind).toBe("choose");
  });
});

describe("the Ring-bearer facedown under the Watcher in the Water (mec109.stage-4)", () => {
  it("CaptureRingBearer discards the tokens and places Frodo and each attached card facedown, in play and under nobody's control", () => {
    const { state, ctx, frodo } = make({ stage: "142023", staging: [WATCHER], active: DOORS });
    const hero = state.cards[frodo]!;
    const hurt = { ...state, cards: { ...state.cards, [frodo]: { ...hero, damage: 2, resources: 3 } } };
    const after = run(hurt, { verb: "CaptureRingBearer", under: WATCHER }, state.questStage, ctx);
    const card = after.cards[frodo]!;
    expect(card.zone).toBe("captive");
    expect(card.host).toBe(first(after, WATCHER));
    expect(card.controller).toBeNull();
    expect(card.face).toBe("down");
    expect([card.damage, card.resources, card.progress]).toEqual([0, 0, 0]);
    expect(after.seats[0].heroes).not.toContain(frodo);
    expect(card.attachments).toHaveLength(2);
    for (const id of card.attachments) {
      expect(after.cards[id]?.host).toBe(frodo);
      expect(after.cards[id]?.face).toBe("down");
      expect(after.cards[id]?.controller).toBeNull();
      expect(after.seats[0].play).not.toContain(id);
    }
    // Nobody can commit Frodo.
    expect(legalTargets({ ...after, window: { kind: "pass" }, mode: "questCommit" }, { type: "Commit" }, ctx)).not.toContain(frodo);
  });

  it("ReleaseRingBearer gives it to the first player, exhausted with 1 damage, with the cards attached to it back in play", () => {
    const { state, ctx, watcher } = make({ stage: "142023", seats: 2, captive: true, active: DOORS });
    const released = run({ ...state, firstPlayer: 1 }, { verb: "ReleaseRingBearer", damage: 1 }, watcher, ctx);
    const frodo = first(state, "141001");
    const card = released.cards[frodo]!;
    expect(card.zone).toBe("heroes");
    expect(card.controller).toBe(1);
    expect(released.seats[1].heroes).toContain(frodo);
    expect(card.exhausted).toBe(true);
    expect(card.damage).toBe(1);
    expect(card.face).toBe("up");
    const ring = first(state, "141085");
    expect(released.cards[ring]?.controller).toBe(1);
    expect(released.seats[1].play).toContain(ring);
    expect(released.cards[ring]?.host).toBe(frodo);
    // The wound, a Condition an encounter card attached, stays controlled by nobody.
    expect(released.cards[first(state, "141057")]?.controller).toBeNull();
  });

  it("the Watcher releases the Ring-bearer on the 6th damage token only: 6 at once, 5 then 1, 5 then 2 or 3 then 3, once", () => {
    for (const hits of [[6], [5, 1], [5, 2], [3, 3]]) {
      const { state, ctx } = make({ stage: "142023", captive: true, active: DOORS });
      const watcher = first(state, WATCHER);
      const frodo = first(state, "141001");
      let now = state;
      let released = 0;
      for (const amount of hits) {
        const before = now.cards[frodo]?.zone;
        now = hit(now, watcher, amount, ctx);
        if (before === "captive" && now.cards[frodo]?.zone === "heroes") released += 1;
      }
      expect(released, hits.join("+")).toBe(1);
    }
  });

  it("damage after the release is not another 6th token; the Watcher is indestructible and stays in the staging area", () => {
    const { state, ctx } = make({ stage: "142023", captive: true, active: DOORS });
    const watcher = first(state, WATCHER);
    const frodo = first(state, "141001");
    const released = hit(state, watcher, 6, ctx);
    expect(released.cards[frodo]?.damage).toBe(1);
    const more = hit(released, watcher, 20, ctx);
    expect(more.cards[frodo]?.damage).toBe(1);
    expect(more.cards[watcher]?.zone).toBe("staging");
    expect(more.cards[watcher]?.damage).toBe(26);
  });
});

describe("an enemy engaged with each player while it stays in the staging area (142024:A:2)", () => {
  it("holds its flags, adds no Threat, and attacks each player once in the combat phase", () => {
    const { state, ctx } = make({ stage: "142023", seats: 2, captive: true, active: DOORS, phase: "Combat" });
    const watcher = first(state, WATCHER);
    for (const flag of ["engagedWithAll", "cannotBeEngaged", "noThreatContribution", "attackableByAny"] as const) expect(flagged(state, watcher, flag), flag).toBe(true);
    expect(nextEnemyGroup(state)).toEqual({ seat: 0, enemies: [watcher] });
    expect(nextEnemyGroup({ ...state, resolvedAttacks: [`${watcher}@0`] })).toEqual({ seat: 1, enemies: [watcher] });
    expect(nextEnemyGroup({ ...state, resolvedAttacks: [`${watcher}@0`, `${watcher}@1`] })).toBeNull();
    void ctx;
  });
});
