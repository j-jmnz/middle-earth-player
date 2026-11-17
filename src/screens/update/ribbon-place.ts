// Where the update ribbon shows (docs/design-system.md, Update ribbon). Pure, so a test reads it.

/** The table's routes, campaign and standalone: the game keeps its whole screen, and the table menu says the offer instead. */
export function isTableRoute(path: string): boolean {
  return /^\/table\/[^/]+$/.test(path) || /^\/standalone\/table\/[^/]+$/.test(path);
}

// A window this short in landscape is a phone turned for a card, a booklet or a rule: the ribbon would take a sixth of it.
const SHORT_LANDSCAPE = 600;

/** Whether the ribbon has room on this route in a window this size: not on the table, and not in a short landscape window. */
export function ribbonFits(path: string, width: number, height: number): boolean {
  if (isTableRoute(path)) return false;
  return !(width > height && height < SHORT_LANDSCAPE);
}
