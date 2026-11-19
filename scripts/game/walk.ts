// Replays a game source (scripts/game/source.ts) through the reducer, one intent at a time, and keeps what each did: the intent, the state before
// it (for naming its cards) and the engine steps it caused. It stops after `at` intents, at the first state `until` holds for, or at the first intent the
// reducer refuses, which it reports with the reducer's reason.
import { reduce, type EngineStep, type PlayerIntent, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import type { GameSource } from "./source.ts";

export type Move = { index: number; intent: PlayerIntent; before: ScenarioState; after: ScenarioState; steps: readonly EngineStep[] };

export type Walked = {
  state: ScenarioState;
  /** How many intents were applied. */
  at: number;
  moves: Move[];
  refused: { index: number; intent: PlayerIntent; reason: string } | null;
};

/** A condition on a state, from `--until`: `lost`, `won`, `round=3`, `phase=Combat`, `mode=questCommit`, `window=defense`, `seat=1`, `code=01001` (a card with that code is on the table). */
export type Until = (state: ScenarioState) => boolean;

const IN_PLAY = new Set(["heroes", "play", "engaged", "seatStaging", "staging", "activeLocation", "secondActiveLocation", "questStage", "attached"]);

export function parseUntil(text: string): Until {
  if (text === "lost") return (state) => state.lost;
  if (text === "won") return (state) => state.stageCleared && !state.lost;
  const match = /^(round|phase|mode|window|seat|code)=(.+)$/.exec(text);
  if (!match) throw new Error(`--until takes lost, won, round=N, phase=X, mode=X, window=X, seat=N or code=X, not ${text}`);
  const [, key, value] = match as unknown as [string, string, string];
  switch (key) {
    case "round":
      return (state) => state.round >= Number(value);
    case "phase":
      return (state) => state.phase === value;
    case "mode":
      return (state) => state.mode === value;
    case "window":
      return (state) => state.window?.kind === value;
    case "seat":
      return (state) => state.activeSeat === Number(value) - 1;
    default:
      return (state) => Object.values(state.cards).some((card) => card.code === value && IN_PLAY.has(card.zone));
  }
}

export function walk(source: GameSource, options: { at?: number; until?: Until } = {}): Walked {
  const last = Math.min(options.at ?? source.intents.length, source.intents.length);
  let state = source.opening;
  const moves: Move[] = [];
  if (options.until?.(state)) return { state, at: 0, moves, refused: null };
  for (let index = 0; index < last; index += 1) {
    const intent = source.intents[index] as PlayerIntent;
    // A throw is a refusal too: a smoke failure is often one, and the table before it is what the reader needs.
    let result: ReturnType<typeof reduce>;
    try {
      result = reduce(state, intent, source.ctx);
    } catch (error) {
      return { state, at: index, moves, refused: { index, intent, reason: `the reducer threw: ${error instanceof Error ? error.message : String(error)}` } };
    }
    if (!result.ok) return { state, at: index, moves, refused: { index, intent, reason: result.reason } };
    moves.push({ index, intent, before: state, after: result.state, steps: result.steps });
    state = result.state;
    if (options.until?.(state)) break;
  }
  return { state, at: moves.length, moves, refused: null };
}
