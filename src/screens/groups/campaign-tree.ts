// The campaigns' sections of the Cards tab's Encounter cards view as data: each campaign and cycle of data/campaigns/index.json in its `position` order, with the sections its
// cards fall in: the campaign cards, Boons, Burdens and Treasures, and the cards a campaign holds that fit none ("Other cards": The One Ring
// of a saga box, Hard Mode, the side quests a campaign card adds). A campaign card is tied to its campaign by the pack it is printed in
// (`campaignId`); the Hobbit treasures, in packs no campaign owns, are filed under the collection's saga entry that holds their pack, a section for
// each box. A boon or a burden says the scenario that gives it where `data/` says (a scenario's `campaignPlaced`, a burden's set). Pure.
import { MOTK_PACK } from "./motk";
import { PLAYER_TYPES, SCENARIO_TYPES, copiesOf, typeGroups, type GroupRow, type TypeGroup } from "./group-types";
import { isScenarioRow } from "./scenario-tree";

export type CampaignSection = {
  /** `<campaign>~<kind>`, or `<campaign>~treasures~<pack>`: the route's id. */
  key: string;
  kind: "campaign-cards" | "boons" | "burdens" | "treasures" | "other";
  title: string;
  /** The box a Treasures section is printed in ("Over Hill and Under Hill"), which the title carries after a dot. */
  box?: string;
  /** Copies the section holds. */
  count: number;
  groups: readonly TypeGroup[];
};

// A "box" is a collection entry no campaign or cycle of the index names (the print-on-demand packs): its campaign cards, boons and treasures stand alone.
export type CampaignNode = {
  id: string;
  name: string;
  kind: "campaign" | "cycle" | "box";
  sections: readonly CampaignSection[];
  /** The packs its cards are printed in, with how many of its cards each holds: what files the campaign under a product of the collection. */
  packs: ReadonlyMap<string, number>;
};

export type CampaignTree = {
  campaigns: readonly CampaignNode[];
  /** A campaign by its id. */
  byId: ReadonlyMap<string, CampaignNode>;
  byKey: ReadonlyMap<string, { campaign: CampaignNode; section: CampaignSection }>;
};

type CampaignLike = { id: string; name: string; kind: "campaign" | "cycle" | "box"; position: number };
type CollectionLike = { id: string; title: string; packs: readonly string[] };
type PackLike = { code: string; name: string };

/** Whether a row belongs to a campaign section: a campaign, boon, burden or treasure card, or any other card of a campaign that no set holds. */
export function isCampaignRow(row: GroupRow): boolean {
  return row.packCode !== MOTK_PACK && !isScenarioRow(row);
}

const SECTION_TITLES = { "campaign-cards": "Campaign cards", boons: "Boons", burdens: "Burdens", treasures: "Treasures", other: "Other cards" } as const;

function sectionKind(row: GroupRow): CampaignSection["kind"] {
  if (row.typeCode === "campaign") return "campaign-cards";
  if (row.campaignKind === "boon") return "boons";
  if (row.campaignKind === "burden") return "burdens";
  if (row.typeCode === "treasure" || row.campaignKind === "treasure") return "treasures";
  return "other";
}

// A boon or burden's line: the scenario whose campaign card places it, else a burden's own set (the name of the scenario that adds it).
function givenNote(givenBy: ReadonlyMap<string, string>): (row: GroupRow) => string | undefined {
  return (row) => {
    if (row.campaignKind !== "boon" && row.campaignKind !== "burden") return undefined;
    const scenario = givenBy.get(row.code) ?? row.burdenSet;
    return scenario ? `From ${scenario}` : undefined;
  };
}

export function campaignTree(rows: readonly GroupRow[], campaigns: readonly CampaignLike[], collection: readonly CollectionLike[], packs: readonly PackLike[], givenBy: ReadonlyMap<string, string>): CampaignTree {
  const ids = new Set(campaigns.map((campaign) => campaign.id));
  // The pack's own home where no card names a campaign: the collection entry that holds the pack (the Hobbit's boxes are the index's saga, the
  // print-on-demand packs a box of their own).
  const packHome = new Map(collection.flatMap((entry) => entry.packs.map((pack): [string, string] => [pack, entry.id])));
  const packNames = new Map(packs.map((pack) => [pack.code, pack.name]));
  const homeOf = (row: GroupRow): string | null => row.campaignId ?? packHome.get(row.packCode) ?? null;
  const own = rows.filter(isCampaignRow);
  const note = givenNote(givenBy);
  const nodes: CampaignNode[] = [];
  const homes: CampaignLike[] = [
    ...[...campaigns].sort((left, right) => left.position - right.position),
    ...collection.filter((entry) => !ids.has(entry.id)).map((entry) => ({ id: entry.id, name: entry.title, kind: "box" as const, position: 0 })),
  ];
  for (const campaign of homes) {
    const members = own.filter((row) => homeOf(row) === campaign.id);
    const sections: CampaignSection[] = [];
    for (const kind of ["campaign-cards", "boons", "burdens", "treasures", "other"] as const) {
      const ofKind = members.filter((row) => sectionKind(row) === kind);
      if (ofKind.length === 0) continue;
      // Treasures printed in packs no campaign owns are a section for each box that holds them.
      const split = kind === "treasures" && ofKind.some((row) => row.campaignId == null) ? [...new Set(ofKind.map((row) => row.packCode))] : [null];
      for (const pack of split) {
        const these = pack == null ? ofKind : ofKind.filter((row) => row.packCode === pack);
        const specs = kind === "boons" || kind === "burdens" ? [...PLAYER_TYPES, ...SCENARIO_TYPES] : SCENARIO_TYPES;
        const groups = typeGroups(these, specs, { note });
        sections.push({
          key: pack == null ? `${campaign.id}~${kind}` : `${campaign.id}~${kind}~${pack}`,
          kind,
          title: pack == null ? SECTION_TITLES[kind] : `${SECTION_TITLES[kind]} · ${packNames.get(pack) ?? pack}`,
          ...(pack == null ? {} : { box: packNames.get(pack) ?? pack }),
          count: copiesOf(groups),
          groups,
        });
      }
    }
    const held = new Map<string, number>();
    for (const row of members) held.set(row.packCode, (held.get(row.packCode) ?? 0) + 1);
    if (sections.length > 0) nodes.push({ id: campaign.id, name: campaign.name, kind: campaign.kind, sections, packs: held });
  }
  const byKey = new Map<string, { campaign: CampaignNode; section: CampaignSection }>();
  for (const campaign of nodes) for (const section of campaign.sections) byKey.set(section.key, { campaign, section });
  return { campaigns: nodes, byId: new Map(nodes.map((node) => [node.id, node])), byKey };
}
