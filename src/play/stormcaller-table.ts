// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages (data/rules/entries.json). What the table reads of the Stormcaller's area (docs/design-system-table.md, Cards, "The Stormcaller's area"): which cards
// make its group, where each stands, and the numbers the reader labels say. Pure; the words are in stormcaller-words.ts. A game with no Stormcaller's area has no group and no role.
import { areaOf } from "../rules/families/stormcaller/zone.ts";
import { stageNumber } from "../rules/families/caves/progress.ts";
import { areaPlace, atStormcallersStage, stormcallerLastStage } from "../rules/families/stormcaller/values.ts";
import type { CardInstance, ScenarioState } from "../rules/state.ts";

import { memberSpeech, stageSpeech, type StageFacts } from "./stormcaller-words.ts";

/** Where a card of the area's group stands: the Stormcaller's current quest stage, a card of the area while the players are at another stage (`apart`: in the area zone, veiled), or a card of the area
 * at the players' stage (`together`: it counts as a staging card, in place). */
export type AreaRole = "stage" | "apart" | "together";

/** The ids of the area's group, in the order the staging row draws them: the Stormcaller's current stage, then the cards of the area (the Stormcaller first) wherever they stand, in the area zone or in the
 * staging area. Empty in a game with no area. */
export function areaGroup(game: Pick<ScenarioState, "sea" | "cards">): readonly string[] {
  const area = areaOf(game);
  if (!area || !game.cards[area.stage]) return NO_IDS;
  return [area.stage, ...area.members.filter((id) => id !== area.stage && (game.cards[id]?.zone === "stormcallerArea" || game.cards[id]?.zone === "staging"))];
}

/** The role of a card in the area's group, or null for any other card. A card's place is stormcaller/values.ts's areaPlace; the stage is always the group's head. */
export function areaRoleOf(game: Pick<ScenarioState, "sea" | "cards">, id: string): AreaRole | null {
  const area = areaOf(game);
  if (!area || !game.cards[id]) return null;
  return id === area.stage ? "stage" : areaPlace(game, id);
}

/** Everything the area's reader labels say, from the state: the stage and its number of the last, whether the players are at its stage and which stage they are at, and the cards of the area in order. Null in a game
 * with no area. */
export type AreaFacts = { stageId: string; number: number; last: number; playersAt: number; together: boolean; members: readonly string[] };

export function areaFacts(game: ScenarioState): AreaFacts | null {
  const area = areaOf(game);
  if (!area || !game.cards[area.stage]) return null;
  return { stageId: area.stage, number: area.number, last: stormcallerLastStage(game), playersAt: stageNumber(game), together: atStormcallersStage(game), members: areaGroup(game).slice(1) };
}

/** The numbers of the Stormcaller's current stage for its labels and preview: `points` are the stage's quest points. Null in a game with no area. */
export function stageFactsOf(game: ScenarioState, points: number | null): StageFacts | null {
  const facts = areaFacts(game);
  const stage = facts ? game.cards[facts.stageId] : undefined;
  return facts && stage ? { number: facts.number, last: facts.last, progress: stage.progress, points, playersAt: facts.playersAt, together: facts.together } : null;
}

/** What a screen reader hears of a card of the area's group (the stage or a card of the area), or null for any other card. `points` are the stage's quest points; `nameOf` names a card as it lies. */
export function areaSpeech(game: ScenarioState, id: string, nameOf: (card: CardInstance) => string, points: number | null): string | null {
  const facts = areaFacts(game);
  const card = game.cards[id];
  const role = areaRoleOf(game, id);
  if (!facts || !card || !role) return null;
  if (role !== "stage") return memberSpeech(nameOf(card), role);
  const names = facts.members.flatMap((member) => (game.cards[member] ? [nameOf(game.cards[member])] : []));
  const numbers = stageFactsOf(game, points);
  return numbers ? stageSpeech({ ...numbers, name: nameOf(card), names }) : null;
}

const NO_IDS: readonly string[] = [];
