// One group of cards the card-group route shows: an encounter set, a campaign's section, or one scenario's cards (scenario-group.ts). The route's
// params are the group's kind and id (`card-group/[kind]/[id]`); this resolves them against the Cards tab's trees. Pure.
import type { ScenarioGroup } from "./cache";
import type { CampaignTree } from "./campaign-tree";
import type { TypeGroup } from "./group-types";
import type { ScenarioTree } from "./scenario-tree";

export type GroupKind = "set" | "campaign" | "scenario";

export type CardGroup = {
  kind: GroupKind;
  id: string;
  title: string;
  /** The cards the group counts (the encounter deck's copies for a set), the number its subtitle and the tablet pane's title line say. */
  count: number;
  /** The line under the title ("Shadows of Mirkwood · 14 cards"). */
  subtitle: string;
  /** Whether the cards hold spoilers, so the route asks before it shows them. */
  spoiler: boolean;
  groups: readonly TypeGroup[];
};

/** Where a group is looked up: each tree is built on its first call (groups/cache.ts), so a route reads only the one its kind needs. */
export type GroupSource = { scenario: () => ScenarioTree; campaign: () => CampaignTree; scenarioCards: (id: string) => ScenarioGroup | null };

export function isGroupKind(value: string | null | undefined): value is GroupKind {
  return value === "set" || value === "campaign" || value === "scenario";
}

/** "14 cards", "1 card". */
export function cardsWord(count: number): string {
  return `${count} ${count === 1 ? "card" : "cards"}`;
}

export function cardGroupOf(source: GroupSource, kind: GroupKind, id: string): CardGroup | null {
  if (kind === "set") {
    const found = source.scenario().byKey.get(id);
    if (!found) return null;
    const where = found.product.packs.length > 1 || found.pack.name !== found.product.title ? found.pack.name : found.product.title;
    return { kind, id, title: found.set.name, count: found.set.count, subtitle: `${where} · ${cardsWord(found.set.count)}`, spoiler: true, groups: found.set.groups };
  }
  if (kind === "campaign") {
    const found = source.campaign().byKey.get(id);
    if (!found) return null;
    const { campaign, section } = found;
    // A Treasures section keeps its plain title; the box it is printed in leads the line under it.
    const where = section.box ? `${section.box} · ${campaign.name}` : campaign.name;
    return { kind, id, title: section.kind === "treasures" ? "Treasures" : section.title, count: section.count, subtitle: `${where} · ${cardsWord(section.count)}`, spoiler: true, groups: section.groups };
  }
  if (kind === "scenario") {
    const found = source.scenarioCards(id);
    if (!found) return null;
    return { kind, id, title: found.name, count: found.cards.count, subtitle: `Scenario ${found.number} · ${cardsWord(found.cards.count)}`, spoiler: true, groups: found.cards.groups };
  }
  return null;
}
