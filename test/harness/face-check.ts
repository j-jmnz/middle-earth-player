import { isReanimatedCode } from "../../src/rules/core/printed.ts";
import type { ScenarioState } from "../../src/rules/core/state.ts";

// Test helper. An encounter card that is in the staging area, engaged with a player or the active location shows its face: the encounter deck deals
// facedown, and a card that leaves it for one of those places is turned faceup by the verb that moves it (rr.search, rr.running-out-of-cards; a When
// Revealed search once left a card facedown in the staging area after the discard pile was shuffled back in). `faceProblems` lists the cards that are
// not, so a whole game (game-kit.ts, `playToEnd`) can fail on the first intent that leaves one. The zones a card lies in facedown by design (under a
// location, captive, grappled, a shadow card, the prisoner, a Reanimated Dead: mec108.reanimated-dead) are not checked.
const SHOWN = new Set(["staging", "seatStaging", "engaged", "activeLocation", "secondActiveLocation"]);

export function faceProblems(state: ScenarioState): string[] {
  return Object.values(state.cards)
    .filter((card) => SHOWN.has(card.zone) && card.face === "down" && !isReanimatedCode(card.code))
    .map((card) => `${card.code} (${card.id}) lies facedown in ${card.zone}`);
}
