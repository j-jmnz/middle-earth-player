import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { definePrinted } from "../rules/core/printed.ts";
import { reduce } from "../rules/engine/reduce.ts";
import { startScenario } from "../rules/setup/setup.ts";
import { ENGINE_VERSION } from "../rules/engine/version.ts";
import { playOut } from "../../scripts/auto-player.ts";
import { campaign, loadWorld, scenario } from "../../scripts/past-scene.ts";
import { playStarter, starterWorld } from "../../scripts/starter-game.ts";
import { KNIFE_GOLDENS, knifeWorld, playGolden } from "../../scripts/knife-game.ts";
import { FORD_GOLDENS, fordWorld, playGolden as playFordGolden } from "../../scripts/ford-game.ts";
import { SOUTH_GOLDENS, southWorld, playGolden as playSouthGolden } from "../../scripts/south-game.ts";
import { MORIA_GOLDENS, moriaWorld, playGolden as playMoriaGolden } from "../../scripts/moria-game.ts";
import { BREAKING_GOLDENS, breakingGameWorld, playGolden as playBreakingGolden } from "../../scripts/breaking-game.ts";

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

  it.each(KNIFE_GOLDENS.map((golden) => golden.name))("replays the A Knife in the Dark golden game (%s) to the same final state", async (name) => {
    const golden = KNIFE_GOLDENS.find((item) => item.name === name);
    if (!golden) throw new Error(name);
    const { ctx } = await knifeWorld();
    const game = playGolden(golden, ctx);
    let active = beginActive(game.start, HASH);
    for (const intent of [{ type: "Keep" } as const, ...game.intents]) active = recordIntent(active, intent);
    const replayed = replay(JSON.parse(JSON.stringify(active)), game.start, HASH, ctx);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(game.state);
  }, 60_000);

  it.each(FORD_GOLDENS.map((golden) => golden.name))("replays the Flight to the Ford golden game (%s) to the same final state", async (name) => {
    const golden = FORD_GOLDENS.find((item) => item.name === name);
    if (!golden) throw new Error(name);
    const { ctx } = await fordWorld(golden.decks);
    const game = playFordGolden(golden, ctx);
    let active = beginActive(game.start, HASH);
    for (const intent of [{ type: "Keep" } as const, ...game.intents]) active = recordIntent(active, intent);
    const replayed = replay(JSON.parse(JSON.stringify(active)), game.start, HASH, ctx);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(game.state);
  }, 60_000);

  it.each(SOUTH_GOLDENS.map((golden) => golden.name))("replays The Ring Goes South golden game (%s) to the same final state", async (name) => {
    const golden = SOUTH_GOLDENS.find((item) => item.name === name);
    if (!golden) throw new Error(name);
    const { ctx } = await southWorld(golden.decks);
    const game = playSouthGolden(golden, ctx);
    let active = beginActive(game.start, HASH);
    for (const intent of [{ type: "Keep" } as const, ...game.intents]) active = recordIntent(active, intent);
    const replayed = replay(JSON.parse(JSON.stringify(active)), game.start, HASH, ctx);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(game.state);
  }, 60_000);

  it.each(MORIA_GOLDENS.map((golden) => golden.name))("replays Journey in the Dark golden game (%s) to the same final state", async (name) => {
    const golden = MORIA_GOLDENS.find((item) => item.name === name);
    if (!golden) throw new Error(name);
    const { ctx } = await moriaWorld(golden.decks);
    const game = playMoriaGolden(golden, ctx);
    let active = beginActive(game.start, HASH);
    for (const intent of [{ type: "Keep" } as const, ...game.intents]) active = recordIntent(active, intent);
    const replayed = replay(JSON.parse(JSON.stringify(active)), game.start, HASH, ctx);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(game.state);
  }, 60_000);

  it.each(BREAKING_GOLDENS.map((golden) => golden.name))("replays Breaking of the Fellowship golden game (%s) to the same final state", async (name) => {
    const golden = BREAKING_GOLDENS.find((item) => item.name === name);
    if (!golden) throw new Error(name);
    const { ctx } = await breakingGameWorld(golden.decks);
    const game = playBreakingGolden(golden, ctx);
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
