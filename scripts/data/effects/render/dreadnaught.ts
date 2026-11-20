// The pieces The Hunt for the Dreadnaught adds (the sea family's Pillage, PickFewestHitPoints, EngageRandomSetAside, EliminateWithoutShip, GainHeroTraits and FlipShip): templates and the samples read-fields-samples.ts checks them with.
import { type Obj, str } from "./kit.ts";

type Made = { text: string; read: readonly string[] };

export const DREADNAUGHT_TEMPLATES: Readonly<Record<string, (i: Obj) => Made>> = {
  Pillage: () => ({ text: "the acting player discards the top cards of their deck, one at a time, as many as the Pillage value says; each event card among them is announced to the enemy's Forced effects", read: [] }),
  PickFewestHitPoints: () => ({ text: "pick the Ship enemy or Ship objective in play, any player's, with the fewest hit points left (the first player chooses among ties)", read: [] }),
  EngageRandomSetAside: (i) => ({ text: `put 1 set-aside unique ${str(i.trait)} enemy chosen at random into play engaged with the acting player, not revealed and dealt no shadow card`, read: ["trait"] }),
  EliminateWithoutShip: () => ({ text: "a player who controls no ship-objective is eliminated from the game (checked once the fleet is prepared)", read: [] }),
  GainHeroTraits: () => ({ text: "the first picked hero gains the printed Traits of the last picked hero until the end of the game", read: [] }),
  AddEventsToHand: (i) => ({ text: `the acting player chooses up to ${str(i.upTo)} events, one at a time, from their discard pile and from their collection (never a third copy of a title they hold 3 of) and adds them to their hand; they may stop`, read: ["upTo"] }),
  FlipShip: () => ({ text: "the picked Ship objective flips to its Upgraded side, if it shows its Basic side and has an Upgraded side", read: [] }),
};

export const DREADNAUGHT_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  Pillage: [{ verb: "Pillage", amount: 2 }],
  PickFewestHitPoints: [{ verb: "PickFewestHitPoints" }],
  EngageRandomSetAside: [{ verb: "EngageRandomSetAside", trait: "Corsair" }],
  EliminateWithoutShip: [{ verb: "EliminateWithoutShip" }],
  GainHeroTraits: [{ verb: "GainHeroTraits" }],
  AddEventsToHand: [{ verb: "AddEventsToHand", upTo: 2 }],
  FlipShip: [{ verb: "FlipShip" }],
};
