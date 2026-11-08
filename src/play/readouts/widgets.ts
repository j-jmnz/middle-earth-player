// The numbers of the table pieces a scenario's script declares (docs/brief.md, Table): the Ring-bearer's life and the burden
// deck's count. A piece shows only when the scenario's definition declares it (`widgets`) and the game holds it, so a game of
// A Shadow of the Past or A Knife in the Dark shows neither. The engine wrote both numbers; nothing here changes one.
import type { Effect } from "../../catalog/boundary.ts";
import { stageOf } from "../../rules/families/breaking/areas.ts";
import type { ScenarioState } from "../../rules/engine/reduce.ts";

import { headingStepOf, type HeadingStep } from "../dream-chaser/heading.ts";

const TO_ISENGARD = "143022";

export type WidgetReadouts = {
  // The Ring-bearer's life (mec109.ringbearers-life), or null when the scenario has no life tracker.
  life: number | null;
  // How many cards the burden deck holds (mec109.burden-deck), or null when the scenario has none. Their order is hidden.
  burdenDeck: number | null;
  // The pursuit value of The Uruk-hai (mec112.pursuit), present only while the scenario's Setup has set one; the engine owns the number.
  pursuit?: number;
};

export function widgetReadouts(game: ScenarioState): WidgetReadouts {
  return {
    life: game.widgets.lifeTracker && game.life != null ? game.life : null,
    burdenDeck: game.widgets.burdenDeck && game.burdenDeck != null ? game.burdenDeck.length : null,
    ...(game.pursuit != null ? { pursuit: game.pursuit } : {}),
  };
}

/** The pursuit value at which the players lose (To Isengard!, 143022:A:2: "30 or greater"); a test pins it to that record. */
export const PURSUIT_LOSS_AT = 30;

/** The limit the Pursuit dial warns of: where it ends, and what a screen reader hears beside its number ("the players lose at 30"). */
export const PURSUIT_LIMIT = { at: PURSUIT_LOSS_AT, words: `the players lose at ${PURSUIT_LOSS_AT}` } as const;

/** The reading aid of the pursuit value: "Pursuit value 14, the players lose at 30". */
export function pursuitWords(value: number): string {
  return `Pursuit value ${value}, ${PURSUIT_LIMIT.words}`;
}

export type LocationReadout = {
  // The code of the card the Ring-bearer is facedown under, when it is.
  heldUnder: string | null;
  // The seat that gets it back: the Watcher's Forced effect always returns the hero to the first player (releaseRingBearer,
  // families/south/captive.ts), and a captive card keeps no controller. Null when it is not held. Its dial wears the Ring mark.
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

// A seat's dial says it holds something facedown, what the dial says and which mark it wears: the Ring-bearer under the Watcher (a Ring mark, mec109.stage-4), or the hero that is the prisoner of Escape from Dol Guldur
// (a hero mark, 01123:B:1), or a hero an enemy holds in Carried Away (18074:A:1, the same mark), or the Captives of The Uruk-hai that are the seat's heroes (143022:A:1, the same mark). A hero is never two of these.
export type HeldDial = { seat: number; words: string; mark: "oneRing" | "hero" };

/** The first seat's dial that holds something (every scenario but The Uruk-hai has at most one). */
export function heldDial(game: ScenarioState, nameOf: (code: string) => string): HeldDial | null {
  return heldDials(game, nameOf)[0] ?? null;
}

/** Each seat's dial that holds something, by seat: the Captives of The Uruk-hai are held for each owning seat, so two seats may each wear a mark. */
export function heldDials(game: ScenarioState, nameOf: (code: string) => string): HeldDial[] {
  const ring = locationReadout(game);
  const ringLine = ringWords(ring, nameOf);
  if (ring?.heldBy != null && ringLine) return [{ seat: ring.heldBy, words: ringLine, mark: "oneRing" }];
  const prisoner = Object.values(game.cards).find((card) => card.zone === "captive" && card.prisoner === true && card.host == null && card.owner != null);
  if (prisoner && prisoner.owner != null) return [{ seat: prisoner.owner, words: prisonerWords(nameOf(prisoner.code)), mark: "hero" }];
  // A hero an enemy holds (Carried Away, 18074:A:1): the first seat that has one, its dial says which enemy holds which hero.
  const held = Object.values(game.cards).find((card) => card.zone === "captive" && card.guardedHero === true && card.owner != null);
  const holder = held?.host ? game.cards[held.host] : undefined;
  if (held && held.owner != null) return [{ seat: held.owner, words: `${nameOf(held.code)} is held facedown${holder ? ` by ${nameOf(holder.code)}` : ""}`, mark: "hero" }];
  return captiveDials(game, nameOf);
}

// The Captives of The Uruk-hai, one dial for each seat whose heroes they are: "Gimli is a Captive under To Isengard!" or "Gimli is a Captive held by Grishnákh" (two of one seat's are told in one line).
function captiveDials(game: ScenarioState, nameOf: (code: string) => string): HeldDial[] {
  const bySeat = new Map<number, string[]>();
  for (const card of Object.values(game.cards)) {
    if (card.zone !== "captive" || card.captive !== true || card.owner == null) continue;
    const holder = card.host ? game.cards[card.host] : undefined;
    const where = holder && holder.code !== TO_ISENGARD ? `held by ${nameOf(holder.code)}` : `under ${nameOf(TO_ISENGARD)}`;
    bySeat.set(card.owner, [...(bySeat.get(card.owner) ?? []), `${nameOf(card.code)} is a Captive ${where}`]);
  }
  return [...bySeat.entries()].sort(([a], [b]) => a - b).map(([seat, lines]) => ({ seat, words: lines.join(". "), mark: "hero" as const }));
}

/** What a prisoner's name says wherever it is shown: the dial, the preview, the list. */
export function prisonerWords(name: string): string {
  return `${name} is the prisoner, face down`;
}

export type TokenReadout = { name: string; tokens: number };

// The quest stage of the seat the table shows: the one stage before stages are separate, that seat's own after.
function stageCard(game: ScenarioState, seat: number) {
  const id = stageOf(game, seat);
  return id ? game.cards[id] : undefined;
}

/**
 * The resource tokens on the campaign card, when it is in the game and one of its records places them (The Oath, 41050:A:3: "place 1 resource token
 * here" at the end of each round, read at its Resolution), or else on the current stage when one of its records does (Journey in the Dark, 142041:B:3:
 * "place 1 resource token on this stage" after an enemy is defeated, which holds the stage back until it has enough); null for a game with neither.
 * The engine wrote the number; nothing here changes it. Once stages are separate, the stage is the shown `seat`'s.
 */
export function campaignTokens(game: ScenarioState, effects: readonly Effect[], nameOf: (code: string) => string, seat = 0): TokenReadout | null {
  const places = (code: string) => effects.some((effect) => effect.cardCode === code && effect.instructions.some((instruction) => instruction.verb === "PlaceToken"));
  const holders = [Object.values(game.cards).find((entry) => entry.zone === "campaign"), stageCard(game, seat)];
  const card = holders.find((entry) => entry != null && places(entry.code));
  return card ? { name: nameOf(card.code), tokens: card.resources } : null;
}

/** The Nightmare setup card's instance next to the quest deck (zone `nightmare`), or null on Easy and Normal. */
export function nightmareCardId(game: ScenarioState): string | null {
  return Object.values(game.cards).find((card) => card.zone === "nightmare")?.id ?? null;
}

// The Heading dial of the top bar (dcce.heading): the current step, and the Heading card whose preview a tap opens. Shown only while the Heading card is in play,
// which is while the sea family holds a heading; the engine owns the step.
export type HeadingReadout = { step: HeadingStep; cardId: string | null };

export function headingReadout(game: ScenarioState): HeadingReadout | null {
  const step = headingStepOf(game.sea?.heading);
  if (!step) return null;
  const id = game.sea?.headingCard ?? null;
  return { step, cardId: id != null && game.cards[id] != null ? id : null };
}
