// The last update of the table store that moved the game or the seat peeked at, for the canvas's card motion (card-motion.native.tsx;
// phase 26). The canvas diffs layouts, but which motion a new layout plays depends on what moved it: a peek is the same state drawn
// from another seat, a new state is the pair (the state before it, the state after it). A layout can move without a new update (a
// resize, a pick), and an update can move the game without moving the shown layout (a change that only touched the other seat's
// counts), so each update is used by the first new layout after it and by no other: a later peek never pops a stale change.
import type { ScenarioState } from "../rules/state.ts";

export type StoreUpdate = { n: number; prev: ScenarioState; next: ScenarioState };

export class UpdateLog {
  private latest: StoreUpdate;
  private used: number;

  constructor(game: ScenarioState) {
    this.latest = { n: 0, prev: game, next: game };
    this.used = 0;
  }

  /** The store changed from `before` to `now`; nothing is kept for a change that moved neither the game nor the seat peeked at. */
  note(now: { game: ScenarioState; viewedSeat: number | null }, before: { game: ScenarioState; viewedSeat: number | null }): void {
    if (now.game === before.game && now.viewedSeat === before.viewedSeat) return;
    this.latest = { n: this.latest.n + 1, prev: before.game, next: now.game };
  }

  /** The update no layout has used yet, or null. */
  pending(): StoreUpdate | null {
    return this.latest.n > this.used ? this.latest : null;
  }

  /** A new layout was drawn: the pending update is used. */
  consume(): void {
    this.used = this.latest.n;
  }
}
