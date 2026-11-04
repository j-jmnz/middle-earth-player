// The spotlight's pictures decoded ahead (docs/design-system-table.md, Spotlight): an enemy's attack is declared a few taps before it
// resolves (the defender is chosen, the shadow card is dealt), and the spotlight that plays it needs its cards at the stage's size, which
// is larger than the table's. So when an attack is pending the layer starts those decodes then, and the first frames of the spotlight do not
// wait for them. Pure, so a test reads it.
import { FX } from "./fx.ts";
import { stageOf, type StageArea } from "./stage.ts";

/** The codes to decode ahead and the size to decode them at (points, with the camera's punch-in). */
export type Warm = { codes: readonly string[]; w: number; h: number };

/**
 * The cards of an attack still pending: the enemy and, once declared, its defender. The size is the stage of a lone attacker with no shadow
 * card, the largest a stage is (a fan of attackers or a shadow card makes room and shrinks it), so a plan that needs less keeps the copy.
 * Null when there is no card to decode.
 */
export function warmFor(codes: readonly (string | null)[], area: StageArea, card: { w: number; h: number }, scale: number): Warm | null {
  const known = [...new Set(codes.filter((code): code is string => code != null && code !== ""))];
  if (known.length === 0) return null;
  const { target } = stageOf(area, card, 1, false, scale);
  return { codes: known, w: target.w * FX.push, h: target.h * FX.push };
}
