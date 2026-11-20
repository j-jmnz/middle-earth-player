// Rules: rr.forced, rr.player-elimination (data/rules/entries.json); ledger lines 50801:B:2, 50812:A:1, 50812:A:2, 50814:A:2, 50820:A:2 (docs/brief.md, The Siege of Annúminas, The table).
//
// The piece The Siege of Annúminas' cards hold on the table, as a top-bar dial: the city strength of Annúminas, the resource tokens on it (the Setup places 20, damage to Annúminas takes them off, none left loses the game). The disc says the strength;
// the ring fills with the strength lost from the 20 of Standard mode and warms toward the loss. It warns when the damage this round's end brings (1 for each enemy in play, Battering Ram's X, a City Wall that reaches 3 resources)
// is as much as the strength left, and when 10 or less is left. The engine decided every number; nothing here changes one. A tap shows Annúminas and the mode card. Empty in any other scenario. Pure, so a test reads it.
import type { ScenarioState } from "../../../rules/core/state.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";

import { cityNearWords, cityOverrunWords, cityWords, incomingWords } from "./annuminas-words.ts";
import { cardsOf, type TableDial } from "../dials.ts";

const SCENARIO = "the-siege-of-annuminas";
const ANNUMINAS = "50812";
const RAM = "50814";
const WALL = "50820";
/** The strength at or under which the dial warns. */
const LOW = 10;
/** The resources City Wall holds when it is discarded: a third one is placed first. */
const WALL_LIMIT = 3;
const WALL_DAMAGE = 4;

/** The enemies in play, the staging area and the engaged ones: Annúminas' Forced deals 1 damage for each. */
function enemiesInPlay(game: ScenarioState, ctx: ReduceContext): number {
  return Object.values(game.cards).filter((card) => (card.zone === "staging" || card.zone === "engaged") && printedOf(ctx.cards, card.code).type === "enemy").length;
}

/** The dial Annúminas' city strength holds now: none in any other scenario, or with Annúminas out of play. */
export function annuminasDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const city = cardsOf(game, ANNUMINAS)[0];
  if (!city) return [];
  const strength = city.resources;
  const enemies = enemiesInPlay(game, ctx);
  // The Ram places a resource first, then deals X: its resources plus 2. City Wall places one, and at 3 deals 4.
  const ram = cardsOf(game, RAM)[0];
  const wall = cardsOf(game, WALL).filter((card) => card.resources + 1 >= WALL_LIMIT).length * WALL_DAMAGE;
  const ramDamage = ram ? ram.resources + 2 : 0;
  const incoming = enemies + ramDamage + wall;
  const warn = strength > 0 && incoming >= strength ? { level: "critical" as const, words: cityOverrunWords(strength, incoming) } : strength <= LOW ? { level: "near" as const, words: cityNearWords(strength) } : null;
  // The mode card lies beside the quest deck on its back: a tap shows it after Annúminas, so its Forced and the 9 damage for a player lost can be read.
  const mode = Object.values(game.cards).find((card) => card.zone === "modeCard");
  return [{ id: "city", testID: "annuminas-city", label: "City", name: `City strength of ${nameOf(ANNUMINAS)}, the players lose at 0:`, value: strength, cardId: city.id, ...(mode ? { extra: [mode.id] } : {}), ...(warn ? { warn } : {}), note: cityWords(strength, incomingWords(enemies, ramDamage, wall)) }];
}
