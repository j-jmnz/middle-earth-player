// Rules: emce.treasure, emce.boon-allies, emce.campaign-pool-encounter, emce.campaign-log (data/rules/entries.json). The Ered Mithrin Campaign Log's own columns: the treasures discovered, the
// "Unique Allies Protecting Wilderland" lines, the boxes marked beside Beldis for each player and the encounter cards of the Campaign Pool with their copies. Pure.
import { ALLY_LINE_FACTS, BELDIS_BOXES, type AllyLine } from "../catalog/ally-lines.ts";
import type { Condition, Instruction } from "../catalog/boundary.ts";
import { campaignScenario, encounterCodes, type Difficulty, type ScenarioData } from "../catalog/scenario-data.ts";
import type { CampaignFacts } from "../rules/core/campaign-state.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { logCondition, type LogFacts } from "../rules/families/wilderland/log.ts";

import type { CampaignLog } from "./log.ts";

type WilderlandColumns = Pick<CampaignLog, "treasures" | "allyLines" | "beldisUses" | "encounterPool" | "campaignPool">;

/** The campaign these columns belong to (data/campaigns/ered-mithrin.json). */
export const WILDERLAND_CAMPAIGN = "ered-mithrin";

/**
 * The log as the game reads it (CampaignFacts), each fact left out while the log holds none. Only the Ered Mithrin campaign reads them, so every other campaign's game is dealt exactly as before.
 * `pool` lists the Campaign Pool's own cards, for the Resolution that lets each player remove one non-burden card (12187:B).
 */
export function wilderlandFacts(log: WilderlandColumns, campaignId: string): Pick<CampaignFacts, "treasures" | "allyLines" | "beldisUses" | "encounterPool" | "pool"> {
  if (campaignId !== WILDERLAND_CAMPAIGN) return {};
  return {
    ...(log.treasures.length > 0 ? { treasures: log.treasures } : {}),
    ...(log.allyLines.length > 0 ? { allyLines: log.allyLines } : {}),
    ...(log.beldisUses.some((used) => used > 0) ? { beldisUses: log.beldisUses } : {}),
    ...(Object.keys(log.encounterPool).length > 0 ? { encounterPool: log.encounterPool } : {}),
    ...(log.campaignPool.length > 0 ? { pool: log.campaignPool.map((card) => ({ code: card.code, seat: card.seat })) } : {}),
  };
}

/** The boxes marked beside Beldis for a seat (emce.campaign-log), never more than the four the log has. */
export function beldisUsed(log: Pick<CampaignLog, "beldisUses">, seat: number): number {
  return Math.min(BELDIS_BOXES, log.beldisUses[seat] ?? 0);
}

/** The copies map of a table with no collection behind it: no code is capped. */
export const NO_COPY_LIMITS: ReadonlyMap<string, number> = new Map();

/** The tally of the encounter cards in the pool, no code past the copies one collection holds (emce.campaign-pool-encounter). A code with no known limit keeps its count. */
export function cappedTally(tally: Readonly<Record<string, number>>, copies: ReadonlyMap<string, number> | undefined): Record<string, number> {
  return Object.fromEntries(Object.entries(tally).flatMap(([code, count]) => {
    const kept = Math.min(count, copies?.get(code) ?? count);
    return kept > 0 ? [[code, kept] as const] : [];
  }));
}

/** The codes of the pool's encounter cards, a code once for each copy, in code order: what the deal shuffles into the encounter deck. */
export function poolEncounterCopies(tally: Readonly<Record<string, number>>): string[] {
  return Object.keys(tally).sort().flatMap((code) => Array.from({ length: tally[code] ?? 0 }, () => code));
}

/**
 * Whether a campaign Setup instruction's condition holds, when it reads the Campaign Log ("If there are 6 or more treasures recorded in the campaign log, shuffle Dragon-sickness into
 * the encounter deck", 12193:A). Setup runs before any game state exists, so the log's own facts answer. A condition of any other kind holds, as every Setup line did before this one.
 */
export function logConditionHolds(when: Condition | undefined, facts: LogFacts | undefined): boolean {
  return when == null || !readsLog(when) || holdsByLog(when, facts);
}

// Whether the condition, or one it combines, reads the Campaign Log.
function readsLog(when: Condition): boolean {
  switch (when.kind) {
    case "logged":
    case "treasuresLogged":
      return true;
    case "not":
      return readsLog(when.condition);
    case "all":
    case "any":
      return when.conditions.some(readsLog);
    default:
      return false;
  }
}

function holdsByLog(when: Condition, facts: LogFacts | undefined): boolean {
  switch (when.kind) {
    case "not":
      return !holdsByLog(when.condition, facts);
    case "all":
      return when.conditions.every((condition) => holdsByLog(condition, facts));
    case "any":
      return when.conditions.some((condition) => holdsByLog(condition, facts));
    default:
      return logCondition(when, facts) ?? true;
  }
}

const NOUNS = { enemy: "enemies", location: "locations", treachery: "treacheries" } as const;

/**
 * The encounter deck as the campaign card's Setup finds it: the scenario's cards at the difficulty played (as the campaign deals them), the campaign card's own shuffles so far and the cards of the
 * pool the deal shuffles in (`pooled`, the codes step 8 of the checklist deals: emce.campaign-pool-encounter).
 */
export function searchableDeck(scenario: ScenarioData, difficulty: Difficulty | undefined, seatCount: number, pooled: readonly string[]): string[] {
  return [...encounterCodes(campaignScenario(scenario), difficulty, seatCount), ...pooled];
}

/** What a Setup search works on: the log's lines, the cards, the deck as it stands (the checklist's working copy, which the search takes the removed cards out of) and how the first player answers. */
export type DeckSearch = {
  allyLines: readonly AllyLine[];
  cards: ReadonlyMap<string, PrintedCard>;
  deck: string[];
  // The first player's next answer among `legal`, or null while there is none (the checklist asks for one, or refuses a wrong one).
  take: (legal: readonly string[], note: string) => string | null;
};

/**
 * RemoveFromEncounterDeckIfLogged (emce.boon-allies; 12170:A and the Setups after it): when the log records the line, the first player searches the encounter deck for cards of a type and removes
 * them from the game, up to the count (a deck with fewer of them gives what it has: rr.search). The first player names each by its code; a title with several copies can be named again.
 * Returns the codes removed, in order, the ones before a missing answer included.
 */
export function removeFromDeck(instruction: Extract<Instruction, { verb: "RemoveFromEncounterDeckIfLogged" }>, search: DeckSearch): { removed: string[] } {
  const { allyLines, cards, deck } = search;
  const removed: string[] = [];
  if (!allyLines.includes(instruction.line)) return { removed };
  const matches = (code: string): boolean => {
    const printed = cards.get(code);
    return printed != null && printed.type === instruction.cardType && !(instruction.nonUnique && printed.isUnique) && !(instruction.except ?? []).includes(printed.name);
  };
  for (let taken = 0; taken < instruction.count; taken += 1) {
    const options = [...new Set(deck.filter(matches))];
    if (options.length === 0) break;
    const noun = NOUNS[instruction.cardType];
    const answer = search.take(options, `\u201c${ALLY_LINE_FACTS[instruction.line].words}\u201d: search the encounter deck for ${instruction.count} ${instruction.nonUnique ? "non-unique " : ""}${noun} and remove them from the game. Card ${taken + 1} of ${Math.min(instruction.count, deck.filter(matches).length + taken)}.`);
    if (answer == null) break;
    deck.splice(deck.indexOf(answer), 1);
    removed.push(answer);
  }
  return { removed };
}
