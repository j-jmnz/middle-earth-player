// Rules: rr.campaign-cards, ltp.campaign-cards (data/rules/entries.json).
//
// The campaign card next to the quest deck. Its Setup is run by the campaign checklist and its Resolution by the win; a card with
// an ability that works while the scenario is played (141056:A:2, a Response any player may use) is also in the game, in the
// `campaign` zone, so the engine hears the events it answers. A campaign card with only a Setup and a Resolution is not placed,
// so the scenarios without such an ability play as they always did.
import type { Effect } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";

const DURING_PLAY: ReadonlySet<Effect["timing"]> = new Set(["response", "forced", "triggered", "action", "constant"]);

export function placeCampaignCard(state: ScenarioState, code: string | undefined, ctx: ReduceContext): ScenarioState {
  // A campaign card whose Setup says KeepCampaignCard stays too: a card of the scenario places resources on it and its Resolution counts them (families/uncharted/cards.ts).
  if (!code || !ctx.effects.some((effect) => effect.cardCode === code && (DURING_PLAY.has(effect.timing) || effect.instructions.some((instruction) => instruction.verb === "KeepCampaignCard")))) return state;
  return spawn(state, code, { zone: "campaign" }).state;
}
