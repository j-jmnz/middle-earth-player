import { describe, expect, it } from "vitest";

import { renderAmount } from "./amounts.ts";
import type { Obj } from "./kit.ts";
import { renderPick } from "./picks.ts";
import { checkPiece, type Render } from "./read-fields-piece.ts";

describe("effects render read fields, amounts", () => {
  const PICK = { type: "hero", control: "you" };
  const SAMPLES: readonly Obj[] = [
    { count: PICK, distinct: true, every: 2, times: 3, plus: 1, limit: 5 },
    { stat: "attack", of: "host", printed: true, negative: true },
    { stat: "willpower", ofNamed: "A Card" },
    { players: true },
    { namelessCost: 3 },
    { playersAtStage: true },
    { victoryPoints: true },
    { stagingThreat: true },
    { highestThreat: true },
    { playersAtThreat: 35 },
    { pursuit: true },
    { questCards: true },
    { shadowCardsInPlay: true },
    { discardPileMaxCost: true },
    { pile: "harad" },
    { x: true },
    { stage: true },
    { threat: "tens" },
    { hand: true },
    { dealt: true },
    { attackDamage: true },
    { resourcesOn: PICK, max: true },
    { damageOn: PICK },
  ];
  const render: Render = (value, ctx) => renderAmount(value, ctx, renderPick);

  it("says every field the template claims", () => {
    const result = checkPiece(render, SAMPLES);
    expect(result.unclaimed).toEqual([]);
    expect(result.hidden).toEqual([]);
    expect(result.unsampled).toEqual([]);
  });
});
