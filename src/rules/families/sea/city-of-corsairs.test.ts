// Rules: dcce.scalable-upgradable, dcce.from-sea-to-land, dcce.indestructible, rr.travel, rr.forced, rr.lasting-effects, rr.play-and-put-into-play, rr.cannot, mec109.immune-to-player-card-effects, rr.attacks-outside-the-combat-phase (data/rules/entries.json).
// The mechanics The City of Corsairs' encounter cards and campaign card add, each read from its record on the scenario's table (test/scenarios/the-city-of-corsairs/scene.ts): the boons and burdens carried to the second
// deck (11215:B:1), the Raiders immune to events (12159:A:1), the limit on allies entering play (12155:A:1), the resources a player spends (12153:A:2), a player named to reveal a Corsair (12154:A:1), Streets of Umbar's
// travel (12160:A:1), the table that bars optional engagement (12164:A:1) and the attacks on the other players (11216:A:4).
import { beforeAll, describe, expect, it } from "vitest";

import { CODES, corsairsFight, corsairsTable, finish, idOf, idsOf, loadCorsairsWorld, resolveRecords, type CorsairsLayout, type CorsairsWorld } from "../../../../test/scenarios/the-city-of-corsairs/scene.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { ruleCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { modifiedStat, placeDamage } from "../../core/keywords.ts";
import { noteSpent } from "../costs/pay.ts";
import { settle } from "../../engine/machine.ts";
import { legalIntents, reduce, type ScenarioState } from "../../engine/reduce.ts";
import { expectOk } from "../../core/test-fixture.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { holds } from "../../interpret/conditions.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { attachTo, moveCard, spawn } from "../../core/zones.ts";
import { opening, revealFromTop } from "../../../../test/harness/scene-kit.ts";
import { updateCard } from "../../core/state.ts";
import { entriesBarred, entriesRefusal, noteEntries } from "./entries.ts";
import { stampRoutes } from "./routes.ts";
import { carryToSecondDeck, setAsideEncounterDeck } from "./swap.ts";

const OMINOUS_FATE = "11176"; // burden (a treachery of the first deck)
const MONUMENT = "110129"; // The Shattered Monument as the campaign deals it (12159 is its standalone printing)
let world: CorsairsWorld;
beforeAll(async () => {
  world = await loadCorsairsWorld();
  for (const [code, card] of await loadPrinted([OMINOUS_FATE])) world.cards.set(code, card);
});

type Table = ReturnType<typeof corsairsTable>;
const make = (layout: CorsairsLayout = {}): Table => {
  const made = corsairsTable(world, layout);
  return { ...made, state: stampRoutes(made.state, made.ctx.cards) };
};
const codesAt = (state: ScenarioState, ids: readonly string[]): string[] => ids.map((id) => state.cards[id]?.code ?? "?").sort();
const zoneOf = (state: ScenarioState, code: string, at = 0): string => state.cards[idsOf(state, code)[at] ?? ""]?.zone ?? "none";
const answerFirst = (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "");

describe("CarryToSecondDeck (11215:B:1)", () => {
  const carry = { verb: "CarryToSecondDeck" as const, exceptBurdenTrait: "Ship" };

  it("marks each boon and each burden without the Ship trait found in the deck or the discard pile, and moves one from the discard pile to the deck", () => {
    const made = make({ deck: [OMINOUS_FATE, CODES.thunderstruck, CODES.lightCruiser], discard: [CODES.crowley, CODES.waterspout] });
    const next = carryToSecondDeck(made.state, carry, made.ctx);
    const carried = Object.values(next.cards).filter((card) => card.carried === true);
    expect(carried.map((card) => card.code).sort()).toEqual([OMINOUS_FATE, CODES.crowley].sort());
    expect(codesAt(next, next.encounterDeck)).toEqual([OMINOUS_FATE, CODES.crowley, CODES.thunderstruck, CODES.lightCruiser].sort());
    expect(codesAt(next, next.encounterDiscard)).toEqual([CODES.waterspout]);
  });

  it("is run while the first deck is still the encounter deck, so SetAsideEncounterDeck keeps the marked cards in it and sets the rest aside", () => {
    const made = make({ deck: [OMINOUS_FATE, CODES.thunderstruck, CODES.lightCruiser], discard: [CODES.crowley, CODES.waterspout, CODES.watchTower] });
    const next = setAsideEncounterDeck(carryToSecondDeck(made.state, carry, made.ctx), { verb: "SetAsideEncounterDeck", carry: [CODES.watchTower] });
    expect(codesAt(next, next.encounterDeck)).toEqual([OMINOUS_FATE, CODES.crowley, CODES.watchTower].sort());
    expect(codesAt(next, next.setAside)).toEqual([CODES.lightCruiser, CODES.thunderstruck, CODES.waterspout].sort());
    // The mark is used up: the cards kept are in the second deck like any other.
    expect(Object.values(next.cards).some((card) => card.carried !== undefined)).toBe(false);
  });

  it("leaves a burden in play where it is, and does nothing in a game with no boon or burden in the deck", () => {
    const made = make({ deck: [CODES.lightCruiser], staging: [OMINOUS_FATE] });
    const next = carryToSecondDeck(made.state, carry, made.ctx);
    expect(Object.values(next.cards).some((card) => card.carried === true)).toBe(false);
    expect(next.cards[idOf(next, OMINOUS_FATE)]?.zone).toBe("staging");
  });

  it("is the campaign card's Forced effect on stage 2B: it resolves above the stage's When Revealed, so the burdens are the ones kept when the stage sets the deck aside", () => {
    const made = make({ stage: "12147", campaign: true, deck: [OMINOUS_FATE, CODES.thunderstruck, CODES.lightCruiser], engaged: [{ code: CODES.stormcaller, seat: 0, damage: 17 }], phase: "Combat" });
    const enemy = idOf(made.state, CODES.stormcaller);
    const steps: EngineStep[] = [];
    const hit = placeDamage(made.state, enemy, 1, made.ctx.cards, steps, "combat", ruleCause("rr.damage"));
    const done = finish({ state: settle({ ...hit, window: null }, made.ctx, steps), steps }, made.ctx);
    // Ominous Fate (a non-Ship burden) stays in the deck, Thunderstruck (a Ship burden) is set aside with the rest of the first deck.
    expect(zoneOf(done.state, OMINOUS_FATE)).toBe("encounterDeck");
    expect(zoneOf(done.state, CODES.thunderstruck)).toBe("setAside");
    expect(zoneOf(done.state, CODES.lightCruiser)).toBe("setAside");
  });
});

describe("immune to player events (12159:A:1)", () => {
  // An event card is the source of a Pick, a non-event player card the source of another.
  const pickFor = (made: Table, state: ScenarioState, source: string): string[] => pickCandidates(state, { type: "enemy", control: "any", staging: true }, 0, [], source, made.ctx);

  it("keeps a Raider with a resource out of an event's Pick, not out of an ally's, and a Raider with none stays in", () => {
    const made = make({ staging: [MONUMENT, { code: CODES.umbarRaider, resources: 1 }, CODES.umbarRaider], hand: ["event", "ally"] });
    const raiders = idsOf(made.state, CODES.umbarRaider);
    const withResource = raiders.find((id) => (made.state.cards[id]?.resources ?? 0) > 0) ?? "";
    const event = idOf(made.state, "event");
    const ally = idOf(made.state, "ally");
    expect(pickFor(made, made.state, event)).not.toContain(withResource);
    expect(pickFor(made, made.state, event)).toContain(raiders.find((id) => id !== withResource) ?? "");
    expect(pickFor(made, made.state, ally)).toContain(withResource);
    // An encounter card's Pick reaches it too.
    expect(pickFor(made, made.state, idOf(made.state, MONUMENT))).toContain(withResource);
  });

  it("does nothing in a game with no card that reads the flag, whatever holds it", () => {
    const made = make({ staging: [{ code: CODES.umbarRaider, resources: 1 }], hand: ["event"] });
    const raider = idOf(made.state, CODES.umbarRaider);
    const flagged = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: raider, sourceId: raider, stat: "immuneToPlayerEvents" as const, amount: 1, until: "whileSourceInPlay" as const }] };
    expect(pickFor(made, flagged, idOf(flagged, "event"))).toContain(raider);
    const withMonument = make({ staging: [MONUMENT, { code: CODES.umbarRaider, resources: 1 }], hand: ["event"] });
    expect(pickFor(withMonument, withMonument.state, idOf(withMonument.state, "event"))).not.toContain(idOf(withMonument.state, CODES.umbarRaider));
  });

  it("ends when the Monument leaves the staging area", () => {
    const made = make({ staging: [MONUMENT, { code: CODES.umbarRaider, resources: 1 }], hand: ["event"] });
    const left = syncConstants(moveCard(made.state, idOf(made.state, MONUMENT), { zone: "encounterDiscard" }), made.ctx);
    expect(pickFor(made, left, idOf(left, "event"))).toContain(idOf(left, CODES.umbarRaider));
  });
});

describe("LimitEntries (12155:A:1)", () => {
  // Corsair Waters is the active location; the first sweep starts the count.
  const active = (layout: CorsairsLayout = {}): Table => {
    const made = make({ staging: [CODES.corsairWaters], hand: ["ally", "ally", "event"], ...layout });
    const waters = idOf(made.state, CODES.corsairWaters);
    const located = { ...moveCard(made.state, waters, { zone: "activeLocation" }), activeLocation: waters };
    return { ...made, state: noteEntries(syncConstants(located, made.ctx), made.ctx) };
  };

  it("bars a second ally from entering play in a round, played or put into play, and counts an ally that has left again", () => {
    const made = active();
    const [first, second] = idsOf(made.state, "ally");
    expect(entriesBarred(made.state, second ?? "", made.ctx)).toBe(false);
    const entered = noteEntries(moveCard(made.state, first ?? "", { zone: "play", seat: 0 }), made.ctx);
    expect(entriesBarred(entered, second ?? "", made.ctx)).toBe(true);
    // The ally that entered is discarded: it entered play this round all the same.
    const gone = noteEntries(moveCard(entered, first ?? "", { zone: "discard", seat: 0 }), made.ctx);
    expect(entriesBarred(gone, second ?? "", made.ctx)).toBe(true);
    expect(entriesRefusal(gone, second ?? "", made.ctx)).toMatch(/^Corsair Waters: the players may play or put into play only 1 ally each round\.$/);
  });

  it("bars nothing in a game with no card that reads the limit", () => {
    const made = make({ hand: ["ally", "ally"] });
    const [first, second] = idsOf(made.state, "ally");
    const entered = moveCard({ ...made.state, entries: { round: made.state.round, mark: made.state.clock, count: 5 } }, first ?? "", { zone: "play", seat: 0 });
    expect(entriesBarred(entered, second ?? "", made.ctx)).toBe(false);
  });

  it("counts again in the next round, and does not bar a card that is not an ally or a game whose location is not active", () => {
    const made = active();
    const [first, second] = idsOf(made.state, "ally");
    const entered = noteEntries(moveCard(made.state, first ?? "", { zone: "play", seat: 0 }), made.ctx);
    const later = noteEntries({ ...entered, round: entered.round + 1 }, made.ctx);
    expect(entriesBarred(later, second ?? "", made.ctx)).toBe(false);
    expect(entriesBarred(entered, idOf(entered, "event"), made.ctx)).toBe(false);
    const staged = make({ staging: [CODES.corsairWaters], hand: ["ally", "ally"] });
    const moved = noteEntries(moveCard(staged.state, idsOf(staged.state, "ally")[0] ?? "", { zone: "play", seat: 0 }), staged.ctx);
    expect(entriesBarred(moved, idsOf(moved, "ally")[1] ?? "", staged.ctx)).toBe(false);
  });
});

describe("the resources a player spends (12153:A:2, Umbar Slaver)", () => {
  it("puts 1 of them on the Slaver engaged with the player who spent, and not on one engaged with another player", () => {
    const made = make({ seats: 2, engaged: [{ code: CODES.umbarSlaver, seat: 0 }, { code: CODES.umbarSlaver, seat: 1 }] });
    const [mine, theirs] = idsOf(made.state, CODES.umbarSlaver);
    const hero = updateCard(made.state, made.hero, { resources: 3 });
    const paid = noteSpent(updateCard(hero, made.hero, { resources: 1 }), [{ heroId: made.hero, amount: 2 }], made.ctx);
    const done = settle({ ...paid, window: null }, made.ctx, []);
    expect(done.cards[mine ?? ""]?.resources).toBe(1);
    expect(done.cards[theirs ?? ""]?.resources).toBe(0);
  });

  it("adds Attack and Threat for each resource on it", () => {
    const made = make({ engaged: [{ code: CODES.umbarSlaver, seat: 0, resources: 2 }] });
    const slaver = idOf(made.state, CODES.umbarSlaver);
    const scope = frameScope(made.state, 0, slaver);
    expect(resolveAmount(made.state, { stat: "resources", of: "self" }, scope, made.ctx)).toBe(2);
  });
});

describe("RevealCorsair for any player (12154:A:1)", () => {
  it("lets the only player reveal without being asked, and asks the first player which player reveals in a game of two", () => {
    const withDeck = (made: Table): Table => ({ ...made, state: spawn({ ...made.state, corsairDeck: [], corsairDiscard: [] }, CODES.umbarRaider, { zone: "corsairDeck" }, "down").state });
    const lone = withDeck(make({ staging: [CODES.southernBelfalas] }));
    const done = resolveRecords(lone.state, lone.ctx, CODES.southernBelfalas, "travel", idOf(lone.state, CODES.southernBelfalas));
    expect(done.state.cards[idOf(done.state, CODES.umbarRaider)]?.zone).toBe("engaged");

    const two = withDeck(make({ seats: 2, staging: [CODES.southernBelfalas] }));
    const asked = resolveRecords(two.state, two.ctx, CODES.southernBelfalas, "travel", idOf(two.state, CODES.southernBelfalas), (state) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === "seat:1") ?? "") : ""));
    const enemy = asked.state.cards[idOf(asked.state, CODES.umbarRaider)];
    expect([enemy?.zone, enemy?.controller]).toEqual(["engaged", 1]);
  });
});

describe("Streets of Umbar (12160:A:1)", () => {
  const travel = (layout: CorsairsLayout): Table => make({ phase: "Travel", staging: [CODES.streetsOfUmbar, CODES.waterspout], ...layout });
  const types = (made: Table): string[] => legalIntents(made.state, made.ctx).map((intent) => intent.type);

  it("with a Raider in play lets the players decline for 2 resources on it, or travel elsewhere for the same", () => {
    const made = travel({ staging: [CODES.streetsOfUmbar, CODES.waterspout, CODES.umbarRaider] });
    expect(types(made)).toContain("DeclineTravel");
    const declined = finish({ state: expectOk(reduce(made.state, { type: "DeclineTravel" }, made.ctx)).state, steps: [] }, made.ctx);
    expect(declined.state.cards[idOf(declined.state, CODES.umbarRaider)]?.resources).toBe(2);
    const elsewhere = finish({ state: expectOk(reduce(made.state, { type: "Travel", locationId: idOf(made.state, CODES.waterspout) }, made.ctx)).state, steps: [] }, made.ctx);
    expect(elsewhere.state.cards[idOf(elsewhere.state, CODES.umbarRaider)]?.resources).toBe(2);
    expect(elsewhere.state.activeLocation).toBe(idOf(made.state, CODES.waterspout));
  });

  it("charges nothing for traveling to a location with its title", () => {
    const made = travel({ staging: [CODES.streetsOfUmbar, CODES.umbarRaider] });
    const there = finish({ state: expectOk(reduce(made.state, { type: "Travel", locationId: idOf(made.state, CODES.streetsOfUmbar) }, made.ctx)).state, steps: [] }, made.ctx);
    expect(there.state.activeLocation).toBe(idOf(made.state, CODES.streetsOfUmbar));
    expect(there.state.cards[idOf(there.state, CODES.umbarRaider)]?.resources).toBe(0);
  });

  it("with no Raider in play leaves only the travel to a location with its title", () => {
    const made = travel({});
    expect(types(made)).not.toContain("DeclineTravel");
    const refused = reduce(made.state, { type: "Travel", locationId: idOf(made.state, CODES.waterspout) }, made.ctx);
    expect(refused.ok).toBe(false);
    expect(reduce(made.state, { type: "Travel", locationId: idOf(made.state, CODES.streetsOfUmbar) }, made.ctx).ok).toBe(true);
  });

  it("is no rule while another location is the active location", () => {
    const made = travel({});
    const waters = idOf(made.state, CODES.waterspout);
    const located = syncConstants({ ...moveCard(made.state, waters, { zone: "activeLocation" }), activeLocation: waters }, made.ctx);
    expect(types({ ...made, state: located })).toContain("DeclineTravel");
  });
});

describe("Umbar Patrol (12164:A:1)", () => {
  it("returns an engaged enemy to the staging area and bars optional engagement for the rest of the round, for the enemies revealed later too", () => {
    const made = make({ phase: "Encounter", engaged: [{ code: CODES.umbarRaider, seat: 0 }], staging: [CODES.waterspout] });
    expect(legalIntents(made.state, made.ctx).some((intent) => intent.type === "Engage")).toBe(false);
    const raider = idOf(made.state, CODES.umbarRaider);
    const done = resolveRecords(made.state, made.ctx, CODES.umbarPatrol, "whenRevealed", undefined, answerFirst);
    expect(done.state.cards[raider]?.zone).toBe("staging");
    const later = spawn({ ...done.state, mode: "optionalEngage", window: { kind: "optionalEngage" } }, CODES.umbarRaider, { zone: "staging" }).state;
    expect(legalIntents(later, made.ctx).some((intent) => intent.type === "Engage")).toBe(false);
    // The next round the flag is gone.
    const next = { ...later, modifiers: later.modifiers.filter((modifier) => modifier.until !== "endOfRound") };
    expect(legalIntents(next, made.ctx).some((intent) => intent.type === "Engage")).toBe(true);
  });

  it("searches for an enemy and adds it to the staging area when none is there once the engaged enemies are back (an enemy it returned is in the staging area)", () => {
    const none = make({ phase: "Encounter", deck: [CODES.corsairInfiltrator] });
    const found = resolveRecords(none.state, none.ctx, CODES.umbarPatrol, "whenRevealed", undefined, answerFirst);
    expect(zoneOf(found.state, CODES.corsairInfiltrator)).toBe("staging");
    const returned = make({ phase: "Encounter", engaged: [{ code: CODES.umbarRaider, seat: 0 }], deck: [CODES.corsairInfiltrator] });
    const kept = resolveRecords(returned.state, returned.ctx, CODES.umbarPatrol, "whenRevealed", undefined, answerFirst);
    expect(zoneOf(kept.state, CODES.umbarRaider)).toBe("staging");
    expect(zoneOf(kept.state, CODES.corsairInfiltrator)).toBe("encounterDeck");
  });
});

describe("the Campaign Log's upgrade as a condition (11215:A:3, Gavin returned)", () => {
  it("holds when the campaign facts list the card as upgraded, and not in a game with none", () => {
    const made = make();
    const scope = frameScope(made.state, 0, null);
    const condition = { kind: "upgraded", code: CODES.gavin } as const;
    expect(holds(made.state, condition, { actor: scope.actor, sourceId: null, returned: 0 }, made.ctx)).toBe(false);
    const facts = { prisoner: null, usedOnce: [], counters: {}, upgraded: [CODES.gavin] };
    expect(holds({ ...made.state, campaignFacts: facts }, condition, { actor: scope.actor, sourceId: null, returned: 0 }, made.ctx)).toBe(true);
    expect(holds({ ...made.state, campaignFacts: { ...facts, upgraded: [CODES.calaerion] } }, condition, { actor: scope.actor, sourceId: null, returned: 0 }, made.ctx)).toBe(false);
  });
});

describe("the amount every (12158:A:3, For every 5 resources)", () => {
  it("is the value read divided by the number and rounded down", () => {
    const made = make({ engaged: [{ code: CODES.captainSahir, seat: 0, resources: 12 }] });
    const sahir = idOf(made.state, CODES.captainSahir);
    const scope = frameScope(made.state, 0, sahir);
    expect(resolveAmount(made.state, { stat: "resources", of: "self", every: 5 }, scope, made.ctx)).toBe(2);
    expect(resolveAmount(updateCard(made.state, sahir, { resources: 4 }), { stat: "resources", of: "self", every: 5 }, scope, made.ctx)).toBe(0);
  });
});

describe("The Black Sword's Refresh Action on the campaign card (11215:B:3)", () => {
  // Sahír engaged with the first player, The Black Sword attached to him with `resources` on it, in the refresh phase with the campaign card on the table.
  const armed = (resources: number): Table => {
    const made = make({ phase: "Refresh", campaign: true, engaged: [{ code: CODES.captainSahir, seat: 0 }] });
    const sword = spawn(made.state, CODES.theBlackSword, { zone: "play", seat: 0 });
    return { ...made, state: { ...updateCard(attachTo(sword.state, sword.id, idOf(made.state, CODES.captainSahir)), sword.id, { resources }), window: { kind: "pass" } } };
  };
  const use = (made: Table): ScenarioState => {
    const trigger = legalIntents(made.state, made.ctx).find((intent) => intent.type === "Trigger");
    if (trigger?.type !== "Trigger") throw new Error("the Action is not offered");
    let run = { state: expectOk(reduce(made.state, trigger, made.ctx)).state, steps: [] as EngineStep[] };
    run = finish(run, made.ctx, answerFirst);
    return run.state;
  };

  it("exhausts a hero to move 1 resource from the Sword to that hero's pool, once a round", () => {
    const made = armed(2);
    const sword = idOf(made.state, CODES.theBlackSword);
    const done = use(made);
    expect(done.cards[sword]?.resources).toBe(1);
    expect(done.cards[made.hero]?.resources).toBe(1);
    expect(done.cards[made.hero]?.exhausted).toBe(true);
    expect(legalIntents({ ...done, window: { kind: "pass" } }, made.ctx).some((intent) => intent.type === "Trigger")).toBe(false);
  });

  it("removes the Sword from the game when no resource is left on it", () => {
    const made = armed(1);
    const done = use(made);
    expect(done.cards[idOf(made.state, CODES.theBlackSword)]?.zone).toBe("removed");
    expect(done.cards[made.hero]?.resources).toBe(1);
  });

  it("is not offered outside the refresh phase", () => {
    const made = armed(2);
    const quest = { ...made.state, ...opening("Quest") };
    expect(legalIntents(quest, made.ctx).some((intent) => intent.type === "Trigger")).toBe(false);
  });
});

// The When Revealed and Forced records of the encounter cards, each run on a small table (a card that only reads existing verbs is read here once).
const heading = (made: Table, at: "Sun" | "Cloud" | "Rain" | "Storm"): Table => ({ ...made, state: syncConstants({ ...made.state, sea: { heading: at, headingCard: null, routes: made.state.sea?.routes ?? {} } }, made.ctx) });

describe("Foes of Ecthelion (12163:A:1)", () => {
  it("puts 2 resources on a Raider in the staging area and +1 Threat for each resource on every such Raider until the end of the phase", () => {
    const made = make({ staging: [{ code: CODES.umbarRaider, resources: 1 }, CODES.umbarRaider] });
    const [first, second] = idsOf(made.state, CODES.umbarRaider);
    const done = resolveRecords(made.state, made.ctx, CODES.foesOfEcthelion, "whenRevealed", undefined, answerFirst);
    const total = (done.state.cards[first ?? ""]?.resources ?? 0) + (done.state.cards[second ?? ""]?.resources ?? 0);
    expect(total).toBe(3);
    for (const id of [first ?? "", second ?? ""]) {
      const card = done.state.cards[id]!;
      expect(modifiedStat(done.state, card, "threat", made.ctx.cards) - modifiedStat(make({ staging: [CODES.umbarRaider] }).state, Object.values(make({ staging: [CODES.umbarRaider] }).state.cards).find((c) => c.code === CODES.umbarRaider)!, "threat", made.ctx.cards)).toBe(card.resources);
    }
  });
});

describe("Fury and Malice (12165:A:1)", () => {
  it("puts 1 resource on each engaged Raider and each player assigns that many damage for the Raiders engaged with them", () => {
    const made = make({ seats: 2, engaged: [{ code: CODES.umbarRaider, seat: 0, resources: 1 }, { code: CODES.umbarRaider, seat: 1 }] });
    const done = resolveRecords(made.state, made.ctx, CODES.furyAndMalice, "whenRevealed", undefined, answerFirst);
    const damage = (id: string | null) => done.state.cards[id ?? ""]?.damage ?? 0;
    expect(damage(made.hero) + damage(made.hero2)).toBe(2);
    expect(damage(made.seat1Hero)).toBe(1);
  });

  it("assigns nothing with no Raider engaged", () => {
    const made = make({ engaged: [CODES.lightCruiser] });
    const done = resolveRecords(made.state, made.ctx, CODES.furyAndMalice, "whenRevealed", undefined, answerFirst);
    expect((done.state.cards[made.hero]?.damage ?? 0) + (done.state.cards[made.hero2]?.damage ?? 0)).toBe(0);
  });
});

describe("The Stormcaller's Forced effect (12151:A:3)", () => {
  it("returns it to the staging area or shifts the heading off-course, as the engaged player chooses; nothing in the staging area", () => {
    const engagedOne = (): Table => heading(make({ engaged: [CODES.stormcaller] }), "Sun");
    const stormcaller = (made: Table) => idOf(made.state, CODES.stormcaller);
    const back = resolveRecords(engagedOne().state, engagedOne().ctx, CODES.stormcaller, "forced", stormcaller(engagedOne()), (state) => (state.window?.kind === "choose" ? (state.window.options.includes("staging") ? "staging" : "") : ""));
    expect(back.state.cards[stormcaller(engagedOne())]?.zone).toBe("staging");
    const shift = resolveRecords(engagedOne().state, engagedOne().ctx, CODES.stormcaller, "forced", stormcaller(engagedOne()), (state) => (state.window?.kind === "choose" ? "heading" : ""));
    expect(shift.state.sea?.heading).not.toBe("Sun");
    expect(shift.state.cards[stormcaller(engagedOne())]?.zone).toBe("engaged");
  });
});

describe("City of Corsairs (12161:A:1)", () => {
  it("has as Threat the most resources on one Raider enemy in play", () => {
    const made = make({ staging: [CODES.cityOfCorsairs, { code: CODES.umbarRaider, resources: 2 }, { code: CODES.umbarRaider, resources: 5 }] });
    const city = made.state.cards[idOf(made.state, CODES.cityOfCorsairs)]!;
    expect(modifiedStat(made.state, city, "threat", made.ctx.cards)).toBe(5);
  });
});

describe("the Shadow effects that read a destroyed character or the attacker's resources", () => {
  // A Raider engaged with the first seat attacks it undefended (the first hero takes the damage), with `shadow` dealt to it.
  const fight = (shadow: string, layout: CorsairsLayout = {}, options: Parameters<typeof corsairsFight>[4] = {}) => corsairsFight(world, shadow, CODES.umbarRaider, { play: ["ally"], ...layout }, { undefended: true, ...options });
  const wounded = (damage: number) => (state: ScenarioState, made: Table) => updateCard(state, made.hero, { damage });

  it("12154:A:2 discards an ally of the defending player when the attack destroys a character, and not otherwise", () => {
    const killed = fight(CODES.southernBelfalas, {}, { tweak: wounded(5) });
    expect(killed.run.state.cards[idOf(killed.run.state, "ally")]?.zone).toBe("discard");
    const spared = fight(CODES.southernBelfalas, {});
    expect(spared.run.state.cards[idOf(spared.run.state, "ally")]?.zone).toBe("play");
  });

  it("12156:A:2 puts on a Raider enemy as many resources as the destroyed ally's printed cost", () => {
    const cost = world.cards.get("ally")?.cost ?? 1;
    const attackAlly = (shadow: string) => fight(shadow, {}, { tweak: (state) => updateCard(state, idOf(state, "ally"), { damage: 1 }), defender: (table) => idOf(table.state, "ally"), undefended: false }).run.state;
    const killed = attackAlly(CODES.watchTower);
    const baseline = attackAlly("f0");
    expect(killed.cards[idOf(killed, "ally")]?.zone).toBe("discard");
    expect(baseline.cards[idOf(baseline, "ally")]?.zone).toBe("discard");
    // The Raider's own Forced effect takes a resource from a hero whatever shadow card it has: Watch Tower's Shadow adds the destroyed ally's cost to that.
    expect((killed.cards[idOf(killed, CODES.umbarRaider)]?.resources ?? 0) - (baseline.cards[idOf(baseline, CODES.umbarRaider)]?.resources ?? 0)).toBe(cost);
  });

  it("12160:A:2 deals a Raider 1 additional shadow card for each resource on it, at most 3", () => {
    const dealt = (resources: number): number => {
      const made = fight(CODES.streetsOfUmbar, { engaged: [{ code: CODES.umbarRaider, seat: 0, resources }], deck: [CODES.streetsOfUmbar, "f0", "f0", "f0", "f0", "f0", "f0"] });
      return made.start.encounterDeck.length - made.run.state.encounterDeck.length;
    };
    expect(dealt(0)).toBe(1);
    expect(dealt(2)).toBe(3);
    expect(dealt(5)).toBe(4);
  });
});

describe("Slave Ship (12152:A:3)", () => {
  it("deals 1 damage to a non-Ship character of the defending player for each point its attack deals to a Ship objective", () => {
    const DREAM_CHASER = "110136"; // the Campaign Mode printing the campaign deals
    const fight = corsairsFight(world, "f0", CODES.slaveShip, { play: [DREAM_CHASER] }, { defender: (table) => idOf(table.state, DREAM_CHASER) });
    const ship = fight.run.state.cards[idOf(fight.run.state, DREAM_CHASER)];
    const heroes = [fight.made.hero, fight.made.hero2].map((id) => fight.run.state.cards[id]?.damage ?? 0);
    expect(ship?.damage).toBeGreaterThan(0);
    expect(heroes[0]! + heroes[1]!).toBe(ship?.damage);
  });
});

// dcce.scalable-upgradable: an upgraded card uses its Upgraded side for the rest of the campaign, so a card dealt facedown shows that side when it is turned faceup.
describe("The Shattered Monument (110129) revealed in an upgraded game", () => {
  const facts = { prisoner: null, usedOnce: [], counters: {}, upgraded: [MONUMENT] };
  const revealed = (upgraded: boolean) => {
    const made = make();
    const state = upgraded ? { ...made.state, campaignFacts: facts } : made.state;
    const { state: after, id } = revealFromTop(state, made.ctx, MONUMENT, []);
    return after.cards[id];
  };

  it("shows side B when it is revealed from the facedown encounter deck, and side A in a game that has not upgraded it", () => {
    expect(revealed(true)?.zone).toBe("staging");
    expect(revealed(true)?.face).toBe("B");
    expect(revealed(false)?.face).toBe("up");
  });
});
