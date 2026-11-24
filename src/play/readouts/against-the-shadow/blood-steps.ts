// Rules: ats.hidden-cards, ats.hidden-cards-turn-faceup, ats.ally-objectives (data/rules/entries.json); ledger lines 06117:B:1, 06117:B:2, 06118:A:1, 06118:B:3, 06128:A:3, 06132:A:1, 06133:A:1.
// What the hidden cards and the two allies of The Blood of Gondor did in one intent, read from the states before and after it and the intent's steps: the cards a player took (a count), the cards turned faceup (each by name, with where it went), the turn at 5 cards, a card discarded unseen,
// the two allies placed under Captured! and control passing with the first player token. The engine returns no step for any of them, so the table keeps the change on its own copy of the intent's last step (as villager-steps.ts does), and the banner and the log word it. A card taken stays unnamed
// and unseen: only a card that is faceup after the intent has a name. Nothing the engine returns, the save or the step log changes. Empty in any other scenario. Pure.
import { printedOf, type PrintedCard } from "../../../rules/core/printed.ts";
import type { EngineStep, ScenarioState } from "../../../rules/engine/reduce.ts";
import { hiddenIds } from "../../../rules/families/pelargir/hidden.ts";

import { controlWords, discardedWords, fiveWords, heldUnderWords, takenWords, turnedWords } from "../../words/scenarios/against-the-shadow/blood.ts";
import { live } from "./blood.ts";

const FIVE = 5;
// The cards whose effects take, turn or discard hidden cards: the one a change is credited to.
const SOURCES: ReadonlySet<string> = new Set(["06117", "06118", "06121", "06122", "06123", "06124", "06125", "06126", "06127", "06128", "06129", "06130", "06131", "06132"]);
const DARK_WOODS = "06128";
const ALLIES: ReadonlySet<string> = new Set(["06132", "06133"]);

/** Where a turned card went: engaged with a seat, destroyed, added to the staging area or discarded. */
export type Fate = { kind: "engaged"; seat: number } | { kind: "destroyed" } | { kind: "staging" } | { kind: "discarded" } | { kind: "elsewhere" };

/** One seat's change in an intent. `taken`: cards added to its list. `turned`: the cards that were in it and are faceup now, each with its fate. `unseen`: cards taken and turned in the same move (a fifth card), never named. `discarded`: cards discarded unseen. `source`: the card whose effect did it. */
export type SeatChange = { seat: number; taken: number; now: number; turned: readonly { id: string; fate: Fate; type: string | null }[]; unseen: boolean; discarded: number; source: string | null; travel: boolean };

/** What the allies did: placed under Captured!, or passed to a seat. */
export type AllyChange = { id: string; kind: "held" } | { id: string; kind: "control"; seat: number };

export type HiddenChange = { seats: readonly SeatChange[]; allies: readonly AllyChange[]; seatCount: number };

const sourceOf = (steps: readonly EngineStep[], before: ScenarioState): string | null => {
  for (const step of steps) if (step.kind === "push" && step.cardId != null && SOURCES.has(before.cards[step.cardId]?.code ?? "")) return step.cardId;
  return null;
};

function fateOf(after: ScenarioState, id: string, steps: readonly EngineStep[]): Fate {
  const zone = after.cards[id]?.zone;
  if (zone === "engaged") {
    const seat = after.seats.findIndex((entry) => entry.engaged.includes(id));
    return seat >= 0 ? { kind: "engaged", seat } : { kind: "elsewhere" };
  }
  if (steps.some((step) => step.kind === "destroy" && step.targetId === id)) return { kind: "destroyed" };
  if (zone === "staging") return { kind: "staging" };
  return zone === "encounterDiscard" ? { kind: "discarded" } : { kind: "elsewhere" };
}

/** The change between two states of one intent, or null when no hidden card or ally moved. */
export function hiddenChanges(before: ScenarioState, after: ScenarioState, steps: readonly EngineStep[], limit = false, typeOf?: (cardId: string) => string | null): HiddenChange | null {
  if (!live(after)) return null;
  const source = sourceOf(steps, before);
  const travel = after.activeLocation !== before.activeLocation && after.activeLocation != null && before.staging.includes(after.activeLocation);
  const seats: SeatChange[] = [];
  for (let seat = 0; seat < after.seatCount; seat += 1) {
    const was = hiddenIds(before, seat);
    const now = hiddenIds(after, seat);
    const left = was.filter((id) => after.cards[id] != null && !now.includes(id) && after.cards[id]?.zone !== "setAside").map((id) => ({ id, fate: fateOf(after, id, steps), type: typeOf?.(id) ?? null }));
    // The Dark Woods discards a card unseen: it goes to the discard pile like a turned treachery, but nothing about it is told.
    const quiet = source != null && before.cards[source]?.code === DARK_WOODS;
    const turned = quiet ? [] : left;
    const discarded = quiet ? left.length : 0;
    const added = now.filter((id) => !was.includes(id)).length;
    // Taken cards are the new ones in the list. A seat that held 4 and none now, with Captured!'s limit, took a fifth and turned it with the others.
    const unseen = limit && was.length >= FIVE - 1 && now.length === 0 && turned.length >= FIVE - 1 && source == null;
    if (added === 0 && turned.length === 0 && discarded === 0) continue;
    seats.push({ seat, taken: added, now: now.length, turned, unseen, discarded, source, travel });
  }
  const allies: AllyChange[] = [];
  for (const id of Object.keys(after.cards)) {
    const card = after.cards[id];
    const old = before.cards[id];
    if (!card || !old || !ALLIES.has(card.code)) continue;
    if (card.zone === "captive" && old.zone === "play") allies.push({ id, kind: "held" });
    else if (card.zone === "play" && old.zone === "play" && card.controller != null && old.controller != null && card.controller !== old.controller) allies.push({ id, kind: "control", seat: card.controller });
  }
  return seats.length === 0 && allies.length === 0 ? null : { seats, allies, seatCount: after.seatCount };
}

const FATE_WORDS = (fate: Fate): string => {
  switch (fate.kind) {
    case "engaged":
      return "engages";
    case "destroyed":
      return "is destroyed, so it never engages";
    case "staging":
      return "is added to the staging area";
    case "discarded":
      return "is discarded";
    default:
      return "has moved on";
  }
};

/** The lines of a change, each with the name of the cards it names (`name` reads a card's name by id). Never names a card that is facedown. */
export function hiddenLines(change: HiddenChange, name: (id: string) => string): string[] {
  const lines: string[] = [];
  const who = (seat: number): string => (change.seatCount > 1 ? `Player ${seat + 1}` : "You");
  const why = (entry: SeatChange): string | null => (entry.source != null ? name(entry.source) : entry.travel ? "Travel cost" : null);
  for (const entry of change.seats) {
    if (entry.taken > 0) lines.push(takenWords(who(entry.seat), entry.taken, entry.now, why(entry)));
    if (entry.unseen) lines.push(fiveWords(who(entry.seat)));
    if (entry.turned.length > 0) {
      lines.push(turnedWords(who(entry.seat), entry.turned.length + (entry.unseen ? 1 : 0), entry.unseen ? null : why(entry)));
      // An enemy that engages is told by the engine's own engage step; every other card says what it was and where it went.
      for (const turned of entry.turned) if (turned.fate.kind !== "engaged") lines.push(`${name(turned.id)}${turned.type ? ` (${turned.type})` : ""} ${FATE_WORDS(turned.fate)}`);
    }
    if (entry.discarded > 0) lines.push(discardedWords(who(entry.seat), why(entry)));
  }
  const held = change.allies.filter((ally) => ally.kind === "held");
  if (held.length > 0) lines.push(heldUnderWords(held.map((ally) => name(ally.id))));
  for (const ally of change.allies) if (ally.kind === "control") lines.push(controlWords(name(ally.id), change.seatCount, ally.seat));
  return lines;
}

/** The printed type of a card of the game ("enemy", "treachery", "location"): what a turned card was, said once it is faceup. */
export const typeIn = (game: ScenarioState, cards: ReadonlyMap<string, PrintedCard>) => (cardId: string): string | null => printedOf(cards, game.cards[cardId]?.code ?? "").type;

/** A step with the hidden-card change of its intent. */
export type HiddenStep = EngineStep & { hidden?: HiddenChange };

/** The steps with the intent's last step stamped with what the hidden cards did. The same steps when nothing changed. */
export function stampHidden(steps: readonly EngineStep[], before: ScenarioState, after: ScenarioState, typeOf?: (cardId: string) => string | null): readonly EngineStep[] {
  if (steps.length === 0 || !live(after)) return steps;
  const change = hiddenChanges(before, after, steps, (after.questStage != null && after.cards[after.questStage]?.code === "06118") || (before.questStage != null && before.cards[before.questStage]?.code === "06118"), typeOf);
  return change ? steps.map((step, at): HiddenStep => (at === steps.length - 1 ? { ...step, hidden: change } : step)) : steps;
}

/** The change a kept step carries: none when it was kept without one. */
export const hiddenOf = (step: EngineStep): HiddenChange | null => ("hidden" in step && step.hidden != null ? (step.hidden as HiddenChange) : null);
