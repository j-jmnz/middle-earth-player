// Rules: rr.step-6-4-2, rr.shadow-effects, ltp.undefended-attack, rr.attacks-outside-the-combat-phase, rr.exhausted, rr.engaged (data/rules/entries.json).
// The Shadow lines of the Journey Along the Anduin encounter cards, played through a real attack (scripts/anduin-scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { legalIntents } from "../rules/legal.ts";
import type { PlayerIntent } from "../rules/reduce.ts";
import { causeProblems } from "../../scripts/cause-check.ts";
import { fight, loadAnduinWorld, type AnduinWorld } from "../../scripts/anduin-scene.ts";
import { codesOf, first, send } from "../../scripts/past-scene.ts";

let world: AnduinWorld;

beforeAll(async () => {
  world = await loadAnduinWorld();
});

describe("Shadow effects", () => {
  it("Wolf Rider attacks the defending player once the attack it was dealt to has ended, is dealt a shadow card of its own, and returns to the top of the encounter deck (01081:A:2)", () => {
    const { run, ctx, hero } = fight(world, "01081", "grunt", { deck: ["01081", "f0", "f0", "f0", "f0"] }, { undefended: true });
    // The grunt's attack is over (1 damage on the first hero); Wolf Rider (Attack 2) now attacks the same player, engaged with them.
    const rider = first(run.state, "01081");
    expect(run.state.cards[hero]?.damage).toBe(1);
    expect(run.state.pendingAttack?.enemyId).toBe(rider);
    expect(run.state.cards[rider]?.zone).toBe("engaged");
    expect(run.state.cards[rider]?.controller).toBe(0);
    // It was dealt its own shadow card, and the defending player may declare a defender.
    expect(run.state.cards[rider]?.shadowId).not.toBeNull();
    expect(legalIntents(run.state, ctx).map((intent) => intent.type)).toEqual(["DeclareDefender", "Undefended"]);
    let after = send(run, { type: "DeclareDefender", defenderId: hero } as PlayerIntent, ctx);
    for (let guard = 0; guard < 20 && after.state.pendingAttack != null; guard += 1) after = send(after, { type: "Pass" }, ctx);
    // Defended by a hero with Defense 2 against Attack 2: no damage; the card is on top of the encounter deck, face down.
    expect(after.state.cards[hero]?.damage).toBe(1);
    expect(after.state.cards[rider]?.zone).toBe("encounterDeck");
    expect(after.state.encounterDeck[0]).toBe(rider);
    expect(after.state.cards[rider]?.face).toBe("down");
    expect(causeProblems(after.steps)).toEqual([]);
  });

  it("Wargs gives the attacking enemy +1 Attack, +2 when undefended (01085:A:2)", () => {
    const defended = fight(world, "01085", "brute");
    expect(defended.run.state.cards[defended.hero]?.damage).toBe(8);
    const undefended = fight(world, "01085", "brute", {}, { undefended: true });
    expect(undefended.run.state.cards[undefended.hero]?.damage).toBe(11);
  });

  it("Despair sets the defending character's Defense to 0 for the attack (01086:A:2)", () => {
    const defended = fight(world, "01086", "brute");
    // The brute's 9 Attack against a Defense of 0 (the hero's own is 2): all 9 damage, and a hero with 6 hit points is destroyed.
    expect(defended.run.state.cards[defended.hero]?.damage).toBe(9);
    expect(defended.run.state.cards[defended.hero]?.zone).toBe("discard");
    const spared = fight(world, "01086", "grunt");
    // Attack 1 against Defense 0.
    expect(spared.run.state.cards[spared.hero]?.damage).toBe(1);
  });

  it("Misty Mountain Goblins remove 1 progress from the quest, 3 when the attack is undefended (01111:A:2)", () => {
    const defended = fight(world, "01111", "grunt", { progress: 5 });
    expect(defended.run.state.cards[defended.run.state.questStage ?? ""]?.progress).toBe(4);
    const undefended = fight(world, "01111", "grunt", { progress: 5 }, { undefended: true });
    expect(undefended.run.state.cards[undefended.run.state.questStage ?? ""]?.progress).toBe(2);
  });

  it("Massing at Night deals the attacker a shadow card for each player (01112:A:2)", () => {
    for (const seats of [1, 2] as const) {
      const made = fight(world, "01112", "grunt", { seats, deck: ["01112", "f0", "f0", "f0", "f0", "f0"] });
      const grunt = first(made.run.state, "grunt");
      // Every shadow card is discarded at the end of the combat phase; the steps say how many were dealt.
      const dealt = made.seen.concat(made.run.state).flatMap((state) => [state.cards[grunt]?.shadowId, ...(state.cards[grunt]?.extraShadowIds ?? [])]).filter((id) => id != null);
      expect(new Set(dealt).size, `${seats} seats`).toBe(1 + seats);
    }
  });

  it("Eastern Crows give the attacking enemy +1 Attack, +2 when the defending player's threat is 35 or higher (01115:A:3)", () => {
    const low = fight(world, "01115", "brute", { threat: [30, 26] });
    expect(low.run.state.cards[low.hero]?.damage).toBe(8);
    const high = fight(world, "01115", "brute", { threat: [36, 26] });
    expect(high.run.state.cards[high.hero]?.damage).toBe(9);
  });

  it("Pursued by Shadow returns an exhausted ally to its owner's hand, or raises threat by 3 without one (01117:A:2)", () => {
    const none = fight(world, "01117", "grunt", {}, { undefended: true });
    expect(none.run.state.seats[0].threat).toBe(31);
    const tired = fight(world, "01117", "grunt", { allies: ["ally"], tired: true }, { undefended: true });
    expect(tired.run.state.seats[0].threat).toBe(28);
    expect(codesOf(tired.run.state, tired.run.state.seats[0].hand)).toContain("ally");
    expect(Object.values(tired.run.state.cards).find((card) => card.code === "ally")?.zone).toBe("hand");
  });
});
