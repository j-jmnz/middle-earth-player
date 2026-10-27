// Which motion a new layout plays when the seat the canvas draws changed (phase 26): the peek's own slide, the seat handoff, or the
// ordinary motions of the state. Pure, so a Vitest reads it; card-motion.native.tsx calls it once per new layout.
//   peek: the same state seen from another seat (the player tapped a dial), or a peek that ends. The table is redrawn at rest: no card
//     moves, nothing is dealt, no token pops and nothing lands.
//   handoff: the engine turned to another seat, and the table follows it (the new hand slides up, nothing is dealt).
//   ordinary: the state's own motions (a draw, a played card's squash, a token pop, ghosts), diffed from the layout the acting seat had
//     before. A peek that ends with a new state is this: the player confirmed something on the dock while looking at the other seat,
//     and the state's motions must play as they would have. The same holds when the seat shown did not change, even if the engine
//     turned to the seat the table was already showing (that hand is on screen already and must not slide up again).
export type MotionKind = "peek" | "handoff" | "ordinary";

/**
 * `prev` and `next` are the states before and after the update that moved the layout (the same object when only the seat peeked at
 * changed); the seats are the seat drawn and the seat acting before and after. A new state whose shown seat is not the acting seat can
 * only be a peek batched with it, so it is a peek too.
 */
export function motionKind(prev: unknown, next: unknown, prevShown: number, nextShown: number, prevActing: number, nextActing: number): MotionKind {
  if (prevShown === nextShown) return "ordinary";
  if (prev === next || nextShown !== nextActing) return "peek";
  return prevActing !== nextActing ? "handoff" : "ordinary";
}

/** Whether a layout of this kind moves its cards: a peek and its way back are drawn at rest (user request, 2026-10-27). */
export function kindMoves(kind: MotionKind): boolean {
  return kind !== "peek";
}
