// Rules: hob.staging-area-creating, hob.staging-area-combining, mec109.multiple-staging-areas (data/rules/entries.json); ledger lines 132068:B:1, 132069:B:2.
//
// Flies and Spiders splits the players in two at stage 2B: the first player takes stage 3 and a staging area of his own (SplitToOwnStage, families/breaking/barrow.ts), the others share the original area and advance to stage 4 (AdvanceOtherPlayers). Alone, he discards stage 2 and its cards
// instead. Stage 3B holds its defeat until the end of the quest phase (families/breaking, `holdsWin` and a delayed effect), then JoinAtStage joins him to the others at stage 4, or advances him alone.
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { livingSeats, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { Focus } from "../index.ts";
import { advanceToStage } from "../breaking/index.ts";
import { foldIfShared, returnToSharedStage } from "../breaking/barrow.ts";
import { mirrorActive, sharedStaging, withView } from "../breaking/areas.ts";

// The stage a seat holds, by its printed code.
const codeOf = (state: ScenarioState, seat: number): string | undefined => state.cards[state.seats[seat]?.stage ?? ""]?.code;

/** AdvanceOtherPlayers: every living player but the acting one advances from the shared stage to the stage with this printed code, in his view of the areas. With no other player the parked stage and the cards of its staging area are discarded and the areas fold back to the acting player's. */
export function advanceOtherPlayers(state: ScenarioState, code: string, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (!state.separate) return state;
  const others = livingSeats(state).filter((seat) => seat !== focus.seat);
  if (others.length > 0) {
    // The others left the shared stage 2, not the stage 3 the first player holds: stage 2 is the stage defeated before stage 4. noteSkippedStage reads the stage before it in order, which is in play for the first player, so the stage left is set before the advance (it queues the defeat).
    const parked = state.seats[others[0] ?? 0]?.stage;
    const arriving = state.questDeck.find((id) => state.cards[id]?.code === code);
    let next: ScenarioState = parked && arriving ? { ...state, stageLeft: { to: arriving, from: parked } } : state;
    for (const seat of others) next = withView(next, seat, (view) => advanceToStage(view, code, ctx, steps));
    return next;
  }
  // Alone: nobody is at the stage the first player left; it is discarded as the stage of an eliminated player is, with each card of its staging area.
  let next = state;
  const parked = state.questStage;
  for (const id of sharedStaging(state)) next = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
  if (parked && state.cards[parked]) next = moveCard(next, parked, { zone: "setAside" });
  return foldIfShared(mirrorActive(next));
}

// The seat whose stage the source is, else the acting seat: a delayed effect of a stage resolves for the player at it (families/breaking/index.ts stageController).
function stageSeatOf(state: ScenarioState, focus: Focus): number {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  return source?.zone === "questStage" && source.controller != null ? source.controller : focus.seat;
}

/** JoinAtStage: the player at the held stage goes on to the stage with this printed code. Players at it: he joins them (stage 4 is not revealed again, his staging area joins theirs); none: he advances alone and it is revealed. */
export function joinAtStage(state: ScenarioState, code: string, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const seat = stageSeatOf(state, focus);
  const holder = livingSeats(state).find((other) => other !== seat && state.separate === true && codeOf(state, other) === code);
  if (holder != null) return returnToSharedStage(state, code, seat);
  const { stageHeld: _held, ...released } = state;
  return withView(released, seat, (view) => advanceToStage(view, code, ctx, steps));
}
