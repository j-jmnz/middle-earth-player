import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { rejectionReason } from "../../rules/engine/legal.ts";
import { effectsOf } from "../../rules/windows/listen.ts";
import { isLocationCard, printedOf } from "../../rules/core/printed.ts";
import { viewOf } from "../../rules/families/breaking/areas.ts";
import { freeSlot } from "../../rules/families/south/locations.ts";
import { recordsOfFace } from "../../rules/families/dreamchaser/faces.ts";
import { islandMayTravel } from "../../rules/families/island/travel.ts";
import { pictureKey } from "../canvas/picture-key.ts";
import { questSeat } from "../store/selectors.ts";
import { grantedTravelWords } from "../words/scenarios/grapple.ts";
import { noHiddenSupply } from "../words/scenarios/against-the-shadow/blood.ts";
import { travelShort } from "../readouts/against-the-shadow/blood.ts";
import { cardLabel } from "./sheet-parts.ts";
import type { SheetNames, Unavailable } from "./sheet-types.ts";

/**
 * The locations in staging the players cannot travel to, each with the reducer's reason and the card's Travel line
 * (Weathertop while The One Ring is exhausted or gone: 141046:A:3, rr.travel). Nothing is listed while the active location slots are full.
 */
export function travelRefusals(whole: ScenarioState, ctx: ReduceContext, names: SheetNames, targets: readonly string[]): Unavailable[] {
  // Once stages are separate the traveler has its own active location and staging area (mec109.multiple-staging-areas).
  const game = viewOf(whole, questSeat(whole));
  // Under Exploration the active location stays: the refusals matter once it is full and the players may travel from it (families/island/travel.ts).
  if (!freeSlot(game) && !islandMayTravel(game, ctx.cards)) return [];
  return game.staging.flatMap((id): Unavailable[] => {
    const card = game.cards[id];
    if (!card || targets.includes(id) || !isLocationCard(printedOf(ctx.cards, card.code))) return [];
    const refused = rejectionReason(game, { type: "Travel", locationId: id }, ctx);
    if (!refused) return [];
    // The Blood of Gondor: a Travel cost of hidden cards with too few cards left to take says so (readouts/against-the-shadow/blood.ts).
    const short = travelShort(game, ctx, id);
    const reason = short != null ? noHiddenSupply(short) : refused;
    const travel = recordsOfFace(card, effectsOf(ctx, card.code)).find((effect) => effect.timing === "travel");
    const lineId = travel?.lines[0];
    const line = (lineId ? names.line(lineId) : null) ?? grantedTravelWords(game, id);
    return [{ id, label: cardLabel(game, names, id), code: pictureKey(card), reason: line ? `${reason}. ${line}` : `${reason}.` }];
  });
}
