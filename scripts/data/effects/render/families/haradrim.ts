// The pieces the haradrim family adds (src/catalog/families/haradrim.ts): the card placed faceup under a location, the main quest card that has been in play the whole round, the heat tracker's verbs and condition (the amount is in family-amounts.ts) and the heroes in the staging area of The Long Arm of Mordor, with the samples read-fields.test.ts checks them with.
import { amt, pck, type ConditionTemplates, type Samples } from "../family-kit.ts";
import type { Ctx, Obj } from "../kit.ts";
import { str } from "../kit.ts";

type Made = { text: string; read: readonly string[] };

export const HARADRIM_TEMPLATES: Readonly<Record<string, (i: Obj, ctx: Ctx) => Made>> = {
  PlaceUnderSelfFaceup: () => ({ text: "the last picked card is placed faceup under this location; while it is there it is out of play", read: [] }),
  SetTemperature: (i) => ({ text: `place the heat tracker next to the quest deck and set the temperature to ${str(i.value)} (no "temperature changed" event)`, read: ["value"] }),
  RaiseTemperature: (i, ctx) => ({ text: `increase the temperature by ${amt(i.amount, ctx)} (nothing before the tracker is set; a change queues the "temperature changed" event the stages' loss answers)`, read: ["amount"] }),
  LowerTemperature: (i, ctx) => ({ text: `reduce the temperature by ${amt(i.amount, ctx)}, never below 0 (nothing before the tracker is set; a change queues the "temperature changed" event)`, read: ["amount"] }),
  MoveHeroesToStaging: () => ({ text: "each hero of every player moves to the staging area: it stays in play as a Captive held by no card, under no player's control, with its tokens and attachments, and its owner is not out of heroes while it is there (its text box is blank and it is immune to player card effects from then on)", read: [] }),
  TakeObjectiveHero: (i) => ({ text: `the acting player takes control of one of the set-aside objective-heroes (${(Array.isArray(i.codes) ? i.codes : []).map(str).join(", ")}) and adds ${str(i.resources)} resources to its pool (asked when several are left; it functions as a hero)`, read: ["codes", "resources"] }),
  ReleaseStagedHero: () => ({ text: "the acting player chooses a hero they own in the staging area (a Captive held by no card), takes control of it and exhausts it; it returns to its old place among their heroes with its tokens and attachments (nothing when they own none; asked when they own several)", read: [] }),
  GuardStagedHeroes: () => ({ text: "the first player attaches each hero in the staging area to a different Orc enemy in the staging area that guards no hero: the hero is guarded by that enemy, under no player's control, immune to player card effects, and with a blank text box (the settle sweep marks each guarded hero; asked which Orc when several are free; a hero with no Orc left stays in the staging area)", read: [] }),
  AttachRandomSetAside: (i) => ({ text: `the last picked card in play receives one random set-aside card with the trait ${str(i.trait)} (drawn by the game seed): it lies attached to it faceup, controlled by nobody and no player's card, and leaves play with its host (nothing with no host picked or no such card set aside)`, read: ["trait"] }),
  AddWithHostToVictory: () => ({ text: "this card and its host enemy are added to the victory display, this card first (the host and its remaining hit points are read before this card leaves play)", read: [] }),
  PrepareOrcsArea: (i) => ({
    text: `Setup: the set-aside quest cards with codes ${(Array.isArray(i.stages) ? i.stages : []).map(str).join(", ")} become the Orcs' quest deck in this order, the top one the Orcs' current stage (stage ${str(i.number)}), side D up (its C side is passed through only by an advance)${Array.isArray(i.place) && i.place.length > 0 ? `; each set-aside card with a code of ${i.place.map(str).join(", ")} is placed in the Orcs' area` : ""}; the area is separate from the staging area and has no ship behaviour`,
    read: ["stages", "number", "place"],
  }),
  MoveToOrcsArea: (i, ctx) => ({
    text: `${typeof i.code === "string" ? `the set-aside card with code ${i.code}` : i.target === "picked" ? "the last picked card" : ctx.attacker === true ? "the attacking enemy (the card whose shadow this is the attacker of)" : "this card"} goes into the Orcs' area from wherever it is (an engaged enemy loses its engagement; nothing for a card that is not in play when this card is the source, or with no Orcs' area)`,
    read: ["target", "code"],
  }),
  OrcsProgress: (i) => ({
    text: `the top card of the encounter deck is discarded, and the Orcs' current stage takes progress equal to its printed Threat plus the total ${i.engaged === true ? "current Threat of each enemy engaged with a player" : "current Threat of the cards in the Orcs' area, Uruk Chieftain included"}; a full stage is defeated: its loss, if its text has one, resolves and the Orcs advance to the next stage, C side first (its When Revealed resolves), then D side`,
    read: ["engaged"],
  }),
  AddOrcsProgress: (i, ctx) => ({ text: `${amt(i.amount, ctx)} progress goes on the Orcs' current stage, no more than it needs; a full stage is defeated as OrcsProgress says`, read: ["amount"] }),
  TakeObjectiveAlly: (i) => ({ text: `the acting player takes control of one of the set-aside objective allies (${(Array.isArray(i.codes) ? i.codes : []).map(str).join(", ")}) into their play area, ready (asked only when different cards are left, copies of one card are one choice); it is an ally in play`, read: ["codes"] }),
  EliminateAfterAttack: () => ({ text: "the acting player is eliminated from the game by a card effect; while an enemy attack on that player is in progress the elimination waits until that attack has resolved (its end-of-attack effects and the Forced effects it announces resolve first)", read: [] }),
  FlipSearchObjective: (i) => ({
    text: `the Search objective in play flips to ${i.to === "onTrack" ? "On Track (each resource on it is discarded)" : "Off Track"}${i.despiteBlock === true ? ", even while Lost Underground stops flips (this card's own flip)" : " (nothing while Lost Underground is in play)"}; nothing changes when it already shows that side; the flip is announced as a card flipped over`,
    read: ["to", "despiteBlock"],
  }),
  ResolveTrack: (i) => ({
    text: `Track ${str(i.amount)}: discard ${str(i.amount)} cards from the top of the encounter deck, shuffling the encounter discard pile into the deck each time the deck runs out and going on; if any discarded card is one that prints On Track in the lower right corner (codes ${(Array.isArray(i.marked) ? i.marked : []).map(str).join(", ")}), flip the Search objective to On Track (nothing while Lost Underground is in play)`,
    read: ["amount", "marked"],
  }),
  StageMarkedFromTop: (i) => ({
    text: `look at the top ${str(i.count)} cards of the encounter deck (all of it with fewer): the first one that prints On Track in the lower right corner (codes ${(Array.isArray(i.marked) ? i.marked : []).map(str).join(", ")}) is added to the staging area, not revealed, and the others are discarded; with none found the Search objective flips to Off Track`,
    read: ["count", "marked"],
  }),
  AddTopmostFromDiscard: (i) => ({ text: `the ${str(i.cardType)} put on the encounter discard pile last is added to the staging area (nothing with none there)`, read: ["cardType"] }),
  SetAsideCode: (i) => ({ text: `the card with code ${str(i.code)} in play, in the staging area or engaged, is set aside, out of play, with no damage (nothing when none is in play)`, read: ["code"] }),
  EngageSeatWithMost: (i, ctx) => ({ text: `this enemy engages the player engaged with the most ${pck(i.pick, ctx)} (the first player chooses among players that tie, all players at 0; nothing changes when it is already engaged with that player, else it moves to that player)`, read: ["pick"] }),
};

const range = (min: unknown, max: unknown): string => [typeof min === "number" ? `at least ${min}` : "", typeof max === "number" ? `at most ${max}` : ""].filter((part) => part !== "").join(" and ");

export const HARADRIM_SAMPLES: Samples = {
  PlaceUnderSelfFaceup: [{ verb: "PlaceUnderSelfFaceup" }],
  SetTemperature: [{ verb: "SetTemperature", value: 10 }],
  RaiseTemperature: [{ verb: "RaiseTemperature", amount: 4 }],
  LowerTemperature: [{ verb: "LowerTemperature", amount: 10 }],
  MoveHeroesToStaging: [{ verb: "MoveHeroesToStaging" }],
  TakeObjectiveHero: [{ verb: "TakeObjectiveHero", codes: ["16031", "16032"], resources: 2 }],
  ReleaseStagedHero: [{ verb: "ReleaseStagedHero" }],
  GuardStagedHeroes: [{ verb: "GuardStagedHeroes" }],
  AttachRandomSetAside: [{ verb: "AttachRandomSetAside", trait: "Capture" }],
  AddWithHostToVictory: [{ verb: "AddWithHostToVictory" }],
  PrepareOrcsArea: [{ verb: "PrepareOrcsArea", stages: ["17051", "17052"], number: 1, place: ["16061"] }],
  MoveToOrcsArea: [{ verb: "MoveToOrcsArea", target: "picked" }, { verb: "MoveToOrcsArea", code: "16063" }, { verb: "MoveToOrcsArea" }],
  OrcsProgress: [{ verb: "OrcsProgress" }, { verb: "OrcsProgress", engaged: true }],
  AddOrcsProgress: [{ verb: "AddOrcsProgress", amount: 2 }],
  TakeObjectiveAlly: [{ verb: "TakeObjectiveAlly", codes: ["17038"] }],
  EliminateAfterAttack: [{ verb: "EliminateAfterAttack" }],
  FlipSearchObjective: [{ verb: "FlipSearchObjective", to: "onTrack" }, { verb: "FlipSearchObjective", to: "offTrack", despiteBlock: true }],
  ResolveTrack: [{ verb: "ResolveTrack", amount: 3, marked: ["17066", "17067"] }],
  StageMarkedFromTop: [{ verb: "StageMarkedFromTop", count: 3, marked: ["17066", "17067"] }],
  AddTopmostFromDiscard: [{ verb: "AddTopmostFromDiscard", cardType: "location" }],
  SetAsideCode: [{ verb: "SetAsideCode", code: "17065" }],
  EngageSeatWithMost: [{ verb: "EngageSeatWithMost", pick: { type: "enemy", control: "any", trait: "Orc", nonUnique: true } }],
};

export const HARADRIM_CONDITIONS: ConditionTemplates = {
  temperature: (c) => ({ text: `the temperature is ${range(c.min, c.max)} (false while no heat tracker is set)`, read: ["min", "max"] }),
  stageInPlayWholeRound: () => ({ text: "the current main quest card was in play before this round began (from Setup or an earlier round), not revealed during it", read: [] }),
  locationExploredThisRound: () => ({ text: "a location was explored this round, the active location or one in the staging area (false unless the table holds the flag noteExplored)", read: [] }),
  orcsStage: (c) => ({
    text: `${c.is === "sameStage" ? "the players' main quest stage has the same number as the Orcs' stage" : c.is === "differentStage" ? "the players' main quest stage has another number than the Orcs' stage" : "the Orcs' stage"}${typeof c.at === "number" ? ` (and the Orcs' stage is stage ${c.at})` : ""} (a side quest as the current quest changes nothing; false in a game with no Orcs' area)`,
    read: ["is", "at"],
  }),
  threatAboveWillpower: () => ({ text: "the attacking enemy's current Threat is greater than the defending character's current Willpower (false when the attack has no defending character)", read: [] }),
};

export const HARADRIM_CONDITION_SAMPLES: Samples = {
  stageInPlayWholeRound: [{ kind: "stageInPlayWholeRound" }],
  temperature: [{ kind: "temperature", min: 40 }, { kind: "temperature", max: 39 }],
  locationExploredThisRound: [{ kind: "locationExploredThisRound" }],
  threatAboveWillpower: [{ kind: "threatAboveWillpower" }],
  orcsStage: [{ kind: "orcsStage", is: "sameStage" }, { kind: "orcsStage", is: "differentStage" }, { kind: "orcsStage", at: 2 }],
};
