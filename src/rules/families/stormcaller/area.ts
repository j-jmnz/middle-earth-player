// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages, dcce.campaign-mode (data/rules/entries.json). The Stormcaller's area: the Setup that prepares it, and the cards that belong to it. While
// the players are at another quest stage than the Stormcaller they are in the `stormcallerArea` zone, which is in play and not the staging area, so no rule that reads the staging area reaches
// them and no player card effect can choose one (they are immune); at the same stage they stand in the staging area and are cards of the game as any other (syncStormcallerArea, run by settle).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret.ts";
import { printedOf } from "../../printed.ts";
import type { ScenarioState } from "../../state.ts";
import { updateCard } from "../../state.ts";
import { moveCard } from "../../zones.ts";
import { atStormcallersStage } from "./values.ts";
import { areaOf } from "./zone.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** PrepareStormcallerArea: the set-aside quest cards named become the Stormcaller's quest deck in order, the top one its current stage with its D side up, and the set-aside Stormcaller joins the area. */
export function prepareStormcallerArea(state: ScenarioState, instruction: Verb<"PrepareStormcallerArea">, ctx: ReduceContext): ScenarioState {
  const caller = state.setAside.find((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").name === "Stormcaller");
  const stages = instruction.stages.map((code) => state.setAside.find((id) => state.cards[id]?.code === code));
  const [top, ...rest] = stages;
  if (!caller || !top || rest.some((id) => id == null)) return { ...state, failure: "The Stormcaller's area needs the Stormcaller and its quest stages set aside" };
  const prepared: ScenarioState = {
    ...state,
    sea: { ...(state.sea ?? { heading: null, headingCard: null, routes: {} }), stormcaller: { card: caller, stage: top, number: instruction.number, deck: rest.filter((id): id is string => id != null), members: [] } },
  };
  // The current stage is the card on top of the Stormcaller's quest deck (stage 2C), shown on its D side from the start: the C side is passed through only by an advance, "first advancing to the C side of
  // the next stage, resolving its effects, and then advancing to the D side" (dcce.stormcallers-area-stages), and stage 2C prints no When Revealed. The Stormcaller stands beside it.
  const staged = updateCard(moveCard(prepared, top, { zone: "stormcallerArea" }), top, { face: "B" });
  return updateCard(moveCard(staged, caller, { zone: "stormcallerArea" }), caller, { face: "up" });
}

/** FlipStormcaller: the Stormcaller shows its "Campaign Mode only" side. */
export function flipStormcaller(state: ScenarioState): ScenarioState {
  const area = areaOf(state);
  return area ? updateCard(state, area.card, { face: "B" }) : state;
}

/** MoveToStormcallerArea: the card goes into the Stormcaller's area from wherever it is in play. */
export function moveToStormcallerArea(state: ScenarioState, id: string | null | undefined): ScenarioState {
  const card = id ? state.cards[id] : undefined;
  return card && areaOf(state) ? moveCard(state, card.id, { zone: "stormcallerArea" }) : state;
}

/** The cards of the area stand where the players' stage says: in the staging area at the Stormcaller's stage, in the area zone otherwise (dcce.stormcallers-area-stages). A card that has left both
 * (engaged, active, explored, discarded) is no longer one. The state is returned unchanged when nothing moves. */
export function syncStormcallerArea(state: ScenarioState): ScenarioState {
  const area = areaOf(state);
  if (!area || !state.sea) return state;
  const same = atStormcallersStage(state);
  let next = state;
  const kept: string[] = [];
  for (const id of area.members) {
    const zone = next.cards[id]?.zone;
    if (zone === "stormcallerArea") {
      kept.push(id);
      if (same) next = moveCard(next, id, { zone: "staging" });
    } else if (zone === "staging") {
      kept.push(id);
      if (!same) next = moveCard(next, id, { zone: "stormcallerArea" });
    }
  }
  const now = areaOf(next);
  if (!now || !next.sea) return next;
  return kept.length === now.members.length && kept.every((id, at) => id === now.members[at]) ? next : { ...next, sea: { ...next.sea, stormcaller: { ...now, members: kept } } };
}
