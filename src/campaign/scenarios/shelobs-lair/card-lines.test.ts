// Rules: rr.attachment-cards, rr.engaged, rr.cannot, rr.setup, mec112.setup-shelobs-lair (data/rules/entries.json).
// Shelob's "Cannot have attachments." and A Heavy Burden's Setup, read on a table built from a layout (tableFromLayout) and run again without the records of
// their line (lineSpec), where each must fail. Frodo Baggins (141001) is the Ring-bearer hero; the stand-ins dh1 to dh3 have no Traits.
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { attachmentTargets } from "../../../rules/player/planning.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, idsOf, resolveRecords, tableFromLayout, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";

const ID = "shelobs-lair";
const SHELOB = "144040";
const BURDEN = "144052";
const FRODO = "141001";
// Forest Snare (01069): "Attach to an enemy engaged with a player."
const SNARE = "01069";

describe("Shelob (144040)", () => {
  // "Indestructible. Cannot have attachments." The keyword is the card's keywords; the line's record is the second sentence.
  lineSpec("144040:A:1", "Forest Snare can be played on another engaged enemy and not on Shelob", (effects) => {
    const made = tableFromLayout(ID, { engaged: [SHELOB, "f0"], hand: [SNARE] }, { effects, extra: [SNARE] });
    const targets = attachmentTargets({ ...made.state, activeSeat: 0 }, idOf(made.state, SNARE), made.ctx).map((id) => made.state.cards[id]?.code);
    expect(targets).toEqual(["f0"]);
  });
});

// The table with Frodo among the heroes of `seat`, after the stand-ins, and the one copy of A Heavy Burden set aside, as the Setup finds it.
function withFrodo(layout: Layout, seat: number, effects: readonly Effect[]): LayoutTable {
  const made = tableFromLayout(ID, layout, { effects, extra: [FRODO] });
  const state = spawn(made.state, FRODO, { zone: "heroes", seat }).state;
  return { ...made, state: syncConstants(state, made.ctx) };
}

// The codes of the heroes the copies of A Heavy Burden are attached to (an attached card lies in its controller's play area with its host named).
const heldBy = (state: ScenarioState): (string | undefined)[] => idsOf(state, BURDEN).map((id) => state.cards[state.cards[id]?.host ?? ""]?.code);

describe("A Heavy Burden (144052)", () => {
  // "Setup: Attach to the Ring-bearer."
  lineSpec("144052:A:2", "Setup attaches it to the Ring-bearer and to no other hero", (effects) => {
    const made = withFrodo({ setAside: [BURDEN] }, 0, effects);
    const { state } = resolveRecords(made.state, made.ctx, BURDEN, "setup", idOf(made.state, BURDEN));
    expect(heldBy(state)).toEqual([FRODO]);
  });

  lineSpec("144052:A:2", "Setup attaches it to the Ring-bearer the second player controls", (effects) => {
    const made = withFrodo({ seats: 2, setAside: [BURDEN] }, 1, effects);
    const { state } = resolveRecords(made.state, made.ctx, BURDEN, "setup", idOf(made.state, BURDEN));
    expect(heldBy(state)).toEqual([FRODO]);
  });
});
