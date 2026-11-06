// Rules: emce.discover, emce.loot, emce.guarded-x, emce.treasure, rr.guarded, rr.travel, rr.response, rr.objective-cards (data/rules/entries.json); ledger lines 19094:A:1 to 19094:A:3, 19095:A:1 to 19095:A:3, 19096:A:1 to 19096:A:3, 12190:A:1 to 12190:A:3, 19102:A:1, 19103:A:1, 19104:A:1, 19105:A:1.
// The Loot objectives and the Discover keyword on the scenario's scene: a Loot objective enters play only through a Discover location, is guarded by it, and is claimed by the first player once the location is gone; Crypt Key's Response comes before the
// keyword resolves; Old Lantern, Scatha's Teeth and Ashen Brazier work once claimed.
import { beforeAll, describe, expect, it } from "vitest";

import { heldAmount, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { freeOfEncounters } from "../../../rules/families/objectives/free.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { CODES, codesIn, finish, framsburgTable, idOf, legalIntents, loadFramsburgWorld, send, start, withLoot, type FramsburgWorld, type Run } from "../../../../test/scenarios/the-ghost-of-framsburg/scene.ts";

let world: FramsburgWorld;
beforeAll(async () => {
  world = await loadFramsburgWorld();
}, 120_000);

type Table = ReturnType<typeof framsburgTable>;
const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const travelTo = (t: Table, code: string, run: Run = start(t.state)): Run => send(run, { type: "Travel", locationId: idOf(run.state, code) }, t.ctx);
const trigger = (t: Table, run: Run, code: string): Run => {
  const intent = legalIntents(run.state, t.ctx).find((item) => item.type === "Trigger" && run.state.cards[item.cardId]?.code === code);
  if (!intent || intent.type !== "Trigger") throw new Error(`no ${code} ability: ${JSON.stringify(legalIntents(run.state, t.ctx))}`);
  return send(run, { type: "Trigger", cardId: intent.cardId, effectId: intent.effectId }, t.ctx);
};
const offers = (t: Table, run: Run, code: string): boolean => legalIntents(run.state, t.ctx).some((item) => item.type === "Trigger" && run.state.cards[item.cardId]?.code === code);
const take = (id: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === id) ?? state.window.options[0] ?? "") : "");

describe("Loot (emce.loot)", () => {
  it("19094:A:1 a Loot card revealed from the encounter deck is discarded and the next card is revealed", () => {
    const t = framsburgTable(world, { phase: "Quest", deck: [CODES.cryptKey, CODES.oldLantern, "f0", "f3"] });
    let run = send(start(t.state), { type: "Commit", cardIds: [t.hero] }, t.ctx);
    run = send(run, { type: "Pass" }, t.ctx);
    expect(codesIn(run.state, "encounterDiscard")).toEqual(expect.arrayContaining([CODES.cryptKey, CODES.oldLantern]));
    expect(where(run.state, CODES.cryptKey).map((card) => card.zone)).toEqual(["encounterDiscard"]);
    expect(codesIn(run.state, "staging")).toContain("f0");
  });

  it("19094:A:2 free of encounters, a Loot objective is claimed by the first player, who attaches it to a hero: the players control it", () => {
    for (const code of [CODES.cryptKey, CODES.oldLantern, CODES.scathaSTeeth, CODES.ashenBrazier]) {
      const t = withLoot(framsburgTable(world, { phase: "Travel", seats: 2 }), [code]);
      const card = where(t.state, code)[0]!;
      expect(card, code).toMatchObject({ zone: "attached", host: t.hero, controller: 0, claimed: true });
    }
  });

  it("19094:A:2 an objective that is still guarded by a location is not claimed", () => {
    const t = framsburgTable(world, { phase: "Travel", staging: [CODES.cryptKey, CODES.moonlitPassage] });
    const key = idOf(t.state, CODES.cryptKey);
    const place = idOf(t.state, CODES.moonlitPassage);
    const guarded = updateCard(updateCard(t.state, place, { host: key, guard: true }), key, { attachments: [place] });
    expect(freeOfEncounters(guarded, key)).toBe(false);
    expect(settle({ ...guarded, window: null, mode: "stopped" }, t.ctx, []).window).toBeNull();
  });
});

describe("Discover (emce.discover)", () => {
  it("19104:A:1 Discover 2: the Loot objective looked at is attached to the location as a guarded objective, and the other card is discarded", () => {
    const t = framsburgTable(world, { phase: "Travel", staging: [CODES.moonlitPassage], deck: ["f0", CODES.oldLantern, "f3"] });
    const run = finish(travelTo(t, CODES.moonlitPassage), t.ctx);
    const place = idOf(run.state, CODES.moonlitPassage);
    const lantern = where(run.state, CODES.oldLantern)[0]!;
    expect(lantern.zone).toBe("staging");
    expect(run.state.cards[place]).toMatchObject({ host: lantern.id, guard: true });
    expect(freeOfEncounters(run.state, lantern.id)).toBe(false);
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["f0"]);
    expect(codesIn(run.state, "encounterDeck")).toEqual(["f3"]);
  });

  it("19102:A:1 Discover 4 looks at four cards, 19105:A:1 Discover 3 at three", () => {
    for (const [code, depth] of [[CODES.hauntedHall, 4], [CODES.cursedTower, 3]] as const) {
      const t = framsburgTable(world, { phase: "Travel", staging: [code], deck: ["f0", "f0", "f0", "f0", "f0", "f0"] });
      const run = finish(travelTo(t, code), t.ctx);
      expect(codesIn(run.state, "encounterDiscard"), code).toHaveLength(depth);
    }
  });

  it("the guard leaves play with the location: the objective is then free of encounters and the first player claims it", () => {
    const t = framsburgTable(world, { phase: "Travel", staging: [CODES.moonlitPassage], deck: [CODES.cryptKey, "f0"] });
    let run = finish(travelTo(t, CODES.moonlitPassage), t.ctx);
    const key = where(run.state, CODES.cryptKey)[0]!.id;
    const place = idOf(run.state, CODES.moonlitPassage);
    expect(run.state.cards[key]?.zone).toBe("staging");
    // The location leaves play (explored): the objective it guarded has no guard.
    const gone = { ...moveCard(run.state, place, { zone: "encounterDiscard" }), activeLocation: null };
    expect(freeOfEncounters(gone, key)).toBe(true);
    run = { ...run, state: settle({ ...gone, window: null, mode: "stopped" }, t.ctx, run.steps) };
    expect(run.state.window?.kind).toBe("choose");
    run = send(run, { type: "Choose", optionId: t.hero2 }, t.ctx);
    expect(run.state.cards[key]).toMatchObject({ zone: "attached", host: t.hero2, controller: 0, claimed: true });
  });

  it("with several Loot objectives looked at, the first player chooses the one to attach; the rest are discarded", () => {
    const t = framsburgTable(world, { phase: "Travel", seats: 2, staging: [CODES.moonlitPassage], deck: [CODES.cryptKey, CODES.oldLantern, "f0"] });
    let run = travelTo(t, CODES.moonlitPassage);
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 0 });
    run = finish(run, t.ctx, take(idOf(run.state, CODES.oldLantern)));
    expect(where(run.state, CODES.oldLantern)[0]?.zone).toBe("staging");
    expect(where(run.state, CODES.cryptKey)[0]?.zone).toBe("encounterDiscard");
  });
});

describe("19094 Crypt Key", () => {
  const keyed = (deck: readonly string[]) => withLoot(framsburgTable(world, { phase: "Travel", staging: [CODES.moonlitPassage], deck }), [CODES.cryptKey]);

  it("19094:A:3 when the players travel to a Discover location it is offered before the keyword resolves: exhausted, it adds 1 to the Discover value", () => {
    const t = keyed(["f0", "f0", "f0", CODES.oldLantern]);
    let run = travelTo(t, CODES.moonlitPassage);
    // Nothing was looked at yet.
    expect(run.state.window).toMatchObject({ kind: "response" });
    expect(codesIn(run.state, "encounterDiscard")).toEqual([]);
    run = trigger(t, run, CODES.cryptKey);
    expect(run.state.cards[idOf(run.state, CODES.cryptKey)]?.exhausted).toBe(true);
    run = finish(run, t.ctx, take("increase"));
    run = send(run, { type: "Pass" }, t.ctx);
    // Discover 3: the Loot objective that was the 4th card is not reached.
    expect(codesIn(run.state, "encounterDiscard")).toHaveLength(3);
    expect(codesIn(run.state, "encounterDeck")).toEqual([CODES.oldLantern]);
  });

  it("19094:A:3 or it takes 1 off: Discover 2 becomes Discover 1", () => {
    const t = keyed(["f0", CODES.oldLantern, "f0"]);
    let run = trigger(t, travelTo(t, CODES.moonlitPassage), CODES.cryptKey);
    run = finish(run, t.ctx, take("decrease"));
    run = send(run, { type: "Pass" }, t.ctx);
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["f0"]);
    expect(where(run.state, CODES.oldLantern)[0]?.zone).toBe("encounterDeck");
  });

  it("19094:A:3 passing the Response leaves the Discover value as it is", () => {
    const t = keyed(["f0", CODES.oldLantern, "f0"]);
    const run = send(travelTo(t, CODES.moonlitPassage), { type: "Pass" }, t.ctx);
    expect(where(run.state, CODES.oldLantern)[0]?.zone).toBe("staging");
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["f0"]);
  });

  it("19094:A:3 it is not offered when the location has no Discover keyword, or when it is exhausted", () => {
    const plain = withLoot(framsburgTable(world, { phase: "Travel", staging: ["place"] }), [CODES.cryptKey]);
    const run = travelTo(plain, "place");
    expect(offers(plain, run, CODES.cryptKey)).toBe(false);
    const tired = keyed(["f0", "f0", "f0"]);
    const key = idOf(tired.state, CODES.cryptKey);
    const spent = { ...tired.state, cards: { ...tired.state.cards, [key]: { ...tired.state.cards[key]!, exhausted: true } } };
    expect(offers(tired, travelTo(tired, CODES.moonlitPassage, start(spent)), CODES.cryptKey)).toBe(false);
  });

  it("19094:A:3 the adjustment ends with the travel phase: no modifier of the Discover value is left", () => {
    const t = keyed(["f0", "f0", "f0"]);
    let run = trigger(t, travelTo(t, CODES.moonlitPassage), CODES.cryptKey);
    run = finish(run, t.ctx, take("increase"));
    expect(run.state.modifiers.filter((modifier) => modifier.stat === "discoverValue")).toEqual([]);
    expect(heldAmount(run.state, idOf(run.state, CODES.moonlitPassage), "discoverValue")).toBe(0);
  });
});

describe("19095 Old Lantern", () => {
  it("19095:A:3 exhausted, the chosen player looks at the top X cards of their deck, X the Discover value of the active location, adds one to their hand and puts the rest on the bottom", () => {
    const base = framsburgTable(world, { phase: "Travel", seats: 2, staging: [CODES.moonlitPassage], deck: ["f0", "f0", "f0"], deckOf: ["ally", "event", "filler", "f0", "f3"] });
    const t = withLoot(base, [CODES.oldLantern]);
    let run = finish(travelTo(t, CODES.moonlitPassage), t.ctx);
    run = send(run, { type: "Pass" }, t.ctx);
    expect(run.state.activeLocation).toBe(idOf(run.state, CODES.moonlitPassage));
    const before = run.state.seats[1]!.deck.slice();
    run = trigger(t, run, CODES.oldLantern);
    // The player is chosen, then the card they take of the 2 looked at.
    expect(run.state.window).toMatchObject({ kind: "choose", options: ["seat:0", "seat:1"] });
    run = finish(run, t.ctx, take("seat:1"));
    const seatOne = run.state.seats[1]!;
    expect(seatOne.hand).toHaveLength(1);
    expect(seatOne.deck).toHaveLength(before.length - 1);
    // The card not taken is on the bottom, the others stayed in order.
    expect(seatOne.deck.at(-1)).toBe(before[1] === seatOne.hand[0] ? before[0] : before[1]);
    expect(run.state.cards[idOf(run.state, CODES.oldLantern)]?.exhausted).toBe(true);
  });

  it("19095:A:3 it needs a Discover location as the active location", () => {
    const t = withLoot(framsburgTable(world, { phase: "Travel", staging: ["place"], deckOf: ["ally", "event"] }), [CODES.oldLantern]);
    expect(offers(t, start(t.state), CODES.oldLantern)).toBe(false);
  });
});

describe("19096 Scatha's Teeth", () => {
  it("19096:A:3 exhausted with its hero, it lets a chosen player reduce their threat by 2", () => {
    const t = withLoot(framsburgTable(world, { phase: "Quest", seats: 2, threat: [30, 35] }), [CODES.scathaSTeeth]);
    let run = trigger(t, start(t.state), CODES.scathaSTeeth);
    run = finish(run, t.ctx, take("seat:1"));
    expect(run.state.seats.map((seat) => seat.threat)).toEqual([30, 33]);
    expect(run.state.cards[t.hero]?.exhausted).toBe(true);
    expect(run.state.cards[idOf(run.state, CODES.scathaSTeeth)]?.exhausted).toBe(true);
  });

  it("19096:A:3 the player may be the one who uses it", () => {
    const t = withLoot(framsburgTable(world, { phase: "Quest", threat: [30, 35] }), [CODES.scathaSTeeth]);
    const run = finish(trigger(t, start(t.state), CODES.scathaSTeeth), t.ctx);
    expect(run.state.seats[0]?.threat).toBe(28);
  });

  it("19096:A:3 it is not offered when its hero is already exhausted", () => {
    const t = withLoot(framsburgTable(world, { phase: "Quest" }), [CODES.scathaSTeeth]);
    const tired = { ...t.state, cards: { ...t.state.cards, [t.hero]: { ...t.state.cards[t.hero]!, exhausted: true } } };
    expect(offers(t, start(tired), CODES.scathaSTeeth)).toBe(false);
  });
});

describe("12190 Ashen Brazier", () => {
  it("12190:A:3 exhausted, it lets its player look at a facedown shadow card", () => {
    const t = withLoot(framsburgTable(world, { phase: "Encounter", engaged: [{ code: CODES.werewolf, seat: 0 }], deck: ["f0", "f0", "f0"] }), [CODES.ashenBrazier]);
    // No shadow card is dealt before the combat phase.
    expect(offers(t, start(t.state), CODES.ashenBrazier)).toBe(false);
    let run = send(start(t.state), { type: "DeclineEngage" }, t.ctx);
    // The first action window after the shadow cards are dealt (rr.step-6-2).
    const dealt = (state: ScenarioState): boolean => state.cards[idOf(state, CODES.werewolf)]?.shadowId != null;
    for (let guard = 0; guard < 30 && !(dealt(run.state) && offers(t, run, CODES.ashenBrazier)); guard += 1) {
      const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage" || intent.type === "ChooseEnemy");
      if (!pass) break;
      run = send(run, pass.type === "ChooseEnemy" ? { type: "ChooseEnemy", enemyId: run.state.window?.kind === "chooseEnemy" ? (run.state.window.options[0] ?? "") : "" } : pass, t.ctx);
    }
    const enemy = idOf(run.state, CODES.werewolf);
    expect(dealt(run.state)).toBe(true);
    expect(offers(t, run, CODES.ashenBrazier)).toBe(true);
    run = trigger(t, run, CODES.ashenBrazier);
    expect(run.state.window).toMatchObject({ kind: "look", cardIds: [run.state.cards[enemy]?.shadowId] });
    expect(run.state.cards[idOf(run.state, CODES.ashenBrazier)]?.exhausted).toBe(true);
  });
});
