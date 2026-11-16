// The escape family's pieces (src/catalog/families/escape.ts) and the small verbs The Dead Marshes needs beside it: templates for its verbs and conditions, the words of its stat flags and the samples read-fields.test.ts checks them with.
import { renderAmount } from "./amounts.ts";
import { isObj, str, type Ctx, type Obj } from "./kit.ts";
import { renderPick } from "./picks.ts";

type Made = { text: string; read: readonly string[] };
const amount = (value: unknown, ctx: Ctx): string => renderAmount(value, ctx, renderPick);

const TESTER: Readonly<Record<string, string>> = {
  actor: "the acting player",
  firstPlayer: "the first player",
  picked: "the picked player",
  party: "the party: every player, the first player first, commits to one shared test",
};
const STAT: Readonly<Record<string, string>> = { willpower: "Willpower", attack: "Attack", defense: "Defense" };

export const ESCAPE_TEMPLATES: Readonly<Record<string, (i: Obj, ctx: Ctx) => Made>> = {
  EscapeTest: (i, ctx) => ({
    text: `${TESTER[str(i.who ?? "actor")] ?? str(i.who)} makes an escape test: each commits any ready characters it controls (exhausting them), the players take actions once, then ${typeof i.cards === "number" ? `${i.cards} card${i.cards === 1 ? "" : "s"}` : `a number of cards equal to ${amount(i.cards, ctx)}`} ${i.cards === 1 ? "is" : "are"} dealt from the encounter deck, each counting its Escape value; the committed ${STAT[str(i.stat ?? "willpower")] ?? str(i.stat)} must be higher than the Escape counted (a tie fails)`,
    read: ["who", "cards", "stat"],
  }),
  EscapeValue: (i) => ({ text: `this card counts Escape ${str(i.amount)} while it is dealt for an escape test (it does nothing in play)`, read: ["amount"] }),
  AddToX: (i, ctx) => ({ text: `the effect's X grows by ${amount(i.amount, ctx)}`, read: ["amount"] }),
  MoveResources: (i, ctx) => ({ text: `move ${i.all === true ? "all the resource tokens" : `${amount(i.amount, ctx)} resource tokens`} from the card picked before the last to the last card picked`, read: ["amount", "all"] }),
  ReturnFromDiscard: (i, ctx) => ({ text: `return the topmost ${amount(i.count, ctx)} ${str(i.trait)} enemies of the encounter discard pile to the staging area (they are not revealed: no When Revealed, no engagement; the number returned is counted)`, read: ["trait", "count"] }),
};

export const ESCAPE_CONDITIONS: Readonly<Record<string, (c: Obj, ctx: Ctx) => Made>> = {
  lastEscapeFailed: () => ({ text: "the last escape test the running effect made was failed (false before it has made one)", read: [] }),
  lastEscapePassed: () => ({ text: "the last escape test the running effect made was passed (false before it has made one)", read: [] }),
  noneReturned: () => ({ text: "the running effect returned no card to the staging area (ReturnToStaging, ReturnFromDiscard)", read: [] }),
};

// The plain words a stat flag of the family adds after its name.
export const ESCAPE_STAT_NOTES: Readonly<Record<string, string>> = {
  escapeValueBonus: " (each card dealt for an escape test counts this much more Escape, a card with no printed value too; the amounts held add up)",
  escapeSelfValue: " (its own Escape value is added to every escape test while it is in play, once for each such card)",
  escapeCommitLimit: " (that player cannot commit more than this many characters to an escape test; the tightest limit holds)",
  shufflesAtTokens: " (it is shuffled into the encounter deck, its tokens gone, as soon as it holds this many resource tokens)",
  redirectResources: " (resource tokens that would be placed on a card named by its code that is not in play are placed on this card instead)",
  holdsWin: " (defeating this final stage does not win the game: it stays the current quest card, defeated, and its own Forced effects win the game or reset the quest)",
};

// Samples that set every field a template here reads (read-fields.test.ts): removing one must change the text.
export const ESCAPE_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  EscapeTest: [{ verb: "EscapeTest", who: "party", cards: { players: true }, stat: "attack" }, { verb: "EscapeTest", who: "firstPlayer", cards: 2 }, { verb: "EscapeTest", who: "picked", cards: 1 }],
  EscapeValue: [{ verb: "EscapeValue", amount: 3 }],
  AddToX: [{ verb: "AddToX", amount: 2 }],
  MoveResources: [{ verb: "MoveResources", all: true }, { verb: "MoveResources", amount: 2 }],
  ReturnFromDiscard: [{ verb: "ReturnFromDiscard", trait: "Undead", count: { players: true } }],
};
export const ESCAPE_CONDITION_SAMPLES: Readonly<Record<string, readonly Obj[]>> = { lastEscapeFailed: [{ kind: "lastEscapeFailed" }], lastEscapePassed: [{ kind: "lastEscapePassed" }], noneReturned: [{ kind: "noneReturned" }] };

/** What a pick's `on` says: the cards it is attached to and whose they are ("on a character you control with 3 or more Willpower"). */
export function onWords(on: unknown): string | null {
  if (!isObj(on) || typeof on.type !== "string" || typeof on.control !== "string") return null;
  const control = on.control === "you" ? "you control" : on.control === "other" ? "another player controls" : "any player controls";
  const will = typeof on.minWillpower === "number" ? ` with ${on.minWillpower} or more Willpower` : "";
  return `attached to a ${on.type} (${control})${will}`;
}
