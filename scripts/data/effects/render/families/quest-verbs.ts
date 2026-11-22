// The play, encounter, quest, sidequests and moria families' pieces (src/catalog/families/play.ts, encounter.ts, quest.ts, sidequests.ts, moria.ts): putting cards into play, travel and progress, the quest deck's order and a few single effects: templates and samples.
import { cardRef } from "../amounts.ts";
import { amt, pck, who, type Samples, type Templates } from "../family-kit.ts";
import { joinAnd, str } from "../kit.ts";

const UNTIL = { endOfPhase: "the end of the phase", endOfRound: "the end of the round" } as const;
const THEN = { returnToHand: "returns to its owner's hand", shuffleIntoDeck: "is shuffled into its owner's deck", discard: "is discarded", removeFromGame: "is removed from the game" } as const;
const WHO_PLAY = { actor: "the acting player's control", picked: "the picked player's control", owner: "its owner's control", choose: "the control of a player the acting player chooses" } as const;
const key = <T extends Readonly<Record<string, string>>>(table: T, value: unknown, fallback: string): string => table[str(value)] ?? fallback;

export const QUEST_VERB_TEMPLATES: Templates = {
  Doomed: (i) => ({ text: `each player raises their threat by ${str(i.amount)} from the doomed keyword this card gains (doomedRaised is announced for each)`, read: ["amount"] }),
  PutIntoPlay: (i, ctx) => ({
    text: `${cardRef(i.card ?? "self")} is put into play from wherever it is out of play (hand, discard pile, deck): it is not played, so no cost is paid and no play restriction applies, and a unique card with a copy in play stays where it is; a hero goes among its controller's heroes, any other card into the play area${i.exhausted === true ? ", exhausted" : ", ready"}${i.committed === true ? ", committed to the quest" : ""}${typeof i.damage === "number" ? `, with ${i.damage} damage on it` : ""}, under ${key(WHO_PLAY, i.who ?? "actor", str(i.who))}${isHost(i.host) ? `; an attachment goes on ${pck(i.host, ctx)} chosen by the acting player (it stays where it is when none can take it)` : ""}${i.unguarded === true ? " (the step after its guard left play: its owner puts it into play, or it goes to its owner's discard pile when it has nowhere to go)" : ""}${i.ignoreUnique === true ? ", ignoring uniqueness" : ""}${typeof i.until === "string" && typeof i.then === "string" ? `; at ${key(UNTIL, i.until, str(i.until))} it ${key(THEN, i.then, str(i.then))}` : ""}`,
    read: ["card", "who", "exhausted", "committed", "damage", "host", "unguarded", "ignoreUnique", "until", "then"],
  }),
  AttachFacedown: (i) => ({ text: `${cardRef(i.card ?? "subject")}, now in a discard pile, is attached facedown to this card: out of play under it, with no text, and discarded to its owner's discard pile when this card leaves play`, read: ["card"] }),
  TakeFirstPlayer: () => ({ text: "the acting player takes the first player token and is the first player from now on", read: [] }),
  PutIntoPlayFromHand: (i, ctx) => ({
    text: `${i.from === "picked" ? "the picked player" : i.from === "any" ? "the players as a group (the acting player chooses)" : "the acting player"} ${i.required === true ? "must choose" : "may choose"} up to ${i.upTo === undefined ? "1" : str(i.upTo)} ${pck(i.pick, ctx)} card(s) in ${i.from === "picked" ? "that player's" : i.from === "any" ? "any player's" : "their"} hand and put ${i.required === true ? "it" : "each"} into play, one at a time${i.required === true ? " (they may not stop while a card matches; nothing enters play with none that matches)" : " (they may stop)"}${i.anyController === true ? ", the chooser naming the player who controls each card" : ""}; each card is picked for the steps after it${typeof i.until === "string" && typeof i.then === "string" ? `; at ${key(UNTIL, i.until, str(i.until))} it ${key(THEN, i.then, str(i.then))}` : ""}`,
    read: ["pick", "from", "upTo", "required", "anyController", "card", "until", "then"],
  }),
  ProgressQuest: (i, ctx) => ({ text: `place ${amt(i.amount, ctx)} progress on the current quest; the active location takes it first`, read: ["amount"] }),
  RaiseThreatTo: (i, ctx) => ({ text: `the acting player's threat becomes ${amt(i.amount, ctx)} if it is lower`, read: ["amount"] }),
  TravelTo: (i) => ({ text: `the players travel to ${i.target === undefined ? "the picked location" : cardRef(i.target)} without resolving its Travel effect (an active location already there returns to the staging area first; nothing happens if the players cannot travel there)${i.unlessActive === true ? "; they travel only when no location is active: an active location stays, and the location stays in the staging area" : ""}`, read: ["target", "unlessActive"] }),
  PlayRevealedFree: (i) => ({
    text: i.embassy === true ? "the player card of the Embassy's current pair, lying faceup in front of its owner, is played for no cost by its owner; when it cannot be played it goes to its owner's discard pile" : "the picked card (the top card of the acting player's deck) is played for no cost if it can be: an ally enters play, an attachment is attached to a host the acting player chooses, an event's Action resolves; otherwise it goes to the bottom of the deck",
    read: ["embassy"],
  }),
  RevealFewer: (i) => ({ text: `the staging step of this phase reveals ${str(i.amount)} fewer card(s)${i.who === "picked" ? " for the player picked last (the reveals the players make in turn skip that player's; nothing else is shortened)" : ""}, to a minimum of ${str(i.min)} (a player's own reveal is one card, so a minimum of 1 leaves it as it is)`, read: ["amount", "min", "who"] }),
  LookAtStages: (i) => ({
    text: i.bottom === true
      ? `when this stage is defeated, whatever the heading: the first player looks at the top ${str(i.count)} stages of the quest deck and chooses 1 to place on the bottom of the quest deck; the others stay on top in their order and the quest advances to the top stage`
      : `when this stage is defeated: if the heading is on-course (Sun), the first player looks at the top ${str(i.count)} stages of the quest deck and the quest advances to the one they choose, the others going to the bottom; otherwise it advances to the top stage; defeating the last stage wins the game (the stage's definition carries the number)`,
    read: ["count", "bottom"],
  }),
  ShuffleStages: (i) => ({ text: `Setup: the quest cards with codes ${joinAnd((Array.isArray(i.codes) ? i.codes : []).map(str))} that are in the quest deck are put in a random order (the scenario's seed) on top of it, the others below them in the order they were; the quest then advances in the order of its quest deck`, read: ["codes"] }),
  BranchStage: (i) => ({ text: `(the stage's definition carries it; nothing runs when it is resolved) defeating this stage proceeds to one of the stages with codes ${joinAnd((Array.isArray(i.codes) ? i.codes : []).map(str))}, chosen with the scenario's seed, and the others are removed from the game; the stage reached is the last one: defeating it wins the game`, read: ["codes"] }),
  WaiveQuestThreat: (i) => ({ text: `${i.who === "picked" ? "the picked player does" : "each player does"} not raise their threat from questing unsuccessfully until ${key(UNTIL, i.until, str(i.until))}`, read: ["who", "until"] }),
  EliminatePlayer: () => ({ text: "the acting player is eliminated from the game by a card effect", read: [] }),
  FlipCard: () => ({ text: "this card is flipped over: side A becomes side B and side B side A (flipped is announced about it; a contract's records name their side in their line ids and carry a faceUp condition for it)", read: [] }),
  TakeRevealedCard: (i) => ({ text: `this card, an Encounter-keyword player card just revealed into the staging area, enters the play area of ${who(i.who)}, ${i.committed === true ? "committed to the quest" : "ready"}, still its owner's card`, read: ["who", "committed"] }),
  RemoveDamageFrom: (i) => ({ text: `up to ${str(i.amount)} damage token(s) come off the card in play with printed code ${str(i.code)}; it stops at 0`, read: ["code", "amount"] }),
  SacrificeForDamage: (i) => ({ text: `the last picked hero is discarded from play to deal X damage to the card in play with printed code ${str(i.code)}, X being that hero's threat cost; then that card loses all keywords for the rest of the game (the damage is an encounter card's, so the Balrog's immunity does not stop it; nothing with no such card in play)`, read: ["code"] }),
  AttachToSubject: () => ({ text: "this objective, in the staging area, attaches to the hero the answered event was about (a card that is attached already stays where it is)", read: [] }),
};

function isHost(value: unknown): boolean {
  return typeof value === "object" && value !== null;
}

export const QUEST_VERB_SAMPLES: Samples = {
  Doomed: [{ verb: "Doomed", amount: 2 }],
  PutIntoPlay: [
    { verb: "PutIntoPlay", card: "picked", who: "choose", exhausted: true, committed: true, damage: 2, host: { type: "hero", control: "you" }, unguarded: true, ignoreUnique: true, until: "endOfPhase", then: "returnToHand" },
    { verb: "PutIntoPlay", card: "host", who: "owner", until: "endOfRound", then: "discard" },
    { verb: "PutIntoPlay", who: "picked" },
  ],
  AttachFacedown: [{ verb: "AttachFacedown", card: "picked" }],
  TakeFirstPlayer: [{ verb: "TakeFirstPlayer" }],
  PutIntoPlayFromHand: [{ verb: "PutIntoPlayFromHand", pick: { type: "ally", control: "you" }, from: "any", upTo: 2, required: true, anyController: true, until: "endOfRound", then: "discard" }, { verb: "PutIntoPlayFromHand", pick: { type: "ally", control: "you" }, from: "picked" }],
  ProgressQuest: [{ verb: "ProgressQuest", amount: 1 }],
  RaiseThreatTo: [{ verb: "RaiseThreatTo", amount: 35 }],
  TravelTo: [{ verb: "TravelTo", target: "picked", unlessActive: true }],
  PlayRevealedFree: [{ verb: "PlayRevealedFree", embassy: true }, { verb: "PlayRevealedFree" }],
  RevealFewer: [{ verb: "RevealFewer", amount: 1, min: 0, who: "picked" }],
  LookAtStages: [{ verb: "LookAtStages", count: 2, bottom: true }, { verb: "LookAtStages", count: 2 }],
  ShuffleStages: [{ verb: "ShuffleStages", codes: ["03070", "03071"] }],
  BranchStage: [{ verb: "BranchStage", codes: ["01121", "01122"] }],
  WaiveQuestThreat: [{ verb: "WaiveQuestThreat", who: "picked", until: "endOfRound" }],
  EliminatePlayer: [{ verb: "EliminatePlayer" }],
  FlipCard: [{ verb: "FlipCard" }],
  TakeRevealedCard: [{ verb: "TakeRevealedCard", who: "picked", committed: true }],
  RemoveDamageFrom: [{ verb: "RemoveDamageFrom", code: "142043", amount: 1 }],
  SacrificeForDamage: [{ verb: "SacrificeForDamage", code: "142044" }],
  AttachToSubject: [{ verb: "AttachToSubject" }],
};
