// Rules: emce.treasure, rr.guarded (data/rules/entries.json); ledger lines 12168:A:2, 12189:B:2. What the table says when the players look at random undiscovered treasures and choose one to attach as a
// guarded objective (AttachRandomTreasure). The sentence the choice sheet reads from. Pure.
import type { Instruction } from "../../catalog/boundary.ts";

import type { ChoiceNames, PickWords } from "./choice.ts";

/** The sentence and the verb of the choice AttachRandomTreasure, ClaimRandomTreasure or Discover asks, or the character a claimed treasure goes on, or null for another instruction. */
export function wilderlandAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next?: Instruction, picked?: string | null): PickWords | null {
  // The character a claimed treasure is attached to (120165:A:3): the Pick of a card it may attach to (`hostForPicked`) before AttachPicked; the treasure is named once the table knows it.
  if (instruction.verb === "Pick" && instruction.pick.hostForPicked === true && next?.verb === "AttachPicked") return { verb: "Attach", prompt: picked ? `Choose a character to carry ${names.card(picked)}.` : "Choose a character to attach it to." };
  // Discover X looked at several Loot objectives: the first player picks the one to attach to the active location (emce.discover).
  if (instruction.verb === "Discover") return { verb: "Attach", prompt: `Discover: choose 1 Loot objective to attach to ${source ? names.card(source) : "the active location"} as a guarded objective.` };
  // ClaimRandomTreasure (120165:A:3): the treasure is claimed for a character; the choice of the character follows (choice.ts, AttachPicked).
  if (instruction.verb === "ClaimRandomTreasure") return { verb: "Attach", prompt: `Choose 1 of ${instruction.count ?? 3} random undiscovered treasures to attach to a character.` };
  // The Shadow card of Frenzied Creature goes on the attacking enemy, whom nobody chooses (18018:A:2).
  if (instruction.verb === "AttachSelf" && instruction.to.kind === "attackingEnemy") return { verb: "Attach", prompt: `Attach ${source ? names.card(source) : "this card"} to the attacking enemy.` };
  // Players tied for the most cards in hand: the first player names who takes the card (18026:A:1).
  if (instruction.verb === "AddSourceToHandOfMost") return { verb: "Choose", prompt: `Players are tied for the most cards in hand: choose who adds ${source ? names.card(source) : "this card"} to their hand.` };
  if (instruction.verb !== "AttachRandomTreasure") return null;
  const choose = `Choose 1 of ${instruction.count ?? 3} random undiscovered treasures to attach as a guarded objective.`;
  // The guard is attached to the treasure and keeps it from being claimed until it is dealt with (rr.guarded).
  if (!source) return { verb: "Attach", prompt: choose };
  const host = names.card(source);
  return { verb: "Attach", prompt: `${choose} ${host} is attached to it, and the players cannot claim it until ${host} is dealt with.` };
}

/** The label of an option of that choice: the treasure's title. Null for another instruction. */
export function wilderlandOptionLabel(instruction: Instruction, id: string, names: ChoiceNames): string | null {
  return instruction.verb === "AttachRandomTreasure" || instruction.verb === "ClaimRandomTreasure" ? names.code(id) : null;
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

/**
 * What a Discover resolved: the location and how many cards were looked at, the Loot objective and the Hazard card (name and id) if any, and the ids of the rest, which went to the encounter discard pile.
 * `staged` says the Hazard stands in the staging area (an enemy or a location); a treachery is resolved and lies in the discard pile.
 */
export type DiscoverFacts = {
  location: { id: string; name: string };
  looked: number;
  loot: { id: string; name: string } | null;
  hazard: { id: string; name: string; staged: boolean } | null;
  rest: readonly string[];
};

const cards = (count: number): string => `${count} ${count === 1 ? "card" : "cards"}`;

/** The banner's title for the keyword. */
export function discoverTitle(depth: number): string {
  return `Discover ${depth}`;
}

/**
 * The lines of the Discover beat in the order the rule resolves them: the look, the Loot objective, the Hazard, and the rest in the discard pile. Each says which cards the table rings. The last line lays the rest in the
 * look strip and rings the Loot objective and the staged Hazard, which stand above the strip's veil; it is the beat the banner holds until it is dismissed (and the only one drawn under reduced motion).
 */
export function discoverLines(facts: DiscoverFacts): readonly { text: string; cards: readonly string[] }[] {
  const { location, loot, hazard, rest } = facts;
  const lines: { text: string; cards: readonly string[] }[] = [{ text: `${location.name}: looked at the top ${cards(facts.looked)} of the encounter deck`, cards: [location.id] }];
  if (loot) lines.push({ text: `${loot.name} is attached to ${location.name} as a guarded objective`, cards: [loot.id] });
  if (hazard) lines.push(hazard.staged ? { text: `${hazard.name} is revealed and added to the staging area`, cards: [hazard.id] } : { text: `${hazard.name} is revealed`, cards: [] });
  if (rest.length > 0) {
    const stands = [...(loot ? [loot.id] : []), ...(hazard?.staged ? [hazard.id] : [])];
    lines.push({ text: `${cards(rest.length)} ${rest.length === 1 ? "is" : "are"} placed in the encounter discard pile`, cards: [...lookBeat(rest), ...stands] });
  } else if (!loot && !hazard) lines.push({ text: "No Loot objective or Hazard card was among them", cards: [] });
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

