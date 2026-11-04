import type { Card } from "../../../src/catalog/card-facts.ts";
import type { RuleEntry } from "../rules/spans.ts";
import type { NameIndex } from "./setup-text.ts";

// The cards a campaign card's text and the booklet's campaign paragraph name beyond its Setup clauses: they are dealt by the campaign, never by the load list.
export function campaignTextCodes(a: {
  names: NameIndex;
  byCode: ReadonlyMap<string, Card>;
  ruleById: ReadonlyMap<string, RuleEntry>;
  campaignCard: string;
  // The campaign card's other lines (The Thing in the Depths' Forced lines) name the Campaign Expansion's cards they deal.
  campaignLines: readonly string[];
  // The booklet's Setup span of a Dream-chaser scenario, whose campaign paragraph is dcce.campaign-setup-<id>; null for any other campaign.
  setupSpan: string | null;
  cardPacks: readonly string[];
}): string[] {
  const found: string[] = [];
  const ofThisBox = (code: string): boolean => a.byCode.get(code)?.printings.some((p) => a.cardPacks.includes(p.pack)) === true;
  // The Resolution on the back names its rewards: they are dealt by the campaign, never by the load list.
  // Dream-chaser's XP list ("Gain the following: 1 XP for each Corsair Warship in the victory display") names cards it only counts.
  found.push(...a.names.codesOf((a.byCode.get(a.campaignCard)?.back?.text ?? "").split("Gain the following")[0] ?? ""));
  if (a.setupSpan != null) {
    // The booklet's campaign paragraph (dcce.campaign-setup-<id>) lists the cards a campaign game needs ("all copies of Send for Help ... Set aside each Send for Help facedown"). The campaign
    // card names most of them in its Setup; a card only the paragraph names (the Send for Help cards, which Gavin's Planning Action shuffles in) is dealt by the campaign too.
    const paragraph = (a.ruleById.get(a.setupSpan.replace(".setup-", ".campaign-setup-"))?.text ?? "").replace(/\s+/g, " ");
    for (const code of a.names.allCodesOf(paragraph)) if (a.byCode.get(code)?.campaignKind != null && ofThisBox(code)) found.push(code);
    for (const code of a.names.codesOf(a.campaignLines.join(" "))) if (ofThisBox(code)) found.push(code);
  }
  return found;
}
