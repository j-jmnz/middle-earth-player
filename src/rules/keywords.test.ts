import { describe, expect, it } from "vitest";

import { cardMap, fixtureDefinition, hero } from "./fixture.ts";
import { defeatedDestination, placeDamage, raiseThreat } from "./keywords.ts";
import { definePrinted } from "./printed.ts";
import { blankScenario, updateCard } from "./state.ts";
import { spawn } from "./zones.ts";

describe("keywords", () => {
  it("removes a permanent attachment when its hero leaves play and will not discard it sooner", () => {
    const cards = cardMap([
      hero("aragorn", "leadership", 10, 1),
      definePrinted({ code: "ring", name: "Burden", type: "attachment", keywords: { permanent: true }, leavesPlayLoses: false }),
    ]);
    let state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    const heroSpawn = spawn(state, "aragorn", { zone: "heroes", seat: 0 });
    state = updateCard(heroSpawn.state, heroSpawn.id, { damage: 0 });
    const ring = spawn(state, "ring", { zone: "play", seat: 0 });
    state = updateCard(ring.state, ring.id, { host: heroSpawn.id });
    state = updateCard(state, heroSpawn.id, { attachments: [ring.id] });
    const printed = cards.get("aragorn");
    if (!printed) throw new Error("missing hero");
    const kept = placeDamage(
      state,
      ring.id,
      1,
      cardMap([printed, definePrinted({ code: "ring", name: "Burden", type: "attachment", health: 1, keywords: { permanent: true } })]),
      [],
      "framework",
    );
    expect(kept.cards[ring.id]?.zone).toBe("play");
    const fallen = placeDamage(
      state,
      heroSpawn.id,
      5,
      cardMap([definePrinted({ ...hero("aragorn", "leadership"), health: 5 }), cards.get("ring")!]),
      [],
      "framework",
    );
    expect(fallen.cards[heroSpawn.id]?.zone).toBe("discard");
    expect(fallen.cards[ring.id]?.zone).toBe("removed");
  });

  it("lets a framework attack damage an immune enemy", () => {
    const immune = definePrinted({
      code: "door",
      name: "Door",
      type: "enemy",
      health: 5,
      keywords: { immuneToPlayerCardEffects: true },
    });
    let state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    const spawned = spawn(state, "door", { zone: "engaged", seat: 0 });
    state = spawned.state;
    const cards = cardMap([immune]);
    const blocked = placeDamage(state, spawned.id, 2, cards, [], "player");
    expect(blocked).toBe(state);
    const hit = placeDamage(state, spawned.id, 2, cards, [], "framework");
    expect(hit.cards[spawned.id]?.damage).toBe(2);
    expect(hit.cards[spawned.id]?.zone).toBe("engaged");
  });

  it("loses when a card with leavesPlayLoses leaves play, and at threat 50", () => {
    const ring = definePrinted({
      code: "ring",
      name: "The One Ring",
      type: "attachment",
      health: 1,
      leavesPlayLoses: true,
    });
    let state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    const spawned = spawn(state, "ring", { zone: "play", seat: 0 });
    state = spawned.state;
    const lost = placeDamage(state, spawned.id, 1, cardMap([ring, hero("aragorn", "leadership")]), [], "framework");
    expect(lost.lost).toBe(true);
    expect(lost.lossReason).toContain("The One Ring");

    let threatened = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    threatened = spawn(threatened, "aragorn", { zone: "heroes", seat: 0 }).state;
    const eliminated = raiseThreat(threatened, 0, 50, []);
    expect(eliminated.seats[0].eliminated).toBe(true);
    expect(eliminated.lost).toBe(true);
  });

  it("sends a defeated treasure with printed health to its controller's discard", () => {
    const elf = definePrinted({ code: "elf", name: "Elf Lord", type: "treasure", attack: 2, defense: 2, health: 3 });
    const relic = definePrinted({ code: "relic", name: "Relic", type: "treasure" });
    const cards = cardMap([elf, relic]);
    let state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    const spawned = spawn(state, "elf", { zone: "play", seat: 0 });
    state = spawned.state;
    const instance = state.cards[spawned.id];
    if (!instance) throw new Error("missing card");
    expect(defeatedDestination(instance, elf)).toEqual({ zone: "discard", seat: 0 });
    expect(defeatedDestination(instance, relic)).toEqual({ zone: "encounterDiscard" });
    const fallen = placeDamage(state, spawned.id, 3, cards, [], "framework");
    expect(fallen.cards[spawned.id]?.zone).toBe("discard");
    expect(fallen.seats[0]?.discard).toContain(spawned.id);
  });
});
