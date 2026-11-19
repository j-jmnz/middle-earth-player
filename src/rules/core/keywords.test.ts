import { describe, expect, it } from "vitest";

import { cardMap, fixtureDefinition, hero } from "./test-fixture.ts";
import { ruleCause } from "./cause.ts";
import { defeatedDestination, destroyOverwhelmed, placeDamage, raiseThreat } from "./keywords.ts";
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
      ruleCause("rr.effects"),
    );
    expect(kept.cards[ring.id]?.zone).toBe("play");
    const fallen = placeDamage(
      state,
      heroSpawn.id,
      5,
      cardMap([definePrinted({ ...hero("aragorn", "leadership"), health: 5 }), cards.get("ring")!]),
      [],
      "framework",
      ruleCause("rr.effects"),
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
    const blocked = placeDamage(state, spawned.id, 2, cards, [], "player", ruleCause("rr.effects"));
    expect(blocked).toBe(state);
    const hit = placeDamage(state, spawned.id, 2, cards, [], "framework", ruleCause("rr.effects"));
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
    const lost = placeDamage(state, spawned.id, 1, cardMap([ring, hero("aragorn", "leadership")]), [], "framework", ruleCause("rr.effects"));
    expect(lost.lost).toBe(true);
    expect(lost.lossReason).toContain("The One Ring");

    let threatened = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    threatened = spawn(threatened, "aragorn", { zone: "heroes", seat: 0 }).state;
    const eliminated = raiseThreat(threatened, 0, 50, [], ruleCause("rr.effects"));
    expect(eliminated.seats[0].eliminated).toBe(true);
    expect(eliminated.lost).toBe(true);
  });

  it("sends a defeated treasure, a player card, to its controller's discard (rr.discard-pile-and-victory-display)", () => {
    const elf = definePrinted({ code: "elf", name: "Elf Lord", type: "treasure", attack: 2, defense: 2, health: 3 });
    const relic = definePrinted({ code: "relic", name: "Relic", type: "treasure" });
    const cards = cardMap([elf, relic]);
    let state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    const spawned = spawn(state, "elf", { zone: "play", seat: 0 });
    state = spawned.state;
    const instance = state.cards[spawned.id];
    if (!instance) throw new Error("missing card");
    expect(defeatedDestination(instance, elf, state)).toEqual({ zone: "discard", seat: 0 });
    expect(defeatedDestination(instance, relic, state)).toEqual({ zone: "discard", seat: 0 });
    const fallen = placeDamage(state, spawned.id, 3, cards, [], "framework", ruleCause("rr.effects"));
    expect(fallen.cards[spawned.id]?.zone).toBe("discard");
    expect(fallen.seats[0]?.discard).toContain(spawned.id);
  });

  it("announces an enemy the sweep destroys because its damage reached its hit points, and the attachments it holds hear it (rr.hit-points, rr.destroy)", () => {
    const enemy = definePrinted({ code: "orc", name: "Orc", type: "enemy", health: 3 });
    const curse = definePrinted({ code: "curse", name: "Curse", type: "attachment" });
    const cards = cardMap([enemy, curse]);
    let state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    const spawned = spawn(state, "orc", { zone: "engaged", seat: 0 });
    const attached = spawn(spawned.state, "curse", { zone: "play", seat: 0 });
    state = updateCard(attached.state, attached.id, { host: spawned.id });
    state = updateCard(state, spawned.id, { attachments: [attached.id], damage: 2 });
    // Damage short of its hit points: the sweep leaves it and says nothing.
    expect(destroyOverwhelmed(state, cards, [])).toBe(state);
    const swept = destroyOverwhelmed(updateCard(state, spawned.id, { damage: 3 }), cards, []);
    expect(swept.cards[spawned.id]?.zone).toBe("encounterDiscard");
    expect(swept.pendingEvents?.filter((event) => event.trigger !== "leftPlay").map((event) => [event.trigger, event.subject ?? event.other])).toEqual([
      ["hostDefeated", spawned.id],
      ["enemyDestroyed", spawned.id],
    ]);
  });
});
