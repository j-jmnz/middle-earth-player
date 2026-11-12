// Rules: dcce.scalable-upgradable (data/rules/entries.json). What the Dream-chaser campaign log's marks mean to a game, read from
// `state.campaignFacts`: a scalable card's level, which its text's X reads, and the side an upgraded card is dealt on. Types only from state.ts, so
// zones.ts can use it.
import type { CardFace, ScenarioState } from "../../core/state.ts";

/** A scalable card's level: the boxes marked beside it in the Campaign Log (dcce.scalable-upgradable). 0 where the log marks none, and in every
 * game with no campaign facts. A record's "X" is this number. */
export function levelOfCard(state: Pick<ScenarioState, "campaignFacts">, code: string): number {
  return state.campaignFacts?.levels?.[code] ?? 0;
}

/** The upgradable cards of the Campaign Log whose Upgraded side is in none of the sources (the scan ledger, Hall of Beorn, DragnCards): MEC111 lists The Havens Burn and the Dream-chaser location as
 * upgradable, but no text for their other side exists. They are never upgraded and never dealt on a side with no lines. */
export const NO_UPGRADED_SIDE: ReadonlySet<string> = new Set(["11038", "11039"]);

/** The cards that print no Upgraded side (the ledger, data/printed/dream-chaser.json, has side A only) although the log can mark them: the two above, Gavin (his mark means "Gavin returned") and the four Send for Help events. They are never dealt on side B. */
const NO_B_SIDE: ReadonlySet<string> = new Set([...NO_UPGRADED_SIDE, "11210", "11211", "11212", "11213", "11214"]);

/** The face a card is dealt on: an upgraded card (every box marked) has its Upgraded side up, side B, for the rest of the campaign, unless that side has no text (NO_B_SIDE); any other
 * dealt faceup card keeps its face. */
export function dealtFace(state: Pick<ScenarioState, "campaignFacts">, code: string, face: CardFace): CardFace {
  return face === "up" && state.campaignFacts?.upgraded?.includes(code) && !NO_B_SIDE.has(code) ? "B" : face;
}
