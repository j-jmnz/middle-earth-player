import type { Card } from "../../../src/catalog/card-facts.ts";
import type { CampaignData, AnyScenarioData } from "../../../src/catalog/scenario-data.ts";
import { CAMPAIGN_SUFFIX, PRODUCTS, type CampaignDef } from "../campaign-defs.ts";

// The RingsDB twin packs (PRODUCTS): DragnCards names the Fellowship boxes by product, RingsDB by these pack codes.
const TWIN_PACKS: ReadonlySet<string> = new Set(PRODUCTS.flatMap((product) => (product.twinPack ? [product.twinPack] : [])));

/** The catalog's cards by code, DragnCards' guid, twin-pack number and Hall of Beorn slug (the lookups scenarios.ts resolves a source's card through). */
export function indexCards(cards: readonly Card[]): { byCode: Map<string, Card>; byGuid: Map<string, Card>; byPackNumber: Map<string, Card>; bySlug: Map<string, Card> } {
  const byCode = new Map(cards.map((card) => [card.code, card]));
  const byGuid = new Map<string, Card>();
  const byPackNumber = new Map<string, Card>();
  const bySlug = new Map<string, Card>();
  const revCoreSlugs = new Map<string, Card>();
  for (const card of cards) {
    for (const printing of card.printings) {
      if (printing.octgnGuid) byGuid.set(printing.octgnGuid, card);
      if (TWIN_PACKS.has(printing.pack)) byPackNumber.set(`${printing.pack}:${printing.number}`, card);
      if (printing.hobSlug) bySlug.set(printing.hobSlug, card);
      // Hall of Beorn's scenario lists name a Revised Core Set card by its original Core Set slug ("Forest-Spider-Core"): Ered Mithrin's first two
      // scenarios deal the Revised Core Set's reprints of those cards (overrides.dragnPackAliases).
      if (printing.hobSlug?.endsWith("-RevCore")) revCoreSlugs.set(printing.hobSlug.replace(/-RevCore$/, "-Core"), card);
    }
  }
  for (const [slug, card] of revCoreSlugs) if (!bySlug.has(slug)) bySlug.set(slug, card);
  return { byCode, byGuid, byPackNumber, bySlug };
}

/**
 * Each campaign lists the scenarios of it that were built, in its own order. A campaign whose first scenario is a saga's
 * takes that scenario's player-1 play area as its prelude (the Fellowship's Ring-bearer attachments).
 */
export function campaignsOf(
  campaignDefs: readonly CampaignDef[],
  scenarios: readonly AnyScenarioData[],
  campaignCards: Readonly<Record<string, string>>,
  preludes: ReadonlyMap<string, { code: string }[]>,
  scenarioIndex: readonly { Title: string; Product: string }[] = [],
): { data: CampaignData; def: CampaignDef }[] {
  return campaignDefs.map((def) => {
    const built = def.scenarios.filter((scenario) => scenarios.some((item) => item.id === scenario.id));
    // The titles Hall of Beorn lists under the cycle's later products, product by product in the def's order.
    const later = def.kind === "cycle" ? (def.later ?? []).flatMap((product) => scenarioIndex.filter((entry) => entry.Product === product).map((entry) => entry.Title.replace(CAMPAIGN_SUFFIX, ""))) : [];
    const data: CampaignData = {
      id: def.id,
      name: def.name,
      scenarios: built.map((scenario) => scenario.id),
      ...(def.kind === "cycle" ? { kind: "cycle" as const } : {}),
      ...(later.length > 0 ? { later } : {}),
      // A cycle's scenarios have no campaign card (the file leaves the field out, which reads as empty).
      campaignCards: Object.fromEntries(built.flatMap((scenario) => (campaignCards[scenario.id] !== undefined ? [[scenario.id, campaignCards[scenario.id]]] : def.kind === "cycle" ? [] : [[scenario.id, ""]]))),
      ...(def.bookletId !== undefined ? { bookletId: def.bookletId } : {}),
      saga: def.saga,
      prelude: preludes.get(built[0]?.id ?? "") ?? [],
      starterDecks: [],
    };
    return { data, def };
  });
}

/** Whether a card's name is a word of a text, either apostrophe; `cache` holds the pattern built once for each name. */
export function mentions(cache: Map<string, RegExp>, name: string, text: string): boolean {
  let pattern = cache.get(name);
  if (!pattern) {
    pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['\u2019]/g, "['\u2019]")}\\b`);
    cache.set(name, pattern);
  }
  return pattern.test(text);
}
