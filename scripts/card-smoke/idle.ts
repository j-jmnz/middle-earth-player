import { costOfKind } from "../../src/catalog/costs.ts";
import type { Effect } from "../../src/catalog/boundary.ts";
import { isPlayerCardEffect } from "../../src/rules/core/keywords.ts";
import { moveCard } from "../../src/rules/core/zones.ts";
import { DONE } from "../../src/rules/families/deck/choose.ts";
import type { EngineStep, PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";
import { FILLER } from "../../test/harness/game-kit.ts";
import { payUsage } from "../../src/rules/player/usage.ts";
import { effectById } from "../../src/rules/windows/listen.ts";
import { updateCard } from "../../src/rules/core/state.ts";

// An optional ability that changes nothing (docs/agents/card-audit.md, What finds what): an Action, a Response or an event that was
// offered and accepted, and whose resolution left the table as paying for it left it. The engine withholds such an ability
// (src/rules/player/potential.ts, rr.triggered-ability, rr.cost); a hit here is a card that is offered anyway, a candidate to read against its
// printed line. The card smoke (run.ts) and the encounter games (encounter-games.ts) feed every accepted intent to `observe`.
//
// What counts as nothing: the table after the effect's frame has gone from the stack, compared with the table after the cost was paid
// (`payUsage` on the table before the intent, for an event also its play: payments spent, the card in the discard pile). Left out of the
// comparison: the stack and the window, the clock and the counters of the limits and of the cards played this round, the events waiting to be
// announced. Everything else is a change, a shuffle (the seed), a look at cards, a flag or a duration modifier included. An effect is
// not reported when a choice on the way was declined (the `done` option), when it asked its player to take one of several branches (the branch taken may be the idle one), or when another ability was used before it finished (a Response
// to its result), because its table then holds that ability's changes.

// Table fields that paying and the frame machinery move without the effect doing anything.
const LEFT_OUT: ReadonlySet<string> = new Set(["stack", "window", "passed", "frameSeq", "clock", "uses", "played", "spent", "entries", "pendingEvents", "activeSeat", "revealCursor", "stepWindows", "undo"]);
// The steps that only mark a frame, or that restate a change the table comparison already sees.
const STATE_STEPS: ReadonlySet<string> = new Set(["push", "pop", "draw", "gainResource", "damage", "threat", "progress", "life"]);
// An effect that has not finished after this many intents is dropped, not reported.
const MOST_INTENTS = 40;

// `before`: the table the intent was sent on, to read why the engine offered the ability there.
export type IdleHit = { recordId: string; cardId: string; code: string; step: number; intent: PlayerIntent; before: ScenarioState };

type Watch = {
  recordId: string;
  cardId: string;
  code: string;
  step: number;
  intent: PlayerIntent;
  before: ScenarioState;
  baseline: ScenarioState;
  baselineSteps: readonly string[];
  frameId: string | null;
  // Set when the effect looked at cards, made a choice it declined, or shared the table with another ability.
  changed: boolean;
  intents: number;
  // The steps of every intent since the ability was used.
  steps: EngineStep[];
};

function stable(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => (item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => (left < right ? -1 : 1))) : item));
}

function projection(state: ScenarioState): string {
  const kept = Object.fromEntries(Object.entries(state).filter(([key]) => !LEFT_OUT.has(key)));
  return stable(kept);
}

// The effect asked its player to take one of several branches: the branch taken may do nothing while another would have done something.
function branches(state: ScenarioState): boolean {
  const data = state.stack[state.stack.length - 1]?.data;
  return state.window?.kind === "choose" && data?.kind === "effect" && data.wait?.kind === "branch";
}

const lineOf = (step: EngineStep): string => JSON.stringify(step);

function openWatch(before: ScenarioState, after: ScenarioState, intent: PlayerIntent, ctx: ReduceContext, index: number): Watch | null {
  if (intent.type !== "Trigger" && intent.type !== "PlayCard") return null;
  const source = before.cards[intent.cardId];
  // The harness's filler event is a free card that does nothing, on purpose.
  if (!source || source.code === FILLER || !isPlayerCardEffect(before, ctx.cards, intent.cardId)) return null;
  const costSteps: EngineStep[] = [];
  let baseline: ScenarioState;
  let record: string;
  if (intent.type === "Trigger") {
    const effect: Effect | undefined = effectById(ctx, intent.effectId);
    if (!effect) return null;
    const seat = before.window?.kind === "response" ? before.window.seat : before.activeSeat;
    baseline = payUsage(before, effect, intent.cardId, intent.payments ?? [], ctx, costSteps, seat);
    // An event used as a Response is held in the hand and discarded when its effect is done (`finish: "discardSource"`).
    if (costOfKind(effect, "playEvent") && baseline.cards[intent.cardId]) baseline = moveCard(baseline, intent.cardId, { zone: "discard", seat: source.owner ?? source.controller ?? seat });
    record = effect.id;
  } else {
    // An event played from the hand: its payments are spent and its card goes to the discard pile when its Actions are done.
    const printed = ctx.cards.get(source.code);
    // An event with no Action of its own (a Response record that hears it played) resolves later, from the queue, not in a frame of its own.
    if (printed?.type !== "event" || !ctx.effects.some((effect) => effect.cardCode === source.code && effect.timing === "action")) return null;
    baseline = before;
    for (const payment of intent.payments) {
      const hero = baseline.cards[payment.heroId];
      if (hero) baseline = updateCard(baseline, payment.heroId, { resources: hero.resources - payment.amount });
    }
    baseline = moveCard(baseline, intent.cardId, { zone: "discard", seat: before.activeSeat });
    record = `${source.code}:play`;
  }
  const known = new Set(before.stack.map((frame) => frame.id));
  const frame = after.stack.find((entry) => !known.has(entry.id) && entry.frame === "ResolveEffect");
  return { recordId: record, cardId: intent.cardId, code: source.code, step: index, intent, before, baseline, baselineSteps: costSteps.map(lineOf), frameId: frame?.id ?? null, changed: false, intents: 0, steps: [] };
}

/** What the card smoke and the encounter games ask of a game's accepted intents. */
export type IdleWatcher = {
  /** Feeds one accepted intent: the table it was sent on, the table it gave, and its steps. */
  observe(before: ScenarioState, intent: PlayerIntent, after: ScenarioState, steps: readonly EngineStep[]): void;
  /** Every ability found offered and idle so far. */
  readonly hits: readonly IdleHit[];
};

export function idleWatcher(ctx: ReduceContext): IdleWatcher {
  const hits: IdleHit[] = [];
  let open: Watch[] = [];
  let count = 0;
  const finish = (watch: Watch, after: ScenarioState): void => {
    const left = new Set(watch.baselineSteps);
    const seen = watch.steps.filter((step) => !STATE_STEPS.has(step.kind) && !left.has(lineOf(step)));
    if (watch.changed || seen.length > 0) return;
    if (projection(after) !== projection(watch.baseline)) return;
    hits.push({ recordId: watch.recordId, cardId: watch.cardId, code: watch.code, step: watch.step, intent: watch.intent, before: watch.before });
  };
  return {
    hits,
    observe(before, intent, after, steps) {
      count += 1;
      const stillOpen: Watch[] = [];
      // Another ability used while an effect is open shares the table with it.
      if (open.length > 0 && (intent.type === "Trigger" || intent.type === "PlayCard")) for (const watch of open) watch.changed = true;
      for (const watch of open) {
        watch.intents += 1;
        watch.steps.push(...steps);
        if (intent.type === "Choose" && intent.optionId === DONE) watch.changed = true;
        if (after.window?.kind === "look" || branches(after)) watch.changed = true;
        const gone = watch.frameId == null || !after.stack.some((frame) => frame.id === watch.frameId);
        if (gone) finish(watch, after);
        else if (watch.intents < MOST_INTENTS && !after.lost) stillOpen.push(watch);
      }
      open = stillOpen;
      const opened = openWatch(before, after, intent, ctx, count);
      if (!opened) return;
      if (after.window?.kind === "look" || branches(after)) opened.changed = true;
      opened.steps.push(...steps);
      if (opened.frameId != null && after.stack.some((frame) => frame.id === opened.frameId)) open.push(opened);
      else finish(opened, after);
    },
  };
}

export function formatIdle(hit: IdleHit): string {
  return `offered ${hit.recordId} and it changed nothing (intent ${hit.step}: ${JSON.stringify(hit.intent)})`;
}
