import type { Condition, Effect, Instruction } from "../../../src/catalog/boundary.ts";
import type { Card } from "../../../src/catalog/card-facts.ts";

// A template turns one whole line of card text into effect records. A line that no template matches in full
// is not partially matched: it goes to the drafts list for an agent (.agent/drafts, pnpm effects:draft).
// Records carry no id; generate.ts numbers them per card and timing, in text order.
export type Draft = Omit<Effect, "id" | "cardCode" | "lines">;

export type TemplateContext = {
  card: Card;
  // The code of a card named in text, among the cards of the scenario or campaign being built.
  codeOf(name: string): string | null;
  // Codes in the scenario's set-aside pile.
  setAside: ReadonlySet<string>;
};

export type Template = {
  id: string;
  // Matched against the line with the card's own name replaced by {self}.
  pattern: RegExp;
  build(match: RegExpExecArray, context: TemplateContext): Draft[] | null;
};

export const NUMBER_WORDS: Readonly<Record<string, number>> = { a: 1, an: 1, one: 1, two: 2, three: 3 };

export function count(word: string | undefined): number {
  if (word === undefined) return 1;
  return NUMBER_WORDS[word.toLowerCase()] ?? Number(word);
}

export function repeat(instruction: Instruction, times: number): Instruction[] {
  return Array.from({ length: times }, () => instruction);
}

// "you have failed a Hide test this round", "The One Ring is exhausted".
export function conditionOf(text: string, context: TemplateContext): Condition | null {
  if (/^(?:you have|the defending player) (?:failed|has failed) a Hide test this round$/i.test(text)) return { kind: "hideFailed", scope: "round" };
  const exhausted = /^(.+?) is exhausted$/.exec(text);
  const code = exhausted?.[1] ? context.codeOf(exhausted[1]) : null;
  return code ? { kind: "exhausted", code, is: true } : null;
}

export const ATTACK = (amount: number, extra?: { when: Condition }): Instruction => ({ verb: "ModifyStat", stat: "attack", amount, until: "endOfAttack", target: "attacker", ...extra });

export const STATS: Readonly<Record<string, "willpower" | "attack" | "defense" | "threat">> = { Willpower: "willpower", Attack: "attack", Defense: "defense", Threat: "threat" };

// A printed stat word, hit points included in any case ("+4 Hit Points", 01040:A:2; "+2 hit points", 141019:A:3).
export function statOf(word: string): "willpower" | "attack" | "defense" | "threat" | "hitPoints" | null {
  if (/^hit points?$/i.test(word)) return "hitPoints";
  return STATS[word] ?? null;
}
export const SPHERES: Readonly<Record<string, "leadership" | "tactics" | "spirit" | "lore">> = { Leadership: "leadership", Tactics: "tactics", Spirit: "spirit", Lore: "lore" };
export const OWN = { kind: "sourceIn", zone: "play" } as const;
export const STAT = (stat: "willpower" | "attack" | "defense" | "threat", amount: number, target: "host" | "self" | "heroes", extra?: { when?: Condition; per?: "hobbitHero" }): Instruction => ({
  verb: "ModifyStat",
  stat,
  amount,
  until: "whileSourceInPlay",
  target,
  ...extra,
});
export const HIGH_COST = "an? enemy with an engagement cost higher than your threat";

// "a Hobbit hero", "an Istari character", "the Ring-bearer", "the active location", "Gandalf", "a location", "an enemy engaged
// with a player".
export function attachHost(text: string): Extract<Instruction, { verb: "AttachesTo" }>["host"] | null {
  const bare = text.replace(/^(?:an?|the) /, "");
  if (bare === "hero" || bare === "character") return { kind: bare };
  if (bare === "Ring-bearer") return { kind: "ringBearer" };
  if (bare === "active location") return { kind: "activeLocation" };
  if (bare === "location" && text !== bare) return { kind: "location" };
  if (bare === "enemy engaged with a player") return { kind: "engagedEnemy" };
  const typed = /^(\w+) (hero|character)$/.exec(bare);
  if (typed?.[1] && typed[2]) return { kind: typed[2] as "hero" | "character", trait: typed[1] };
  if (/^[A-Z][\w']*$/.test(bare) && text === bare) return { kind: "character", name: bare };
  return null;
}
