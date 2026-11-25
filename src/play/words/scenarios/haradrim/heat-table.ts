// Rules: hrd.heat-tracker (data/rules/entries.json); ledger lines 16068:A:1, 16068:B:3, 16069:B:2, 16070:B:3 (docs/scenarios/haradrim/desert-crossing.md, Table).
// What the table says of Desert Crossing's pieces (src/play/readouts/haradrim/heat.ts): the temperature against its limit of 60. The blank text box and the bar on readying are shared (src/play/words/card-bars.ts).
import { LOSE_AT_60 } from "../../../../effects/authored/haradrim/desert-crossing.ts";

// The engine decided every number; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).

/** The loss: the players lose when the temperature is this or more, read from the stages' loss record. */
export const HEAT_LIMIT: number = LOSE_AT_60.when.min;

/** The label of the temperature dial. */
export const HEAT_LABEL = "Heat";

/** The dial's name for the reader, before the number. */
export const HEAT_NAME = "Temperature";

/** What the reader hears after the limit. */
export const heatLimitWords = `the players lose at ${HEAT_LIMIT}`;

/** The note spoken after the dial: the tens digit the cards read as X, and where the loss stands. */
export const heatWords = (value: number): string => `The cards read X, the tens digit of the temperature, as ${Math.floor(value / 10)}.`;

/** The lines of the panel a tap on the dial opens (which also lets the dial drop its word where the bar is short): the value, X, and the loss. */
export const heatPanel = (value: number): readonly string[] => [`The temperature is ${value}.`, `X is its tens digit, ${Math.floor(value / 10)}.`, `The players lose at ${HEAT_LIMIT}.`];

/** The warning near the limit: the temperature and what is left before it. */
export const heatNearWords = (value: number): string => `${HEAT_LIMIT - value} from the limit of ${HEAT_LIMIT}`;
