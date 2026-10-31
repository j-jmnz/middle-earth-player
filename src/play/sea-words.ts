// The words of the sea family's verbs (src/catalog/families/sea.ts) inside a choice: what a branch of a Choose does ("Either shift your heading
// off-course or deal 1 damage to each exhausted character", 11055:A:1).
import type { Instruction } from "../catalog/boundary.ts";

/** One sea instruction in words, or null when it is not one of them. */
export function seaWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "ShiftHeading":
      return instruction.direction === "offCourse" ? "shift your heading off-course" : "shift your heading on-course";
    case "RevealCorsair": {
      const count = instruction.count == null ? "1" : typeof instruction.count === "number" ? String(instruction.count) : "X";
      return `reveal the top ${count === "1" ? "card" : `${count} cards`} of the Corsair deck and put ${count === "1" ? "it" : "them"} into play engaged with ${instruction.who === "eachSeat" ? "each player" : "you"}`;
    }
    case "EngageLastPlayer":
      return "it engages the last player";
    default:
      return null;
  }
}

// ---- What the table says of the sea family's pieces (phase 39b; docs/design-system-table.md). Pure, so a test reads every sentence. ----

/** Boarding's beat in the banner (dcce.boarding): "Boarding 2 · Corsair Warship: 2 Corsairs engage Player 1" (solo: "... engage you"). */
export function boardingWords(a: { ship: string; count: number; seat: number; seats: number }): string {
  const who = a.seats > 1 ? `Player ${a.seat + 1}` : "you";
  return `Boarding ${a.count} · ${a.ship}: ${a.count} ${a.count === 1 ? "Corsair engages" : "Corsairs engage"} ${who}`;
}

/** What a screen reader hears of a pile in the second slot: "Corsair deck, 9 cards", "Corsair discard pile, 2 cards". */
export function pileCountWords(name: string, count: number): string {
  return `${name}, ${count} ${count === 1 ? "card" : "cards"}`;
}

/** The web list's line for the second slot: "Corsair deck 9 · Corsair discard pile 2". */
export function secondSlotLine(rows: readonly { name: string; count: number }[]): string {
  return rows.map((row) => `${row.name} ${row.count}`).join(" · ");
}

/** The web list's line for the ships: "Ships: Dream-chaser, 3 damage; Dawn Star". */
export function shipsLine(ships: readonly { name: string; damage: number }[]): string {
  return `Ships: ${ships.map((ship) => (ship.damage > 0 ? `${ship.name}, ${ship.damage} damage` : ship.name)).join("; ")}`;
}

/** The web list's line for the Heading: "Heading: Rain (off-course)". */
export function headingLine(step: string, onCourse: boolean): string {
  return `Heading: ${step} (${onCourse ? "on-course" : "off-course"})`;
}

/** The Sailing test's title over its look (dcce.sailing-tests): "Sailing test · 2 successes". */
export function sailingTitle(successes: number): string {
  return `Sailing test · ${successes} ${successes === 1 ? "success" : "successes"}`;
}

/** The Sailing commit's title and its note (dcce.sailing-tests, step 2): characters exhaust and look at cards, and add no willpower. */
export const SAILING_COMMIT_TITLE = "Commit to the Sailing test";
export const SAILING_COMMIT_NOTE = "Tap characters to commit them to the test. They exhaust, and each looks at one card from the encounter deck. They add no willpower.";

/** The commit's readout: "Looks at 3 cards · the Dream-chaser counts as 2". `counts` are the picked characters that count as more than one, with what gives it. */
export function sailingLookWords(total: number, counts: readonly { name: string; weight: number; sources: readonly string[] }[]): string {
  const base = `Looks at ${total} ${total === 1 ? "card" : "cards"}`;
  const extras = counts.map((row) => `the ${row.name} counts as ${row.weight}${row.sources.length > 0 ? ` (${row.sources.join(", ")})` : ""}`);
  return [base, ...extras].join(" · ");
}

/** The answer's readout: the heading change the engine would make if every symbol left shifted ("Rain to Sun"). */
export function headingChangeWords(from: string, to: string): string {
  return from === to ? `${from}, no change` : `${from} to ${to}`;
}

/** The look list's row for a card, for a screen reader and the tray: "Success" when it prints the symbol, else nothing. */
export function lookRowWords(name: string, success: number): string {
  return success === 0 ? name : success === 1 ? `${name} · Success` : `${name} · Success ×${success}`;
}

/** The success medallion's count: "×2" with two symbols, nothing with one. */
export function medallionCount(success: number): string | null {
  return success > 1 ? `×${success}` : null;
}

/** The look strip is up and the table offers no Actions (dcce.sailing-tests, step 4): the dock says so. */
export const SAILING_NO_ACTIONS = "Actions are not used during a Sailing test.";
