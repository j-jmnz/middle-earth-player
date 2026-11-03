// A small table for the play family's tests (play*.test.ts): printed cards under the real codes of the cards whose records the
// family authored, a few heroes and encounter cards, and helpers that seat the players and drive the reducer.
import type { Effect } from "../../../catalog/boundary.ts";

import { cardMap, expectOk, idleScenario } from "../../fixture.ts";
import { settle } from "../../machine.ts";
import { definePrinted, type PrintedCard } from "../../printed.ts";
import { legalIntents, reduce, type PlayerIntent } from "../../reduce.ts";
import { expireModifiers, updateCard, type ScenarioState } from "../../state.ts";
import { spawn } from "../../zones.ts";

type Sphere = PrintedCard["sphere"];

const ally = (code: string, name: string, sphere: Sphere, traits: string[] = [], extra: Partial<Parameters<typeof definePrinted>[0]> = {}) =>
  definePrinted({ code, name, type: "ally", sphere, cost: 2, willpower: 1, attack: 1, defense: 1, health: 3, traits, ...extra });
const event = (code: string, name: string, sphere: Sphere, extra: Partial<Parameters<typeof definePrinted>[0]> = {}) => definePrinted({ code, name, type: "event", sphere, cost: 0, ...extra });
const attachment = (code: string, name: string, sphere: Sphere, traits: string[] = []) => definePrinted({ code, name, type: "attachment", sphere, cost: 0, traits });
const heroCard = (code: string, name: string, sphere: Sphere, traits: string[]) =>
  definePrinted({ code, name, type: "hero", sphere, threat: 9, willpower: 2, attack: 2, defense: 2, health: 5, traits, isUnique: true });

export const PLAY_CARDS = cardMap([
  // Heroes.
  heroCard("dwarf", "Dain", "leadership", ["Dwarf", "Noble"]),
  heroCard("rohan", "Theodred", "spirit", ["Rohan", "Noble", "Warrior"]),
  heroCard("ranger", "Aragorn", "leadership", ["Dúnedain", "Ranger"]),
  heroCard("gondor", "Boromir", "tactics", ["Gondor", "Warrior"]),
  heroCard("lore", "Bilbo", "lore", ["Hobbit"]),
  heroCard("18002", "Bard son of Brand", "tactics", ["Dale", "Noble"]),
  heroCard("22108", "Gwaihir", "tactics", ["Creature", "Eagle"]),
  // Encounter cards.
  definePrinted({ code: "orc", name: "Orc", type: "enemy", threat: 2, engagementCost: 25, attack: 2, defense: 1, health: 3 }),
  definePrinted({ code: "marsh", name: "Marsh", type: "location", threat: 2, questPoints: 3 }),
  definePrinted({ code: "ford", name: "Ford", type: "location", threat: 1, questPoints: 2 }),
  definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 20 }),
  // Plain player cards.
  ally("helper", "Helper", "leadership", ["Gondor"]),
  ally("eagle", "Eagle Scout", "tactics", ["Creature", "Eagle"]),
  ally("rider", "Westfold Rider", "spirit", ["Rohan"], { cost: 1 }),
  ally("cheap", "Cheap Ally", "leadership", ["Gondor"], { cost: 1 }),
  ally("dear", "Dear Ally", "leadership", ["Gondor"], { cost: 4 }),
  attachment("blade", "Blade", "tactics", ["Item"]),
  event("filler", "Filler", "neutral"),
  // The family's cards.
  ally("01019", "Brok Ironfist", "leadership", ["Dwarf", "Warrior"], { isUnique: true }),
  ally("02053", "Landroval", "tactics", ["Creature", "Eagle"], { isUnique: true }),
  ally("02119", "Eagles of the Misty Mountains", "tactics", ["Creature", "Eagle"], { isUnique: true }),
  ally("03006", "Veteran of Nanduhirion", "tactics", ["Dwarf"]),
  ally("04006", "Bofur", "spirit", ["Dwarf"], { isUnique: true, willpower: 2 }),
  ally("04033", "Rider of the Mark", "spirit", ["Rohan"]),
  ally("05016", "Master of Lore", "lore", ["Noldor"]),
  ally("06057", "Denethor", "leadership", ["Gondor", "Noble"], { isUnique: true }),
  event("08003", "Swift and Silent", "lore"),
  ally("08006", "Blue Mountain Trader", "leadership", ["Dwarf"]),
  event("08033", "Noiseless Movement", "lore"),
  ally("08057", "Herald of Anórien", "leadership", ["Gondor"]),
  event("08061", "Courage Awakened", "spirit"),
  event("08085", "Follow Me!", "leadership"),
  attachment("08093", "Defender of the West", "leadership"),
  ally("10006", "Curious Brandybuck", "spirit", ["Hobbit"]),
  ally("10010", "Ranger of Cardolan", "leadership", ["Dúnedain", "Ranger"]),
  ally("10033", "Elven Jeweler", "lore", ["Noldor"]),
  event("10085", "Reinforcements", "leadership"),
  ally("10141", "Éothain", "tactics", ["Rohan"], { isUnique: true }),
  attachment("10149", "Sword-thain", "leadership", ["Title"]),
  event("12011", "Vanish from Sight", "spirit"),
  ally("12058", "Ceorl", "spirit", ["Rohan"], { isUnique: true }),
  ally("12083", "Dwarven Sellsword", "leadership", ["Dwarf"]),
  ally("17035", "Eryn Galen Settler", "spirit", ["Silvan"]),
  attachment("22035", "Horn of the Mark", "spirit", ["Item"]),
  event("22056", "Horns! Horns! Horns!", "leadership"),
  ally("22057", "Soldier of Isengard", "leadership", ["Dunland"], { keywords: { doomed: 2 } }),
  ally("22117", "Wilyador", "spirit", ["Creature", "Eagle"], { isUnique: true }),
  event("132010", "Desperate Alliance", "leadership"),
  ally("145005", "Prince Imrahil", "leadership", ["Gondor", "Noble"], { isUnique: true, cost: 3 }),
  ally("144007", "Gamling", "spirit", ["Rohan"], { isUnique: true }),
  ally("146006", "Elfhelm", "spirit", ["Rohan"], { isUnique: true }),
]);

// The records a test runs on these cards: the tests pass the family's real records, since the reducer receives effects as an
// argument and never imports them.
export function playCtx(effects: readonly Effect[]) {
  return { effects, cards: PLAY_CARDS };
}

export type Ctx = ReturnType<typeof playCtx>;
export type Table = { state: ScenarioState; heroes: string[] };

// Seats with the given heroes each (5 resources apiece), the quest stage in place, and the planning phase's action window open
// for the first player.
export function seat(seatCount: 1 | 2 = 1, heroCodes: readonly string[] = ["dwarf", "rohan"]): Table {
  let state = idleScenario(seatCount, "Planning");
  state = spawn(state, "stage", { zone: "questStage" }).state;
  const heroes: string[] = [];
  for (let index = 0; index < seatCount; index += 1) {
    for (const code of heroCodes) {
      const made = spawn(state, code, { zone: "heroes", seat: index });
      state = updateCard(made.state, made.id, { resources: 5 });
      heroes.push(made.id);
    }
  }
  return { state: { ...state, mode: "planning", phase: "Planning", boundaryPhase: "Planning", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0, round: 1 }, heroes };
}

export function put(state: ScenarioState, code: string, zone: "hand" | "play" | "deck" | "discard" | "heroes" | "staging" | "engaged" | "activeLocation", seat = 0): { state: ScenarioState; id: string } {
  if (zone === "staging" || zone === "activeLocation") return spawn(state, code, { zone });
  return spawn(state, code, { zone, seat });
}

// Sends an intent the engine must accept.
export function send(state: ScenarioState, intent: PlayerIntent, ctx: Ctx): ScenarioState {
  return expectOk(reduce(state, intent, ctx)).state;
}

export function offered(state: ScenarioState, ctx: Ctx): PlayerIntent[] {
  return legalIntents(state, ctx) as PlayerIntent[];
}

export function trigger(state: ScenarioState, cardId: string, effectId: string, ctx: Ctx, payments: { heroId: string; amount: number }[] = []): ScenarioState {
  return send(state, { type: "Trigger", cardId, effectId, ...(payments.length > 0 ? { payments } : {}) }, ctx);
}

// Plays a card from the hand, for no resources unless payments are named.
export function play(state: ScenarioState, cardId: string, ctx: Ctx, payments: { heroId: string; amount: number }[] = [], hostId?: string): ScenarioState {
  return send(state, { type: "PlayCard", cardId, payments, ...(hostId ? { hostId } : {}) }, ctx);
}

// The phase changes to `phase` with nothing else moving: the delayed and Forced effects of the one that ended resolve.
// Lasting effects that end with the phase (and the round, into a new one) end first, as withMode ends them.
export function crossTo(state: ScenarioState, phase: ScenarioState["phase"], ctx: Ctx): ScenarioState {
  const moved: ScenarioState = { ...state, window: null, mode: "stopped", phase };
  return settle(expireModifiers(moved, phase === "Beginning of round" ? ["endOfPhase", "endOfRound"] : ["endOfPhase"]), ctx, []);
}

// Runs the engine until it waits on a player (the queued events are announced).
export function run(state: ScenarioState, ctx: Ctx): ScenarioState {
  return settle(state, ctx, []);
}

// The Trigger intents offered for one effect record.
export function triggers(state: ScenarioState, ctx: Ctx, effectId: string): PlayerIntent[] {
  return offered(state, ctx).filter((intent) => intent.type === "Trigger" && intent.effectId === effectId);
}

// Passes every Response window until none is open.
export function passResponses(state: ScenarioState, ctx: Ctx): ScenarioState {
  let next = state;
  for (let guard = 0; guard < 20 && next.window?.kind === "response"; guard += 1) next = send(next, { type: "Pass" }, ctx);
  return next;
}
