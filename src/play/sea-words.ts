// The words of the sea family's verbs (src/catalog/families/sea.ts) inside a choice: what a branch of a Choose does ("Either shift your heading
// off-course or deal 1 damage to each exhausted character", 11055:A:1).
import type { Instruction } from "../catalog/boundary.ts";
import type { ScenarioState } from "../rules/state.ts";

import type { ChoiceNames, PickWords } from "./choice-words.ts";

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
    case "DamageShip":
      return "deal damage to a Ship objective you control";
    case "SearchShips":
      return "add the Ship enemy with the highest Threat to the staging area";
    default:
      return null;
  }
}

/** What a sea verb that asks a player for a card or an option says to ask (dcce.prepare-your-fleet, 11171:A:2, 11016:B:3, 11021:A:1, 110139:A:4, 110139:B:5). Null for any other verb. */
export function seaPickWords(instruction: Instruction, names: ChoiceNames): PickWords | null {
  switch (instruction.verb) {
    case "PrepareFleet":
      return { verb: "Take", prompt: "Choose a ship-objective to take control of. One player must take the Dream-chaser." };
    case "FitShips":
      return { verb: "Fit", prompt: `Choose a Modification boon (${instruction.codes.map((code) => names.code(code)).join(", ")}) to attach to your ship-objective.` };
    case "TradeShipDamage":
      return { verb: "Choose", prompt: `You may deal ${instruction.damage} damage to your ship-objective to add ${instruction.resources} resource to a hero's pool.` };
    case "LookAtStages":
      return { verb: "Advance", prompt: "Look at the top stages of the quest deck and choose the one the quest advances to. The other goes to the bottom of the quest deck." };
    case "SearchShips":
      return { verb: "Add", prompt: "Choose which Ship enemy with the highest Threat is added to the staging area." };
    case "NameCard":
      return { verb: "Name", prompt: "Name a card in a deck." };
    case "DiscardFromAnyDeck":
      return { verb: "Discard", prompt: `Choose the deck whose top ${instruction.count === 1 ? "card is" : `${instruction.count} cards are`} discarded.` };
    default:
      return null;
  }
}

/** The label of an option a sea verb offers that is not a card: trade or keep the damage, a deck to discard from, a title to name. Null for a card (the sheet names it). */
export function seaOptionLabel(instruction: Instruction, id: string, game: ScenarioState, _names: ChoiceNames): string | null {
  if (instruction.verb === "TradeShipDamage" && (id === "trade" || id === "keep")) {
    return id === "trade" ? `Trade: ${instruction.damage} damage to the ship for ${instruction.resources} resource` : "Keep the ship as it is";
  }
  if (instruction.verb === "DiscardFromAnyDeck") {
    if (id === "encounter") return "The encounter deck";
    if (id === "corsair") return "The Corsair deck";
    if (id.startsWith("seat:")) return game.seatCount > 1 ? `Player ${Number(id.slice(5)) + 1}'s deck` : "Your deck";
  }
  if (instruction.verb === "NameCard" && id.startsWith("name:")) return id.slice("name:".length);
  return null;
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

/** The armed line of the commit's Pass (dcce.sailing-tests): nobody is committed, so nobody looks, and the heading stays shifted. */
export const SAILING_PASS_ARMED = "Tap again: nobody looks, and the heading stays shifted";

/** The commit's readout: "Looks at 3 cards · the Dream-chaser counts as 2". `counts` are the picked characters that count as more than one, with what gives it. */
export function sailingLookWords(total: number, counts: readonly { name: string; weight: number; sources: readonly string[] }[]): string {
  const base = `Looks at ${total} ${total === 1 ? "card" : "cards"}`;
  const extras = counts.map((row) => `the ${row.name} counts as ${row.weight}${row.sources.length > 0 ? ` (${row.sources.join(", ")})` : ""}`);
  return [base, ...extras].join(" · ");
}

/** The heading change in words ("Rain to Sun", or "Sun, no change"). */
export function headingChangeWords(from: string, to: string): string {
  return from === to ? `${from}, no change` : `${from} to ${to}`;
}

/** What one tap on "Shift on-course" does, and how many symbols the test would still ask after it: "Rain to Cloud · 1 more symbol". */
export function shiftReadoutWords(from: string, to: string, more: number): string {
  return more > 0 ? `${headingChangeWords(from, to)} · ${more} more ${more === 1 ? "symbol" : "symbols"}` : headingChangeWords(from, to);
}

/** A looked-at card's success in words, on the tray row and for a screen reader: "Success", or "Success ×2" with two symbols. */
export function successWords(success: number): string {
  return success === 1 ? "Success" : `Success ×${success}`;
}

/** The success medallion's count: "×2" with two symbols, nothing with one. */
export function medallionCount(success: number): string | null {
  return success > 1 ? `×${success}` : null;
}
