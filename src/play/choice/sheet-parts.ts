// The pieces every sheet builder uses: the step's words, a card's stat as the engine reads it, an option's label, and
// whether an intent type is legal now.
import type { LegalIntent, ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { printedOf } from "../../rules/core/printed.ts";

import { pictureKey } from "../canvas/picture-key.ts";
import { islandTell } from "../words/scenarios/uncharted.ts";
import { STEP_WORDS } from "../phases/rail.ts";
import type { SheetNames, SheetOption, SheetStat } from "./sheet-types.ts";

export function step(game: ScenarioState): string {
  return STEP_WORDS[game.mode] ?? game.phase;
}

type StatName = "willpower" | "attack" | "defense" | "threat";
const STAT_WORDS: Record<StatName, string> = { willpower: "Willpower", attack: "Attack", defense: "Defense", threat: "Threat" };

/** One of a card's stats as the engine reads it now (modifiers applied), for a sheet tile or header. */
export function statOf(game: ScenarioState, ctx: ReduceContext, id: string, stat: StatName): SheetStat[] {
  const card = game.cards[id];
  return card ? [{ icon: stat, value: modifiedStat(game, card, stat, ctx.cards), word: STAT_WORDS[stat] }] : [];
}

/** A card's name as a tile or row reads it; a Lost Island's is followed by what tells it from the others (progress, place in staging). */
export function cardLabel(game: ScenarioState, names: SheetNames, id: string): string {
  const card = game.cards[id];
  const tell = card ? islandTell(game, card) : null;
  return tell ? `${names.card(id)} · ${tell}` : names.card(id);
}

/**
 * The row of a Captive of The Uruk-hai in a pick (Grishnákh's, 143024:A:1; Hands of a Healer's, 143016:A:3, which mixes Captives with the heroes the players control): "Legolas · Captive · 2 of 4 damage", with
 * " · Player 2" after it when the options hold the heroes of more than one player. Undefined for any other row.
 */
export function captiveLabel(game: ScenarioState, ctx: ReduceContext, names: SheetNames, id: string, options: readonly string[]): string | undefined {
  const card = game.cards[id];
  if (card?.captive !== true) return undefined;
  const hitPoints = printedOf(ctx.cards, card.code).health;
  const damage = hitPoints == null ? `${card.damage} damage` : `${card.damage} of ${hitPoints} damage`;
  const owners = new Set(options.map((other) => game.cards[other]?.owner).filter((owner) => owner != null));
  return `${names.card(id)} · Captive · ${damage}${card.owner != null && owners.size > 1 ? ` · Player ${card.owner + 1}` : ""}`;
}

export function option(game: ScenarioState, names: SheetNames, id: string): SheetOption {
  if (id.startsWith("seat:")) return { id, label: `Player ${Number(id.slice(5)) + 1}`, code: null };
  // The staging area, where a Trap or a Guarded attachment is played (src/rules/families/attachments/play.ts).
  if (id === "staging") return { id, label: "The staging area", code: null };
  const card = game.cards[id];
  // Lost Islands share one name: what tells them apart (progress, place in staging) follows it.
  if (card) return { id, label: cardLabel(game, names, id), code: pictureKey(card) };
  // A branch of a Choose instruction is named by its id in the effect record.
  return { id, label: id.charAt(0).toUpperCase() + id.slice(1), code: null };
}

export function has(legal: readonly LegalIntent[], type: LegalIntent["type"]): boolean {
  return legal.some((intent) => intent.type === type);
}
