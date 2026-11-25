import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { Layout } from "./layout.ts";

// Test helper. The named table moments of a scenario for the screen review (`pnpm browser shot --moment <scenario-id>[/<name>]`): `test/scenarios/<id>/screens.ts` exports `screens`, a list of
// these. `layout` is the kit's `Layout` (`tableFromLayout`), the same JSON `pnpm game scene` takes; `note` says which printed line or widget the moment shows, so the review knows what to look for.
export type ScreenMoment = { name: string; layout: Layout; note: string };

const SCENARIOS = path.resolve(import.meta.dirname, "..", "scenarios");

/** The moments a scenario committed, or none when it has no `screens.ts`. */
export async function screensOf(scenarioId: string, root: string = SCENARIOS): Promise<ScreenMoment[]> {
  const file = path.join(root, scenarioId, "screens.ts");
  if (!existsSync(file)) return [];
  const loaded = (await import(pathToFileURL(file).href)) as { screens?: readonly ScreenMoment[] };
  return [...(loaded.screens ?? [])];
}

/** The ids of the scenarios that have a `screens.ts`. */
export function scenariosWithScreens(): string[] {
  return readdirSync(SCENARIOS, { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(path.join(SCENARIOS, entry.name, "screens.ts"))).map((entry) => entry.name).sort();
}
