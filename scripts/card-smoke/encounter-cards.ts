import type { ScenarioData } from "../../src/catalog/scenario-data.ts";
import { printedOf } from "../../src/rules/core/printed.ts";
import { updateCard } from "../../src/rules/core/state.ts";
import { spawn } from "../../src/rules/core/zones.ts";
import { settle } from "../../src/rules/engine/machine.ts";
import { syncConstants } from "../../src/rules/interpret/constants.ts";
import { legalIntents, legalTargets, reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";
import { pushCardEffects } from "../../src/rules/interpret/effect-frames.ts";
import type { EngineStep } from "../../src/rules/core/intents.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { causeProblems } from "../../test/harness/cause-check.ts";
import { opening, revealFromTop } from "../../test/harness/scene-kit.ts";
import { describeError } from "../log.ts";
import { POLICY as PLAY } from "./world.ts";

// The card half of scripts/card-smoke/encounter.ts. Each encounter-side card a scenario deals is played once in a table made from
// the scenario's own opening (the first seat kept its hand): revealed from the top of the encounter deck, its Shadow resolved in an
// attack on a plain enemy (defended and undefended), traveled to when it is a location, its Setup run when it is a quest card.
// Every intent sent is one the engine offered. A throw, a refused intent, `state.failure` or a window that never closes is a
// problem, reported with the card and the step. It proves that the records run without breaking the game, not that they do
// what the card says.

export type Probe = "reveal" | "shadow" | "shadow (undefended)" | "travel" | "setup";
export type CardResult = { code: string; probe: Probe; steps: number; note: string | null; problem: string | null };

// The auto-player answers every window of a probe, but uses no Action or Response of the heroes: a cancel would put the revealed card back.
const POLICY = { ...PLAY, act: false, play: false };
// A probe that has not closed after this many intents is a window that never closes.
const STALL = 300;
// The stand-in enemy a Shadow is dealt to.
export const ATTACKER = "f0";

export type DealtCard = { code: string; pile: string };

/** Every encounter-side card the scenario deals (its piles, its Nightmare deck, the other side of a two-code card) and its quest cards, each once. */
export function encounterCards(scenario: ScenarioData): { cards: DealtCard[]; stages: string[] } {
  const cards = new Map<string, string>();
  const stages = new Set<string>(scenario.stages);
  for (const placement of [...scenario.cards, ...(scenario.nightmare?.cards ?? [])]) {
    if (placement.pile === "quest") stages.add(placement.code);
    else cards.set(placement.code, cards.get(placement.code) ?? placement.pile);
    if ("back" in placement && placement.back != null) cards.set(placement.back, cards.get(placement.back) ?? placement.pile);
  }
  for (const code of stages) cards.delete(code);
  return { cards: [...cards].map(([code, pile]) => ({ code, pile })), stages: [...stages] };
}

class Stall extends Error {}

// Sends the auto-player's answer to every window until `done`. A refused intent, a failure or a stall throws.
function drive(start: ScenarioState, ctx: ReduceContext, steps: EngineStep[], done: (state: ScenarioState) => boolean, first?: PlayerIntent): ScenarioState {
  let state = start;
  const memory = new Set<string>();
  for (let turn = 0; turn < STALL; turn += 1) {
    if (state.failure) throw new Error(`state.failure: ${state.failure}`);
    if (state.lost || state.stageCleared || done(state)) return state;
    const legal = legalIntents(state, ctx);
    if (legal.length === 0) throw new Stall(`The engine offers no intent (window ${state.window?.kind ?? "none"}) and the probe is not over`);
    const intent = turn === 0 && first ? first : nextIntent(state, ctx, POLICY, memory, legal);
    const result = reduce(state, intent, ctx);
    if (!result.ok) throw new Error(`The reducer refused an offered intent ${JSON.stringify(intent)}: ${result.reason}`);
    if (result.state.failure) throw new Error(`state.failure after ${JSON.stringify(intent)}: ${result.state.failure}`);
    steps.push(...result.steps);
    state = result.state;
  }
  throw new Stall(`Window ${state.window?.kind ?? "none"} has not closed after ${STALL} intents`);
}

function checked(steps: readonly EngineStep[]): void {
  const problems = causeProblems(steps);
  if (problems.length > 0) throw new Error(`Steps without a cause: ${problems.join("; ")}`);
}

function reveal(base: ScenarioState, ctx: ReduceContext, code: string, steps: EngineStep[]): ScenarioState {
  const top = revealFromTop(base, ctx, code, steps);
  const depth = base.stack.length;
  const done = drive(top.state, ctx, steps, (state) => state.stack.length <= depth && state.window?.kind !== "choose");
  return left(done, top.id, "was not revealed");
}

// The state, or a thrown problem when the card is still in the encounter deck: the probe did nothing to it.
function left(state: ScenarioState, id: string, what: string): ScenarioState {
  if (state.cards[id]?.zone === "encounterDeck") throw new Error(`The card ${what}: it is still in the encounter deck`);
  return state;
}

// An enemy engaged with the first seat attacks in the combat phase with the card dealt to it as its Shadow. The card is put under the
// enemy by hand: some scenarios' rules shuffle the encounter deck before the shadows are dealt, so the top card is not the probe's.
function shadow(base: ScenarioState, ctx: ReduceContext, code: string, defended: boolean, steps: EngineStep[]): ScenarioState {
  const enemy = spawn(base, ATTACKER, { zone: "engaged", seat: 0 });
  const dealt = spawn(enemy.state, code, { zone: "shadow", enemyId: enemy.id });
  const table = { ...updateCard(dealt.state, enemy.id, { shadowId: dealt.id }), ...opening("Encounter") };
  const attacked = drive(table, ctx, steps, (state) => state.window?.kind === "defense");
  if (attacked.window?.kind !== "defense") throw new Error(`The enemy's attack never reached the defense window (ended in ${attacked.phase}, window ${attacked.window?.kind ?? "none"})`);
  const defender = legalTargets(attacked, { type: "DeclareDefender" }, ctx)[0];
  const intent: PlayerIntent = defended && defender ? { type: "DeclareDefender", defenderId: defender } : { type: "Undefended", heroId: legalTargets(attacked, { type: "Undefended" }, ctx)[0] ?? "" };
  // The attack, its Shadow and what the Shadow opens, until the combat phase passes on.
  const resolved = drive(attacked, ctx, steps, (state) => state.phase === "End of round" || state.phase === "Resource", intent);
  if (!resolved.lost && resolved.cards[dealt.id]?.zone === "shadow") throw new Error("The Shadow card was never resolved: it is still under the enemy");
  return resolved;
}

function travel(base: ScenarioState, ctx: ReduceContext, code: string, steps: EngineStep[]): { state: ScenarioState; note: string | null } {
  const placed = spawn({ ...base, ...opening("Travel") }, code, { zone: "staging" });
  // The constants of a card that has just entered the staging area hold before the players travel (a location that cannot leave the staging area is not offered, 146066:B:1).
  const at = syncConstants(placed.state, ctx);
  const legal = legalIntents(at, ctx);
  const target = legalTargets(at, { type: "Travel" }, ctx).find((id) => id === placed.id);
  if (!legal.some((intent) => intent.type === "Travel") || target == null) return { state: at, note: "not offered as a travel target on this table" };
  const traveled = drive(at, ctx, steps, (state) => state.cards[target]?.zone !== "staging" && state.stack.length === 0 && state.window?.kind !== "choose", { type: "Travel", locationId: target });
  // A location explored on arrival (no quest points) or sent away by its own Travel text has left the staging area too.
  if (traveled.cards[target]?.zone === "staging") throw new Error("The location is still in the staging area after Travel");
  return { state: traveled, note: null };
}

function setup(base: ScenarioState, ctx: ReduceContext, code: string, steps: EngineStep[]): { state: ScenarioState; note: string | null } {
  // The first quest card's Setup ran when the game was dealt (the table's own start): running it again would set its piles up twice.
  if (Object.values(base.cards).some((card) => card.code === code && card.zone === "questStage")) return { state: base, note: "ran at the game's start" };
  const effects = ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "setup");
  if (effects.length === 0) return { state: base, note: "no Setup record" };
  const placed = spawn({ ...base, window: null, mode: "stopped" }, code, { zone: "questStage" });
  const pushed = pushCardEffects(placed.state, "setup", placed.id, placed.state.firstPlayer, false, effects, ctx, steps);
  const depth = base.stack.length;
  return { state: drive(settle(pushed, ctx, steps), ctx, steps, (state) => state.stack.length <= depth && state.window?.kind !== "choose"), note: null };
}

/** Plays one probe of one card on the table `base`. */
export function probeCard(base: ScenarioState, ctx: ReduceContext, code: string, probe: Probe): CardResult {
  const steps: EngineStep[] = [];
  let note: string | null = null;
  try {
    if (probe === "reveal") reveal(base, ctx, code, steps);
    else if (probe === "shadow" || probe === "shadow (undefended)") shadow(base, ctx, code, probe === "shadow", steps);
    else if (probe === "travel") note = travel(base, ctx, code, steps).note;
    else note = setup(base, ctx, code, steps).note;
    checked(steps);
    return { code, probe, steps: steps.length, note, problem: null };
  } catch (error) {
    return { code, probe, steps: steps.length, note, problem: describeError(error) };
  }
}

// The Island Map's locations are laid out on the map, never in the staging area, so no player travels to one from there.
const NEVER_STAGED = new Set(["islandMap"]);

/** The probes each card gets: every card is revealed; a card with a Shadow record resolves it; a location is traveled to; a quest card runs its Setup. */
export function probesOf(ctx: ReduceContext, card: DealtCard | { stage: string }): Probe[] {
  if ("stage" in card) return ["setup"];
  const probes: Probe[] = ["reveal"];
  if (ctx.effects.some((effect) => effect.cardCode === card.code && effect.timing === "shadow")) probes.push("shadow", "shadow (undefended)");
  if (printedOf(ctx.cards, card.code).type === "location" && !NEVER_STAGED.has(card.pile)) probes.push("travel");
  return probes;
}
