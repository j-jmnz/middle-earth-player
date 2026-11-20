// Rules: rr.forced, rr.victory (data/rules/entries.json); ledger lines 50907:A:1, 50931:A:1, 50931:B:1, 50931:B:3 (docs/brief.md, Attack on Dol Guldur, The table).
//
// The piece Attack on Dol Guldur's cards hold on the table, as a top-bar dial: the city strength of Dol Guldur, the resource tokens on it (the Setup places 5 for each player and 5 more, the Siege values of what is destroyed or explored take them off at the end of a
// stage 3 round, and 0 ends the Lieutenants' Indestructible). The disc says the strength, with no ring: it counts down to the win, so only its warnings colour it. The note names this round's tally. It warns near at 5 or less and with a
// warm "critical" when the tally is as much as the strength left. The engine decided every number; nothing here changes one. A tap shows Dol Guldur, then the Standard Game Mode beside the quest deck. Empty in any other scenario. Pure, so a test reads it.
import type { ScenarioState } from "../../../rules/core/state.ts";
import { siegeTallyOf } from "../../../rules/families/wilderland/dolguldur.ts";
import { holds } from "../../../rules/interpret/conditions.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";

import { guldurCityWords, guldurNearWords, guldurZeroWords, tallyWords } from "./guldur-words.ts";
import { cardsOf, type TableDial } from "../dials.ts";

const SCENARIO = "attack-on-dol-guldur";
const DOL_GULDUR = "50907";
/** The strength at or under which the dial warns. */
const LOW = 5;

/** The dial Dol Guldur's city strength holds now: none in any other scenario, or with Dol Guldur out of play. */
export function guldurDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const city = cardsOf(game, DOL_GULDUR)[0];
  if (!city) return [];
  const strength = city.resources;
  const tally = siegeTallyOf(game);
  // At stage 3 only the tally comes off (50907:A:1): the round-end record's own condition says when.
  const takesTally = effectsOf(ctx, DOL_GULDUR).find((effect) => effect.id === "50907:forced:3")?.condition;
  const atStage3 = takesTally != null && holds(game, takesTally, { actor: 0, sourceId: city.id, returned: 0 }, ctx);
  const warn = atStage3 && strength > 0 && tally >= strength ? { level: "critical" as const, words: guldurZeroWords(tally) } : strength <= LOW ? { level: "near" as const, words: guldurNearWords(strength) } : null;
  const mode = Object.values(game.cards).find((card) => card.zone === "modeCard");
  return [{ id: "city", testID: "guldur-city", label: "City", name: `City strength of ${nameOf(DOL_GULDUR)}, the players win at 0 with no Lieutenant in play:`, value: strength, cardId: city.id, ...(mode ? { extra: [mode.id] } : {}), ...(warn ? { warn } : {}), note: guldurCityWords(strength, tallyWords(tally, atStage3)) }];
}
