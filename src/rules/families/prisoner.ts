// Rules: rr.in-play-and-out-of-play, rr.ownership-and-control, rr.attachment-cards (data/rules/entries.json); ledger lines 01123:B:1,
// 01124:B:1, 01131:A:3, 01131:B:1.
//
// The prisoner of Escape from Dol Guldur: one hero, chosen at random (or named by the Campaign Log), turned facedown with the cards
// attached to it. It is in play but nobody controls it, so it is blank and unusable until it is rescued (the captive zone the Ring-bearer
// under the Watcher uses, families/south-captive.ts). Mendor is captured with it in Campaign Mode and freed by the campaign card.
import type { Instruction } from "../../catalog/boundary.ts";

import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { printedOf } from "../printed.ts";
import { queueEvent } from "../queue.ts";
import type { ScenarioState } from "../state.ts";
import { livingSeats, updateCard } from "../state.ts";
import { shuffleIds } from "../seed.ts";
import { attachTo, moveCard } from "../zones.ts";
import type { Focus } from "./index.ts";
import { captureHero } from "./south-captive.ts";

// The hero that is the prisoner now: facedown in the captive zone under no card. Mendor, captured with it, is held under the hero.
export function prisonerHero(state: ScenarioState): string | null {
  return Object.values(state.cards).find((card) => card.zone === "captive" && card.prisoner === true && card.host == null)?.id ?? null;
}

export function run(state: ScenarioState, instruction: Instruction, _focus: Focus, ctx: ReduceContext, _steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "TakePrisoner":
      return takePrisoner(state, ctx);
    case "SelectLoggedPrisoner":
      return selectLogged(state, ctx);
    case "CaptureWithPrisoner":
      return captureWith(state, instruction.code);
    case "RescuePrisoner":
      return rescuePrisoner(state, instruction.damage);
    case "FreeCaptive":
      return freeCaptive(state, instruction.code, instruction.damage);
    default:
      return null;
  }
}

// The heroes of every living seat, in seat order.
function heroesOf(state: ScenarioState, ctx: ReduceContext): string[] {
  return livingSeats(state).flatMap((seat) => state.seats[seat]?.heroes ?? []).filter((id) => state.cards[id] != null && printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "hero");
}

// TakePrisoner: one of the heroes picked with the game's seed.
function takePrisoner(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (prisonerHero(state)) return state;
  const heroes = heroesOf(state, ctx);
  if (heroes.length === 0) return state;
  const rolled = shuffleIds(heroes, state.seed, state.seedCursor);
  const chosen = rolled.ids[0];
  if (!chosen) return state;
  const next = { ...state, seedCursor: rolled.cursor };
  const seat = next.cards[chosen]?.controller ?? null;
  return queueEvent(captureHero(next, chosen, null, true), { trigger: "prisonerTaken", seat, cardId: chosen, subject: chosen });
}

// SelectLoggedPrisoner: the Campaign Log's prisoner takes the place of the one just selected.
function selectLogged(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const current = prisonerHero(state);
  const named = state.campaignFacts?.prisoner;
  if (!current || !named || state.cards[current]?.code === named) return state;
  const logged = heroesOf(state, ctx).find((id) => state.cards[id]?.code === named);
  if (!logged) return state;
  return captureHero(unholdPrisoner(state, 0), logged, null, true);
}

// CaptureWithPrisoner: the card in play with this code is placed facedown next to the prisoner (held under it): in play, controlled by
// nobody, and it does not leave play.
function captureWith(state: ScenarioState, code: string): ScenarioState {
  const heroId = prisonerHero(state);
  const card = Object.values(state.cards).find((entry) => entry.code === code && entry.zone === "play");
  if (!heroId || !card) return state;
  return updateCard(moveCard(state, card.id, { zone: "captive", hostId: heroId }), card.id, { prisoner: true });
}

// RescuePrisoner: the hero is faceup in its controller's heroes with `damage` damage on it, and the cards attached to it are faceup in
// that player's play area again.
function rescuePrisoner(state: ScenarioState, damage: number): ScenarioState {
  const heroId = prisonerHero(state);
  const seat = heroId ? (state.cards[heroId]?.owner ?? state.firstPlayer) : state.firstPlayer;
  const next = unholdPrisoner(state, damage);
  return heroId && next !== state ? queueEvent(next, { trigger: "prisonerRescued", seat, cardId: heroId, subject: heroId }) : state;
}

// The prisoner and the cards attached to it faceup again, the hero with `damage` damage: no event.
function unholdPrisoner(state: ScenarioState, damage: number): ScenarioState {
  const heroId = prisonerHero(state);
  const hero = heroId ? state.cards[heroId] : undefined;
  if (!heroId || !hero) return state;
  const seat = hero.owner ?? state.firstPlayer;
  const attachments = [...hero.attachments];
  let next = updateCard(moveCard(state, heroId, { zone: "heroes", seat }), heroId, { damage, face: "up", prisoner: undefined, owner: undefined });
  for (const id of attachments) {
    const card = next.cards[id];
    if (!card) continue;
    const owner = card.owner;
    const placed = owner == null ? next : moveCard(next, id, { zone: "play", seat: owner });
    next = attachTo(updateCard(placed, id, { face: "up", prisoner: undefined, owner: undefined }), id, heroId);
  }
  return next;
}

// FreeCaptive: the card captured with the prisoner returns faceup to the first player's play area with `damage` damage on it.
function freeCaptive(state: ScenarioState, code: string, damage: number): ScenarioState {
  const card = Object.values(state.cards).find((entry) => entry.code === code && entry.zone === "captive" && entry.host != null);
  if (!card) return state;
  const seat = state.firstPlayer;
  return updateCard(moveCard(state, card.id, { zone: "play", seat }), card.id, { damage, face: "up", prisoner: undefined, owner: undefined });
}
