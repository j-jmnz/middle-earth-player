// The long-dark family's pieces (src/catalog/families/long-dark.ts) and the conditions The Long Dark's cards add beside it: templates for its verbs and conditions and the samples read-fields.test.ts checks them with.
import { str, type Ctx, type Obj } from "../kit.ts";

type Made = { text: string; read: readonly string[] };

const TESTER: Readonly<Record<string, string>> = { actor: "the acting player (the defending player, in a Shadow effect)", firstPlayer: "the first player" };
const CARD: Readonly<Record<string, string>> = { other: "the other card of the event (the shadow card just dealt)", picked: "the card picked last", subject: "the card the event is about" };
const LOST: Readonly<Record<string, string>> = {
  all: "trigger every \"Lost:\" effect of the faceup cards in play (a shadow card is not in play); the set is fixed now, the first player picks the effect that resolves next, one at a time, and each resolves in full before the next (no choice for one effect or for copies of one card: the oldest first); nothing happens when none is in play",
  chooseOne: "the acting player (the defending player, in a Shadow effect) chooses 1 \"Lost:\" effect among the faceup cards in play and triggers it (no choice with only one; nothing with none)",
  eachDifferent: "starting with the first player, each player in turn chooses a \"Lost:\" effect in play that no earlier player chose in this resolution and triggers it before the next player chooses (two copies of one card are two effects; a player with none left does nothing)",
};

/** The restriction The Long Dark's Sentinel of the Deep adds to Restrict (901604:A:1), or null for any other. */
export function longDarkRestrict(i: Obj): Made | null {
  return i.what === "draw" && i.engagedPlayer === true ? { text: "the player this enemy is engaged with cannot draw cards through card effects while it is engaged (the framework's draws are not card effects)", read: ["what", "engagedPlayer"] } : null;
}

export const LONG_DARK_TEMPLATES: Readonly<Record<string, (i: Obj, ctx: Ctx) => Made>> = {
  LocateTest: (i) => ({
    text: `${TESTER[str(i.who ?? "actor")] ?? str(i.who)} makes a locate test: they may discard 1 card from their hand to discard the top card of the encounter deck, again and again; an encounter card that prints PASS passes the test (no ill effects follow), any other lets them try again; the test is failed when they stop or have no card to discard (an empty encounter deck is refilled from the discard pile in the quest phase, and otherwise the test is failed at once)`,
    read: ["who"],
  }),
  TriggerLost: (i) => ({ text: LOST[str(i.mode)] ?? `trigger Lost effects (${str(i.mode)})`, read: ["mode"] }),
  PlaceHeldProgress: () => ({ text: "the progress the event held back (the whole placement, the effect's X) is now placed on this location without another test; what does not fit goes on the current quest as an explored active location's overflow does", read: [] }),
  EnemiesGainSurge: () => ({ text: "while this card is in force, each enemy revealed from the encounter deck gains surge as it is revealed (one dealt as a shadow card or added to the staging area gains none)", read: [] }),
};

export const LONG_DARK_CONDITIONS: Readonly<Record<string, (c: Obj, ctx: Ctx) => Made>> = {
  lastLocateFailed: () => ({ text: "the last locate test the running effect made was failed (false before it has made one)", read: [] }),
  lastLocatePassed: () => ({ text: "the last locate test the running effect made was passed (false before it has made one)", read: [] }),
  playerWithoutReady: () => ({ text: "some player controls no unexhausted character (any one player, not every player)", read: [] }),
  hasPass: (c) => ({ text: `${CARD[str(c.card)] ?? str(c.card)} prints PASS in its text box`, read: ["card"] }),
  handSize: (c) => ({ text: c.actor === true ? `the acting player (the defending player, in a Shadow effect) holds at most ${str(c.max)} cards in hand` : `no player holds more than ${str(c.max)} cards in hand`, read: ["max", "actor"] }),
  drew: () => ({ text: "a Draw this effect ran drew at least 1 card (what follows \"then\" resolves only when it did)", read: [] }),
  engagedWithLastPlayer: () => ({ text: "this enemy is engaged with the last player (the first player in a one-player game)", read: [] }),
};

export const LONG_DARK_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  LocateTest: [{ verb: "LocateTest" }, { verb: "LocateTest", who: "firstPlayer" }],
  TriggerLost: [{ verb: "TriggerLost", mode: "all" }, { verb: "TriggerLost", mode: "chooseOne" }, { verb: "TriggerLost", mode: "eachDifferent" }],
  PlaceHeldProgress: [{ verb: "PlaceHeldProgress" }],
  EnemiesGainSurge: [{ verb: "EnemiesGainSurge" }],
};

export const LONG_DARK_CONDITION_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  lastLocateFailed: [{ kind: "lastLocateFailed" }],
  lastLocatePassed: [{ kind: "lastLocatePassed" }],
  playerWithoutReady: [{ kind: "playerWithoutReady" }],
  hasPass: [{ kind: "hasPass", card: "other" }, { kind: "hasPass", card: "picked" }, { kind: "hasPass", card: "subject" }],
  handSize: [{ kind: "handSize", max: 3 }, { kind: "handSize", max: 0, actor: true }],
  drew: [{ kind: "drew" }],
  engagedWithLastPlayer: [{ kind: "engagedWithLastPlayer" }],
};
