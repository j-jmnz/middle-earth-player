// A game state as text, for `pnpm game show`: the round and the open window, the quest, the staging area and the locations, then each seat's threat,
// heroes, cards in play, engaged enemies and hand, the stack of open frames and the legal intents. A card's stats are the ones the engine reads now
// (`modifiedStat`), with the printed number beside one a modifier moved. Hidden cards are named: this is for debugging the engine, not for the player.
import { modifiedStat } from "../../src/rules/core/keywords.ts";
import { stagingThreat } from "../../src/rules/quest/quest.ts";
import type { CardInstance } from "../../src/rules/core/state-types.ts";
import type { ModifierStat } from "../../src/catalog/effect-schema.ts";
import type { LegalIntent } from "../../src/rules/core/intents.ts";
import { legalIntents, legalTargets, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { heldStage } from "../../src/play/cards/earlier-stages.ts";
import { cardName, intentText } from "./names.ts";

const STATS: readonly [ModifierStat, string, keyof PrintedStats][] = [
  ["threat", "T", "threat"],
  ["willpower", "W", "willpower"],
  ["attack", "A", "attack"],
  ["defense", "D", "defense"],
  ["hitPoints", "HP", "health"],
  ["engagementCost", "E", "engagementCost"],
];
type PrintedStats = { threat: number | null; willpower: number | null; attack: number | null; defense: number | null; health: number | null; engagementCost: number | null };

/** One card in play: its name, the stats it prints with what the engine reads now, its tokens and state, and what is attached to it. */
export function cardLine(state: ScenarioState, ctx: ReduceContext, id: string): string {
  const card = state.cards[id];
  if (!card) return id;
  const printed = ctx.cards.get(card.code);
  const parts: string[] = [cardName(state, ctx, id)];
  if (printed) {
    const stats = STATS.filter(([, , key]) => printed[key] != null).map(([stat, short, key]) => {
      const now = modifiedStat(state, card, stat, ctx.cards);
      return `${short}${now}${now === printed[key] ? "" : `(${printed[key]})`}`;
    });
    if (stats.length > 0) parts.push(stats.join(" "));
    if (printed.questPoints != null || card.progress > 0) parts.push(`progress ${card.progress}/${printed.questPoints ?? "-"}`);
  }
  parts.push(...flags(card));
  if (card.attachments.length > 0) parts.push(`with ${card.attachments.map((attached) => cardName(state, ctx, attached)).join(", ")}`);
  if (card.shadowId) parts.push(`shadow ${cardName(state, ctx, card.shadowId)}${card.extraShadowIds?.length ? ` +${card.extraShadowIds.length}` : ""}`);
  return parts.join(", ");
}

function flags(card: CardInstance): string[] {
  const out: string[] = [];
  if (card.damage > 0) out.push(`${card.damage} damage`);
  if (card.resources > 0) out.push(`${card.resources} resources`);
  if (card.exhausted) out.push("exhausted");
  if (card.committed) out.push("committed");
  if (card.face !== "up") out.push(`face ${card.face}`);
  if (card.controller != null && card.owner != null && card.controller !== card.owner) out.push(`controlled by P${card.controller + 1}`);
  return out;
}

function windowText(state: ScenarioState, ctx: ReduceContext): string {
  const window = state.window;
  if (!window) return "none";
  const detail = Object.entries(window)
    .filter(([key]) => key !== "kind")
    .map(([key, value]) => {
      if (key === "seat") return `P${Number(value) + 1}`;
      if (Array.isArray(value)) return `${key}: ${value.map((item) => cardName(state, ctx, String(item))).join(", ")}`;
      return typeof value === "string" && state.cards[value] ? `${key} ${cardName(state, ctx, value)}` : `${key} ${JSON.stringify(value)}`;
    });
  return `${window.kind}${detail.length > 0 ? ` (${detail.join("; ")})` : ""}`;
}

function section(title: string, ids: readonly string[], state: ScenarioState, ctx: ReduceContext, indent = "  "): string[] {
  return ids.length === 0 ? [] : [`${indent}${title}:`, ...ids.map((id) => `${indent}  ${cardLine(state, ctx, id)}`)];
}

// A deck's top is its first card; a discard pile's or the victory display's is its last.
function pile(label: string, ids: readonly string[] | undefined, state: ScenarioState, ctx: ReduceContext, show: number, topFirst = false): string | null {
  if (!ids || ids.length === 0) return null;
  const top = (topFirst ? ids.slice(0, show) : ids.slice(-show).reverse()).map((id) => cardName(state, ctx, id));
  return `${label} ${ids.length}${show > 0 ? ` (top: ${top.join(", ")})` : ""}`;
}

export type StateTextOptions = {
  /** List each legal intent. */
  legal?: boolean;
  /** Add the modifiers, delayed effects, set-aside cards and the decks' order. */
  full?: boolean;
};

export function stateText(state: ScenarioState, ctx: ReduceContext, options: StateTextOptions = {}): string {
  const lines: string[] = [];
  const outcome = state.lost ? `LOST: ${state.lossReason ?? "no reason"}` : state.stageCleared ? "WON (stage cleared)" : null;
  lines.push(`${state.scenarioId}, round ${state.round}, ${state.phase} (mode ${state.mode}), P${state.activeSeat + 1} acting, first player P${state.firstPlayer + 1}${outcome ? `, ${outcome}` : ""}`);
  lines.push(`window: ${windowText(state, ctx)}${state.passed.length > 0 ? `; passed: ${state.passed.map((seat) => `P${seat + 1}`).join(", ")}` : ""}`);
  if (state.failure) lines.push(`failure: ${state.failure}`);
  lines.push(`quest: ${state.questStage ? cardLine(state, ctx, state.questStage) : "none"}; ${stagesLeft(state, ctx)} stages left`);
  for (const id of [state.activeLocation, state.secondActiveLocation]) if (id) lines.push(`active location: ${cardLine(state, ctx, id)}`);
  // The total the quest resolves against, as the engine sums it (stagingThreatSources): the staged cards, the engaged enemies that contribute, an active location that contributes, a location of another area, and the held adjustment; a card that adds no Threat (an enemy considered engaged) is left out.
  const threat = stagingThreat(state, ctx.cards);
  lines.push(`staging (${threat} threat):`, ...state.staging.map((id) => `  ${cardLine(state, ctx, id)}`));
  lines.push(
    [pile("encounter deck", state.encounterDeck, state, ctx, options.full ? 3 : 0, true), pile("encounter discard", state.encounterDiscard, state, ctx, 3), pile("victory", state.victory, state, ctx, 5)]
      .filter(Boolean)
      .join("; "),
  );
  state.seats.slice(0, state.seatCount).forEach((seat, index) => {
    lines.push(`P${index + 1}: threat ${seat.threat}${seat.eliminated ? ", ELIMINATED" : ""}; hand ${seat.hand.length}, deck ${seat.deck.length}, discard ${seat.discard.length}`);
    lines.push(...section("heroes", seat.heroes, state, ctx), ...section("in play", seat.play.filter((id) => state.cards[id]?.host == null), state, ctx), ...section("engaged", seat.engaged, state, ctx), ...section("own staging area", seat.staging, state, ctx));
    if (seat.hand.length > 0) lines.push(`  hand: ${seat.hand.map((id) => cardName(state, ctx, id)).join(", ")}`);
    if (seat.discard.length > 0) lines.push(`  discard (top first): ${[...seat.discard].reverse().map((id) => cardName(state, ctx, id)).join(", ")}`);
  });
  if (state.stack.length > 0) {
    lines.push("stack (top last):", ...state.stack.map((frame) => `  ${frame.frame}${frame.cardId ? ` for ${cardName(state, ctx, frame.cardId)}` : ""}, P${frame.seat + 1}, step ${frame.step}${frame.peril ? ", peril" : ""}`));
  }
  if (options.full) lines.push(...fullText(state, ctx));
  if (options.legal) {
    const legal = legalIntents(state, ctx);
    lines.push(`legal intents (${legal.length}):`, ...legal.map((intent) => `  ${intentText(intent, state, ctx)}${targetsText(intent, state, ctx)}   ${JSON.stringify(intent)}`));
  }
  return lines.join("\n");
}

// The intents that take cards name them: what a Commit, a Travel or an Engage may choose from, and the host a played attachment may go on.
const TARGETED = new Set(["Commit", "CommitHide", "CommitFortitude", "CommitEscape", "Travel", "Engage", "ChooseEnemy", "DeclareDefender", "Undefended", "Distribute"]);

function targetsText(intent: LegalIntent, state: ScenarioState, ctx: ReduceContext): string {
  let ids: readonly string[] = [];
  if (intent.type === "PlayCard") ids = legalTargets(state, { type: "PlayCard", cardId: intent.cardId }, ctx);
  else if (TARGETED.has(intent.type)) ids = legalTargets(state, { type: intent.type } as Parameters<typeof legalTargets>[1], ctx);
  return ids.length === 0 ? "" : ` [from: ${ids.map((id) => cardName(state, ctx, id)).join(", ")}]`;
}

function fullText(state: ScenarioState, ctx: ReduceContext): string[] {
  const lines: string[] = [];
  if (state.modifiers.length > 0) {
    lines.push(`modifiers (${state.modifiers.length}):`);
    for (const modifier of state.modifiers) {
      lines.push(`  ${modifier.amount >= 0 ? "+" : ""}${modifier.amount} ${modifier.stat} on ${cardName(state, ctx, modifier.instanceId)} from ${cardName(state, ctx, modifier.sourceId)} until ${JSON.stringify(modifier.until)}${modifier.origin ? ` (constant ${modifier.origin})` : ""}`);
    }
  }
  if (state.delayed.length > 0) lines.push(`delayed effects: ${JSON.stringify(state.delayed)}`);
  if (state.setAside.length > 0) lines.push(`set aside: ${state.setAside.map((id) => cardName(state, ctx, id)).join(", ")}`);
  if (state.encounterDeck.length > 0) lines.push(`encounter deck (top first): ${state.encounterDeck.map((id) => cardName(state, ctx, id)).join(", ")}`);
  state.seats.slice(0, state.seatCount).forEach((seat, index) => {
    if (seat.deck.length > 0) lines.push(`P${index + 1} deck (top first): ${seat.deck.map((id) => cardName(state, ctx, id)).join(", ")}`);
  });
  return lines;
}

// The printed stages after the current one, counted as the table numbers them (the stages that are alternatives share one place); a quest with no place for the stage counts the quest deck.
function stagesLeft(state: ScenarioState, ctx: ReduceContext): number {
  const code = state.questStage ? state.cards[state.questStage]?.code : undefined;
  const place = code ? heldStage(state, ctx, code) : null;
  return place ? place.of - place.at : state.questDeck.length;
}
