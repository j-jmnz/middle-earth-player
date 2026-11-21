// Which screens keep the table's music (docs/design-system-table.md, Sound): the table itself, and the reading screens a player opens
// from it and comes back from (a rule, a card, a booklet, the glossary, the log, Settings). Any other screen means the player has left
// the table, and the music goes back to the menu's loop.
const KEEPS_TABLE = [/^\/table\//, /^\/standalone\/table\//, /^\/rule\//, /^\/card\//, /^\/card-group\//, /^\/booklet\//, /^\/glossary$/, /^\/log\//, /^\/settings$/];

export function keepsTableMusic(pathname: string): boolean {
  return KEEPS_TABLE.some((route) => route.test(pathname));
}
