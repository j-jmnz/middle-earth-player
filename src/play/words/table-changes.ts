// Rules: rr.forced (data/rules/entries.json). What one move changes on the table, read from the two states and said in the table's own words: a card's progress, damage and resources, where a card went, whether it is exhausted, a seat's
// threat and a number the table holds (the temperature of Desert Crossing, held as a modifier of the table). The reducer decided each number; this only compares.
import type { CardInstance, ScenarioState } from "../../rules/core/state.ts";

const MOST = 6;

const zoneWords = (zone: string): string => zone.replace(/([A-Z])/g, " $1").toLowerCase();

function cardChanges(was: CardInstance, now: CardInstance, name: string): string[] {
  const parts: string[] = [];
  if (was.zone !== now.zone) parts.push(`${name} moves from ${zoneWords(was.zone)} to ${zoneWords(now.zone)}`);
  else if (was.host !== now.host) parts.push(`${name} moves`);
  for (const key of ["progress", "damage", "resources"] as const) if (was[key] !== now[key]) parts.push(`${name} ${key === "resources" ? "resource tokens" : key} ${was[key]} to ${now[key]}`);
  if (was.exhausted !== now.exhausted) parts.push(`${name} ${now.exhausted ? "exhausts" : "readies"}`);
  if (was.face !== now.face) parts.push(`${name} turns over`);
  return parts;
}

// The numbers the table holds as modifiers of "table", by their stat.
function tableNumbers(game: ScenarioState): Map<string, number> {
  const held = new Map<string, number>();
  for (const modifier of game.modifiers) if (modifier.instanceId === "table") held.set(modifier.stat, modifier.amount);
  return held;
}

/** What a move from `before` to `after` reaches: its changes as sentences, and the table it leaves as a string, so two moves that leave the same table compare equal (the cards without the order they entered play in, the seats, the numbers the table holds). */
export type Reach = { readonly parts: readonly string[]; readonly table: string };

export function reachOf(before: ScenarioState, after: ScenarioState, nameOf: (cardId: string) => string): Reach {
  const parts = Object.values(after.cards).flatMap((now) => {
    const was = before.cards[now.id];
    return was ? cardChanges(was, now, nameOf(now.id)) : [];
  });
  after.seats.forEach((seat, at) => {
    const from = before.seats[at]?.threat ?? seat.threat;
    if (from !== seat.threat) parts.push(`${before.seatCount > 1 ? `Player ${at + 1} threat` : "threat"} ${from} to ${seat.threat}`);
  });
  const was = tableNumbers(before);
  for (const [stat, amount] of tableNumbers(after)) if ((was.get(stat) ?? 0) !== amount) parts.push(`${stat} ${was.get(stat) ?? 0} to ${amount}`);
  const cards = Object.values(after.cards).map(({ enteredPlay: _entered, ...card }) => card);
  return { parts, table: JSON.stringify({ cards, seats: after.seats, modifiers: after.modifiers }) };
}

/** The changes of `reach` that not every move in `all` makes (what the order decides, not what follows it anyway), as one phrase. */
export function decidedBy(reach: Reach, all: readonly Reach[]): string {
  const parts = reach.parts.filter((part) => !all.every((other) => other.parts.includes(part)));
  if (parts.length === 0) return "nothing else changes";
  return parts.length > MOST ? `${parts.slice(0, MOST).join(", ")} and ${parts.length - MOST} more` : parts.join(", ");
}
