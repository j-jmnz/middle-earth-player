// Test helper shared by the table fixtures (sea-fixture.ts, wilderland-fixture.ts): the views the canvas draws for one seat of a fixture. No number in it is the table's.
import type { ScenarioState } from "../../rules/core/state.ts";

import type { LayoutViews, PileViews } from "../layout/layout.ts";
import { PILES, pileSelector, secondPilesOf, TABLE_ZONES, zoneSelector, type ZoneFacts } from "./selectors.ts";

/** The views the canvas draws for one seat of a fixture: every zone, the four piles and the second slot's piles when the game has them. */
export function fixtureViews(fixture: { state: ScenarioState; facts: ZoneFacts }, seat = 0): { views: LayoutViews; piles: PileViews } {
  const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, seat, fixture.facts)(fixture.state)])) as unknown as LayoutViews;
  const piles = Object.fromEntries([...PILES, ...secondPilesOf(fixture.state)].map((pile) => [pile, pileSelector(pile, seat)(fixture.state)])) as unknown as PileViews;
  return { views, piles };
}
