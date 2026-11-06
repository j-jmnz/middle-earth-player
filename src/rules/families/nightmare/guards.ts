// Rules: rr.running-out-of-cards, rr.step-6-8-1, rr.damage, mec109.hide-tests, mec109.hide-x (data/rules/entries.json); ledger lines
// 900201:A:3, 900202:A:1, 900204:A:2, 900302:A:2, 906106:A:1, 906108:A:1.
//
// The nightmare family's small reads that the shared engine files make (combat.ts, conditions.ts, effect-frames.ts, hide.ts,
// interpret.ts, player-verbs.ts, verbs.ts, families/quest.ts). Only state, frame and printed-card reads are imported here, so the lowest
// engine files can call it without importing the family's verbs.
import type { Effect } from "../../../catalog/boundary.ts";
import { stageNumber } from "../caves/progress.ts";
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import type { HideResult, ScenarioState } from "../../core/state.ts";
import { inPlay, modifierActive } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

// The `onStage` condition: the current quest card is the quest deck's stage `stage` (900204:A:2, "If the players are on stage 3").
export function onStage(state: ScenarioState, stage: number): boolean {
  return stageNumber(state) === stage;
}

// The `attackOnlyTitle` flag (900202:A:1): a seat engaged with Marshland Outlaws cannot attack, or damage by his card effects, an enemy whose
// title is not the title of the card that holds him to it. A target that is not an enemy is never barred.
export function titleBarred(state: ScenarioState, seat: number, enemyId: string, cards: Cards): boolean {
  const enemy = state.cards[enemyId];
  if (!enemy) return false;
  const printed = printedOf(cards, enemy.code);
  if (printed.type !== "enemy") return false;
  const title = printed.name;
  return state.modifiers.some((modifier) => {
    if (modifier.stat !== "attackOnlyTitle" || modifier.instanceId !== `seat:${seat}` || modifier.amount <= 0 || !modifierActive(state, modifier)) return false;
    const source = state.cards[modifier.sourceId];
    return source != null && printedOf(cards, source.code).name !== title;
  });
}

// The `encounterRefill` flag (900201:A:3): the encounter deck is refilled from its discard pile whenever it is empty, in any phase.
export function refillsAnyTime(state: ScenarioState): boolean {
  return state.modifiers.some((modifier) => modifier.stat === "encounterRefill" && modifier.instanceId === "table" && modifier.amount > 0 && modifierActive(state, modifier));
}

// The most characters a player may commit to a Hide test now (the smallest `hideCommitLimit` the table holds), or null with no limit
// (906106:A:1).
export function hideCommitLimit(state: ScenarioState): number | null {
  let limit: number | null = null;
  for (const modifier of state.modifiers) {
    if (modifier.stat !== "hideCommitLimit" || modifier.instanceId !== "table" || !modifierActive(state, modifier)) continue;
    limit = limit == null ? modifier.amount : Math.min(limit, modifier.amount);
  }
  return limit;
}

// A Hide test made by an effect (HideTest) leaves its result on that effect's frame, for `lastHideFailed`.
export function noteEffectHide(state: ScenarioState, result: HideResult | null): ScenarioState {
  const top = topFrame(state);
  if (top?.data.kind !== "effect" || !result) return state;
  return patchTop(state, { data: { ...top.data, hideFailed: !result.success } });
}

// The `lastHideFailed` condition: the running effect's last Hide test failed.
export function lastHideFailed(state: ScenarioState): boolean {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" && data.hideFailed === true;
}

// On Nightmare the setup card's recipe can replace a scenario card by a Nightmare card of the same title (Weathertop 141046 by 906204,
// Ford of Bruinen 141059 by 906303; docs/plans/done/nightmare-mode.md). A record that names the standard card by code ("Add Weathertop to
// the staging area", 141027:A:1) means the card of that title the game dealt: with no card of the named code in the game, the code of a
// dealt card with the same printed title stands in for it. Off Nightmare, or when the named card is dealt, the code is kept.
export function twinCode(state: ScenarioState, code: string, cards: Cards): string {
  const all = Object.values(state.cards);
  // On Nightmare only: the setup card is in play next to the quest deck (rules/setup/setup.ts).
  if (!all.some((card) => card.zone === "nightmare")) return code;
  if (all.some((card) => card.code === code)) return code;
  const title = cards.get(code)?.name;
  if (title == null) return code;
  return all.find((card) => card.code !== code && cards.get(card.code)?.name === title)?.code ?? code;
}

// An instruction or condition with a `code` field, read with that code's Nightmare twin.
export function withTwin<T extends object>(state: ScenarioState, named: T, cards: Cards): T {
  if (!("code" in named) || typeof named.code !== "string") return named;
  const code = twinCode(state, named.code, cards);
  return code === named.code ? named : { ...named, code };
}

// Whether a card in play, or the setup card next to the quest deck, has a record that listens for the trigger: an event only those hear
// is announced only then (`stageRevealed`, `whenRevealedCanceled`).
export function listenerInPlay(state: ScenarioState, trigger: NonNullable<Effect["trigger"]>, effects: readonly Effect[]): boolean {
  const codes = new Set(effects.filter((effect) => effect.trigger === trigger).map((effect) => effect.cardCode));
  if (codes.size === 0) return false;
  return Object.values(state.cards).some((card) => codes.has(card.code) && (inPlay(card.zone) || card.zone === "nightmare"));
}
