import type { Effect } from "../../src/catalog/boundary.ts";
import type { GameEvent, ScenarioState } from "../../src/rules/core/state.ts";
import { settle } from "../../src/rules/engine/machine.ts";
import { fireForced } from "../../src/rules/windows/triggers.ts";
import { topFrame } from "../../src/rules/windows/windows.ts";
import type { EngineStep } from "../../src/rules/core/intents.ts";
import type { PlayerIntent } from "../../src/rules/engine/reduce.ts";

import type { Act, Done, Row } from "./card-spec-types.ts";
import { fightEnemy, finish, first, idOf, legalIntents, resolveRecords, revealFromTop, send, start as begin, tableFromLayout, type Layout, type LayoutTable, type Run } from "./scene-kit.ts";

// Test helper. Plays the actions of a card-spec row (card-spec-types.ts, Act) on a table built from its layout: each action is the scene kit's helper for it (`resolveRecords`, `revealFromTop`, `fightEnemy`, `send` of an
// intent from `legalIntents`). Rules: rr.forced, rr.response, rr.reveal, rr.cancel, rr.travel (data/rules/entries.json).

// The answers an action's choices take, in order: a listed option that is not offered is an error; with none left, the first option. A `lenient` picker (the run without the row's records, which may open no
// choice at all) takes the first option instead of failing: an answer the records never asked for is not what the row is checked on.
function picker(queue: string[], lenient: boolean): (state: ScenarioState) => string {
  return (state) => {
    if (state.window?.kind !== "choose") return "";
    const wanted = queue.shift();
    if (wanted === undefined || (lenient && !state.window.options.includes(wanted))) return state.window.options[0] ?? "";
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

// `holdForResponse`: the next action of the row is a `respond`, so the quest stops where a Response is offered instead of passing it.
function runQuest(done: Done, outcome: "success" | "fail", pick: (state: ScenarioState) => string, holdForResponse: boolean): Run {
  const { table } = done;
  let run = send(done.run, { type: "Commit", cardIds: [table.hero, table.hero2] }, table.ctx);
  run = send(run, { type: "Pass" }, table.ctx);
  for (let guard = 0; guard < 16; guard += 1) {
    if (run.state.window?.kind === "choose") run = finish(run, table.ctx, pick);
    else if (run.state.phase !== "Quest" || run.state.lost || run.state.stageCleared) break;
    else {
      const intents = legalIntents(run.state, table.ctx);
      const pass = intents.find((intent) => intent.type === "Pass");
      if (!pass || run.state.mode === "travel") break;
      if (holdForResponse && run.steps.some((step) => step.kind === "quest") && intents.some((intent) => intent.type === "Trigger")) break;
      run = send(run, pass as PlayerIntent, table.ctx);
    }
  }
  const compared = run.steps.find((step) => step.kind === "quest");
  if (compared?.kind !== "quest") throw new Error("the quest compared nothing");
  const succeeded = compared.willpower >= compared.threat;
  if (succeeded !== (outcome === "success")) throw new Error(`the quest was meant to ${outcome === "success" ? "succeed" : "fail"}: willpower ${compared.willpower}, threat ${compared.threat}`);
  return run;
}

// The card's Response, used now: the Trigger the open window offers for it. Without the row's records nothing is offered (`lenient`), and the expectation says whether the row held.
function playResponse(done: Done, code: string, pick: (state: ScenarioState) => string, lenient: boolean): Run {
  const { run, table } = done;
  const id = idOf(run.state, code);
  const intent = legalIntents(run.state, table.ctx).find((offered) => offered.type === "Trigger" && offered.cardId === id);
  if (!intent) {
    if (lenient) return run;
    throw new Error(`no Response of ${code} is offered`);
  }
  return finish(send(run, intent as PlayerIntent, table.ctx), table.ctx, pick);
}

// The first player cancels the effect the open cancel offer is about, paying from the first hero whose pool covers it.
function cancelOffered(done: Done, pick: (state: ScenarioState) => string, lenient: boolean): Run {
  const { run, table } = done;
  const data = topFrame(run.state)?.data;
  const intent = legalIntents(run.state, table.ctx).find((offered) => offered.type === "Trigger");
  if (run.state.window?.kind !== "cancelOffer" || !intent || intent.type !== "Trigger" || data?.kind !== "effect") {
    if (lenient) return run;
    throw new Error(`no cancel is offered (window ${run.state.window?.kind ?? "none"})`);
  }
  const amount = data.cancel?.amount ?? 0;
  const payer = run.state.seats[run.state.firstPlayer]?.heroes.find((id) => (run.state.cards[id]?.resources ?? 0) >= amount);
  if (amount > 0 && !payer) throw new Error(`no hero holds the ${amount} resources the cancel costs`);
  const payments = payer && amount > 0 ? [{ heroId: payer, amount }] : [];
  return finish(send(run, { ...intent, payments } as PlayerIntent, table.ctx), table.ctx, pick);
}

// One action on the state so far. `picks` are the answers that follow it; `next` is the action after it.
function perform(done: Done, act: Act, next: Act | undefined, picks: string[], scenarioId: string, lenient: boolean): Run {
  const { run, table } = done;
  const pick = picker(picks, lenient);
  switch (act.act) {
    case "resolve": {
      const source = act.source ?? (first(run.state, act.code) || undefined);
      const made = resolveRecords(run.state, table.ctx, act.code, act.timing, source, pick);
      return { state: made.state, steps: [...run.steps, ...made.steps] };
    }
    case "quest":
      return runQuest(done, act.outcome, pick, next?.act === "respond");
    case "reveal": {
      const steps: EngineStep[] = [];
      const revealed = revealFromTop(run.state, table.ctx, act.code, steps);
      const made = finish({ state: revealed.state, steps }, table.ctx, pick);
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
      if (run.state.window?.kind !== "choose") {
        // Without the row's records nothing opens the choice: the answer is skipped, and the expectation says whether the row held.
        if (lenient) return run;
        throw new Error(`answer(${act.id}) with no choice open`);
      }
      if (lenient && !run.state.window.options.includes(act.id)) return run;
      return finish(send(run, { type: "Choose", optionId: act.id }, table.ctx), table.ctx, pick);
    }
    case "respond":
      return playResponse(done, act.code, pick, lenient);
    case "cancel":
      return cancelOffered(done, pick, lenient);
    case "announce": {
      const event = { trigger: act.trigger, seat: 0, ...(act.code ? { cardId: idOf(run.state, act.code) } : {}), ...act.extra } as GameEvent;
      const steps: EngineStep[] = [];
      const made = finish({ state: settle(fireForced({ ...run.state, window: null }, event, table.ctx, steps), table.ctx, steps), steps }, table.ctx, pick);
      return { state: made.state, steps: [...run.steps, ...made.steps] };
    }
    case "attack":
      throw new Error(`attack must be the first action of a row (${scenarioId})`);
    case "defend":
      throw new Error(`defend must follow the attack action directly (${scenarioId})`);
  }
}

// The actions of a row on a table: each action takes the `answer` actions that follow it as its choices. An `attack` is the first action and takes the `defend` that follows it.
export function play(scenarioId: string, row: Row, effects: readonly Effect[], lenient: boolean): Done {
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
    const defending = acts[index];
    const defender = defending?.act === "defend" ? defending.with : undefined;
    if (defending?.act === "defend") index += 1;
    const picks = takeAnswers();
    const engaged = [...(layout.engaged ?? []), ...((layout.engaged ?? []).some((item) => (typeof item === "string" ? item : item.code) === firstAct.enemy) ? [] : [{ code: firstAct.enemy, seat: 0 }])];
    const dealt = firstAct.shadow ? { deck: [firstAct.shadow, ...(layout.deck ?? ["f0", "f0", "f0"])] } : {};
    const options = { undefended: firstAct.undefended === true, pick: picker(picks, lenient), ...(defender ? { defender: (made: LayoutTable) => idOf(made.state, defender) } : {}) };
    const fought = fightEnemy(build, firstAct.shadow ?? "f0", firstAct.enemy, { ...layout, engaged, ...dealt }, options);
    done = { run: fought.run, table: fought.made, during: fought.during };
  } else {
    const table = build(layout);
    done = { run: begin(table.state), table };
  }
  while (index < acts.length) {
    const act = acts[index++]!;
    const picks = act.act === "answer" ? [] : takeAnswers();
    done = { ...done, run: perform(done, act, acts[index], picks, scenarioId, lenient) };
    if (picks.length > 0 && !lenient) throw new Error(`answer(${picks.join(", ")}) was never asked for`);
  }
  return done;
}
