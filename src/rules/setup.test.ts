import { describe, expect, it } from "vitest";

import { byCode, cardMap, codes, expectOk, fixtureDefinition, hero } from "./fixture.ts";
import { definePrinted } from "./printed.ts";
import { legalIntents, reduce, startScenario } from "./reduce.ts";
import { spawn } from "./zones.ts";

const deckCodes = codes("d", 10);

function opening(difficulty?: "Easy" | "Normal") {
  const cards = cardMap([
    hero("aragorn", "leadership", 8, 2),
    hero("legolas", "tactics", 9, 1),
    hero("gimli", "spirit", 11, 1),
    definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 10 }),
    ...deckCodes.map((code) => definePrinted({ code, name: code, type: "event", sphere: "neutral", cost: 0 })),
  ]);
  const started = startScenario(
    {
      seatCount: 2,
      seed: 11,
      threatModifier: 1,
      definition: fixtureDefinition(["stage"]),
      seats: [
        { heroes: ["aragorn", "legolas"], deck: deckCodes },
        { heroes: ["gimli"], deck: deckCodes },
      ],
      encounterDeck: [],
      questDeck: ["stage"],
      ...(difficulty ? { difficulty } : {}),
    },
    { effects: [], cards },
  );
  return { started, cards };
}

function soloOpening() {
  const cards = cardMap([
    hero("aragorn", "leadership", 8, 2),
    definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 10 }),
    ...deckCodes.map((code) => definePrinted({ code, name: code, type: "event", sphere: "neutral", cost: 0 })),
  ]);
  const started = startScenario(
    {
      seatCount: 1,
      seed: 11,
      threatModifier: 1,
      definition: fixtureDefinition(["stage"]),
      seats: [{ heroes: ["aragorn"], deck: deckCodes }],
      encounterDeck: [],
      questDeck: ["stage"],
    },
    { effects: [], cards },
  );
  return { started, cards };
}

describe("Easy mode (easy-mode.easy-mode, ltp.easy-mode)", () => {
  it("adds one resource to each hero's resource pool in Setup step 2, before the first resource phase", () => {
    const easy = opening("Easy").started;
    const heroes = [...(easy.seats[0]?.heroes ?? []), ...(easy.seats[1]?.heroes ?? [])];
    expect(heroes).toHaveLength(3);
    for (const id of heroes) expect(easy.cards[id]?.resources, id).toBe(1);
    // Threat is still the heroes' threat cost plus the modifier: step 2 sets it, Easy does not change it.
    expect(easy.seats.map((seat) => seat.threat)).toEqual(opening().started.seats.map((seat) => seat.threat));
  });

  it("adds nothing on Normal", () => {
    for (const started of [opening("Normal").started, opening().started]) {
      for (const seat of started.seats) for (const id of seat.heroes) expect(started.cards[id]?.resources).toBe(0);
    }
  });
});

describe("setup and resources", () => {
  it("redraws six cards on one mulligan and rejects a second", () => {
    const { started, cards } = soloOpening();
    const ctx = { effects: [], cards };
    expect(started.seats[0].hand).toHaveLength(6);
    expect(legalIntents(started, ctx).map((intent) => intent.type)).toContain("Mulligan");

    const once = expectOk(reduce(started, { type: "Mulligan" }, ctx));
    const gainAt = once.steps.findIndex((step) => step.kind === "gainResource");
    const redraws = once.steps
      .slice(0, gainAt)
      .filter((step) => step.kind === "draw" && step.seat === 0);
    expect(redraws).toHaveLength(6);
    expect(once.state.seats[0].hand).toHaveLength(7);
    expect(once.state.mulliganTaken).toBe(true);
    expect(once.state.seedCursor).toBeGreaterThan(started.seedCursor);

    const twice = reduce(once.state, { type: "Mulligan" }, ctx);
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.state).toBe(once.state);
  });

  it("lets each seat mulligan for itself", () => {
    const { started, cards } = opening();
    const ctx = { effects: [], cards };
    const seat1Hand = started.seats[1].hand;
    const once = expectOk(reduce(started, { type: "Mulligan" }, ctx));
    expect(once.state.window?.kind).toBe("mulligan");
    expect(once.state.activeSeat).toBe(1);
    expect(once.state.seats[0].hand).toHaveLength(6);
    expect(once.state.seats[1].hand).toEqual(seat1Hand);
    expect(once.steps.filter((step) => step.kind === "draw")).toHaveLength(6);
    expect(legalIntents(once.state, ctx).map((intent) => intent.type)).toContain("Mulligan");

    const kept = expectOk(reduce(once.state, { type: "Keep" }, ctx));
    expect(kept.state.window?.kind).not.toBe("mulligan");
    expect(kept.state.seats[1].hand.slice(0, seat1Hand.length)).toEqual([...seat1Hand]);
    expect(kept.state.cards[byCode(kept.state, "gimli")[0] ?? ""]?.resources).toBe(1);
    const again = reduce(kept.state, { type: "Mulligan" }, ctx);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.state).toBe(kept.state);
  });

  it("gives each hero one resource and each seat one draw, in seat order", () => {
    const { started, cards } = opening();
    const ctx = { effects: [], cards };
    const top = [started.seats[0].deck[0], started.seats[1].deck[0]];
    const first = expectOk(reduce(started, { type: "Keep" }, ctx));
    expect(first.state.window?.kind).toBe("mulligan");
    expect(first.state.activeSeat).toBe(1);
    const kept = expectOk(reduce(first.state, { type: "Keep" }, ctx));
    const firstDraw = kept.steps.findIndex((step) => step.kind === "draw");
    expect(kept.steps.slice(0, firstDraw).every((step) => step.kind === "gainResource")).toBe(true);
    expect(kept.steps.filter((step) => step.kind === "draw").map((step) => step.kind === "draw" && step.seat)).toEqual([
      0, 1,
    ]);
    expect(kept.state.seats[0].hand.at(-1)).toBe(top[0]);
    expect(kept.state.seats[1].hand.at(-1)).toBe(top[1]);
    expect(kept.state.cards[byCode(kept.state, "aragorn")[0] ?? "" ]?.resources).toBe(1);
    expect(kept.state.cards[byCode(kept.state, "legolas")[0] ?? ""]?.resources).toBe(1);
    expect(kept.state.cards[byCode(kept.state, "gimli")[0] ?? ""]?.resources).toBe(1);
    expect(kept.state.seats[0].threat).toBe(8 + 9 + 1);
    expect(kept.state.cards[kept.state.questStage ?? ""]?.face).toBe("B");
    expect(kept.state.secondActiveLocation).toBeNull();

    const again = reduce(kept.state, { type: "GainResources", amount: 1 }, ctx);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.state).toBe(kept.state);
    const drawn = reduce(kept.state, { type: "Draw", amount: 1 }, ctx);
    expect(drawn.ok).toBe(false);
    if (!drawn.ok) expect(drawn.state).toBe(kept.state);
    expect(legalIntents(kept.state, ctx).some((intent) => (intent.type as string) === "Draw" || (intent.type as string) === "GainResources")).toBe(
      false,
    );
  });

  it("rejects an unimplemented setup instruction without changing state", () => {
    const cards = cardMap([
      hero("aragorn", "leadership", 8, 1),
      definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 8 }),
      ...deckCodes.map((code) => definePrinted({ code, name: code, type: "event", sphere: "neutral", cost: 0 })),
    ]);
    const definition = { ...fixtureDefinition(["stage"]), setup: [{ verb: "PlayAlly" as const }] };
    const ctx = { effects: [], cards };
    const started = startScenario(
      {
        seatCount: 1,
        seed: 4,
        threatModifier: 0,
        definition,
        seats: [{ heroes: ["aragorn"], deck: deckCodes }],
        encounterDeck: [],
        questDeck: ["stage"],
      },
      ctx,
    );
    const kept = reduce(started, { type: "Keep" }, ctx);
    expect(kept.ok).toBe(false);
    if (!kept.ok) {
      expect(kept.reason).toBe("Unimplemented instruction PlayAlly");
      expect(kept.state).toBe(started);
    }
  });

  it("refuses setup Travel when an active location is already in play", () => {
    const cards = cardMap([
      hero("aragorn", "leadership", 8, 1),
      definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 8 }),
      definePrinted({ code: "road", name: "Road", type: "location", questPoints: 3 }),
      definePrinted({ code: "ford", name: "Ford", type: "location", questPoints: 2 }),
      ...deckCodes.map((code) => definePrinted({ code, name: code, type: "event", sphere: "neutral", cost: 0 })),
    ]);
    const definition = { ...fixtureDefinition(["stage"]), setup: [{ verb: "Travel" as const }] };
    const ctx = { effects: [], cards };
    let started = startScenario(
      {
        seatCount: 1,
        seed: 4,
        threatModifier: 0,
        definition,
        seats: [{ heroes: ["aragorn"], deck: deckCodes }],
        encounterDeck: [],
        questDeck: ["stage"],
      },
      ctx,
    );
    started = spawn(started, "road", { zone: "activeLocation" }).state;
    started = spawn(started, "ford", { zone: "staging" }).state;
    const kept = reduce(started, { type: "Keep" }, ctx);
    expect(kept.ok).toBe(false);
    if (!kept.ok) {
      expect(kept.reason).toBe("Travel was refused");
      expect(kept.state).toBe(started);
      expect(kept.state.staging.map((id) => kept.state.cards[id]?.code)).toEqual(["ford"]);
      expect(kept.state.cards[kept.state.questStage ?? ""]?.face).toBe("A");
      expect(kept.state.cards[kept.state.activeLocation ?? ""]?.code).toBe("road");
    }
  });
});
