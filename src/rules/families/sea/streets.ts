// Rules: rr.travel, rr.first-player, rr.the-word-choose (data/rules/entries.json); ledger lines 12160:A:1, 00010:A:1. "When faced with the option to travel, if Streets of Umbar is in the staging area, the players must either travel to a
// location named Streets of Umbar or add 2 resources to a Raider enemy in play" (TravelOrAddResources, a constant of the location). Reading: adding the resources satisfies the "must", so the players may then decline to
// travel or travel to another location; the first player chooses the Raider. With no Raider in play they cannot add the resources, so they must travel to a location with that title, if able.
import type { Instruction } from "../../../catalog/boundary.ts";

import { constantInstructions } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";

type Rule = { source: string; title: string; amount: number; instructions: readonly Instruction[]; payable: boolean };

// The rules in force: a TravelOrAddResources or TravelOrRaiseThreat constant whose location is in the staging area while the players are faced with the option to travel (no active location).
function rules(state: ScenarioState, ctx: ReduceContext): Rule[] {
  if (state.activeLocation || state.secondActiveLocation) return [];
  const found: Rule[] = [];
  for (const { source, instruction } of constantInstructions(state, ctx)) {
    if (source.zone !== "staging") continue;
    // Pelennor Fields (00010:A:1): each player raises their threat, which can always be done.
    if (instruction.verb === "TravelOrRaiseThreat") {
      found.push({ source: source.id, title: printedOf(ctx.cards, source.code).name, amount: instruction.amount, instructions: [{ verb: "RaiseThreat", amount: instruction.amount, who: "eachSeat" }], payable: true });
      continue;
    }
    if (instruction.verb !== "TravelOrAddResources") continue;
    found.push({
      source: source.id,
      title: printedOf(ctx.cards, source.code).name,
      amount: instruction.amount,
      instructions: [{ verb: "Pick", pick: instruction.pick }, { verb: "PlaceResourceTokens", amount: instruction.amount, on: "picked" }],
      payable: pickCandidates(state, instruction.pick, state.firstPlayer, [], source.id, ctx).length > 0,
    });
  }
  return found;
}

/** What traveling to this location (or declining to travel, `locationId` null) costs: for each rule in force, the instructions that add the resources, unless the location has the rule's title. */
export function travelTax(state: ScenarioState, ctx: ReduceContext, locationId: string | null): { source: string; instructions: readonly Instruction[] } | null {
  const title = locationId ? printedOf(ctx.cards, state.cards[locationId]?.code ?? "").name : null;
  for (const rule of rules(state, ctx)) if (rule.title !== title && rule.payable) return rule;
  return null;
}

/** The locations in the staging area the players must travel to, because a rule is in force and the resources cannot be added: those with the rule's title. */
export function mustTravelTitled(state: ScenarioState, ctx: ReduceContext): string[] {
  const titles = new Set(rules(state, ctx).filter((rule) => !rule.payable).map((rule) => rule.title));
  if (titles.size === 0) return [];
  return state.staging.filter((id) => {
    const card = state.cards[id];
    return card != null && printedOf(ctx.cards, card.code).type === "location" && titles.has(printedOf(ctx.cards, card.code).name);
  });
}
