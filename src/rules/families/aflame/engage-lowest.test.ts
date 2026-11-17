// Rules: rr.engaged, rr.first-player (data/rules/entries.json); ledger line 00002:A:1.
// EngageLowestThreat on a table of The Massing at Osgiliath: every copy of Snaga Scouts, in the staging area or engaged with a player, engages the player with the lowest threat; the first player chooses among tied players.
import { describe, expect, it } from "vitest";

import { idsOf, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SNAGA = "00002";

// The copy's own Forced record runs in an effect frame, which a tie's question needs; `pick` answers it.
const engages = (layout: Layout, pick = "seat:0") => {
  const made = tableFromLayout("the-massing-at-osgiliath", { seats: 2, phase: "Encounter", ...layout });
  const [source] = idsOf(made.state, SNAGA);
  const run = resolveRecords(made.state, made.ctx, SNAGA, "forced", source, () => pick);
  return { state: run.state, ids: idsOf(run.state, SNAGA), asked: run.steps };
};

describe("EngageLowestThreat (00002:A:1)", () => {
  it("00002:A:1 every copy engages the player with the lowest threat, from the staging area and from another player", () => {
    const { state, ids } = engages({ threat: [30, 25], staging: [SNAGA], engaged: [{ code: SNAGA, seat: 0 }] });
    expect(ids).toHaveLength(2);
    for (const id of ids) expect(state.cards[id]).toMatchObject({ zone: "engaged", controller: 1 });
  });

  it("00002:A:1 copies already engaged with the one lowest-threat player stay", () => {
    const { state, ids } = engages({ threat: [20, 25], engaged: [{ code: SNAGA, seat: 0 }, { code: SNAGA, seat: 0 }] });
    for (const id of ids) expect(state.cards[id]).toMatchObject({ zone: "engaged", controller: 0 });
  });

  it("00002:A:1 the first player chooses among tied players, once for all the copies", () => {
    const { state, ids } = engages({ threat: [28, 28], firstPlayer: 1, staging: [SNAGA, SNAGA] }, "seat:0");
    expect(ids).toHaveLength(2);
    for (const id of ids) expect(state.cards[id]).toMatchObject({ zone: "engaged", controller: 0 });
    const other = engages({ threat: [28, 28], staging: [SNAGA, SNAGA] }, "seat:1");
    for (const id of other.ids) expect(other.state.cards[id]).toMatchObject({ zone: "engaged", controller: 1 });
  });
});
