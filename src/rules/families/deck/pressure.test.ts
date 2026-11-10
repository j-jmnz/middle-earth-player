// Rules: rr.forced, rr.triggered-ability, rr.constant-ability, rr.player-elimination, rr.resources, rr.effects (data/rules/entries.json); ledger lines 143048:A:1, 143059:A:1, 143055:A:1, 143068:A:2, 143078:B:1, 143080:A:1, 143080:B:3. The pressure on the players' hands
// on The Road to Isengard's own table: a draw heard by the Staff and Open Pit (and not by a card that arrives after it), Ring-wall's heal, Saruman's Voice and its `abilityTriggered`, the elimination at an empty hand, and the stage that bars resources and commitment.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import { legalIntents, legalTargets } from "../../engine/reduce.ts";
import { runInstruction, drawMany, gainSeatResources } from "../../interpret/interpret.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { queueEvent } from "../../windows/queue.ts";
import { announceAbility } from "./pressure.ts";
import { nextIntent } from "../../../../test/harness/auto-player.ts";
import { POLICY } from "../../../../scripts/card-smoke/world.ts";
import { finish, idOf, resolveRecords, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-road-to-isengard";
const FILLERS = Array.from({ length: 12 }, () => "filler");
const at = (layout: Layout = {}) => tableFromLayout(ID, { stage: "143080", phase: "Quest", deck: ["f0", "f0", "f0", "f0"], ...layout });
const draw = (state: ScenarioState, ctx: ReturnType<typeof at>["ctx"], seat: number, count: number, byPlayerCard: boolean): ScenarioState => drawMany(state, seat, count, [], UNATTRIBUTED, ctx, false, byPlayerCard);
const rest = (state: ScenarioState, ctx: ReturnType<typeof at>["ctx"], steps: EngineStep[] = []): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, ctx, steps);

describe("143048:A:1 Saruman's Staff hears a draw", () => {
  const staffed = (layout: Layout = {}) => at({ staging: ["143047"], attached: [{ code: "143048", to: "143047" }], deckOf: FILLERS, deck: ["f0", "f0", "f0", "f0"], ...layout });

  it("has Saruman attack the player from the staging area with 2 shadow cards, then heals 1 damage from him", () => {
    const made = staffed();
    const saruman = idOf(made.state, "143047");
    const hurt = updateCard(made.state, saruman, { damage: 3 });
    let run = { state: rest(draw(hurt, made.ctx, 0, 1, false), made.ctx), steps: [] as EngineStep[] };
    const attack = run.state.pendingAttack;
    expect(attack?.enemyId).toBe(saruman);
    expect(attack?.fromStaging).toBe(true);
    expect(attack?.seat).toBe(0);
    expect(run.state.cards[saruman]?.shadowId).toBeTruthy();
    expect(run.state.cards[saruman]?.extraShadowIds).toHaveLength(1);
    // The attack is played out; then 1 damage is healed from Saruman.
    const memory = new Set<string>();
    for (let guard = 0; guard < 60 && (run.state.pendingAttack || run.state.stack.length > 0); guard += 1) {
      const legal = legalIntents(run.state, made.ctx);
      if (legal.length === 0) break;
      run = send(run, nextIntent(run.state, made.ctx, POLICY, memory, legal), made.ctx);
    }
    expect(run.state.pendingAttack).toBeNull();
    expect(run.state.cards[saruman]?.damage).toBe(2);
  });

  it("hears a draw of any number of cards for each player in turn, and not a draw of 0 cards", () => {
    const made = staffed({ seats: 2 });
    const [firstSeat, secondSeat] = made.state.seats;
    const emptied = { ...made.state, seats: [firstSeat!, { ...secondSeat!, deck: [] }] as typeof made.state.seats };
    const none = rest(draw(emptied, made.ctx, 1, 2, false), made.ctx);
    expect(none.pendingAttack).toBeNull();
    const second = rest(draw(made.state, made.ctx, 1, 2, false), made.ctx);
    expect(second.pendingAttack?.seat).toBe(1);
  });

  it("143080:A:1 does not hear the draw of 6 that attaches it: it is not in play when the cards are drawn", () => {
    const made = at({ staging: ["143047"], setAside: ["143048"], deckOf: FILLERS, hand: [] });
    const done = resolveRecords(made.state, made.ctx, "143080", "whenRevealed", idOf(made.state, "143080"));
    expect(done.state.seats[0]?.hand).toHaveLength(6);
    const staff = idOf(done.state, "143048");
    expect(done.state.cards[staff]?.host).toBe(idOf(done.state, "143047"));
    expect(done.state.pendingAttack).toBeNull();
    // The next draw is heard.
    expect(rest(draw(done.state, made.ctx, 0, 1, false), made.ctx).pendingAttack?.enemyId).toBe(idOf(done.state, "143047"));
  });

  it("143080:A:1 discards down to 6 cards in each hand that holds more", () => {
    const made = at({ staging: ["143047"], setAside: ["143048"], deckOf: FILLERS, hand: FILLERS.slice(0, 3), seats: 2 });
    const done = resolveRecords(made.state, made.ctx, "143080", "whenRevealed", idOf(made.state, "143080"));
    expect(done.state.seats.map((seat) => seat.hand.length)).toEqual([6, 6]);
  });
});

describe("143059:A:1 Open Pit hears only a draw a player card's effect makes", () => {
  it("raises the drawing player's threat by 2 for a player card's draw, and not for another draw", () => {
    const made = at({ staging: ["143059"], deckOf: FILLERS, threat: [20, 20] });
    expect(draw(made.state, made.ctx, 0, 1, false).seats[0]?.threat).toBe(20);
    expect(rest(draw(made.state, made.ctx, 0, 1, false), made.ctx).seats[0]?.threat).toBe(20);
    expect(rest(draw(made.state, made.ctx, 0, 1, true), made.ctx).seats[0]?.threat).toBe(22);
  });

  it("is announced only in a game that has a card that hears it", () => {
    const made = tableFromLayout(ID, { stage: "143080", deckOf: FILLERS, phase: "Quest" });
    const bare = { ...made.state, cards: Object.fromEntries(Object.entries(made.state.cards).filter(([, card]) => !["143048", "143059"].includes(card.code))) };
    expect(draw(bare, made.ctx, 0, 1, true).pendingEvents ?? []).toEqual([]);
  });
});

describe("143055:A:1 Ring-wall of Isengard hears a heal", () => {
  it("makes the character's controller discard a card of their choice", () => {
    const made = at({ staging: ["143055"], hand: ["filler", "filler"] });
    const hurt = updateCard(made.state, made.hero, { damage: 2 });
    const healed = runInstruction(hurt, { verb: "Heal", amount: 1, target: "self" }, { seat: 0, sourceId: made.hero }, made.ctx, []);
    expect(healed.cards[made.hero]?.damage).toBe(1);
    const done = finish({ state: rest(healed, made.ctx), steps: [] }, made.ctx);
    expect(done.state.seats[0]?.hand).toHaveLength(1);
  });

  it("is not heard when no damage is healed", () => {
    const made = at({ staging: ["143055"], hand: ["filler", "filler"] });
    const healed = runInstruction(made.state, { verb: "Heal", amount: 1, target: "self" }, { seat: 0, sourceId: made.hero }, made.ctx, []);
    expect(rest(healed, made.ctx).seats[0]?.hand).toHaveLength(2);
  });
});

describe("143068:A:2 Saruman's Voice", () => {
  const voiced = (layout: Layout = {}) => {
    const made = at({ stage: "143079", hand: ["filler", "filler", "filler"], committed: ["dh1"], ...layout });
    return { made, done: resolveRecords(made.state, made.ctx, "143068", "whenRevealed") };
  };

  it("removes a committed hero from the quest and attaches to it", () => {
    const { made, done } = voiced();
    expect(done.state.cards[done.id]?.host).toBe(made.hero);
    expect(done.state.cards[made.hero]?.committed).toBe(false);
  });

  it("attaches to nothing when no hero is committed", () => {
    const { done } = voiced({ committed: [] });
    expect(done.state.cards[done.id]?.host ?? null).toBeNull();
  });

  it("makes its hero's controller discard a card when the hero commits, is declared an attacker or defender, or triggers its ability", () => {
    const { made, done } = voiced();
    const hero = made.hero;
    const heard = (event: Parameters<typeof queueEvent>[1]) => finish({ state: rest(queueEvent(done.state, event), made.ctx), steps: [] }, made.ctx).state.seats[0]?.hand.length;
    expect(heard({ trigger: "committed", seat: 0, cardId: hero })).toBe(2);
    expect(heard({ trigger: "declaredAttacker", seat: 0, cardId: hero })).toBe(2);
    expect(heard({ trigger: "declaredDefender", seat: 0, cardId: hero })).toBe(2);
    expect(heard({ trigger: "abilityTriggered", seat: 0, cardId: hero })).toBe(2);
    // Another hero's ability is not its hero's.
    expect(heard({ trigger: "abilityTriggered", seat: 0, cardId: made.hero2 })).toBe(3);
  });

  it("announces an ability when an Action, a Response or a Forced effect triggers, only in a game that has a card that hears it", () => {
    const { made, done } = voiced();
    expect((announceAbility(done.state, made.hero, 0, made.ctx).pendingEvents ?? []).map((event) => event.trigger)).toContain("abilityTriggered");
    const bare = at({ stage: "143079" });
    expect(announceAbility(bare.state, bare.hero, 0, bare.ctx)).toBe(bare.state);
  });
});

describe("143080:B:3 a player with 0 cards in hand is eliminated", () => {
  it("is checked at each settle: the player with no cards leaves, the one with cards stays", () => {
    const made = at({ seats: 2, hand: [{ code: "filler", seat: 0 }] });
    const done = rest(made.state, made.ctx);
    expect(done.seats.map((seat) => seat.eliminated)).toEqual([false, true]);
    expect(done.lost).toBe(false);
  });

  it("loses the game when every player is out", () => {
    const made = at({ seats: 2 });
    expect(rest(made.state, made.ctx).lost).toBe(true);
  });

  it("waits for the effect that emptied the hand to finish", () => {
    const made = at({ hand: ["filler"] });
    const effect: Effect = { id: "t:action:1", cardCode: "filler", lines: ["filler:A:1"], timing: "action", instructions: [{ verb: "DiscardFromHand", amount: 1 }, { verb: "Pick", pick: { type: "hero", control: "you" } }] };
    const pushed = pushCardEffects(made.state, "forced", made.hero, 0, false, [effect], made.ctx, []);
    const mid = settle({ ...pushed, window: null, mode: "stopped" }, made.ctx, []);
    expect(mid.stack.length).toBeGreaterThan(0);
    expect(mid.seats[0]?.eliminated).toBe(false);
    expect(finish({ state: mid, steps: [] }, made.ctx).state.seats[0]?.eliminated).toBe(true);
  });

  it("holds on stage 3B only: stage 2B eliminates nobody", () => {
    const made = at({ stage: "143079", seats: 2 });
    expect(rest(made.state, made.ctx).seats.map((seat) => seat.eliminated)).toEqual([false, false]);
  });
});

describe("143078:B:1 stage 1B", () => {
  const rouse = (layout: Layout = {}) => at({ stage: "143078", deckOf: FILLERS, hand: ["filler"], ...layout });

  it("bars gaining resources, the resource phase's collection included", () => {
    const made = rouse();
    const held = gainSeatResources(made.state, 0, [], UNATTRIBUTED);
    expect(held.cards[made.hero]?.resources).toBe(0);
    const open = at({ stage: "143079", deckOf: FILLERS });
    expect(gainSeatResources(open.state, 0, [], UNATTRIBUTED).cards[open.hero]?.resources).toBe(1);
  });

  it("bars drawing and commitment: no Commit is offered", () => {
    const made = rouse();
    expect(draw(made.state, made.ctx, 0, 1, false).seats[0]?.hand).toHaveLength(1);
    expect(legalTargets(made.state, { type: "Commit" }, made.ctx)).toEqual([]);
    const open = at({ stage: "143079", deckOf: FILLERS });
    expect(legalTargets(open.state, { type: "Commit" }, open.ctx).length).toBeGreaterThan(0);
  });
});
