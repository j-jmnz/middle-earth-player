// The campaign's road on Campaigns (the Continue panel, save-panels.tsx): which stops it draws, how the line reaches each, and what
// each says. The wins before the last one fold into one line so the road's primary stays on the first screen; the path shows them all.
import type { NextStep, PathNode } from "../campaign/path";

// How the road reaches a scenario: won, the one the next tap plays, or still ahead.
export type RoadState = "won" | "here" | "ahead";
// The line into or out of a stop: walked, dashed ahead, or none past either end.
export type Walk = "walked" | "ahead" | null;

export type RoadStop = {
  node: PathNode;
  state: RoadState;
  into: Walk;
  out: Walk;
  // "Won · 87" on a won scenario (a replayed one too), "Next" on the campaign's next scenario when a replay is ahead of it.
  tag: string | null;
  // What a screen reader hears on a quiet row.
  spoken: string;
};

export type Road = { folded: { count: number; score: number | null; spoken: string } | null; stops: RoadStop[] };

export function campaignRoad(path: readonly PathNode[], next: NextStep): Road {
  const here = next.kind === "finished" ? null : next.node.id;
  const stateOf = (node: PathNode): RoadState => (node.id === here ? "here" : node.status === "completed" ? "won" : "ahead");
  // The line into a stop is walked once the road has reached that stop.
  const into = (index: number): Walk => (index === 0 ? null : stateOf(path[index]!) === "ahead" ? "ahead" : "walked");
  const out = (index: number): Walk => (index === path.length - 1 ? null : into(index + 1));
  // Fold the leading wins, all but the one just before the lit stop (or the last one, once every scenario is won), when two or more.
  const until = here == null ? path.length : path.findIndex((node) => node.id === here);
  const leading = path.slice(0, Math.max(0, until - 1));
  const firstOther = leading.findIndex((node) => stateOf(node) !== "won");
  const count = firstOther === -1 ? leading.length : firstOther;
  const fold = count >= 2 ? path.slice(0, count) : [];
  const score = fold.every((node) => node.score != null) ? fold.reduce((sum, node) => sum + (node.score ?? 0), 0) : null;
  const stops = path.slice(fold.length).map((node, offset): RoadStop => {
    const index = offset + fold.length;
    const state = stateOf(node);
    const won = node.status === "completed" ? (node.score != null ? `Won · ${node.score}` : "Won") : null;
    // A replay of a won scenario lights that stop; the campaign's own next scenario is still reached, so it says Next.
    const tag = state === "ahead" && node.status === "current" ? "Next" : won;
    const heard = won ? `won${node.score != null ? `, score ${node.score}` : ""}` : node.status === "current" ? "next after this" : "not reached";
    return { node, state, into: into(index), out: out(index), tag, spoken: `${node.name}, ${heard}` };
  });
  const folded = fold.length > 0 ? { count: fold.length, score, spoken: `${fold.length} scenarios won${score != null ? `, score ${score}` : ""}` } : null;
  return { folded, stops };
}
