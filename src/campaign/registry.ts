import { aShadowOfThePast } from "./fellowship/a-shadow-of-the-past.ts";
import type { ScenarioScript } from "./script.ts";

const scripts = new Map<string, ScenarioScript>();

export function register(script: ScenarioScript): void {
  if (scripts.has(script.id)) throw new Error(`Scenario script ${script.id} is already registered`);
  scripts.set(script.id, script);
}

export function scriptFor(id: string): ScenarioScript {
  const script = scripts.get(id);
  if (!script) throw new Error(`No scenario script for ${id}`);
  return script;
}

register(aShadowOfThePast);
