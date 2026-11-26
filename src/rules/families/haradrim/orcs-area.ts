// Rules: hrd.orcs-area, hrd.prepare-the-orcs-area, hrd.orcs-area-different-stage, hrd.orcs-area-same-stage (data/rules/entries.json); ledger line 17047:A:1. The Orcs' area: the Setup that prepares it, and the cards that belong to it. While the players are at another
// quest stage than the Orcs its cards are in the `orcsArea` zone, which is in play and not the staging area, so no rule that reads the staging area reaches them and no player card effect can choose one (they are immune); at the same stage they stand in the
// staging area and are cards of the game as any other (syncOrcsArea, run by settle). The area sets no `state.sea`: it has no ship behaviour.
import type { Instruction } from "../../../catalog/boundary.ts";

import { lastPicked } from "../../interpret/player-verbs.ts";
import { inPlay, updateCard, type ScenarioState } from "../../core/state.ts";
import { sameMembers, syncMembers } from "../../core/area-members.ts";
import { moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";
import { atOrcsStage } from "./orcs-values.ts";
import { orcsOf } from "./orcs-zone.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** PrepareOrcsArea (once for a game): the set-aside quest cards named become the Orcs' quest deck in order, the top one its current stage with its D side up, and each set-aside card named by `place` joins the area. */
export function prepareOrcsArea(state: ScenarioState, instruction: Verb<"PrepareOrcsArea">): ScenarioState {
  // The area is prepared once: a Setup run again on a game that has begun leaves it as it is.
  if (state.orcs) return state;
  const stages = instruction.stages.map((code) => state.setAside.find((id) => state.cards[id]?.code === code));
  const [top, ...rest] = stages;
  if (!top || rest.some((id) => id == null)) return { ...state, failure: "The Orcs' area needs its quest stages set aside" };
  const members = (instruction.place ?? []).map((code) => state.setAside.find((id) => state.cards[id]?.code === code));
  if (members.some((id) => id == null)) return { ...state, failure: "The Orcs' area needs the cards that begin in it set aside" };
  const prepared: ScenarioState = { ...state, orcs: { stage: top, number: instruction.number, deck: rest.filter((id): id is string => id != null), members: [] } };
  // The current stage is the card on top of the Orcs' quest deck (stage 1C), shown on its D side from the start: the C side is passed through only by an advance (hrd.orcs-area), and stage 1C prints no When Revealed.
  let next = updateCard(moveCard(prepared, top, { zone: "orcsArea" }), top, { face: "B" });
  for (const id of members) if (id) next = updateCard(moveCard(next, id, { zone: "orcsArea" }), id, { face: "up" });
  return next;
}

/** MoveToOrcsArea: the card goes into the Orcs' area from wherever it is: the source (while it is in play), the last picked card, or the set-aside card with the code. An engaged enemy loses its engagement. */
export function moveToOrcsArea(state: ScenarioState, instruction: Verb<"MoveToOrcsArea">, focus: Focus): ScenarioState {
  if (!orcsOf(state)) return state;
  const id = instruction.code != null ? state.setAside.find((aside) => state.cards[aside]?.code === instruction.code) : instruction.target === "picked" ? lastPicked(state) : focus.sourceId;
  const card = id ? state.cards[id] : undefined;
  if (!card || (instruction.code == null && instruction.target !== "picked" && !inPlay(card.zone))) return state;
  return updateCard(moveCard(state, card.id, { zone: "orcsArea" }), card.id, { face: "up", controller: null });
}

/** The cards of the area stand where the players' stage says: in the staging area at the Orcs' stage, in the area zone otherwise (hrd.orcs-area-different-stage). A card that has left both (engaged, active, explored, discarded) is no longer one. The state is
 * returned unchanged when nothing moves. */
export function syncOrcsArea(state: ScenarioState): ScenarioState {
  const area = orcsOf(state);
  if (!area) return state;
  const { state: next, kept } = syncMembers(state, area.members, "orcsArea", atOrcsStage(state));
  const now = orcsOf(next);
  if (!now) return next;
  return sameMembers(kept, now.members) ? next : { ...next, orcs: { ...now, members: kept } };
}

/** A scene's Orcs' area as the Setup leaves it (test/harness/layout.ts, `orcs`): the area prepared from the set-aside stages, the cards of `members` moved into it from where they stand, `progress` on the Orcs' stage. */
export function withOrcsArea(state: ScenarioState, layout: { stages: readonly string[]; place?: readonly string[]; members?: readonly string[]; progress?: number }): ScenarioState {
  let next = prepareOrcsArea(state, { verb: "PrepareOrcsArea", stages: [...layout.stages], number: 1, ...(layout.place ? { place: [...layout.place] } : {}) });
  for (const code of layout.members ?? []) {
    const id = next.staging.find((card) => next.cards[card]?.code === code);
    if (id) next = updateCard(moveCard(next, id, { zone: "orcsArea" }), id, { face: "up", controller: null });
  }
  const stage = next.orcs?.stage;
  return layout.progress != null && stage ? updateCard(next, stage, { progress: layout.progress }) : next;
}
