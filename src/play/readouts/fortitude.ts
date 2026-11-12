// Rules: mec113.fortitude-tests, mec113.player-actions-during-fortitude-tests (data/rules/entries.json); ledger lines 146043:A:3, 146047:A:1, 146049:A:3, 146055:A:2.
//
// The Fortitude test's numbers beside its sheets: while the heroes are chosen, the Willpower of the ones picked (and the icons a card already added to the test), then, in the action window after the cards are discarded, the Willpower against the icons counted, with the
// cards discarded and the icons ignored. The engine decided each number (`fortitudeCards`, `fortitudeEyes`, `fortitudeWillpower`); nothing here changes one. Pure, so a test reads it.
import type { ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import { fortitudeCards, fortitudeEyes, fortitudeWillpower, eyesOf, nearestFortitude, type FortitudeFrame } from "../../rules/families/mount-doom/fortitude.ts";
import { topFrame } from "../../rules/windows/windows.ts";

import { fortitudeCommitWords, fortitudeCountWords, fortitudeFailWords, fortitudeResult } from "../words/scenarios/mount-doom.ts";
import { seatSays } from "../words/seat.ts";
import type { SheetStat } from "../choice/sheet-types.ts";

// The drawn eye stands for Sauron's Eye.
const WILL = (value: number): SheetStat => ({ icon: "willpower", value, word: "Willpower" });
const EYES = (value: number): SheetStat => ({ icon: "nightmare", value, word: "Sauron's Eye icons" });

/** The Fortitude frame nearest the top, or undefined with no test going on. */
export function fortitudeFrame(game: ScenarioState): FortitudeFrame | undefined {
  return nearestFortitude(game)?.frame;
}

/** The commit sheet's note: the cards discarded next, the icons already added and what failing does, led by the player who tests when two play. */
export function fortitudeCommitNote(game: ScenarioState, ctx: ReduceContext): string {
  const frame = fortitudeFrame(game);
  if (!frame) return "Exhaust heroes to commit them to the Fortitude test.";
  const code = frame.cardId ? game.cards[frame.cardId]?.code : undefined;
  const cards = fortitudeCards(game, frame.seat) + frame.data.extraCards;
  const added = fortitudeEyes(game, { ...frame.data, discardedIds: [], ignored: [] }, frame.seat, ctx);
  const words = fortitudeCommitWords(cards, added, code ? fortitudeFailWords(code) : null);
  return seatSays(game, frame.seat).say(game.seatCount > 1 ? `${words.charAt(0).toLowerCase()}${words.slice(1)}` : words);
}

/** The action window's note: the Willpower against the icons counted, the cards discarded and the icons ignored. `nameOf` names a card by id. Null outside the test. */
export function fortitudeCountNote(game: ScenarioState, ctx: ReduceContext, nameOf: (id: string) => string): string | null {
  const frame = fortitudeFrame(game);
  if (!frame) return null;
  const willpower = fortitudeWillpower(game, frame.data.committedIds, ctx);
  const withIcons = (ids: readonly string[]) => ids.map((id) => `${nameOf(id)} (${eyesOf(game, id, ctx)})`);
  return fortitudeCountWords(willpower, frame.data.eyes, withIcons(frame.data.discardedIds.filter((id) => !frame.data.ignored.includes(id))), frame.data.ignored.map((id) => `${nameOf(id)} (${eyesOf(game, id, ctx)})`));
}

/** The numbers beside the commit sheet (the Willpower of the heroes picked now against the icons already added) or the action window (the Willpower of the committed heroes against the icons counted); null when no test is going on. */
export function fortitudeNumbers(game: ScenarioState, ctx: ReduceContext, picking: readonly string[] | null): { stats: readonly SheetStat[]; result: string | null } | null {
  const frame = fortitudeFrame(game);
  if (!frame) return null;
  const top = topFrame(game);
  if (picking && game.window?.kind === "fortitudeCommit") {
    const added = fortitudeEyes(game, { ...frame.data, discardedIds: [], ignored: [] }, frame.seat, ctx);
    const cards = fortitudeCards(game, frame.seat) + frame.data.extraCards;
    return { stats: [WILL(fortitudeWillpower(game, picking, ctx)), EYES(added)], result: `${cards} ${cards === 1 ? "card" : "cards"} discarded next, then the icons are counted` };
  }
  if (game.window?.kind === "frameAction" && top?.data.kind === "fortitude") {
    const willpower = fortitudeWillpower(game, top.data.committedIds, ctx);
    return { stats: [WILL(willpower), EYES(top.data.eyes)], result: fortitudeResult(willpower, top.data.eyes) };
  }
  return null;
}
