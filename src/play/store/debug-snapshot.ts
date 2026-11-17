// The game as a debug snapshot (docs/design-system-table.md, Table menu): what the Copy game state row puts on the clipboard while Debug tools is on.
// Pure: it reads a state the reducer returned and writes plain JSON values, so a bug report holds the whole table (each seat's cards, the decks in
// order, the quest, the staging area, the phase and the open window), the engine's lists, and the seed and intents that replay the same game.
// It shows what the table hides (deck order, facedown cards): the setting is the player's own choice to see it. `state.undo` is left out: it holds
// whole earlier states.
import { CATALOG_VERSION } from "../../catalog/version.ts";
import { ENGINE_VERSION } from "../../rules/engine/version.ts";

import type { EngineStep, PlayerIntent, ScenarioState } from "./store.ts";

type Card = ScenarioState["cards"][string];

/** A card as the snapshot writes it: its instance id, code and name, then every field of the instance that is not at its resting value. */
export type DebugCard = { id: string; code: string; name: string; attachments?: readonly DebugCard[]; shadow?: readonly DebugCard[] } & Record<string, unknown>;

/** What the snapshot needs beside the game: the build it was made by (the app version, the platform; the engine and card data versions are added here), a card's name by its code, the intents sent so far and the round's steps. */
export type DebugInput = {
  build: Readonly<Record<string, string | number>>;
  nameOf: (code: string) => string;
  intents: readonly PlayerIntent[] | null;
  roundSteps: readonly EngineStep[];
};

// The fields written elsewhere (the id, the code, the section the card is listed under, the cards nested in it) or that say nothing a reader needs.
const SKIPPED = new Set(["id", "code", "zone", "attachments", "shadowId", "extraShadowIds", "enteredPlay", "controller"]);
// The counters whose resting value is zero. A seat number of zero (an owner) is kept.
const COUNTERS = new Set(["damage", "progress", "resources"]);

function resting(key: string, value: unknown): boolean {
  if (value == null || value === false) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (key === "face") return value === "up";
  return COUNTERS.has(key) && value === 0;
}

/**
 * The snapshot of `game`. Every card instance is written once: under the zone list that holds it, nested under its host when it is attached or dealt
 * as a shadow card, or in `other` by zone when no list holds it (a card under a location, a captive, the campaign card).
 */
export function debugSnapshot(game: ScenarioState, input: DebugInput): Record<string, unknown> {
  const seen = new Set<string>();
  const card = (id: string): DebugCard => {
    const instance: Card | undefined = game.cards[id];
    if (!instance) return { id, code: "?", name: "No such card" };
    seen.add(id);
    const out: DebugCard = { id, code: instance.code, name: input.nameOf(instance.code) };
    for (const [key, value] of Object.entries(instance)) if (!SKIPPED.has(key) && !resting(key, value)) out[key] = value;
    if (instance.attachments.length > 0) out.attachments = instance.attachments.map(card);
    const shadows = [...(instance.shadowId ? [instance.shadowId] : []), ...(instance.extraShadowIds ?? [])];
    if (shadows.length > 0) out.shadow = shadows.map(card);
    return out;
  };
  const cards = (ids: readonly string[] | undefined): DebugCard[] => (ids ?? []).map(card);
  const one = (id: string | null | undefined): DebugCard | null => (id ? card(id) : null);
  // A list the game may not have: written only when it does.
  const maybe = (name: string, ids: readonly string[] | undefined): Record<string, DebugCard[]> => (ids ? { [name]: cards(ids) } : {});

  const seats = game.seats.slice(0, game.seatCount).map((seat, index) => ({
    seat: index,
    threat: seat.threat,
    eliminated: seat.eliminated,
    heroes: cards(seat.heroes),
    play: cards(seat.play),
    engaged: cards(seat.engaged),
    hand: cards(seat.hand),
    deck: cards(seat.deck),
    discard: cards(seat.discard),
    ...(seat.questStage ? { sideQuest: card(seat.questStage) } : {}),
    // The seat's own stage, active location and staging area while stages are separate (families/breaking/areas.ts).
    ...(seat.stage ? { stage: card(seat.stage) } : {}),
    ...(seat.active ? { activeLocation: card(seat.active) } : {}),
    ...(game.separate ? { staging: seat.staging.map((id) => id) } : {}),
    ...maybe("captured", seat.captured),
    ...maybe("deckAttached", seat.deckAttached),
    ...(seat.joined == null ? {} : { joined: seat.joined }),
  }));
  const quest = { stage: one(game.questStage), deck: cards(game.questDeck), activeLocation: one(game.activeLocation), secondActiveLocation: one(game.secondActiveLocation) };
  const staging = cards(game.staging);
  const piles: Record<string, DebugCard[]> = {};
  for (const [zone, ids] of Object.entries(game.piles ?? {})) piles[zone] = cards(ids);
  const encounter = {
    deck: cards(game.encounterDeck),
    discard: cards(game.encounterDiscard),
    victory: cards(game.victory),
    setAside: cards(game.setAside),
    removed: cards(game.removed),
    ...maybe("burdenDeck", game.burdenDeck),
    ...maybe("corsairDeck", game.corsairDeck),
    ...maybe("corsairDiscard", game.corsairDiscard),
    ...maybe("unchartedDeck", game.uncharted?.deck),
    ...piles,
  };
  // Whatever no list above holds, by zone, in id order.
  const other: Record<string, DebugCard[]> = {};
  for (const id of Object.keys(game.cards)) {
    const instance = game.cards[id];
    if (!instance || seen.has(id)) continue;
    const entry = card(id);
    other[instance.zone] = [...(other[instance.zone] ?? []), entry];
  }
  return {
    build: { ...input.build, engine: ENGINE_VERSION, catalog: CATALOG_VERSION },
    scenario: {
      id: game.scenarioId,
      seatCount: game.seatCount,
      round: game.round,
      phase: game.phase,
      mode: game.mode,
      firstPlayer: game.firstPlayer,
      activeSeat: game.activeSeat,
      window: game.window,
      passed: game.passed,
      lost: game.lost,
      lossReason: game.lossReason,
      failure: game.failure,
      ...(game.life == null ? {} : { life: game.life }),
    },
    seats,
    quest,
    staging,
    encounter,
    other,
    engine: {
      modifiers: game.modifiers,
      stack: game.stack,
      delayed: game.delayed,
      uses: game.uses,
      hideFailures: game.hideFailures,
      ...(game.sea ? { sea: game.sea } : {}),
      ...(game.uncharted ? { uncharted: game.uncharted } : {}),
    },
    replay: { seed: game.seed, seedCursor: game.seedCursor, intents: input.intents },
    log: input.roundSteps,
  };
}

/** The snapshot as the text that is copied: JSON, indented so a person can read it. */
export function debugText(game: ScenarioState, input: DebugInput): string {
  return JSON.stringify(debugSnapshot(game, input), null, 2);
}
