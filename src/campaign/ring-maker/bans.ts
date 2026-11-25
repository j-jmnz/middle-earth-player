// Rules: rm.grima-objective-ally, rr.unique-cards (data/rules/entries.json). The titles The Ring-maker's scenarios refuse in the loadout. Pure.
import type { TitleBan } from "../saga.ts";

// The Fords of Isen puts the objective ally Gríma into play, so the hero Gríma (07002) cannot be used: two cards with one title would be in play (docs/scenarios/the-ring-maker/the-fords-of-isen.md, The Fords of Isen).
const NO_GRIMA_HERO: readonly TitleBan[] = [{ title: "Gríma", types: ["hero"], rule: "rm.grima-objective-ally" }];

/** The campaign whose box is The Ring-maker (data/campaigns/the-ring-maker.json). */
export const RING_MAKER_CAMPAIGN = "the-ring-maker";

/** The titles the players cannot use in this scenario of The Ring-maker. */
export function ringMakerTitleBans(scenarioId: string): readonly TitleBan[] {
  return scenarioId === "the-fords-of-isen" ? NO_GRIMA_HERO : [];
}
