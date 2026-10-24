// Which card pictures the table asks the image queue for first: the shown seat's hand, the face-up staging cards, and the
// codes of the screen the player is about to open, which the caller passes (the table passes the resolution's cards once
// the scenario is won and the card the player picked up). Never the whole cache (docs/architecture.md, Images). Text is
// drawn while a file is still downloading.
import type { ScenarioState } from "../rules/state.ts";

function faceUp(game: ScenarioState, ids: readonly string[]): string[] {
  return ids.flatMap((id) => {
    const card = game.cards[id];
    return card && card.face !== "down" ? [card.code] : [];
  });
}

/** The codes whose files the table wants now: the seat's hand, staging, and `next` (the screen about to open). */
export function prefetchCodes(game: ScenarioState, seat: number, next: readonly string[] = []): string[] {
  const codes = [...faceUp(game, game.seats[seat]?.hand ?? []), ...faceUp(game, game.staging), ...next];
  return [...new Set(codes)];
}

/** The cards the resolution screen will show once the scenario is won: the codes its Resolution can earn. */
export function resolutionCodes(game: ScenarioState): string[] {
  if (!game.stageCleared) return [];
  return game.resolution.flatMap((instruction) => ("codes" in instruction && Array.isArray(instruction.codes) ? instruction.codes : []));
}
