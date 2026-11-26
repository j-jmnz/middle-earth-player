// Rules: hrd.orcs-area, hrd.orcs-area-different-stage, hrd.orcs-area-same-stage (data/rules/entries.json). What the table reads of the Orcs' area of Race Across Harad (docs/design-system-table.md, The Orcs' area):
// which cards make its group, where each stands. The group heads the staging row as the Stormcaller's area does and the layout is the same (stormcaller-layout.ts); stormcaller-table.ts hands a game with an Orcs'
// area to these. Pure; the words are in words/scenarios/haradrim/orcs-table.ts.
import { memberPlace, membersStanding } from "../../rules/core/area-members.ts";
import { orcsOf } from "../../rules/families/haradrim/orcs-zone.ts";
import { atOrcsStage } from "../../rules/families/haradrim/orcs-values.ts";
import { stageNumber } from "../../rules/families/caves/progress.ts";
import type { ScenarioState } from "../../rules/core/state.ts";

import type { AreaFacts, AreaRole } from "./stormcaller-table.ts";

const NO_IDS: readonly string[] = [];

/** The ids of the Orcs' group in staging order: the Orcs' current stage, then the cards of the area wherever they stand (the area zone or the staging area). Empty with no Orcs' area. */
export function orcsGroup(game: Pick<ScenarioState, "orcs" | "cards">): readonly string[] {
  const area = orcsOf(game);
  if (!area || !game.cards[area.stage]) return NO_IDS;
  return [area.stage, ...membersStanding(game, area.members, "orcsArea").filter((id) => id !== area.stage)];
}

/** The role of a card in the Orcs' group, or null for any other card. */
export function orcsRoleOf(game: Pick<ScenarioState, "orcs" | "cards">, id: string): AreaRole | null {
  const area = orcsOf(game);
  if (!area || !game.cards[id]) return null;
  return id === area.stage ? "stage" : memberPlace(game, area.members, "orcsArea", id);
}

/** The facts the Orcs' labels say. Null with no Orcs' area. */
export function orcsFacts(game: ScenarioState): AreaFacts | null {
  const area = orcsOf(game);
  if (!area || !game.cards[area.stage]) return null;
  return { who: "orcs", stageId: area.stage, number: area.number, last: area.number + area.deck.length, playersAt: stageNumber(game), together: atOrcsStage(game), members: orcsGroup(game).slice(1) };
}
