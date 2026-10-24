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

// Printed numbers read 2026-10-23 from the MEC109 card scans. Collector number is the card's own.
// Unprinted numbers stay null. Ability text is not stored.
//
// Keywords and engagement cost were read 2026-10-24 through Hall of Beorn, a dev-time aid. Hall of Beorn
// lists only the 2013 TBR printing of these cards, not the MEC109 printing. Each value is for the user to
// confirm on the physical card. A keywords object of {} means the card was read and prints none. Null means
// the card was not read.

// Three is Company, MEC109 quest card 22. Side B quest points 1. No keywords. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
// A Shortcut to Mushrooms, MEC109 quest card 23. Side B quest points 14. No keywords. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
// Escape to Buckland, MEC109 quest card 24. Side B quest-point circle is a dash. No keywords. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
const quests: RingsDbCard[] = [
  printed({ code: "141022", keywords: {}, name: "Three is Company", type_code: "quest", type_name: "Quest", position: 22, quantity: 1, quest: 1 }),
  printed({
    code: "141023",
    keywords: {},
    name: "A Shortcut to Mushrooms",
    type_code: "quest",
    type_name: "Quest",
    position: 23,
    quantity: 1,
    quest: 14,
  }),
  printed({ code: "141024", keywords: {}, name: "Escape to Buckland", type_code: "quest", type_name: "Quest", position: 24, quantity: 1 }),
];

// Bag End, encounter card 31. Unique. Threat 0, quest points 3, victory 1. No keywords. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
// Woody End, encounter card 32. Unique. Threat 1, quest points 1, victory 1. No keywords. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
// Stock-brook, encounter card 33. Unique. Threat 1, quest points 5, victory 1. No keywords. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
// Bamfurlong, encounter card 34. Unique. Threat 2, quest points 2, victory 1. No keywords. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
// Bucklebury Ferry, encounter card 35. Unique. Threat 3, quest points 9. Immune to player card effects. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
// Green Hill Country, encounter card 36. Threat 2, quest points 3. No keywords. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
// Stock Road, encounter card 37. Threat 3, quest points 3. No keywords. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
// The Marish, encounter card 38. Threat 3, quest points 4. No keywords. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
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
  // Pathless Country, encounter card 72. No keywords. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
  printed({
    code: "141072",
    keywords: {},
    name: "Pathless Country",
    type_code: "location",
    type_name: "Location",
    position: 72,
    traits: "Forest.",
    quantity: 3,
    threat: 2,
    quest: 3,
  }),
];

// Black Rider, encounter card 39. Threat 4, attack 5, defense 4, hit points 6. Engagement 35, Hide 2. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
// Evil Crow, encounter card 40. Threat 2, attack 0, defense 1, hit points 2. Engagement 25, no keywords. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
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

// Crawling Towards Him, encounter card 41. Peril, Hide 2. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
// Hunting for the Ring, encounter card 42. Doomed 2. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
// Have You Seen Baggins?, encounter card 43. Peril, Surge. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
// Piercing Cry, encounter card 73. Peril. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
// Black Steed, encounter card 74. Surge. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
// Rode Like a Gale, encounter card 75. No keywords. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
// Lure of the Ring, encounter card 76. Surge. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
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
  printed({ code: "141073", keywords: { peril: true }, name: "Piercing Cry", type_code: "treachery", type_name: "Treachery", position: 73, quantity: 3 }),
  printed({
    code: "141074",
    keywords: { surge: true },
    name: "Black Steed",
    type_code: "treachery",
    type_name: "Treachery",
    position: 74,
    traits: "Morgul.",
    quantity: 3,
  }),
  printed({ code: "141075", keywords: {}, name: "Rode Like a Gale", type_code: "treachery", type_name: "Treachery", position: 75, quantity: 2 }),
  printed({ code: "141076", keywords: { surge: true }, name: "Lure of the Ring", type_code: "treachery", type_name: "Treachery", position: 76, quantity: 3 }),
];

// The One Ring, MEC109 objective card 85. Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the card.
// Not part of the encounter deck. The A Shadow in the East attachment 21001 is a different card.
const theOneRing: RingsDbCard = printed({
  code: "141085",
  keywords: { leavesPlayLoses: true },
  name: "The One Ring",
  type_code: "objective",
  type_name: "Objective",
  position: 85,
  traits: "Artifact. Item. Ring.",
  is_unique: true,
  quantity: 1,
});

export const LOCAL_CARDS: readonly RingsDbCard[] = [...quests, ...locations, ...enemies, ...treacheries, theOneRing];

// Keywords for dealt cards that come from RingsDB, which carries no keyword field. Read 2026-10-24 through
// Hall of Beorn (TBR printing). Confirm on the card. Nothing here is parsed from card text.
// 141017 Mr. Underhill: Permanent.
// 141077 Gildor Inglorion: no keywords.
// 141078 Gandalf's Delay: no keywords.
// 141079 The Ring Draws Them: Surge.
export const KEYWORD_OVERRIDES: Readonly<Record<string, PrintedKeywords>> = {
  "141017": { permanent: true },
  "141077": {},
  "141078": {},
  "141079": { surge: true },
};
