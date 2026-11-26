// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages, hrd.orcs-area (data/rules/entries.json). What the table reads of a quest area (docs/design-system-table.md, Cards, "The Stormcaller's area"): which cards make its group,
// where each stands, and the numbers the reader labels say. The Stormcaller's area is read here; a game with the Orcs' area of Race Across Harad is handed to orcs-table.ts, and `areaKind` says which area the game has: its
// words are the one record of words/scenarios/area-words.ts. Pure. A game with no area has no group and no role.
import { membersStanding } from "../../rules/core/area-members.ts";
import { areaOf } from "../../rules/families/stormcaller/zone.ts";
import { stageNumber } from "../../rules/families/caves/progress.ts";
import { areaPlace, atStormcallersStage, stormcallerLastStage } from "../../rules/families/stormcaller/values.ts";
import type { CardInstance, ScenarioState } from "../../rules/core/state.ts";

import { areaWordsOf } from "../words/scenarios/area-words.ts";
import type { AreaKind, StageFacts } from "../words/scenarios/stormcaller.ts";
import { orcsFacts, orcsGroup, orcsRoleOf } from "./orcs-table.ts";

/** Where a card of the area's group stands: the Stormcaller's current quest stage, a card of the area while the players are at another stage (`apart`: in the area zone, veiled), or a card of the area
 * at the players' stage (`together`: it counts as a staging card, in place). */
export type AreaRole = "stage" | "apart" | "together";

/** Which area the game has: the one key every site reads (`areaFacts(game)?.who` says the same for a game whose stage card is in play). Null with no area. */
export function areaKind(game: Pick<ScenarioState, "sea" | "orcs">): AreaKind | null {
  return areaOf(game) ? "stormcaller" : game.orcs ? "orcs" : null;
}

/** The ids of the area's group, in the order the staging row draws them: the Stormcaller's current stage, then the cards of the area (the Stormcaller first) wherever they stand, in the area zone or in the
 * staging area. Empty in a game with no area. */
export function areaGroup(game: Pick<ScenarioState, "sea" | "orcs" | "cards">): readonly string[] {
  const area = areaOf(game);
  if (!area) return orcsGroup(game);
  if (!game.cards[area.stage]) return NO_IDS;
  return [area.stage, ...membersStanding(game, area.members, "stormcallerArea").filter((id) => id !== area.stage)];
}

/** The role of a card in the area's group, or null for any other card. A card's place is stormcaller/values.ts's areaPlace; the stage is always the group's head. */
export function areaRoleOf(game: Pick<ScenarioState, "sea" | "orcs" | "cards">, id: string): AreaRole | null {
  const area = areaOf(game);
  if (!area) return orcsRoleOf(game, id);
  if (!game.cards[id]) return null;
  return id === area.stage ? "stage" : areaPlace(game, id);
}

/** Everything the area's reader labels say, from the state: the stage and its number of the last, whether the players are at its stage and which stage they are at, and the cards of the area in order. Null in a game
 * with no area. */
export type AreaFacts = { who: AreaKind; stageId: string; number: number; last: number; playersAt: number; together: boolean; members: readonly string[] };

export function areaFacts(game: ScenarioState): AreaFacts | null {
  const area = areaOf(game);
  if (!area) return orcsFacts(game);
  if (!game.cards[area.stage]) return null;
  return { who: "stormcaller", stageId: area.stage, number: area.number, last: stormcallerLastStage(game), playersAt: stageNumber(game), together: atStormcallersStage(game), members: areaGroup(game).slice(1) };
}

/** The numbers of the Stormcaller's current stage for its labels and preview: `points` are the stage's quest points. Null in a game with no area. */
export function stageFactsOf(game: ScenarioState, points: number | null): StageFacts | null {
  const facts = areaFacts(game);
  const stage = facts ? game.cards[facts.stageId] : undefined;
  return facts && stage ? { who: facts.who, number: facts.number, last: facts.last, progress: stage.progress, points, playersAt: facts.playersAt, together: facts.together } : null;
}

/** What a screen reader hears of a card of the area's group (the stage or a card of the area), or null for any other card. `points` are the stage's quest points; `nameOf` names a card as it lies. */
export function areaSpeech(game: ScenarioState, id: string, nameOf: (card: CardInstance) => string, points: number | null): string | null {
  const facts = areaFacts(game);
  const card = game.cards[id];
  const role = areaRoleOf(game, id);
  if (!facts || !card || !role) return null;
  const words = areaWordsOf(facts.who);
  if (role !== "stage") return words.memberSpeech(nameOf(card), role);
  const names = facts.members.flatMap((member) => (game.cards[member] ? [nameOf(game.cards[member])] : []));
  const numbers = stageFactsOf(game, points);
  return numbers ? words.stageSpeech({ ...numbers, name: nameOf(card), names }) : null;
}

const NO_IDS: readonly string[] = [];
