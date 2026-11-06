// Rules: rr.quest-cards-quest-deck, rr.quest-advancement, dcce.heading (data/rules/entries.json); ledger lines 11016:A:1, 11016:B:3, 11017:B:3.
//
// A quest whose stages say LookAtStages (Voyage Across Belegaer) advances in the order of its quest deck: the Setup puts the stage 2 cards in a random
// order (ShuffleStages), and the stage defeated moves the quest to the top stage of the deck, or, on-course (Sun), to one of the top two the first player
// looks at and chooses, the other going to the bottom. This is the quest-order half beside `branch` (quest/branch.ts): a quest that branches never
// holds a `look`, and a quest that holds one never branches.
import type { Effect } from "../../../catalog/boundary.ts";

import { shuffleIds } from "../../core/seed.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import { moveCard } from "../../core/zones.ts";
import { recordSide } from "../dreamchaser/faces.ts";
import { headingIs } from "../sea/heading.ts";

/** The quest advances in the order of its quest deck: some stage of it names LookAtStages, or is a stage of a quest deck whose cards flip at the quest phase (FlipAtQuestPhase, Mount Gundabad). */
export function orderedQuest(state: Pick<ScenarioState, "stages">): boolean {
  return state.stages.some((stage) => stage.look != null || stage.deck === true);
}

/** The stage `code` is a stage 2 of Mount Gundabad's quest deck: it arrives with side A up and the quest has no stage 3 (emce.gundabad-quest-deck). */
export function deckStage(state: Pick<ScenarioState, "stages">, code: string): boolean {
  return state.stages.some((stage) => stage.code === code && stage.deck === true);
}

/**
 * The records of a stage 2 of Mount Gundabad's quest deck that work now: it shows side A from its reveal until the beginning of the quest phase, and only the text printed on side A works until then (emce.gundabad-quest-deck). Any other card keeps its records;
 * other quests flip a stage as it arrives and keep a stage's side A text beside its side B.
 */
export function unflippedStage(state: Pick<ScenarioState, "stages">, instance: Pick<CardInstance, "zone" | "face">, records: readonly Effect[]): readonly Effect[] {
  if (instance.zone !== "questStage" || instance.face !== "A" || !state.stages.some((stage) => stage.deck === true)) return records;
  return records.filter((effect) => recordSide(effect) !== "B");
}

/** The side a stage shows as the quest arrives at it: side A for a stage of a quest deck that flips at the quest phase, else side B. */
export function arrivalFace(state: Pick<ScenarioState, "stages">, code: string | undefined): "A" | "B" {
  return code != null && deckStage(state, code) ? "A" : "B";
}

/** Where the quest goes when the stage `currentCode` is defeated, for an ordered quest (null for any other): to the top stage of the deck (`next`), to a
 * choice the first player makes (`ask`, once: the verb that asked it has put the chosen stage on top, and `stageChoice` is "asking"), or nowhere (`end`: the
 * deck is empty or the stage is the last one, so defeating it wins the game). */
export type OrderedNext = { kind: "next"; id: string } | { kind: "ask" } | { kind: "end" };

export function orderedNext(state: ScenarioState, currentCode: string): OrderedNext | null {
  if (!orderedQuest(state)) return null;
  const top = state.questDeck[0];
  // A quest deck of stage 2s (Mount Gundabad) has no stage 3: every stage leads to the top of the deck and the last one defeated wins the game.
  const deck = state.stages.some((stage) => stage.deck === true);
  // A stage that does not look at the next ones is the last the quest has (Corsair Pursuit, 11021): defeating it wins the game, whatever stage cards are left in the deck.
  const look = state.stages.find((stage) => stage.code === currentCode)?.look;
  if (top == null || (look == null && !deck)) return { kind: "end" };
  if (look != null && state.stageChoice == null && state.questDeck.length >= 2 && (deck || headingIs(state, "onCourse"))) return { kind: "ask" };
  return { kind: "next", id: top };
}

/** ShuffleStages: the quest cards named by `codes` that are in the quest deck go on top of it in a random order; the others keep their order below. */
export function shuffleStages(state: ScenarioState, codes: readonly string[]): ScenarioState {
  const named = state.questDeck.filter((id) => codes.includes(state.cards[id]?.code ?? ""));
  const rest = state.questDeck.filter((id) => !named.includes(id));
  const shuffled = shuffleIds(named, state.seed, state.seedCursor);
  return { ...state, questDeck: [...shuffled.ids, ...rest], seedCursor: shuffled.cursor };
}

/** The stages the first player looks at: the top `count` of the quest deck. */
export function lookedStages(state: ScenarioState, count: number): string[] {
  return state.questDeck.slice(0, count);
}

/** The stage chosen goes to the bottom of the quest deck and the others looked at stay on top (LookAtStages `bottom`, 19140:B:2). */
export function bottomStage(state: ScenarioState, chosen: string): ScenarioState {
  return moveCard(state, chosen, { zone: "questDeck" });
}

/** The stage chosen goes on top, and every other stage looked at goes to the bottom of the quest deck. */
export function keepStage(state: ScenarioState, looked: readonly string[], chosen: string): ScenarioState {
  let next = state;
  for (const id of looked) if (id !== chosen) next = moveCard(next, id, { zone: "questDeck" });
  return next;
}

/** A quest stage that prints Victory (11016, 11017 to 11020) goes to the victory display when it is defeated, in a game with ships: the campaign card
 * counts "stage 2B quest cards in the victory display" (11171:B:4; ltp.victory-display). The gate is `sea`, the state of a game with a Heading card: a stage that prints Victory in any other game
 * goes where it always went, and no other quest in a game with ships is told apart. */
export function stageToVictory(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, code: string): boolean {
  // A quest deck of stage 2s: the stage 1 and each stage 2 that is defeated are added to the victory display (19134:B:1, emce.bypassing "players will either add it to their victory display or win the game").
  if (state.stages.some((stage) => stage.deck === true)) return printedOf(cards, code).victory != null;
  return state.sea != null && printedOf(cards, code).victory != null;
}
