import type { CampaignData } from "../../src/catalog/scenario-data.ts";
import { isPlayable } from "../../src/campaign/playable.ts";
import type { NodeStatus } from "../../src/campaign/path.ts";

// Test helper. What the campaign path shows for the part after a scenario once that scenario is won, worked out from the playable list
// and the campaign's order, so a scenario test never names it (a part becoming playable changes no test).

/** The id of the part after the scenario in the campaign's order, or null for the last part and for a scenario that is not in the campaign. */
export function nextPartId(campaign: CampaignData, scenarioId: string): string | null {
  const at = campaign.scenarios.indexOf(scenarioId);
  return at < 0 ? null : (campaign.scenarios[at + 1] ?? null);
}

/** The status the path gives the part after a won scenario: "current" when the app can deal it, "soon" when it cannot, null for the last part. */
export function nextPartStatus(campaign: CampaignData, scenarioId: string): Extract<NodeStatus, "current" | "soon"> | null {
  const next = nextPartId(campaign, scenarioId);
  return next == null ? null : isPlayable(next) ? "current" : "soon";
}

/** The kind of `nextStep` once the scenario is won with nothing open: "begin" a playable next part, "soon" for one that is not, null when no part is left. */
export function nextStepKind(campaign: CampaignData, scenarioId: string): "begin" | "soon" | null {
  const status = nextPartStatus(campaign, scenarioId);
  return status == null ? null : status === "current" ? "begin" : "soon";
}

/** The status the path gives the part after the current one, whose own win is not written yet: "locked" when the app can deal it, "soon" when it cannot, null for the last part. */
export function partBehindCurrentStatus(campaign: CampaignData, currentId: string): Extract<NodeStatus, "locked" | "soon"> | null {
  const next = nextPartId(campaign, currentId);
  return next == null ? null : isPlayable(next) ? "locked" : "soon";
}
