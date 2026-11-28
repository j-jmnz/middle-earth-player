// Rules: vom.the-one-ring, mec109.setup, rr.threat-elimination-level, rr.immune, rr.first-player, rr.ownership-and-control, rr.encounter-deck,
// rr.cancel (data/rules/entries.json).
// The One Ring, the Master cards and the saga heroes of the misc family, run through its real records.
import { describe, expect, it } from "vitest";

import { RECORDS as AUTHORED } from "../../../effects/authored/families/misc.ts";
import { POOL_GENERATED_EFFECTS } from "../../../effects/generated/player-pool.ts";
import { GENERATED_EFFECTS as HOBBIT_GENERATED } from "../../../effects/generated/the-hobbit.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { cardMap, codes, expectOk, fixtureDefinition } from "../../core/test-fixture.ts";
import { placeDamage } from "../../core/keywords.ts";
import { eliminateEmpties } from "../../core/eliminate.ts";
import { ruleCause } from "../../core/cause.ts";
import { legalIntents, reduce, startScenario } from "../../engine/reduce.ts";
import { updateCard, withThreat, type ScenarioState } from "../../core/state.ts";
import { attachTo, spawn } from "../../core/zones.ts";
import { MISC_CARDS, choices, miscCtx } from "./fixture.ts";
import { play, put, run, seat, send, triggers } from "../play/fixture.ts";
import { enemy, hero, offered, send as sendIntent, table as defenseTable, until } from "../defense/table.ts";
import { definePrinted } from "../../core/printed.ts";
import { checkState, migrateState, restoredState, storedState, type StoredState } from "../../engine/state-version.ts";

// "If The One Ring / Bilbo / Aragorn leaves play, the players lose the game" (21001:A:4, 131001:A:3, 146002:A:3) is a generated record.
const RECORDS = [...AUTHORED, ...[...POOL_GENERATED_EFFECTS, ...HOBBIT_GENERATED].filter((record) => record.lines.some((line) => line === "21001:A:4" || line === "131001:A:3" || line === "146002:A:3"))];
const ctx = miscCtx(RECORDS);
const filler = codes("f", 8);

function started(deck: readonly string[], heroes: readonly string[] = ["dwarf", "rohan"], seatCount: 1 | 2 = 1) {
  const cards = cardMap([...MISC_CARDS.values(), ...filler.map((code) => ({ ...MISC_CARDS.get("filler")!, code, name: code }))]);
  const world = { effects: RECORDS, cards };
  const state = startScenario(
    {
      seatCount,
      seed: 5,
      threatModifier: 0,
      definition: fixtureDefinition(["stage"]),
      seats: Array.from({ length: seatCount }, () => ({ heroes, deck })),
      encounterDeck: [],
      questDeck: ["stage"],
    },
    world,
  );
  return { state, world };
}

describe("The One Ring (21001)", () => {
  it("is attached to a hero the player chooses right after the heroes are placed, before the opening hand, with a Master card fetched into the hand (21001:A:2)", () => {
    const { state, world } = started(["21001", "master", ...filler]);
    // The Setup asks first: the Ring is out of the deck and nothing is drawn yet, so there is no mulligan window.
    expect(Object.values(state.cards).find((card) => card.code === "21001")?.zone).toBe("setAside");
    expect(state.window).toMatchObject({ kind: "choose" });
    expect(state.mode).toBe("openingHands");
    expect(state.seats[0]?.hand).toHaveLength(0);
    // Two heroes: the player chooses.
    const options = choices(state);
    expect(options).toHaveLength(2);
    const [chosen] = options;
    const next = expectOk(reduce(state, { type: "Choose", optionId: chosen ?? "" }, world)).state;
    const ring = Object.values(next.cards).find((card) => card.code === "21001");
    expect(ring?.host).toBe(chosen);
    expect(ring?.zone).toBe("play");
    // The Master card was fetched before the draw, so it is in the hand and the opening hand is 6 more cards.
    const master = Object.values(next.cards).find((card) => card.code === "master");
    expect(master?.zone).toBe("hand");
    expect(next.seats[0]?.hand).toHaveLength(7);
    // The mulligan opens only now.
    expect(next.mode).toBe("mulligan");
    expect(next.window).toMatchObject({ kind: "mulligan" });
    void legalIntents;
  });

  it("keeps the fetched Master card in the hand through a mulligan, and shuffles back only the cards drawn (vom.the-one-ring, rr.mulligan)", () => {
    const { state, world } = started(["21001", "master", ...filler]);
    const [chosen] = choices(state);
    const opened = expectOk(reduce(state, { type: "Choose", optionId: chosen ?? "" }, world)).state;
    const drawn = opened.seats[0]?.hand.filter((id) => opened.cards[id]?.code !== "master") ?? [];
    expect(drawn).toHaveLength(6);
    const next = expectOk(reduce(opened, { type: "Mulligan" }, world)).state;
    const hand = next.seats[0]?.hand ?? [];
    // The Master card, the six cards of the new hand and the Resource phase's draw, which the game reaches at once.
    expect(hand).toHaveLength(8);
    expect(hand.filter((id) => next.cards[id]?.code === "master")).toHaveLength(1);
    expect(next.cards[Object.values(opened.cards).find((card) => card.code === "master")?.id ?? ""]?.zone).toBe("hand");
  });

  it("21001:A:2 with two Rings the first player decides which is put into play, the other copy is removed, and only that seat's Setup runs before either seat draws (vom.the-one-ring)", () => {
    const { state, world } = started(["21001", "master", ...filler], ["dwarf", "rohan"], 2);
    // The first player is asked first, and nothing is drawn while the Setup asks.
    expect(state.mode).toBe("openingHands");
    expect(state.window).toMatchObject({ kind: "choose", seat: state.firstPlayer });
    expect(state.seats.every((seat) => seat.hand.length === 0)).toBe(true);
    const rings = choices(state);
    expect(rings).toHaveLength(2);
    expect(rings.map((id) => state.cards[id]?.owner).sort()).toEqual([0, 1]);
    // The first player picks the copy of the other seat.
    const other = 1 - state.firstPlayer;
    const kept = rings.find((id) => state.cards[id]?.owner === other) ?? "";
    let next = expectOk(reduce(state, { type: "Choose", optionId: kept }, world)).state;
    const copies = Object.values(next.cards).filter((card) => card.code === "21001");
    expect(copies.filter((card) => card.id !== kept).map((card) => card.zone)).toEqual(["removed"]);
    // The chosen seat's Setup runs: its player attaches the Ring to one of that seat's heroes, and no other Ring Setup asks.
    expect(next.window).toMatchObject({ kind: "choose", seat: other });
    expect(next.seats.every((seat) => seat.hand.length === 0)).toBe(true);
    next = expectOk(reduce(next, { type: "Choose", optionId: choices(next)[0] ?? "" }, world)).state;
    expect(next.cards[kept]).toMatchObject({ zone: "play" });
    expect(next.cards[kept]?.host).toBeDefined();
    expect(next.mode).toBe("mulligan");
    expect(next.seats[other]?.hand.some((id) => next.cards[id]?.code === "master")).toBe(true);
    // The seat whose Ring was removed fetched nothing: its hand is the six drawn cards.
    expect(next.seats[1 - other]?.hand).toHaveLength(6);
    expect(next.seats[other]?.hand).toHaveLength(7);
  });

  it("21001:A:2 the first player may keep the copy of their own seat: the other copy is removed and its Setup does not run", () => {
    const { state, world } = started(["21001", "master", ...filler], ["dwarf", "rohan"], 2);
    const own = choices(state).find((id) => state.cards[id]?.owner === state.firstPlayer) ?? "";
    let next = expectOk(reduce(state, { type: "Choose", optionId: own }, world)).state;
    expect(next.window).toMatchObject({ kind: "choose", seat: state.firstPlayer });
    next = expectOk(reduce(next, { type: "Choose", optionId: choices(next)[0] ?? "" }, world)).state;
    expect(next.cards[own]).toMatchObject({ zone: "play" });
    expect(Object.values(next.cards).filter((card) => card.code === "21001" && card.zone === "removed")).toHaveLength(1);
    expect(next.mode).toBe("mulligan");
  });

  it("21001:A:2 asks nobody which Ring to keep when one seat holds it", () => {
    const { state } = started(["21001", "master", ...filler], ["dwarf", "rohan"], 1);
    expect(choices(state)).toHaveLength(2);
    expect(choices(state).every((id) => state.cards[id]?.code !== "21001")).toBe(true);
  });

  it("attaches the Ring and fetches the Master card after Keep for a checkpoint saved when the Setup waited for the start of the game (vom.the-one-ring)", () => {
    // The old shape: the Ring set aside, its Delay waiting for `startOfGame`, the opening hand drawn and the mulligan open.
    const { state: plain, world } = started(["master", ...filler]);
    const ring = spawn(plain, "21001", { zone: "setAside" });
    const delay = AUTHORED.find((record) => record.id === "21001:setup:1")?.instructions[0];
    if (delay?.verb !== "Delay") throw new Error("The Ring's Setup is not a Delay");
    const old = { ...ring.state, delayed: [{ id: "d0:0", until: "startOfGame", sourceId: ring.id, seat: 0, phase: "Setup", instructions: delay.instructions, uncancelable: null }] };
    expect(plain.mode).toBe("mulligan");
    const stored = JSON.parse(JSON.stringify(storedState(old as unknown as ScenarioState))) as StoredState;
    const migrated = migrateState(1, stored);
    expect(migrated).not.toBeNull();
    const restored = restoredState(migrated!);
    expect(checkState(restored, world)).toEqual([]);
    let next = expectOk(reduce(restored, { type: "Keep" }, world)).state;
    if (next.window?.kind === "choose") next = expectOk(reduce(next, { type: "Choose", optionId: choices(next)[0] ?? "" }, world)).state;
    expect(Object.values(next.cards).find((card) => card.code === "21001")).toMatchObject({ zone: "play" });
    expect(Object.values(next.cards).find((card) => card.code === "master")?.zone).toBe("hand");
  });

  it("carries the steps of a Setup that asked nothing into the first intent's steps (vom.the-one-ring)", () => {
    const { state, world } = started(["21001", "master", ...filler], ["dwarf"]);
    // One hero, one Master card: nothing is asked, so the table opens on the mulligan with the Ring attached.
    expect(state.window).toMatchObject({ kind: "mulligan" });
    expect(state.openingSteps?.length).toBeGreaterThan(0);
    const result = expectOk(reduce(state, { type: "Keep" }, world));
    expect(result.steps.slice(0, state.openingSteps?.length)).toEqual(state.openingSteps);
    expect(result.state.openingSteps).toBeUndefined();
  });

  it("lowers the threat elimination level by 5 (21001:A:3)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const ring = put(table.state, "21001", "play");
    let state = attachTo(ring.state, ring.id, table.heroes[0] ?? "");
    state = syncConstants(run(state, ctx), ctx);
    expect(eliminateEmpties(withThreat(state, 0, 44), []).seats[0]?.eliminated).toBeFalsy();
    expect(eliminateEmpties(withThreat(state, 0, 45), []).seats[0]?.eliminated).toBe(true);
    // Without the Ring the level stays 50.
    expect(eliminateEmpties(withThreat(syncConstants(run(table.state, ctx), ctx), 0, 45), []).seats[0]?.eliminated).toBeFalsy();
  });

  it("loses the game for the players when it leaves play (21001:A:4)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const ring = put(table.state, "21001", "play");
    let state = attachTo(ring.state, ring.id, table.heroes[0] ?? "");
    state = syncConstants(run(state, ctx), ctx);
    expect(state.lost).toBeFalsy();
    // The hero it is attached to is destroyed: the Ring goes with it.
    state = run(placeDamage({ ...state, window: null }, table.heroes[0] ?? "", 9, ctx.cards, [], "player", ruleCause("rr.damage")), ctx);
    expect(state.lost).toBe(true);
  });
});

describe("The Master cards", () => {
  it("The Master Ring cancels the card just revealed, discards it, and reveals another (21009:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const ring = put(table.state, "21001", "play");
    const master = put(ring.state, "21009", "hand");
    const first = spawn(master.state, "grunt", { zone: "encounterDeck" });
    const second = spawn(first.state, "brute", { zone: "encounterDeck" });
    // A third card keeps the deck from running out, which would shuffle the discard pile back in.
    const third = spawn(second.state, "grunt", { zone: "encounterDeck" });
    const hero = table.heroes[0] ?? "";
    // Quest phase, the commitment window: passing it starts the staging step, which reveals the top card of the encounter deck.
    let state: ScenarioState = { ...attachTo(third.state, ring.id, hero), phase: "Quest", boundaryPhase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0 };
    const threat = state.seats[0]?.threat ?? 0;
    state = send(state, { type: "Pass" }, ctx);
    expect(state.window?.kind).toBe("response");
    expect(triggers(state, ctx, "21009:response:1")).toHaveLength(1);
    const result = expectOk(reduce(state, { type: "Trigger", cardId: master.id, effectId: "21009:response:1" }, ctx));
    // The cost raised the threat by 1 (the second raise is the failed quest, no one having committed).
    expect(result.steps.filter((step) => step.kind === "threat")[0]).toMatchObject({ seat: 0, amount: 1 });
    state = result.state;
    // The revealed card was discarded, not shuffled back; the next one was revealed in its place.
    expect(state.cards[first.id]?.zone).toBe("encounterDiscard");
    expect(state.cards[second.id]?.zone).toBe("staging");
    expect(state.cards[ring.id]?.exhausted).toBe(true);
    expect(state.seats[0]?.threat).toBeGreaterThan(threat);
    expect(state.cards[master.id]?.zone).toBe("discard");
  });

  it("The Ruling Ring stops a non-Nazgûl enemy attacking you for the phase (21010:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const ring = put(table.state, "21001", "play");
    const event = put(ring.state, "21010", "hand");
    const grunt = put(event.state, "grunt", "engaged");
    const state0 = attachTo(grunt.state, ring.id, table.heroes[0] ?? "");
    const combat: ScenarioState = { ...syncConstants(state0, ctx), phase: "Combat", boundaryPhase: "Combat", mode: "combatActions", window: { kind: "pass" } };
    const played = run(play(combat, event.id, ctx), ctx);
    expect(played.cards[ring.id]?.exhausted).toBe(true);
    expect(played.seats[0]?.threat).toBe((combat.seats[0]?.threat ?? 0) + 1);
    expect(played.modifiers.some((modifier) => modifier.instanceId === grunt.id && modifier.stat === "cannotAttack")).toBe(true);
  });

  it("The Ring of Power readies the hero with The One Ring and gives it +1 Willpower, Attack and Defense (21011:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const ring = put(table.state, "21001", "play");
    const event = put(ring.state, "21011", "hand");
    const hero = table.heroes[0] ?? "";
    const state0 = updateCard(attachTo(event.state, ring.id, hero), hero, { exhausted: true });
    const played = run(play(syncConstants(state0, ctx), event.id, ctx), ctx);
    expect(played.cards[hero]?.exhausted).toBe(false);
    expect(played.cards[ring.id]?.exhausted).toBe(true);
    expect(played.modifiers.filter((modifier) => modifier.instanceId === hero && modifier.until === "endOfPhase")).toHaveLength(3);
  });
});

describe("The saga heroes", () => {
  it("Bilbo Baggins gains no resources from player card effects, and the players lose when he leaves play (131001)", () => {
    const table = seat(1, ["131001", "rohan"]);
    const bilbo = table.heroes[0] ?? "";
    const state = syncConstants(run(table.state, ctx), ctx);
    expect(state.cards[bilbo]?.resources).toBe(5);
    expect(state.lost).toBeFalsy();
    const gone = run(placeDamage({ ...state, window: null }, bilbo, 9, ctx.cards, [], "player", ruleCause("rr.damage")), ctx);
    expect(gone.lost).toBe(true);
  });

  it("the first player gains control of Aragorn (143001:A:1)", () => {
    const table = seat(2, ["143001"]);
    const state = syncConstants(run(table.state, ctx), ctx);
    // The Aragorn of seat 1 is controlled by the first player (seat 0) and still owned by seat 1.
    expect(state.cards[table.heroes[1] ?? ""]?.controller).toBe(0);
    expect(state.cards[table.heroes[1] ?? ""]?.owner).toBe(1);
  });

  it("Aragorn: the players lose the game when he leaves play (146002:A:3)", () => {
    const table = seat(1, ["146002"]);
    const aragorn = table.heroes[0] ?? "";
    const state = syncConstants(run(table.state, ctx), ctx);
    expect(state.lost).toBeFalsy();
    const gone = run(placeDamage({ ...state, window: null }, aragorn, 9, ctx.cards, [], "player", ruleCause("rr.damage")), ctx);
    expect(gone.lost).toBe(true);
  });

  it("Frodo Baggins: the attack deals no damage and each player raises threat by 2 (142001:A:1)", () => {
    const built = defenseTable({
      cards: [hero("142001", { sphere: "fellowship", defense: 2 }), definePrinted({ code: "142091", name: "The One Ring", type: "attachment", traits: ["Ring"] }), enemy("troll", { attack: 6 })],
      effects: RECORDS,
      heroes: [{ code: "142001" }],
      attachments: [{ code: "142091", host: "142001" }],
      enemies: [{ code: "troll" }],
    });
    const { ids, ctx: world } = built;
    const defending = until(sendIntent(built.state, { type: "DeclineEngage" }, world), world, (current) => current.window?.kind === "defense");
    const defended = sendIntent(defending, { type: "DeclareDefender", defenderId: ids["142001"]! }, world);
    const threat = defended.seats[0]?.threat ?? 0;
    expect(offered(legalIntents(defended, world), "142001:response:1")).toBe(true);
    // Passing instead, the troll deals 6 - 2 damage.
    const passed = until(sendIntent(defended, { type: "Pass" }, world), world, (current) => (current.cards[ids["142001"]!]?.damage ?? 0) > 0);
    expect(passed.cards[ids["142001"]!]?.damage).toBe(4);
    const used = sendIntent(defended, { type: "Trigger", cardId: ids["142001"]!, effectId: "142001:response:1", payments: [{ heroId: ids["142001"]!, amount: 1 }] }, world);
    // The attack deals no damage, and each player raised threat by 2 (the round then goes on to a new one).
    expect(used.cards[ids["142001"]!]?.damage).toBe(0);
    expect(used.seats[0]?.threat).toBeGreaterThanOrEqual(threat + 2);
  });
});
