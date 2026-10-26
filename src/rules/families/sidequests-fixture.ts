// A small table for the sidequests family's tests (sidequests*.test.ts): the printed cards under the real codes of the cards whose
// records the family authored, and helpers that put side quests and cards in the victory display.
import type { Effect } from "../../catalog/boundary.ts";

import { syncConstants } from "../constants.ts";
import { cardMap } from "../fixture.ts";
import { definePrinted, type PrintedCard } from "../printed.ts";
import type { ScenarioState } from "../state.ts";
import { updateCard } from "../state.ts";
import { moveCard } from "../zones.ts";
import { PLAY_CARDS, put, run, send } from "./play-fixture.ts";

export { crossTo, offered, passResponses, play, put, run, seat, send, trigger, triggers, type Table } from "./play-fixture.ts";

type Sphere = PrintedCard["sphere"];

const quest = (code: string, name: string, sphere: Sphere, cost: number, questPoints: number, extra: Partial<Parameters<typeof definePrinted>[0]> = {}) =>
  definePrinted({ code, name, type: "player-side-quest", sphere, cost, questPoints, victory: 1, ...extra });
const ally = (code: string, name: string, sphere: Sphere, traits: string[] = [], extra: Partial<Parameters<typeof definePrinted>[0]> = {}) =>
  definePrinted({ code, name, type: "ally", sphere, cost: 2, willpower: 1, attack: 1, defense: 1, health: 3, traits, ...extra });
const event = (code: string, name: string, sphere: Sphere, cost = 0, extra: Partial<Parameters<typeof definePrinted>[0]> = {}) => definePrinted({ code, name, type: "event", sphere, cost, ...extra });
const hero = (code: string, name: string, sphere: Sphere, traits: string[], extra: Partial<Parameters<typeof definePrinted>[0]> = {}) =>
  definePrinted({ code, name, type: "hero", sphere, threat: 8, willpower: 2, attack: 2, defense: 2, health: 4, traits, isUnique: true, ...extra });

export const SIDE_CARDS: ReadonlyMap<string, PrintedCard> = new Map([
  ...PLAY_CARDS,
  ...cardMap([
    // Player side quests.
    quest("09014", "Gather Information", "neutral", 0, 4),
    quest("10009", "Scout Ahead", "lore", 0, 4),
    quest("10034", "Double Back", "spirit", 0, 4),
    quest("10058", "Delay the Enemy", "tactics", 0, 8),
    quest("10086", "Send for Aid", "leadership", 1, 6),
    quest("16013", "The Storm Comes", "neutral", 0, 5),
    quest("17003", "Prepare for Battle", "leadership", 1, 6),
    quest("17036", "Explore Secret Ways", "lore", 1, 6, { victory: null }),
    quest("17059", "Keep Watch", "tactics", 1, 6),
    quest("17087", "Rally the West", "spirit", 1, 6),
    // Cards that read the victory display.
    event("10035", "Leave No Trace", "lore", 1),
    event("10037", "Keen as Lances", "neutral", 5),
    event("16009", "Dour Handed", "tactics", 1),
    ally("16006", "Vigilant Dúnadan", "tactics", ["Dúnedain", "Ranger"], { cost: 4, attack: 3, defense: 2 }),
    ally("17060", "Rider of Rohan", "spirit", ["Rohan", "Scout"], { cost: 3, willpower: 2, attack: 2, defense: 0, health: 2 }),
    ally("10008", "East Road Ranger", "lore", ["Dúnedain", "Scout"], { cost: 3, willpower: 1, attack: 2, health: 3 }),
    hero("scout", "Scout", "tactics", ["Ranger"], { willpower: 1, attack: 3 }),
    hero("10028", "Rossiel", "lore", ["Silvan"], { threat: 8, willpower: 2, attack: 1, defense: 2, health: 3 }),
    // Encounter cards.
    definePrinted({ code: "silvan-location", name: "Silvan Glade", type: "location", threat: 2, questPoints: 3, victory: 2, traits: ["Forest"] }),
    definePrinted({ code: "marsh-copy", name: "Marsh", type: "location", threat: 2, questPoints: 3, traits: ["Marsh"] }),
    definePrinted({ code: "forest-orc", name: "Forest Orc", type: "enemy", threat: 1, engagementCost: 20, attack: 3, defense: 1, health: 3, victory: 1, traits: ["Orc", "Forest"] }),
    definePrinted({ code: "wolf", name: "Wolf", type: "enemy", threat: 1, engagementCost: 30, attack: 2, defense: 1, health: 3, traits: ["Creature"] }),
    definePrinted({ code: "wolf2", name: "Wolf", type: "enemy", threat: 1, engagementCost: 30, attack: 2, defense: 1, health: 3, traits: ["Creature"] }),
    definePrinted({ code: "plot", name: "Plot", type: "objective" }),
  ]),
]);

export function sideCtx(effects: readonly Effect[]) {
  return { effects, cards: SIDE_CARDS };
}

export type SideCtx = ReturnType<typeof sideCtx>;

// A card straight into the victory display, as if added by an effect.
export function toVictory(state: ScenarioState, id: string): ScenarioState {
  return updateCard(moveCard(state, id, { zone: "victory" }), id, { face: "up" });
}

// The table at the commit step of the quest phase: the first seat's window is open.
export function questing(state: ScenarioState): ScenarioState {
  return { ...state, mode: "questCommit", phase: "Quest", boundaryPhase: "Quest", window: { kind: "pass" }, activeSeat: 0, passed: [], planningSeat: null };
}

// A side quest already in a seat's quest area.
export function questArea(state: ScenarioState, code: string, seatIndex = 0) {
  const made = put(state, code, "hand", seatIndex);
  return { ...made, state: moveCard(made.state, made.id, { zone: "seatQuest", seat: seatIndex }) };
}

// Every seat passes the commit window of the quest phase.
export function passQuestWindow(state: ScenarioState, ctx: SideCtx): ScenarioState {
  let next = state;
  for (let guard = 0; guard < 4 && next.mode === "questCommit"; guard += 1) next = send(next, { type: "Pass" }, ctx);
  return next;
}

// The records read by the constants: rebuilt as the reducer does at the end of every step.
export function synced(state: ScenarioState, ctx: SideCtx): ScenarioState {
  return syncConstants(run(state, ctx), ctx);
}

// A card of this code put into the victory display, with its constants in force.
export function inVictory(state: ScenarioState, code: string, ctx: SideCtx) {
  const made = put(state, code, "play");
  return { ...made, state: synced(toVictory(made.state, made.id), ctx) };
}
