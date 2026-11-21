// Rules: mec112.campaign-mode-aragorn, rr.campaign-cards, rr.campaign-pool, rr.fellowship-of-heroes (data/rules/entries.json). The Two Towers' Resolution verbs (src/catalog/families/campaign.ts): a choice between named
// options, what each answer writes, the fallen hero a boon brings back, the heroes a player drops from the Campaign Log, and the enemies recorded from under a card. Each reads the state and
// the log's hero lists (`campaignFacts.heroLog`) and returns the Resolution log; src/rules/setup/resolution.ts opens the windows and calls these.
import type { Instruction } from "../../../catalog/boundary.ts";
import type { Earned, ResolutionLog } from "../../core/campaign-state.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { effectsOf } from "../../windows/listen.ts";
import { inPlay, livingSeats, type ScenarioState } from "../../core/state.ts";
import { fallenAfter, heroesAfter } from "./hero-lists.ts";
import { seatsThatPicked } from "./picks.ts";

type Verb<V extends Instruction["verb"]> = Extract<Instruction, { verb: V }>;

/** The heroes a seat's Campaign Log lists now: the log's, plus the ones a boon brought back, less the ones removed in this Resolution. */
export function loggedHeroes(state: ScenarioState, seat: number): string[] {
  return heroesAfter(state.campaignFacts?.heroLog?.heroes[seat] ?? [], seat, state.resolutionLog);
}

/** The heroes on the list of fallen heroes now: every seat's list, less the ones a boon brought back. */
export function fallenNow(state: ScenarioState): string[] {
  return fallenAfter([...new Set((state.campaignFacts?.heroLog?.fallen ?? []).flat())], state.resolutionLog);
}

/**
 * The heroes a boon may be attached to at a Resolution: with a Trait on its own "Attach to a Warrior hero." line (the Skill boons, 143015:A:2 to 143018:A:2; user ruling C1, 2026-11-08, from the FFG preview "Now May I Make a Right
 * Choice": "Each of these boons can only be attached to a hero with the corresponding trait"), only a hero with it; any other boon takes every hero.
 */
export function boonHeroes(state: ScenarioState, ctx: ReduceContext, code: string, heroes: readonly string[]): string[] {
  const trait = attachTrait(ctx, code);
  if (trait === undefined) return [...heroes];
  // A Trait the hero gains counts, as it does for any Trait check (rr.traits).
  return heroes.filter((id) => hasTrait(state, id, trait, ctx));
}

// The Trait the card's own Setup record names for its host ("Attach to a Warrior hero."), or undefined when it names none.
function attachTrait(ctx: ReduceContext, code: string): string | undefined {
  for (const effect of effectsOf(ctx, code)) {
    if (effect.timing !== "setup") continue;
    for (const instruction of effect.instructions) {
      if (instruction.verb === "AttachSelf" && instruction.to.kind === "hero" && instruction.to.trait) return instruction.to.trait;
    }
  }
  return undefined;
}

/** The options a ChooseOption offers: an option that needs a fallen hero is offered only while the list holds one. */
export function chooseOptionIds(state: ScenarioState, instruction: Verb<"ChooseOption">): string[] {
  const fallen = fallenNow(state).length > 0;
  return instruction.options.filter((option) => option.needsFallen !== true || fallen).map((option) => option.id);
}

/** What a seat's answer to a ChooseOption writes: the pick, under the instruction's name. */
export function applyChooseOption(log: ResolutionLog, instruction: Verb<"ChooseOption">, seat: number, optionId: string): ResolutionLog {
  return { ...log, picks: [...(log.picks ?? []), { name: instruction.name, seat, option: optionId }] };
}

/** ReviveFallenHero: a fallen hero for a living player, `<seat>:<hero code>`. */
export function reviveOptions(state: ScenarioState): string[] {
  const fallen = fallenNow(state);
  return livingSeats(state).flatMap((seat) => fallen.map((hero) => `${seat}:${hero}`));
}

/** The pick of a ReviveFallenHero: the hero leaves the list of fallen heroes and joins the chosen player's heroes, and the boon is earned on it ("attaches Beyond All Hope to it"). */
export function applyRevive(state: ScenarioState, instruction: Verb<"ReviveFallenHero">, optionId: string, step: number): ResolutionLog {
  const [seatText = "", hero = ""] = optionId.split(":");
  const seat = Number(seatText);
  const entry: Earned = { code: instruction.code, to: "hero", seat, hero, step };
  return { ...state.resolutionLog, revived: [...(state.resolutionLog.revived ?? []), { seat, hero }], earned: [...state.resolutionLog.earned, entry] };
}

// The non-Fellowship heroes a seat controls and its log lists now: a hero in a discard pile at the game's end fell (it is on the log's fallen list when the Resolution is written) and is not one the player still has, unless a boon brought it back.
function nonFellowship(state: ScenarioState, seat: number): string[] {
  const fellowship = new Set(state.campaignFacts?.heroLog?.fellowship ?? []);
  const revived = new Set((state.resolutionLog.revived ?? []).map((item) => item.hero));
  const fell = new Set(state.seats.slice(0, state.seatCount).flatMap((zones) => zones.discard.map((id) => state.cards[id]?.code)));
  return loggedHeroes(state, seat).filter((hero) => !fellowship.has(hero) && (!fell.has(hero) || revived.has(hero)));
}

/** The heroes a seat must choose one of to remove: its non-Fellowship heroes while it lists more than `limit`, else none. */
export function trimOptions(state: ScenarioState, seat: number, limit: number): string[] {
  const heroes = nonFellowship(state, seat);
  return heroes.length > limit ? heroes : [];
}

/** The pick of a TrimHeroes: the hero is removed from the seat's log list. */
export function applyTrim(state: ScenarioState, seat: number, hero: string): ResolutionLog {
  return { ...state.resolutionLog, removedHeroes: [...(state.resolutionLog.removedHeroes ?? []), { seat, hero }] };
}

/** ThreatPenaltyForPick: each seat that picked the option takes the permanent penalty. */
export function threatPenalties(state: ScenarioState, instruction: Verb<"ThreatPenaltyForPick">): ResolutionLog {
  const seats = seatsThatPicked(state, instruction.name, instruction.option);
  return seats.length === 0 ? state.resolutionLog : { ...state.resolutionLog, threatPenalties: [...(state.resolutionLog.threatPenalties ?? []), ...seats.map((seat) => ({ seat, amount: instruction.amount }))] };
}

/** EarnForPick: each seat that picked the option earns a copy of each card, shuffled into its deck after the starting hand later. */
export function earnForPick(state: ScenarioState, instruction: Verb<"EarnForPick">): Earned[] {
  return seatsThatPicked(state, instruction.name, instruction.option).flatMap((seat) => instruction.codes.map((code) => ({ code, to: "pool" as const, seat, hero: null, step: state.resolutionAt, perPlayer: true, afterHand: true as const })));
}

/** EarnHeldCopies: each seat holding a copy in its hand, deck or discard pile earns the burden, shuffled into its deck after the starting hand later. */
export function earnHeldCopies(state: ScenarioState, instruction: Verb<"EarnHeldCopies">): Earned[] {
  const out: Earned[] = [];
  for (let seat = 0; seat < state.seatCount; seat += 1) {
    const zones = state.seats[seat];
    if (!zones) continue;
    const ids = [...zones.hand, ...zones.deck, ...zones.discard];
    for (const code of instruction.codes) {
      if (ids.some((id) => state.cards[id]?.code === code)) out.push({ code, to: "pool", seat, hero: null, step: state.resolutionAt, perPlayer: true, afterHand: true });
    }
  }
  return out;
}

/** RecordUnderneath: the cards facedown under the card in play with this code, by card code and quantity. */
export function underneath(state: ScenarioState, code: string): Record<string, number> {
  const holders = new Set(Object.values(state.cards).filter((card) => card.code === code && inPlay(card.zone)).map((card) => card.id));
  const tally: Record<string, number> = {};
  for (const card of Object.values(state.cards)) {
    if (card.zone === "under" && card.host != null && holders.has(card.host)) tally[card.code] = (tally[card.code] ?? 0) + 1;
  }
  return tally;
}
