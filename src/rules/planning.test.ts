import { describe, expect, it } from "vitest";

import { cardMap, expectOk, fixtureDefinition, hero } from "./fixture.ts";
import { legalIntents, legalTargets, reduce } from "./reduce.ts";
import { definePrinted } from "./printed.ts";
import { blankScenario, updateCard, withThreat, type ScenarioState } from "./state.ts";
import { spawn } from "./zones.ts";

const leadership = hero("aragorn", "leadership");
const ally = definePrinted({ code: "ally", name: "Faramir", type: "ally", sphere: "leadership", cost: 2, willpower: 2 });
const spirit = definePrinted({ code: "spirit", name: "Unexpected", type: "event", sphere: "spirit", cost: 2 });
const neutral = definePrinted({ code: "neutral", name: "Gandalf", type: "ally", sphere: "neutral", cost: 2 });
const unique = definePrinted({
  code: "unique",
  name: "Faramir",
  type: "ally",
  sphere: "leadership",
  cost: 2,
  isUnique: true,
});

function planning(cardCode: string, resources = 5): { state: ScenarioState; heroId: string; cardId: string } {
  let state = blankScenario({ seatCount: 1, seed: 3, definition: fixtureDefinition(["stage"]) });
  const heroSpawn = spawn(state, "aragorn", { zone: "heroes", seat: 0 });
  state = updateCard(heroSpawn.state, heroSpawn.id, { resources });
  const cardSpawn = spawn(state, cardCode, { zone: "hand", seat: 0 });
  state = {
    ...cardSpawn.state,
    phase: "Planning",
    mode: "planning",
    window: { kind: "pass" },
    activeSeat: 0,
  };
  return { state, heroId: heroSpawn.id, cardId: cardSpawn.id };
}

const cards = cardMap([leadership, ally, spirit, neutral, unique]);
const ctx = { effects: [], cards };

describe("planning costs", () => {
  it("removes exactly the printed cost", () => {
    const { state, heroId, cardId } = planning("ally");
    const played = expectOk(reduce(state, { type: "PlayCard", cardId, payments: [{ heroId, amount: 2 }] }, ctx));
    expect(played.state.cards[heroId]?.resources).toBe(3);
    expect(played.state.cards[cardId]?.zone).toBe("play");
    expect(played.state.cards[cardId]?.exhausted).toBe(false);
    expect(played.state.seats[0].hand).not.toContain(cardId);
  });

  it("rejects the wrong sphere, overpay, and underpay without changing state", () => {
    const wrong = planning("spirit");
    const wrongResult = reduce(wrong.state, {
      type: "PlayCard",
      cardId: wrong.cardId,
      payments: [{ heroId: wrong.heroId, amount: 2 }],
    }, ctx);
    expect(wrongResult.ok).toBe(false);
    if (!wrongResult.ok) {
      expect(wrongResult.reason).toBe("Wrong sphere");
      expect(wrongResult.state).toBe(wrong.state);
    }

    const over = planning("ally");
    const overResult = reduce(over.state, {
      type: "PlayCard",
      cardId: over.cardId,
      payments: [{ heroId: over.heroId, amount: 3 }],
    }, ctx);
    expect(overResult.ok).toBe(false);
    if (!overResult.ok) {
      expect(overResult.reason).toBe("Overpay");
      expect(overResult.state).toBe(over.state);
    }

    const under = planning("ally");
    const underResult = reduce(under.state, {
      type: "PlayCard",
      cardId: under.cardId,
      payments: [{ heroId: under.heroId, amount: 1 }],
    }, ctx);
    expect(underResult.ok).toBe(false);
    if (!underResult.ok) {
      expect(underResult.reason).toBe("Underpay");
      expect(underResult.state).toBe(under.state);
    }
  });

  it("lets any sphere pay a neutral card and discards an event", () => {
    const { state, heroId, cardId } = planning("neutral");
    const played = expectOk(reduce(state, { type: "PlayCard", cardId, payments: [{ heroId, amount: 2 }] }, ctx));
    expect(played.state.cards[cardId]?.zone).toBe("play");

    const event = planning("spirit");
    const spiritHero = hero("eowyn", "spirit");
    const spiritCards = cardMap([spiritHero, spirit]);
    let spiritState = event.state;
    spiritState = updateCard(spiritState, event.heroId, { code: "eowyn" });
    const paid = expectOk(
      reduce(spiritState, { type: "PlayCard", cardId: event.cardId, payments: [{ heroId: event.heroId, amount: 2 }] }, {
        effects: [],
        cards: spiritCards,
      }),
    );
    expect(paid.state.cards[event.cardId]?.zone).toBe("discard");
    expect(paid.state.cards[event.heroId]?.resources).toBe(3);
  });

  it("rejects a second unique title and does not list a host cross product", () => {
    const first = planning("unique");
    const played = expectOk(
      reduce(first.state, { type: "PlayCard", cardId: first.cardId, payments: [{ heroId: first.heroId, amount: 2 }] }, ctx),
    );
    const secondSpawn = spawn(played.state, "unique", { zone: "hand", seat: 0 });
    const blocked = reduce(secondSpawn.state, {
      type: "PlayCard",
      cardId: secondSpawn.id,
      payments: [{ heroId: first.heroId, amount: 2 }],
    }, ctx);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.state).toBe(secondSpawn.state);
    const intents = legalIntents(first.state, ctx);
    expect(intents).toContainEqual({ type: "PlayCard", cardId: first.cardId });
    expect(legalTargets(first.state, { type: "PlayCard", cardId: first.cardId }, ctx)).toEqual([]);
  });

  it("does not let a player-card effect damage an immune enemy", () => {
    const bolt = definePrinted({ code: "bolt", name: "Bolt", type: "event", sphere: "neutral", cost: 0 });
    const immune = definePrinted({
      code: "orc",
      name: "Orc",
      type: "enemy",
      health: 5,
      engagementCost: 50,
      keywords: { immuneToPlayerCardEffects: true },
    });
    const open = definePrinted({ code: "warg", name: "Warg", type: "enemy", health: 5, engagementCost: 50 });
    const local = cardMap([leadership, bolt, immune, open]);
    const built = planning("bolt", 0);
    const orc = spawn(built.state, "orc", { zone: "engaged", seat: 0 });
    const warg = spawn(orc.state, "warg", { zone: "engaged", seat: 0 });
    const played = expectOk(reduce(warg.state, { type: "PlayCard", cardId: built.cardId, payments: [] }, {
      effects: [{ cardCode: "bolt", timing: "action", instructions: [{ verb: "DealDamage" }] }],
      cards: local,
    }));
    expect(played.state.cards[orc.id]?.damage).toBe(0);
    expect(played.state.cards[warg.id]?.damage).toBe(1);
    expect(played.state.cards[built.cardId]?.damage).toBe(0);
  });

  it("does not let a player card choose an immune character as a host", () => {
    const mount = definePrinted({
      code: "mount",
      name: "Mount",
      type: "attachment",
      sphere: "leadership",
      cost: 1,
    });
    const immuneHero = definePrinted({
      ...leadership,
      keywords: { immuneToPlayerCardEffects: true },
    });
    const guard = definePrinted({
      code: "guard",
      name: "Guard",
      type: "ally",
      sphere: "leadership",
      cost: 1,
      willpower: 1,
      health: 2,
    });
    const built = planning("mount");
    const spawned = spawn(built.state, "guard", { zone: "play", seat: 0 });
    const ready = updateCard(spawned.state, spawned.id, { exhausted: false });
    const local = { effects: [], cards: cardMap([immuneHero, mount, guard]) };
    expect(legalTargets(ready, { type: "PlayCard", cardId: built.cardId }, local)).toEqual([spawned.id]);
    const refused = reduce(ready, {
      type: "PlayCard",
      cardId: built.cardId,
      hostId: built.heroId,
      payments: [{ heroId: built.heroId, amount: 1 }],
    }, local);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.reason).toBe("Immune to player card effects");
      expect(refused.state).toBe(ready);
    }
    expect(ready.cards[built.cardId]?.zone).toBe("hand");
  });

  it("moves planning to the next living seat when a played event eliminates the active seat", () => {
    const bolt = definePrinted({ code: "bolt", name: "Bolt", type: "event", sphere: "neutral", cost: 0 });
    const second = definePrinted({ code: "second", name: "Second", type: "ally", sphere: "leadership", cost: 0 });
    const cards = cardMap([hero("aragorn", "leadership"), hero("gimli", "tactics"), bolt, second]);
    const effects = [{ cardCode: "bolt", timing: "action" as const, instructions: [{ verb: "RaiseThreat" as const }] }];
    let state = blankScenario({ seatCount: 2, seed: 9, definition: fixtureDefinition(["stage"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    state = spawn(state, "gimli", { zone: "heroes", seat: 1 }).state;
    const event = spawn(state, "bolt", { zone: "hand", seat: 0 });
    state = event.state;
    const allyCard = spawn(state, "second", { zone: "hand", seat: 0 });
    state = withThreat(allyCard.state, 0, 49);
    state = withThreat(state, 1, 10);
    state = { ...state, phase: "Planning", mode: "planning", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0 };
    const local = { effects, cards };
    const played = expectOk(reduce(state, { type: "PlayCard", cardId: event.id, payments: [] }, local));
    expect(played.state.seats[0]?.eliminated).toBe(true);
    expect(played.state.seats[1]?.eliminated).toBe(false);
    expect(played.state.lost).toBe(false);
    expect(played.state.mode).toBe("planning");
    expect(played.state.window?.kind).toBe("pass");
    expect(played.state.activeSeat).toBe(1);
    expect(played.state.cards[event.id]?.zone).toBe("discard");
    expect(played.state.cards[allyCard.id]?.zone).toBe("hand");
    expect(legalIntents(played.state, local).some((intent) => intent.type === "PlayCard")).toBe(false);
    const stuck = { ...played.state, activeSeat: 0 };
    expect(legalIntents(stuck, local)).toEqual([]);
    const again = reduce(stuck, { type: "PlayCard", cardId: allyCard.id, payments: [] }, local);
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.reason).toBe("That seat is eliminated");
      expect(again.state).toBe(stuck);
      expect(again.state.cards[allyCard.id]?.zone).toBe("hand");
    }
  });

  it("closes the planning window when the last seat is eliminated", () => {
    const bolt = definePrinted({ code: "bolt", name: "Bolt", type: "event", sphere: "neutral", cost: 0 });
    const second = definePrinted({ code: "second", name: "Second", type: "ally", sphere: "leadership", cost: 0 });
    const cards = cardMap([leadership, bolt, second]);
    const effects = [{ cardCode: "bolt", timing: "action" as const, instructions: [{ verb: "RaiseThreat" as const }] }];
    const built = planning("bolt", 0);
    const allyCard = spawn(built.state, "second", { zone: "hand", seat: 0 });
    const threatened = withThreat(allyCard.state, 0, 49);
    const local = { effects, cards };
    const played = expectOk(reduce(threatened, { type: "PlayCard", cardId: built.cardId, payments: [] }, local));
    expect(played.state.seats[0]?.eliminated).toBe(true);
    expect(played.state.lost).toBe(true);
    expect(played.state.window).toBeNull();
    expect(played.state.cards[allyCard.id]?.zone).toBe("hand");
    expect(legalIntents(played.state, local)).toEqual([]);
    const again = reduce(played.state, { type: "PlayCard", cardId: allyCard.id, payments: [] }, local);
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.reason).toBe("The game is lost");
      expect(again.state).toBe(played.state);
    }
  });
});
