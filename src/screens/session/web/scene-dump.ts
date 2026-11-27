// E2E ONLY, web only. A scene is a table built from a test layout (test/harness/layout.ts, `tableFromLayout`) and shown read-only for a screenshot: `pnpm browser shot --scene` and
// `--moment` (docs/development.md, Checking a screen in a browser). A scene state cannot be reached by replaying a save, so the script builds it in Node and hands the page this dump as
// `globalThis.__E2E_SCENE__` (a Playwright init script), and the standalone table route opens it as the game `standalone-e2e-scene` (standalone-session.canvaskit.ts). The dump is JSON: the
// state the way a checkpoint holds it, the printed cards of the table (the kit's stand-in heroes are in no catalog) and the records the kit added to the authored ones. Nothing is written.
import type { Effect } from "../../../catalog/boundary";
import type { World } from "../../../campaign/world";
import { contextOf } from "../../../campaign/session";
import type { StandaloneGame } from "../../../campaign/standalone";
import { EFFECTS } from "../../../effects";
import type { ScenarioState } from "../../../play/store/store";
import { campaignOfScenario, scenarioOf } from "../../data/campaign-data";
import type { CardFacts, ReplayedGame } from "../open-game";

type PrintedCard = World["cards"] extends ReadonlyMap<string, infer Card> ? Card : never;

export type SceneDump = {
  scenarioId: string;
  state: ScenarioState;
  cards: [string, PrintedCard][];
  /** The records of the table that the authored ones (`EFFECTS`) do not hold: the do-nothing Action of the filler event. */
  extraEffects: Effect[];
};

/** The id of the standalone game a scene opens as: `/standalone/table/standalone-e2e-scene`. */
export const SCENE_GAME = "standalone-e2e-scene";

/** What the page reads: the dump the script set, or null (a page nothing set it on). */
export function sceneOfWindow(): SceneDump | null {
  const held = (globalThis as { __E2E_SCENE__?: SceneDump }).__E2E_SCENE__;
  return held && typeof held.scenarioId === "string" ? held : null;
}

/** The game a scene holds: no loadout and no open scenario, so nothing of it can be written or replayed. */
export type SceneSession = { ok: true; stored: StandaloneGame; stamp: null } & ReplayedGame;

/** The table's world and context from a dump, or null when the scenario or its campaign is not in this build. `factsOf` reads the catalog rows of the real cards. */
export function openScene(dump: SceneDump, factsOf: (codes: Iterable<string>) => ReadonlyMap<string, CardFacts>): SceneSession | null {
  const campaign = campaignOfScenario(dump.scenarioId);
  const scenario = scenarioOf(dump.scenarioId);
  if (!campaign || !scenario) return null;
  const world: World = { campaign, scenario, effects: [...EFFECTS, ...dump.extraEffects], cards: new Map(dump.cards), sets: new Map() };
  const stored: StandaloneGame = { id: SCENE_GAME, campaignId: campaign.id, scenarioId: dump.scenarioId, seatCount: dump.state.seatCount, loadout: null, active: null, result: null };
  return { ok: true, stored, stamp: null, world, ctx: contextOf(world), game: dump.state, roundSteps: [], history: [], destroyedHeroes: new Set(), facts: factsOf(world.cards.keys()) };
}
