// Rules: rr.staging, rr.active-location, rr.traits, rr.in-play-and-out-of-play (data/rules/entries.json).
// Lines: 900605:A:1. Labyrinthine Woods' constant, read on a table built from a layout (tableFromLayout) and run again without the records of its line (lineSpec), where it must fail: the true case
// and its false cases (another zone, a non-Creature enemy) are in one check, since a false case alone holds without the records.
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "a-journey-to-rhosgobel";
const WOODS = "900605";
// Mirkwood Flock (02070, 1 Threat, 2 Attack) and Black Forest Bats (02071, 1 Threat, 1 Attack) are Creatures; the stand-in f3 (3 Threat, 1 Attack) has no Trait.
const FLOCK = "02070";
const BATS = "02071";

// The Threat and the Attack of each card of `codes` on the table of the layout.
function threatAndAttack(layout: Layout, codes: readonly string[], effects: readonly Effect[]): Record<string, [number, number]> {
  const made = tableFromLayout(ID, layout, { effects });
  const of = (code: string): [number, number] => {
    const card = made.state.cards[idOf(made.state, code)]!;
    return [modifiedStat(made.state, card, "threat", made.cards), modifiedStat(made.state, card, "attack", made.cards)];
  };
  return Object.fromEntries(codes.map((code) => [code, of(code)]));
}

describe("Labyrinthine Woods (900605)", () => {
  // "While Labyrinthine Woods is in the staging area, Creature enemies get +1 Threat and +1 Attack."
  lineSpec("900605:A:1", "in the staging area each Creature enemy, staged or engaged, gets +1 Threat and +1 Attack, and an enemy with no Creature Trait does not", (effects) => {
    expect(threatAndAttack({ staging: [WOODS, FLOCK, "f3"], engaged: [BATS] }, [FLOCK, BATS, "f3"], effects)).toEqual({ [FLOCK]: [2, 3], [BATS]: [2, 2], f3: [3, 1] });
    // As the active location it gives nothing.
    expect(threatAndAttack({ active: WOODS, staging: [FLOCK] }, [FLOCK], effects)).toEqual({ [FLOCK]: [1, 2] });
  });
});
