// Rules: rr.forced (data/rules/entries.json). What one move changes on the table, read from the two states and said in the table's own words: a card's progress, damage and resources, where a card went, whether it is exhausted, a seat's
// threat and a number the table holds that has words for players (WORDS: the temperature of Desert Crossing, held as a modifier of the table). The reducer decided each number; this only compares.
import type { CardInstance, ScenarioState } from "../../rules/core/state.ts";
import { tableFacts } from "../../rules/quest/surge-chain.ts";

const zoneWords = (zone: string): string => zone.replace(/([A-Z])/g, " $1").toLowerCase();

// The numbers the table holds as modifiers of "table" that a player reads, by their stat and in the words that name them. Only this list is named in a row; every modifier, these included, is compared.
const WORDS: Readonly<Record<string, string>> = { temperature: "Temperature" };

// The modifiers left out of the comparison: notes the engine keeps that hold no game fact of their own, each set as a side effect of a change the table shows anyway (a card that moved or turned up), so two orders that reach the same cards never differ by them. `engagedThisPhase` (an enemy engaged: its card moved), `enemyRevealed` and
// `ambushEnemyRevealed` (the first enemy revealed this round: its card is in the staging area), `locationRevealed` (a location revealed this round) and `questTotalAnnounced` (the quest total was counted: once each phase, whatever the order). Every other modifier (moreStagingThreat, skipQuestPhase, doesNotReady, temperature, a flag on a card) is a game fact. The fields of the state that
// hold none are left out by `tableFacts` (src/rules/quest/surge-chain.ts), which the surge chain's check shares.
const BOOKKEEPING: ReadonlySet<string> = new Set(["engagedThisPhase", "enemyRevealed", "ambushEnemyRevealed", "locationRevealed", "questTotalAnnounced"]);

function cardChanges(was: CardInstance, now: CardInstance, name: string): string[] {
  const parts: string[] = [];
  if (was.zone !== now.zone) parts.push(`${name} moves from ${zoneWords(was.zone)} to ${zoneWords(now.zone)}`);
  else if (was.host !== now.host) parts.push(`${name} moves`);
  if (was.progress !== now.progress) parts.push(`Progress on ${name} ${was.progress} to ${now.progress}`);
  if (was.damage !== now.damage) parts.push(`Damage on ${name} ${was.damage} to ${now.damage}`);
  if (was.resources !== now.resources) parts.push(`Resource tokens on ${name} ${was.resources} to ${now.resources}`);
  if (was.exhausted !== now.exhausted) parts.push(`${name} ${now.exhausted ? "exhausts" : "readies"}`);
  if (was.face !== now.face) parts.push(`${name} turns over`);
  return parts;
}

// The numbers the table holds with words, by their stat; the modifiers of one stat add up.
function tableNumbers(game: ScenarioState): Map<string, number> {
  const held = new Map<string, number>();
  for (const modifier of game.modifiers) if (modifier.instanceId === "table" && modifier.stat in WORDS) held.set(modifier.stat, (held.get(modifier.stat) ?? 0) + modifier.amount);
  return held;
}

// The reached table as a string: the facts of the state (`tableFacts`) and its modifiers but the bookkeeping ones, in a fixed order, so two moves that leave the same table compare equal.
function tableOf(state: ScenarioState): string {
  const facts = tableFacts(state);
  const modifiers = facts.modifiers.filter((modifier) => !BOOKKEEPING.has(modifier.stat)).map((modifier) => JSON.stringify(modifier)).sort();
  return JSON.stringify({ ...facts, modifiers, cards: [...facts.cards].sort((a, b) => a.id.localeCompare(b.id)) });
}

/** What a move from `before` to `after` reaches: its changes as sentences, and the table it leaves as a string, so two moves that leave the same table compare equal. */
export type Reach = { readonly parts: readonly string[]; readonly table: string };

export function reachOf(before: ScenarioState, after: ScenarioState, nameOf: (cardId: string) => string): Reach {
  const parts = Object.values(after.cards).flatMap((now) => {
    const was = before.cards[now.id];
    return was ? cardChanges(was, now, nameOf(now.id)) : [];
  });
  after.seats.forEach((seat, at) => {
    const from = before.seats[at]?.threat ?? seat.threat;
    if (from !== seat.threat) parts.push(`${before.seatCount > 1 ? `Player ${at + 1} threat` : "Threat"} ${from} to ${seat.threat}`);
  });
  const was = tableNumbers(before);
  const now = tableNumbers(after);
  for (const stat of new Set([...was.keys(), ...now.keys()])) if ((was.get(stat) ?? 0) !== (now.get(stat) ?? 0)) parts.push(`${WORDS[stat]} ${was.get(stat) ?? 0} to ${now.get(stat) ?? 0}`);
  return { parts, table: tableOf(after) };
}

/** Changes as one phrase, every one of them: a row that cannot hold them all ends in an ellipsis and its Result comes first. */
export function said(parts: readonly string[]): string {
  return parts.length === 0 ? "nothing else changes" : parts.join(", ");
}

/** The changes of `reach` that not every move in `all` makes (what the order decides, not what follows it anyway), as one phrase. */
export function decidedBy(reach: Reach, all: readonly Reach[]): string {
  const parts = reach.parts.filter((part) => !all.every((other) => other.parts.includes(part)));
  if (parts.length === 0 && all.some((other) => other.table !== reach.table)) return "the table differs in ways this list does not name";
  return said(parts);
}
