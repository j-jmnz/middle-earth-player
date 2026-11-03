import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { definePrinted } from "../rules/core/printed.ts";
import { reduce, startScenario } from "../rules/engine/reduce.ts";
import { playOut } from "../../test/harness/auto-player.ts";
import { campaign, loadWorld, scenario } from "../../test/scenarios/a-shadow-of-the-past/scene.ts";

import { buildStart } from "./start.ts";

// A permanent golden: the intents and the final state of A Shadow of the Past on seeds 1, 2 and 9. It pins the
// whole path from data/ through buildStart and the reducer, so a change to cards, piles, templates or the
// engine that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const RING_BEARER = "141001";
const file = new URL("./golden/a-shadow-of-the-past.json", import.meta.url).pathname;

describe("golden: a whole game of A Shadow of the Past", () => {
  it("plays the same intents to the same state on fixed seeds", async () => {
    const world = await loadWorld();
    const cards = new Map(world.cards);
    for (const code of ["scout", "q1", "q2"]) {
      cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 8, willpower: code === "scout" ? 12 : 8, attack: 1, defense: 2, health: 100 }));
    }
    cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
    const ctx = { effects: EFFECTS, cards };
    const loadout = { heroes: [RING_BEARER, "scout", "q1", "q2"], deck: Array.from({ length: 30 }, () => "filler") };
    const out: unknown[] = [];
    for (const seed of [1, 2, 9]) {
      const start = buildStart({ campaign, scenario, seatCount: 1, seed, threatModifier: 0, seats: [loadout], effects: EFFECTS });
      const kept = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx)).state;
      const run = playOut(kept, ctx, { scout: "scout", prefer: "141035", protect: RING_BEARER });
      out.push({ seed, intents: run.intents, state: run.state });
    }
    await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
  });
});
