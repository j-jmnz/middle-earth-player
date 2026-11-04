import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { definePrinted } from "../rules/core/printed.ts";
import { reduce } from "../rules/engine/reduce.ts";
import { startScenario } from "../rules/setup/setup.ts";
import { ENGINE_VERSION } from "../rules/engine/version.ts";
import { playOut } from "../../test/harness/auto-player.ts";
import { GOLDEN_REGISTRY } from "../../test/harness/golden-registry.ts";
import { campaign, loadWorld, scenario } from "../../test/scenarios/a-shadow-of-the-past/scene.ts";
import { playStarter, starterWorld } from "../../test/scenarios/a-shadow-of-the-past/game.ts";

import { buildStart } from "./start.ts";
import { beginActive, recordIntent, replay } from "./replay.ts";

const RING_BEARER = "141001";
const HASH = 7;

async function game(seed: number) {
  const world = await loadWorld();
  const cards = new Map(world.cards);
  for (const code of ["scout", "q1", "q2"]) {
    cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 8, willpower: code === "scout" ? 12 : 8, attack: 1, defense: 2, health: 100 }));
  }
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  const ctx = { effects: EFFECTS, cards };
  const loadout = { heroes: [RING_BEARER, "scout", "q1", "q2"], deck: Array.from({ length: 30 }, () => "filler") };
  const start = buildStart({ campaign, scenario, seatCount: 1, seed, threatModifier: 0, seats: [loadout], effects: EFFECTS });
  return { start, ctx };
}

describe("saves.activeScenario replay", () => {
  it.each([1, 2, 9])("replays the golden game of seed %i to the same final state", async (seed) => {
    const { start, ctx } = await game(seed);
    const kept = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx)).state;
    const played = playOut(kept, ctx, { scout: "scout", prefer: "141035", protect: RING_BEARER });
    let active = beginActive(start, HASH);
    for (const intent of [{ type: "Keep" } as const, ...played.intents]) active = recordIntent(active, intent);
    const replayed = replay(JSON.parse(JSON.stringify(active)), start, HASH, ctx);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(played.state);
  });

  it.each(campaign.starterDecks.map((deck) => deck.id))("replays a starter-deck game (%s) to the same final state", async (deckId) => {
    const { ctx } = await starterWorld(deckId);
    const { start, run } = playStarter(deckId, 1, ctx);
    let active = beginActive(start, HASH);
    for (const intent of [{ type: "Keep" } as const, ...run.intents]) active = recordIntent(active, intent);
    const replayed = replay(JSON.parse(JSON.stringify(active)), start, HASH, ctx);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(run.state);
  });

  // Every other scenario's goldens (test/harness/golden-registry.ts).
  const GOLDEN_CASES = GOLDEN_REGISTRY.flatMap((entry) => entry.goldens.map((golden) => ({ title: entry.title, name: golden.name, entry })));

  it.each(GOLDEN_CASES)("replays the $title golden game ($name) to the same final state", async ({ name, entry }) => {
    const golden = entry.goldens.find((item) => item.name === name);
    if (!golden) throw new Error(name);
    const { ctx } = await entry.world(golden.decks);
    const game = entry.play(golden, ctx);
    let active = beginActive(game.start, HASH);
    for (const intent of [{ type: "Keep" } as const, ...game.intents]) active = recordIntent(active, intent);
    const replayed = replay(JSON.parse(JSON.stringify(active)), game.start, HASH, ctx);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(game.state);
  }, 60_000);

  it("drops a save from another engine version, another data hash, another seed, or a refused intent", async () => {
    const { start, ctx } = await game(1);
    const active = recordIntent(beginActive(start, HASH), { type: "Keep" });
    expect(replay(active, start, HASH, ctx).ok).toBe(true);
    expect(replay({ ...active, engineVersion: ENGINE_VERSION + 1 }, start, HASH, ctx)).toEqual({ ok: false, reason: "engineVersion" });
    expect(replay(active, start, HASH + 1, ctx)).toEqual({ ok: false, reason: "dataHash" });
    expect(replay({ ...active, seed: 2 }, start, HASH, ctx)).toEqual({ ok: false, reason: "seed" });
    expect(replay(recordIntent(active, { type: "Keep" }), start, HASH, ctx)).toEqual({ ok: false, reason: "intent" });
  });
});
