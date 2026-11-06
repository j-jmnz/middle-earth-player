// Plays a seeded game through the reader's eyes (src/play/reader-play.test.ts): at each state it asks which intents a screen reader's user can
// reach (reach.ts), fails on the first the engine offers that no labelled element reaches, and sends the driver's intent only when a reader can
// build it. Pure but for the reducer: no renderer, no store.
import { legalIntents, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../rules/engine/reduce.ts";
import type { StartScenario } from "../../rules/setup/setup.ts";

import { nameOfCard, pictureCode } from "../canvas/picture-key.ts";
import { shownName } from "../cards/shown-name.ts";
import type { SheetNames } from "../choice/sheet-types.ts";
import { zoneFactsOf } from "../store/zone-facts.ts";
import { describe, reachable, unreachedIntents } from "./cover.ts";
import { readerReach, type Reach, type Reached } from "./reach.ts";

/** A seeded game and the intent that plays it on: the driver names one intent per state, as the auto-player or a golden does. */
export type ReaderGame = {
  scenario: string;
  name: string;
  ctx: ReduceContext;
  start: StartScenario;
  next: (state: ScenarioState, step: number) => PlayerIntent | null;
  // Chooses among the intents a reader can send, from a seed, in place of `next` (null: `next` answers). It is how a game uses the elements the driver
  // would not: a card played, a trigger used, a choice taken the other way.
  pick?: (reached: readonly Reached[], step: number) => Reached | null;
  // The most states checked; a longer game is cut here.
  limit: number;
};

/** An intent the engine offers that no reader element reaches, and why that is fine, by the shape of the intent and the window it is offered in. */
export type Allowed = { when: (state: ScenarioState, what: string, reach: Reach) => boolean; why: string };

export type ReaderRun = { game: string; states: number; sent: number; picked: number; ended: "won" | "lost" | "cut" | "failed"; failure: string | null };

const where = (game: ReaderGame, state: ScenarioState): string => `${game.scenario} (${game.name}), round ${state.round}, ${state.phase}, ${state.mode}, window ${state.window?.kind ?? "none"}`;

export function playReaderGame(game: ReaderGame, allowed: readonly Allowed[]): ReaderRun {
  const { ctx } = game;
  const rows = { facts: zoneFactsOf(ctx.cards), cards: ctx.cards, nameOf: (key: string) => shownName(key, ctx.cards.get(pictureCode(key))) };
  let state = startScenario(game.start, ctx);
  const run: ReaderRun = { game: `${game.scenario} (${game.name})`, states: 0, sent: 0, picked: 0, ended: "cut", failure: null };
  const fail = (message: string): ReaderRun => ({ ...run, ended: "failed", failure: message });
  for (let step = 0; step < game.limit; step += 1) {
    if (state.lost || (state.stageCleared && state.window == null)) return { ...run, ended: state.lost ? "lost" : "won" };
    const legal = legalIntents(state, ctx);
    if (legal.length === 0) return fail(`${where(game, state)}: the engine offers no intent`);
    const current = state;
    const names: SheetNames = { card: (id) => nameOfCard(current.cards, id, rows.nameOf), line: () => null };
    const reach = readerReach({ game: state, ctx, legal, names, rows });
    run.states += 1;
    run.sent += reach.sent.length;
    if (reach.unlabelled.length > 0) return fail(`${where(game, state)}: an element has no words: ${reach.unlabelled.join("; ")}`);
    const missing = unreachedIntents(state, ctx, legal, reach.sent).filter((what) => !allowed.some((entry) => entry.when(current, what, reach)));
    if (missing.length > 0) {
      const asked = reach.unreached.length > 0 ? ` (no element reaches: ${reach.unreached.join(", ")})` : "";
      const refused = reach.refused.length > 0 ? ` (a sheet was refused: ${reach.refused.map((one) => one.text).join("; ")})` : "";
      return fail(`${where(game, state)}: no labelled element sends ${missing.join(", ")}${asked}${refused}`);
    }
    const chosen = game.pick?.(reach.sent, step) ?? null;
    if (chosen) run.picked += 1;
    const intent = chosen?.intent ?? game.next(state, step);
    if (!intent) return { ...run, ended: "cut" };
    if (!reachable(intent, reach.sent) && !allowed.some((entry) => entry.when(current, describe(intent), reach))) return fail(`${where(game, state)}: the driver's intent ${JSON.stringify(intent)} has no labelled path; reached: ${reach.sent.map((entry) => `${JSON.stringify(entry.intent)} by ${entry.via}`).slice(0, 6).join("; ")}`);
    const result = reduce(state, intent, ctx);
    if (!result.ok) return fail(`${where(game, state)}: the reducer refused ${JSON.stringify(intent)}: ${result.reason}`);
    state = result.state;
  }
  return run;
}
