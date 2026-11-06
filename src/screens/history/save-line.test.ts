// The words and the destination of a playthrough's next step (docs/brief.md, Screens, Campaign path): a scenario the app cannot deal yet reads "coming soon" and goes to the path, never to a briefing or the table.
import { describe, expect, it } from "vitest";

import type { PathNode } from "../../campaign/path.ts";
import { nextSummary } from "./save-line.ts";
import { nextStepHref } from "../campaign/scenario-links.ts";

const node = (id: string, name: string, status: PathNode["status"]): PathNode => ({ id, number: 7, name, status, reward: [], score: null });

describe("the next step of a playthrough", () => {
  it("words a scenario coming soon, and opens the path rather than a briefing", () => {
    const soon = { kind: "soon", node: node("the-drowned-ruins", "The Drowned Ruins", "soon") } as const;
    expect(nextSummary(soon)).toBe("The Drowned Ruins is coming soon");
    expect(nextStepHref("save-1", soon)).toEqual({ pathname: "/path/[saveId]", params: { saveId: "save-1" } });
  });

  it("still words a scenario to begin or resume, and a finished campaign", () => {
    expect(nextSummary({ kind: "begin", node: node("a", "A Knife in the Dark", "current") })).toBe("Next: A Knife in the Dark");
    expect(nextSummary({ kind: "resume", node: node("a", "A Knife in the Dark", "current") })).toBe("On the table: A Knife in the Dark");
    expect(nextSummary({ kind: "finished" })).toBe("Campaign won");
    expect(nextStepHref("save-1", { kind: "begin", node: node("a", "A Knife in the Dark", "current") })).toEqual({ pathname: "/briefing/[saveId]/[scenarioId]", params: { saveId: "save-1", scenarioId: "a" } });
  });
});
