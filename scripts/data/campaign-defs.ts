// The campaigns the pipeline builds, one definition each. No source names a campaign: Hall of Beorn groups scenarios
// under products, and the booklets say which scenarios make a campaign. The definition is the hand-checked mapping.
//
// A scenario file belongs to the scenario, not to a campaign: The Oath and The Caves of Nibin-Dûm are in both
// `mirkwood-paths` (parts 4 and 5, tdom.mirkwood-paths) and `the-dark-of-mirkwood` (parts 1 and 2, tdom.mini-campaign).

export type ScenarioDef = {
  // The file name: data/scenarios/<id>.json.
  id: string;
  // The Hall of Beorn product whose Scenarios.json lists it, which is also the printing its cards come from.
  product: string;
  // The rules span (data/rules/index.json) that prints its encounter-deck paragraph.
  setupSpan: string;
};

export type CampaignDef = {
  id: string;
  name: string;
  // Hall of Beorn products the campaign's cards (campaign cards, boons, burdens) are looked up in.
  products: readonly string[];
  // In play order. A scenario another campaign also lists is built once.
  scenarios: readonly ScenarioDef[];
  // The booklet the campaign opens (src/screens/booklets/books.ts) and the rules document it is.
  bookletId: string;
  bookletDoc: string;
  // A saga campaign carries the Ring-bearer and the Fellowship rules (Fellowship of the Ring only).
  saga: boolean;
  // Where the scan-read ledger for this campaign lives (data/printed/<ledger>.json).
  ledger: string;
};

export const CAMPAIGNS: readonly CampaignDef[] = [
  {
    id: "fellowship-of-the-ring",
    name: "Fellowship of the Ring",
    products: ["The Black Riders", "The Road Darkens"],
    scenarios: [
      { id: "a-shadow-of-the-past", product: "The Black Riders", setupSpan: "mec109.setup-a-shadow-of-the-past" },
      { id: "a-knife-in-the-dark", product: "The Black Riders", setupSpan: "mec109.setup-a-knife-in-the-dark" },
      { id: "flight-to-the-ford", product: "The Black Riders", setupSpan: "mec109.setup-flight-to-the-ford" },
      { id: "the-ring-goes-south", product: "The Road Darkens", setupSpan: "mec109.setup-the-ring-goes-south" },
      { id: "journey-in-the-dark", product: "The Road Darkens", setupSpan: "mec109.setup-journey-in-the-dark" },
      { id: "breaking-of-the-fellowship", product: "The Road Darkens", setupSpan: "mec109.setup-breaking-of-the-fellowship" },
    ],
    bookletId: "fellowship-of-the-ring",
    bookletDoc: "mec109",
    saga: true,
    ledger: "fellowship-of-the-ring",
  },
  {
    id: "mirkwood-paths",
    name: "Mirkwood Paths",
    products: ["Revised Core Set", "The Dark of Mirkwood"],
    scenarios: [
      { id: "passage-through-mirkwood", product: "Revised Core Set", setupSpan: "ltp.setup-passage-through-mirkwood" },
      { id: "journey-along-the-anduin", product: "Revised Core Set", setupSpan: "ltp.setup-journey-along-the-anduin" },
      { id: "escape-from-dol-guldur", product: "Revised Core Set", setupSpan: "ltp.setup-escape-from-dol-guldur" },
      { id: "the-oath", product: "The Dark of Mirkwood", setupSpan: "tdom.setup-the-oath" },
      { id: "the-caves-of-nibin-dum", product: "The Dark of Mirkwood", setupSpan: "tdom.setup-the-caves-of-nibin-dum" },
    ],
    bookletId: "learn-to-play",
    bookletDoc: "learn-to-play",
    saga: false,
    ledger: "mirkwood-paths",
  },
  {
    id: "the-dark-of-mirkwood",
    name: "The Dark of Mirkwood",
    products: ["The Dark of Mirkwood"],
    scenarios: [
      { id: "the-oath", product: "The Dark of Mirkwood", setupSpan: "tdom.setup-the-oath" },
      { id: "the-caves-of-nibin-dum", product: "The Dark of Mirkwood", setupSpan: "tdom.setup-the-caves-of-nibin-dum" },
    ],
    bookletId: "the-dark-of-mirkwood",
    bookletDoc: "tdom",
    saga: false,
    ledger: "mirkwood-paths",
  },
];

// Every Hall of Beorn product some campaign is built from: what the sync snapshots scenario files for.
export const BUILT_PRODUCTS: ReadonlySet<string> = new Set(CAMPAIGNS.flatMap((campaign) => campaign.products));

// Hall of Beorn lists a scenario as "Passage Through Mirkwood (Campaign)" when it is the campaign-mode edition of a box
// that also prints a Nightmare or standalone scenario. The suffix is not part of the scenario's name.
export const CAMPAIGN_SUFFIX = / \(Campaign\)$/;

export function scenarioSlug(title: string): string {
  return title
    .replace(CAMPAIGN_SUFFIX, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// The built scenarios, each once, in the order the campaigns first list them.
export function scenarioDefs(): ScenarioDef[] {
  const seen = new Map<string, ScenarioDef>();
  for (const campaign of CAMPAIGNS) for (const scenario of campaign.scenarios) if (!seen.has(scenario.id)) seen.set(scenario.id, scenario);
  return [...seen.values()];
}

// The campaign whose generated effects file (src/effects/generated/<id>.ts) holds a product's box cards: the Oath is in two
// campaigns, and its records live once, with the box it is printed in.
export const PRODUCT_HOME: Readonly<Record<string, string>> = {
  "The Black Riders": "fellowship-of-the-ring",
  "The Road Darkens": "fellowship-of-the-ring",
  "Revised Core Set": "mirkwood-paths",
  "The Dark of Mirkwood": "the-dark-of-mirkwood",
};
