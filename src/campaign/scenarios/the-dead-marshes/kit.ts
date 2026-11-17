// Test helper. The table and the steps the line tests of The Dead Marshes share (lines.test.ts, nightmare.test.ts): a scene-kit table of the scenario, a hero of chosen numbers, the escape test played to its end and a treachery revealed and played.
import type { EngineStep } from "../../../rules/core/intents.ts";
import { first, idOf, legalTargets, revealFromTop, send, start, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";
import { definePrinted, type PrintedCard } from "../../../rules/core/printed.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";

export const table = (layout: Layout) => tableFromLayout("the-dead-marshes", layout);
export type Made = ReturnType<typeof table>;
export const zoneOf = (state: ScenarioState, code: string): string | undefined => state.cards[first(state, code)]?.zone;
export const tokens = (state: ScenarioState, code: string): number => state.cards[first(state, code)]?.resources ?? 0;
export const threat = (state: ScenarioState, seat = 0): number => state.seats[seat]?.threat ?? 0;

// A hero card of the given numbers, added to the table's cards and put in play for the seat.
export function withHero(made: Made, code: string, stats: Partial<Parameters<typeof definePrinted>[0]> = {}, seat = 0): ScenarioState {
  (made.ctx.cards as Map<string, PrintedCard>).set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 8, willpower: 2, attack: 2, defense: 2, health: 6, ...stats }));
  return spawn(made.state, code, { zone: "heroes", seat }).state;
}

// Plays the escape test the state asks for: each seat commits the characters (codes) listed for it, every action window is passed, until no escape window is open.
export function playTest(made: Made, state: ScenarioState, commits: readonly (readonly string[])[] = [], guard = 40): Run {
  let run = start(state);
  for (let step = 0; step < guard; step += 1) {
    const window = run.state.window;
    if (window?.kind === "escapeCommit") {
      const legal = legalTargets(run.state, { type: "CommitEscape" }, made.ctx);
      const cardIds = (commits[window.seat] ?? []).map((code) => idOf(run.state, code)).filter((id) => legal.includes(id));
      run = send(run, { type: "CommitEscape", cardIds }, made.ctx);
    } else if (window?.kind === "frameAction") run = send(run, { type: "Pass" }, made.ctx);
    else break;
  }
  return run;
}

// A treachery is revealed from the top of the encounter deck and its When Revealed effects run, the test (if any) played with `commits`.
export function revealAndPlay(made: Made, code: string, commits: readonly (readonly string[])[] = [], state: ScenarioState = made.state): Run {
  const revealed = revealFromTop(state, made.ctx, code, [] as EngineStep[]).state;
  return playTest(made, revealed, commits);
}

