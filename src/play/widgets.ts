// The numbers of the table pieces a scenario's script declares (docs/brief.md, Table): the Ring-bearer's life and the burden
// deck's count. A piece shows only when the scenario's definition declares it (`widgets`) and the game holds it, so a game of
// A Shadow of the Past or A Knife in the Dark shows neither. The engine wrote both numbers; nothing here changes one.
import type { ScenarioState } from "../rules/reduce.ts";

export type WidgetReadouts = {
  // The Ring-bearer's life (mec109.ringbearers-life), or null when the scenario has no life tracker.
  life: number | null;
  // How many cards the burden deck holds (mec109.burden-deck), or null when the scenario has none. Their order is hidden.
  burdenDeck: number | null;
};

export function widgetReadouts(game: ScenarioState): WidgetReadouts {
  return {
    life: game.widgets.lifeTracker && game.life != null ? game.life : null,
    burdenDeck: game.widgets.burdenDeck && game.burdenDeck != null ? game.burdenDeck.length : null,
  };
}
