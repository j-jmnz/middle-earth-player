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
  // The code of the card the Ring-bearer is facedown under, when it is.
  heldUnder: string | null;
  // The seat that gets it back: the Watcher's Forced effect always returns the hero to the first player (releaseRingBearer,
  // families/south-captive.ts), and a captive card keeps no controller. Null when it is not held. Its dial wears the Ring mark.
  heldBy: number | null;
};

// The facedown Ring-bearer, for a scenario that declares a second active location slot (the active locations themselves are
// drawn on the table); null otherwise. The engine decides both; nothing here changes either.
export function locationReadout(game: ScenarioState): LocationReadout | null {
  if (!game.widgets.secondActiveLocation) return null;
  const captive = Object.values(game.cards).find((card) => card.zone === "captive");
  const heldUnder = captive?.host ? (game.cards[captive.host]?.code ?? null) : null;
  return { heldUnder, heldBy: heldUnder ? game.firstPlayer : null };
}

/** What the held Ring-bearer's dial says ("The Ring-bearer is facedown under Watcher in the Water"), or null when it is not held. */
export function ringWords(readout: LocationReadout | null, nameOf: (code: string) => string): string | null {
  return readout?.heldUnder ? `The Ring-bearer is facedown under ${nameOf(readout.heldUnder)}` : null;
}
