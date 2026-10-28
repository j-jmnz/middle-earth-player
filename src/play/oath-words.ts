// The words of the choices The Oath asks (src/effects/authored/the-oath.ts, pool/TDoM.ts): the card a search offers, the hero a boon or burden goes on,
// the cards to discard, and the verbs of the campaign and encounter families The Oath's records hold (src/catalog/families/{campaign,encounter}.ts).
import type { Effect, Instruction } from "../catalog/boundary.ts";
import { printedOf } from "../rules/printed.ts";
import type { ReduceContext } from "../rules/reduce.ts";

function article(noun: string): string {
  return /^[aeiou]/i.test(noun) ? `an ${noun}` : `a ${noun}`;
}

function count(amount: unknown): string {
  return typeof amount === "number" ? String(amount) : "X";
}

/** The kind of card a search is for: "a Forest location", "a Goblin enemy", or the card's name. */
function searched(instruction: Extract<Instruction, { verb: "SearchMove" | "SearchReveal" }>, nameOf: (code: string) => string): string {
  if (instruction.code) return nameOf(instruction.code);
  return article([instruction.trait, instruction.type ?? (instruction.verb === "SearchMove" ? "card" : "card")].filter((part): part is string => part != null).join(" "));
}

/** What an asking instruction wants chosen, or null when it is not one of The Oath's. `sourceName` is the card the effect is on. */
export function oathPickWords(asked: Instruction, nameOf: (code: string) => string, sourceName: string | null): { verb: string; prompt: string } | null {
  switch (asked.verb) {
    case "SearchMove": {
      const kind = searched(asked, nameOf);
      const place = asked.to === "engaged" ? "to put into play engaged with you" : asked.to === "engagedFirstPlayer" ? "to put into play engaged with the first player" : "to add to the staging area";
      return { verb: asked.to === "engaged" ? "Engage" : "Add", prompt: `Choose ${kind} from the encounter deck or discard pile ${place}.` };
    }
    // The heroes tied for the highest threat cost (41043:A:2) or the heroes a card may go on: which one carries it.
    case "AttachSelf":
      return asked.to.kind === "hero" ? { verb: "Attach", prompt: `Choose a hero to carry ${sourceName ?? "this card"}.` } : null;
    case "ReturnToStaging":
      return asked.target.kind === "engagedEnemies" ? { verb: "Return", prompt: "Choose an enemy engaged with you to return to the staging area." } : null;
    case "DiscardFromHand":
      return { verb: "Discard", prompt: `Choose ${count(asked.amount)} card${asked.amount === 1 ? "" : "s"} to discard from your hand, one at a time.` };
    default:
      return null;
  }
}

/** One instruction of the campaign and encounter families that The Oath's records hold, in words, or null when it is not one of them. */
export function oathWords(instruction: Instruction, nameOf: (code: string) => string): string | null {
  switch (instruction.verb) {
    case "SearchCollection":
      return `search the encounter deck, the discard pile and your collection for ${nameOf(instruction.code)} and add it to the staging area`;
    case "PlaceToken":
      return `place ${count(instruction.amount ?? 1)} resource token${(instruction.amount ?? 1) === 1 ? "" : "s"} on this card`;
    default:
      return null;
  }
}

/** What a card's tokens lead to at its Resolution ("6 or more tokens at the end earn Guilty Conscience.", 41050:B:1), or nothing when it counts none. */
export function tokenOutcome(ctx: ReduceContext, code: string): string[] {
  const resolution = ctx.effects.filter((effect: Effect) => effect.cardCode === code && effect.timing === "resolution");
  return resolution.flatMap((effect) =>
    effect.instructions.flatMap((instruction) => {
      const when = "when" in instruction ? instruction.when : undefined;
      if (instruction.verb !== "Earn" || when?.kind !== "tokens") return [];
      const names = instruction.codes.map((earned) => printedOf(ctx.cards, earned).name);
      return [`${when.min} or more tokens at the end earn ${names.join(" and ")}.`];
    }),
  );
}
