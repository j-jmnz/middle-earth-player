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

export type LocationReadout = {
  // The printed codes of the active locations, the first slot first, so the table can name both (mec109.stage-4).
  active: readonly string[];
  // The code of the card the Ring-bearer is facedown under, when it is.
  heldUnder: string | null;
  // The seat whose dial carries the Ring mark while it is (its owner, else its controller, else the first player, who takes it
  // back); null when it is not held.
  heldBy: number | null;
};

// The active locations and the facedown Ring-bearer, for a scenario that declares a second active location slot; null otherwise. The
// engine decides both; nothing here changes either.
export function locationReadout(game: ScenarioState): LocationReadout | null {
  if (!game.widgets.secondActiveLocation) return null;
  const active = [game.activeLocation, game.secondActiveLocation].flatMap((id) => {
    const code = id ? game.cards[id]?.code : undefined;
    return code ? [code] : [];
  });
  const captive = Object.values(game.cards).find((card) => card.zone === "captive");
  const heldUnder = captive?.host ? (game.cards[captive.host]?.code ?? null) : null;
  return { active, heldUnder, heldBy: heldUnder && captive ? (captive.owner ?? captive.controller ?? game.firstPlayer) : null };
}
