// One group of cards the card-group route shows: an encounter set, a campaign's section, or the Messenger of the King's heroes. The route's
// params are the group's kind and id (`card-group/[kind]/[id]`); this resolves them against the Cards tab's trees. Pure.
import type { CampaignTree } from "./campaign-tree";
import type { GroupCard, TypeGroup } from "./group-types";
import { copiesOf } from "./group-types";
import { MOTK_NOTE, type MotkHero } from "./motk";
import type { ScenarioTree } from "./scenario-tree";

export type GroupKind = "set" | "campaign" | "motk";

export type CardGroup = {
  kind: GroupKind;
  id: string;
  title: string;
  /** The cards the group counts (the encounter deck's copies for a set), the number its subtitle and the tablet pane's title line say. */
  count: number;
  /** The line under the title ("Shadows of Mirkwood · 14 cards"). */
  subtitle: string;
  /** Whether the cards hold spoilers, so the route asks before it shows them (everything but the heroes). */
  spoiler: boolean;
  groups: readonly TypeGroup[];
};

/** Where a group is looked up: each tree is built on its first call (groups/cache.ts), so a route reads only the one its kind needs. */
export type GroupSource = { scenario: () => ScenarioTree; campaign: () => CampaignTree; motk: () => readonly MotkHero[] };

export const MOTK_GROUP_ID = "heroes";

export function isGroupKind(value: string | null | undefined): value is GroupKind {
  return value === "set" || value === "campaign" || value === "motk";
}

/** "14 cards", "1 card". */
export function cardsWord(count: number): string {
  return `${count} ${count === 1 ? "card" : "cards"}`;
}

// The heroes' group is built once for the heroes list it was made from (the list is never changed, so the key is sound).
const motkGroups = new WeakMap<readonly MotkHero[], CardGroup>();

function motkGroup(heroes: readonly MotkHero[]): CardGroup {
  let found = motkGroups.get(heroes);
  if (!found) {
    const cards: GroupCard[] = heroes.map((hero) => hero.card);
    const count = copiesOf([{ id: "hero", title: "", cards }]);
    found = { kind: "motk", id: MOTK_GROUP_ID, title: "Messenger of the King heroes", count, subtitle: `${cardsWord(count)} · ${MOTK_NOTE}`, spoiler: false, groups: [{ id: "hero", title: "Heroes", cards }] };
    motkGroups.set(heroes, found);
  }
  return found;
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
  if (id !== MOTK_GROUP_ID) return null;
  const heroes = source.motk();
  return heroes.length === 0 ? null : motkGroup(heroes);
}
