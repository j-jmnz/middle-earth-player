import { describe, expect, it } from "vitest";

import type { Effect } from "../../src/catalog/boundary.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { flagged, type GameEvent, type ScenarioState } from "../../src/rules/core/state.ts";
import { modifiedStat } from "../../src/rules/core/keywords.ts";
import { spawn } from "../../src/rules/core/zones.ts";
import { settle } from "../../src/rules/engine/machine.ts";
import { startReveal } from "../../src/rules/windows/frames.ts";
import { fireForced } from "../../src/rules/windows/triggers.ts";
import type { EngineStep } from "../../src/rules/core/intents.ts";

import { fightEnemy, finish, first, idOf, idsOf, legalIntents, resolveRecords, send, start as begin, tableFromLayout, type Layout, type LayoutTable, type Run } from "./scene-kit.ts";
import type { PlayerIntent } from "../../src/rules/engine/reduce.ts";

// Test helper. Card behaviour as spec rows: a row names a ledger line (the one an effect record names in `lines`), the table it needs by
// zone, one action that gives the behaviour a game moment, and what must be true afterwards. `cardSpecs` runs each row on the scenario's
// records, and again with the records of its line removed: a row that still passes then tests nothing and fails. The table is
// `tableFromLayout` (scene-kit.ts), so a scenario needs no scene file; the actions are the scene kit's helpers. Rules: rr.forced,
// rr.response, rr.reveal, rr.shadow-effects, rr.travel (data/rules/entries.json).

type StatName = Parameters<typeof modifiedStat>[2];
type FlagName = Parameters<typeof flagged>[2];

/** One action of a row. A choice a record opens is answered by the `answer` actions that follow the action that opens it (the first option when none is left). */
export type Act =
  | { act: "resolve"; code: string; timing: Effect["timing"]; source?: string }
  | { act: "quest"; outcome: "success" | "fail" }
  | { act: "attack"; enemy: string; shadow?: string; undefended?: boolean }
  | { act: "reveal"; code: string }
  | { act: "travel"; code: string }
  | { act: "endRound" }
  | { act: "answer"; id: string }
  | { act: "announce"; trigger: GameEvent["trigger"]; code?: string; extra?: Partial<GameEvent> };

export type Expect =
  | { expect: "stat"; code: string; name: StatName; value: number }
  | { expect: "flag"; code: string; name: FlagName; value: boolean }
  | { expect: "zone"; code: string; zone: string }
  | { expect: "progressOn"; code: string; value: number }
  | { expect: "resourcesOn"; code: string; value: number }
  | { expect: "lost" }
  | { expect: "won" }
  | { expect: "frame"; name: string }
  | { expect: "offers"; intent: PlayerIntent["type"]; code?: string };

export type Row = { line: string; layout?: Layout; act: Act | readonly Act[]; expect: Expect | readonly Expect[]; name?: string };

/** The records of the card resolve at this timing (a card in the layout is the source; otherwise the card is spawned in the staging area). */
export const resolve = (code: string, timing: Effect["timing"], source?: string): Act => ({ act: "resolve", code, timing, ...(source ? { source } : {}) });
/** Both of the first seat's heroes commit and the quest is played to its end; `outcome` is checked against the willpower and threat the quest compared. */
export const quest = (outcome: "success" | "fail"): Act => ({ act: "quest", outcome });
/** The enemy attacks the first seat in the combat phase with `shadow` dealt to it (a filler enemy by default), the first hero defending. Must be the first action. */
export const attack = (enemy: string, options: { shadow?: string; undefended?: boolean } = {}): Act => ({ act: "attack", enemy, ...options });
/** The card is put on top of the encounter deck and revealed, its When Revealed resolving. */
export const reveal = (code: string): Act => ({ act: "reveal", code });
/** The players travel to the location (in the staging area; the layout's phase is Travel). */
export const travel = (code: string): Act => ({ act: "travel", code });
/** Every window is passed until the next round begins, the end of this round included. */
export const endRound: Act = { act: "endRound" };
/** The option of the choice that is open. */
export const answer = (id: string): Act => ({ act: "answer", id });
/** The engine announces an event to the Forced effects (a trigger, the card it is about, and any other fields), the way a step of the game does. */
export const announce = (trigger: GameEvent["trigger"], code?: string, extra: Partial<GameEvent> = {}): Act => ({ act: "announce", trigger, ...(code ? { code } : {}), ...(Object.keys(extra).length > 0 ? { extra } : {}) });

export const stat = (code: string, name: StatName, value: number): Expect => ({ expect: "stat", code, name, value });
export const flag = (code: string, name: FlagName, value = true): Expect => ({ expect: "flag", code, name, value });
export const zone = (code: string, name: string): Expect => ({ expect: "zone", code, zone: name });
export const progressOn = (code: string, value: number): Expect => ({ expect: "progressOn", code, value });
export const resourcesOn = (code: string, value: number): Expect => ({ expect: "resourcesOn", code, value });
export const lost: Expect = { expect: "lost" };
export const won: Expect = { expect: "won" };
/** A frame of this name was pushed while the action ran. */
export const frame = (name: string): Expect => ({ expect: "frame", name });
/** The intent is legal now (for a card, one of its own: a Response offered after the action). */
export const offers = (intent: PlayerIntent["type"], code?: string): Expect => ({ expect: "offers", intent, ...(code ? { code } : {}) });

type Done = { run: Run; table: LayoutTable };

// The answers an action's choices take, in order: a listed option that is not offered is an error; with none left, the first option.
function picker(queue: string[]): (state: ScenarioState) => string {
  return (state) => {
    if (state.window?.kind !== "choose") return "";
    const wanted = queue.shift();
    if (wanted === undefined) return state.window.options[0] ?? "";
    if (!state.window.options.includes(wanted)) throw new Error(`option ${wanted} is not offered (${state.window.options.join(", ")})`);
    return wanted;
  };
}

// Plays the first window that asks for nothing until `done`: the passes, the declines and the defenses nobody makes.
function passOn(run: Run, table: LayoutTable, done: (state: ScenarioState) => boolean, pick: (state: ScenarioState) => string): Run {
  let current = run;
  for (let guard = 0; guard < 400 && !done(current.state) && !current.state.lost && !current.state.stageCleared; guard += 1) {
    const window = current.state.window;
    if (window?.kind === "choose" || window?.kind === "look") current = finish(current, table.ctx, pick);
    else if (window?.kind === "defense") current = send(current, { type: "Undefended", heroId: current.state.cards[table.hero]?.zone === "heroes" ? table.hero : table.hero2 }, table.ctx);
    else if (window?.kind === "chooseEnemy") current = send(current, { type: "ChooseEnemy", enemyId: window.options[0] ?? "" }, table.ctx);
    else {
      const next = legalIntents(current.state, table.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage" || intent.type === "DeclineTravel");
      if (!next) break;
      current = send(current, next as PlayerIntent, table.ctx);
    }
  }
  return current;
}

function runQuest(done: Done, outcome: "success" | "fail", pick: (state: ScenarioState) => string): Run {
  const { table } = done;
  let run = send(done.run, { type: "Commit", cardIds: [table.hero, table.hero2] }, table.ctx);
  run = send(run, { type: "Pass" }, table.ctx);
  for (let guard = 0; guard < 16; guard += 1) {
    if (run.state.window?.kind === "choose") run = finish(run, table.ctx, pick);
    else if (run.state.phase !== "Quest" || run.state.lost || run.state.stageCleared) break;
    else {
      const pass = legalIntents(run.state, table.ctx).find((intent) => intent.type === "Pass");
      if (!pass || run.state.mode === "travel") break;
      run = send(run, pass as PlayerIntent, table.ctx);
    }
  }
  const compared = run.steps.find((step) => step.kind === "quest");
  if (compared?.kind !== "quest") throw new Error("the quest compared nothing");
  const succeeded = compared.willpower >= compared.threat;
  if (succeeded !== (outcome === "success")) throw new Error(`the quest was meant to ${outcome === "success" ? "succeed" : "fail"}: willpower ${compared.willpower}, threat ${compared.threat}`);
  return run;
}

// One action on the state so far. `picks` are the answers that follow it.
function perform(done: Done, act: Act, picks: string[], scenarioId: string): Run {
  const { run, table } = done;
  const pick = picker(picks);
  switch (act.act) {
    case "resolve": {
      const source = act.source ?? (first(run.state, act.code) || undefined);
      const made = resolveRecords(run.state, table.ctx, act.code, act.timing, source, pick);
      return { state: made.state, steps: [...run.steps, ...made.steps] };
    }
    case "quest":
      return runQuest(done, act.outcome, pick);
    case "reveal": {
      const spawned = spawn(run.state, act.code, { zone: "encounterDeck" }, "down");
      const top = { ...spawned.state, encounterDeck: [spawned.id, ...spawned.state.encounterDeck.filter((id) => id !== spawned.id)] };
      const steps: EngineStep[] = [];
      const revealed = startReveal({ ...top, window: null }, 0, table.ctx, steps);
      const made = finish({ state: settle({ ...revealed, window: null, mode: "stopped" }, table.ctx, steps), steps }, table.ctx, pick);
      return { state: made.state, steps: [...run.steps, ...made.steps] };
    }
    case "travel": {
      if (run.state.window?.kind !== "travel") throw new Error(`no travel window: the layout's phase must be Travel (window ${run.state.window?.kind ?? "none"})`);
      const sent = send(run, { type: "Travel", locationId: idOf(run.state, act.code) }, table.ctx);
      return finish(sent, table.ctx, pick);
    }
    case "endRound":
      return passOn(run, table, (state) => state.round > run.state.round, pick);
    case "answer": {
      if (run.state.window?.kind !== "choose") throw new Error(`answer(${act.id}) with no choice open`);
      return finish(send(run, { type: "Choose", optionId: act.id }, table.ctx), table.ctx, pick);
    }
    case "announce": {
      const event = { trigger: act.trigger, seat: 0, ...(act.code ? { cardId: idOf(run.state, act.code) } : {}), ...act.extra } as GameEvent;
      const steps: EngineStep[] = [];
      const made = finish({ state: settle(fireForced({ ...run.state, window: null }, event, table.ctx, steps), table.ctx, steps), steps }, table.ctx, pick);
      return { state: made.state, steps: [...run.steps, ...made.steps] };
    }
    case "attack":
      throw new Error(`attack must be the first action of a row (${scenarioId})`);
  }
}

// The actions of a row on a table: each action takes the `answer` actions that follow it as its choices.
function play(scenarioId: string, row: Row, effects: readonly Effect[]): Done {
  const acts = Array.isArray(row.act) ? (row.act as readonly Act[]) : [row.act as Act];
  const layout = row.layout ?? {};
  const build = (made: Layout): LayoutTable => tableFromLayout(scenarioId, made, { effects });
  let done: Done;
  let index = 0;
  const firstAct = acts[0];
  const takeAnswers = (): string[] => {
    const picks: string[] = [];
    while (acts[index]?.act === "answer" && picks.length < 40) picks.push((acts[index++] as Extract<Act, { act: "answer" }>).id);
    return picks;
  };
  if (firstAct?.act === "attack") {
    index = 1;
    const picks = takeAnswers();
    const engaged = [...(layout.engaged ?? []), ...((layout.engaged ?? []).some((item) => (typeof item === "string" ? item : item.code) === firstAct.enemy) ? [] : [{ code: firstAct.enemy, seat: 0 }])];
    const dealt = firstAct.shadow ? { deck: [firstAct.shadow, ...(layout.deck ?? ["f0", "f0", "f0"])] } : {};
    const fought = fightEnemy(build, firstAct.shadow ?? "f0", firstAct.enemy, { ...layout, engaged, ...dealt }, { undefended: firstAct.undefended === true, pick: picker(picks) });
    done = { run: fought.run, table: fought.made };
  } else {
    const table = build(layout);
    done = { run: begin(table.state), table };
  }
  while (index < acts.length) {
    const act = acts[index++]!;
    const picks = act.act === "answer" ? [] : takeAnswers();
    done = { run: perform(done, act, picks, scenarioId), table: done.table };
    if (picks.length > 0) throw new Error(`answer(${picks.join(", ")}) was never asked for`);
  }
  return done;
}

// What the expectation says is wrong with the state the actions left; nothing when it holds.
function failures(done: Done, wanted: readonly Expect[]): string[] {
  const { state, steps } = done.run;
  const problems: string[] = [];
  for (const item of wanted) {
    try {
      switch (item.expect) {
        case "stat": {
          const got = modifiedStat(state, state.cards[idOf(state, item.code)]!, item.name, done.table.cards);
          if (got !== item.value) problems.push(`${item.code} ${item.name} is ${got}, not ${item.value}`);
          break;
        }
        case "flag": {
          const got = flagged(state, idOf(state, item.code), item.name);
          if (got !== item.value) problems.push(`${item.code} ${item.name} is ${got}, not ${item.value}`);
          break;
        }
        case "zone": {
          const zones = idsOf(state, item.code).map((id) => state.cards[id]?.zone);
          if (!zones.includes(item.zone as never)) problems.push(`${item.code} is in ${zones.join(", ") || "no zone"}, not ${item.zone}`);
          break;
        }
        case "progressOn":
        case "resourcesOn": {
          const got = state.cards[idOf(state, item.code)]?.[item.expect === "progressOn" ? "progress" : "resources"] ?? 0;
          if (got !== item.value) problems.push(`${item.code} holds ${got} ${item.expect === "progressOn" ? "progress" : "resources"}, not ${item.value}`);
          break;
        }
        case "lost":
          if (!state.lost) problems.push("the game is not lost");
          break;
        case "won":
          if (!state.stageCleared || state.lost) problems.push("the game is not won");
          break;
        case "frame":
          if (!steps.some((step) => step.kind === "push" && step.frame === item.name)) problems.push(`no ${item.name} frame was pushed`);
          break;
        case "offers": {
          const id = item.code ? idOf(state, item.code) : undefined;
          const offered = legalIntents(state, done.table.ctx).some((intent) => intent.type === item.intent && (id === undefined || ("cardId" in intent && intent.cardId === id)));
          if (!offered) problems.push(`${item.intent}${item.code ? ` of ${item.code}` : ""} is not offered`);
          break;
        }
      }
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
  }
  return problems;
}

/** What a row says is wrong when it runs on these records: the failed expectations, or the error an action threw. Empty when the row holds. */
export function rowProblems(scenarioId: string, row: Row, effects: readonly Effect[]): string[] {
  const wanted = Array.isArray(row.expect) ? (row.expect as readonly Expect[]) : [row.expect as Expect];
  try {
    return failures(play(scenarioId, row, effects), wanted);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

/** The records without those that implement `line`. A new list: the shared list is never changed. */
export function withoutLine(effects: readonly Effect[], line: string): readonly Effect[] {
  return effects.filter((effect) => !effect.lines.includes(line));
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
        const problems = rowProblems(scenarioId, row, withoutLine(effects, row.line));
        if (problems.length === 0) throw new Error(`row ${row.line} passes without its records`);
      });
    });
  });
}
