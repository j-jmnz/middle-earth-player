import { describe, expect, it } from "vitest";

import type { Effect } from "../../src/catalog/boundary.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import type { GameEvent } from "../../src/rules/core/state.ts";
import type { PlayerIntent } from "../../src/rules/engine/reduce.ts";

import { failures } from "./card-spec-check.ts";
import { play } from "./card-spec-play.ts";
import type { Act, CounterName, Expect, FlagName, Row, StatName } from "./card-spec-types.ts";

export type { Act, CounterName, Expect, Row } from "./card-spec-types.ts";

// Test helper. Card behaviour as spec rows: a row names a ledger line (the one an effect record names in `lines`), the table it needs by
// zone, one action that gives the behaviour a game moment, and what must be true afterwards. `cardSpecs` runs each row on the scenario's
// records, and again with the records of its line removed: a row that still passes then tests nothing and fails (an answer the removed records never asked for is skipped, so only the expectation can pass it). The table is
// `tableFromLayout` (scene-kit.ts), so a scenario needs no scene file; the actions are the scene kit's helpers (card-spec-play.ts) and the expectations read the state and the steps (card-spec-check.ts). The seat an
// expectation reads defaults to the first. scripts/checks/spec-coverage.test.ts holds every line a scenario's records name to a row or to a test titled with the line id. Rules: rr.forced, rr.response, rr.reveal,
// rr.shadow-effects, rr.travel, rr.cancel (data/rules/entries.json).

/** The records of the card resolve at this timing (a card in the layout is the source; otherwise the card is spawned in the staging area). */
export const resolve = (code: string, timing: Effect["timing"], source?: string): Act => ({ act: "resolve", code, timing, ...(source ? { source } : {}) });
/** Both of the first seat's heroes commit and the quest is played to its end; `outcome` is checked against the willpower and threat the quest compared. */
export const quest = (outcome: "success" | "fail"): Act => ({ act: "quest", outcome });
/** The enemy attacks the first seat in the combat phase with `shadow` dealt to it (a filler enemy by default), the first hero defending. Must be the first action. */
export const attack = (enemy: string, options: { shadow?: string; undefended?: boolean; lands?: Readonly<Record<string, string>> } = {}): Act => ({ act: "attack", enemy, ...options });
/** The card is put on top of the encounter deck and revealed, its When Revealed resolving. */
export const reveal = (code: string): Act => ({ act: "reveal", code });
/** The players travel to the location (in the staging area; the layout's phase is Travel). */
export const travel = (code: string): Act => ({ act: "travel", code });
/** Every window is passed until the next round begins, the end of this round included. */
export const endRound: Act = { act: "endRound" };
/** Every window is passed until the phase the row began in is over, and the next one has begun. */
export const endPhase: Act = { act: "endPhase" };
/** The option of the choice that is open. */
export const answer = (id: string): Act => ({ act: "answer", id });
/** The first hero declares `with` (any card of the layout) as the defender of the attack, in place of the first hero. Follows the `attack` action directly. */
export const defend = (withCode: string): Act => ({ act: "defend", with: withCode });
/** The card's Response is used now: the Trigger the open window offers for it (a quest that is followed by it stops where it is offered). */
export const respond = (code: string): Act => ({ act: "respond", code });
/** The first player cancels the effect the open cancel offer is about, paying its cost from a hero's pool (the layout's `heroResources`). */
export const cancel: Act = { act: "cancel" };
/** The player asked to commit to a Fortitude or an escape test commits these characters (none: an empty list), and the test is played to its end: the discards or the cards dealt, the count and the actions window passed (mec113.fortitude-tests, sotm.escape-test). */
export const commit = (...heroes: string[]): Act => ({ act: "commit", heroes });
/** The engine announces an event to the Forced effects (a trigger, the card it is about, and any other fields), the way a step of the game does. */
export const announce = (trigger: GameEvent["trigger"], code?: string, extra: Partial<GameEvent> = {}): Act => ({ act: "announce", trigger, ...(code ? { code } : {}), ...(Object.keys(extra).length > 0 ? { extra } : {}) });

export const stat = (code: string, name: StatName, value: number): Expect => ({ expect: "stat", code, name, value });
export const flag = (code: string, name: FlagName, value = true): Expect => ({ expect: "flag", code, name, value });
/** The card holds the flag through a class of cards (every damaged character, holder-classes.ts), which `flag` does not read: what `healDamage` checks. */
export const classFlag = (code: string, name: FlagName, value = true): Expect => ({ expect: "classFlag", code, name, value });
export const zone = (code: string, name: string): Expect => ({ expect: "zone", code, zone: name });
/** The card is (or is not) committed to the quest. */
export const committed = (code: string, value = true): Expect => ({ expect: "committed", code, value });
/** This many cards with the code lie in the zone (a layout that places a stage in the victory display also deals it with the quest deck). */
export const count = (code: string, name: string, value: number): Expect => ({ expect: "count", code, zone: name, value });
/** The card shows this side (a quest stage: A before its flip, B after). */
export const side = (code: string, name: "A" | "B"): Expect => ({ expect: "side", code, side: name });
export const progressOn = (code: string, value: number): Expect => ({ expect: "progressOn", code, value });
export const resourcesOn = (code: string, value: number): Expect => ({ expect: "resourcesOn", code, value });
/** The card holds this much damage. */
export const damageOn = (code: string, value: number): Expect => ({ expect: "damageOn", code, value });
/** The seat's hand holds this many cards (the first seat by default). */
export const handCount = (value: number, seat = 0): Expect => ({ expect: "handCount", value, seat });
/** The seat drew this many cards while the actions ran (the first seat by default). */
export const drew = (value: number, seat = 0): Expect => ({ expect: "drew", value, seat });
/** The card was (or was not) declared a defender of the attack: `declaredDefenders` while the attack was in progress. */
export const defender = (code: string, value = true): Expect => ({ expect: "defender", code, value });
/** The cards struck the card, in order: the enemies that attacked it, or the characters declared to attack it. */
export const attackersOf = (code: string, attackers: readonly string[]): Expect => ({ expect: "attackersOf", code, attackers });
/** The effect of the card was (or was not) canceled: a cancel step names it. */
export const refused = (code: string, value = true): Expect => ({ expect: "refused", code, value });
/** A scenario value, read through its named reader (pursuit, life). */
export const counter = (name: CounterName, value: number): Expect => ({ expect: "counter", name, value });
/** The card lies in the captive zone, held by the host card. */
export const heldBy = (code: string, host: string): Expect => ({ expect: "heldBy", code, host });
/** The encounter deck holds this many cards: one is gone for each shadow card or reveal drawn from it (an additional attack is dealt a new shadow card, faq.additional-attacks). */
export const deckCount = (value: number): Expect => ({ expect: "deckCount", value });
/** The card is (or is not) exhausted. */
export const exhausted = (code: string, value = true): Expect => ({ expect: "exhausted", code, value });
/** The total Threat in the staging area (the printed Threats, the modifiers and what the table adds). */
export const stagingThreat = (value: number): Expect => ({ expect: "stagingThreat", value });
/** The seat's threat (the first seat by default; every seat starts at 28). */
export const threat = (value: number, seat = 0): Expect => ({ expect: "threat", value, seat });
/** The card was revealed from the encounter deck by this seat (a reveal step names the seat that revealed it). */
export const revealedBy = (code: string, seat: number): Expect => ({ expect: "revealedBy", code, seat });
export const lost: Expect = { expect: "lost" };
export const won: Expect = { expect: "won" };
/** The last stage was not defeated: the game is not won. */
export const notWon: Expect = { expect: "notWon" };
/** A frame of this name was pushed while the action ran. */
export const frame = (name: string): Expect => ({ expect: "frame", name });
/** The window the actions left open is (or, with `value` false, is not) of this kind: the look window a look at the Investigation deck opens. */
export const window = (kind: string, value = true): Expect => ({ expect: "window", kind, value });
/** The intent is legal now (for a card, one of its own: a Response offered after the action). */
export const offers = (intent: PlayerIntent["type"], code?: string, value = true): Expect => ({ expect: "offers", intent, ...(code ? { code } : {}), ...(value ? {} : { value }) });
/**
 * What a row says is wrong when it runs on these records: the failed expectations, or the error an action threw. Empty when the row holds. `lenient` is the run without the row's records: an answer nobody asks
 * for is skipped there (the records that asked are gone), so only the expectation can pass the run.
 */
export function rowProblems(scenarioId: string, row: Row, effects: readonly Effect[], lenient = false): string[] {
  const wanted = Array.isArray(row.expect) ? (row.expect as readonly Expect[]) : [row.expect as Expect];
  try {
    return failures(play(scenarioId, row, effects, lenient), wanted);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

/** The records without those that implement `line`. A new list: the shared list is never changed. */
export function withoutLine(effects: readonly Effect[], line: string): readonly Effect[] {
  return effects.filter((effect) => !effect.lines.includes(line));
}

/** The records without those that implement any of `lines`. A new list: the shared list is never changed. */
export function withoutLines(effects: readonly Effect[], ...lines: readonly string[]): readonly Effect[] {
  return lines.reduce(withoutLine, effects);
}

/**
 * One test for each row, and for each row a second one that runs it with the records of its line removed and fails when the row still
 * holds. A line no record names is an error: the row would test nothing.
 */
export function cardSpecs(scenarioId: string, rows: readonly Row[], options: { effects?: readonly Effect[] } = {}): void {
  const effects = options.effects ?? EFFECTS;
  describe(`${scenarioId} card specs`, () => {
    rows.forEach((row, index) => {
      const title = `${row.line} ${row.name ?? `row ${index + 1}`}`;
      it(title, () => {
        if (!effects.some((effect) => effect.lines.includes(row.line))) throw new Error(`no record names line ${row.line}`);
        const problems = rowProblems(scenarioId, row, effects);
        expect(problems, title).toEqual([]);
      });
      it(`${title}: fails without its records`, () => {
        const problems = rowProblems(scenarioId, row, withoutLine(effects, row.line), true);
        if (problems.length === 0) throw new Error(`row ${row.line} passes without its records`);
      });
    });
  });
}
