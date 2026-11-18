// One group of cards the card-group route shows: an encounter set, a campaign's section, or the Messenger of the King's heroes. The route's
// params are the group's kind and id (`card-group/[kind]/[id]`); this resolves them against the Cards tab's trees. Pure.
import type { CampaignTree } from "./campaign-tree";
import type { GroupCard, TypeGroup } from "./group-types";
import { copiesOf } from "./group-types";
import type { MotkHero } from "./motk";
import type { ScenarioTree } from "./scenario-tree";

export type GroupKind = "set" | "campaign" | "motk";

export type CardGroup = {
  kind: GroupKind;
  id: string;
  title: string;
  /** The line under the title ("Shadows of Mirkwood · 14 cards"). */
  subtitle: string;
  /** Whether the cards hold spoilers, so the route asks before it shows them (everything but the heroes). */
  spoiler: boolean;
  groups: readonly TypeGroup[];
};

/** The trees a group is looked up in. */
export type GroupTrees = { scenario: ScenarioTree; campaign: CampaignTree; motk: readonly MotkHero[] };

export const MOTK_GROUP_ID = "heroes";

export function isGroupKind(value: string | null | undefined): value is GroupKind {
  return value === "set" || value === "campaign" || value === "motk";
}

/** "14 cards", "1 card". */
export function cardsWord(count: number): string {
  return `${count} ${count === 1 ? "card" : "cards"}`;
}

export function cardGroupOf(trees: GroupTrees, kind: GroupKind, id: string): CardGroup | null {
  if (kind === "set") {
    const found = trees.scenario.byKey.get(id);
    if (!found) return null;
    const where = found.product.packs.length > 1 || found.pack.name !== found.product.title ? found.pack.name : found.product.title;
    return { kind, id, title: found.set.name, subtitle: `${where} · ${cardsWord(found.set.count)}`, spoiler: true, groups: found.set.groups };
  }
  if (kind === "campaign") {
    const found = trees.campaign.byKey.get(id);
    if (!found) return null;
    return { kind, id, title: found.section.title, subtitle: `${found.campaign.name} · ${cardsWord(found.section.count)}`, spoiler: true, groups: found.section.groups };
  }
  if (id !== MOTK_GROUP_ID || trees.motk.length === 0) return null;
  const cards: GroupCard[] = trees.motk.map((hero) => hero.card);
  return { kind, id, title: "Messenger of the King heroes", subtitle: `Browse only · ${cardsWord(copiesOf([{ id: "hero", title: "", cards }]))}`, spoiler: false, groups: [{ id: "hero", title: "Heroes", cards }] };
}
