// Rules: rr.explored, rr.search, rr.cancel, rr.shadow-effects, rr.defending-player, rr.damage, rr.engaged, rr.guarded, rr.step-6-2, rr.step-6-4-2, rr.victory, faq.additional-attacks (data/rules/entries.json); ledger lines 51301:B:1, 51304:B:1, 51307:A:1, 51307:B:2, 51308:B:1, 51308:B:2, 51309:B:2, 51320:A:2, 51324:A:1, 51335:A:2, 51340:A:1, 51342:A:2, 51348:A:2
// (docs/scenarios/standalone-scenarios.md, Escape from Khazad-dûm). The pieces the scenario adds, on its own cards: Dark Pit's flip, A Wrong Turn's kept card, Durin's Bane's entry and its attacks on the stage, Fatigue's removed defender, Rock Adder's bar, Undisturbed Bones, Goblin Dungeon's ally, Black Uruks' dealt card and Chieftain of the Pit.
import { describe, expect, it } from "vitest";

import { destroyCard, modifiedStat } from "../../core/keywords.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import { legalTargets } from "../../engine/reduce.ts";
import { moveCard } from "../../core/zones.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { fireForced } from "../../windows/triggers.ts";
import { bonesCancel } from "./khazad.ts";
import { finish, idOf, idsOf, resolveRecords, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

// The quest cards a Quick-build game keeps: 1A, one stage 2 and one stage 3 (the Setup of 51301), so a stage number is the printed one.
const realStages = (stage: string | undefined): string[] => (stage != null && ["51307", "51308", "51309"].includes(stage) ? ["51301", "51303", stage] : ["51301", ["51303", "51304", "51305"].includes(stage ?? "") ? (stage as string) : "51303", "51307"]);
const table = (layout: Layout) => tableFromLayout("escape-from-khazad-dum", { stages: realStages(layout.stage), ...layout });
const codesOf = (state: ScenarioState, ids: readonly string[]): string[] => ids.map((id) => state.cards[id]?.code ?? "");

describe("Dark Pit and stage 1B (reading 7)", () => {
  // Dark Pit explored in the staging area, settled: its Forced effect is answered with the first card of each deck.
  const explored = (layout: Layout = {}) => {
    const made = table({ stage: "51301", staging: ["51310"], phase: "Quest", deckOf: ["f0", "f0", "f0", "f0", "f0", "f0"], ...layout });
    const steps: EngineStep[] = [];
    const done = settle(destroyCard({ ...made.state, window: null }, idOf(made.state, "51310"), made.cards, steps, true), made.ctx, steps);
    return { made, run: finish({ state: done, steps }, made.ctx) };
  };

  it("51301:B:1 the explored Dark Pit flips over: Durin's Bane lies set aside, out of play, with no tokens", () => {
    const { made, run } = explored();
    const pit = idOf(made.state, "51310");
    expect(run.state.cards[pit]).toMatchObject({ code: "51311", zone: "setAside", other: "51310", damage: 0, progress: 0 });
    expect(run.state.setAside).toContain(pit);
    expect(run.state.staging).not.toContain(pit);
  });

  it("51301:B:1 each player takes a card of the top 5 of his own deck into his hand", () => {
    const { run } = explored({ seats: 2 });
    expect(run.state.seats[0]?.hand.length).toBe(1);
    expect(run.state.seats[1]?.hand.length).toBe(1);
  });

  it("51301:B:2 the stage cannot be defeated while Dark Pit is in play, and can once it has flipped", () => {
    const made = table({ stage: "51301", staging: ["51310"] });
    expect(restricted(made.state, made.ctx, "advance")).toHaveLength(1);
    expect(restricted(table({ stage: "51301" }).state, made.ctx, "advance")).toHaveLength(0);
  });

  it("51301:B:2 the explored Dark Pit, whose explored event waits for its Forced effect, holds the stage until the flip", () => {
    const made = table({ stage: "51301", discard: ["51310"] });
    const id = idOf(made.state, "51310");
    const waiting = { ...made.state, pendingEvents: [{ trigger: "locationExplored" as const, seat: null, subject: id }] };
    expect(restricted(waiting, made.ctx, "advance")).toHaveLength(1);
    // Once the event is heard and Dark Pit flipped, nothing holds the stage.
    const { run } = explored();
    expect(restricted(run.state, made.ctx, "advance")).toHaveLength(0);
  });

  it("51301:B:2 a Dark Pit that left play without a flip pending does not hold the stage for good", () => {
    const made = table({ stage: "51301", discard: ["51310"] });
    expect(restricted(made.state, made.ctx, "advance")).toHaveLength(0);
    const away = table({ stage: "51301", setAside: ["51310"] });
    expect(restricted(away.state, away.ctx, "advance")).toHaveLength(0);
  });
});

describe("A Wrong Turn (51304:B:1, reading 9)", () => {
  it("each player keeps the card he chooses and shuffles the rest of his hand into his deck", () => {
    const made = table({ stage: "51304", seats: 2, hand: ["f0", "f0", "f0"], deckOf: ["f0"] });
    const stage = idOf(made.state, "51304");
    const before = made.state.seats.map((seat) => [seat.hand.length, seat.deck.length]);
    const done = resolveRecords(made.state, made.ctx, "51304", "whenRevealed", stage);
    for (const seat of [0, 1]) {
      expect(done.state.seats[seat]?.hand.length).toBe(1);
      expect(done.state.seats[seat]?.deck.length).toBe((before[seat]?.[0] ?? 0) + (before[seat]?.[1] ?? 0) - 1);
    }
  });

  it("a hand of one card is kept whole", () => {
    const made = table({ stage: "51304", hand: ["f0"], deckOf: ["f0", "f0"] });
    const done = resolveRecords(made.state, made.ctx, "51304", "whenRevealed", idOf(made.state, "51304"));
    expect(done.state.seats[0]?.hand.length).toBe(1);
    expect(done.state.seats[0]?.deck.length).toBe(2);
  });
});

describe("Durin's Bane on stage 3 (readings 12, 14, 15, 16)", () => {
  const entered = (stage: string, layout: Layout = {}) => {
    const made = table({ stage, setAside: ["51311"], phase: "Quest", ...layout });
    return { made, run: resolveRecords(made.state, made.ctx, stage, "whenRevealed", idOf(made.state, stage)) };
  };

  it("51307:A:1 the set-aside Durin's Bane joins the staging area and cannot take damage this round", () => {
    const { made, run } = entered("51307");
    const bane = idOf(made.state, "51311");
    expect(run.state.cards[bane]?.zone).toBe("staging");
    expect(run.state.setAside).not.toContain(bane);
    const card = run.state.cards[bane];
    expect(card && modifiedStat(run.state, card, "hitPoints", made.cards)).toBeGreaterThan(0);
    expect(run.state.modifiers.some((modifier) => modifier.instanceId === bane && modifier.stat === "cannotTakeDamage" && modifier.until === "endOfRound")).toBe(true);
  });

  it("51307:A:1 with one player nothing attacks at once", () => {
    const { run } = entered("51307");
    expect(run.state.pendingAttack ?? null).toBeNull();
  });

  it("51307:A:1 with two players it makes an immediate attack against the first player", () => {
    const { made, run } = entered("51307", { seats: 2 });
    const attacked = run.state.pendingAttack ?? send(run, { type: "Pass" }, made.ctx).state.pendingAttack;
    expect(attacked ? { enemy: run.state.cards[attacked.enemyId]?.code, seat: attacked.seat } : null).toEqual({ enemy: "51311", seat: 0 });
  });

  it("51307:B:2 at the beginning of the quest phase it attacks the first player, and an undefended attack puts its damage on the stage, none on a hero", () => {
    const made = table({ stage: "51307", staging: ["51311"], deck: ["f0", "f0"], phase: "Quest" });
    const steps: EngineStep[] = [];
    const fired = settle(fireForced({ ...made.state, window: null }, { trigger: "beginningOfPhase", seat: 0, phase: "Quest" }, made.ctx, steps), made.ctx, steps);
    const stage = made.state.questStage ?? "";
    expect(fired.pendingAttack ? codesOf(fired, [fired.pendingAttack.enemyId]) : []).toEqual(["51311"]);
    const run = finish(send({ state: fired, steps }, { type: "Undefended" }, made.ctx), made.ctx);
    expect(run.state.cards[stage]?.damage).toBe(8);
    expect(run.state.seats[0]?.heroes.every((hero) => run.state.cards[hero]?.damage === 0)).toBe(true);
  });

  it("51307:B:3 the players lose when the stage holds damage equal to its quest points", () => {
    const made = table({ stage: "51307", staging: ["51311"], deck: ["f0", "f0"], phase: "Quest" });
    const steps: EngineStep[] = [];
    const stage = made.state.questStage ?? "";
    const marked = { ...made.state, cards: { ...made.state.cards, [stage]: { ...(made.state.cards[stage] as NonNullable<ScenarioState["cards"][string]>), damage: 5 } } };
    const fired = settle(fireForced({ ...marked, window: null }, { trigger: "beginningOfPhase", seat: 0, phase: "Quest" }, made.ctx, steps), made.ctx, steps);
    const run = finish(send({ state: fired, steps }, { type: "Undefended" }, made.ctx), made.ctx);
    expect(run.state.lost).toBe(true);
  });

  it("51308:B:1 Durin's Bane engages the first player as it joins the staging area", () => {
    const { made, run } = entered("51308", { seats: 2 });
    expect(run.state.cards[idOf(made.state, "51311")]).toMatchObject({ zone: "engaged", controller: 0 });
  });

  it("51308:B:2 it cannot take more damage a round than the progress tokens on the stage, and none with no progress", () => {
    const withProgress = (progress: number) => {
      const made = table({ stage: "51308", staging: ["51311"], progress });
      const bane = made.state.cards[idOf(made.state, "51311")];
      const flags = made.state.modifiers.filter((modifier) => modifier.instanceId === bane?.id);
      return { cap: flags.find((modifier) => modifier.stat === "damageCap")?.amount ?? 0, none: flags.some((modifier) => modifier.stat === "cannotTakeDamage") };
    };
    expect(withProgress(0).none).toBe(true);
    expect(withProgress(3)).toEqual({ cap: 3, none: false });
  });

  it("51309:B:2 it is considered engaged with each player and cannot leave the staging area, with no progress needed", () => {
    const made = table({ stage: "51309", staging: ["51311"] });
    const flags = made.state.modifiers.filter((modifier) => modifier.instanceId === idOf(made.state, "51311")).map((modifier) => modifier.stat);
    expect(flags).toEqual(expect.arrayContaining(["engagedWithAll", "cannotBeEngaged", "noThreatContribution", "attackableByAny", "cannotLeaveStaging"]));
  });
});

describe("Rock Adder and Fatigue (51324:A:1, 51335:A:2, readings 21 and 22)", () => {
  it("51324:A:1 no character can be declared as a defender against Rock Adder", () => {
    const made = table({ stage: "51303", engaged: ["51324"], phase: "Combat" });
    const adder = idOf(made.state, "51324");
    const attacking = { ...made.state, pendingAttack: { enemyId: adder, seat: 0 } };
    expect(legalTargets(attacking, { type: "DeclareDefender" }, made.ctx)).toEqual([]);
  });

  it("51335:A:2 the removed defender cannot be declared again for the attack, and another may be", () => {
    const made = table({ stage: "51303", engaged: ["51312"], phase: "Combat", seats: 1 });
    const enemy = idOf(made.state, "51312");
    const heroes = made.state.seats[0]?.heroes ?? [];
    const attack = { enemyId: enemy, seat: 0, defenderId: heroes[0] ?? "", shadowResolved: true };
    const removed = resolveRecords({ ...made.state, pendingAttack: attack }, made.ctx, "51335", "shadow", idOf(made.state, "51312"));
    expect(removed.state.pendingAttack?.defenderId).toBeUndefined();
    expect(removed.state.pendingAttack?.removedDefenders).toEqual([heroes[0]]);
    expect(removed.state.pendingAttack?.undefended).toBeUndefined();
    expect(legalTargets(removed.state, { type: "DeclareDefender" }, made.ctx)).not.toContain(heroes[0]);
  });
});

describe("Undisturbed Bones (51320:A:2, reading 20)", () => {
  it("a cancel of a When Revealed effect does not happen and Undisturbed Bones is discarded", () => {
    const made = table({ stage: "51303", phase: "Quest" });
    const attached = resolveRecords(made.state, made.ctx, "51320", "whenRevealed");
    const bones = attached.id;
    expect(attached.state.cards[bones]?.host).toBe(attached.state.questStage);
    expect(attached.state.cards[bones]?.zone).toBe("attached");
    const reveal = { frame: "whenRevealed", cardId: null, seat: 0, peril: false, data: { kind: "event", event: { trigger: "revealed", seat: 0 } } };
    const asked = { ...attached.state, window: null, stack: [reveal] } as unknown as ScenarioState;
    const steps: EngineStep[] = [];
    const answered = bonesCancel(asked, made.ctx, steps);
    expect(answered?.cards[bones]?.zone).toBe("encounterDiscard");
  });

  it("a cancel of a shadow effect is not replaced", () => {
    const made = table({ stage: "51303", phase: "Quest" });
    const attached = resolveRecords(made.state, made.ctx, "51320", "whenRevealed");
    expect(bonesCancel({ ...attached.state, window: null, stack: [] }, made.ctx, [])).toBeNull();
  });
});

describe("Goblin Dungeon (51340:A:1, reading 28)", () => {
  it("the ally of the highest cost lies under it, and returns exhausted to its owner when it leaves play", () => {
    const made = table({ stage: "51303", phase: "Quest", play: ["ally"] });
    const done = resolveRecords(made.state, made.ctx, "51340", "whenRevealed");
    const ally = idOf(made.state, "ally");
    expect(done.state.cards[ally]).toMatchObject({ zone: "under", host: done.id, face: "up", heldTitle: true, heldExhausted: true });
    const gone = settle(destroyCard({ ...done.state, window: null }, done.id, made.cards, [], true), made.ctx, []);
    expect(gone.cards[ally]).toMatchObject({ zone: "play", controller: 0, exhausted: true });
  });
});

describe("Black Uruks and Chieftain of the Pit (51342:A:2, 51348:A:2)", () => {
  it("51342:A:2 the top-5 card of the highest Attack is dealt to the attacker as a shadow card, face down, and the deck is not shuffled", () => {
    const made = table({ stage: "51303", engaged: ["51312"], deck: ["51313", "51315", "51318", "51313", "51313"], phase: "Combat" });
    const attacker = idOf(made.state, "51312");
    const deckBefore = made.state.encounterDeck;
    const done = resolveRecords({ ...made.state, pendingAttack: { enemyId: attacker, seat: 0 } }, made.ctx, "51342", "shadow", idOf(made.state, "51312"));
    const dealt = done.state.cards[attacker]?.shadowId ?? done.state.cards[attacker]?.extraShadowIds?.[0] ?? "";
    expect(codesOf(done.state, [dealt])).toEqual(["51318"]);
    expect(done.state.cards[dealt]).toMatchObject({ zone: "shadow", face: "down" });
    expect(done.state.encounterDeck).toEqual(deckBefore.filter((id) => id !== dealt));
  });

  it("51342:A:1 while Black Uruks attacks it gets +1 Attack for each shadow card dealt for the attack, read live", () => {
    const made = table({ stage: "51303", engaged: ["51342"], deck: ["51313", "51313", "51313"], phase: "Combat" });
    const uruks = idOf(made.state, "51342");
    const attackOf = (state: ScenarioState): number => modifiedStat(state, state.cards[uruks] as NonNullable<ScenarioState["cards"][string]>, "attack", made.cards);
    const [one, two] = made.state.encounterDeck;
    const dealt = [one, two].reduce((state, id) => moveCard(state, id ?? "", { zone: "shadow", enemyId: uruks }), made.state);
    expect(attackOf(dealt)).toBe(attackOf(made.state));
    const attacking = { ...dealt, pendingAttack: { enemyId: uruks, seat: 0 } };
    expect(attackOf(attacking)).toBe(attackOf(made.state) + 2);
  });

  it("51348:A:2 while Chieftain of the Pit is in play a Response cannot cancel a shadow effect", () => {
    const made = table({ stage: "51303", engaged: ["51348"] });
    expect(made.state.modifiers.some((modifier) => modifier.instanceId === "table" && modifier.stat === "allShadowsUncancelable")).toBe(true);
    expect(table({ stage: "51303" }).state.modifiers.some((modifier) => modifier.stat === "allShadowsUncancelable")).toBe(false);
  });
});

describe("stage 2 and the locations' bars", () => {
  it("51303:B:2 the enemy Old One Lair marks with a resource is immune to player card effects, and no progress is placed on the stage while it is in play", () => {
    const made = table({ stage: "51303", staging: [{ code: "51312", resources: 1 }], progress: 0 });
    const enemy = idOf(made.state, "51312");
    expect(modifiedStat(made.state, made.state.cards[enemy] as NonNullable<ScenarioState["cards"][string]>, "immuneToPlayerCards", made.cards)).toBeGreaterThan(0);
    expect(made.state.modifiers.some((modifier) => modifier.instanceId === made.state.questStage && modifier.stat === "noProgressPlaced")).toBe(true);
    const free = table({ stage: "51303", staging: ["51312"] });
    expect(free.state.modifiers.some((modifier) => modifier.stat === "noProgressPlaced")).toBe(false);
  });

  it("51325:A:1 with Bottomless Chasm in the staging area the players travel to it and to no other location, if able", () => {
    const made = table({ stage: "51303", phase: "Travel", staging: ["51325", "51313"], hand: ["filler"] });
    expect(legalTargets(made.state, { type: "Travel" }, made.ctx).map((id) => made.state.cards[id]?.code)).toEqual(["51325"]);
    const without = table({ stage: "51303", phase: "Travel", staging: ["51313", "51319"], hand: ["filler"] });
    expect(legalTargets(without.state, { type: "Travel" }, without.ctx).map((id) => without.state.cards[id]?.code).sort()).toEqual(["51313", "51319"]);
  });

  it("51334:A:1 Branching Paths gets +1 Threat for each location in the staging area, at most +3", () => {
    const threat = (others: number): number => {
      const made = table({ stage: "51303", staging: ["51334", ...Array.from({ length: others }, () => "51313")] });
      return modifiedStat(made.state, made.state.cards[idOf(made.state, "51334")] as NonNullable<ScenarioState["cards"][string]>, "threat", made.cards);
    };
    expect([threat(0), threat(1), threat(2), threat(3), threat(5)]).toEqual([1, 2, 3, 3, 3]);
  });

  it("51346:A:1 The Great Bridge limits every enemy to one declared attacker while it is in the staging area", () => {
    const made = table({ stage: "51303", staging: ["51346", "51312"] });
    expect(made.state.modifiers.some((modifier) => modifier.stat === "singleAttacker" && modifier.instanceId === idOf(made.state, "51312"))).toBe(true);
    expect(table({ stage: "51303", staging: ["51312"] }).state.modifiers.some((modifier) => modifier.stat === "singleAttacker")).toBe(false);
  });

  it("51316:A:1 The Mountain's Roots has a Threat 1 more than the stage number", () => {
    const made = table({ stage: "51305", staging: ["51316"] });
    expect(modifiedStat(made.state, made.state.cards[idOf(made.state, "51316")] as NonNullable<ScenarioState["cards"][string]>, "threat", made.cards)).toBe(3);
  });
});

describe("the scenario's own table", () => {
  it("builds with the real quest deck and the Dark Pit", () => {
    const made = table({ stage: "51301", staging: ["51310"] });
    expect(idsOf(made.state, "51310")).toHaveLength(1);
  });
});
