// Rules: rr.campaign-pool, ltp.campaign-pool (data/rules/entries.json); the Resolutions of Escape from Dol Guldur, The Caves of
// Nibin-Dûm: "during your next campaign". A campaign's last Resolutions write `carryOver` cards on its log (log.ts). A new save may
// take them in: they go on its log as `carryIn`, and its first Campaign Setup Checklist (step 1) moves them into the pool.
import type { PoolCard } from "./log.ts";
import type { Save } from "./save.ts";

export type CarryOffer = { saveId: string; campaignId: string; cards: readonly PoolCard[] };

/**
 * The carry-over a new save may take in: each finished save of any campaign whose log holds cards for the next campaign, most
 * recent first as `saves` lists them. `scenarios` is a campaign's scenario ids; a campaign it does not know is never finished.
 */
export function carryOffers(saves: readonly Save[], scenarios: (campaignId: string) => readonly string[] | null): CarryOffer[] {
  return saves.flatMap((save) => {
    const ids = scenarios(save.campaignId);
    const finished = ids != null && ids.length > 0 && ids.every((id) => save.log.completed.includes(id));
    return finished && save.log.carryOver.length > 0 ? [{ saveId: save.id, campaignId: save.campaignId, cards: save.log.carryOver }] : [];
  });
}
