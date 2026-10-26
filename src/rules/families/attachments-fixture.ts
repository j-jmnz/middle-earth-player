// A small table for the attachments family's tests (attachments*.test.ts): printed cards under the real codes of the cards
// whose records the family authored, a few encounter cards, and helpers that seat the players and build the encounter deck.
import type { Effect } from "../../catalog/boundary.ts";

import { cardMap, expectOk, idleScenario } from "../fixture.ts";
import { definePrinted, type PrintedCard } from "../printed.ts";
import { legalIntents, reduce, type PlayerIntent } from "../reduce.ts";
import { updateCard, withThreat, type ScenarioState } from "../state.ts";
import { spawn } from "../zones.ts";

const attachment = (code: string, name: string, traits: string[], cost = 0, sphere: PrintedCard["sphere"] = "neutral") => definePrinted({ code, name, type: "attachment", sphere, cost, traits });
const heroCard = (code: string, name: string, sphere: PrintedCard["sphere"], traits: string[]) =>
  definePrinted({ code, name, type: "hero", sphere, threat: 9, willpower: 2, attack: 2, defense: 2, health: 5, traits });

export const ATTACHMENT_CARDS = cardMap([
  // Encounter cards.
  definePrinted({ code: "orc", name: "Orc", type: "enemy", threat: 2, engagementCost: 25, attack: 2, defense: 1, health: 3 }),
  definePrinted({ code: "warg", name: "Warg", type: "enemy", threat: 3, engagementCost: 10, attack: 3, defense: 1, health: 4 }),
  definePrinted({ code: "troll", name: "Troll", type: "enemy", threat: 3, engagementCost: 40, attack: 4, defense: 2, health: 9, isUnique: true }),
  definePrinted({ code: "marsh", name: "Marsh", type: "location", threat: 2, questPoints: 3 }),
  definePrinted({ code: "ford", name: "Ford", type: "location", threat: 1, questPoints: 2 }),
  definePrinted({ code: "bog", name: "Bog", type: "location", threat: 1, questPoints: 4 }),
  definePrinted({ code: "mist", name: "Mist", type: "treachery" }),
  definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 20 }),
  definePrinted({ code: "stage1", name: "First Stage", type: "quest", questPoints: 3 }),
  definePrinted({ code: "stage2", name: "Second Stage", type: "quest", questPoints: 10 }),
  // Heroes.
  heroCard("ranger", "Ranger", "lore", ["Dúnedain", "Ranger"]),
  heroCard("hobbit", "Hobbit", "spirit", ["Hobbit"]),
  heroCard("144003", "Damrod", "lore", ["Gondor", "Ranger"]),
  definePrinted({ code: "silvan", name: "Silvan Scout", type: "ally", sphere: "neutral", cost: 0, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Silvan"] }),
  // Player cards with the family's records.
  attachment("04103", "Path of Need", ["Condition"]),
  attachment("05017", "Ranger Spikes", ["Trap"], 2, "lore"),
  attachment("06064", "Ithilien Pit", ["Trap"]),
  attachment("06115", "Poisoned Stakes", ["Trap"]),
  attachment("09012", "Secret Vigil", ["Condition"]),
  attachment("10122", "The Long Defeat", ["Condition"]),
  attachment("10124", "Favor of the Valar", ["Condition"]),
  attachment("11011", "Explorer's Almanac", ["Item"]),
  attachment("12064", "Entangling Nets", ["Trap"]),
  attachment("12088", "Hithlain", ["Item"]),
  definePrinted({ code: "12090", name: "Interrogation", type: "event", sphere: "neutral", cost: 0 }),
  attachment("16012", "The Road Goes Ever On", ["Song"]),
  attachment("17139", "Followed", ["Condition", "Trap"]),
  attachment("19030", "Woodmen's Path", ["Condition"]),
  attachment("19062", "Outmatched", ["Condition", "Trap"]),
  attachment("19117", "Sting", ["Artifact", "Item", "Weapon"]),
  definePrinted({ code: "19147", name: "The King's Return", type: "event", sphere: "neutral", cost: 0 }),
  attachment("19152", "Mithril Shirt", ["Artifact", "Item", "Armor"]),
  attachment("21008", "Put Off Pursuit", ["Condition"]),
  attachment("22006", "Durin's Axe", ["Artifact", "Item", "Weapon"]),
  attachment("132016", "Thrór's Key", ["Artifact", "Item"]),
  attachment("144009", "Ambush", ["Condition", "Trap"]),
]);

// The records of these cards among those a test passes (the tests pass every real record, the effect list's: the family's,
// and the cards' other lines in pool or generated), plus fixture records. The reducer receives effects as an argument and
// never imports them.
export function attachmentCtx(effects: readonly Effect[]) {
  return { effects: effects.filter((effect) => ATTACHMENT_CARDS.has(effect.cardCode)), cards: ATTACHMENT_CARDS };
}

export type Ctx = ReturnType<typeof attachmentCtx>;
export type Table = { state: ScenarioState; heroes: string[] };

// Seats with a Ranger (lore) and a Hobbit (spirit) hero each, 5 resources apiece, the quest stage in place, and the planning
// phase's action window open for the first player.
export function seat(seatCount: 1 | 2 = 1, heroCodes: readonly string[] = ["ranger", "hobbit"], stage = "stage"): Table {
  let state = idleScenario(seatCount, "Planning");
  state = spawn(state, stage, { zone: "questStage" }).state;
  const heroes: string[] = [];
  for (let index = 0; index < seatCount; index += 1) {
    for (const code of heroCodes) {
      const made = spawn(state, code, { zone: "heroes", seat: index });
      state = updateCard(made.state, made.id, { resources: 5 });
      heroes.push(made.id);
    }
    state = withThreat(state, index, 20);
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

export function put(state: ScenarioState, code: string, zone: "hand" | "play" | "staging" | "engaged" | "activeLocation" | "deck" | "questStage", seat = 0): { state: ScenarioState; id: string } {
  if (zone === "staging" || zone === "activeLocation" || zone === "questStage") return spawn(state, code, { zone });
  return spawn(state, code, { zone, seat });
}

// Sends an intent the engine must accept.
export function send(state: ScenarioState, intent: PlayerIntent, ctx: Ctx): ScenarioState {
  return expectOk(reduce(state, intent, ctx)).state;
}

export function offered(state: ScenarioState, ctx: Ctx): PlayerIntent[] {
  return legalIntents(state, ctx) as PlayerIntent[];
}

// Plays a card from the hand for no resources, onto a host when one is named.
export function play(state: ScenarioState, cardId: string, ctx: Ctx, hostId?: string): ScenarioState {
  return send(state, hostId ? { type: "PlayCard", cardId, payments: [], hostId } : { type: "PlayCard", cardId, payments: [] }, ctx);
}

// Passes every look window and chooses `picks` (or the first option) in every choice until no window of an effect is open.
export function resolveChoices(state: ScenarioState, ctx: Ctx, picks: readonly string[] = []): ScenarioState {
  let next = state;
  const queue = [...picks];
  for (let guard = 0; guard < 30; guard += 1) {
    const window = next.window;
    if (window?.kind === "look") next = send(next, { type: "Pass" }, ctx);
    else if (window?.kind === "choose") next = send(next, { type: "Choose", optionId: queue.shift() ?? window.options[0] ?? "" }, ctx);
    else if (window?.kind === "response") {
      const pick = queue[0];
      const trigger = offered(next, ctx).find((intent) => intent.type === "Trigger" && intent.effectId === pick);
      if (trigger) {
        queue.shift();
        next = send(next, trigger, ctx);
      } else next = send(next, { type: "Pass" }, ctx);
    } else return next;
  }
  return next;
}
