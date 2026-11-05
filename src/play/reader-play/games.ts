// The seeded games the reader parity test plays (src/play/reader-play.test.ts): A Shadow of the Past with a starter deck, played by the
// auto-player with card play on, and any other scenario through its golden games (test/harness/golden-registry.ts), whose pinned intents are
// the driver. A new scenario keeps parity by being in the golden registry; `pnpm test:scenario <id>` plays its games.
import { expectOk } from "../../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../../rules/engine/reduce.ts";

import { nextIntent } from "../../../test/harness/auto-player.ts";
import { GOLDEN_REGISTRY } from "../../../test/harness/golden-registry.ts";
import { RING_BEARER, starterStart, starterWorld, STARTER_SEEDS } from "../../../test/scenarios/a-shadow-of-the-past/game.ts";

import type { Reached } from "./reach.ts";
import type { ReaderGame } from "./run.ts";

export const FIRST_SCENARIO = "a-shadow-of-the-past";
// The scenarios the test plays by default: the first one (a starter deck, real cards), a sea one (Sailing), an Island Map one and a Wilderland one.
export const DEFAULT_SCENARIOS: readonly string[] = [FIRST_SCENARIO, "voyage-across-belegaer", "temple-of-the-deceived", "journey-up-the-anduin"];

// The most states one game is checked for: a few rounds, quick enough for a few seconds a game.
const LIMIT = 400;

/** True when the scenario has games to play: the first scenario, or one the golden registry lists. */
export function hasReaderGames(scenarioId: string): boolean {
  return scenarioId === FIRST_SCENARIO || GOLDEN_REGISTRY.some((entry) => entry.scenarioId === scenarioId);
}

// A small seeded generator (mulberry32), so a game picks the same elements on every run.
function dice(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

// The intents a reader picks for itself when the dice say so: a card played, a trigger used, a choice made, an enemy engaged or a location travelled to.
// Never a Pass, a Keep or a commit (they would only stall or end a game early).
const PICKED = new Set(["PlayCard", "Trigger", "Choose", "Travel", "Engage", "ChooseEnemy", "DeclareDefender", "DeclareAttackers"]);
const CHANCE = 0.4;

function seededPick(seed: number): ReaderGame["pick"] {
  const roll = dice(seed);
  return (reached: readonly Reached[]) => {
    const concrete = reached.filter((entry) => entry.family == null && PICKED.has(entry.intent.type));
    const chance = roll();
    const at = Math.floor(roll() * concrete.length);
    return concrete.length > 0 && chance < CHANCE ? (concrete[at] ?? null) : null;
  };
}

// The starter decks' games: the auto-player plays them (card play and Actions on), and the dice send some of the intents a reader can reach instead.
// Seed 34 of Stealth and Steadfastness lasts longest (scripts/card-smoke/world.ts).
const FIRST_GAMES: readonly { deck: string; seed: number }[] = [
  { deck: "stealth-and-steadfastness", seed: 34 },
  { deck: "wisdom-and-wizardry", seed: STARTER_SEEDS[2] ?? 9 },
  { deck: "wisdom-and-wizardry", seed: STARTER_SEEDS[0] ?? 1 },
];

async function firstScenario(): Promise<ReaderGame[]> {
  const games: ReaderGame[] = [];
  for (const { deck, seed } of FIRST_GAMES) {
    const { ctx } = await starterWorld(deck);
    const memory = new Set<string>();
    const scout = deck === "wisdom-and-wizardry" ? "01002" : "141003";
    games.push({
      scenario: FIRST_SCENARIO,
      name: `${deck}, seed ${seed}`,
      ctx,
      start: starterStart(deck, seed),
      next: (state) => nextIntent(state, ctx, { scout, prefer: "141035", protect: RING_BEARER, play: true, act: true }, memory),
      pick: seededPick(seed),
      limit: LIMIT,
    });
  }
  return games;
}

async function goldenGames(scenarioId: string): Promise<ReaderGame[]> {
  const entry = GOLDEN_REGISTRY.find((one) => one.scenarioId === scenarioId);
  if (!entry) throw new Error(`${scenarioId} is not in the golden registry (test/harness/golden-registry.ts)`);
  const golden = entry.goldens[0];
  if (!golden) throw new Error(`${scenarioId} has no golden game`);
  const { ctx } = await entry.world(golden.decks);
  const played = entry.play(golden, ctx);
  // The first seat's Keep is not among the golden's intents (playToEnd); the games' later intents follow it.
  const kept = expectOk(reduce(startScenario(played.start, ctx), { type: "Keep" }, ctx));
  void kept;
  return [{ scenario: scenarioId, name: golden.name, ctx, start: played.start, next: (_state, step) => (step === 0 ? { type: "Keep" } : (played.intents[step - 1] ?? null)), limit: LIMIT }];
}

/** The games to play for a scenario. */
export async function readerGames(scenarioId: string): Promise<ReaderGame[]> {
  return scenarioId === FIRST_SCENARIO ? firstScenario() : goldenGames(scenarioId);
}
