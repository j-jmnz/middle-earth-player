import { describe, expect, it } from "vitest";

import { EFFECTS } from "../src/effects/index.ts";
import { expectOk } from "../src/rules/fixture.ts";
import { definePrinted } from "../src/rules/printed.ts";
import { reduce, startScenario } from "../src/rules/reduce.ts";
import { scriptFor } from "../src/campaign/registry.ts";
import { playOut } from "./auto-player.ts";
import { fixture, loadWorld } from "./past-scene.ts";

// Temporary scaffolding for the data-store refactor (docs/plans/data-store-refactor.md, step 0).
const RING_BEARER = "141001";
const dir = new URL("./golden/", import.meta.url).pathname;

describe("refactor golden", () => {
  it("printed cards and scenario definition", async () => {
    const world = await loadWorld();
    const cards = [...world.cards].filter(([code]) => /^\d+$/.test(code)).sort(([a], [b]) => a.localeCompare(b));
    await expect(JSON.stringify(cards, null, 1)).toMatchFileSnapshot(`${dir}printed.json`);
    await expect(JSON.stringify(world.definition, null, 1)).toMatchFileSnapshot(`${dir}definition.json`);
  });

  it("full-game step log", async () => {
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
      const start = scriptFor("a-shadow-of-the-past").start({ fixture, definition: world.definition, seatCount: 1, seed, threatModifier: 0, seats: [loadout] });
      const kept = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx)).state;
      const run = playOut(kept, ctx, { scout: "scout", prefer: "141035", protect: RING_BEARER });
      out.push({ seed, intents: run.intents, state: run.state });
    }
    await expect(JSON.stringify(out)).toMatchFileSnapshot(`${dir}full-game.json`);
  });
});
