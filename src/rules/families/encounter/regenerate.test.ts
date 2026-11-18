import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { updateCard } from "../../core/state.ts";
import { doRefresh } from "../../engine/refresh.ts";
import { enemy, hero, table } from "../defense/table.ts";

// Rules: dwd.regenerate, rr.refresh-phase (data/rules/entries.json); ledger line 04072:A:1.
// An enemy with Regenerate X, in the staging area or engaged, heals X damage from itself when the first player token passes in the Refresh phase, and no more than it has.

const MONSTER = enemy("monster", { keywords: { regenerate: 2 }, health: 9 });
const PLAIN = enemy("plain", { health: 9 });

function refresh(damage: number, zone: "staging" | "engaged") {
  const built = table({ cards: [hero("a"), MONSTER, PLAIN], effects: [], heroes: [{ code: "a" }], ...(zone === "staging" ? { staging: [{ code: "monster" }, { code: "plain" }] } : { enemies: [{ code: "monster" }, { code: "plain" }] }) });
  let state = updateCard(updateCard(built.state, built.ids.monster!, { damage }), built.ids.plain!, { damage });
  const steps: EngineStep[] = [];
  state = doRefresh(state, built.ctx, steps);
  return { monster: state.cards[built.ids.monster!]!.damage, plain: state.cards[built.ids.plain!]!.damage };
}

describe("Regenerate (04072:A:1, dwd.regenerate)", () => {
  it("04072:A:1 an enemy in the staging area heals the keyword's amount in the Refresh phase", () => {
    expect(refresh(5, "staging")).toEqual({ monster: 3, plain: 5 });
  });

  it("04072:A:1 an engaged enemy heals too, and no more than it has", () => {
    expect(refresh(1, "engaged")).toEqual({ monster: 0, plain: 1 });
  });
});
