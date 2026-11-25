// Rules: hrd.heroes-in-the-staging-area, hrd.guarded-heroes, hrd.objective-heroes, hrd.objective-hero-elimination, rr.blank, rr.immune (data/rules/entries.json); ledger lines 16071:A:1, 16071:B:3, 16072:B:3, 16073:A:1, 16073:B:2, 16031:A:2 (docs/scenarios/haradrim/the-long-arm-of-mordor.md, Table).
// What the table says of the heroes in the staging area, the heroes an Orc guards and the objective-heroes (src/play/readouts/haradrim/staged.ts). The engine decided each fact; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).

/** The first words of a preview of a hero in the staging area: whose it is, and what its blank text box and immunity come to. */
export const stagedWords = (owner: string, blank: boolean, immune: boolean): string =>
  `${owner} hero, in play in the staging area under no player's control.${blank ? " Its text box is blank." : ""}${immune ? " It is immune to player card effects." : ""} It adds no Threat to the staging area, and it can be destroyed.`;

/** How a hero in the staging area comes back (the stage records that take it back). */
export const stagedReturnWords = (owner: string): string => `A quest stage gives it back to ${owner}, exhausted, with its tokens and attachments.`;

/** The preview of a hero an Orc guards: the guard, whose hero it is, and when it returns. */
export const guardedWords = (owner: string, guard: string): string =>
  `${owner} hero, guarded by ${guard}. No player controls it, its text box is blank and it is immune to player card effects. It returns to its owner, exhausted, when ${guard} leaves play.`;

/** The preview of the Orc that guards a hero. */
export const guardsWords = (hero: string, owner: string, guard: string): string => `Guards ${hero}, ${owner} hero. ${hero} returns to its owner, exhausted, when ${guard} leaves play in any way.`;

/** The line a seat's dial says of one hero held in the staging area or under an Orc. */
export const stagedDialWords = (hero: string, guard: string | null): string => (guard == null ? `${hero} is in the staging area` : `${hero} is guarded by ${guard}`);

/** The preview line of an objective-hero: the loss its own record holds, said for the seat that controls it ("you" when one player plays). */
export const objectiveWords = (seatCount: number, seat: number | null): string =>
  `If it leaves play, ${seat == null || seatCount < 2 ? "you are" : `Player ${seat + 1} is`} eliminated from the game, however it leaves play.`;
