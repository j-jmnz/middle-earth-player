// Rules: dcce.sailing-tests (data/rules/entries.json). The two questions of a Sailing test, as the table answers them (docs/design-system-table.md, The Sailing test):
// the first player's commit (a pick of characters on the play area, no willpower pill: this is not the quest commit) and, for each success symbol among the cards looked at,
// shift the heading on-course or keep it. Every card, symbol and number comes from the engine; the sheets only name them.
import { lookedIds, sailingSymbols, sailingTest, successSymbols } from "../../rules/families/sea/sailing.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { modifierActive } from "../../rules/core/state.ts";
import { legalTargets } from "../../rules/engine/reduce.ts";
import { askingToCommit, askingToLook, askingToShift } from "../../rules/families/sea/sailing-legal.ts";

import { SAILING_COMMIT_NOTE, SAILING_COMMIT_TITLE, SAILING_PASS_ARMED, sailingTitle } from "../words/sea.ts";
import type { Instruction } from "../../catalog/boundary.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { damageOutcome } from "../store/foresight.ts";
import { option, step } from "./sheet-parts.ts";
import type { LookRow, MultiSheet, PickSheet, Sheet, SheetNames } from "./sheet-types.ts";

/** The success symbols a card prints: the engine's own count (families/sea/sailing.ts), which the table's marks, rows and total all read. */
export const successOf = successSymbols;

/** The cards a Sailing test looked at, with the success symbols each prints. */
export function lookRows(game: ScenarioState, ctx: ReduceContext, names: SheetNames): readonly LookRow[] {
  return lookedIds(game).flatMap((id) => {
    const card = game.cards[id];
    return card ? [{ id, code: card.code, name: names.card(id), success: successOf(ctx.cards, card.code) }] : [];
  });
}

/** How many success symbols the looked-at cards count in all: the symbols printed less the ones a card in play cancels (Rough Waters), the number the engine counts for step 4. */
export function successesOf(game: ScenarioState, ctx: ReduceContext): number {
  return sailingSymbols(game, lookedIds(game), ctx.cards).counted;
}

/** The cards in play that cancel Sailing success symbols, by name ("Rough Waters"), or none. */
function cancelers(game: ScenarioState, names: SheetNames): string {
  const ids = game.modifiers.filter((modifier) => modifier.stat === "sailingCancel" && modifier.instanceId === "table" && modifierActive(game, modifier)).map((modifier) => modifier.sourceId);
  return [...new Set(ids.map((id) => names.card(id)))].join(", ");
}

/** "Rough Waters cancels 1." when a card cancelled symbols of the cards looked at, else nothing. */
export function cancelNote(game: ScenarioState, ctx: ReduceContext, names: SheetNames): string | null {
  const { cancelled } = sailingSymbols(game, lookedIds(game), ctx.cards);
  return cancelled > 0 ? `${cancelers(game, names)} cancels ${cancelled}.` : null;
}

/** The Sailing commit: a multi pick of the characters the engine lets commit, confirmed with a Commit (the intent is the quest commit's, and the engine reads it as the test's). */
export function sailingCommitSheet(game: ScenarioState, ctx: ReduceContext, names: SheetNames): MultiSheet {
  return {
    kind: "multi",
    key: `sailing-commit:${game.round}`,
    step: "Quest",
    title: SAILING_COMMIT_TITLE,
    note: SAILING_COMMIT_NOTE,
    verb: "Commit",
    // No willpower stat on a tile: the test does not use it.
    options: legalTargets(game, { type: "Commit" }, ctx).map((id) => option(game, names, id)),
    build: { kind: "Commit" },
    allowEmpty: false,
    preselected: [],
    // The test is the first player's to run, and a Pass commits no one: nobody looks, and the heading stays where the shift left it.
    alternative: { label: "Pass", intent: { type: "Pass" }, caution: SAILING_PASS_ARMED },
  };
}

/** The answer to the symbols found: shift on-course, or keep the heading, once for each symbol; the looked-at cards are listed with their marks. */
export function sailingShiftSheet(game: ScenarioState, ctx: ReduceContext, names: SheetNames): PickSheet | null {
  const test = sailingTest(game);
  if (test?.step !== "shift") return null;
  const rows = lookRows(game, ctx, names);
  const total = successesOf(game, ctx);
  return {
    kind: "pick",
    key: `sailing-shift:${game.round}:${test.left}:${test.looked.join(",")}`,
    step: step(game),
    title: sailingTitle(total),
    note: [cancelNote(game, ctx, names), `${test.left} ${test.left === 1 ? "symbol" : "symbols"} left to answer. Shift the heading on-course for each, or keep it as it is.`].filter(Boolean).join(" "),
    verb: "",
    options: [],
    look: rows,
    primary: { label: "Shift on-course", intent: { type: "Choose", optionId: "shift" } },
    alternative: { label: "Keep the heading", intent: { type: "Choose", optionId: "keep" } },
    // The one filled button is the answer itself: nothing is picked first.
    selectionMade: true,
  };
}

/** The look with nothing to answer (no symbol found, or the heading is back on Sun): the strip and its one answer, Done, before the cards are discarded. */
export function sailingLookSheet(game: ScenarioState, ctx: ReduceContext, names: SheetNames): PickSheet | null {
  const test = sailingTest(game);
  if (test?.step !== "look") return null;
  const total = successesOf(game, ctx);
  return {
    kind: "pick",
    key: `sailing-look:${game.round}:${test.looked.join(",")}`,
    step: step(game),
    title: sailingTitle(total),
    note: [cancelNote(game, ctx, names), total === 0 ? "No Sailing success symbol counts. The cards looked at are discarded when you are done." : "The heading is on-course, so no shift is left to make. The cards looked at are discarded when you are done."].filter(Boolean).join(" "),
    verb: "",
    options: [],
    look: lookRows(game, ctx, names),
    primary: { label: "Done", intent: { type: "Choose", optionId: "done" } },
    alternative: null,
    selectionMade: true,
  };
}

/** The Sailing test's question for the open window, or null when no test is being asked. */
export function sailingSheet(game: ScenarioState, ctx: ReduceContext, names: SheetNames): Sheet | null {
  if (askingToCommit(game)) return sailingCommitSheet(game, ctx, names);
  if (askingToShift(game)) return sailingShiftSheet(game, ctx, names);
  if (askingToLook(game)) return sailingLookSheet(game, ctx, names);
  return null;
}

/** The damage a card attached to a Ship objective deals to it when it exhausts ("Forced: When attached objective exhausts, deal 2 damage to it", 12132:A:1), and the name of that card; null for a ship without one. */
function exhaustDamage(game: ScenarioState, ctx: ReduceContext, ship: string, names: Pick<SheetNames, "card">): { amount: number; source: string } | null {
  let amount = 0;
  let source = "";
  for (const attached of game.cards[ship]?.attachments ?? []) {
    const code = game.cards[attached]?.code;
    for (const effect of ctx.effects) {
      if (effect.cardCode !== code || effect.trigger !== "shipExhausted") continue;
      for (const instruction of effect.instructions) {
        if (instruction.verb === "DamageCard" && instruction.target === "host" && typeof instruction.amount === "number") {
          amount += instruction.amount;
          source = names.card(attached);
        }
      }
    }
  }
  return amount > 0 ? { amount, source } : null;
}

/**
 * The row of a Ship objective in a pick that exhausts it or attaches a card to it (Taking on Water's Action and Coast of Anfalas's Travel cost, 12132:A:1, 12128:A:2; Taking on Water itself, 12132:A:1):
 * its owner when the options hold the ships of more than one player, and a caution when the exhaust would make a card on it deal damage, with the loss when that destroys it. Null for any other row.
 */
export function shipRow(pick: Instruction, next: Instruction | undefined, id: string, options: readonly string[], game: ScenarioState, ctx: ReduceContext, names: Pick<SheetNames, "card">): { label?: string; caution?: string } | null {
  const exhausts = pick.verb === "Pick" && next?.verb === "Exhaust";
  const attaches = pick.verb === "AttachSelf" && pick.to.kind === "ship" && pick.to.defender !== true;
  const card = game.cards[id];
  if ((!exhausts && !attaches) || !card || printedOf(ctx.cards, card.code).ship !== "objective") return null;
  const owners = new Set(options.map((other) => game.cards[other]?.controller));
  const name = names.card(id);
  const label = owners.size > 1 && card.controller != null ? `${name} · Player ${card.controller + 1}` : undefined;
  const water = exhausts ? exhaustDamage(game, ctx, id, names) : null;
  if (!water) return label ? { label } : null;
  const outcome = damageOutcome(game, ctx, id, water.amount);
  // A Ship objective destroyed loses the game (the Dream-chaser, 11080:A:4) or eliminates its controller (the other ships): its own record says which.
  const records = ctx.effects.filter((effect) => effect.cardCode === card.code && effect.trigger === "characterDestroyed").flatMap((effect) => effect.instructions.map((instruction) => instruction.verb));
  const consequence = outcome.loss != null || records.includes("LoseGame") ? " and the game is lost" : records.includes("EliminatePlayer") ? ` and ${card.controller != null && game.seatCount > 1 ? `Player ${card.controller + 1}` : "its player"} is eliminated` : "";
  const caution = outcome.destroyed ? `Tap again: ${water.source}: ${water.amount} damage destroys ${name}${consequence}` : `Tap again: ${water.source}: ${water.amount} damage to ${name}`;
  return { ...(label ? { label } : {}), caution };
}
