import type { RingsDbCard } from "../src/catalog/boundary.ts";

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
    ...card,
  };
}

// Printed numbers read 2026-10-23 from the MEC109 card scans. Collector number is the card's own.
// Unprinted numbers stay null. Ability text is not stored.

// Three is Company, MEC109 quest card 22. Side B quest points 1.
// A Shortcut to Mushrooms, MEC109 quest card 23. Side B quest points 14.
// Escape to Buckland, MEC109 quest card 24. Side B quest-point circle is a dash.
const quests: RingsDbCard[] = [
  printed({ code: "141022", name: "Three is Company", type_code: "quest", type_name: "Quest", position: 22, quantity: 1, quest: 1 }),
  printed({
    code: "141023",
    name: "A Shortcut to Mushrooms",
    type_code: "quest",
    type_name: "Quest",
    position: 23,
    quantity: 1,
    quest: 14,
  }),
  printed({ code: "141024", name: "Escape to Buckland", type_code: "quest", type_name: "Quest", position: 24, quantity: 1 }),
];

// Bag End, encounter card 31. Unique. Threat 0, quest points 3, victory 1.
// Woody End, encounter card 32. Unique. Threat 1, quest points 1, victory 1.
// Stock-brook, encounter card 33. Unique. Threat 1, quest points 5, victory 1.
// Bamfurlong, encounter card 34. Unique. Threat 2, quest points 2, victory 1.
// Bucklebury Ferry, encounter card 35. Unique. Threat 3, quest points 9.
// Green Hill Country, encounter card 36. Threat 2, quest points 3.
// Stock Road, encounter card 37. Threat 3, quest points 3.
// The Marish, encounter card 38. Threat 3, quest points 4.
const locations: RingsDbCard[] = [
  printed({
    code: "141031",
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
    name: "The Marish",
    type_code: "location",
    type_name: "Location",
    position: 38,
    traits: "Marshland.",
    quantity: 2,
    threat: 3,
    quest: 4,
  }),
  printed({
    code: "141072",
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

// Black Rider, encounter card 39. Threat 4, attack 5, defense 4, hit points 6. Engagement is unprinted in this schema.
// Evil Crow, encounter card 40. Threat 2, attack 0, defense 1, hit points 2.
const enemies: RingsDbCard[] = [
  printed({
    code: "141039",
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

// Crawling Towards Him, encounter card 41.
// Hunting for the Ring, encounter card 42.
// Have You Seen Baggins?, encounter card 43.
// Piercing Cry, encounter card 73.
// Black Steed, encounter card 74.
// Rode Like a Gale, encounter card 75.
// Lure of the Ring, encounter card 76.
const treacheries: RingsDbCard[] = [
  printed({ code: "141041", name: "Crawling Towards Him", type_code: "treachery", type_name: "Treachery", position: 41, quantity: 3 }),
  printed({ code: "141042", name: "Hunting for the Ring", type_code: "treachery", type_name: "Treachery", position: 42, quantity: 3 }),
  printed({
    code: "141043",
    name: "Have You Seen Baggins?",
    type_code: "treachery",
    type_name: "Treachery",
    position: 43,
    quantity: 2,
  }),
  printed({ code: "141073", name: "Piercing Cry", type_code: "treachery", type_name: "Treachery", position: 73, quantity: 3 }),
  printed({
    code: "141074",
    name: "Black Steed",
    type_code: "treachery",
    type_name: "Treachery",
    position: 74,
    traits: "Morgul.",
    quantity: 3,
  }),
  printed({ code: "141075", name: "Rode Like a Gale", type_code: "treachery", type_name: "Treachery", position: 75, quantity: 2 }),
  printed({ code: "141076", name: "Lure of the Ring", type_code: "treachery", type_name: "Treachery", position: 76, quantity: 3 }),
];

// The One Ring, MEC109 objective card 85, read 2026-10-23. Unique. No printed combat numbers.
// Not part of the encounter deck. The A Shadow in the East attachment 21001 is a different card.
const theOneRing: RingsDbCard = printed({
  code: "141085",
  name: "The One Ring",
  type_code: "objective",
  type_name: "Objective",
  position: 85,
  traits: "Artifact. Item. Ring.",
  is_unique: true,
  quantity: 1,
});

export const LOCAL_CARDS: readonly RingsDbCard[] = [...quests, ...locations, ...enemies, ...treacheries, theOneRing];
