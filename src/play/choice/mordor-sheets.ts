// Rules: rr.damage, rr.destroy, rr.player-elimination, hrd.objective-heroes, hrd.objective-hero-elimination (data/rules/entries.json); ledger lines 16035:A:2, 16039:A:2, 16031:A:2.
// The rows of the damage trays of The Long Arm of Mordor (Sauron's Enforcers, Overrun by Orcs): one damage at a time among the characters, objective-heroes, heroes in the staging area and guarded heroes among them. A row says what the card is when that is not plain
// ("objective-hero", "staging area", "guarded by ..."), the damage it stands at, "destroyed" on the point that destroys it, and, as a caution that arms the confirm, the player that point eliminates or the game it loses. Told only in a game with objective-heroes. Pure.
import type { Instruction } from "../../catalog/boundary.ts";
import { gameReads } from "../../rules/core/game-reads.ts";
import { printedOf } from "../../rules/core/printed.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { damageOutcome } from "../store/foresight.ts";
import { captivePlace, ownerTag } from "./sheet-parts.ts";
import { destroyedCaution, type FireRow } from "./aflame-sheets.ts";

/** The row for `id` in an AssignDamage of The Long Arm of Mordor, or null for any other pick and game. `options` are the rows of the pick (the owner is named when they hold more than one player's cards). */
export function mordorRow(pick: Instruction, id: string, options: readonly string[], game: ScenarioState, ctx: ReduceContext, name: (cardId: string) => string): FireRow | null {
  if (pick.verb !== "AssignDamage" || !gameReads(game, ctx, '"TakeObjectiveHero"')) return null;
  const card = game.cards[id];
  if (!card) return null;
  const amount = pick.single === true ? (pick.left ?? 1) : 1;
  const outcome = damageOutcome(game, ctx, id, amount);
  const printed = printedOf(ctx.cards, card.code);
  const kind = card.captive === true ? captivePlace(game, card, name) : card.zone === "heroes" && printed.type === "objective" ? "objective-hero" : null;
  const hitPoints = printed.health;
  const standing = hitPoints == null ? `${card.damage + amount} damage` : `${Math.min(card.damage + amount, hitPoints)} of ${hitPoints} damage`;
  const parts = [name(id), kind, standing, outcome.destroyed ? "destroyed" : null, ownerTag(game, card, options)].filter((part): part is string => part != null);
  return { label: parts.join(" · "), mark: { icon: "damage", value: amount, danger: outcome.destroyed }, ...(outcome.destroyed ? { caution: destroyedCaution(outcome, name(id)) } : {}) };
}
