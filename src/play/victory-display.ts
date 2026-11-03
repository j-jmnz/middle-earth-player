// Rules: ltp.victory-display, rr.discard-pile-and-victory-display, ltp.scoring (data/rules/entries.json).
//
// The victory display the command column draws (docs/design-system-table.md, Command column): the cards in `game.victory`, newest first, each with
// the Victory points it scores on the side it lies (the same count the score adds up, campaign/score.ts), and the total. Pure, so a test reads it.
import { printedOf, type PrintedCard } from "../rules/printed.ts";
import { victoryOf } from "../rules/printed-stat.ts";
import { heldAmount, type ScenarioState } from "../rules/state.ts";

import { pictureKey } from "./picture-key.ts";

export type VictoryRow = { id: string; name: string; points: number };
export type VictoryDisplay = { total: number; rows: readonly VictoryRow[] };

const EMPTY: VictoryDisplay = { total: 0, rows: [] };

/** The display now. `nameOf` takes a picture key (the card's name as the table shows it). */
export function victoryDisplayOf(game: Pick<ScenarioState, "victory" | "cards" | "modifiers">, cards: ReadonlyMap<string, PrintedCard>, nameOf: (key: string) => string): VictoryDisplay {
  if (game.victory.length === 0) return EMPTY;
  const rows: VictoryRow[] = [];
  let total = 0;
  for (let at = game.victory.length - 1; at >= 0; at -= 1) {
    const id = game.victory[at] as string;
    const card = game.cards[id];
    if (!card) continue;
    const points = victoryOf(card, printedOf(cards, card.code)) ?? heldAmount(game as ScenarioState, id, "gainsVictory");
    total += points;
    rows.push({ id, name: nameOf(pictureKey(card)), points });
  }
  return { total, rows };
}

function same(left: VictoryDisplay, right: VictoryDisplay): boolean {
  return left.total === right.total && left.rows.length === right.rows.length && left.rows.every((row, at) => row.id === right.rows[at]?.id && row.name === right.rows[at]?.name && row.points === right.rows[at]?.points);
}

/**
 * A store selector for the display: it returns its previous result while the victory array, the cards and the modifiers are the same
 * objects, and, when the state moved, the previous result again unless the display itself changed, so a subscriber renders only then.
 */
export function victorySelector(cards: ReadonlyMap<string, PrintedCard>, nameOf: (key: string) => string): (game: ScenarioState) => VictoryDisplay {
  let last: { victory: ScenarioState["victory"]; cards: ScenarioState["cards"]; modifiers: ScenarioState["modifiers"]; display: VictoryDisplay } | null = null;
  return (game) => {
    if (last && last.victory === game.victory && last.cards === game.cards && last.modifiers === game.modifiers) return last.display;
    const built = victoryDisplayOf(game, cards, nameOf);
    const display = last && same(last.display, built) ? last.display : built;
    last = { victory: game.victory, cards: game.cards, modifiers: game.modifiers, display };
    return display;
  };
}
