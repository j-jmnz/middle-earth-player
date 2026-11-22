// Rules: rr.response, rr.step-3-4, rr.attachment-cards (data/rules/entries.json).
// Black Key 11183:B:3, written from its card record (data/cards/DCCE.json): "Response: After attached character quests successfully, add 1 resource to attached
// hero's resource pool." The quest resolves and clears the live committed marks before the Response is read; the round's record of who quested answers (rr.step-3-4).
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { updateCard } from "../../rules/core/state.ts";
import { attachTo } from "../../rules/core/zones.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Table } from "../../../test/harness/scene.ts";
import { playerTable, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const KEY = "11183";
const ARAGORN = "01001";
const GIMLI = "01003";

let base: Awaited<ReturnType<typeof starterBase>>;

// Aragorn wears the Key on its Upgraded side (side B); Gimli is the other hero.
function table(effects: readonly Effect[]): Table {
  const scene = playerTable(base, effects, { start: "quest", heroes: [{ code: ARAGORN, seat: 0 }, { code: GIMLI, seat: 0 }], attached: [{ code: KEY, host: ARAGORN }] }, 0);
  const state = updateCard(attachTo(scene.state, idsOf(scene, KEY), idsOf(scene, ARAGORN)), idsOf(scene, KEY), { face: "B" });
  return { ...scene, state: syncConstants(state, scene.ctx) };
}

beforeAll(async () => {
  const starter = await starterBase();
  base = { ...starter, cards: new Map([...starter.cards, ...(await loadPrinted([KEY, ARAGORN, GIMLI]))]) };
});

function quested(tab: Table, commit: readonly string[]) {
  let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: commit.map((code) => idsOf(tab, code)) }, tab.ctx);
  for (let guard = 0; guard < 20 && !triggers(run.state, tab).includes("11183:response:1") && run.state.mode !== "travel" && legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Pass"); guard += 1) {
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
  }
  return run;
}

describe("Black Key (11183:B:3)", () => {
  lineSpec("11183:B:3", "after the attached hero quests successfully, 1 resource is added to his pool", (effects) => {
    const tab = table(effects);
    const run = quested(tab, [ARAGORN, GIMLI]);
    expect(triggers(run.state, tab)).toContain("11183:response:1");
    const next = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, KEY), effectId: "11183:response:1" }, tab.ctx);
    expect(next.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(1);
  });

  it("11183:B:3 is not offered when the attached hero did not quest", () => {
    const tab = table(EFFECTS);
    const run = quested(tab, [GIMLI]);
    expect(triggers(run.state, tab)).not.toContain("11183:response:1");
  });
});
