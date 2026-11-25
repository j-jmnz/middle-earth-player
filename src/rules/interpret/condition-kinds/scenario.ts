// Conditions a family or a scenario box reads from its own state: objectives, the prisoner, the island, side quests, the campaign, the burden deck, the Stormcaller, the Havens Burn and the heading.
import { encounterHolds, underBurnHolds } from "../../families/aflame/values.ts";
import { locationThreatHolds } from "../../families/grapple/values.ts";
import { islandHolds } from "../../families/island/pick.ts";
import { freeOfEncounters } from "../../families/objectives/index.ts";
import { controlledByPlayers } from "../../families/objectives/control.ts";
import { prisonerHero } from "../../families/prisoner/index.ts";
import { tokensOn } from "../../families/campaign/index.ts";
import { campaignHolds } from "../../families/campaign/picks.ts";
import { faceUp, flagHeld } from "../../families/sidequests/contract.ts";
import { copyInVictory } from "../../families/sidequests/pick.ts";
import { headingIs } from "../../families/sea/heading.ts";
import { corsairHolds } from "../../families/sea/corsair.ts";
import { stormcallerHolds } from "../../families/stormcaller/values.ts";
import { livingSeats } from "../../core/state.ts";
import { conditionCard, type ConditionHandlers } from "../condition-scope.ts";

export const scenarioHandlers = {
  // The objectives and prisoner families (families/objectives.ts, families/prisoner.ts).
  freeOfEncounters: (state, _condition, scope) => freeOfEncounters(state, scope.sourceId),
  controlledByPlayers: (state, _condition, scope) => controlledByPlayers(state, scope.sourceId),
  prisoner: (state, condition) => (prisonerHero(state) != null) === condition.is,
  island: (state, condition) => islandHolds(state, condition),
  pursuit: (state, condition) => campaignHolds(state, condition),
  picked: (state, condition) => campaignHolds(state, condition),
  anyHand: (state, condition) => campaignHolds(state, condition),
  faceUp: (state, condition, scope) => faceUp(state, scope.sourceId, condition.side),
  flag: (state, condition, scope) => flagHeld(state, condition, scope.sourceId, scope.actor),
  copyInVictory: (state, condition, scope, ctx) => copyInVictory(state, conditionCard(state, condition.card, scope), ctx) === (condition.is !== false),
  tokens: (state, condition) => tokensOn(state, condition.code) >= condition.min * (condition.perPlayer ? livingSeats(state).length : 1),
  heading: (state, condition) => headingIs(state, condition.is),
  stormcaller: (state, condition) => stormcallerHolds(state, condition),
  // The burden deck, Campaign Mode and the effect's X (families/burden.ts).
  burdenDeck: (state, condition) => (state.burdenDeck?.length ?? 0) >= (condition.min ?? 1),
  campaign: (state) => Object.values(state.cards).some((card) => card.zone === "campaign"),
  upgraded: (state, condition) => state.campaignFacts?.upgraded?.includes(condition.code) === true,
  // The aflame family's: the cards underneath The Havens Burn (families/aflame/values.ts). `revealing`: the source's own When Revealed is on the stack.
  encounterHas: (state, condition, _scope, ctx) => encounterHolds(state, condition, ctx),
  underBurn: (state, condition, _scope, ctx) => underBurnHolds(state, condition, ctx),
  corsairHas: (state) => corsairHolds(state),
  locationThreat: (state, condition, _scope, ctx) => locationThreatHolds(state, condition, ctx),
} satisfies Partial<ConditionHandlers>;
