// The scenes of `pnpm browser shot --scene` and `--moment`: a layout built in Node into the dump the page opens (src/screens/session/web/scene-dump.ts). The same builder as `pnpm game scene`
// (scripts/game/scene-source.ts, `tableFromLayout`), so a moment shows the table `pnpm game scene` prints as text.
import { EFFECTS } from "../../src/effects/index.ts";
import type { SceneDump } from "../../src/screens/session/web/scene-dump.ts";
import { screensOf } from "../../test/harness/screens.ts";
import type { Layout } from "../../test/harness/layout.ts";
import { sceneTable } from "../game/scene-source.ts";

/** What a shot opens: a name for its PNG, the dump the page reads, and, for a committed moment, its note. */
export type SceneShot = { name: string; dump: SceneDump; note?: string };

/** The dump of a layout. The state is JSON, as a checkpoint holds it. */
export function sceneDump(scenarioId: string, layout: Layout): SceneDump {
  const table = sceneTable(scenarioId, layout);
  const own = new Set<unknown>(EFFECTS);
  return {
    scenarioId,
    state: JSON.parse(JSON.stringify(table.state)),
    cards: [...table.ctx.cards].map(([code, card]) => [code, JSON.parse(JSON.stringify(card))]),
    extraEffects: table.ctx.effects.filter((effect) => !own.has(effect)).map((effect) => JSON.parse(JSON.stringify(effect))),
  };
}

/** The moments `--moment <scenario-id>[/<name>]` names: one, or all of the scenario's. */
export async function momentShots(spec: string): Promise<SceneShot[]> {
  const [scenarioId = "", name] = spec.split("/");
  const all = await screensOf(scenarioId);
  if (all.length === 0) throw new Error(`test/scenarios/${scenarioId}/screens.ts holds no moment (--moment <scenario-id>[/<name>])`);
  const picked = name === undefined ? all : all.filter((moment) => moment.name === name);
  if (picked.length === 0) throw new Error(`${scenarioId} has no moment ${name}; it has: ${all.map((moment) => moment.name).join(", ")}`);
  return picked.map((moment) => ({ name: `${scenarioId}-${moment.name}`, dump: sceneDump(scenarioId, moment.layout), note: moment.note }));
}
