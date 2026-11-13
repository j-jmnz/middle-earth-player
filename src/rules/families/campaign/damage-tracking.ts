// Rules: mec108.campaign-log-tracking (data/rules/entries.json). The verbs behind Angmar Awakened's Damage Tracking rows (src/campaign/log-angmar-awakened.ts): two Resolution verbs note the damage on Protect the Innocent / Arnor Ravaged and on each hero,
// and a Setup verb gives each hero the damage the log noted. src/rules/setup/resolution.ts and the campaign family's `run` call them.
import type { Instruction } from "../../../catalog/boundary.ts";
import type { ResolutionLog } from "../../core/campaign-state.ts";
import { printedOf } from "../../core/printed.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { inPlay, updateCard, type ScenarioState } from "../../core/state.ts";
import { tokensOn } from "./saga-end.ts";

type Verb<V extends Instruction["verb"]> = Extract<Instruction, { verb: V }>;

/** RecordDamageOn: the damage on the cards in play with these codes, added up (Protect the Innocent / Arnor Ravaged, 10156:B:1). */
export function recordDamageOn(state: ScenarioState, instruction: Verb<"RecordDamageOn">): ResolutionLog {
  const protect = tokensOn(state, instruction.codes, "damage");
  return { ...state.resolutionLog, damageNotes: { ...(state.resolutionLog.damageNotes ?? {}), protect } };
}

/** RecordHeroDamage: the damage on each hero in play, by hero code, a hero with none left out (10188:B:1). */
export function recordHeroDamage(state: ScenarioState): ResolutionLog {
  const heroes: Record<string, number> = {};
  for (const card of Object.values(state.cards)) {
    if (card.zone === "heroes" && card.damage > 0) heroes[card.code] = card.damage;
  }
  return { ...state.resolutionLog, damageNotes: { ...(state.resolutionLog.damageNotes ?? {}), heroes } };
}

/** RecordDetermined: the characters in play with a copy of the card attached, by their codes (10172:A:1); the log adds them to the ones it holds. */
export function recordDetermined(state: ScenarioState, instruction: Verb<"RecordDetermined">): ResolutionLog {
  const marked: string[] = [...(state.resolutionLog.determined ?? [])];
  for (const card of Object.values(state.cards)) {
    // An attachment played onto its host lies in play, one attached by an effect in the attached zone: either way it carries its host.
    const host = card.code === instruction.code && card.host ? state.cards[card.host] : undefined;
    if (host && inPlay(host.zone) && !marked.includes(host.code)) marked.push(host.code);
  }
  return { ...state.resolutionLog, determined: marked };
}

/** RecordStolenCards (10174:B:3): for each seat, the unique cards (heroes too) still in its captured deck, not those captured underneath a card: by code, in deck order. The log adds them to the cards the campaign refuses that player (loadout.ts). */
export function recordStolenCards(state: ScenarioState, ctx: ReduceContext): ResolutionLog {
  const stolen = Array.from({ length: state.seatCount }, (_, seat) => [
    ...new Set((state.seats[seat]?.captured ?? []).flatMap((id) => (printedOf(ctx.cards, state.cards[id]?.code ?? "").isUnique ? [state.cards[id]?.code ?? ""] : []))),
  ]);
  return { ...state.resolutionLog, stolen };
}

/** PlaceLoggedHeroDamage (10193:A:2): each hero in play takes the damage the Campaign Log noted for its code (`campaignFacts.angmar.heroDamage`); a hero with no note takes none. */
export function placeLoggedHeroDamage(state: ScenarioState): ScenarioState {
  const noted = state.campaignFacts?.angmar?.heroDamage;
  if (!noted) return state;
  let next = state;
  for (const hero of Object.values(state.cards).filter((card) => card.zone === "heroes")) {
    const damage = noted[hero.code] ?? 0;
    if (damage > 0) next = updateCard(next, hero.id, { damage: hero.damage + damage });
  }
  return next;
}
