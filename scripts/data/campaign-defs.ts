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
  // DragnCards' 2011 core decks and Limited Collector's Edition decks (`Q01.1`, `E01.1`), where a deck of the same cards exists
  // for a box that has no load list of its own: the cross-check compares the built piles with them, copy counts only.
  crossCheck?: { normal: string; easy: string };
};

// A Hall of Beorn product (a box) the pipeline builds cards or scenarios from: the one table every other site derives from.
export type ProductDef = {
  // The Hall of Beorn product / CardSet name.
  name: string;
  // The RingsDB packs the box's cards are printed in: the Fellowship box is the MEC109 printing (TFotR), the others are RingsDB packs.
  packs: readonly string[];
  // The campaign whose generated effects file (src/effects/generated/<id>.ts) holds the box's cards: the Oath is in two
  // campaigns, and its records live once, with the box it is printed in.
  home: string;
  // Where a scenario's piles come from. "dragncards": the Q0C load list, with the quest card's Setup text as the check
  // (phase 8d). "setup": Hall of Beorn's counts lead and the printed Setup text places them (DragnCards has no such deck).
  load: "dragncards" | "setup";
  // The Easy Mode sheet (easy-mode.core-set) lists what Easy removes from this box's encounter sets.
  easySheet: boolean;
  // The RingsDB twin pack Hall of Beorn's cards are paired with, which is also the pack name DragnCards gives them (the
  // Fellowship boxes). null: the box's cards come from Hall of Beorn alone, stamped with packs[0].
  twinPack: string | null;
};

export const PRODUCTS: readonly ProductDef[] = [
  { name: "The Black Riders", packs: ["TFotR"], home: "fellowship-of-the-ring", load: "dragncards", easySheet: false, twinPack: "TBR" },
  { name: "The Road Darkens", packs: ["TFotR"], home: "fellowship-of-the-ring", load: "dragncards", easySheet: false, twinPack: "TRD" },
  { name: "Revised Core Set", packs: ["RevCore"], home: "mirkwood-paths", load: "setup", easySheet: true, twinPack: null },
  { name: "The Dark of Mirkwood", packs: ["TDoM"], home: "the-dark-of-mirkwood", load: "setup", easySheet: false, twinPack: null },
];

// The catalog's `cards.campaign_id`: the campaign a pack's cards belong to. A product with a twin pack (the Fellowship boxes, whose
// MEC109 printing is not a catalog pack) is tagged through that pack; the others through their own packs. Derived from PRODUCTS.
export const PACK_CAMPAIGN: ReadonlyMap<string, string> = new Map(
  PRODUCTS.flatMap((product) => (product.twinPack ? [product.twinPack] : product.packs).map((pack): [string, string] => [pack, product.home])),
);

// A product the table does not hold is a build error, never an empty default.
export function productOf(name: string): ProductDef {
  const product = PRODUCTS.find((item) => item.name === name);
  if (!product) throw new Error(`campaign-defs: no product "${name}" in PRODUCTS (scripts/data/campaign-defs.ts)`);
  return product;
}

// The packs of every product: the printings whose boons and burdens a built campaign deals.
export const PRODUCT_PACKS: ReadonlySet<string> = new Set(PRODUCTS.flatMap((product) => product.packs));

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

const OATH: ScenarioDef = { id: "the-oath", product: "The Dark of Mirkwood", setupSpan: "tdom.setup-the-oath", crossCheck: { normal: "Q00.01B", easy: "E00.01B" } };
const CAVES: ScenarioDef = { id: "the-caves-of-nibin-dum", product: "The Dark of Mirkwood", setupSpan: "tdom.setup-the-caves-of-nibin-dum", crossCheck: { normal: "Q00.02B", easy: "E00.02B" } };

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
      { id: "passage-through-mirkwood", product: "Revised Core Set", setupSpan: "ltp.setup-passage-through-mirkwood", crossCheck: { normal: "Q01.1", easy: "E01.1" } },
      { id: "journey-along-the-anduin", product: "Revised Core Set", setupSpan: "ltp.setup-journey-along-the-anduin", crossCheck: { normal: "Q01.2", easy: "E01.2" } },
      { id: "escape-from-dol-guldur", product: "Revised Core Set", setupSpan: "ltp.setup-escape-from-dol-guldur", crossCheck: { normal: "Q01.3", easy: "E01.3" } },
      OATH,
      CAVES,
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
      OATH,
      CAVES,
    ],
    bookletId: "the-dark-of-mirkwood",
    bookletDoc: "tdom",
    saga: false,
    ledger: "mirkwood-paths",
  },
];

// The packs of the products built from Hall of Beorn alone (no twin pack): their boons and burdens have a pool file of their own.
export const HOB_ONLY_PACKS: ReadonlySet<string> = new Set(PRODUCTS.flatMap((product) => (product.twinPack === null ? product.packs : [])));

// Every product a campaign or scenario names is in PRODUCTS.
for (const campaign of CAMPAIGNS) {
  for (const name of campaign.products) productOf(name);
  for (const scenario of campaign.scenarios) productOf(scenario.product);
}

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
export function scenarioDefs(campaigns: readonly CampaignDef[] = CAMPAIGNS): ScenarioDef[] {
  const seen = new Map<string, ScenarioDef>();
  for (const campaign of campaigns) for (const scenario of campaign.scenarios) if (!seen.has(scenario.id)) seen.set(scenario.id, scenario);
  return [...seen.values()];
}
