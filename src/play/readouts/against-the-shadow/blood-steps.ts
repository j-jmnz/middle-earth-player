// Rules: ats.hidden-cards, ats.hidden-cards-turn-faceup, ats.ally-objectives (data/rules/entries.json); ledger lines 06117:B:1, 06117:B:2, 06118:A:1, 06118:B:3, 06128:A:3, 06132:A:1, 06133:A:1.
// What the hidden cards and the two allies of The Blood of Gondor did in one intent, read from the states before and after it and the intent's steps: the cards a player took (a count), the cards turned faceup (each by name, with where it went), the turn at 5 cards, a card discarded unseen,
// the two allies placed under Captured! and control passing with the first player token. The engine returns no step for any of them, so the table keeps the change on its own copy of the intent's last step (as villager-steps.ts does; an intent that returned no step at all is given one
// bookkeeping step, `carryHidden`), and the banner and the log word it. A card taken stays unnamed and unseen: only a card that is faceup after the intent has a name. Nothing the engine returns, the save or the step log changes. Empty in any other scenario. Pure.
import { printedOf, type PrintedCard } from "../../../rules/core/printed.ts";
import type { EngineStep, ScenarioState } from "../../../rules/engine/reduce.ts";
import { hiddenIds } from "../../../rules/families/pelargir/hidden.ts";

import { controlWords, discardedWords, fiveWords, heldUnderWords, takenWords, turnedWords } from "../../words/scenarios/against-the-shadow/blood.ts";
import { live } from "./blood.ts";

// What each card's effects do with hidden cards, so a change is credited to the card that did it: a take to a card that takes, a turn to a card that turns (one intent can hold both, and a card that only takes never turned the cards the stage's sweep turned at 5).
// A frame name narrows a card whose frames differ: Mordor Looms takes when revealed and turns as a shadow card.
type Acts = { takes: readonly string[] | true; turns: readonly string[] | true; discards?: true };
const NONE: readonly string[] = [];
const ACTS: Readonly<Record<string, Acts>> = {
  "06117": { takes: true, turns: true },
  "06118": { takes: true, turns: ["whenRevealed"] },
  "06121": { takes: NONE, turns: true },
  "06122": { takes: true, turns: NONE },
  "06123": { takes: true, turns: NONE },
  "06124": { takes: true, turns: NONE },
  "06125": { takes: true, turns: NONE },
  "06126": { takes: true, turns: NONE },
  "06127": { takes: true, turns: NONE },
  "06128": { takes: NONE, turns: NONE, discards: true },
  "06129": { takes: NONE, turns: true },
  "06130": { takes: ["whenRevealed"], turns: ["shadow"] },
  "06131": { takes: ["shadow"], turns: NONE },
  "06132": { takes: NONE, turns: true },
};
type Kind = "takes" | "turns" | "discards";
const can = (code: string, frame: string, kind: Kind): boolean => {
  const acts = ACTS[code];
  if (!acts) return false;
  if (kind === "discards") return acts.discards === true;
  const frames = acts[kind];
  return frames === true || frames.includes(frame);
};
const DARK_WOODS = "06128";
const ALLIES: ReadonlySet<string> = new Set(["06132", "06133"]);

/** Where a turned card went: engaged with a seat, destroyed, added to the staging area, discarded or shuffled back into the encounter deck. */
export type Fate = { kind: "engaged"; seat: number } | { kind: "destroyed" } | { kind: "staging" } | { kind: "discarded" } | { kind: "deck" } | { kind: "elsewhere" };

/** One seat's change in an intent. `taken`: cards added to its list. `turned`: the cards that were in it and are faceup now, each with its fate. `unseen`: cards taken and turned in the same move (a fifth card), never named. `discarded`: cards discarded unseen. `takeSource`, `turnSource`, `discardSource`: the card whose effect did each (a turn with none is the stage's sweep at 5). */
export type SeatChange = { seat: number; taken: number; now: number; turned: readonly { id: string; fate: Fate; type: string | null }[]; unseen: boolean; discarded: number; takeSource: string | null; turnSource: string | null; discardSource: string | null; travel: boolean };

/** What the allies did: placed under Captured!, or passed to a seat. */
export type AllyChange = { id: string; kind: "held" } | { id: string; kind: "control"; seat: number };

export type HiddenChange = { seats: readonly SeatChange[]; allies: readonly AllyChange[]; seatCount: number; combat: boolean };

// The card whose effect did `kind` in the intent: the first frame its steps push that does it, else the frame of an earlier intent that this one answered (a Choose of the combat start).
const sourceOf = (kind: Kind, steps: readonly EngineStep[], before: ScenarioState): string | null => {
  for (const step of steps) if (step.kind === "push" && step.cardId != null && can(before.cards[step.cardId]?.code ?? "", step.frame, kind)) return step.cardId;
  const open = [...before.stack].reverse().find((frame) => frame.cardId != null && can(before.cards[frame.cardId]?.code ?? "", frame.frame, kind));
  return open?.cardId ?? null;
};

function fateOf(after: ScenarioState, id: string, steps: readonly EngineStep[]): Fate {
  const zone = after.cards[id]?.zone;
  if (zone === "engaged") {
    const seat = after.seats.findIndex((entry) => entry.engaged.includes(id));
    return seat >= 0 ? { kind: "engaged", seat } : { kind: "elsewhere" };
  }
  if (steps.some((step) => step.kind === "destroy" && step.targetId === id)) return { kind: "destroyed" };
  if (zone === "staging") return { kind: "staging" };
  if (zone === "encounterDeck") return { kind: "deck" };
  return zone === "encounterDiscard" ? { kind: "discarded" } : { kind: "elsewhere" };
}

/** The change between two states of one intent, or null when no hidden card or ally moved. */
export function hiddenChanges(before: ScenarioState, after: ScenarioState, steps: readonly EngineStep[], limit = false, typeOf?: (cardId: string) => string | null): HiddenChange | null {
  if (!live(after)) return null;
  const takeSource = sourceOf("takes", steps, before);
  const turnSource = sourceOf("turns", steps, before);
  const discardSource = sourceOf("discards", steps, before);
  const travel = after.activeLocation !== before.activeLocation && after.activeLocation != null && before.staging.includes(after.activeLocation);
  const seats: SeatChange[] = [];
  for (let seat = 0; seat < after.seatCount; seat += 1) {
    const was = hiddenIds(before, seat);
    const now = hiddenIds(after, seat);
    const left = was.filter((id) => after.cards[id] != null && !now.includes(id) && after.cards[id]?.zone !== "setAside").map((id) => ({ id, fate: fateOf(after, id, steps), type: typeOf?.(id) ?? null }));
    // The Dark Woods discards a card unseen: it goes to the discard pile like a turned treachery, but nothing about it is told.
    const quiet = discardSource != null && before.cards[discardSource]?.code === DARK_WOODS;
    const turned = quiet ? [] : left;
    const discarded = quiet ? left.length : 0;
    const added = now.filter((id) => !was.includes(id)).length;
    // Taken cards are the new ones in the list. A seat that held 4 and none now, with Captured!'s limit, took a fifth and turned it with the others.
    const unseen = limit && was.length >= 1 && turned.length >= was.length && turnSource == null && !quiet;
    if (added === 0 && turned.length === 0 && discarded === 0) continue;
    seats.push({ seat, taken: added, now: now.length, turned, unseen, discarded, takeSource, turnSource, discardSource, travel });
  }
  const allies: AllyChange[] = [];
  for (const id of Object.keys(after.cards)) {
    const card = after.cards[id];
    const old = before.cards[id];
    if (!card || !old || !ALLIES.has(card.code)) continue;
    if (card.zone === "captive" && old.zone === "play") allies.push({ id, kind: "held" });
    else if (card.zone === "play" && old.zone === "play" && card.controller != null && old.controller != null && card.controller !== old.controller) allies.push({ id, kind: "control", seat: card.controller });
  }
  return seats.length === 0 && allies.length === 0 ? null : { seats, allies, seatCount: after.seatCount, combat: after.phase === "Combat" };
}

// What became of a turned card, said under the line that turned it. An enemy that engages attacks this phase when the turn falls in the combat phase. A destroyed enemy never engages; the engine's own damage line says it was destroyed.
const fateWords = (fate: Fate, combat: boolean, seatCount: number): string => {
  switch (fate.kind) {
    case "engaged":
      return `engages ${seatCount > 1 ? `Player ${fate.seat + 1}` : "you"}${combat ? " and attacks this phase" : ""}`;
    case "destroyed":
      return "never engages";
    case "staging":
      return "is added to the staging area";
    case "discarded":
      return "is discarded";
    case "deck":
      return "is shuffled back into the encounter deck";
    default:
      return "has left the hidden cards";
  }
};

/** The lines of a change, each with the name of the cards it names (`name` reads a card's name by id; `log`: the lines of the log, which tells an engagement from the engine's own step). The turns come first, each card under its seat's turn line, then the cards taken and discarded. Never names a card that is facedown. */
export function hiddenLines(change: HiddenChange, name: (id: string) => string, log = false): string[] {
  const lines: string[] = [];
  const who = (seat: number): string => (change.seatCount > 1 ? `Player ${seat + 1}` : "You");
  const by = (source: string | null): string | null => (source != null ? name(source) : null);
  for (const entry of change.seats) {
    if (entry.turned.length === 0) continue;
    if (entry.unseen) lines.push(fiveWords(who(entry.seat)));
    lines.push(turnedWords(who(entry.seat), entry.turned.length + (entry.unseen ? 1 : 0), entry.unseen ? null : by(entry.turnSource)));
    // The log keeps the engine's own engage line for an enemy that engages.
    for (const turned of entry.turned) if (!(log && turned.fate.kind === "engaged")) lines.push(`${name(turned.id)}${turned.type ? ` (${turned.type})` : ""} ${fateWords(turned.fate, change.combat, change.seatCount)}`);
  }
  for (const entry of change.seats) if (entry.taken > 0) lines.push(takenWords(who(entry.seat), entry.taken, entry.now, by(entry.takeSource) ?? (entry.travel ? "Travel cost" : null)));
  for (const entry of change.seats) if (entry.discarded > 0) lines.push(discardedWords(who(entry.seat), by(entry.discardSource)));
  const held = change.allies.filter((ally) => ally.kind === "held");
  if (held.length > 0) lines.push(heldUnderWords(held.map((ally) => name(ally.id))));
  for (const ally of change.allies) if (ally.kind === "control") lines.push(controlWords(name(ally.id), change.seatCount, ally.seat));
  return lines;
}

/** The printed type of a card of the game ("enemy", "treachery", "location"): what a turned card was, said once it is faceup. */
export const typeIn = (game: ScenarioState, cards: ReadonlyMap<string, PrintedCard>) => (cardId: string): string | null => printedOf(cards, game.cards[cardId]?.code ?? "").type;

/** A step with the hidden-card change of its intent. */
export type HiddenStep = EngineStep & { hidden?: HiddenChange };

// Whether stage 2 (Captured!) is in play before or after the intent: its 5-card turn can fall in the intent.
const atFive = (before: ScenarioState, after: ScenarioState): boolean => (after.questStage != null && after.cards[after.questStage]?.code === "06118") || (before.questStage != null && before.cards[before.questStage]?.code === "06118");

// The bookkeeping step a choice that returned none is given, so the table keeps it (a frame pop is left out of the log and says nothing in the banner).
const CARRIER: EngineStep = { kind: "pop", frame: "forced", cardId: null, peril: false };

/** The steps of an intent, or one bookkeeping step when the engine returned none and a hidden card or ally moved (a Take or a Turn of a card that engages nobody): the table drops an intent with no step, and the change must reach the banner and the log. */
export function carryHidden(steps: readonly EngineStep[], before: ScenarioState, after: ScenarioState): readonly EngineStep[] {
  if (steps.length > 0 || !live(after)) return steps;
  return hiddenChanges(before, after, steps, atFive(before, after)) != null ? [CARRIER] : steps;
}

/** The steps with the intent's last step stamped with what the hidden cards did. The same steps when nothing changed. */
export function stampHidden(steps: readonly EngineStep[], before: ScenarioState, after: ScenarioState, typeOf?: (cardId: string) => string | null): readonly EngineStep[] {
  if (steps.length === 0 || !live(after)) return steps;
  const change = hiddenChanges(before, after, steps, atFive(before, after), typeOf);
  return change ? steps.map((step, at): HiddenStep => (at === steps.length - 1 ? { ...step, hidden: change } : step)) : steps;
}

/** The change a kept step carries: none when it was kept without one. */
export const hiddenOf = (step: EngineStep): HiddenChange | null => ("hidden" in step && step.hidden != null ? (step.hidden as HiddenChange) : null);
