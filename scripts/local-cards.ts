import type { PrintedKeywords, RingsDbCard } from "../src/catalog/boundary.ts";

function printed(
  card: Pick<RingsDbCard, "code" | "name" | "type_code" | "type_name" | "position" | "quantity"> & Partial<RingsDbCard>,
): RingsDbCard {
  return {
    pack_code: "TBR",
    sphere_code: null,
    sphere_name: null,
    traits: null,
    text: null,
    is_unique: false,
    cost: null,
    deck_limit: null,
    threat: null,
    willpower: null,
    attack: null,
    defense: null,
    health: null,
    quest: null,
    victory: null,
    has_errata: false,
    imagesrc: null,
    engagement_cost: null,
    keywords: null,
    ...card,
  };
}

// Printed numbers, keywords, engagement cost, traits, and the unique flag were re-read 2026-10-24 from the
// Hall of Beorn pages for the MEC109 (The Fellowship of the Ring, TFotR) printing, a dev-time aid. Each value
// is for the user to confirm on the physical card. A keywords object of {} means the card was read and
// prints none. Unprinted numbers stay null. Ability text is not stored.
// `position` is the MEC109 collector number from those pages. The RingsDB-derived rows (141017, 141077,
// 141078, 141079) keep their RingsDB position; their MEC109 numbers are in the comment on KEYWORD_OVERRIDES.

// Three is Company, MEC109 #28 (quest 1). Side B quest points 1. No keywords. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
// A Shortcut to Mushrooms, MEC109 #29 (quest 2). Side B quest points 14. No keywords. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
// Escape to Buckland, MEC109 #30 (quest 3). Side B quest-point circle is a dash. No keywords. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
const quests: RingsDbCard[] = [
  printed({ code: "141022", keywords: {}, name: "Three is Company", type_code: "quest", type_name: "Quest", position: 28, quantity: 1, quest: 1 }),
  printed({
    code: "141023",
    keywords: {},
    name: "A Shortcut to Mushrooms",
    type_code: "quest",
    type_name: "Quest",
    position: 29,
    quantity: 1,
    quest: 14,
  }),
  printed({ code: "141024", keywords: {}, name: "Escape to Buckland", type_code: "quest", type_name: "Quest", position: 30, quantity: 1 }),
];

// Bag End, MEC109 #31. Unique. Threat 0, quest points 3, victory 1. No keywords. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
// Woody End, MEC109 #32. Unique. Threat 1, quest points 1, victory 1. No keywords. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
// Stock-brook, MEC109 #33. Unique. Threat 1, quest points 5, victory 1. No keywords. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
// Bamfurlong, MEC109 #34. Unique. Threat 2, quest points 2, victory 1. No keywords. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
// Bucklebury Ferry, MEC109 #35. Unique. Threat 3, quest points 9. Immune to player card effects. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
// Green Hill Country, MEC109 #36. Threat 2, quest points 3. No keywords. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
// Stock Road, MEC109 #37. Threat 3, quest points 3. No keywords. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
// The Marish, MEC109 #38. Threat 3, quest points 4. No keywords. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
const locations: RingsDbCard[] = [
  printed({
    code: "141031",
    keywords: {},
    name: "Bag End",
    type_code: "location",
    type_name: "Location",
    position: 31,
    traits: "Shire.",
    is_unique: true,
    quantity: 1,
    threat: 0,
    quest: 3,
    victory: 1,
  }),
  printed({
    code: "141032",
    keywords: {},
    name: "Woody End",
    type_code: "location",
    type_name: "Location",
    position: 32,
    traits: "Forest.",
    is_unique: true,
    quantity: 1,
    threat: 1,
    quest: 1,
    victory: 1,
  }),
  printed({
    code: "141033",
    keywords: {},
    name: "Stock-brook",
    type_code: "location",
    type_name: "Location",
    position: 33,
    traits: "Forest. Stream.",
    is_unique: true,
    quantity: 1,
    threat: 1,
    quest: 5,
    victory: 1,
  }),
  printed({
    code: "141034",
    keywords: {},
    name: "Bamfurlong",
    type_code: "location",
    type_name: "Location",
    position: 34,
    traits: "Shire.",
    is_unique: true,
    quantity: 1,
    threat: 2,
    quest: 2,
    victory: 1,
  }),
  printed({
    code: "141035",
    keywords: { immune: true },
    name: "Bucklebury Ferry",
    type_code: "location",
    type_name: "Location",
    position: 35,
    traits: "River.",
    is_unique: true,
    quantity: 1,
    threat: 3,
    quest: 9,
  }),
  printed({
    code: "141036",
    keywords: {},
    name: "Green Hill Country",
    type_code: "location",
    type_name: "Location",
    position: 36,
    traits: "Forest.",
    quantity: 3,
    threat: 2,
    quest: 3,
  }),
  printed({
    code: "141037",
    keywords: {},
    name: "Stock Road",
    type_code: "location",
    type_name: "Location",
    position: 37,
    traits: "Road.",
    quantity: 3,
    threat: 3,
    quest: 3,
  }),
  printed({
    code: "141038",
    keywords: {},
    name: "The Marish",
    type_code: "location",
    type_name: "Location",
    position: 38,
    traits: "Marshland.",
    quantity: 2,
    threat: 3,
    quest: 4,
  }),
  // Pathless Country, MEC109 #171. No keywords. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
  printed({
    code: "141072",
    keywords: {},
    name: "Pathless Country",
    type_code: "location",
    type_name: "Location",
    position: 171,
    traits: "Forest.",
    quantity: 3,
    threat: 2,
    quest: 3,
  }),
];

// Black Rider, MEC109 #39. Threat 4, attack 5, defense 4, hit points 6. Engagement 35, Hide 2. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
// Evil Crow, MEC109 #40. Threat 2, attack 0, defense 1, hit points 2. Engagement 25, no keywords. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
const enemies: RingsDbCard[] = [
  printed({
    code: "141039",
    keywords: { hide: 2 },
    engagement_cost: 35,
    name: "Black Rider",
    type_code: "enemy",
    type_name: "Enemy",
    position: 39,
    traits: "Nazgûl.",
    quantity: 5,
    threat: 4,
    attack: 5,
    defense: 4,
    health: 6,
  }),
  printed({
    code: "141040",
    keywords: {},
    engagement_cost: 25,
    name: "Evil Crow",
    type_code: "enemy",
    type_name: "Enemy",
    position: 40,
    traits: "Creature.",
    quantity: 3,
    threat: 2,
    attack: 0,
    defense: 1,
    health: 2,
  }),
];

// Crawling Towards Him, MEC109 #41. Peril, Hide 2. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
// Hunting for the Ring, MEC109 #42. Doomed 2. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
// Have You Seen Baggins?, MEC109 #43. Peril, Surge. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
// Piercing Cry, MEC109 #172. Peril. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
// Black Steed, MEC109 #173. Surge. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
// Rode Like a Gale, MEC109 #174. No keywords. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
// Lure of the Ring, MEC109 #175. Surge. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
const treacheries: RingsDbCard[] = [
  printed({ code: "141041", keywords: { peril: true, hide: 2 }, name: "Crawling Towards Him", type_code: "treachery", type_name: "Treachery", position: 41, quantity: 3 }),
  printed({ code: "141042", keywords: { doomed: 2 }, name: "Hunting for the Ring", type_code: "treachery", type_name: "Treachery", position: 42, quantity: 3 }),
  printed({
    code: "141043",
    keywords: { peril: true, surge: true },
    name: "Have You Seen Baggins?",
    type_code: "treachery",
    type_name: "Treachery",
    position: 43,
    quantity: 2,
  }),
  printed({ code: "141073", keywords: { peril: true }, name: "Piercing Cry", type_code: "treachery", type_name: "Treachery", position: 172, quantity: 3 }),
  printed({
    code: "141074",
    keywords: { surge: true },
    name: "Black Steed",
    type_code: "treachery",
    type_name: "Treachery",
    position: 173,
    traits: "Morgul.",
    quantity: 3,
  }),
  printed({ code: "141075", keywords: {}, name: "Rode Like a Gale", type_code: "treachery", type_name: "Treachery", position: 174, quantity: 2 }),
  printed({ code: "141076", keywords: { surge: true }, name: "Lure of the Ring", type_code: "treachery", type_name: "Treachery", position: 175, quantity: 3 }),
];

// The One Ring, MEC109 #166 (objective). MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.
// Not part of the encounter deck. The A Shadow in the East attachment 21001 is a different card.
const theOneRing: RingsDbCard = printed({
  code: "141085",
  keywords: { leavesPlayLoses: true },
  name: "The One Ring",
  type_code: "objective",
  type_name: "Objective",
  position: 166,
  traits: "Artifact. Item. Ring.",
  is_unique: true,
  quantity: 1,
});

export const LOCAL_CARDS: readonly RingsDbCard[] = [...quests, ...locations, ...enemies, ...treacheries, theOneRing];

// Keywords for dealt cards that come from RingsDB, which carries no keyword field. Read 2026-10-24 through
// Hall of Beorn (MEC109/TFotR printing). Confirm on the card. Nothing here is parsed from card text.
// 141017 Mr. Underhill, MEC109 #44 (attachment, boon): Permanent.
// 141077 Gildor Inglorion, MEC109 #45 (objective ally, boon): no keywords.
// 141078 Gandalf's Delay, MEC109 #46 (objective, burden): no keywords.
// 141079 The Ring Draws Them, MEC109 #47 (treachery, burden): Surge.
// The RingsDB rows type these four cards "treasure" (Campaign); the printed types are the ones above. The
// type_code stays as RingsDB has it. A revealed treachery or treasure stays in staging either way (user
// decision), so nothing branches on it.
export const KEYWORD_OVERRIDES: Readonly<Record<string, PrintedKeywords>> = {
  "141017": { permanent: true },
  "141077": {},
  "141078": {},
  "141079": { surge: true },
};
