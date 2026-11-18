// One scenario's cards as a group of the card-group route (docs/design-system.md, Card groups): its campaign card, its quest cards in stage
// order, every card its encounter sets deal under their type's heading with the copies the scenario file deals in Normal and Easy Mode, and,
// where a Nightmare deck is printed for it, the deck's setup card and its cards (user decision, 2026-11-18). The campaign setup opens it for
// each scenario. Pure: the rows come from groups/cache.ts and the scenario from its data file.
import { groupCard, placementCopies, SCENARIO_TYPES, setsCount, typeGroups, type GroupRow, type TypeGroup } from "./group-types";

/** What a scenario file says that this reads (`AnyScenarioData`). */
export type ScenarioLike = {
  stages: readonly string[];
  encounterSets: readonly { count: number }[];
  cards: readonly { code: string; normal: number; easy: number; pile: string }[];
  campaignCard?: string | undefined;
  nightmare?: { setupCard: string; cards: readonly { code: string; copies: number }[] } | undefined;
};

export type ScenarioCards = {
  groups: readonly TypeGroup[];
  /** The booklet's Normal count of its encounter sets: the number the briefing and the campaign's lists say. */
  count: number;
};

function rowsOf(codes: readonly string[], byCode: ReadonlyMap<string, GroupRow>): GroupRow[] {
  return codes.flatMap((code) => {
    const row = byCode.get(code);
    return row ? [row] : [];
  });
}

export function scenarioCards(scenario: ScenarioLike, byCode: ReadonlyMap<string, GroupRow>): ScenarioCards {
  const stages = new Set(scenario.stages);
  // A card placed in several piles counts each placement's copies.
  const counts = placementCopies(scenario.cards, stages);
  const dealt = [...counts].flatMap(([code, copies]): GroupRow[] => {
    const row = byCode.get(code);
    return row && copies.normal > 0 ? [{ ...row, quantity: copies.normal }] : [];
  });
  // The stages and the dealt cards share one call, so a quest card the scenario sets aside joins the stages' heading.
  const cards = typeGroups([...rowsOf(scenario.stages, byCode), ...dealt], SCENARIO_TYPES, { easy: counts });
  const campaign = rowsOf(scenario.campaignCard ? [scenario.campaignCard] : [], byCode);
  const nightmare = scenario.nightmare;
  const setup = rowsOf(nightmare ? [nightmare.setupCard] : [], byCode);
  const added = (nightmare?.cards ?? []).flatMap((card): GroupRow[] => {
    const row = byCode.get(card.code);
    return row ? [{ ...row, quantity: card.copies }] : [];
  });
  const groups: TypeGroup[] = [
    ...(campaign.length > 0 ? [{ id: "campaign-card", title: "Campaign card", cards: campaign.map((row) => groupCard(row)) }] : []),
    ...cards,
    ...(setup.length > 0 ? [{ id: "nightmare-setup", title: "Nightmare setup", cards: setup.map((row) => groupCard(row)) }] : []),
    ...(added.length > 0 ? [{ id: "nightmare-cards", title: "Nightmare cards", cards: typeGroups(added, SCENARIO_TYPES).flatMap((group) => group.cards) }] : []),
  ];
  return { groups, count: setsCount(scenario.encounterSets) };
}
