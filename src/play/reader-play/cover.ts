// The reader parity check's two questions about a state (docs/architecture.md, Tests): which of the intents the engine offers no reader element
// reaches, and whether the intent the driver wants to send is one a reader can build. Pure.
import { characters } from "../../rules/combat/combat.ts";
import { legalTargets, type LegalIntent, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../rules/engine/reduce.ts";

import type { Family, Reached } from "./reach.ts";

type Sent = readonly Reached[];

const idsOf = (intent: PlayerIntent): readonly string[] => {
  switch (intent.type) {
    case "Commit":
    case "CommitHide":
    case "CommitFortitude":
    case "CommitEscape":
      return intent.cardIds;
    case "DeclareAttackers":
      return intent.attackerIds;
    default:
      return [];
  }
};

// True when `ids` are all within the sent intent's family (or the intent itself already names them).
function names(entry: Reached, id: string): boolean {
  if (idsOf(entry.intent).includes(id)) return true;
  return entry.family?.kind === "ids" && entry.family.allowed.has(id);
}

function sharesWithin(intent: PlayerIntent, family: Extract<Family, { kind: "shares" }>): boolean {
  const given =
    intent.type === "PlayCard" || intent.type === "Trigger"
      ? (intent.payments ?? []).map((payment) => [payment.heroId, payment.amount] as const)
      : intent.type === "Distribute"
        ? intent.assignments.map((one) => [one.cardId, one.amount] as const)
        : [];
  return given.every(([id, amount]) => (family.caps.get(id) ?? -1) >= amount);
}

/**
 * True when a reader can build this intent: an element sends it as it is, or sends one of its family with the same card, host and target and
 * the picks of the intent within what the family offers (any characters of the commit, any hero for a payment up to its pool).
 */
export function reachable(intent: PlayerIntent, sent: Sent): boolean {
  const same = JSON.stringify(intent);
  if (sent.some((entry) => JSON.stringify(entry.intent) === same)) return true;
  return sent.some((entry) => {
    const other = entry.intent;
    const family = entry.family;
    if (!family || other.type !== intent.type) return false;
    if (family.kind === "ids" && (intent.type === "Commit" || intent.type === "CommitHide" || intent.type === "CommitFortitude" || intent.type === "CommitEscape" || intent.type === "DeclareAttackers")) {
      if (intent.type === "DeclareAttackers" && other.type === "DeclareAttackers" && intent.enemyId !== other.enemyId) return false;
      const picks = idsOf(intent);
      return (picks.length > 0 || family.allowEmpty) && picks.every((id) => family.allowed.has(id));
    }
    if (family.kind === "shares" && (intent.type === "PlayCard" || intent.type === "Trigger" || intent.type === "Distribute")) {
      if (intent.type === "PlayCard" && other.type === "PlayCard" && (intent.cardId !== other.cardId || intent.hostId !== other.hostId)) return false;
      if (intent.type === "Trigger" && other.type === "Trigger" && (intent.cardId !== other.cardId || intent.effectId !== other.effectId)) return false;
      return sharesWithin(intent, family);
    }
    return false;
  });
}

// Each intent type with a target the engine lists (legalTargets) needs every target reached, not one of them. An offer with no target (Commit once every
// character is committed, an attack nobody can make) names nothing a reader could send, so it asks for nothing.
function targetsMissing(state: ScenarioState, ctx: ReduceContext, legal: LegalIntent, sent: Sent): string[] {
  const of = <T extends PlayerIntent["type"]>(type: T) => sent.filter((entry) => entry.intent.type === type);
  const lacks = (what: string, ids: readonly string[], found: (id: string) => boolean): string[] => ids.filter((id) => !found(id)).map((id) => `${legal.type} ${what} ${id}`);
  switch (legal.type) {
    case "Travel":
      return lacks("to", legalTargets(state, { type: "Travel" }, ctx), (id) => of("Travel").some((entry) => entry.intent.type === "Travel" && entry.intent.locationId === id));
    case "Engage":
      return lacks("enemy", legalTargets(state, { type: "Engage" }, ctx), (id) => of("Engage").some((entry) => entry.intent.type === "Engage" && entry.intent.enemyId === id));
    case "ChooseEnemy":
      return lacks("enemy", legalTargets(state, { type: "ChooseEnemy" }, ctx), (id) => of("ChooseEnemy").some((entry) => entry.intent.type === "ChooseEnemy" && entry.intent.enemyId === id));
    case "DeclareDefender":
      return lacks("defender", legalTargets(state, { type: "DeclareDefender" }, ctx), (id) => of("DeclareDefender").some((entry) => entry.intent.type === "DeclareDefender" && entry.intent.defenderId === id));
    case "Undefended":
      // Before the shadow effect the sheet leaves the attack undefended and names no hero (rr.step-6-4-1): each hero is reached at the damage step (rr.step-6-4-3).
      if (!state.pendingAttack?.shadowResolved && of("Undefended").some((entry) => entry.intent.type === "Undefended" && entry.intent.heroId == null)) return [];
      return lacks("hero", legalTargets(state, { type: "Undefended" }, ctx), (id) => of("Undefended").some((entry) => entry.intent.type === "Undefended" && entry.intent.heroId === id));
    case "Commit":
      return [...lacks("character", legalTargets(state, { type: "Commit" }, ctx), (id) => of("Commit").some((entry) => names(entry, id)))];
    case "CommitHide":
      return [...lacks("character", legalTargets(state, { type: "CommitHide" }, ctx), (id) => of("CommitHide").some((entry) => names(entry, id)))];
    case "CommitEscape":
      return [...lacks("character", legalTargets(state, { type: "CommitEscape" }, ctx), (id) => of("CommitEscape").some((entry) => names(entry, id)))];
    case "CommitFortitude":
      return [...lacks("hero", legalTargets(state, { type: "CommitFortitude" }, ctx), (id) => of("CommitFortitude").some((entry) => names(entry, id)))];
    case "DeclareAttackers": {
      // Each enemy a character may attack is reached with that character among the attackers.
      const pairs = characters(state, state.activeSeat, ctx.cards).flatMap((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).map((enemy) => [id, enemy] as const));
      return pairs.filter(([id, enemy]) => !of("DeclareAttackers").some((entry) => entry.intent.type === "DeclareAttackers" && entry.intent.enemyId === enemy && names(entry, id))).map(([id, enemy]) => `DeclareAttackers ${id} against ${enemy}`);
    }
    case "Distribute": {
      const recipients = legalTargets(state, { type: "Distribute" }, ctx);
      const found = (id: string) => of("Distribute").some((entry) => (entry.intent.type === "Distribute" && entry.intent.assignments.some((one) => one.cardId === id)) || (entry.family?.kind === "shares" && entry.family.caps.has(id)));
      return lacks("recipient", recipients, found);
    }
    default:
      return [];
  }
}

/** An intent in the words `unreachedIntents` uses, so an allowance names both the same way. */
export function describe(intent: PlayerIntent): string {
  switch (intent.type) {
    case "PlayCard":
      return `PlayCard ${intent.cardId}`;
    case "Trigger":
      return `Trigger ${intent.cardId} ${intent.effectId}`;
    case "Choose":
    case "ChooseResolution":
      return `${intent.type} ${intent.optionId}`;
    default:
      return intent.type;
  }
}

/** The intents the engine offers that no reader element reaches, each as a short description. */
export function unreachedIntents(state: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], sent: Sent): string[] {
  const has = (match: (intent: PlayerIntent) => boolean) => sent.some((entry) => match(entry.intent));
  const out: string[] = [];
  for (const offer of legal) {
    switch (offer.type) {
      case "PlayCard":
        if (!has((intent) => intent.type === "PlayCard" && intent.cardId === offer.cardId)) out.push(`PlayCard ${offer.cardId}`);
        break;
      case "Trigger":
        if (!has((intent) => intent.type === "Trigger" && intent.cardId === offer.cardId && intent.effectId === offer.effectId)) out.push(`Trigger ${offer.cardId} ${offer.effectId}`);
        break;
      case "Choose":
      case "ChooseResolution":
        if (!has((intent) => (intent.type === "Choose" || intent.type === "ChooseResolution") && intent.type === offer.type && intent.optionId === offer.optionId)) out.push(`${offer.type} ${offer.optionId}`);
        break;
      case "Keep":
      case "Mulligan":
      case "Pass":
      case "DeclineTravel":
      case "DeclineEngage":
      case "DeclineAttack":
        if (!has((intent) => intent.type === offer.type)) out.push(offer.type);
        break;
      default:
        out.push(...targetsMissing(state, ctx, offer, sent));
    }
  }
  return out;
}
