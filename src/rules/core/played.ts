// The cards played this round (`state.played`): one entry for each card an Action or a Response event played from a hand, a deck or a discard pile; the entries of an earlier round are dropped. The Planning phase leaves its name out.
import type { ScenarioState } from "./state.ts";

export function withPlayed(state: ScenarioState, id: string, code: string, seat: number): ScenarioState {
  const entry = { id, code, seat, round: state.round, ...(state.phase === "Planning" ? {} : { phase: state.phase }) };
  return { ...state, played: [...(state.played ?? []).filter((held) => held.round === state.round), entry] };
}
