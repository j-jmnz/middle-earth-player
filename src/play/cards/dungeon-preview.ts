// Rules: rr.guarded, rr.attachment-cards, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 01108:A:1-2, 01107:A:1, 01123:B:1, 01105:A:1.
// The one line a card of Escape from Dol Guldur says about itself in the card preview (table-preview.ts) when it has more to say than its text:
// an objective's guard, the prisoner, an Orc Guard's card, Iron Shackles on a deck; and of A Storm on Cobas Haven, a tower the players control and the Ship enemy a location holds out of play. The engine decided each; nothing here changes one.
import { freeOfEncounters } from "../../rules/families/objectives/index.ts";
import { FALLEN_SUFFIX, ORC_GUARD_CODE, fallenBase, isShipObjectiveCode, printedOf, type PrintedCard } from "../../rules/core/printed.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { prisonerWords } from "../readouts/widgets.ts";

/**
 * The text of the engine's Orc Guard stand-in, and of a hero Fallen Into Evil made an enemy (`<code>~enemy`; its card shows the hero's art and its game text
 * is blank), from their printed definitions (rules/core/printed.ts): the stats a real card would print. Null for any other code.
 */
export function standInText(cards: ReadonlyMap<string, PrintedCard>, code: string): string | null {
  const fallen = code.endsWith(FALLEN_SUFFIX);
  // A Ship enemy the players took control of as a Ship objective (Corsair Skirmisher, 12125:A:3): its definition is a derived one too (printed.ts), and its card shows the enemy's art.
  if (isShipObjectiveCode(code) && cards.has(fallenBase(code))) {
    const ship = printedOf(cards, code);
    return `Ship objective now, taken from the Corsair fleet. Willpower ${ship.willpower ?? 0}, Attack ${ship.attack ?? 0}, Defense ${ship.defense ?? 0}, ${ship.health ?? 0} hit point${ship.health === 1 ? "" : "s"}.`;
  }
  if (code !== ORC_GUARD_CODE && !(fallen && cards.has(fallenBase(code)))) return null;
  const printed = printedOf(cards, code);
  const threat = printed.threat ? `Threat ${printed.threat}` : "no Threat";
  return `${fallen ? "Fallen into evil: an enemy now" : "Enemy"}. Attack ${printed.attack ?? 0}, Defense ${printed.defense ?? 0}, ${printed.health ?? 0} hit point${printed.health === 1 ? "" : "s"}, ${threat}.`;
}

/** The muted line under a card's name in its preview, or null: what only the table knows about it. */
export function dungeonDetail(game: ScenarioState, ctx: ReduceContext, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  if (card.code === ORC_GUARD_CODE) return "The facedown card under it returns to its owner's discard pile when it leaves play.";
  if (card.prisoner === true && card.zone === "captive" && card.host == null) return prisonerWords(name(cardId));
  if (game.seats.some((seat) => seat.deckAttached?.includes(cardId))) return `${name(cardId)}: your next draw is discarded`;
  if (card.zone === "staging" && ctx.cards.get(card.code)?.type === "objective") {
    const guards = card.attachments.filter((id) => game.cards[id]?.guard === true && game.cards[id]?.host === cardId);
    if (guards.length > 0) return `Guarded by ${guards.map(name).join(", ")}`;
    if (claimable(ctx, card.code) && freeOfEncounters(game, cardId)) return "Free of encounters: you can claim it";
    // A tower freed of encounters stays in the staging area, controlled by the players as a group (ControlWhenFree, 12134:A:2): it has no hero to hang on.
    if (card.claimed === true && card.controller == null) return "Free of encounters: the players control it";
  }
  // A Ship enemy a location holds out of play while it is the active location (Belfalas Islet, 12129:A:2): faceup, but not on the table.
  const held = Object.values(game.cards).filter((other) => other.zone === "under" && other.host === cardId && game.sea?.held?.[other.id] != null);
  if (held.length > 0) return `${held.map((other) => name(other.id)).join(", ")} is held underneath, out of play, while this is the active location`;
  return null;
}

// An objective with a claiming Action (the condition of which reads "free of encounters", rr.guarded).
function claimable(ctx: ReduceContext, code: string): boolean {
  return ctx.effects.some((effect) => effect.cardCode === code && effect.timing === "action" && JSON.stringify(effect.condition ?? null).includes("freeOfEncounters"));
}
