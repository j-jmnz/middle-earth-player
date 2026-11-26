// One walker over a record's instructions for the words tests: every instruction, nested ones too (`instructions` of Each,
// If, ...) and every branch of a Choose, each with the instruction that follows it in its list and the ones after that.
// The walker is src/play/words/record-path.ts, the one the asks files read their paths by.
import type { Instruction } from "../../src/catalog/boundary.ts";

export { walk } from "../../src/play/words/record-path.ts";

// The instructions that ask a player for a card: the sheet words them with pickWords (src/play/choice/sheets.ts).
export const ASKING_VERBS: ReadonlySet<string> = new Set(["Pick", "SearchMove", "AttachSelf", "ReturnToStaging", "DiscardFromHand", "DiscardAlliesForWillpower"]);

// The instructions that ask for something besides a Pick of a card: the sheet words them with pickWords too. EngageSeatWithMost (haradrim, 16061:A:3) asks the first player which tied seat it engages, so a scenario that deals it needs its entry.
const ASKING = new Set([...ASKING_VERBS, "PickEncounter", "ChooseX", "Reattach", "PlayFromHand", "PayToPlay", "SpendResources", "ChooseAmount", "DiscardRestricted", "AssignDamage", "CapRefresh", "EngageSeatWithMost"]);

/**
 * Does the instruction ask a player something the sheet has to word: a verb of ASKING, or RevealCorsair when the first player names who reveals it (12154:A:1; its other readings name nobody). The one predicate the words
 * tests (scenario-words.test.ts, asks.test.ts) share, so no test misses a verb the other reads.
 */
export const asksPlayer = (instruction: Instruction): boolean => ASKING.has(instruction.verb) || (instruction.verb === "RevealCorsair" && instruction.who === "anyPlayer");

/** Only a ReturnToStaging that lets the player choose an engaged enemy asks; the others send a known card back without a question. */
export const sendsWithoutAsking = (instruction: Instruction): boolean => instruction.verb === "ReturnToStaging" && !(instruction.target.kind === "engagedEnemies" && instruction.target.pick === "choose");
