import type { ScenarioDefinition } from "../catalog/boundary.ts";
import type { ScenarioFixture } from "../catalog/scenario-fixture.ts";
import type { StartScenario, StartSeat } from "../rules/setup.ts";

export type ScriptInput = {
  fixture: ScenarioFixture;
  definition: ScenarioDefinition;
  seatCount: 1 | 2;
  seed: number;
  threatModifier: number;
  seats: readonly StartSeat[];
};

export type ScenarioScript = {
  id: string;
  start(input: ScriptInput): StartScenario;
};
