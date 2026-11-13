// Rules: mec108.objective-locations, mec108.safe, rr.guarded, rr.reveal, rr.search, rr.setup (data/rules/entries.json); ledger lines 10064:A:1, 10064:B:1, 10065:A:1, 10066:A:1, 10182:A:3, 10182:B:1.
// The verbs of Across the Ettenmoors: the Setup pair (a random side quest guarding a random safe location), the reveal of a card an effect found (a discarded side quest, a set-aside Losing Time) and the Resolution's count of the copies lying in the encounter deck or discard pile.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard } from "../../interpret/amounts.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import { shuffleIds } from "../../core/seed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { startReveal } from "../../windows/frames.ts";
import { moveEncounter } from "../encounter/moves.ts";
import { guardWith } from "../objectives/guard.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The set-aside cards that are encounter side quests, and those that are objective-locations, in the order the deal set them aside. */
function setAsidePools(state: ScenarioState, ctx: ReduceContext): { sideQuests: string[]; locations: string[] } {
  const printedType = (id: string) => printedOf(ctx.cards, state.cards[id]?.code ?? "");
  return {
    sideQuests: state.setAside.filter((id) => printedType(id).type === "encounter-side-quest"),
    locations: state.setAside.filter((id) => printedType(id).objectiveLocation),
  };
}

/** StageRandomGuardedPair: a random set-aside side quest and a random set-aside safe location join the staging area, the side quest attached to the location as its guard (10064:A:1). The picks use the game's seed; nothing happens when either kind is not set aside. */
export function stageRandomGuardedPair(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const { sideQuests, locations } = setAsidePools(state, ctx);
  if (sideQuests.length === 0 || locations.length === 0) return state;
  const quests = shuffleIds(sideQuests, state.seed, state.seedCursor);
  const places = shuffleIds(locations, state.seed, quests.cursor);
  const quest = quests.ids[0];
  const place = places.ids[0];
  if (!quest || !place) return state;
  const seeded: ScenarioState = { ...state, seedCursor: places.cursor };
  const staged = moveEncounter(moveEncounter(seeded, place, "staging", focus.seat, ctx, steps), quest, "staging", focus.seat, ctx, steps);
  return guardWith(updateCard(updateCard(staged, place, { face: "up" }), quest, { face: "up" }), quest, place);
}

/** RevealCard: the card (the last picked one by default) is revealed by the actor as an encounter card, wherever it lies. Nothing happens when no card is picked. */
export function revealCard(state: ScenarioState, instruction: Verb<"RevealCard">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = refCard(state, instruction.card ?? "picked", frameScope(state, focus.seat, focus.sourceId));
  const card = id ? state.cards[id] : undefined;
  if (!id || !card) return state;
  return startReveal(state, focus.seat, ctx, steps, id, undefined, false, card.zone === "encounterDiscard");
}

/** RevealSetAsideForTokens: `tokens` resource tokens come off the source and a set-aside copy of the card is revealed; nothing happens with fewer tokens or no copy set aside. */
export function revealSetAsideForTokens(state: ScenarioState, instruction: Verb<"RevealSetAsideForTokens">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const copy = state.setAside.find((id) => state.cards[id]?.code === instruction.code);
  if (!source || !copy || source.resources < instruction.tokens) return state;
  const paid = updateCard(state, source.id, { resources: source.resources - instruction.tokens });
  return startReveal(paid, focus.seat, ctx, steps, copy);
}

/** The copies of the cards with these codes that lie in the encounter deck or discard pile, one pool entry for each (10182:B:1). */
export function encounterCopies(state: ScenarioState, codes: readonly string[], step: number): { code: string; to: "pool"; seat: null; hero: null; step: number }[] {
  return Object.values(state.cards)
    .filter((card) => codes.includes(card.code) && (card.zone === "encounterDeck" || card.zone === "encounterDiscard"))
    .map((card) => ({ code: card.code, to: "pool" as const, seat: null, hero: null, step }));
}
