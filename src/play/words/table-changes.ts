// Rules: rr.forced (data/rules/entries.json). What one move changes on the table, read from the two states and said in the table's own words: a card's progress, damage and resources, where a card went, whether it is exhausted, a seat's
// threat and a number the table holds that has words for players (WORDS: the temperature of Desert Crossing, held as a modifier of the table). The reducer decided each number; this only compares.
import type { CardInstance, ScenarioState } from "../../rules/core/state.ts";

const zoneWords = (zone: string): string => zone.replace(/([A-Z])/g, " $1").toLowerCase();

// The numbers the table holds as modifiers of "table" that a player reads, by their stat and in the words that name them. Every other table stat is bookkeeping of the engine (what was explored, how much staging threat was added):
// it is neither named nor compared.
const WORDS: Readonly<Record<string, string>> = { temperature: "Temperature" };

// The fields of the state that hold no game fact: the running frames and window, the counters, the undo log, and the order cards entered play in.
const NO_FACT: ReadonlySet<string> = new Set(["stack", "window", "frameSeq", "undo", "nextId", "seedCursor", "revealCursor", "clock"]);

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

// The whole reached state as a string, less what holds no game fact: so two moves that leave the same table compare equal.
function tableOf(state: ScenarioState): string {
  const { cards, modifiers, ...rest } = state;
  const kept = Object.fromEntries(Object.entries(rest).filter(([key]) => !NO_FACT.has(key)));
  const held = [...tableNumbers(state)].sort(([a], [b]) => a.localeCompare(b));
  const own = modifiers.filter((modifier) => modifier.instanceId !== "table").map((modifier) => JSON.stringify(modifier)).sort();
  const all = Object.values(cards).map(({ enteredPlay: _entered, ...card }) => card).sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify({ kept, cards: all, own, held });
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
  for (const [stat, amount] of tableNumbers(after)) if ((was.get(stat) ?? 0) !== amount) parts.push(`${WORDS[stat]} ${was.get(stat) ?? 0} to ${amount}`);
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
