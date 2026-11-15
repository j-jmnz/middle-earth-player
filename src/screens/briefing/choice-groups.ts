// How a briefing lays out a Campaign Setup choice (docs/design-system.md, Briefing). A choice of a card for a hero (The Oath's Adaptation
// boons, 41050:A:2) arrives as every legal "card>hero" pair; the briefing asks for the card and the hero apart, so four boons and three heroes
// are seven rows, not twelve. Any other choice is one list. Pure, so a test reads it.
import { sphereTell } from "../../play/words/scenarios/aflame";

/** A choice of a card for a hero, split in two: the cards and the heroes in the order the options name them, and whether Skip is offered. */
export type PairedChoice = { cards: readonly string[]; hosts: readonly string[]; skip: boolean };

const SKIP = "skip";

function split(option: string): { card: string; host: string | null } {
  const [card = "", host] = option.split(">");
  return { card, host: host ?? null };
}

/** The choice split into its cards and heroes when every option but Skip is a card for a hero; null for any other choice. */
export function pairedChoice(options: readonly string[]): PairedChoice | null {
  const pairs = options.filter((option) => option !== SKIP).map(split);
  if (pairs.length === 0 || pairs.some((pair) => pair.host == null)) return null;
  return { cards: [...new Set(pairs.map((pair) => pair.card))], hosts: [...new Set(pairs.map((pair) => pair.host ?? ""))], skip: options.includes(SKIP) };
}

/** The option that puts `card` on `host`, or null when the choice does not offer that pair. */
export function pairOption(options: readonly string[], card: string, host: string): string | null {
  const option = `${card}>${host}`;
  return options.includes(option) ? option : null;
}

/** Whether `host` can carry `card`, or any card while none is picked. */
export function hostOffered(options: readonly string[], card: string | null, host: string): boolean {
  return options.some((option) => {
    const pair = split(option);
    return pair.host === host && (card == null || pair.card === card);
  });
}

/**
 * A tap on a card or a hero of a card-for-a-hero choice, in either order: the card and hero now picked (a hero the new card cannot go on is let
 * go) and the option they make once both are picked and offered.
 */
export function pickPair(options: readonly string[], card: string | null, host: string | null): { card: string | null; host: string | null; option: string | null } {
  const kept = card != null && host != null && !hostOffered(options, card, host) ? null : host;
  return { card, host: kept, option: card != null && kept != null ? pairOption(options, card, kept) : null };
}

/** The card an option names: itself, or the card of a "card>hero" pair. */
export function optionCard(option: string): string {
  return split(option).card;
}

/** What an option is called: its own words (put resources on the heroes), Skip, "card on hero", or the card's name with its sphere when copies share it. */
export function optionLabel(option: string, nameOf: (code: string) => string, printedText: Readonly<Record<string, string | null | undefined>>, words?: Readonly<Record<string, string>>): string {
  const plain = words?.[option];
  if (plain) return plain;
  if (option === SKIP) return "Skip";
  const { card, host } = split(option);
  if (host) return `${nameOf(card)} on ${nameOf(host)}`;
  return `${nameOf(card)}${sphereTell(nameOf(card), printedText[card])}`;
}
