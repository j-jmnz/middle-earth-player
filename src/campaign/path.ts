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

// What a playthrough's next tap does: go back to the open scenario, begin the current one, or nothing is left to play.
// The open scenario is the one the stored loadout dealt; like the path, a locked node is never resumed.
export type NextStep = { kind: "resume" | "begin"; node: PathNode } | { kind: "finished" };

/** The node of the open scenario, when the loadout names one the path has reached. */
export function openNode(path: readonly PathNode[], openScenarioId: string | null | undefined): PathNode | null {
  return (openScenarioId && path.find((node) => node.id === openScenarioId && node.status !== "locked")) || null;
}

export function nextStep(path: readonly PathNode[], openScenarioId: string | null | undefined): NextStep {
  const open = openNode(path, openScenarioId);
  if (open) return { kind: "resume", node: open };
  const current = currentNode(path);
  return current ? { kind: "begin", node: current } : { kind: "finished" };
}
