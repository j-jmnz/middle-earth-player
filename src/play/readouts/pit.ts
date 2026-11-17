// Rules: dwd.cave-torch-the-long-dark, rr.forced, rr.removed-from-game (data/rules/entries.json); ledger line 901001:A:2.
//
// The piece Into the Pit's Nightmare setup card holds on the table: the damage its Forced effect puts on it each time a Cave Torch exhausts, against the 5 that remove the Torch from the game, as a top-bar dial. The limit is a loss the players feel, not the game's, so the ring warms toward it
// (a `warms` dial, as the pursuit dial does); one exhaust short it warns what the Torch's going takes from the table. Once the Torch is out of play the dial has no limit and says so. The engine decided every number (`damage` on the setup card, the cards in play); nothing here changes
// one. Empty in any other scenario and on Easy and Normal, where no setup card lies in the Nightmare zone. Pure, so a test reads it.
import { CAVE_TORCH, SETUP_CARD, TORCH_DAMAGE_LIMIT } from "../../effects/authored/nightmare/into-the-pit.ts";
import { inPlay, type CardInstance, type ScenarioState } from "../../rules/core/state.ts";

import { torchDialName, torchDialWords, torchLimitWords, torchNearWords } from "../words/scenarios/pit-table.ts";
import type { TableDial } from "./dials.ts";

/** The Nightmare setup card, when it lies in the Nightmare zone (a Nightmare game of Into the Pit). */
export const pitSetupCard = (game: ScenarioState): CardInstance | undefined => Object.values(game.cards).find((card) => card.code === SETUP_CARD && card.zone === "nightmare");

/** Whether a Cave Torch is in play: on a hero or loose, ready or exhausted. */
export const torchInPlay = (game: ScenarioState): boolean => Object.values(game.cards).some((card) => card.code === CAVE_TORCH && inPlay(card.zone));

/** The Torch dial: the damage on the setup card against 5. It warms toward the limit and warns at 4; with no Torch in play it has no limit and says the exhausts add no more. Empty without the setup card. */
export function pitDials(game: ScenarioState): readonly TableDial[] {
  const card = pitSetupCard(game);
  if (!card) return [];
  const gone = !torchInPlay(game);
  return [{
    id: "torch",
    testID: "pit-torch",
    label: "Torch",
    name: torchDialName(TORCH_DAMAGE_LIMIT, gone),
    value: card.damage,
    ...(gone ? {} : { limit: TORCH_DAMAGE_LIMIT, warms: true as const, limitWords: torchLimitWords(TORCH_DAMAGE_LIMIT) }),
    ...(!gone && card.damage >= TORCH_DAMAGE_LIMIT - 1 ? { warn: { level: "near" as const, words: torchNearWords() } } : {}),
    note: torchDialWords(card.damage, TORCH_DAMAGE_LIMIT, gone),
  }];
}
