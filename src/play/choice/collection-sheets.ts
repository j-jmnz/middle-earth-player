// Rules: rr.unique-cards (data/rules/entries.json); ledger line 11212:A:2, and Helm of Secrecy's SwapHero. The heroes of a collection a card offers (Send for Help (Tactics), Helm of Secrecy), as the sheet lists them: by name, and a
// title that two or more of them share carries its sphere and its pack ("Aragorn · Leadership · Core Set"). Only the order of the list is the sheet's: the engine's options stay in code order.
import type { Instruction } from "../../catalog/boundary.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { printedOf } from "../../rules/core/printed.ts";

import type { SheetNames } from "./sheet-types.ts";

const SPHERE_WORDS: Readonly<Record<string, string>> = { leadership: "Leadership", tactics: "Tactics", spirit: "Spirit", lore: "Lore", neutral: "Neutral", fellowship: "Fellowship", baggins: "Baggins" };

/** Whether a pick asks for a hero of the collection. */
export function asksCollection(instruction: Instruction | undefined): boolean {
  return instruction?.verb === "TakeHeroFromCollection" || instruction?.verb === "SwapHero";
}

/** The options of a collection pick by name, ties kept in the engine's order. */
export function collectionOrder(game: ScenarioState, ctx: ReduceContext, ids: readonly string[]): string[] {
  const name = (id: string): string => printedOf(ctx.cards, game.cards[id]?.code ?? "").name;
  return [...ids].sort((left, right) => name(left).localeCompare(name(right)));
}

/** One option's label: its name, with its sphere and pack when another option shares the name. */
export function collectionLabel(game: ScenarioState, ctx: ReduceContext, id: string, ids: readonly string[], names: Pick<SheetNames, "card" | "pack">): string {
  const code = game.cards[id]?.code ?? "";
  const printed = printedOf(ctx.cards, code);
  const same = ids.filter((other) => printedOf(ctx.cards, game.cards[other]?.code ?? "").name === printed.name).length > 1;
  if (!same) return names.card(id);
  const pack = names.pack?.(code) ?? null;
  return [names.card(id), printed.sphere ? (SPHERE_WORDS[printed.sphere] ?? printed.sphere) : null, pack].filter((part): part is string => part != null).join(" · ");
}
