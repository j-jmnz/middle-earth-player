// The pieces Flies and Spiders adds (the poison family's verbs, its amount and pick filters, and the words of the stat flags): templates, flag words and the samples read-fields.test.ts checks.
import { str, type Obj } from "../kit.ts";
import { cardRef } from "../amounts.ts";

type Made = { text: string; read: readonly string[] };

export const POISON_TEMPLATES: Readonly<Record<string, (i: Obj) => Made>> = {
  GivePoison: (i) => ({
    text: `${cardRef(i.target ?? "picked")} gets ${typeof i.amount === "number" ? i.amount : 1} poison: for each, the top card of its controller's deck is attached to it facedown (no poison when the deck is empty or the character cannot be poisoned); with poison equal to its printed hit points it is made unconscious at once`,
    read: ["amount", "target"],
  }),
  DiscardPoison: (i) => ({
    text: `${i.all === true ? "all the poison" : `${typeof i.amount === "number" ? i.amount : 1} poison`} on ${cardRef(i.target ?? "picked")} is discarded, each to the discard pile of the player who owns it`,
    read: ["amount", "all", "target"],
  }),
  MakeUnconscious: (i) => ({
    text: `${cardRef(i.target ?? "picked")} is made unconscious: it is rotated 180 degrees (neither ready nor exhausted), it leaves the quest and its poison is discarded`,
    read: ["target"],
  }),
  ReadyUnconscious: (i) => ({ text: `${cardRef(i.target ?? "picked")}, if it is unconscious, is no longer unconscious and is ready`, read: ["target"] }),
  AttackPickedPlayer: () => ({ text: "this enemy, in the staging area, attacks the player who controls the picked character now, from the staging area, dealt a shadow card", read: [] }),
  ShuffleSetAsideIntoDeck: (i) => ({ text: `the acting player puts the set-aside card with code ${str(i.code)} into his deck and shuffles the deck (nothing when none is set aside)`, read: ["code"] }),
  AdvanceOtherPlayers: (i) => ({
    text: `every other player advances to the stage with code ${str(i.code)} and keeps the staging area the players shared; with no other player the stage the acting player left and each card in its staging area are discarded instead`,
    read: ["code"],
  }),
  JoinAtStage: (i) => ({
    text: `the acting player goes on to the stage with code ${str(i.code)}: he joins the players at it (his staging area joins theirs, engaged enemies stay engaged, the stage is not revealed again), or, with none at it, advances alone and it is revealed`,
    read: ["code"],
  }),
};

// The plain words a stat flag of the scenario adds after its name.
export const POISON_STAT_NOTES: Readonly<Record<string, string>> = {
  venom: " (the keyword Venom: an enemy that damages a character in an attack gives it 1 poison, whatever the damage; none when the damage is canceled or destroys it)",
  cannotBePoisoned: " (the character gets no poison)",
  cannotTriggerForced: " (the card's Forced effects do not trigger; cannotTriggerEffects bars its Actions and Responses)",
};

export const POISON_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  GivePoison: [{ verb: "GivePoison", amount: 2, target: "defender" }],
  DiscardPoison: [{ verb: "DiscardPoison", amount: 4, target: "self" }, { verb: "DiscardPoison", all: true }],
  MakeUnconscious: [{ verb: "MakeUnconscious", target: "defender" }],
  ReadyUnconscious: [{ verb: "ReadyUnconscious", target: "self" }],
  AttackPickedPlayer: [{ verb: "AttackPickedPlayer" }],
  ShuffleSetAsideIntoDeck: [{ verb: "ShuffleSetAsideIntoDeck", code: "132019" }],
  AdvanceOtherPlayers: [{ verb: "AdvanceOtherPlayers", code: "132070" }],
  JoinAtStage: [{ verb: "JoinAtStage", code: "132070" }],
};
