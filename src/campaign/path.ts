// Rules: ltp.campaign-mode, rr.campaign-mode (data/rules/entries.json). The path of a campaign is its scenarios in book
// order: a won scenario is completed, the first one not won is current, the rest are locked. A lost scenario writes
// nothing, so it stays current. A scenario the app cannot deal yet (not in PLAYABLE_SCENARIOS) is "soon" ("Coming soon"):
// never current, never begun or resumed, wherever it stands on the path (user decision, 2026-11-01: the Dream-chaser path
// stops after Temple of the Deceived).
import type { CampaignData } from "../catalog/scenario-data.ts";

import type { CampaignLog } from "./log.ts";
import { isPlayable } from "./playable.ts";

export type NodeStatus = "completed" | "current" | "locked" | "soon";

export type PathNode = {
  id: string;
  number: number;
  name: string;
  status: NodeStatus;
  // The codes the scenario's Resolution recorded; shown on a completed node.
  reward: readonly string[];
  score: number | null;
  // The XP the scenario's Resolution awarded (Dream-chaser), absent where the campaign has none.
  xp?: number;
};

export function campaignPath(campaign: CampaignData, names: Readonly<Record<string, string>>, log: CampaignLog): PathNode[] {
  let currentSeen = false;
  return campaign.scenarios.map((id, index) => {
    const won = log.completed.includes(id);
    const status: NodeStatus = won ? "completed" : !isPlayable(id) ? "soon" : currentSeen ? "locked" : "current";
    if (!won) currentSeen = true;
    return {
      id,
      number: index + 1,
      name: names[id] ?? id,
      status,
      reward: won ? (log.earned[id] ?? []) : [],
      score: log.scenarios[id]?.score ?? null,
      ...(log.xpGained[id] != null ? { xp: log.xpGained[id] } : {}),
    };
  });
}

export function currentNode(path: readonly PathNode[]): PathNode | null {
  return path.find((node) => node.status === "current") ?? null;
}

/** The first scenario not won, when it is one the app cannot deal yet: the path stops there, at "Coming soon". */
export function soonNode(path: readonly PathNode[]): PathNode | null {
  const first = path.find((node) => node.status !== "completed");
  return first?.status === "soon" ? first : null;
}

/** "The Drowned Ruins is coming soon": a scenario the path reaches and the app cannot deal yet. */
export function soonWords(node: Pick<PathNode, "name">): string {
  return `${node.name} is coming soon`;
}

// What a playthrough's next tap does: go back to the open scenario, begin the current one, or nothing is left to play (every
// scenario is won, or the next one is coming soon). The open scenario is the one the stored loadout dealt; like the path, a
// locked or coming-soon node is never resumed.
export type NextStep = { kind: "resume" | "begin" | "soon"; node: PathNode } | { kind: "finished" };

/** The node of the open scenario, when the loadout names one the path has reached and the app can deal. */
export function openNode(path: readonly PathNode[], openScenarioId: string | null | undefined): PathNode | null {
  return (openScenarioId && path.find((node) => node.id === openScenarioId && node.status !== "locked" && node.status !== "soon")) || null;
}

export function nextStep(path: readonly PathNode[], openScenarioId: string | null | undefined): NextStep {
  const open = openNode(path, openScenarioId);
  if (open) return { kind: "resume", node: open };
  const current = currentNode(path);
  if (current) return { kind: "begin", node: current };
  const soon = soonNode(path);
  return soon ? { kind: "soon", node: soon } : { kind: "finished" };
}
