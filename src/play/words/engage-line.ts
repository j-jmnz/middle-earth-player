// Rules: rr.engaged (data/rules/entries.json). What the banner tells for an enemy that engages a player: under its own title when it is the only one ("Engaged with Player 2", "Engaged with you"), or a line of one shared beat when two or more engage in one intent ("Marauding Orc engages Player 2").
export const ENGAGE_TITLE = "Enemies engage";

/** The banner's group and line, as store/outcome.ts offers them; `title` is the title of the group the last line went to. */
export type EngageSink = { open: (rank: number, title: string, tone: "bad") => unknown; line: (text: string, mark: null, cards: readonly string[]) => void; title: () => string | undefined };

/** `vale`: the words a scenario's own record gives the engagement; `silent`: it is told under no title of its own. `many`: two or more engagements in this intent. */
export function tellEngage(enemy: { id: string; name: string; seat: number }, seats: number, many: boolean, vale: string | null, silent: boolean, sink: EngageSink): void {
  const each = vale == null && many;
  const who = seats > 1 ? `Player ${enemy.seat + 1}` : "you";
  if (!each) sink.open(4, silent ? "" : `${enemy.name} engages`, "bad");
  else if (sink.title() !== ENGAGE_TITLE) sink.open(4, ENGAGE_TITLE, "bad");
  sink.line(each ? `${enemy.name} engages ${who}` : (vale ?? `Engaged with ${who}`), null, each ? [enemy.id] : []);
}
