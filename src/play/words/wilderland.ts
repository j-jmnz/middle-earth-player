// Rules: emce.treasure, rr.guarded (data/rules/entries.json); ledger lines 12168:A:2, 12189:B:2. What the table says when the players look at random undiscovered treasures and choose one to attach as a
// guarded objective (AttachRandomTreasure). The sentence the choice sheet reads from. Pure.
import type { Instruction } from "../../catalog/boundary.ts";
import { recordsOfFace } from "../../rules/families/dreamchaser/faces.ts";
import { printedOf } from "../../rules/core/printed.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { countMatching } from "../../rules/interpret/pick.ts";
import { effectsOf } from "../../rules/windows/listen.ts";

import type { BranchNow } from "./aflame.ts";
import type { ChoiceNames, PickWords } from "./choice.ts";

/** The table the words read: what is dealt now, the records, and the options the window offers. */
type Facts = { game: ScenarioState; ctx: ReduceContext; options: readonly string[] };

/** Whether the instruction draws random treasures for the players to choose among: the first step of a treasure draw (AttachRandomTreasure, ClaimRandomTreasure). */
export function isTreasureDraw(instruction: Instruction): instruction is Extract<Instruction, { verb: "AttachRandomTreasure" | "ClaimRandomTreasure" }> {
  return instruction.verb === "AttachRandomTreasure" || instruction.verb === "ClaimRandomTreasure";
}

// What a treasure attaches to, from its record ("Attach to a hero" for the one hero-only treasure, 12199:A:1): the noun of the character step.
function hostNoun(facts: Facts | undefined, treasure: string | null): string {
  const code = treasure ? facts?.game.cards[treasure]?.code : undefined;
  const host = code ? facts?.ctx.effects.flatMap((effect) => (effect.cardCode === code ? effect.instructions : [])).find((step) => step.verb === "AttachesTo") : undefined;
  return host?.verb === "AttachesTo" && host.host?.kind === "hero" ? "hero" : "character";
}

// Weighed Down (18027:A:1), on its way to a hero and on that hero's readying: who it goes to, and which attachment is discarded.
function weighedDownAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next: Instruction | undefined, facts: Facts | undefined): PickWords | null {
  const name = source ? names.card(source) : "This card";
  if (instruction.verb === "AttachSelf" && instruction.to.kind === "hero" && instruction.to.control === "mostAttachments") {
    const options = facts?.options ?? [];
    return options.length > 1
      ? { verb: "Attach", prompt: `Heroes are tied for the most attachments: choose who gets ${name}. That hero is exhausted.` }
      : { verb: "Attach", prompt: `${name} attaches to ${options[0] ? names.card(options[0]) : "the hero with the most attachments"}. That hero is exhausted.` };
  }
  const host = source ? facts?.game.cards[source]?.host : null;
  if (instruction.verb !== "Pick" || instruction.pick.attachedTo !== "host" || next?.verb !== "Discard" || next.target.kind !== "picked" || !host) return null;
  const hero = names.card(host);
  const itself = source != null && facts?.options.includes(source) === true;
  return { verb: "Discard", prompt: `${name}: choose an attachment to discard from ${hero}.${itself ? ` ${name} can discard itself: ${hero} has no other attachment that is not an objective.` : ""}` };
}

/** The sentence and the verb of the choice AttachRandomTreasure, ClaimRandomTreasure or Discover asks, or the character a claimed treasure goes on, or null for another instruction. */
export function wilderlandAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next?: Instruction, picked?: string | null, facts?: Facts): PickWords | null {
  // The character a claimed treasure is attached to (120165:A:3): the Pick of a card it may attach to (`hostForPicked`) before AttachPicked; the treasure is named once the table knows it.
  if (instruction.verb === "Pick" && instruction.pick.hostForPicked === true && next?.verb === "AttachPicked") {
    const noun = hostNoun(facts, picked ?? null);
    return { verb: "Attach", prompt: picked ? `Choose a ${noun} to carry ${names.card(picked)}.` : `Choose a ${noun} to attach it to.` };
  }
  // Turayn's Response (12166:A:2): the next damage the chosen character is dealt this round is lessened.
  if (instruction.verb === "Pick" && next?.verb === "ModifyStat" && next.stat === "damageShield") {
    const amount = typeof next.amount === "number" ? next.amount : 1;
    return { verb: "Protect", prompt: `Choose another character: the next time it would be dealt damage this round, cancel ${amount} of that damage.` };
  }
  const weighed = weighedDownAsk(instruction, source, names, next, facts);
  if (weighed) return weighed;
  // Discover X looked at several Loot objectives: the first player picks the one to attach to the active location (emce.discover).
  if (instruction.verb === "Discover") return { verb: "Attach", prompt: `Discover: choose 1 Loot objective to attach to ${source ? names.card(source) : "the active location"} as a guarded objective.` };
  // The treasures drawn, as many as there are (3 unless fewer are undiscovered): the step chooses one, the character step after it attaches it.
  const drawn = isTreasureDraw(instruction) ? (facts?.options.length || instruction.count || 3) : 0;
  // ClaimRandomTreasure (120165:A:3): the treasure is claimed for a character; the choice of the character follows (choice.ts, AttachPicked).
  if (instruction.verb === "ClaimRandomTreasure") return { verb: "Choose", prompt: `Choose 1 of ${drawn} random undiscovered treasures to attach to a character.` };
  // The Shadow card of Frenzied Creature goes on the attacking enemy, whom nobody chooses (18018:A:2).
  if (instruction.verb === "AttachSelf" && instruction.to.kind === "attackingEnemy") return { verb: "Attach", prompt: `Attach ${source ? names.card(source) : "this card"} to the attacking enemy.` };
  // Players tied for the most cards in hand: the first player names who takes the card (18026:A:1).
  if (instruction.verb === "AddSourceToHandOfMost") {
    const card = source ? names.card(source) : "this card";
    return { verb: "Choose", prompt: `Players are tied for the most cards in hand: choose who adds ${card} to their hand. Playing a card then discards that player's whole hand, and player card effects cannot discard ${card}.` };
  }
  if (instruction.verb !== "AttachRandomTreasure") return null;
  const choose = `Choose 1 of ${drawn} random undiscovered treasures to attach as a guarded objective.`;
  // The guard is attached to the treasure and keeps it from being claimed until it is dealt with (rr.guarded).
  if (!source) return { verb: "Choose", prompt: choose };
  const host = names.card(source);
  return { verb: "Choose", prompt: `${choose} ${host} is attached to it, and the players cannot claim it until ${host} is dealt with.` };
}

/** The label of an option of that choice: the treasure's title. Null for another instruction. */
export function wilderlandOptionLabel(instruction: Instruction, id: string, names: ChoiceNames): string | null {
  return isTreasureDraw(instruction) ? names.code(id) : null;
}

// A Choose whose branches count cards at the table (Ruined Supplies, 18025:A:2): the number each states now, read when the sheet is built. Null for any other Choose.
function countedBranch(option: Extract<Instruction, { verb: "Choose" }>["options"][number]): Extract<Instruction, { verb: "RaiseThreat" | "DamageEach" }> | null {
  const step = option.instructions.length === 1 ? option.instructions[0] : undefined;
  if (step?.verb === "RaiseThreat" && typeof step.amount === "object" && step.amount.count != null && step.amount.count.control === "you" && step.amount.count.committed !== true && (step.who ?? "actor") === "actor") return step;
  return step?.verb === "DamageEach" && typeof step.amount === "number" && step.pick?.control === "you" && step.engagedWith == null ? step : null;
}

/** The numbers a Choose states for its branches now: how many cards each count finds for the seat choosing. */
export function wilderlandBranchNow(game: ScenarioState, ctx: ReduceContext, choose: Extract<Instruction, { verb: "Choose" }>, seat: number, sourceId: string | null): Pick<BranchNow, "counted"> {
  const counted: Record<string, number> = {};
  for (const option of choose.options) {
    const step = countedBranch(option);
    const spec = step?.verb === "RaiseThreat" && typeof step.amount === "object" ? step.amount.count : step?.verb === "DamageEach" ? step.pick : undefined;
    if (spec) counted[option.id] = countMatching(game, spec, seat, sourceId, ctx);
  }
  return Object.keys(counted).length > 0 ? { counted } : {};
}

/** A branch that counts cards, with the number now: "Raise your threat by 3 (1 for each ally you control)", "Deal 1 damage to each ally you control (3)". Null for any other branch. */
export function wilderlandBranchWords(choose: Extract<Instruction, { verb: "Choose" }>, optionId: string, now?: BranchNow): string | null {
  const option = choose.options.find((entry) => entry.id === optionId);
  const step = option ? countedBranch(option) : null;
  const number = now?.counted?.[optionId];
  if (!step || number == null) return null;
  if (step.verb === "RaiseThreat") return `Raise your threat by ${number} (1 for each ${step.amount && typeof step.amount === "object" ? (step.amount.count?.type ?? "card") : "card"} you control)`;
  return `Deal ${step.amount} damage to each ${step.pick?.type ?? "card"} you control (${number})`;
}

/** What traveling to a location sets off when it makes each enemy in the staging area attack ("becomes the active location", The Old Ford 18016:A:3): the words of its row and the caution before the second tap. Null when it does not apply or no enemy waits. */
export function wilderlandTravel(game: ScenarioState, ctx: ReduceContext, locationId: string): { words: string; caution: string } | null {
  const location = game.cards[locationId];
  if (!location) return null;
  const attacks = recordsOfFace(location, effectsOf(ctx, location.code)).some((effect) => effect.timing === "forced" && effect.trigger === "becameActive" && effect.instructions.some((step) => step.verb === "Each" && step.instructions.some((inner) => inner.verb === "AttackFromStaging")));
  const waiting = game.staging.filter((id) => id !== locationId && printedOf(ctx.cards, game.cards[id]?.code ?? "").type === "enemy").length;
  if (!attacks || waiting === 0) return null;
  const words = `each enemy in the staging area attacks ${game.seatCount > 1 ? `Player ${game.firstPlayer + 1}` : "you"}`;
  return { words, caution: `Tap again: ${words}` };
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

/** What winning does with a card A Growing Threat set aside (emce.campaign-pool-encounter). */
export const POOL_COPY = "A copy joins the campaign pool if you win";

/** The log's line for the card set aside: "A Growing Threat sets Hill Troll aside. A copy joins the campaign pool if you win." */
export function setAsideLine(source: string, card: string): string {
  return `${source} sets ${card} aside. ${POOL_COPY}.`;
}
