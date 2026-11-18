// The pieces Foundations of Stone adds beside the families' own: the nameless family (src/catalog/families/nameless.ts), Washed Away!'s stage draw and deck swap, the Centipede's and Lost and Alone's moves, the ally discard and Drowned Treasury's claim. Templates for the verbs
// and the samples read-fields.test.ts checks them with.
import { cardRef } from "./amounts.ts";
import { joinAnd, str, type Ctx, type Obj } from "./kit.ts";
import { renderPick } from "./picks.ts";

type Made = { text: string; read: readonly string[] };

const DECK: Readonly<Record<string, string>> = { actor: "the acting player's deck (the player the event is about, in a Forced effect; the defending player, in a Shadow effect)", firstPlayer: "the first player's deck (of the staging area, once the areas are separate)" };
const TO: Readonly<Record<string, string>> = { self: "this enemy", picked: "the picked enemy", attacker: "the attacking enemy", subject: "the enemy the event is about" };

export const STONE_TEMPLATES: Readonly<Record<string, (i: Obj, ctx: Ctx) => Made>> = {
  AttachDeckTop: (i) => ({
    text: `${i.untilCost === undefined ? `attach the top ${i.count === undefined || i.count === 1 ? "card" : `${str(i.count)} cards`}` : `attach cards one after another until the printed cost of all the cards attached to ${TO[str(i.to ?? "self")] ?? str(i.to)} is ${str(i.untilCost)} or more (or the deck is empty), starting with the top card`} of ${DECK[str(i.deck ?? "actor")] ?? str(i.deck)} to ${TO[str(i.to ?? "self")] ?? str(i.to)}, faceup, as attachments with no title and no game text (a deck with fewer cards attaches fewer; each goes to its owner's discard pile when the enemy leaves play)${i.extra === true ? "; the cards attached this way are not a new event for the Forced effects that hear one" : "; the cards attached together are one event"}`,
    read: ["deck", "to", "count", "untilCost", "extra"],
  }),
  DiscardEncounterPerPlayer: () => ({ text: "discard the top card of the encounter deck for each player at this stage (fewer from a short deck); they are the cards this effect looked at", read: [] }),
  RevealDiscarded: (i) => ({ text: `the acting player reveals, in full, each ${str(i.trait)} enemy among the cards this effect discarded that still lies in the encounter discard pile, one after another (its When Revealed resolves and it enters the staging area)`, read: ["trait"] }),
  StartRandomSeparateStage: (i) => ({ text: `the acting player draws one of the quest deck's cards with codes ${joinAnd((Array.isArray(i.codes) ? i.codes : []).map(str))} at random (a different one for each player, while any is left); it is his quest stage, side B up, he has a staging area of his own and the stage is revealed for him`, read: ["codes"] }),
  RemoveUnusedStages: (i) => ({ text: `every card of the quest deck with codes ${joinAnd((Array.isArray(i.codes) ? i.codes : []).map(str))} leaves the game`, read: ["codes"] }),
  MoveToOtherPlayerArea: () => ({ text: "this enemy, engaged with a player, moves to the staging area of the player picked, as a staging card (with no other area to pick, to the area the players share; with one player it stays engaged)", read: [] }),
  JoinAnotherPlayer: (i) => ({
    text: `${i.holdsStage === true ? "(the stage is complete at its quest points and does not advance by the ordinary rule) " : ""}the player whose stage this is joins another player: his staging cards move to that player's area, his active location is discarded and he shares that area and stage from then on; with no other area every player advances together to the stage with code ${str(i.advanceTo)}`,
    read: ["advanceTo", "holdsStage"],
  }),
  ReplaceEncounterDeck: (i) => ({
    text: `the encounter deck leaves the game; the ${joinAnd((Array.isArray(i.keep) ? i.keep : []).map(str))} cards of the encounter discard pile and the set-aside cards of the "${str(i.set)}" encounter set (the Nightmare cards that bear its icon too) are shuffled into the new encounter deck; every other card of the discard pile leaves the game`,
    read: ["set", "keep"],
  }),
  ShuffleHeroIntoDeck: () => ({ text: "the picked hero leaves play (it is not destroyed; its attachments are discarded) and is shuffled into its owner's deck; when he draws it, it is put into play at once, ready, with no damage or resources; a player whose only hero lies in the deck is not eliminated", read: [] }),
  ShuffleHighestCostIntoDeck: () => ({ text: "the acting player shuffles the card in his hand with the highest printed cost (no printed cost counts 0; he chooses among ties) into his deck; nothing from an empty hand", read: [] }),
  DiscardAlliesToCost: (i) => ({ text: `the acting player chooses and discards allies he controls, one at a time, until the total printed cost of the allies he controls is ${str(i.cost)} or less`, read: ["cost"] }),
  ClaimObjective: (i) => ({ text: `${i.card === undefined ? "this objective" : `${cardRef(i.card)} (an objective)`} leaves the staging area and attaches to the picked character, controlled by that character's controller (claimed)`, read: ["card"] }),
  MoveResourceFromHeroes: (i) => ({ text: `1 resource moves from the pool of each hero the acting player controls that has one to ${cardRef(i.to)}`, read: ["to"] }),
  DiscardSharedStage: () => ({ text: "the shared quest stage goes to the set-aside pile, and each living player, first player first, hears that it was discarded for his own stage", read: [] }),
  DiscardAllInPlay: (i, ctx) => ({ text: `discard every card in play that matches ${renderPick(i.pick, ctx)} (not destroyed: no Victory, no "when destroyed"), its attachments with it; an encounter card goes to the encounter discard pile, a player's card to its owner's`, read: ["pick"] }),
};

export const STONE_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  AttachDeckTop: [
    { verb: "AttachDeckTop", deck: "firstPlayer", to: "picked", count: 2 },
    { verb: "AttachDeckTop", deck: "firstPlayer", untilCost: 6 },
    { verb: "AttachDeckTop", to: "subject", extra: true },
    { verb: "AttachDeckTop", to: "attacker" },
  ],
  DiscardEncounterPerPlayer: [{ verb: "DiscardEncounterPerPlayer" }],
  RevealDiscarded: [{ verb: "RevealDiscarded", trait: "Nameless" }],
  StartRandomSeparateStage: [{ verb: "StartRandomSeparateStage", codes: ["04114", "04115"] }],
  RemoveUnusedStages: [{ verb: "RemoveUnusedStages", codes: ["04114", "04115"] }],
  MoveToOtherPlayerArea: [{ verb: "MoveToOtherPlayerArea" }],
  JoinAnotherPlayer: [{ verb: "JoinAnotherPlayer", advanceTo: "04118", holdsStage: true }, { verb: "JoinAnotherPlayer", advanceTo: "10040" }],
  ReplaceEncounterDeck: [{ verb: "ReplaceEncounterDeck", set: "Foundations of Stone", keep: ["enemy", "treachery"] }],
  ShuffleHeroIntoDeck: [{ verb: "ShuffleHeroIntoDeck" }],
  ShuffleHighestCostIntoDeck: [{ verb: "ShuffleHighestCostIntoDeck" }],
  DiscardAlliesToCost: [{ verb: "DiscardAlliesToCost", cost: 6 }],
  ClaimObjective: [{ verb: "ClaimObjective", card: "previous" }],
  MoveResourceFromHeroes: [{ verb: "MoveResourceFromHeroes", to: "self" }, { verb: "MoveResourceFromHeroes", to: "picked" }],
  DiscardSharedStage: [{ verb: "DiscardSharedStage" }],
  DiscardAllInPlay: [{ verb: "DiscardAllInPlay", pick: { type: "card", control: "any", traits: ["Item", "Armor"] } }],
};
