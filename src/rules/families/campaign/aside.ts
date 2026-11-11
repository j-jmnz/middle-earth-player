// Rules: mec113.setting-up-the-game, mec113.aragorn, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 145078:A:1, 145072:A:1.
// The cards a Return of the King campaign card sets aside in Setup and hands back later: Aragorn with his attachments, and the enemies the log recorded under The Black Gate.
import type { Instruction } from "../../../catalog/boundary.ts";

import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { attachTo, moveCard, spawn } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

function heroWithCode(state: ScenarioState, code: string): string | undefined {
  return state.seats.flatMap((seat) => seat.heroes).find((id) => state.cards[id]?.code === code);
}

/** SetAsideHeroWithAttachments: the hero leaves the game's table at Setup, out of play, and the supplied cards are attached to him, also out of play. Nothing in play left, so nothing hears it (no `leftPlay`: 145001:A:1's loss does not fire). */
export function setAsideHeroWithAttachments(state: ScenarioState, instruction: Verb<"SetAsideHeroWithAttachments">): ScenarioState {
  const heroId = heroWithCode(state, instruction.hero);
  if (!heroId) return state;
  const quiet = state.pendingEvents;
  let next = moveCard(state, heroId, { zone: "setAside" });
  for (const code of instruction.attach) {
    const spawned = spawn(next, code, { zone: "setAside" }, "up");
    next = attachTo(spawned.state, spawned.id, heroId);
  }
  return { ...next, pendingEvents: quiet };
}

/** ReturnSetAsideHero: the set aside hero with the code, and the cards attached to him, come back under the first player. */
export function returnSetAsideHero(state: ScenarioState, instruction: Verb<"ReturnSetAsideHero">): ScenarioState {
  const heroId = state.setAside.find((id) => state.cards[id]?.code === instruction.code);
  const hero = heroId ? state.cards[heroId] : undefined;
  if (!heroId || !hero) return state;
  const seat = state.firstPlayer;
  let next = updateCard(moveCard(state, heroId, { zone: "heroes", seat }), heroId, { face: "up" });
  for (const attachment of hero.attachments) next = updateCard(moveCard(next, attachment, { zone: "play", seat }), attachment, { face: "up" });
  return next;
}

/** SetAsideLogged: one set aside copy of each card the log records under The Black Gate that has the trait. A card the game has no printing of is skipped. */
export function setAsideLogged(state: ScenarioState, instruction: Verb<"SetAsideLogged">, _focus: Focus, ctx: ReduceContext): ScenarioState {
  const recorded = state.campaignFacts?.notes?.blackGate ?? {};
  let next = state;
  for (const [code, count] of Object.entries(recorded)) {
    if (!ctx.cards.has(code) || !printedOf(ctx.cards, code).traits.includes(instruction.trait)) continue;
    for (let copy = 0; copy < count; copy += 1) next = spawn(next, code, { zone: "setAside" }, "down").state;
  }
  return next;
}

/** "X is the number recorded in the campaign log" (145078:A:1): the Corsair Fleet's count, 0 when none is recorded. */
export function recordedCount(state: ScenarioState, which: "corsairFleet" | "blackGateTokens"): number {
  return state.campaignFacts?.notes?.[which] ?? 0;
}

