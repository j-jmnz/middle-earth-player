// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages, dcce.sailing-tests, dcce.heading, rr.attachment-cards, rr.forced, rr.response, rr.shadow-effects, rr.engaged (data/rules/entries.json).
// Lines: 12020:A:2, 12020:A:3, 12020:A:4, 12021:A:2, 12021:A:3, 12022:A:2, 12023:A:1, 12023:A:2, 12024:A:1, 12025:A:2, 12026:A:2, 12027:A:1, 12027:A:2, 12028:A:2, 12029:A:2. The encounter cards of Flight of the
// Stormcaller, each read from its printed line on a table of plain-number heroes (test/scenarios/flight-of-the-stormcaller/scene.ts), with a second player where the line names whose card it is.
import { beforeAll, describe, expect, it } from "vitest";

import { definePrinted } from "../../../rules/core/printed.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { legalIntents } from "../../../rules/engine/legal.ts";
import { updateCard, withMode, type ScenarioState } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { hasTrait } from "../../../rules/interpret/conditions.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { areaOf } from "../../../rules/families/stormcaller/zone.ts";
import { revealedTop } from "../../../../test/harness/scene-kit.ts";
import { CODES, SHIPS, finish, flightFight, flightTable, idOf, idsOf, loadFlightWorld, resolveRecords, send, start, type FlightLayout, type FlightWorld } from "../../../../test/scenarios/flight-of-the-stormcaller/scene.ts";

let world: FlightWorld;

beforeAll(async () => {
  const loaded = await loadFlightWorld();
  const cards = new Map(loaded.cards);
  cards.set("attachment", definePrinted({ code: "attachment", name: "attachment", type: "attachment", sphere: "neutral", cost: 0 }));
  world = { ...loaded, cards };
});

const make = (layout: FlightLayout = {}) => flightTable(world, layout);
type Table = ReturnType<typeof make>;

const card = (state: ScenarioState, code: string, at = 0) => state.cards[idsOf(state, code)[at] ?? ""];
// A second player with the Dawn Star, and `allies` allies under that player.
function withSecondShip(made: Table, allies = 0): Table {
  let state = spawn(made.state, SHIPS.dawnStar, { zone: "play", seat: 1 }).state;
  for (let at = 0; at < allies; at += 1) state = spawn(state, "ally", { zone: "play", seat: 1 }).state;
  return { ...made, state: syncConstants(state, made.ctx) };
}
// The seat commits these characters to the quest (or to the Sailing test the stage asks for first).
const commit = (made: Table, state: ScenarioState, seat: number, ids: readonly string[]) => finish(send(start({ ...state, activeSeat: seat }), { type: "Commit", cardIds: ids }, made.ctx), made.ctx).state;
const allyIds = (state: ScenarioState, seat: number): string[] => Object.values(state.cards).filter((item) => item.code === "ally" && item.controller === seat).map((item) => item.id);
// The round ends: the Stormcaller's stage takes its progress.
const endRound = (made: Table, state: ScenarioState): ScenarioState => finish({ state: settle({ ...state, phase: "Beginning of round", boundaryPhase: "End of round", mode: "beginRound", window: null }, made.ctx, []), steps: [] }, made.ctx).state;

describe("the Ship enemies' Cannot have attachments (12020:A:2, 12021:A:2, 12022:A:2)", () => {
  it("12020:A:2 12021:A:2 12022:A:2 refuse a player attachment and an encounter card alike", () => {
    const made = make({ staging: [CODES.escort, CODES.raider, CODES.skiff] });
    for (const code of [CODES.escort, CODES.raider, CODES.skiff]) {
      expect(attachBlocked(made.state, made.ctx, idOf(made.state, code), "attachment"), code).toBe(true);
      expect(attachBlocked(made.state, made.ctx, idOf(made.state, code), CODES.squall), code).toBe(true);
    }
  });
});

describe("Sahír's Escort (12020)", () => {
  it("12020:A:4 goes to the Stormcaller's area, not the staging area, when it is revealed", () => {
    const state = revealedTop(make({ deck: ["f0"] }), CODES.escort);
    expect(card(state, CODES.escort)?.zone).toBe("stormcallerArea");
    expect(state.staging.map((id) => state.cards[id]?.code)).not.toContain(CODES.escort);
  });

  it("12020:A:3 adds its Threat to the progress the Stormcaller places at the end of the round while it is in the area, and not while it is engaged with a player", () => {
    // The Stormcaller's Threat 2 and the discarded card's 0, with the Escort's 2.
    const progressAfter = (layout: FlightLayout): number => {
      const made = make({ deck: ["f0"], ...layout });
      const state = endRound(made, made.state);
      return state.cards[areaOf(state)?.stage ?? ""]?.progress ?? 0;
    };
    expect(progressAfter({ area: [CODES.escort] })).toBe(4);
    expect(progressAfter({ engaged: [CODES.escort] })).toBe(2);
  });
});

describe("Swift Raider (12021)", () => {
  it("12021:A:3 engages the player who commits 4 or more characters to the quest, the second player as well as the first", () => {
    const made = withSecondShip(make({ seats: 2, staging: [CODES.raider] }), 3);
    const state = commit(made, made.state, 1, [made.seat1Hero ?? "", ...allyIds(made.state, 1)]);
    expect(card(state, CODES.raider)).toMatchObject({ zone: "engaged", controller: 1 });
    expect(state.seats[0]?.engaged).toHaveLength(0);
  });

  it("12021:A:3 engages the first player who commits 4 characters to a Sailing test", () => {
    const made = make({ stage: "12013", caller: 3, staging: [CODES.raider], play: ["ally", "ally"], deck: ["f0", "f0", "f0", "f0", "f0"] });
    const asked = settle({ ...made.state, mode: "questCommit", window: null }, made.ctx, []);
    expect(asked.sea?.sailing).toEqual({ step: "ask" });
    const state = commit(made, asked, 0, [made.hero, made.hero2, ...allyIds(asked, 0)]);
    expect(card(state, CODES.raider)).toMatchObject({ zone: "engaged", controller: 0 });
  });
});

describe("Corsair Seafarer (12023)", () => {
  const loaded = (made: Table, ids: readonly string[]): ScenarioState => ids.reduce((state, id) => updateCard(state, id, { resources: 2 }), made.state);

  it("12023:A:2 12023:A:1 moves 1 resource from a hero the engaged player commits to the quest onto it, and then it gets +1 Attack", () => {
    const made = make({ engaged: [CODES.seafarer] });
    const state = commit(made, loaded(made, [made.hero]), 0, [made.hero]);
    expect([card(state, CODES.seafarer)?.resources, state.cards[made.hero]?.resources]).toEqual([1, 1]);
    expect(modifiedStat(state, card(state, CODES.seafarer)!, "attack", world.cards)).toBe(2 + 1);
  });

  it("12023:A:2 takes nothing from a hero another player commits, nor when the engaged player commits an ally only", () => {
    const two = make({ seats: 2, engaged: [{ code: CODES.seafarer, seat: 0 }] });
    const other = commit(two, loaded(two, [two.seat1Hero ?? ""]), 1, [two.seat1Hero ?? ""]);
    expect([card(other, CODES.seafarer)?.resources, other.cards[two.seat1Hero ?? ""]?.resources]).toEqual([0, 2]);
    const allies = make({ engaged: [CODES.seafarer], play: ["ally"] });
    const ally = commit(allies, loaded(allies, [allies.hero]), 0, allyIds(allies.state, 0));
    expect([card(ally, CODES.seafarer)?.resources, ally.cards[allies.hero]?.resources]).toEqual([0, 2]);
  });

  // The first player commits a hero to the Sailing test stage 2 asks for, with the Seafarer engaged with the first player or with the second.
  const sailed = (seat: 0 | 1): { state: ScenarioState; made: Table } => {
    const made = make({ seats: 2, stage: "12013", caller: 3, engaged: [{ code: CODES.seafarer, seat }], deck: ["f0", "f0", "f0"] });
    const asked = settle({ ...loaded(made, [made.hero]), mode: "questCommit", window: null }, made.ctx, []);
    expect(asked.sea?.sailing).toEqual({ step: "ask" });
    return { state: commit(made, asked, 0, [made.hero]), made };
  };

  it("12023:A:2 moves 1 resource from a hero the engaged player commits to a Sailing test onto it", () => {
    const { state, made } = sailed(0);
    expect([card(state, CODES.seafarer)?.resources, state.cards[made.hero]?.resources]).toEqual([1, 1]);
  });

  it("12023:A:2 takes nothing from a hero committed to a Sailing test by a player it is not engaged with", () => {
    const { state, made } = sailed(1);
    expect([card(state, CODES.seafarer)?.resources, state.cards[made.hero]?.resources]).toEqual([0, 2]);
  });
});

describe("Serpent's Blade (12024)", () => {
  // The Stormcaller's stage 2 needs 12: 10 on it and the Stormcaller's Threat 2 fill it at the end of the round.
  const advanced = (layout: FlightLayout): ScenarioState => {
    const made = make({ callerProgress: 10, deck: ["f0", "f0"], phase: "Refresh", ...layout });
    return settle({ ...made.state, phase: "Beginning of round", boundaryPhase: "End of round", mode: "beginRound", window: null }, made.ctx, []);
  };

  it("12024:A:1 attacks the player it is engaged with, the second player, when the Stormcaller advances", () => {
    const state = advanced({ seats: 2, engaged: [{ code: CODES.blade, seat: 1 }] });
    expect(areaOf(state)?.number).toBe(3);
    expect(state.pendingAttack).toMatchObject({ enemyId: idOf(state, CODES.blade), seat: 1 });
  });

  it("12024:A:1 makes no attack from the staging area, where it is engaged with no player", () => {
    const state = advanced({ staging: [CODES.blade] });
    expect(areaOf(state)?.number).toBe(3);
    expect(state.pendingAttack ?? null).toBeNull();
  });
});

describe("Jagged Reef (12025)", () => {
  const travelBegins = (heading: "Sun" | "Rain"): ScenarioState => {
    const made = withSecondShip(make({ seats: 2, staging: [CODES.reef], heading, phase: "Encounter" }));
    return settle(withMode({ ...made.state, window: null, mode: "engagement" }, "travel"), made.ctx, []);
  };

  it("12025:A:2 deals 2 damage to each player's Ship objective at the beginning of the travel phase when off-course, and places no progress", () => {
    const state = travelBegins("Rain");
    expect([card(state, SHIPS.dreamChaser)?.damage, card(state, SHIPS.dawnStar)?.damage]).toEqual([2, 2]);
    expect(card(state, CODES.reef)?.progress).toBe(0);
  });

  it("12025:A:2 places 2 progress on itself on-course and damages no ship", () => {
    const state = travelBegins("Sun");
    expect(card(state, CODES.reef)?.progress).toBe(2);
    expect([card(state, SHIPS.dreamChaser)?.damage, card(state, SHIPS.dawnStar)?.damage]).toEqual([0, 0]);
  });
});

describe("Hidden Cove (12026)", () => {
  it("12026:A:2 heals 4 damage from each player's Ship objective after it becomes the active location, as a Response the players may take", () => {
    const made = withSecondShip(make({ seats: 2, staging: [CODES.cove], phase: "Travel", progress: 2 }));
    const chaser = idOf(made.state, SHIPS.dreamChaser);
    const star = idOf(made.state, SHIPS.dawnStar);
    const hurt = updateCard(updateCard(made.state, chaser, { damage: 6 }), star, { damage: 3 });
    const traveled = send(start(hurt), { type: "Travel", locationId: idOf(hurt, CODES.cove) }, made.ctx).state;
    const offered = legalIntents(traveled, made.ctx).find((intent) => intent.type === "Trigger");
    if (offered?.type !== "Trigger") throw new Error("no Response offered");
    // The Response waits for the players: nothing is healed until it is taken.
    expect([traveled.cards[chaser]?.damage, traveled.cards[star]?.damage]).toEqual([6, 3]);
    const state = send(start(traveled), { type: "Trigger", cardId: offered.cardId, effectId: offered.effectId }, made.ctx).state;
    expect([state.cards[chaser]?.damage, state.cards[star]?.damage]).toEqual([2, 0]);
  });
});

describe("Vast Coastland (12027) and Man Overboard! (12028)", () => {
  it("12027:A:1 goes to the Stormcaller's area when it is revealed", () => {
    const state = revealedTop(make({ deck: ["f0"] }), CODES.coastland);
    expect(card(state, CODES.coastland)?.zone).toBe("stormcallerArea");
    expect(areaOf(state)?.members).toContain(idOf(state, CODES.coastland));
  });

  const attackWith = (shadow: string, layout: FlightLayout): number => {
    const { during } = flightFight(world, shadow, "mild", layout);
    return modifiedStat(during, card(during, "mild")!, "attack", world.cards);
  };

  it("12027:A:2 gives the attacking enemy +2 Attack at the Stormcaller's stage, and nothing at another stage", () => {
    expect(attackWith(CODES.coastland, { stage: "12014", caller: 3 })).toBe(3 + 2);
    expect(attackWith(CODES.coastland, { stage: "12014", caller: 4 })).toBe(3);
  });

  it("12028:A:2 gives the attacking enemy +X Attack, X the number of the Stormcaller's current quest stage", () => {
    expect(attackWith(CODES.overboard, { caller: 2 })).toBe(3 + 2);
    expect(attackWith(CODES.overboard, { caller: 4 })).toBe(3 + 4);
  });
});

describe("Raging Squall (12029)", () => {
  it("12029:A:2 attaches to the current quest when it is revealed and counts there as a Condition attachment", () => {
    const made = make({ stage: "12013", caller: 3, deck: ["f0"] });
    const state = revealedTop(made, CODES.squall);
    const squall = idOf(state, CODES.squall);
    expect(state.cards[squall]).toMatchObject({ zone: "attached", host: state.questStage });
    expect(hasTrait(state, squall, "Condition", made.ctx)).toBe(true);
  });

  it("12029:A:2 off-course deals 1 damage to an ally of either player committed to the quest, and none to a hero", () => {
    const made = withSecondShip(make({ seats: 2, heading: "Storm", play: ["ally"] }), 1);
    const attached = resolveRecords(made.state, made.ctx, CODES.squall, "whenRevealed").state;
    const ours = allyIds(attached, 0)[0] ?? "";
    const theirs = allyIds(attached, 1)[0] ?? "";
    const first = commit(made, { ...attached, window: { kind: "pass" }, mode: "questCommit" }, 0, [made.hero, ours]);
    expect([first.cards[ours]?.damage, first.cards[made.hero]?.damage]).toEqual([1, 0]);
    const second = commit(made, { ...first, window: { kind: "pass" }, mode: "questCommit" }, 1, [theirs]);
    expect(second.cards[theirs]?.damage).toBe(1);
  });
});
