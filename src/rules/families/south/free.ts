// Rules: mec113.setting-up-the-game, rr.guarded, rr.ownership-and-control (data/rules/entries.json); ledger line 146067:B:2.
import { gameReads } from "../../core/game-reads.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay } from "../../core/state.ts";
import { backInPlace } from "../prisoner/index.ts";
import { releaseHero } from "./captive.ts";

// FreeRingBearer: each hero a card guarded (CaptureRingBearer `guarded`) whose guard is out of play returns among the first player's heroes where it was, faceup, as it was held: ready or exhausted, with its damage, resources and attachments. A hero held by an enemy for Carried Away has a record of its own and is no
// concern of this one: only a game with a card that has a FreeRingBearer record looks.
export function freeRingBearers(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (!gameReads(state, ctx, '"FreeRingBearer"')) return state;
  let next = state;
  for (const card of Object.values(state.cards)) {
    if (card.guardedHero !== true || card.zone !== "captive") continue;
    const guard = card.host != null ? state.cards[card.host] : undefined;
    if (guard && inPlay(guard.zone)) continue;
    const seat = next.firstPlayer;
    const released = releaseHero(next, card.id, seat, { face: "up", guardedHero: undefined, owner: undefined, heroSlot: undefined, host: null });
    next = card.heroSlot == null ? released : backInPlace(released, seat, card.id, card.heroSlot);
  }
  return next;
}
