// Rules: ltp.campaign-log, rr.campaign-log, ltp.fellowship-of-heroes, mec112.campaign-mode (data/rules/entries.json). The saga is one campaign across its boxes
// (docs/brief.md, The Two Towers): each box is its own campaign and save, and a new save of the next box may take in a finished save of the box before it, copying the
// Campaign Log columns the later scenarios read. The finished save is never edited. Pure.
import { emptyLog, type CampaignLog } from "./log.ts";
import type { Save } from "./save.ts";

/** The box a saga box continues: the campaign whose finished save its new save may take in. */
export const SAGA_PREVIOUS: Readonly<Record<string, string>> = { "the-two-towers": "fellowship-of-the-ring" };

export type ContinueOffer = { saveId: string; campaignId: string; seatCount: 1 | 2; score: number; heroes: number; fallen: number; pool: number };

type Candidate = Pick<Save, "id" | "campaignId" | "seatCount" | "log">;

/**
 * The finished saves a new save of `campaignId` may continue: each save of the campaign before it in the saga whose scenarios are all won and that no other save has
 * continued (`log.carriedFrom`), most recent first as `saves` lists them. `scenarios` is a campaign's scenario ids; one it does not know is never finished. A save that
 * continues an offer holds it until it is deleted: the offer then returns. An empty list for a campaign that continues no other.
 */
export function continueOffers(saves: readonly Candidate[], campaignId: string, scenarios: (campaignId: string) => readonly string[] | null): ContinueOffer[] {
  const previous = SAGA_PREVIOUS[campaignId];
  if (previous == null) return [];
  const taken = new Set(saves.flatMap((save) => (save.log.carriedFrom ? [save.log.carriedFrom] : [])));
  const ids = scenarios(previous);
  if (ids == null || ids.length === 0) return [];
  return saves.flatMap((save) => {
    const finished = save.campaignId === previous && ids.every((id) => save.log.completed.includes(id));
    if (!finished || taken.has(save.id)) return [];
    const { log } = save;
    return [{ saveId: save.id, campaignId: save.campaignId, seatCount: save.seatCount, score: log.score, heroes: log.heroesBySeat.flat().length, fallen: log.fallenHeroesBySeat.flat().length, pool: log.campaignPool.length }];
  });
}

/**
 * The log a continued save starts with: the finished save's heroes, fallen heroes, threat penalties, campaign pool (with each card's burden set and the hero it is
 * attached to), captives and notes. Its scenarios, earned cards and per-scenario scores start empty and its Campaign Total carries on from the finished save's (`scoreBase`;
 * user decision, 2026-11-07). The finished save's own columns the next box does not read (its carry-over, XP, marks) are left behind.
 */
export function continuedLog(from: Pick<Save, "id" | "seatCount" | "log">): CampaignLog {
  const { log } = from;
  return {
    ...emptyLog(from.seatCount),
    heroesBySeat: log.heroesBySeat,
    fallenHeroesBySeat: log.fallenHeroesBySeat,
    threatPenalty: log.threatPenalty,
    threatPenaltyBySeat: log.threatPenaltyBySeat,
    campaignPool: log.campaignPool,
    captives: log.captives,
    notes: log.notes,
    scoreBase: log.score,
    score: log.score,
    carriedFrom: from.id,
  };
}
