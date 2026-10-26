// Rules: rr.triggering-condition, rr.response, rr.step-3-2 (data/rules/entries.json). One commit is one occurrence: the
// Responses of every character it committed share one window, used in any order, and a Response whose cost cannot be paid
// yet is offered once another one has paid for it. The video's combo: Théodred adds a resource to Aragorn, and Aragorn
// spends it to ready.
import { beforeAll, describe, expect, it } from "vitest";

import { legalIntents } from "../rules/reduce.ts";
import type { ScenarioState } from "../rules/state.ts";
import { starterBase } from "../../scripts/starter-scene.ts";
import { begin, buildTable, idsOf, send, type Table } from "../../scripts/test-scene.ts";

const ARAGORN = "01001";
const THEODRED = "01002";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  base = await starterBase();
});

function offered(state: ScenarioState, tab: Table): string[] {
  return legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "Trigger" ? [intent.effectId] : []));
}

describe("Responses to one commit", () => {
  it("share one window: Théodred's resource pays for Aragorn's ready, in the order the player chose", () => {
    const tab = buildTable(base, { ring: "none", start: "quest", heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 0 }] });
    const aragorn = idsOf(tab, ARAGORN);
    const theodred = idsOf(tab, THEODRED);
    expect(tab.state.cards[aragorn]?.resources).toBe(0);
    let run = send(begin(tab.state), { type: "Commit", cardIds: [aragorn, theodred] }, tab.ctx);
    // Aragorn has nothing to spend yet: only Théodred's Response is listed, though Aragorn's waits in the same window.
    expect(offered(run.state, tab)).toEqual(["01002:response:1"]);
    run = send(run, { type: "Trigger", cardId: theodred, effectId: "01002:response:1" }, tab.ctx);
    // Théodred chooses a committed hero to take the resource: Aragorn.
    expect(legalIntents(run.state, tab.ctx)).toContainEqual({ type: "Choose", optionId: aragorn });
    run = send(run, { type: "Choose", optionId: aragorn }, tab.ctx);
    expect(run.state.cards[aragorn]?.resources).toBe(1);
    // Back in the same window, Aragorn's Response is now paid for and offered.
    expect(offered(run.state, tab)).toEqual(["01001:response:1"]);
    run = send(run, { type: "Trigger", cardId: aragorn, effectId: "01001:response:1" }, tab.ctx);
    expect(run.state.cards[aragorn]?.exhausted).toBe(false);
    expect(run.state.cards[aragorn]?.committed).toBe(true);
    expect(run.state.cards[aragorn]?.resources).toBe(0);
  });

  it("closes when nothing can be used, and a pass gives up the rest", () => {
    const tab = buildTable(base, { ring: "none", start: "quest", heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 0 }] });
    const run = send(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, ARAGORN), idsOf(tab, THEODRED)] }, tab.ctx);
    const passed = send(run, { type: "Pass" }, tab.ctx);
    expect(offered(passed.state, tab)).toEqual([]);
    expect(passed.state.window?.kind).not.toBe("response");
  });
});
