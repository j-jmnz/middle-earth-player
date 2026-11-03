// Rules: rr.campaign-cards, rr.campaign-setup-checklist, ltp.campaign-setup-checklist (data/rules/entries.json).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ScenarioState } from "../../state.ts";
import { lastPicked } from "../../player-verbs.ts";
import { queueEvent } from "../../queue.ts";
import { attachTo, moveCard, spawn } from "../../zones.ts";
import { inPlay, updateCard } from "../../state.ts";
import type { Focus } from "../index.ts";

// The verbs src/catalog/families/campaign.ts adds. Only PutObjectiveAllyIntoPlay runs in the engine: it is a Setup instruction the
// campaign checklist hands the start. The others are dealt before the game starts (AttachChosen, AddToHandAfterMulligan,
// AddToPool: campaign/checklist.ts) or run by the Resolution (CarryOver: rules/resolution.ts), so they change nothing here.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus): ScenarioState | null {
  switch (instruction.verb) {
    case "PutObjectiveAllyIntoPlay":
      // Under the first player, ready (no Hide test, no reveal).
      return spawn(state, instruction.code, { zone: "play", seat: focus.seat }).state;
    case "SetAsideEachPlayer": {
      // One copy for each player, set aside facedown like every other card the Setup puts out.
      let next = state;
      for (let seat = 0; seat < state.seatCount; seat += 1) next = spawn(next, instruction.code, { zone: "setAside" }, "down").state;
      return next;
    }
    case "AttachSetAside":
      return attachSetAside(state, instruction.code, lastPicked(state));
    case "PlaceToken":
      return placeToken(state, focus.sourceId, instruction.amount ?? 1);
    case "EarnAttached":
    case "NamePrisoner":
      // Resolution verbs: rules/resolution.ts runs them.
      return state;
    case "AttachChosen":
    case "AddToHandAfterMulligan":
    case "AddToPool":
    case "CarryOver":
      return state;
    default:
      return null;
  }
}

// PlaceToken (41050:A:3): the source card gains resource tokens.
function placeToken(state: ScenarioState, sourceId: string | null, amount: number): ScenarioState {
  const card = sourceId ? state.cards[sourceId] : undefined;
  return card ? updateCard(state, card.id, { resources: card.resources + amount }) : state;
}

// The tokens on the card with this code in play: what a campaign card's Resolution reads (the `tokens` condition).
export function tokensOn(state: ScenarioState, code: string): number {
  return Object.values(state.cards).filter((card) => card.code === code && inPlay(card.zone)).reduce((sum, card) => sum + card.resources, 0);
}

// The last picked hero takes a set-aside copy of the card: it comes into its controller's play area attached to the hero.
function attachSetAside(state: ScenarioState, code: string, hostId: string): ScenarioState {
  const host = state.cards[hostId];
  const copy = state.setAside.find((id) => state.cards[id]?.code === code);
  if (!host || host.controller == null || host.zone !== "heroes" || !copy) return state;
  const placed = updateCard(moveCard(state, copy, { zone: "play", seat: host.controller }), copy, { face: "up" });
  return queueEvent(attachTo(placed, copy, hostId), { trigger: "attached", seat: host.controller, subject: copy, other: hostId });
}
