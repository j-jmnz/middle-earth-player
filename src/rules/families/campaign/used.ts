// Rules: rr.limits, rr.campaign-cards (data/rules/entries.json); ledger lines 41044:A:3, 41045:A:3, 41046:A:3, 41047:A:3.
//
// "Limit once per campaign. Record in Campaign Log when used." A use of such an ability is a once-per-campaign fact: the card's code joins the
// game's copy of the campaign log's `usedOnce` (CampaignFacts), which a won scenario writes back (campaign/log.ts) and a later scenario starts
// from. A card whose code is recorded cannot use that ability again, in this game or in a later one of the campaign. A lost scenario writes
// nothing, so its uses do not stay.
import type { Effect } from "../../../catalog/boundary.ts";

import type { ScenarioState } from "../../core/state.ts";

// The code of the card the ability is on has been recorded as used, by an earlier scenario of the campaign or earlier in this game.
export function campaignUsed(state: ScenarioState, sourceId: string): boolean {
  const code = state.cards[sourceId]?.code;
  return code != null && (state.campaignFacts?.usedOnce ?? []).includes(code);
}

// Records the use of an `oncePerCampaign` ability (the game starts a facts record of its own when the log had none to hand over).
export function noteCampaignUse(state: ScenarioState, effect: Effect, sourceId: string): ScenarioState {
  const code = state.cards[sourceId]?.code;
  if (effect.limit !== "oncePerCampaign" || code == null) return state;
  const facts = state.campaignFacts ?? { prisoner: null, usedOnce: [], counters: {} };
  if (facts.usedOnce.includes(code)) return state;
  return { ...state, campaignFacts: { ...facts, usedOnce: [...facts.usedOnce, code] } };
}
