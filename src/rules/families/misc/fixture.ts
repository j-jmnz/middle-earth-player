// A small table for the misc family's tests (misc*.test.ts): the play family's table, plus printed cards under the real codes of
// the cards whose records the misc family authored.
import type { Effect } from "../../../catalog/boundary.ts";

import { definePrinted, type PrintedCard } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { attachTo } from "../../core/zones.ts";
import { PLAY_CARDS } from "../play/fixture.ts";

type Sphere = PrintedCard["sphere"];

const ally = (code: string, name: string, sphere: Sphere, traits: string[] = [], extra: Partial<Parameters<typeof definePrinted>[0]> = {}) =>
  definePrinted({ code, name, type: "ally", sphere, cost: 2, willpower: 1, attack: 1, defense: 1, health: 3, traits, ...extra });
const event = (code: string, name: string, sphere: Sphere, extra: Partial<Parameters<typeof definePrinted>[0]> = {}) => definePrinted({ code, name, type: "event", sphere, cost: 0, ...extra });
const attachment = (code: string, name: string, sphere: Sphere, traits: string[] = [], extra: Partial<Parameters<typeof definePrinted>[0]> = {}) =>
  definePrinted({ code, name, type: "attachment", sphere, cost: 0, traits, ...extra });
const heroCard = (code: string, name: string, sphere: Sphere, traits: string[], extra: Partial<Parameters<typeof definePrinted>[0]> = {}) =>
  definePrinted({ code, name, type: "hero", sphere, threat: 9, willpower: 2, attack: 2, defense: 2, health: 5, traits, isUnique: true, ...extra });

const EXTRA: PrintedCard[] = [
  // Plain cards.
  attachment("wound", "Wound", null, ["Condition"]),
  definePrinted({ code: "grunt", name: "Grunt", type: "enemy", threat: 1, engagementCost: 10, attack: 2, defense: 1, health: 4, traits: ["Orc"] }),
  definePrinted({ code: "brute", name: "Brute", type: "enemy", threat: 1, engagementCost: 10, attack: 2, defense: 0, health: 4, traits: ["Orc"] }),
  // The family's cards.
  ally("01061", "Miner of the Iron Hills", "neutral", ["Dwarf"]),
  event("01068", "Beorn's Hospitality", "neutral"),
  event("02058", "Infighting", "neutral"),
  ally("02073", "Keen-eyed Took", "neutral", ["Hobbit"]),
  ally("02102", "Silvan Tracker", "neutral", ["Silvan"]),
  ally("04083", "Warden of Healing", "neutral", ["Noldor"]),
  heroCard("04128", "Elrond", "lore", ["Noldor", "Noble"]),
  attachment("09011", "Athelas", "neutral", ["Item"]),
  ally("10147", "Galadhrim Healer", "neutral", ["Silvan"]),
  heroCard("11001", "Círdan the Shipwright", "leadership", ["Noldor", "Noble"]),
  ally("22111", "Dale Messenger", "neutral", ["Dale"]),
  ally("142005", "Elrond", "neutral", ["Noldor", "Noble"], { isUnique: true }),
  // Constants and events.
  ally("19002", "Guardian of Esgaroth", "neutral", ["Dale"], { willpower: 0, attack: 0, defense: 0, health: 1 }),
  ally("19033", "Wild Stallion", "neutral", ["Creature"], { willpower: 0, attack: 1, defense: 1, health: 2 }),
  attachment("item1", "Trinket", "neutral", ["Item"]),
  attachment("item2", "Charm", "neutral", ["Item"]),
  attachment("04005", "Keeping Count", "neutral", []),
  heroCard("132005", "Bombur", "tactics", ["Dwarf"]),
  heroCard("22027", "Lothíriel", "spirit", ["Gondor", "Noble"]),
  heroCard("07001", "Éomer", "tactics", ["Rohan", "Noble"]),
  event("05005", "Mutual Accord", "neutral"),
  attachment("12034", "Raiment of War", "neutral", ["Item", "Armor", "Weapon"], { keywords: { restricted: true } }),
  attachment("restricted1", "Restricted One", "neutral", ["Item"], { keywords: { restricted: true } }),
  attachment("restricted2", "Restricted Two", "neutral", ["Item"], { keywords: { restricted: true } }),
  attachment("144010", "Snowmane", "neutral", ["Mount"], { keywords: { restricted: true } }),
  heroCard("06134", "Théoden", "spirit", ["Rohan", "Noble"]),
  event("17064", "The Free Peoples", "neutral"),
  heroCard("18001", "Brand son of Bain", "leadership", ["Dale", "Noble"]),
  ally("dale", "Dale Archer", "neutral", ["Dale"]),
  event("02080", "Gildor's Counsel", "neutral"),
  event("08010", "The White Council", "neutral", { cost: null, costX: true }),
  attachment("08034", "Leaf Brooch", "neutral", ["Item"]),
  event("secret", "Secret Event", "spirit", { cost: 2 }),
  event("06010", "A Good Harvest", "neutral"),
  event("06143", "Hidden Cache", "neutral"),
  event("10146", "Tale of Tinúviel", "neutral"),
  ally("noldor", "Noldor Ally", "neutral", ["Noldor"], { willpower: 3 }),
  ally("dunedain", "Dúnedain Ally", "neutral", ["Dúnedain"], { willpower: 1 }),
  event("12061", "Revealed in Wrath", "neutral"),
  attachment("131012", "Spare Hood and Cloak", "neutral", ["Item"]),
  event("132009", "Straight Shot", "neutral"),
  attachment("sword", "Short Sword", "neutral", ["Item", "Weapon"]),
  attachment("142013", "Glamdring", "neutral", ["Artifact", "Item", "Weapon"], { keywords: { restricted: true } }),
  heroCard("gandalf", "Gandalf", "lore", ["Istari"]),
  attachment("21001", "The One Ring", "neutral", ["Artifact", "Ring", "Master"], { keywords: { restricted: true } }),
  attachment("22033", "Strength and Courage", "neutral", ["Master"]),
  attachment("22009", "Inner Strength", "neutral", ["Master"]),
  attachment("22085", "Well Preserved", "neutral", ["Master"]),
  attachment("142011", "Sting", "neutral", ["Artifact", "Item", "Weapon"], { keywords: { restricted: true } }),
  event("04105", "Heavy Stroke", "neutral"),
  // The Ring and the saga.
  event("21009", "The Master Ring", "neutral", { traits: ["Master"] }),
  event("21010", "The Ruling Ring", "neutral", { traits: ["Master"] }),
  event("21011", "The Ring of Power", "neutral", { traits: ["Master"] }),
  event("master", "A Master Card", "neutral", { traits: ["Master"] }),
  heroCard("142001", "Frodo Baggins", "fellowship", ["Hobbit", "Ring-bearer"]),
  attachment("142091", "The One Ring (saga)", "neutral", ["Artifact", "Item", "Ring"]),
  heroCard("131001", "Bilbo Baggins", "baggins", ["Hobbit"]),
  heroCard("132001", "Bilbo Baggins", "baggins", ["Hobbit", "Burglar"]),
  event("131019", "Burglar Baggins", "baggins", { cost: 1 }),
  event("gift", "Gift", "neutral"),
  definePrinted({ code: "trove", name: "Trove", type: "treasure" }),
  event("132013", "The Lucky Number", "neutral"),
  definePrinted({ code: "treasure1", name: "A Treasure", type: "treasure", traits: ["Treasure"] }),
  heroCard("143001", "Aragorn", "leadership", ["Dúnedain", "Noble", "Ranger"]),
  heroCard("146002", "Aragorn", "leadership", ["Dúnedain", "Gondor", "Noble", "Warrior"]),
  event("144013", "Speak Your Promise!", "neutral"),
  heroCard("21072", "Sméagol", "lore", ["Gollum"]),
  definePrinted({ code: "21071", name: "Stinker", type: "treasure" }),
  attachment("146012", "Friend of Friends", "neutral", ["Condition"]),
];

export const MISC_CARDS: ReadonlyMap<string, PrintedCard> = new Map([...PLAY_CARDS, ...EXTRA.map((card) => [card.code, card] as const)]);

export function miscCtx(effects: readonly Effect[]) {
  return { effects, cards: MISC_CARDS };
}

export type MiscCtx = ReturnType<typeof miscCtx>;

// Puts `attachmentId` on `hostId`.
export function attach(state: ScenarioState, attachmentId: string, hostId: string): ScenarioState {
  return attachTo(state, attachmentId, hostId);
}

// The options of the choose window that is open, or none.
export function choices(state: ScenarioState): string[] {
  return state.window?.kind === "choose" ? [...state.window.options] : [];
}

export function damage(state: ScenarioState, id: string, amount: number): ScenarioState {
  return updateCard(state, id, { damage: amount });
}
