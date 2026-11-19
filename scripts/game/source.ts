// The game `pnpm game` reads: a save fixture by name (src/campaign/fixtures/registry.ts) or a scenario's golden (`<scenario-id>/<golden name or number>`,
// test/harness/golden-registry.ts). Either is an opening state, the intents that follow it and the context they are reduced in, so one replay serves both.
// A fixture opens on the dealt table (its seat's Keep is its first intent); a golden opens on the started scenario, its Keep first, then the intents its
// golden.json pins. Node reads the fixtures' JSON only with scripts/game/json-imports.ts loaded first (`--import`, scripts/cli.ts). Getting a golden's start plays the golden once (the registry has no other way to build it), which also gives `played` for `pnpm game diff`.
import { readFileSync } from "node:fs";
import path from "node:path";

import { fixtureKindOf, fixtureSave, fixtureStandalone, FIXTURE_NAMES, hasFixture, isFixtureName, type FixtureName } from "../../src/campaign/fixtures.ts";
import { resume } from "../../src/campaign/session.ts";
import { resumeStandalone } from "../../src/campaign/standalone.ts";
import { CATALOG_VERSION } from "../../src/catalog/version.ts";
import { startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { worldFor, worldForStandalone } from "../../test/harness/fixture-world.ts";
import { cardSmokeSource, encounterSource } from "./smoke-source.ts";
import { GOLDEN_REGISTRY, type GoldenGame } from "../../test/harness/golden-registry.ts";

const SCENARIOS = path.resolve(import.meta.dirname, "..", "..", "src", "campaign", "scenarios");

export type GameSource = {
  /** What the source is, for the report's first line. */
  label: string;
  ctx: ReduceContext;
  opening: ScenarioState;
  intents: readonly PlayerIntent[];
  /** A golden only: the game the auto-player plays now, and the final state golden.json pins. */
  played?: GoldenGame;
  pinned?: ScenarioState;
};

type Pinned = { name: string; intents: PlayerIntent[]; state: ScenarioState };

function fixtureSource(name: FixtureName): GameSource {
  if (!hasFixture(name)) throw new Error(`fixture ${name} is not committed (open in docs/phases/STATUS.md)`);
  if (fixtureKindOf(name) === "standalone") {
    const game = fixtureStandalone(name, `standalone-${name}`, CATALOG_VERSION);
    const world = worldForStandalone(name);
    const intents = game.active?.intents ?? [];
    const opened = resumeStandalone({ ...game, active: game.active && { ...game.active, intents: [], checks: undefined } }, world);
    if (!opened.ok) throw new Error(`fixture ${name} does not deal: ${opened.reason}`);
    return { label: `fixture ${name} (${game.scenarioId}, standalone)`, ctx: { effects: world.effects, cards: world.cards }, opening: opened.state, intents };
  }
  const save = fixtureSave(name, `save-${name}`, CATALOG_VERSION);
  const world = worldFor(name);
  const intents = save.active?.intents ?? [];
  const opened = resume({ ...save, active: save.active && { ...save.active, intents: [], checks: undefined } }, world);
  if (!opened.ok) throw new Error(`fixture ${name} does not deal: ${opened.reason}`);
  return { label: `fixture ${name} (${world.scenario.id}, ${save.seatCount} seat${save.seatCount === 1 ? "" : "s"})`, ctx: { effects: world.effects, cards: world.cards }, opening: opened.state, intents };
}

async function goldenSource(scenarioId: string, which: string): Promise<GameSource> {
  const entry = GOLDEN_REGISTRY.find((item) => item.scenarioId === scenarioId);
  if (!entry) throw new Error(`no goldens for ${scenarioId}; \`pnpm game list\` lists them`);
  const index = /^\d+$/.test(which) ? Number(which) - 1 : entry.goldens.findIndex((golden) => golden.name === which);
  const golden = entry.goldens[index];
  if (!golden) throw new Error(`${scenarioId} has no golden ${which}: ${entry.goldens.map((item, at) => `${at + 1} "${item.name}"`).join(", ")}`);
  const pinned = (JSON.parse(readFileSync(path.join(SCENARIOS, scenarioId, "golden.json"), "utf8")) as Pinned[]).find((item) => item.name === golden.name);
  const { ctx } = await entry.world(golden.decks);
  const played = entry.play(golden, ctx);
  // The first seat's Keep opens the game and is not among a golden's intents (test/harness/game-kit.ts, playToEnd).
  const intents: PlayerIntent[] = [{ type: "Keep" }, ...(pinned?.intents ?? played.intents)];
  return { label: `golden ${scenarioId} ${index + 1} "${golden.name}"${pinned ? "" : " (not in golden.json: the game played now)"}`, ctx, opening: startScenario(played.start, ctx), intents, played, pinned: pinned?.state };
}

/**
 * The game a source names: a fixture name, `<scenario-id>/<golden name or 1-based number>`, or a smoke run (`encounter:<scenario-id>:<game>`,
 * `smoke:<code>[:<seed>[:<deal>]]`, scripts/game/smoke-source.ts).
 */
export async function loadSource(name: string): Promise<GameSource> {
  if (isFixtureName(name)) return fixtureSource(name);
  const [kind, first = "", second, third] = name.split(":");
  if (kind === "encounter" && first) return encounterSource(first, second ?? "0");
  if (kind === "smoke" && first) return cardSmokeSource(first, second, third);
  const slash = name.indexOf("/");
  if (slash > 0) return goldenSource(name.slice(0, slash), name.slice(slash + 1));
  throw new Error(`${name} is not a fixture, <scenario-id>/<golden>, encounter:<scenario-id>:<game> or smoke:<code>; \`pnpm game list\` lists the fixtures and goldens`);
}

/** Every source `loadSource` reads, one per line: the committed fixtures, then each scenario's goldens by number and name. */
export function listSources(): string[] {
  const fixtures = FIXTURE_NAMES.filter(hasFixture).map((name) => `${name}  (fixture, ${fixtureKindOf(name)})`);
  const goldens = GOLDEN_REGISTRY.flatMap((entry) => entry.goldens.map((golden, at) => `${entry.scenarioId}/${at + 1}  "${golden.name}"`));
  return [...fixtures, ...goldens];
}
