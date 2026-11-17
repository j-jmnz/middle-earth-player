// Where the update ribbon shows (docs/design-system.md, Update ribbon). Pure, so a test reads it.
import { TABLET_MIN_SIDE } from "../../ui/size-class";

/** The table's routes, campaign and standalone: the game keeps its whole screen, and the table menu says the offer instead. */
export function isTableRoute(path: string): boolean {
  return /^\/table\/[^/]+$/.test(path) || /^\/standalone\/table\/[^/]+$/.test(path);
}

/**
 * Whether the ribbon has room on this route in a window this size: not on the table, and not in a landscape window shorter than a tablet's shorter
 * side, which is a phone turned for a card, a booklet or a rule, where the ribbon would take a sixth of it.
 */
export function ribbonFits(path: string, width: number, height: number): boolean {
  if (isTableRoute(path)) return false;
  return !(width > height && height < TABLET_MIN_SIDE);
}
