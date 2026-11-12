// Rules: ltp.campaign-log, rr.campaign-log, ltp.fellowship-of-heroes, mec112.campaign-mode, mec113.campaign-mode (data/rules/entries.json). The saga is one campaign across its boxes
// (docs/brief.md, The Two Towers; The Return of the King): each box is its own campaign and save, and a new save of the next box may take in a finished save of the box before it, copying the
// Campaign Log columns the later scenarios read. The finished save is never edited. Pure.
import { andList } from "./carry-words.ts";
import { emptyLog, type CampaignLog } from "./log.ts";
import type { Save } from "./save.ts";
import { RETURN_OF_THE_KING_CAMPAIGN, TWO_TOWERS_CAMPAIGN } from "./saga.ts";

/** The box a saga box continues: the campaign whose finished save its new save may take in. */
export const SAGA_PREVIOUS: Readonly<Record<string, string>> = { [TWO_TOWERS_CAMPAIGN]: "fellowship-of-the-ring", [RETURN_OF_THE_KING_CAMPAIGN]: TWO_TOWERS_CAMPAIGN };

export type ContinueOffer = { saveId: string; campaignId: string; seatCount: 1 | 2; score: number; heroes: number; fallen: number; captives: number; pool: number; penalty: number; penaltyBySeat: readonly number[]; enemies: number };

type Candidate = Pick<Save, "id" | "campaignId" | "seatCount" | "log">;

/**
 * The finished saves a new save of `campaignId` may continue: each save of the campaign before it in the saga whose scenarios are all won and that no other save has
 * continued (`log.continuedFrom`), most recent first as `saves` lists them. `scenarios` is a campaign's scenario ids; one it does not know is never finished. A save that
 * continues an offer holds it until it is deleted: the offer then returns. An empty list for a campaign that continues no other.
 */
export function continueOffers(saves: readonly Candidate[], campaignId: string, scenarios: (campaignId: string) => readonly string[] | null): ContinueOffer[] {
  const previous = SAGA_PREVIOUS[campaignId];
  if (previous == null) return [];
  const taken = new Set(saves.flatMap((save) => (save.log.continuedFrom ? [save.log.continuedFrom] : [])));
  const ids = scenarios(previous);
  if (ids == null || ids.length === 0) return [];
  return saves.flatMap((save) => {
    const finished = save.campaignId === previous && ids.every((id) => save.log.completed.includes(id));
    if (!finished || taken.has(save.id)) return [];
    const { log } = save;
    return [{ saveId: save.id, campaignId: save.campaignId, seatCount: save.seatCount, score: log.score, heroes: log.heroesBySeat.flat().length, fallen: log.fallenHeroesBySeat.flat().length, captives: log.captives.length, pool: log.campaignPool.length, penalty: log.threatPenalty, penaltyBySeat: log.threatPenaltyBySeat, enemies: Object.values(log.blackGate).reduce((sum, count) => sum + count, 0) }];
  });
}

/**
 * The log a continued save starts with: the finished save's heroes, fallen heroes, threat penalties, campaign pool (with each card's burden set and the hero it is
 * attached to), captives and notes, and the enemies under The Black Gate that The Two Towers recorded (The Battle of the Pelennor Fields sets the Harad ones aside). Its scenarios, earned cards and per-scenario scores start empty and its Campaign Total carries on from the finished save's (`scoreBase`;
 * user decision, 2026-11-07). The finished save's own columns the next box does not read (its carry-over, XP, marks) are left behind.
 */
export function continuedLog(from: Pick<Save, "id" | "campaignId" | "seatCount" | "log">): CampaignLog {
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
    blackGate: log.blackGate,
    scoreBase: log.score,
    scoreBaseCampaigns: [...log.scoreBaseCampaigns, from.campaignId],
    score: log.score,
    continuedFrom: from.id,
  };
}

/** The name of the log's score-base row: the campaigns the base adds up ("Fellowship of the Ring and The Two Towers"); a log saved before it held that list names the box before this one. */
export function scoreBaseName(log: Pick<CampaignLog, "scoreBaseCampaigns">, campaignId: string, nameOf: (campaignId: string) => string | null): string {
  const named = log.scoreBaseCampaigns.map((id) => nameOf(id) ?? id);
  if (named.length > 0) return andList(named);
  const previous = SAGA_PREVIOUS[campaignId];
  return (previous ? nameOf(previous) : null) ?? "Finished campaign";
}
