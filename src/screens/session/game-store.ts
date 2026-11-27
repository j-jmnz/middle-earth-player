// The table store of an opened game, campaign or standalone: the part of sessionStore (table-open.ts) and standaloneStore (standalone-open.ts) that is the same.
// Each intent the reducer accepts is appended to the held game and written at once, and an Undo takes the last one off (a move that ended the game too: its run is taken back), so a kill and relaunch replays the
// same game. The play clock (play-clock.ts) folds the foreground time into each write and writes once more on a pause. The checkpoint is written at a phase
// boundary and on a pause, never per intent (campaign/checkpoint.ts).
import { atPhaseBoundary, checkpointOf, type Checkpoint } from "../../campaign/checkpoint";
import { addActive, type ActiveScenario } from "../../campaign/replay";
import { isWon, record, unrecord } from "../../campaign/session";
import { CATALOG_VERSION } from "../../catalog/version";
import type { ScenarioState, TableStore } from "../../play/store/store";

import { fingerprintOf, type SessionCache } from "./cache";
import { committingStore, type ReplayedGame } from "./open-game";
import { createPlayClock, type PlayClock } from "./play-clock";

/** What the store holds and writes: a save or a standalone game, by its id and its open scenario. */
export type Held = { id: string; active: ActiveScenario | null };

export type GameStoreParts<H extends Held, O> = {
  session: ReplayedGame;
  initial: H;
  cache: SessionCache<O>;
  /** The session as the cache keeps it once the table's game has moved on to `saved`. */
  reopened: (saved: H, now: Pick<ReplayedGame, "game" | "roundSteps" | "history" | "destroyedHeroes">) => O;
  /** One statement each: an accepted intent, an Undo (the checkpoint behind the game goes with it) and a checkpoint. */
  writers: { active: (saved: H) => void; undone: (saved: H) => void; checkpoint: (id: string, checkpoint: Checkpoint) => void };
  /** A lost game: the caller writes its run now (a win waits for its Resolution choices). */
  onLost?: (saved: H, game: ScenarioState) => void;
  /** An Undo that left a lost game: the caller takes back what `onLost` wrote, so a move the player took back leaves no run. */
  onLostUndone?: (saved: H, left: ScenarioState) => void;
};

export type GameStore<H> = { store: TableStore; saved: () => H; clock: PlayClock };

export function gameStore<H extends Held, O>({ session, initial, cache, reopened, writers, onLost, onLostUndone }: GameStoreParts<H, O>): GameStore<H> {
  let saved: H = initial;
  const base = createPlayClock();
  // How many intents the checkpoint this session last wrote counted, or null when it has written none (the row may still hold an earlier one).
  let checkpointed: number | null = null;
  // Writes the table as the checkpoint of the intents saved so far, unless that is the checkpoint already written. A separate statement from the intent's.
  const checkpoint = (game: ScenarioState) => {
    if (!saved.active || checkpointed === saved.active.intents.length) return;
    writers.checkpoint(saved.id, checkpointOf(game, saved.active));
    checkpointed = saved.active.intents.length;
  };
  // The foreground time since the last write, added to the open scenario. Nothing taken leaves the game as it is (the same object), so a pause with no new time writes nothing.
  const fold = (held: H): H => {
    if (!held.active) return held;
    const active = addActive(held.active, base.take());
    return active === held.active ? held : { ...held, active };
  };
  // Asked for the game later (the Resolution, the outcome screen), the cache reads this table's game as it stands now; the row it must match is `saved`.
  const follow = () => {
    const { game, roundSteps, history, destroyedHeroes } = store.getState();
    cache.follow(saved.id, () => ({ fingerprint: fingerprintOf(saved, CATALOG_VERSION), session: reopened(saved, { game, roundSteps, history, destroyedHeroes }) }));
  };
  const store = committingStore(
    session,
    (intent, game) => {
      saved = fold(record(saved, intent, game));
      writers.active(saved);
      if (atPhaseBoundary(game) && !game.lost && !isWon(game)) checkpoint(game);
      if (game.lost) onLost?.(saved, game);
      follow();
    },
    (_game, left) => {
      saved = fold(unrecord(saved));
      writers.undone(saved);
      if (left.lost) onLostUndone?.(saved, left);
      // A checkpoint that counted more intents than the game has now is behind it: the write dropped it, so a different move cannot meet it again.
      if (saved.active && checkpointed != null && checkpointed > saved.active.intents.length) checkpointed = null;
      follow();
    },
  );
  // A pause (the table left, the app in the background) writes the time since the last write, once, and the checkpoint when the game moved since it; a game that is over, won or lost, writes nothing
  // (its last intent folded the time already, and a pause must never write a finished scenario back).
  const clock: PlayClock = {
    resume: base.resume,
    take: base.take,
    pause: () => {
      base.pause();
      const { game } = store.getState();
      if (game.lost || isWon(game)) return;
      const folded = fold(saved);
      if (folded !== saved) {
        saved = folded;
        writers.active(saved);
        follow();
      }
      checkpoint(game);
    },
  };
  follow();
  return { store, saved: () => saved, clock };
}
