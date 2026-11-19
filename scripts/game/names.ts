// Names for `pnpm game`'s text: a card instance as `Title (code) #id`, an intent and an engine step as one line each, with the cards they name spelled out.
// A debugging aid for agents, not the app's words (src/play/words): it names everything, hidden cards included, and prints the ids an intent takes.
import type { Cause } from "../../src/rules/core/cause.ts";
import type { EngineStep, LegalIntent, PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

/** A card instance: its title and code, then its id (what an intent names). An id with no card is printed as it is (a named option, a seat). */
export function cardName(state: ScenarioState, ctx: ReduceContext, id: string | null | undefined): string {
  if (id == null) return "nothing";
  const card = state.cards[id];
  if (!card) return id;
  const printed = ctx.cards.get(card.code);
  return `${printed?.name ?? "?"} (${card.code}) #${id}`;
}

function names(state: ScenarioState, ctx: ReduceContext, ids: readonly string[]): string {
  return ids.length === 0 ? "none" : ids.map((id) => cardName(state, ctx, id)).join(", ");
}

export function causeText(cause: Cause): string {
  return "rule" in cause ? cause.rule : cause.effect;
}

/** An intent as sent, its cards named in the state it is sent from. */
export function intentText(intent: PlayerIntent | LegalIntent, state: ScenarioState, ctx: ReduceContext): string {
  const pay = (payments: readonly { heroId: string; amount: number }[] | undefined): string =>
    payments && payments.length > 0 ? `, paid ${payments.map((payment) => `${payment.amount} from ${cardName(state, ctx, payment.heroId)}`).join(", ")}` : "";
  switch (intent.type) {
    case "PlayCard":
      return `PlayCard ${cardName(state, ctx, intent.cardId)}${"payments" in intent ? pay(intent.payments) : ""}${"hostId" in intent && intent.hostId ? ` on ${cardName(state, ctx, intent.hostId)}` : ""}`;
    case "Trigger":
      return `Trigger ${intent.effectId} of ${cardName(state, ctx, intent.cardId)}${"payments" in intent ? pay(intent.payments) : ""}`;
    case "Commit":
    case "CommitHide":
    case "CommitFortitude":
    case "CommitEscape":
      return "cardIds" in intent ? `${intent.type} ${names(state, ctx, intent.cardIds)}` : intent.type;
    case "Travel":
      return "locationId" in intent ? `Travel to ${cardName(state, ctx, intent.locationId)}` : "Travel";
    case "Engage":
    case "ChooseEnemy":
      return "enemyId" in intent ? `${intent.type} ${cardName(state, ctx, intent.enemyId)}` : intent.type;
    case "DeclareDefender":
      return "defenderId" in intent ? `DeclareDefender ${cardName(state, ctx, intent.defenderId)}` : intent.type;
    case "Undefended":
      return "heroId" in intent && intent.heroId ? `Undefended, damage on ${cardName(state, ctx, intent.heroId)}` : "Undefended";
    case "DeclareAttackers":
      return "attackerIds" in intent ? `DeclareAttackers ${names(state, ctx, intent.attackerIds)} against ${cardName(state, ctx, intent.enemyId)}` : intent.type;
    case "Distribute":
      return "assignments" in intent ? `Distribute ${intent.assignments.map((one) => `${one.amount} on ${cardName(state, ctx, one.cardId)}`).join(", ")}` : `Distribute ${intent.total}`;
    case "Choose":
    case "ChooseResolution":
      return `${intent.type} ${cardName(state, ctx, intent.optionId)}`;
    default:
      return "amount" in intent && intent.amount != null ? `${intent.type} ${intent.amount}` : intent.type;
  }
}

/** An engine step, named in the state after the intent that caused it (a card that left play still has its instance). */
export function stepText(step: EngineStep, state: ScenarioState, ctx: ReduceContext): string {
  const name = (id: string | null | undefined): string => cardName(state, ctx, id);
  const seat = (index: number | null): string => (index == null ? "every player" : `P${index + 1}`);
  switch (step.kind) {
    case "push":
    case "pop":
      return `${step.kind} ${step.frame}${step.cardId ? ` for ${name(step.cardId)}` : ""}${step.peril ? " (peril)" : ""}`;
    case "draw":
      return `${seat(step.seat)} draws ${name(step.cardId)} [${causeText(step.cause)}]`;
    case "gainResource":
      return `${name(step.heroId)} gains a resource [${causeText(step.cause)}]`;
    case "damage":
      return `${step.amount} damage on ${name(step.targetId)} [${causeText(step.cause)}]`;
    case "threat":
      return `${seat(step.seat)} threat ${step.amount >= 0 ? "+" : ""}${step.amount} [${causeText(step.cause)}]`;
    case "life":
      return `Ring-bearer's life ${step.amount} [${causeText(step.cause)}]`;
    case "progress":
      return `${step.amount} progress on ${name(step.targetId)} [${causeText(step.cause)}]`;
    case "destroy":
      return `${name(step.targetId)} destroyed${step.under ? " (placed under)" : ""}`;
    case "eliminate":
      return `${seat(step.seat)} eliminated`;
    case "reveal":
      return `${seat(step.seat)} reveals ${name(step.cardId)} [${causeText(step.cause)}]`;
    case "engage":
      return `${seat(step.seat)} engages ${name(step.enemyId)}${step.boarding ? ` (boarding from ${name(step.boarding)})` : ""}`;
    case "quest":
      return `quest: ${step.willpower} willpower against ${step.threat} threat [${causeText(step.cause)}]`;
    case "attack":
      return `${step.side} attack by ${seat(step.seat)} ${step.side === "enemy" ? "from" : "on"} ${name(step.enemyId)}${step.attackerIds ? ` with ${names(state, ctx, step.attackerIds)}` : ""}`;
    case "strike":
      return `${step.side} strike: ${step.attack} attack against ${step.defense} defense of ${name(step.targetId)}${step.undefended ? " (undefended)" : ""} [${causeText(step.cause)}]`;
    case "hideTest":
      return `Hide test for ${name(step.cardId)}: ${step.willpower} willpower against ${step.threat} threat, ${step.success ? "passed" : "failed"}`;
    case "fortitudeTest":
      return `Fortitude test ${seat(step.seat)}: ${step.willpower} willpower against ${step.eyes} eyes, ${step.success ? "passed" : "failed"}`;
    case "escapeTest":
      return `Escape test ${seat(step.seat)}: ${step.committed} against ${step.escape}, ${step.success ? "passed" : "failed"}`;
    case "advance":
      return `advance from ${name(step.cardId)}${step.stormcaller ? " (Stormcaller)" : ""}`;
    case "commit":
    case "hideCommit":
    case "fortitudeCommit":
    case "escapeCommit":
      return `${name(step.cardId)} committed${step.kind === "commit" ? "" : ` (${step.kind.replace("Commit", "")})`}`;
    case "cancel":
      return `cancel ${name(step.cardId)}`;
    default: {
      // The steps with ids and nothing to add: each field printed, its ids named.
      const fields = Object.entries(step)
        .filter(([key]) => key !== "kind")
        .map(([key, value]) => `${key} ${typeof value === "string" && state.cards[value] ? name(value) : typeof value === "object" && value !== null && !Array.isArray(value) ? causeText(value as Cause) : JSON.stringify(value)}`);
      return `${step.kind}${fields.length > 0 ? `: ${fields.join(", ")}` : ""}`;
    }
  }
}
