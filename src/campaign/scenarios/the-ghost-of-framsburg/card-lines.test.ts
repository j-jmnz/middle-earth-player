// Rules: emce.loot, rr.objective-cards, rr.attachment-cards, rr.first-player, rr.destroy (data/rules/entries.json).
// The Ghost of Framsburg lines no test named (ledger data/printed/ered-mithrin.json): "If unattached, the first player claims <it> and attaches it to a hero he controls." on Old Lantern (19095:A:2),
// Scatha's Teeth (19096:A:2) and Ashen Brazier (12190:A:2), and Hidden Staircase's "X is the tens digit of the first player's threat." (19103:A:2). The rows claim the objective free of encounters in the
// staging area; the line specs read the first player on the second seat and a hero that leaves play. `cardSpecs` and `lineSpec` run each test again without the records of its line, where it must fail.
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { destroyCard } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { announce, cardSpecs, stat, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { finish, idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-ghost-of-framsburg";
const LANTERN = "19095";
const TEETH = "19096";
const BRAZIER = "12190";
const STAIRCASE = "19103";
const LOOT = [LANTERN, TEETH, BRAZIER] as const;
const TRAVEL_BEGINS = announce("beginningOfPhase", undefined, { seat: null, phase: "Travel" });

const ROWS: readonly Row[] = [
  // Free of encounters in the staging area, the first player claims it: it is attached to his hero.
  ...LOOT.map((code): Row => ({ line: `${code}:A:2`, name: "free of encounters in the staging area the first player claims it and attaches it to a hero", layout: { staging: [code] }, act: TRAVEL_BEGINS, expect: zone(code, "attached") })),
  // "X is the tens digit of the first player's threat": in the second row the second seat holds the token at threat 45 and the first seat is at 28.
  { line: "19103:A:2", name: "Threat X is the tens digit of the first player's threat (34: 3)", layout: { staging: [STAIRCASE], threat: [34, 28] }, act: [], expect: stat(STAIRCASE, "threat", 3) },
  { line: "19103:A:2", name: "the first player's threat, not the first seat's (45 on the second seat: 4)", layout: { seats: 2, firstPlayer: 1, staging: [STAIRCASE], threat: [28, 45] }, act: [], expect: stat(STAIRCASE, "threat", 4) },
];

cardSpecs(SCENARIO, ROWS);

// The objective's claim with the table's settle sweep, the choices answered with their first option.
const settled = (made: ReturnType<typeof tableFromLayout>, state = made.state) => {
  const steps: EngineStep[] = [];
  return finish({ state: settle(syncConstants({ ...state, window: null, mode: "stopped" }, made.ctx), made.ctx, steps), steps }, made.ctx).state;
};

describe("the Loot objectives' claim (19095:A:2, 19096:A:2, 12190:A:2)", () => {
  for (const code of LOOT) {
    lineSpec(`${code}:A:2`, "with the first-player token on the second seat, its player claims it and attaches it to his own hero", (effects: readonly Effect[]) => {
      const made = tableFromLayout(SCENARIO, { seats: 2, firstPlayer: 1, staging: [code] }, { effects });
      const state = settled(made);
      const card = state.cards[idOf(state, code)];
      expect(card?.zone).toBe("attached");
      expect(card?.host).toBe(made.seat1Hero);
      expect(card?.controller).toBe(1);
    });

    lineSpec(`${code}:A:2`, "unattached when its hero is destroyed, it returns to the staging area and the first player claims it again on his other hero", (effects: readonly Effect[]) => {
      const made = tableFromLayout(SCENARIO, { attached: [{ code, to: "dh1" }] }, { effects });
      const state = settled(made, destroyCard(made.state, made.hero, made.ctx.cards, []));
      const card = state.cards[idOf(state, code)];
      expect(card?.zone).toBe("attached");
      expect(card?.host).toBe(made.hero2);
    });
  }
});
