// Rules: rr.campaign-cards, rr.campaign-setup-checklist, ltp.campaign-setup-checklist (data/rules/entries.json). The Two Towers' Resolution verbs run in resolution.ts beside this file, The Return of the King's in saga-end.ts.
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { queueEvent } from "../../windows/queue.ts";
import { attachTo, moveCard, spawn } from "../../core/zones.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { recordedCount, returnSetAsideHero, setAsideHeroWithAttachments, setAsideLogged } from "./aside.ts";
import { placeLoggedHeroDamage } from "./damage-tracking.ts";
import { attachToHeroWith, guardWithSetAside, moveAttachment } from "./guarded.ts";

// The verbs src/catalog/families/campaign.ts adds. Only PutObjectiveAllyIntoPlay runs in the engine: it is a Setup instruction the
// campaign checklist hands the start. The others are dealt before the game starts (AttachChosen, AddToHandAfterMulligan,
// AddToPool: campaign/checklist.ts) or run by the Resolution (CarryOver: rules/setup/resolution.ts), so they change nothing here.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext): ScenarioState | null {
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
      return attachSetAside(state, instruction.code, lastPicked(state), instruction.removeWhenLeaving === true);
    case "SetAsideHeroWithAttachments":
      return setAsideHeroWithAttachments(state, instruction);
    case "ReturnSetAsideHero":
      return returnSetAsideHero(state, instruction);
    case "SetAsideLogged":
      return setAsideLogged(state, instruction, focus, ctx);
    case "PlaceToken":
      return placeToken(state, focus.sourceId, instruction.amount ?? 1);
    case "PlaceTokensOnCampaignCard":
      return placeTokensOnCampaignCard(state, resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx));
    case "AttachToHeroWith":
      return attachToHeroWith(state, instruction);
    case "MoveAttachment":
      return moveAttachment(state, instruction, ctx);
    case "SearchBoonToHand":
      return state;
    case "PlaceLoggedHeroDamage":
      return placeLoggedHeroDamage(state);
    case "GuardWithSetAside":
      return guardWithSetAside(state, instruction, focus, ctx);
    case "EarnAttached":
    case "NamePrisoner":
    case "ChooseOption":
    case "ThreatPenaltyForPick":
    case "EarnForPick":
    case "EarnHeldCopies":
    case "ReviveFallenHero":
    case "TrimHeroes":
    case "RecordUnderneath":
    case "EarnOnThreatDial":
    case "RecordTokens":
    case "RecordDamageOn":
    case "RecordHeroDamage":
    case "RecordDetermined":
    case "RemoveFromPoolByCode":
    case "LoseGuardedBoons":
    case "IgnoreDiscardedHeroes":
    case "EndCampaign":
      // Resolution verbs: rules/setup/resolution.ts runs them.
      return state;
    case "AttachChosen":
    case "AddToHandAfterMulligan":
    case "AddToPool":
    case "CarryOver":
    case "RemovePoolCards":
    case "RemoveBurdenSets":
    case "ShuffleIntoEachDeck":
    case "ChooseCopyOrResources":
    case "SearchDeckForCard":
    case "SetAsideBoon":
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

// PlaceTokensOnCampaignCard (146079:A:1): the campaign card kept in the game takes the tokens; with no campaign card in the game (a standalone one) nothing is placed.
function placeTokensOnCampaignCard(state: ScenarioState, amount: number): ScenarioState {
  const card = Object.values(state.cards).find((candidate) => candidate.zone === "campaign");
  return card && amount > 0 ? updateCard(state, card.id, { resources: card.resources + amount }) : state;
}

// The tokens on the card with this code in play: what a campaign card's Resolution reads (the `tokens` condition).
export function tokensOn(state: ScenarioState, code: string): number {
  return Object.values(state.cards).filter((card) => card.code === code && inPlay(card.zone)).reduce((sum, card) => sum + card.resources, 0);
}

// The last picked hero takes a set-aside copy of the card: it comes into its controller's play area attached to the hero.
function attachSetAside(state: ScenarioState, code: string, hostId: string, temporary: boolean): ScenarioState {
  const host = state.cards[hostId];
  const copy = state.setAside.find((id) => state.cards[id]?.code === code);
  if (!host || host.controller == null || host.zone !== "heroes" || !copy) return state;
  const placed = updateCard(moveCard(state, copy, { zone: "play", seat: host.controller }), copy, { face: "up", ...(temporary ? { temporary: true as const } : {}) });
  return queueEvent(attachTo(placed, copy, hostId), { trigger: "attached", seat: host.controller, subject: copy, other: hostId });
}

export const manifest: RulesFamily = { name: "campaign", verbs: ["SetAsideHeroWithAttachments", "ReturnSetAsideHero", "SetAsideLogged", "PutObjectiveAllyIntoPlay", "SetAsideEachPlayer", "AttachSetAside", "PlaceToken", "PlaceLoggedHeroDamage", "SearchBoonToHand", "RecordDamageOn", "RecordHeroDamage", "RecordDetermined", "EarnAttached", "NamePrisoner", "AttachChosen", "AddToHandAfterMulligan", "AddToPool", "CarryOver", "RemovePoolCards", "RemoveBurdenSets", "ShuffleIntoEachDeck", "ChooseCopyOrResources", "ChooseOption", "ThreatPenaltyForPick", "EarnForPick", "EarnHeldCopies", "ReviveFallenHero", "TrimHeroes", "RecordUnderneath", "SearchDeckForCard", "EarnOnThreatDial", "RecordTokens", "RemoveFromPoolByCode", "LoseGuardedBoons", "IgnoreDiscardedHeroes", "EndCampaign", "AttachToHeroWith", "SetAsideBoon", "GuardWithSetAside", "MoveAttachment", "PlaceTokensOnCampaignCard"], run, amount: (state, found) => (found.recorded ? recordedCount(state, found.recorded) : null) };
