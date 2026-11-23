// The riddles family's pieces (src/catalog/families/riddles.ts, Dungeons Deep and Caverns Dim): templates for its verbs, the word of its stat flag, its condition and the samples read-fields.test.ts checks them with.
import { str, type Ctx, type Obj } from "../kit.ts";

type Made = { text: string; read: readonly string[] };

const NAMES: Readonly<Record<string, string>> = { type: "a card type (ally, event, attachment or treasure)", sphere: "a sphere (leadership, spirit, lore, tactics or Baggins)", cost: "a cost (0 to 6)" };

export const RIDDLES_TEMPLATES: Readonly<Record<string, (i: Obj, ctx: Ctx) => Made>> = {
  CreateRiddleArea: (i) => ({ text: `create the riddle area: the quest deck's card with code ${str(i.stage)} lies in it, side B up, beside the current quest, and its Setup resolves; the quest advances from the first stage past it`, read: ["stage"] }),
  PlaceInRiddleArea: (i) => ({ text: `${i.attachTo ? `find the card with code ${str(i.code)} in the encounter deck or its discard pile and attach it to ${str(i.attachTo)}` : `find the card with code ${str(i.code)} in the encounter deck or its discard pile and put it into the riddle area`} (nothing when none is left)`, read: ["code", "attachTo"] }),
  Riddle: (i) => ({ text: `a riddle: the first player names ${(Array.isArray(i.names) ? i.names : []).map((name) => NAMES[str(name)] ?? str(name)).join(", ")}, shuffles his deck and discards its top ${str(i.discard)} card(s); each discarded card that matches every named item puts 1 progress on stage 2 (a marker, read when the riddle is answered)`, read: ["names", "discard"] }),
  AnswerRiddle: (i) => ({ text: `the first player answers the riddle of ${i.card === "picked" ? "the picked card" : "this card"}: he names its items, the top cards of his deck are discarded (Bilbo's Magic Ring may discard more), each match is 1 progress on stage 2, and with no match the riddle failed (Gollum hears it); this card then goes to the encounter discard pile; nothing while riddle effects are ignored`, read: ["card"] }),
  RiddleStep: (i) => ({ text: `a step of the riddle of the card ${str(i.card)}, answered by the first player: ${str(i.step)}${i.item ? ` (${str(i.item)})` : ""}`, read: ["step", "item", "card"] }),
  ResolveNormally: () => ({ text: "resolve this card's other When Revealed effects for the first player, as the reveal would have, leaving its riddle out", read: [] }),
  DiscardUntilRiddle: () => ({ text: "discard cards from the top of the encounter deck until a card with a riddle is discarded, and pick it (the discard pile is shuffled into the deck when it runs out; nothing is picked when no such card is left)", read: [] }),
  NameEncounterType: (i) => ({ text: `the first player names a card type: ${(Array.isArray(i.types) ? i.types : []).map(str).join(", ")}`, read: ["types"] }),
  RemoveRiddleProgress: () => ({ text: "for each card this effect discarded from the top of the encounter deck that is not of the named type, remove 1 progress from stage 2", read: [] }),
  GollumAttacksBilbo: () => ({ text: "Gollum, in the riddle area, attacks Bilbo Baggins' player: no shadow card is dealt, only Bilbo can defend, and damage nobody defends goes on Bilbo", read: [] }),
  LeaveRiddleArea: () => ({ text: "stage 2 is removed from the game with the riddle area; Bilbo Baggins stays with the first player and is no longer limited", read: [] }),
  GollumEngagesFirstPlayer: () => ({ text: "Gollum, in the riddle area or engaged with another player, engages the first player (once stage 2 has left)", read: [] }),
  IgnoreRiddles: () => ({ text: "while this card is in play every riddle effect is ignored (a marker)", read: [] }),
  TreacheriesGainSurge: () => ({ text: "while this card is in play each treachery card revealed from the encounter deck gains surge (a marker)", read: [] }),
};

export const RIDDLES_STAT_NOTES: Readonly<Record<string, string>> = {
  gollumDamageToBilbo: " (damage from the undefended attacks of Gollum goes on Bilbo Baggins)",
};

export const RIDDLES_CONDITIONS: Readonly<Record<string, (c: Obj, ctx: Ctx) => Made>> = {
  riddle: (c) => ({
    text:
      c.is === "complete"
        ? "the current quest stage and stage 2 both hold their quest points (with stage 2 gone, the current stage alone)"
        : c.is === "offered"
          ? "this card is being revealed from the encounter deck and no card ignores riddles: the first player may answer its riddle"
          : c.is === "shadow"
            ? "this enemy was dealt a shadow card that prints a riddle"
            : "a riddle is being answered in the running effect",
    read: ["is"],
  }),
};

export const RIDDLES_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  CreateRiddleArea: [{ verb: "CreateRiddleArea", stage: "131030" }],
  PlaceInRiddleArea: [{ verb: "PlaceInRiddleArea", code: "131074" }, { verb: "PlaceInRiddleArea", code: "131079", attachTo: "Bilbo Baggins" }],
  Riddle: [{ verb: "Riddle", names: ["type", "sphere"], discard: 2 }],
  AnswerRiddle: [{ verb: "AnswerRiddle" }, { verb: "AnswerRiddle", card: "picked" }],
  RiddleStep: [{ verb: "RiddleStep", step: "name", item: "type", card: "i1" }, { verb: "RiddleStep", step: "finish", card: "i1" }],
  ResolveNormally: [{ verb: "ResolveNormally" }],
  DiscardUntilRiddle: [{ verb: "DiscardUntilRiddle" }],
  NameEncounterType: [{ verb: "NameEncounterType", types: ["enemy", "location"] }],
  RemoveRiddleProgress: [{ verb: "RemoveRiddleProgress" }],
  GollumAttacksBilbo: [{ verb: "GollumAttacksBilbo" }],
  LeaveRiddleArea: [{ verb: "LeaveRiddleArea" }],
  GollumEngagesFirstPlayer: [{ verb: "GollumEngagesFirstPlayer" }],
  IgnoreRiddles: [{ verb: "IgnoreRiddles" }],
  TreacheriesGainSurge: [{ verb: "TreacheriesGainSurge" }],
};

export const RIDDLES_CONDITION_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  riddle: [{ kind: "riddle", is: "complete" }, { kind: "riddle", is: "offered" }, { kind: "riddle", is: "shadow" }, { kind: "riddle", is: "answering" }],
};
