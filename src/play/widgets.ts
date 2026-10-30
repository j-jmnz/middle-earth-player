// The numbers of the table pieces a scenario's script declares (docs/brief.md, Table): the Ring-bearer's life and the burden
// deck's count. A piece shows only when the scenario's definition declares it (`widgets`) and the game holds it, so a game of
// A Shadow of the Past or A Knife in the Dark shows neither. The engine wrote both numbers; nothing here changes one.
import type { Effect } from "../catalog/boundary.ts";
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

// The seat whose dial says it holds something facedown, what the dial says and which mark it wears: the Ring-bearer under the Watcher (a Ring
// mark, mec109.stage-4), or the hero that is the prisoner of Escape from Dol Guldur (a hero mark, 01123:B:1). A hero is never both.
export type HeldDial = { seat: number; words: string; mark: "oneRing" | "hero" };

export function heldDial(game: ScenarioState, nameOf: (code: string) => string): HeldDial | null {
  const ring = locationReadout(game);
  const ringLine = ringWords(ring, nameOf);
  if (ring?.heldBy != null && ringLine) return { seat: ring.heldBy, words: ringLine, mark: "oneRing" };
  const prisoner = Object.values(game.cards).find((card) => card.zone === "captive" && card.prisoner === true && card.host == null && card.owner != null);
  return prisoner && prisoner.owner != null ? { seat: prisoner.owner, words: prisonerWords(nameOf(prisoner.code)), mark: "hero" } : null;
}

/** What a prisoner's name says wherever it is shown: the dial, the preview, the list. */
export function prisonerWords(name: string): string {
  return `${name} is the prisoner, face down`;
}

export type TokenReadout = { name: string; tokens: number };

/**
 * The resource tokens on the campaign card, when it is in the game and one of its records places them (The Oath, 41050:A:3: "place 1 resource token
 * here" at the end of each round, read at its Resolution); null for a game whose campaign card has none. The engine wrote the number; nothing here
 * changes it.
 */
export function campaignTokens(game: ScenarioState, effects: readonly Effect[], nameOf: (code: string) => string): TokenReadout | null {
  const card = Object.values(game.cards).find((entry) => entry.zone === "campaign");
  if (!card || !effects.some((effect) => effect.cardCode === card.code && effect.instructions.some((instruction) => instruction.verb === "PlaceToken"))) return null;
  return { name: nameOf(card.code), tokens: card.resources };
}

/** The Nightmare setup card's instance next to the quest deck (zone `nightmare`), or null on Easy and Normal. */
export function nightmareCardId(game: ScenarioState): string | null {
  return Object.values(game.cards).find((card) => card.zone === "nightmare")?.id ?? null;
}
