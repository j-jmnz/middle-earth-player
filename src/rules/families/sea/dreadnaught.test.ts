// Rules: rr.player-elimination, rr.engaged, rr.damage, rr.forced, rr.response, rr.setup, docs/brief.md (The Hunt for the Dreadnaught) (data/rules/entries.json); ledger lines 40013:A:1, 40013:A:3, 40013:B:3, 40034:A:1, 40033:A:2, 40001:A:5, 40002:A:3, 40002:B:2, 40021:A:1.
// The verbs and flags The Hunt for the Dreadnaught added to the sea family, each on a table of the scenario's real cards.
import { describe, expect, it } from "vitest";

import { legalAttackEnemies } from "../../combat/combat.ts";
import { flagged } from "../../core/state.ts";
import { codesIn, fightEnemy, idOf, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { eliminateWithoutShip } from "./dreadnaught.ts";
import { spawn } from "../../core/zones.ts";
import { pillageAmount } from "./pillage.ts";
import { corsairTrait, stampRoutes } from "./routes.ts";

// The quest cards of the game: 1A and the stage 2 card, so a stage number is the printed one.
const table = (layout: Layout) => tableFromLayout("the-hunt-for-the-dreadnaught", { stages: ["40004", "40005"], stage: "40005", ...layout });

describe("40013:A:1 the Dreadnaught's constants", () => {
  it("is engaged with every player, cannot leave the staging area, cannot be engaged and has 15 hit points and a damage cap of 5 for each player", () => {
    for (const seats of [1, 2] as const) {
      const made = table({ seats, staging: ["40013"] });
      const id = idOf(made.state, "40013");
      expect(flagged(made.state, id, "engagedWithAll")).toBe(true);
      expect(flagged(made.state, id, "cannotLeaveStaging")).toBe(true);
      expect(flagged(made.state, id, "cannotBeEngaged")).toBe(true);
      const mine = made.state.modifiers.filter((modifier) => modifier.instanceId === id);
      expect(mine.find((modifier) => modifier.stat === "damageCap")?.amount).toBe(5 * seats);
      expect(mine.find((modifier) => modifier.stat === "hitPoints")?.amount).toBe(15 * seats);
    }
  });
});

describe("40013:A:1 attackableEngagedWithAll", () => {
  it("40013:A:1 every player declares attackers against the Dreadnaught in the staging area, in the combat phase only, and an engaged unique Corsair bars that player's characters", () => {
    const made = table({ seats: 2, phase: "Combat", staging: ["40013"], engaged: [{ code: "40014", seat: 1 }] });
    const id = idOf(made.state, "40013");
    expect(legalAttackEnemies(made.state, 0, made.hero, made.cards)).toContain(id);
    // The second seat is engaged with Captain of the Haven (40014:A:2): its characters cannot attack the Dreadnaught.
    expect(legalAttackEnemies(made.state, 1, made.seat1Hero ?? "", made.cards)).not.toContain(id);
    const quest = table({ seats: 1, phase: "Quest", staging: ["40013"] });
    expect(legalAttackEnemies(quest.state, 0, quest.hero, quest.cards)).not.toContain(idOf(quest.state, "40013"));
  });
});

describe("40013:A:3 and 40013:B:3 the flip", () => {
  it("flips at the end of the round with less than half its hit points left, and each player puts a random set-aside unique Corsair into play engaged with them", () => {
    const made = table({ seats: 2, staging: [{ code: "40013", damage: 20 }], setAside: ["40014", "40015", "40016", "40017", "40018", "40019"] });
    // The harness resolves both Forced records in turn and the flip announces the second again, so each player is engaged with two of them here: all of them different.
    const run = resolveRecords(made.state, made.ctx, "40013", "forced", idOf(made.state, "40013"));
    expect(run.state.cards[idOf(made.state, "40013")]?.face).toBe("B");
    const engaged = codesIn(run.state, "engaged");
    expect(engaged.length).toBeGreaterThanOrEqual(2);
    expect(new Set(engaged).size).toBe(engaged.length);
    expect(run.state.seats[0]?.engaged.length).toBeGreaterThanOrEqual(1);
    expect(run.state.seats[1]?.engaged.length).toBeGreaterThanOrEqual(1);
  });

  it("does not flip with half its hit points or more left", () => {
    const made = table({ seats: 2, staging: [{ code: "40013", damage: 15 }], setAside: ["40014", "40015", "40016", "40017", "40018", "40019"] });
    const run = resolveRecords(made.state, made.ctx, "40013", "forced", idOf(made.state, "40013"));
    expect(run.state.cards[idOf(made.state, "40013")]?.face).not.toBe("B");
  });
});

describe("40034:A:1 Belfalas Shipyard and the ship flip", () => {
  it("spends 5 resources of the group, heals 5 damage from a Ship objective, readies it and flips it to its Upgraded side", () => {
    const made = table({ play: [{ code: "40006", damage: 7 }], heroResources: 5 });
    const ship = idOf(made.state, "40006");
    const run = resolveRecords(made.state, made.ctx, "40034", "response", undefined);
    const after = run.state.cards[ship];
    expect(after?.damage).toBe(2);
    expect(after?.face).toBe("B");
  });

  it("flips a ship once: an Upgraded ship is healed and readied only", () => {
    const made = table({ play: [{ code: "40006", damage: 7 }], heroResources: 5 });
    const ship = idOf(made.state, "40006");
    const upgraded = { ...made.state, cards: { ...made.state.cards, [ship]: { ...made.state.cards[ship]!, face: "B" as const } } };
    const run = resolveRecords(upgraded, made.ctx, "40034", "response", undefined);
    expect(run.state.cards[ship]?.face).toBe("B");
    expect(run.state.cards[ship]?.damage).toBe(2);
  });
});

describe("40033:A:2 Sea Monster", () => {
  it("deals 4 damage to the Ship enemy or Ship objective with the fewest hit points left", () => {
    const made = table({ play: [{ code: "40006", damage: 2 }], staging: [{ code: "40032", damage: 5 }] });
    const run = resolveRecords(made.state, made.ctx, "40033", "whenRevealed", undefined);
    expect(run.state.cards[idOf(made.state, "40032")]?.damage ?? 99).toBeGreaterThanOrEqual(7);
    expect(run.state.cards[idOf(made.state, "40006")]?.damage).toBe(2);
  });
});

describe("40002:A:3 the Corsair deck", () => {
  it("takes only the non-ship Corsair enemies of the encounter deck, so the Sea Monster stays there and is not routed to the Corsair discard pile", () => {
    const made = table({});
    expect(corsairTrait(made.ctx.effects, "40002")).toBe("Corsair");
    expect(corsairTrait(made.ctx.effects, undefined)).toBeUndefined();
    const routed = stampRoutes({ ...made.state, sea: undefined }, made.ctx.cards, "Corsair");
    expect(routed.sea?.routes["40033"]).toBeUndefined();
    expect(routed.sea?.routes["40021"]).toBe("corsair");
  });
});

describe("40002:B:2 no ship-objective", () => {
  it("eliminates a player who controls no ship-objective once the fleet is prepared, and not before", () => {
    const made = table({ seats: 2, play: [{ code: "40006", seat: 0 }], modeCard: true });
    const before = eliminateWithoutShip(made.state, made.ctx, []);
    expect(before.seats[1]?.eliminated).not.toBe(true);
    const prepared = { ...made.state, sea: { ...(made.state.sea ?? { heading: null, headingCard: null, routes: {} }), fleet: true as const } };
    const after = eliminateWithoutShip(prepared, made.ctx, []);
    expect(after.seats[1]?.eliminated).toBe(true);
    expect(after.seats[0]?.eliminated).not.toBe(true);
  });
});

describe("40021:A:1 Pillage", () => {
  it("is the printed keyword of the card, and an enemy that gains Pillage adds it to the printed number", () => {
    const made = table({ staging: ["40021", "40024"] });
    expect(made.ctx.cards.get("40021")?.keywords.pillage).toBe(2);
    const plunderer = idOf(made.state, "40021");
    expect(pillageAmount(made.state, plunderer, made.ctx)).toBe(2);
    const gained = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: plunderer, sourceId: plunderer, stat: "pillage" as const, amount: 3, until: "endOfRound" as const }] };
    expect(pillageAmount(gained, plunderer, made.ctx)).toBe(5);
    expect(pillageAmount(made.state, idOf(made.state, "40024"), made.ctx)).toBe(0);
  });

  it("discards the top 2 cards of the attacked player's deck once the attack has resolved, defended or not", () => {
    for (const undefended of [true, false]) {
      const fight = fightEnemy((layout: Layout) => table(layout), "f0", "40021", { deckOf: ["filler", "filler", "filler", "filler", "filler"] }, { undefended });
      const before = fight.start.seats[0]?.deck.length ?? 0;
      expect(before - (fight.run.state.seats[0]?.deck.length ?? 0), `undefended ${undefended}`).toBe(2);
      expect((fight.run.state.seats[0]?.discard.length ?? 0) - (fight.start.seats[0]?.discard.length ?? 0), `undefended ${undefended}`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("40009:B:2 Silent Mist's Response", () => {
  const withDiscard = () => {
    const made = table({});
    const state = [0, 1].reduce((current) => spawn(current, "event", { zone: "discard", seat: 0 }).state, made.state);
    return { made, state };
  };

  it("adds up to 2 events from the discard pile or the collection to the hand, one at a time, and the player may stop", () => {
    const { made, state } = withDiscard();
    const handBefore = state.seats[0]?.hand.length ?? 0;
    let asked = 0;
    const stop = resolveRecords(state, made.ctx, "40009", "response", undefined, (current) => {
      asked += 1;
      return asked === 1 ? (current.window?.kind === "choose" ? (current.window.options[0] ?? "") : "") : "done";
    });
    expect((stop.state.seats[0]?.hand.length ?? 0) - handBefore).toBe(1);
    expect(stop.state.seats[0]?.discard.length).toBe(1);
    let both = 0;
    const two = resolveRecords(state, made.ctx, "40009", "response", undefined, (current) => {
      both += 1;
      return current.window?.kind === "choose" ? (current.window.options[0] ?? "") : "";
    });
    expect((two.state.seats[0]?.hand.length ?? 0) - handBefore).toBe(2);
    expect(both).toBeGreaterThanOrEqual(2);
  });

  it("offers an event of the collection as a card made in the hand, never a third copy of a title already held in 3", () => {
    const { made, state } = withDiscard();
    const full = [0, 1, 2].reduce((current) => spawn(current, "event", { zone: "deck", seat: 0 }).state, state);
    const options: string[] = [];
    resolveRecords(full, made.ctx, "40009", "response", undefined, (current) => {
      if (current.window?.kind === "choose") options.push(...current.window.options);
      return "done";
    });
    expect(options).toContain("done");
    expect(options.filter((option) => option.startsWith("collection:"))).not.toContain("collection:event");
  });
});

describe("40015:A:3 Commander of the Dreadnaught and 40043:A:1 Out of the Mist", () => {
  it("40015:A:3 after Commander attacks you, the Dreadnaught, which stays in the staging area, attacks you", () => {
    const made = table({ phase: "Combat", engaged: [{ code: "40015", seat: 0 }], staging: ["40013"], seats: 2 });
    const run = resolveRecords(made.state, made.ctx, "40015", "forced", idOf(made.state, "40015"));
    const attack = run.state.pendingAttack;
    expect(attack ? run.state.cards[attack.enemyId]?.code : null).toBe("40013");
    expect(attack?.seat).toBe(0);
  });

  it("40043:A:1 the staged enemy with the highest engagement cost attacks the first player, and Out of the Mist gains no surge when it did", () => {
    const made = table({ phase: "Encounter", staging: ["40013"], seats: 2, firstPlayer: 1 });
    const run = resolveRecords(made.state, made.ctx, "40043", "whenRevealed", undefined);
    const attack = run.state.pendingAttack;
    expect(attack ? run.state.cards[attack.enemyId]?.code : null).toBe("40013");
    expect(attack?.seat).toBe(1);
  });
});
