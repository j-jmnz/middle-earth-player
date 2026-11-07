// Rules: mec112.campaign-mode-aragorn, rr.campaign-cards (data/rules/entries.json). What a won Two Towers scenario's Resolution writes into the log's own columns (src/campaign/log.ts calls these): the hero lists
// after a fallen hero returned and heroes were removed, the permanent threat penalty each seat took, and what each seat chose in The Passage of the Marshes. Pure.
import type { CampaignFacts, ResolutionLog } from "../rules/core/campaign-state.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { fallenAfter, heroesAfter } from "../rules/families/campaign/hero-lists.ts";

import type { CampaignLog, MarshesChoice } from "./log.ts";
import { TWO_TOWERS_CAMPAIGN } from "./saga.ts";

/** The hero lists by seat after the Resolution: a hero brought back joins its player's list, a hero removed leaves it. */
export function revisedHeroes(heroes: readonly (readonly string[])[], result: ResolutionLog): string[][] {
  return heroes.map((list, seat) => heroesAfter(list, seat, result));
}

/** The fallen lists by seat after the Resolution: a hero brought back is on none of them. */
export function revisedFallen(fallen: readonly (readonly string[])[], result: ResolutionLog): string[][] {
  return fallen.map((list) => fallenAfter(list, result));
}

/** The permanent starting threat penalty each seat takes of its own: the log's, plus what this Resolution added (the log's own list when it added none). */
export function penaltiesAfter(logged: readonly number[], result: ResolutionLog, seatCount: number): readonly number[] {
  if ((result.threatPenalties ?? []).length === 0) return logged;
  const out = Array.from({ length: Math.max(seatCount, logged.length) }, (_, seat) => logged[seat] ?? 0);
  for (const penalty of result.threatPenalties ?? []) out[penalty.seat] = (out[penalty.seat] ?? 0) + penalty.amount;
  return out;
}

/** What each seat chose in The Passage of the Marshes: the log's, with this Resolution's answers written in (the log's own list when it has none). */
export function marshesAfter(logged: readonly (MarshesChoice | null)[], result: ResolutionLog, seatCount: number): readonly (MarshesChoice | null)[] {
  if (!(result.picks ?? []).some((pick) => pick.name === "marshes")) return logged;
  const out: (MarshesChoice | null)[] = Array.from({ length: Math.max(seatCount, logged.length) }, (_, seat) => logged[seat] ?? null);
  for (const pick of result.picks ?? []) {
    if (pick.name === "marshes" && (pick.option === "penalty" || pick.option === "searchingEye")) out[pick.seat] = pick.option;
  }
  return out;
}

/** The Campaign Log's hero lists as a game reads them (`CampaignFacts.heroLog`), for The Two Towers only: ReviveFallenHero and TrimHeroes work on them. The Fellowship-sphere heroes among them are the saga's and are never removed; the captives the log names are there for a quest card's Setup ("choose each captive from the Campaign Log instead", 143069:A). */
export function twoTowersFacts(log: Pick<CampaignLog, "heroesBySeat" | "fallenHeroesBySeat" | "captives">, campaignId: string, cards: ReadonlyMap<string, PrintedCard>): Pick<CampaignFacts, "heroLog"> {
  if (campaignId !== TWO_TOWERS_CAMPAIGN) return {};
  const fellowship = [...new Set([...log.heroesBySeat.flat(), ...log.fallenHeroesBySeat.flat()])].filter((code) => cards.get(code)?.type === "hero" && cards.get(code)?.sphere === "fellowship");
  return { heroLog: { heroes: log.heroesBySeat, fallen: log.fallenHeroesBySeat, fellowship, captives: log.captives } };
}
