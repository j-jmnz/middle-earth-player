// A small table for the encounter family's tests (encounter*.test.ts): printed cards under the real codes of the cards whose
// records the family authored, a few encounter cards, and helpers that seat the players and build the encounter deck.
import type { Effect } from "../../../catalog/boundary.ts";

import { cardMap, expectOk, idleScenario } from "../../fixture.ts";
import { definePrinted, type PrintedCard } from "../../printed.ts";
import { legalIntents, reduce, type PlayerIntent } from "../../reduce.ts";
import { updateCard, type ScenarioState } from "../../state.ts";
import { spawn } from "../../zones.ts";

const ally = (code: string, name: string, sphere: PrintedCard["sphere"], traits: string[] = []) =>
  definePrinted({ code, name, type: "ally", sphere, cost: 0, willpower: 1, attack: 1, defense: 1, health: 2, traits });
const event = (code: string, name: string, sphere: PrintedCard["sphere"]) => definePrinted({ code, name, type: "event", sphere, cost: 0 });
const attachment = (code: string, name: string, sphere: PrintedCard["sphere"]) => definePrinted({ code, name, type: "attachment", sphere, cost: 0 });
const heroCard = (code: string, name: string, sphere: PrintedCard["sphere"], traits: string[]) =>
  definePrinted({ code, name, type: "hero", sphere, threat: 9, willpower: 2, attack: 2, defense: 2, health: 5, traits });

export const ENCOUNTER_CARDS = cardMap([
  // Encounter cards.
  definePrinted({ code: "orc", name: "Orc", type: "enemy", threat: 2, engagementCost: 25, attack: 2, defense: 1, health: 3 }),
  definePrinted({ code: "troll", name: "Troll", type: "enemy", threat: 3, engagementCost: 40, attack: 4, defense: 2, health: 9, isUnique: true }),
  definePrinted({ code: "marsh", name: "Marsh", type: "location", threat: 2, questPoints: 3 }),
  definePrinted({ code: "ford", name: "Ford", type: "location", threat: 1, questPoints: 2 }),
  definePrinted({ code: "keep", name: "Keep", type: "location", threat: 4, questPoints: 4, victory: 2, isUnique: true }),
  definePrinted({ code: "mist", name: "Mist", type: "treachery" }),
  definePrinted({ code: "gust", name: "Gust", type: "treachery", keywords: { surge: true } }),
  definePrinted({ code: "relic", name: "Relic", type: "objective" }),
  definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 20 }),
  // Heroes.
  heroCard("ranger", "Ranger", "lore", ["Dúnedain", "Ranger", "Scout"]),
  heroCard("hobbit", "Hobbit", "spirit", ["Hobbit"]),
  heroCard("01008", "Eleanor", "spirit", ["Gondor"]),
  heroCard("01010", "Denethor", "lore", ["Gondor"]),
  heroCard("elrond", "Elrond", "lore", ["Noldor"]),
  // Player cards with the family's records.
  event("02009", "Strider's Path", "lore"),
  event("02080", "Gildor's Counsel", "lore"),
  event("02124", "Rumour from the Earth", "lore"),
  event("02125", "Shadow of the Past", "neutral"),
  event("04009", "Needful to Know", "lore"),
  event("04037", "The End Comes", "neutral"),
  event("04060", "Short Cut", "lore"),
  ally("04102", "Longbeard Elder", "lore", ["Dwarf"]),
  event("04132", "A Elbereth! Gilthoniel!", "spirit"),
  event("04136", "Risk Some Light", "lore"),
  attachment("04137", "Vilya", "neutral"),
  event("05012", "A Watchful Peace", "spirit"),
  ally("05015", "Ithilien Tracker", "lore", ["Gondor", "Ranger"]),
  ally("06061", "Minas Tirith Lampwright", "spirit", ["Gondor"]),
  attachment("06090", "Palantir", "neutral"),
  ally("08008", "Ithilien Lookout", "lore", ["Gondor", "Ranger"]),
  attachment("08031", "Warden of Arnor", "spirit"),
  event("08062", "Free to Choose", "spirit"),
  ally("08089", "Celduin Traveler", "spirit", ["Dale", "Scout"]),
  attachment("08092", "Wingfoot", "lore"),
  ally("09004", "Dúnedain Hunter", "lore", ["Dúnedain", "Ranger"]),
  event("10036", "Distant Stars", "lore"),
  event("10123", "Quick Ears", "lore"),
  attachment("11008", "Mariner's Compass", "lore"),
  event("131018", "Expecting Mischief", "lore"),
  event("132011", "Ravens of the Mountain", "lore"),
  attachment("142011", "Sting", "neutral"),
  ally("143004", "Gimli", "lore", ["Dwarf"]),
  event("17005", "Wait no Longer", "lore"),
  ally("17008", "Firyal", "lore", ["Harad", "Scout"]),
  ally("17033", "Dunedain Pathfinder", "spirit", ["Dunedain", "Scout"]),
  event("17057", "Hunting Party", "lore"),
  event("19007", "The Hidden Way", "lore"),
  event("21007", "The Gathering Storm", "lore"),
  ally("22004", "Cautious Halfling", "lore", ["Hobbit"]),
  event("22058", "Far-sighted", "lore"),
  event("22114", "Bilbo's Plan", "lore"),
  event("22145", "A Desperate Path", "spirit"),
  ally("helper", "Helper", "lore"),
]);

// The records a test runs on these cards. The tests pass the family's real records: the reducer receives effects as an
// argument and never imports them.
export function encounterCtx(effects: readonly Effect[]) {
  return { effects, cards: ENCOUNTER_CARDS };
}

export type Table = { state: ScenarioState; heroes: string[] };

// Seats with a Ranger (lore) and a Hobbit (spirit) hero each, 5 resources apiece, the quest stage in place, and the planning
// phase's action window open for the first player.
export function seat(seatCount: 1 | 2 = 1, heroCodes: readonly string[] = ["ranger", "hobbit"]): Table {
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

// The encounter deck, top card first.
export function deck(state: ScenarioState, codes: readonly string[]): { state: ScenarioState; ids: string[] } {
  let next = state;
  const ids: string[] = [];
  for (const code of codes) {
    const made = spawn(next, code, { zone: "encounterDeck" }, "down");
    next = made.state;
    ids.push(made.id);
  }
  return { state: next, ids };
}

export function put(state: ScenarioState, code: string, zone: "hand" | "play" | "staging" | "engaged" | "encounterDiscard" | "activeLocation" | "deck", seat = 0): { state: ScenarioState; id: string } {
  if (zone === "staging" || zone === "encounterDiscard" || zone === "activeLocation") return spawn(state, code, { zone });
  return spawn(state, code, { zone, seat });
}

// Sends an intent the engine must accept and offer.
export function send(state: ScenarioState, intent: PlayerIntent, ctx: ReturnType<typeof encounterCtx>): ScenarioState {
  return expectOk(reduce(state, intent, ctx)).state;
}

export function offered(state: ScenarioState, ctx: ReturnType<typeof encounterCtx>): PlayerIntent[] {
  return legalIntents(state, ctx) as PlayerIntent[];
}

// Plays an event (or an ally) from the hand for no resources.
export function play(state: ScenarioState, cardId: string, ctx: ReturnType<typeof encounterCtx>): ScenarioState {
  return send(state, { type: "PlayCard", cardId, payments: [] }, ctx);
}

// Passes every look window and chooses `pick` (or the first option) in every choice until no window of the effect is open.
export function resolveChoices(state: ScenarioState, ctx: ReturnType<typeof encounterCtx>, picks: readonly string[] = []): ScenarioState {
  let next = state;
  const queue = [...picks];
  for (let guard = 0; guard < 20; guard += 1) {
    const window = next.window;
    if (window?.kind === "look") next = send(next, { type: "Pass" }, ctx);
    else if (window?.kind === "choose") next = send(next, { type: "Choose", optionId: queue.shift() ?? window.options[0] ?? "" }, ctx);
    else return next;
  }
  return next;
}
