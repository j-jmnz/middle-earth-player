// Rules: brief, Persistence and shipping (docs/brief.md). The table of an open game as a checkpoint: the state without its Undo log, written at each phase boundary and
// when the play clock pauses (never per intent), so a game the rules changed under can go on from where it was (session.ts, continueFrom). Pure.
import { z } from "zod";

import type { ScenarioState } from "../rules/engine/reduce.ts";
import { restoredState, STATE_VERSION, storedState, type StoredState } from "../rules/engine/state-version.ts";

import type { ActiveScenario, Rebase } from "./replay.ts";

export { restoredState, STATE_VERSION, storedState };

// `intentCount` is how many of the open game's intents had been played when the state was stored, and `seed` and `startedAt` (when it was dealt) are the game's, so a
// checkpoint is never read against another deal, even one with the same seed.
export type Checkpoint = { stateVersion: number; intentCount: number; seed: number; startedAt?: number; state: StoredState };

const stateSchema = z.custom<StoredState>((value) => typeof value === "object" && value !== null && !Array.isArray(value));

const checkpointSchema = z.object({ stateVersion: z.number().int(), intentCount: z.number().int().min(0), seed: z.number().int(), startedAt: z.number().optional(), state: stateSchema });
const rebaseSchema = z.object({ stateVersion: z.number().int(), state: stateSchema });

/** The checkpoint of a table, after `active.intents.length` intents. */
export function checkpointOf(state: ScenarioState, active: Pick<ActiveScenario, "intents" | "seed" | "startedAt">): Checkpoint {
  return { stateVersion: STATE_VERSION, intentCount: active.intents.length, seed: active.seed, ...(active.startedAt == null ? {} : { startedAt: active.startedAt }), state: storedState(state) };
}

/** A stored checkpoint, or null when there is none or it does not read. */
export function parseCheckpoint(value: unknown): Checkpoint | null {
  const parsed = checkpointSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** A stored rebase, or null when there is none or it does not read. */
export function parseRebase(value: unknown): Rebase | null {
  const parsed = rebaseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Whether the table just left a phase boundary: its Undo log starts afresh there (undo.ts, noteHistory), and no other accepted intent leaves it empty. */
export function atPhaseBoundary(state: ScenarioState): boolean {
  return state.undo.intents.length === 0;
}

/** The checkpoint when it belongs to this deal (the same seed and the same time dealt, where the game has one) and was taken within the intents the game has now; otherwise null (it is ignored, never played). */
export function usableCheckpoint(checkpoint: Checkpoint | null, active: Pick<ActiveScenario, "intents" | "seed" | "startedAt">): Checkpoint | null {
  return checkpoint && checkpoint.seed === active.seed && checkpoint.startedAt === active.startedAt && checkpoint.intentCount <= active.intents.length ? checkpoint : null;
}
