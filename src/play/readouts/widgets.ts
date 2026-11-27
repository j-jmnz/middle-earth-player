// The numbers of the table pieces a scenario's script declares (docs/brief.md, Table): the Ring-bearer's life and the burden
// deck's count. A piece shows only when the scenario's definition declares it (`widgets`) and the game holds it, so a game of
// A Shadow of the Past or A Knife in the Dark shows neither. The engine wrote both numbers; nothing here changes one.
import { useMemo } from "react";

import type { Effect } from "../../catalog/boundary.ts";
import { captivesOf } from "../../rules/families/captives/values.ts";
import { isHeldCharacter } from "./haradrim/captured.ts";
import { stagedDial } from "./haradrim/staged.ts";
import { stageOf } from "../../rules/families/breaking/areas.ts";
import type { ScenarioState } from "../../rules/engine/reduce.ts";

import { headingStepOf, type HeadingStep } from "../dream-chaser/heading.ts";
import { guardianLocked, guardianSeat } from "../../rules/families/guardian/seats.ts";
import { captiveDialWords } from "../words/scenarios/ungol.ts";
import { guardianHeldWords } from "../words/scenarios/guardian.ts";
import { gollumHeld } from "./marshes.ts";

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

// The seat whose dial says it holds something facedown, what the dial says and which mark it wears: the Ring-bearer under the Watcher (a Ring
// mark, mec109.stage-4), or the hero that is the prisoner of Escape from Dol Guldur (a hero mark, 01123:B:1), or a hero an enemy holds in Carried Away (18074:A:1, the same mark). A hero is never two of these.
export type HeldDial = { seat: number; words: string; mark: "oneRing" | "hero" | "ally" };

export function heldDial(game: ScenarioState, nameOf: (code: string) => string): HeldDial | null {
  return heldDialList(game, nameOf)[0] ?? null;
}

// Every seat's own mark, one per owner seat: the Ring-bearer or a prisoner when there is one, then each seat that has a hero held facedown (Carried Away, 18074:A:1: with two players both captives show a mark). A seat that holds two says both.
function heldDialList(game: ScenarioState, nameOf: (code: string) => string): readonly HeldDial[] {
  const ring = locationReadout(game);
  const ringLine = ringWords(ring, nameOf);
  if (ring?.heldBy != null && ringLine) return [{ seat: ring.heldBy, words: ringLine, mark: "oneRing" }];
  const prisoner = Object.values(game.cards).find((card) => card.zone === "captive" && card.prisoner === true && card.host == null && card.owner != null);
  if (prisoner && prisoner.owner != null) return [{ seat: prisoner.owner, words: prisonerWords(nameOf(prisoner.code)), mark: "hero" }];
  const marks = new Map<number, HeldDial>();
  for (const held of Object.values(game.cards)) {
    if (held.zone !== "captive" || held.guardedHero !== true || held.captive === true || held.owner == null) continue;
    const holder = held.host ? game.cards[held.host] : undefined;
    // The Ring-bearer lying faceup under Topmost Chamber, a guarded objective (146066:A:1): the first player takes it back, and its dial wears the Ring mark.
    const words = held.face === "up" && holder ? captiveDialWords(nameOf(held.code), nameOf(holder.code)) : `${nameOf(held.code)} is held facedown${holder ? ` by ${nameOf(holder.code)}` : ""}`;
    const before = marks.get(held.owner);
    marks.set(held.owner, { seat: held.owner, words: before ? `${before.words}. ${words}` : words, mark: "hero" });
  }
  return [...marks.values()];
}

/**
 * Every seat's held dial: the one `heldDial` finds, and a seat with a Captive of The Uruk-hai (mec112.pursuit, families/captives): "Legolas is a Captive under To Isengard!" or "Legolas is a Captive held by Grishnákh".
 * A seat that holds two things says both. `isEnemy` tells an enemy holder from the card the Captives lie under. The seat that holds the card Gollum / Sméagol of The Passage of the Marshes says so too (readouts/marshes.ts), and the seat guarding Gollum in Return to Mirkwood (`guardianHeld`, below).
 */
export function heldDials(game: ScenarioState, nameOf: (code: string) => string, isEnemy: (code: string) => boolean): readonly HeldDial[] {
  const dials = new Map<number, HeldDial>();
  for (const mark of heldDialList(game, nameOf)) dials.set(mark.seat, mark);
  for (const card of captivesOf(game)) {
    if (card.owner == null) continue;
    const host = card.host ? game.cards[card.host] : undefined;
    const words = stagedDial(game, card, nameOf) ?? `${nameOf(card.code)} is a Captive${host ? ` ${isEnemy(host.code) ? "held by" : "under"} ${nameOf(host.code)}` : ""}`;
    const before = dials.get(card.owner);
    // An ally an enemy holds wears the ally mark and says its words on the dial; a hero wears the hero mark. A seat that holds several wears the mark of the one held last, whose words come last.
    dials.set(card.owner, { seat: card.owner, words: before ? `${before.words}. ${words}` : words, mark: isHeldCharacter(card) ? "ally" : "hero" });
  }
  for (const gollum of [...gollumHeld(game), ...guardianHeld(game)]) {
    const before = dials.get(gollum.seat);
    dials.set(gollum.seat, { seat: gollum.seat, words: before ? `${before.words}. ${gollum.words}` : gollum.words, mark: before?.mark ?? gollum.mark });
  }
  return [...dials.values()];
}

/**
 * The held mark of the seat guarding Gollum in Return to Mirkwood (docs/design-system-table.md, Top bar, Held marks; 02126:A:1, `sotm.guarding-gollum`): the seat that controls the Gollum objective ally wears the hero mark, and its dial says it guards him and, while a card says the guard
 * cannot change, that it cannot. The engine decided both (`guardianSeat`, `guardianLocked`); none while nobody guards him (any other scenario, or before Setup places him).
 */
export function guardianHeld(game: ScenarioState): readonly HeldDial[] {
  const seat = guardianSeat(game);
  if (seat == null) return [];
  return [{ seat, words: guardianHeldWords(game.seatCount > 1 ? `Player ${seat + 1}` : "you", guardianLocked(game)), mark: "hero" }];
}

/** What a prisoner's name says wherever it is shown: the dial, the preview, the list. */
export function prisonerWords(name: string): string {
  return `${name} is the prisoner, face down`;
}

// The pursuit tracker of The Uruk-hai (mec112.pursuit): its value and the value at which the players lose, or null for a scenario without one or before its Setup sets it. The engine wrote the value; nothing here changes it.
export type PursuitReadout = { value: number; limit: number };

export function pursuitReadout(game: ScenarioState): PursuitReadout | null {
  const limit = game.widgets.pursuitTracker;
  return limit != null && game.pursuit != null ? { value: game.pursuit, limit } : null;
}

/** The pursuit dial's numbers for the top bar: the same object while its value and its limit are the same, so the bar re-renders only when the pursuit value moves. */
export function usePursuitReadout(game: ScenarioState): PursuitReadout | null {
  const now = pursuitReadout(game);
  const value = now?.value ?? null;
  const limit = now?.limit ?? null;
  return useMemo(() => (value == null || limit == null ? null : { value, limit }), [value, limit]);
}

// `cardId` is the card that holds the tokens: a press on the dial opens its preview.
export type TokenReadout = { name: string; tokens: number; cardId: string };

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
  return card ? { name: nameOf(card.code), tokens: card.resources, cardId: card.id } : null;
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
