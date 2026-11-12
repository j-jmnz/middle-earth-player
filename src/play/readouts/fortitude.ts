// Rules: mec113.fortitude-tests, mec113.player-actions-during-fortitude-tests (data/rules/entries.json); ledger lines 146043:A:3, 146047:A:1, 146049:A:3, 146050:A:2, 146055:A:2, 146057:A:1.
//
// The Fortitude test's numbers beside its sheets: while the heroes are chosen, the Willpower of the ones picked (and the icons a card already added to the test), then, in the action window after the cards are discarded, the Willpower against the icons counted, with the
// cards discarded and the icons ignored. The engine decided each number (`fortitudeCards`, `fortitudeEyes`, `fortitudeWillpower`); nothing here changes one. Pure, so a test reads it.
import type { ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import { fortitudeCards, fortitudeEyes, fortitudeWillpower, eyesOf, nearestFortitude, type FortitudeFrame } from "../../rules/families/mount-doom/fortitude.ts";
import { topFrame } from "../../rules/windows/windows.ts";

import { fortitudeCommitWords, fortitudeCountWords, fortitudeFailCaution, fortitudeFailWords, fortitudeNotBeating, fortitudePassWords, fortitudeResult, fortitudeStandingWords, withEyes } from "../words/scenarios/mount-doom.ts";
import { seatSays } from "../words/seat.ts";
import type { CommitCheck, SheetStat } from "../choice/sheet-types.ts";
import { cardsOf } from "./dials.ts";

const HEAVY_AND_TIRED = "146057";
const RINGWRAITH = "146050";

// The drawn eye stands for Sauron's Eye.
const WILL = (value: number): SheetStat => ({ icon: "willpower", value, word: "Willpower" });
const EYES = (value: number): SheetStat => ({ icon: "nightmare", value, word: "Sauron's Eye icons" });

/** The Sauron's Eye icons a card adds to the test, as the mark on its row (Gollum's pick of the card whose icons are ignored). */
export const eyesStat = (game: ScenarioState, ctx: ReduceContext, id: string): SheetStat => EYES(eyesOf(game, id, ctx));

/** The Fortitude frame nearest the top, or undefined with no test going on. */
export function fortitudeFrame(game: ScenarioState): FortitudeFrame | undefined {
  return nearestFortitude(game)?.frame;
}

// What the test holds before its cards are discarded: the cards it discards next (X plus what the card adds) and the icons already added to it.
function beforeCount(game: ScenarioState, frame: FortitudeFrame, ctx: ReduceContext): { cards: number; added: number } {
  return { cards: fortitudeCards(game, frame.seat) + frame.data.extraCards, added: fortitudeEyes(game, { ...frame.data, discardedIds: [], ignored: [] }, frame.seat, ctx) };
}

// What a failed test costs: the card's own clause, then each effect in play that hears the failure (Ringwraith of Sauron in the staging area, Heavy and Tired on a hero of the player who tests).
function failClauses(game: ScenarioState, frame: FortitudeFrame): readonly string[] {
  const code = frame.cardId ? game.cards[frame.cardId]?.code : undefined;
  const own = code ? fortitudeFailWords(code) : null;
  const ringwraith = cardsOf(game, RINGWRAITH).some((card) => card.zone === "staging");
  const tired = cardsOf(game, HEAVY_AND_TIRED).some((card) => card.host != null && game.cards[card.host]?.controller === frame.seat);
  return [...(own ? [own] : []), ...fortitudeStandingWords(ringwraith, tired)];
}

/** The commit sheet's note: the cards discarded next, the icons already added and what passing and failing do, led by the player who tests when two play. */
export function fortitudeCommitNote(game: ScenarioState, ctx: ReduceContext): string {
  const frame = fortitudeFrame(game);
  if (!frame) return "Exhaust heroes to commit them to the Fortitude test.";
  const code = frame.cardId ? game.cards[frame.cardId]?.code : undefined;
  const { cards, added } = beforeCount(game, frame, ctx);
  const words = fortitudeCommitWords(cards, added, code ? fortitudePassWords(code) : null, failClauses(game, frame));
  return seatSays(game, frame.seat).say(game.seatCount > 1 ? `${words.charAt(0).toLowerCase()}${words.slice(1)}` : words);
}

/** The action window's note: the Willpower against the icons counted, what failing costs when it fails, the cards discarded and the icons ignored. `nameOf` names a card by id. Null outside the test. */
export function fortitudeCountNote(game: ScenarioState, ctx: ReduceContext, nameOf: (id: string) => string): string | null {
  const frame = fortitudeFrame(game);
  if (!frame) return null;
  const willpower = fortitudeWillpower(game, frame.data.committedIds, ctx);
  const withIcons = (ids: readonly string[]) => ids.map((id) => withEyes(nameOf(id), eyesOf(game, id, ctx)));
  const words = fortitudeCountWords(willpower, frame.data.eyes, failClauses(game, frame), withIcons(frame.data.discardedIds.filter((id) => !frame.data.ignored.includes(id))), withIcons(frame.data.ignored));
  return seatSays(game, frame.seat).titled("Fortitude test", words);
}

/** The armed Pass of the action window while the count fails: the test fails and what that costs. Null when it passes, and outside the test. */
export function fortitudePassCaution(game: ScenarioState, ctx: ReduceContext): string | null {
  const frame = fortitudeFrame(game);
  if (!frame || fortitudePassedNow(game, frame, ctx)) return null;
  return fortitudeFailCaution(null, failClauses(game, frame));
}

function fortitudePassedNow(game: ScenarioState, frame: FortitudeFrame, ctx: ReduceContext): boolean {
  return fortitudeWillpower(game, frame.data.committedIds, ctx) > frame.data.eyes;
}

/** The commit sheet's check of a commit that fails for certain (`CommitCheck`): the icons already added, each hero's Willpower and what failing costs. Null outside the test. */
export function fortitudeCommitCheck(game: ScenarioState, ctx: ReduceContext, heroes: readonly string[]): CommitCheck | null {
  const frame = fortitudeFrame(game);
  if (!frame) return null;
  return { added: beforeCount(game, frame, ctx).added, willpower: Object.fromEntries(heroes.map((id) => [id, fortitudeWillpower(game, [id], ctx)])), fails: failClauses(game, frame) };
}

/** The armed line of the commit when the heroes picked cannot pass: no one, or a Willpower that does not beat the icons already added (more may still be counted). Null while the test may still pass. */
export function fortitudeCommitCaution(check: CommitCheck, ids: readonly string[]): string | null {
  const total = ids.reduce((sum, id) => sum + (check.willpower[id] ?? 0), 0);
  if (total > check.added) return null;
  const lead = ids.length === 0 ? "nobody is committed" : fortitudeNotBeating(total, check.added);
  return fortitudeFailCaution(lead, check.fails);
}

/** The numbers beside the commit sheet (the Willpower of the heroes picked now against the icons already added) or the action window (the Willpower of the committed heroes against the icons counted); null when no test is going on. */
export function fortitudeNumbers(game: ScenarioState, ctx: ReduceContext, picking: readonly string[] | null): { stats: readonly SheetStat[]; result: string | null } | null {
  const frame = fortitudeFrame(game);
  if (!frame) return null;
  const top = topFrame(game);
  if (picking && game.window?.kind === "fortitudeCommit") {
    const { cards, added } = beforeCount(game, frame, ctx);
    return { stats: [WILL(fortitudeWillpower(game, picking, ctx)), EYES(added)], result: `${cards} ${cards === 1 ? "card" : "cards"} discarded next, then the icons are counted` };
  }
  if (game.window?.kind === "frameAction" && top?.data.kind === "fortitude") {
    const willpower = fortitudeWillpower(game, top.data.committedIds, ctx);
    return { stats: [WILL(willpower), EYES(top.data.eyes)], result: fortitudeResult(willpower, top.data.eyes) };
  }
  return null;
}
