// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages (data/rules/entries.json). What the table reads of the Stormcaller's area (docs/design-system-table.md, Cards, "The Stormcaller's area"): which cards
// make its group, where each stands, and the numbers the reader labels say. Pure; the words are in stormcaller-words.ts. A game with no Stormcaller's area has no group and no role.
import { areaOf } from "../rules/families/stormcaller-zone.ts";
import { atStormcallersStage } from "../rules/families/stormcaller-values.ts";
import type { CardInstance, ScenarioState } from "../rules/state.ts";

import { memberSpeech, stageSpeech } from "./stormcaller-words.ts";

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

/** The role of a card in the area's group, or null for any other card. */
export function areaRoleOf(game: Pick<ScenarioState, "sea" | "cards">, id: string): AreaRole | null {
  const area = areaOf(game);
  const card = game.cards[id];
  if (!area || !card) return null;
  if (id === area.stage) return "stage";
  if (!area.members.includes(id)) return null;
  return card.zone === "stormcallerArea" ? "apart" : card.zone === "staging" ? "together" : null;
}

/** Everything the area's reader labels say, from the state: the stage and its number, whether the players are at its stage, and the cards of the area in order. Null in a game with no area. */
export type AreaFacts = { stageId: string; number: number; together: boolean; members: readonly string[] };

export function areaFacts(game: ScenarioState): AreaFacts | null {
  const area = areaOf(game);
  if (!area || !game.cards[area.stage]) return null;
  return { stageId: area.stage, number: area.number, together: atStormcallersStage(game), members: areaGroup(game).slice(1) };
}

/** What a screen reader hears of a card of the area's group (the stage or a card of the area), or null for any other card. `points` are the stage's quest points; `nameOf` names a card as it lies. */
export function areaSpeech(game: ScenarioState, id: string, nameOf: (card: CardInstance) => string, points: number | null): string | null {
  const facts = areaFacts(game);
  const card = game.cards[id];
  const role = areaRoleOf(game, id);
  if (!facts || !card || !role) return null;
  if (role !== "stage") return memberSpeech(nameOf(card), role);
  const names = facts.members.flatMap((member) => (game.cards[member] ? [nameOf(game.cards[member])] : []));
  return stageSpeech({ name: nameOf(card), number: facts.number, progress: card.progress, points, together: facts.together, names });
}

const NO_IDS: readonly string[] = [];
