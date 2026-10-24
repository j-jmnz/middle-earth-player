// Rules: ltp.campaign-mode, rr.campaign-mode (data/rules/entries.json). The path of a campaign is its scenarios in book
// order: a won scenario is completed, the first one not won is current, the rest are locked. A lost scenario writes
// nothing, so it stays current.
import type { CampaignData } from "../catalog/scenario-data.ts";

import type { CampaignLog } from "./log.ts";

export type NodeStatus = "completed" | "current" | "locked";

export type PathNode = {
  id: string;
  number: number;
  name: string;
  status: NodeStatus;
  // The codes the scenario's Resolution recorded; shown on a completed node.
  reward: readonly string[];
  score: number | null;
};

export function campaignPath(campaign: CampaignData, names: Readonly<Record<string, string>>, log: CampaignLog): PathNode[] {
  let currentSeen = false;
  return campaign.scenarios.map((id, index) => {
    const won = log.completed.includes(id);
    const status: NodeStatus = won ? "completed" : currentSeen ? "locked" : "current";
    if (!won) currentSeen = true;
    return {
      id,
      number: index + 1,
      name: names[id] ?? id,
      status,
      reward: won ? (log.earned[id] ?? []) : [],
      score: log.scenarios[id]?.score ?? null,
    };
  });
}

export function currentNode(path: readonly PathNode[]): PathNode | null {
  return path.find((node) => node.status === "current") ?? null;
}
