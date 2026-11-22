// Rules: rr.response, rr.step-3-4, rr.search (data/rules/entries.json).
// Haleth 22140:A:1, written from its card text (data/cards/TFoN.json; data/printed holds no ledger for this box yet): "Response: After Haleth quests successfully,
// search the top 5 cards of your deck for an attachment and add it to your hand. Shuffle your deck."
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Table } from "../../../test/harness/scene.ts";
import { choices, playerTable, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const HALETH = "22140";
// Unexpected Courage, an attachment; the filler card above it is not one.
const ATTACHMENT = "01057";
const FILLER = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[]): Table =>
  playerTable(base, effects, { start: "quest", heroes: [{ code: "01001", seat: 0 }], allies: [{ code: HALETH, seat: 0 }], playerDeck: [{ code: FILLER, seat: 0 }, { code: ATTACHMENT, seat: 0 }] }, 6);

beforeAll(async () => {
  const starter = await starterBase();
  base = { ...starter, cards: new Map([...starter.cards, ...(await loadPrinted([HALETH, "01001", ATTACHMENT]))]) };
});

// Passes until the Response window of the quest opens or the quest is over.
function quested(tab: Table, commit: readonly string[]) {
  let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: commit.map((code) => idsOf(tab, code)) }, tab.ctx);
  for (let guard = 0; guard < 20 && !triggers(run.state, tab).includes("22140:response:1") && run.state.mode !== "travel" && legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Pass"); guard += 1) {
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
  }
  return run;
}

describe("Haleth (22140:A:1)", () => {
  // The quest resolves and clears the live committed marks before the Response is read; the round's record of who quested answers (rr.step-3-4).
  lineSpec("22140:A:1", "after Haleth quests successfully, an attachment of the top 5 goes to the hand", (effects) => {
    const tab = table(effects);
    const run = quested(tab, [HALETH]);
    expect(triggers(run.state, tab)).toContain("22140:response:1");
    let next = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, HALETH), effectId: "22140:response:1" }, tab.ctx);
    if (next.state.window?.kind === "choose") {
      expect(choices(next.state, tab)).toEqual([idsOf(tab, ATTACHMENT)]);
      next = sendUnledgered(next, { type: "Choose", optionId: idsOf(tab, ATTACHMENT) }, tab.ctx);
    }
    expect(next.state.seats[0]?.hand).toContain(idsOf(tab, ATTACHMENT));
  });

  // Only a quest Haleth was committed to is his: the hero's quest alone does not answer.
  it("22140:A:1 is not offered when Haleth did not quest", () => {
    const tab = table(EFFECTS);
    const run = quested(tab, ["01001"]);
    expect(triggers(run.state, tab)).not.toContain("22140:response:1");
  });
});
