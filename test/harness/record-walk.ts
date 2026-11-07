// One walker over a record's instructions for the words tests: every instruction, nested ones too (`instructions` of Each,
// If, ...) and every branch of a Choose, each with the instruction that follows it in its list and the ones after that.
// The walker is src/play/words/record-path.ts, the one the asks files read their paths by.
export { walk } from "../../src/play/words/record-path.ts";

// The instructions that ask a player for a card: the sheet words them with pickWords (src/play/choice/sheets.ts).
export const ASKING_VERBS: ReadonlySet<string> = new Set(["Pick", "SearchMove", "AttachSelf", "ReturnToStaging", "DiscardFromHand", "DiscardAlliesForWillpower"]);
