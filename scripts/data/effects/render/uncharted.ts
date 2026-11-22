// The Dream-chaser box's island pieces (src/catalog/families/uncharted.ts and island.ts): the Uncharted and Grotto decks, Lost Islands and their flips, the Island Map and the campaign Setup trades: templates and samples.
import { amt, type Samples, type Templates } from "./family-kit.ts";
import { joinAnd, str } from "./kit.ts";

const codes = (value: unknown): string => joinAnd((Array.isArray(value) ? value : []).map(str));
const SUBJECT: Readonly<Record<string, string>> = { self: "this card", picked: "the picked card", subject: "the card the event is about" };
const subject = (value: unknown): string => SUBJECT[str(value ?? "self")] ?? str(value);

export const UNCHARTED_TEMPLATES: Templates = {
  AttachSetAsideTo: (i) => ({ text: `Campaign Setup: the set-aside copy of the card with code ${str(i.code)} is attached to the card in play named "${str(i.to)}" (a card dealt on its Upgraded side stays so)${i.uncontrolled === true ? "; it lies attached, controlled by nobody, not revealed, wherever its host lies, and in no play area" : ""}`, read: ["code", "to", "uncontrolled"] }),
  LookAtFacedown: (i) => ({ text: `the acting player looks at the facedown side of ${subject(i.target)}${typeof i.remove === "number" ? `, after ${i.remove} progress is taken off it` : ""} in a look window (it stays facedown and none of the Forced effects of its other side happen)`, read: ["target", "remove"] }),
  FlipUncharted: (i) => ({ text: `${subject(i.target)} turns to its other side and loses all its progress; it is announced as flipped over, which "After this card is flipped over while active" Forced effects hear`, read: ["target"] }),
  FlipDoubleSided: (i) => ({ text: `${subject(i.target)}, a double-sided location whose two sides are two cards, shows its other side${i.keepProgress === true ? " and keeps its progress" : " and loses all its progress"}; the flip is announced like FlipUncharted's (nothing while the table holds noFlipActive and the card is the active location)`, read: ["target", "keepProgress"] }),
  DiscardBottom: (i) => ({ text: `the bottom card of ${i.who === "firstPlayer" ? "the first player's" : "the acting player's"} deck goes to its owner's discard pile, announced as discarded from the deck; the effect remembers it, so a later check can read its printed cost`, read: ["who"] }),
  AddLostIslands: (i, ctx) => ({ text: `the top ${amt(i.count, ctx)} cards of the Uncharted deck join the staging area without being revealed, Lost Island side up (the deck is not shuffled)`, read: ["count"] }),
  KeepCampaignCard: () => ({ text: "(marker, changes nothing when run) the campaign card stays beside the quest deck while the scenario is played, so a card of the scenario can place resources on it and the Resolution can count them", read: [] }),
  TradeDamageForThreat: (i) => ({ text: `Campaign Setup: in player order, each character in play is offered to its controller to trade or keep: a trade deals ${str(i.damage)} damage to it and lowers that player's threat by ${str(i.threat)}`, read: ["damage", "threat", "character"] }),
  AddFromGrottoDeck: (i, ctx) => ({ text: `the top ${amt(i.count, ctx)} cards of the Grotto deck join the staging area without being revealed, Grotto side faceup${i.flip === true ? "; each is then flipped to its Underwater side, losing its progress (none yet), and announced as flipped over" : ""}`, read: ["count", "flip"] }),
  LookAtBottom: (i, ctx) => ({ text: `${i.deck === "picked" ? "the last picked player's deck" : i.deck === "encounter" ? "the encounter deck" : "the acting player's deck"}: the acting player looks at the bottom ${i.count === undefined ? "card" : `${amt(i.count, ctx)} cards`} in a look window (the cards shown are the ones the effect looked at, the bottom one the picked card)`, read: ["count", "deck"] }),
  ScrambleUncharted: () => ({ text: "each Lost Island in the staging area loses its progress, and the game's seed shuffles their places in the staging area among themselves", read: [] }),
  PrepareGrottoDeck: () => ({ text: "Setup: the double-sided locations the scenario dealt as its Grotto deck are shuffled; each lies Grotto side faceup and its Underwater side is never looked at before a flip", read: [] }),
  ResolveActiveForced: (i) => ({ text: `the active location hears the end of the ${str(i.phase)} phase now: only its own Forced effects (and Responses) answer, and their conditions read that phase`, read: ["phase"] }),
  PrepareUnchartedDeck: () => ({ text: "Setup: the double-sided locations dealt as the Uncharted deck are shuffled, each Lost Island side up", read: [] }),
  AddSetAsideLostIsland: (i) => ({ text: `the set-aside card with code ${str(i.code)} joins the staging area on its Lost Island side, faceup`, read: ["code"] }),
  DiscardCostlier: (i) => ({ text: `from ${i.who === "firstPlayer" ? "the first player's" : "the acting player's"} hand, each card whose printed cost is higher than that of the card just discarded from the deck goes to its owner's discard pile`, read: ["who"] }),
  RemoveWillpowerFromQuest: (i, ctx) => ({ text: `the first player removes committed characters of any player from the quest, one at a time, until their Willpower adds up to ${amt(i.amount, ctx)} or none is left`, read: ["amount", "left"] }),
  EngageFromVictory: (i) => ({ text: `the card titled "${str(i.name)}" leaves the victory display for the engagement area of the player with the highest threat (the first player chooses among those tied; nothing when it is in play or not in the victory display)`, read: ["name"] }),
  LookAtSecret: () => ({ text: "the acting player looks at the picked secret (a facedown Temple of the Deceived location or secret), which stays facedown", read: [] }),
  PlaceSecrets: (i) => ({ text: `Campaign Setup: the set-aside copies of the cards with codes ${codes(i.codes)} are shuffled and lie facedown under the Temple of the Deceived locations, one each, in the order the seed gives, as secrets`, read: ["codes"] }),
  RaiseThreatToAttach: (i) => ({ text: `Campaign Setup: in player order each player is offered to raise their threat by ${str(i.amount)} (if it can rise by that much without reaching 50); the first to accept raises it and chooses a hero, any player's, for the set-aside copy of the card with code ${str(i.code)} to attach to; nobody is offered it after that`, read: ["code", "amount", "seat", "accepted"] }),
  FlipSecret: () => ({ text: "the secret under the active location turns faceup and the acting player takes the card as the line says (a Recurring Nightmare engages them, Starla comes under their control ready); nothing when the active location has no secret", read: [] }),
  PrepareIslandMap: (i) => ({ text: `Setup: the double-sided locations dealt as the Uncharted deck are separated: those with codes ${codes(i.temple)} (the Temple of the Deceived locations) are shuffled and laid in the right-hand column, the others are shuffled and fill the first four columns, a grid of three rows by five; each lies with its Lost Island (or Temple) side up, which nobody looks at`, read: ["temple"] }),
  RevealIslandCorners: () => ({ text: "Setup: the top-left and bottom-left locations of the Island Map turn to their other side, with no flip announced (their Forced effects do not resolve)", read: [] }),
  SetIslandActive: () => ({ text: "Setup: the picked location becomes the active location where it lies (not a travel: no Travel effect, no traveled event, no Forced effect of becoming active)", read: [] }),
  AttachGuarded: (i) => ({ text: `Setup: the set-aside copy of "${str(i.name)}" (whichever printing is dealt) is attached to the card in play titled "${str(i.to)}", guarded, and stays so until that card leaves play, when it returns to the staging area`, read: ["name", "to"] }),
};

export const UNCHARTED_SAMPLES: Samples = {
  AttachSetAsideTo: [{ verb: "AttachSetAsideTo", code: "11192", to: "Raider Flagship", uncontrolled: true }],
  LookAtFacedown: [{ verb: "LookAtFacedown", target: "picked", remove: 4 }],
  FlipUncharted: [{ verb: "FlipUncharted", target: "subject" }],
  FlipDoubleSided: [{ verb: "FlipDoubleSided", target: "picked", keepProgress: true }],
  DiscardBottom: [{ verb: "DiscardBottom", who: "firstPlayer" }],
  AddLostIslands: [{ verb: "AddLostIslands", count: 2 }],
  KeepCampaignCard: [{ verb: "KeepCampaignCard" }],
  TradeDamageForThreat: [{ verb: "TradeDamageForThreat", damage: 1, threat: 1 }],
  AddFromGrottoDeck: [{ verb: "AddFromGrottoDeck", count: 2, flip: true }],
  LookAtBottom: [{ verb: "LookAtBottom", count: 5, deck: "picked" }],
  ScrambleUncharted: [{ verb: "ScrambleUncharted" }],
  PrepareGrottoDeck: [{ verb: "PrepareGrottoDeck" }],
  ResolveActiveForced: [{ verb: "ResolveActiveForced", phase: "Quest" }],
  PrepareUnchartedDeck: [{ verb: "PrepareUnchartedDeck" }],
  AddSetAsideLostIsland: [{ verb: "AddSetAsideLostIsland", code: "11027" }],
  DiscardCostlier: [{ verb: "DiscardCostlier", who: "firstPlayer" }],
  RemoveWillpowerFromQuest: [{ verb: "RemoveWillpowerFromQuest", amount: 3 }],
  EngageFromVictory: [{ verb: "EngageFromVictory", name: "Temple Guardian" }],
  LookAtSecret: [{ verb: "LookAtSecret" }],
  PlaceSecrets: [{ verb: "PlaceSecrets", codes: ["11198", "11199"] }],
  RaiseThreatToAttach: [{ verb: "RaiseThreatToAttach", code: "11180", amount: 4 }],
  FlipSecret: [{ verb: "FlipSecret" }],
  PrepareIslandMap: [{ verb: "PrepareIslandMap", temple: ["12068", "12069"] }],
  RevealIslandCorners: [{ verb: "RevealIslandCorners" }],
  SetIslandActive: [{ verb: "SetIslandActive" }],
  AttachGuarded: [{ verb: "AttachGuarded", name: "Gate Key", to: "Temple Guardian" }],
};
