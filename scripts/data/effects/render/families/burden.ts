// The burden and aflame families' pieces (src/catalog/families/burden.ts and aflame.ts): the Ring-bearer's life, the burden deck, Aflame locations and what a Resolution adds to the Campaign Pool: templates and samples.
import { amt, pck, type Samples, type Templates } from "../family-kit.ts";
import { joinAnd, str } from "../kit.ts";

const codes = (value: unknown): string => joinAnd((Array.isArray(value) ? value : []).map(str));

export const BURDEN_TEMPLATES: Templates = {
  ReduceLife: (i, ctx) => ({ text: `the Ring-bearer's life goes down by ${amt(i.amount, ctx)}, to a minimum of 0, and the step names its cause (healing never raises it; at 0 the players lose the game; nothing in a game with no life number)`, read: ["amount"] }),
  MoveBurden: (i) => ({ text: `the top card of the burden deck ${i.to === "encounterTop" ? "is placed on top of the encounter deck" : "is shuffled into the encounter deck"} (nothing when the burden deck is empty)`, read: ["to"] }),
  SetStatUntil: (i, ctx) => ({ text: `each ${pck(i.holders, ctx)} now: ${str(i.stat)} is set to ${str(i.value)} until ${i.until === "endOfRound" ? "the end of the round" : i.until === "endOfPhase" ? "the end of the phase" : str(i.until)}, whatever else modifies it (the most recent set wins)`, read: ["stat", "value", "until", "holders"] }),
  AttachSelfToRingBearer: () => ({ text: "this treachery is attached to the Ring-bearer, the hero with the Ring-bearer trait (it stays in the encounter discard pile when there is no Ring-bearer in play)", read: [] }),
  ShuffleBurdenDeck: () => ({ text: "Setup: the burden deck is shuffled", read: [] }),
  SetLife: (i) => ({ text: `Setup: the Ring-bearer's life is set to ${str(i.value)} (the scenario's definition already starts the game with it)`, read: ["value"] }),
  RevealBurden: () => ({ text: "the acting player reveals the top card of the burden deck and resolves it as if just revealed from the encounter deck: its keywords and When Revealed effects resolve and a treachery goes to the encounter discard pile; no cancel of a card revealed from the encounter deck is offered against it (nothing when the burden deck is empty)", read: [] }),
  PassFirstPlayer: () => ({ text: "the first player token passes to the next player in the game (with no other player it stays)", read: [] }),
  ShuffleCopyIntoEachDeck: (i) => ({ text: `Setup, once the starting hands are drawn: one copy of the card with code ${str(i.code)} goes into each player's deck, which is shuffled, so the copy is never in an opening hand`, read: ["code"] }),
  EarnDealt: (i) => ({ text: `Resolution: one entry for each copy of a card with code ${codes(i.codes)} that a seat chose at the Setup is earned for that seat, wherever the copy is now (in a hand, in the victory display, in a discard pile)`, read: ["codes"] }),
  RemoveNamedFromGame: (i) => ({ text: `the card in play titled "${str(i.name)}" and the cards attached to it leave the game, and none is announced as leaving play, so no "if it leaves play" ability triggers (the campaign pool is left alone)`, read: ["name"] }),
  DiscardUntilAflame: (i) => ({ text: `Setup: cards are discarded from the top of the encounter deck until ${str(i.perPlayer)} location(s) with the Aflame keyword for each player are discarded, or the deck is empty: the cards above them go to the encounter discard pile and each Aflame location found goes to the staging area`, read: ["perPlayer"] }),
  HealLocations: (i, ctx) => ({ text: `the players remove ${amt(i.amount, ctx)} damage from the locations in play, one damage at a time from the location the first player chooses (the amount is the progress a stage replaced with healing)`, read: ["amount", "healed"] }),
  SearchAflame: () => ({ text: "the Aflame location with the highest Aflame value in the encounter deck and its discard pile is added to the staging area, not revealed (of locations tied on the value that are not copies of one card the first player chooses; the deck is not shuffled)", read: [] }),
};

export const BURDEN_SAMPLES: Samples = {
  ReduceLife: [{ verb: "ReduceLife", amount: 1 }],
  MoveBurden: [{ verb: "MoveBurden", to: "encounterTop" }],
  SetStatUntil: [{ verb: "SetStatUntil", stat: "willpower", value: 0, until: "endOfPhase", holders: { type: "hero", control: "any", trait: "Ring-bearer" } }, { verb: "SetStatUntil", stat: "attack", value: 1, until: "endOfRound", holders: { type: "hero", control: "any" } }],
  AttachSelfToRingBearer: [{ verb: "AttachSelfToRingBearer" }],
  ShuffleBurdenDeck: [{ verb: "ShuffleBurdenDeck" }],
  SetLife: [{ verb: "SetLife", value: 15 }],
  RevealBurden: [{ verb: "RevealBurden" }],
  PassFirstPlayer: [{ verb: "PassFirstPlayer" }],
  ShuffleCopyIntoEachDeck: [{ verb: "ShuffleCopyIntoEachDeck", code: "143021" }],
  EarnDealt: [{ verb: "EarnDealt", codes: ["11205", "11206"] }],
  RemoveNamedFromGame: [{ verb: "RemoveNamedFromGame", name: "Calphon" }],
  DiscardUntilAflame: [{ verb: "DiscardUntilAflame", perPlayer: 1 }],
  HealLocations: [{ verb: "HealLocations", amount: 2 }],
  SearchAflame: [{ verb: "SearchAflame" }],
};
