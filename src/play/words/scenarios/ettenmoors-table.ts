// Rules: mec108.safe, mec108.objective-locations, mec108.campaign-setup-across-the-ettenmoors, mec108.side-quests-in-play (data/rules/entries.json); ledger lines 10068:A:1, 10069:A:1, 10070:A:1, 10071:A:1, 10077:A:2, 10080:A:1, 10182:A:2, 10182:A:3, 10183:A:2.
// What the table says of Across the Ettenmoors' pieces (src/play/readouts/ettenmoors.ts, src/play/cards/ettenmoors-preview.ts): the Losing Time clock on the campaign card, a safe location and what it does while it is the active location, the treachery whose When Revealed it ignores,
// a guard and the objective it guards, and No Rest on a hero. The engine decided every number; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words). Pure.
const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** The resources at which the campaign card reveals a Losing Time (10182:A:3). */
export const LOSING_TIME_AT = 3;

/** The dial's note: the resources on the campaign card, what the quest phase does and how many Losing Time are still set aside. True when none remain: nothing is revealed and the resources stay. */
export const losingTimeWords = (resources: number, setAside: number): string =>
  setAside === 0
    ? `${plural(resources, "resource", "resources")} on the campaign card. No Losing Time is set aside, so nothing more is revealed.`
    : `${resources} of ${LOSING_TIME_AT} resources on the campaign card. Each quest phase adds 1. At ${LOSING_TIME_AT}, they come off and a Losing Time is revealed. ${plural(setAside, "copy is", "copies are")} set aside.`;

/** The warning near the limit: the next quest phase reveals a Losing Time (only while one is set aside). */
export const losingTimeNearWords = (setAside: number): string =>
  `The next quest phase reveals a Losing Time: each player raises their threat by 3 or exhausts a hero. ${plural(setAside, "copy is", "copies are")} set aside.`;

/** The preview of the campaign card: the same clock, said for the card. */
export const losingTimePreviewWords = (resources: number, setAside: number): string => losingTimeWords(resources, setAside);

/** The preview of a safe location that is the active location: what it does now, and that it leaves at the end of the quest phase. */
export const safeActiveWords = (): string =>
  "Safe. While it is the active location, enemies make no engagement checks, the When Revealed effects of treacheries are ignored and the text of encounter side quests is blank. It goes to the victory display at the end of the quest phase.";

/** The preview of a safe location that is not the active location: what travelling to it does. */
export const safeStagedWords = (): string => "Safe. When the players travel here, every engaged enemy returns to the staging area.";

/** The line after a guarded location's preview: what holds it. */
export const guardedByWords = (guard: string): string => `Guarded by ${guard}. The players cannot travel here until ${guard} leaves play.`;

/** The line on a guard's preview: the objective it holds back. */
export const guardsWords = (objective: string): string => `It guards ${objective}. When it leaves play, ${objective} returns to the staging area and the players may travel to it.`;

/** The banner line of a treachery revealed while a safe location is active: its When Revealed effects are ignored, the treachery still goes to the discard pile. */
export const ignoredRevealWords = (treachery: string, location: string): string => `${treachery}: its When Revealed effects are ignored while ${location} is the active location.`;

/** The line on an encounter side quest whose text box is blank while a safe location is active. */
export const blankSideQuestWords = (location: string): string => `Its text box is blank while ${location} is the active location: its Forced, Response and constant effects do nothing.`;

/** The preview of No Rest on its host: what it does. */
export const noRestWords = (hero: string): string => `On ${hero}: it cannot ready and collects no resources in the resource phase. It is discarded when the players travel to a safe location.`;

/** The line on the hero that carries No Rest. */
export const noRestHostWords = (): string => "No Rest: it cannot ready and collects no resources. No Rest is discarded when the players travel to a safe location.";
