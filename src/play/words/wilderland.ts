// Rules: emce.treasure, rr.guarded (data/rules/entries.json); ledger lines 12168:A:2, 12189:B:2. What the table says when the players look at random undiscovered treasures and choose one to attach as a
// guarded objective (AttachRandomTreasure). The sentence the choice sheet reads from. Pure.
import type { Instruction } from "../../catalog/boundary.ts";

import type { ChoiceNames, PickWords } from "./choice.ts";

/** The sentence and the verb of the choice AttachRandomTreasure asks, or null for another instruction. */
export function wilderlandAsk(instruction: Instruction, source: string | null, names: ChoiceNames): PickWords | null {
  if (instruction.verb !== "AttachRandomTreasure") return null;
  const choose = `Choose 1 of ${instruction.count ?? 3} random undiscovered treasures to attach as a guarded objective.`;
  // The guard is attached to the treasure and keeps it from being claimed until it is dealt with (rr.guarded).
  if (!source) return { verb: "Attach", prompt: choose };
  const host = names.card(source);
  return { verb: "Attach", prompt: `${choose} ${host} is attached to it, and the players cannot claim it until ${host} is dealt with.` };
}

/** The label of an option of that choice: the treasure's title. Null for another instruction. */
export function wilderlandOptionLabel(instruction: Instruction, id: string, names: ChoiceNames): string | null {
  return instruction.verb === "AttachRandomTreasure" ? names.code(id) : null;
}

// Discover X (emce.discover): the banner's beats, and the cards of the look strip. The engine's `discover` step names the cards looked at, the Loot objective that was attached and the Hazard card that was revealed;
// the rest went to the encounter discard pile. The strip lays out those (the Loot and the Hazard stand where they went, ringed by the same beat). Pure.

/** The prefix a banner beat puts on a card id to say "lay this card in the look strip" (store/beat-store.ts keeps the ids as a string). */
const LOOK_PREFIX = "look:";

/** A beat's card ids with the cards of the look strip told apart: the ids for the strip are returned without the prefix. */
export function lookIdsOf(beat: ReadonlySet<string>): readonly string[] {
  return [...beat].filter((id) => id.startsWith(LOOK_PREFIX)).map((id) => id.slice(LOOK_PREFIX.length));
}

/** The beat ids that lay these cards in the look strip. */
export function lookBeat(ids: readonly string[]): readonly string[] {
  return ids.map((id) => `${LOOK_PREFIX}${id}`);
}

/** What a Discover resolved: the location and how many cards were looked at, the Loot objective and the Hazard card (name and id) if any, and the ids of the rest, which went to the encounter discard pile. */
export type DiscoverFacts = { location: { id: string; name: string }; looked: number; loot: { id: string; name: string } | null; hazard: { id: string; name: string } | null; rest: readonly string[] };

const cards = (count: number): string => `${count} ${count === 1 ? "card" : "cards"}`;

/** The banner's title for the keyword. */
export function discoverTitle(depth: number): string {
  return `Discover ${depth}`;
}

/** The lines of the Discover beat in the order the rule resolves them: the look, the Loot objective, the Hazard, and the rest in the discard pile. Each says which cards the table rings; the rest are laid in the look strip. */
export function discoverLines(facts: DiscoverFacts): readonly { text: string; cards: readonly string[] }[] {
  const { location, loot, hazard, rest } = facts;
  const lines: { text: string; cards: readonly string[] }[] = [{ text: `${location.name}: looked at the top ${cards(facts.looked)} of the encounter deck`, cards: [location.id] }];
  if (loot) lines.push({ text: `${loot.name} is attached to ${location.name} as a guarded objective`, cards: [loot.id] });
  if (hazard) lines.push({ text: `${hazard.name} is revealed and added to the staging area`, cards: [hazard.id] });
  if (rest.length > 0) lines.push({ text: `${cards(rest.length)} ${rest.length === 1 ? "is" : "are"} placed in the encounter discard pile`, cards: lookBeat(rest) });
  else if (!loot && !hazard) lines.push({ text: "No Loot objective or Hazard card was among them", cards: [] });
  return lines;
}

/** The log's one line for the step, and the reader's name for the strip ("Discover look, 2 cards"). */
export function discoverLogLine(facts: Pick<DiscoverFacts, "looked"> & { location: string; loot: string | null; hazard: string | null }): string {
  return `Discover at ${facts.location}: looked at ${cards(facts.looked)}${facts.loot ? `, attached ${facts.loot}` : ""}${facts.hazard ? `, revealed ${facts.hazard}` : ""}`;
}

/** What a screen reader hears of the strip, and the web list's line for it. */
export function lookStripWords(count: number): string {
  return `Discover look, ${cards(count)} placed in the encounter discard pile`;
}
