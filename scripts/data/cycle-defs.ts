// The cycles' definitions (the `kind: "cycle"` entries of CAMPAIGNS in campaign-defs.ts): each cycle's products and scenarios, with the DragnCards decks that load them. A cycle has no Campaign Mode and
// its scenarios are played standalone. A new cycle is one entry here and its products in PRODUCTS (campaign-defs.ts).
import type { CampaignDef, ScenarioDef } from "./campaign-defs.ts";

// A scenario of a cycle: its product (an Adventure Pack or a deluxe box), and the DragnCards decks `Q<cycle>.<n>` / `E<cycle>.<n>` that load it (`n` counts from 1 within DragnCards' cycle: Shadows
// of Mirkwood's start at 4, after the three 2011 core decks Q01.1 to Q01.3). An Adventure Pack's rulesheet (`<insert>.setup-<id>`) prints its encounter sets where it has a text layer, and a scenario
// with no such span has no `setupSpan`: its piles are checked against the quest card's printed Setup and Hall of Beorn's set list.
function cycleScenario(cycle: string, n: number, id: string, product: string, extra: Partial<ScenarioDef> = {}): ScenarioDef {
  return { id, product, deck: { normal: `Q${cycle}.${n}`, easy: `E${cycle}.${n}` }, ...extra };
}
const shadowsOfMirkwood = (n: number, id: string, product: string, extra: Partial<ScenarioDef> = {}): ScenarioDef => cycleScenario("01", n + 3, id, product, extra);
const dwarrowdelf = (n: number, id: string, product: string, extra: Partial<ScenarioDef> = {}): ScenarioDef => cycleScenario("02", n, id, product, extra);

export const CYCLE_DEFS: readonly CampaignDef[] = [
  {
    id: "shadows-of-mirkwood",
    name: "Shadows of Mirkwood",
    kind: "cycle",
    released: "2011-07-22",
    products: ["The Hunt for Gollum", "Conflict at the Carrock", "A Journey to Rhosgobel", "The Hills of Emyn Muil", "The Dead Marshes", "Return to Mirkwood"],
    scenarios: [
      shadowsOfMirkwood(1, "the-hunt-for-gollum", "The Hunt for Gollum"),
      shadowsOfMirkwood(2, "conflict-at-the-carrock", "Conflict at the Carrock"),
      // DragnCards loads Wilyador in player 1's play area; the printed Setup adds him to the staging area (the first player then gains control of him, his own text).
      shadowsOfMirkwood(3, "a-journey-to-rhosgobel", "A Journey to Rhosgobel", { setupSpan: "sotm.setup-a-journey-to-rhosgobel", groups: { player1Play1: "staging" } }),
      shadowsOfMirkwood(4, "the-hills-of-emyn-muil", "The Hills of Emyn Muil", { setupSpan: "sotm.setup-the-hills-of-emyn-muil" }),
      shadowsOfMirkwood(5, "the-dead-marshes", "The Dead Marshes", { setupSpan: "sotm.setup-the-dead-marshes" }),
      shadowsOfMirkwood(6, "return-to-mirkwood", "Return to Mirkwood", { setupSpan: "sotm.setup-return-to-mirkwood" }),
    ],
    saga: false,
    ledger: "shadows-of-mirkwood",
  },
  {
    id: "dwarrowdelf",
    name: "Dwarrowdelf",
    kind: "cycle",
    released: "2012-01-06",
    products: ["Khazad-dûm", "The Redhorn Gate", "Road to Rivendell", "The Watcher in the Water", "The Long Dark", "Foundations of Stone", "Shadow and Flame"],
    scenarios: [
      dwarrowdelf(1, "into-the-pit", "Khazad-dûm"),
      dwarrowdelf(2, "the-seventh-level", "Khazad-dûm"),
      dwarrowdelf(3, "flight-from-moria", "Khazad-dûm"),
      // DragnCards loads Arwen Undómiel in player 1's play area; the printed Setup puts her into play under the first player's control (dwd.ally-objective-arwen).
      dwarrowdelf(4, "the-redhorn-gate", "The Redhorn Gate", { groups: { player1Play1: "setAside" } }),
      dwarrowdelf(5, "road-to-rivendell", "Road to Rivendell", { groups: { player1Play1: "setAside" } }),
      dwarrowdelf(6, "the-watcher-in-the-water", "The Watcher in the Water"),
      dwarrowdelf(7, "the-long-dark", "The Long Dark"),
      // The Setup sets the Foundations of Stone encounter set aside (a second encounter deck the quest later shuffles in): DragnCards loads it as the second shared deck.
      dwarrowdelf(8, "foundations-of-stone", "Foundations of Stone", { groups: { sharedEncounterDeck2: "encounterDeck2" } }),
      dwarrowdelf(9, "shadow-and-flame", "Shadow and Flame"),
    ],
    saga: false,
    ledger: "dwarrowdelf",
  },
  {
    // The scenarios printed on their own (RingsDB's cycle 50 packs that are not A Long-extended Party's): one product line each as it is built. The index counts the built ones.
    id: "standalone-scenarios",
    name: "Standalone scenarios",
    kind: "cycle",
    released: "2011-09-21",
    products: ["The Massing at Osgiliath", "The Battle of Lake-town", "The Stone of Erech", "The Old Forest", "Fog on the Barrow-downs", "The Ruins of Belegost", "Murder at the Prancing Pony", "The Siege of Annúminas", "Attack on Dol Guldur", "The Wizard's Quest"],
    scenarios: [
      // DragnCards' deck Q99.01 has no Easy twin: Hall of Beorn's Easy counts equal the Normal ones, so Easy loads the same deck.
      { id: "the-massing-at-osgiliath", product: "The Massing at Osgiliath", deck: { normal: "Q99.01", easy: "Q99.01" } },
      // DragnCards' deck Q99.02 has no Easy twin either; its sharedEncounterDeck2 is the Smaug deck.
      { id: "the-battle-of-lake-town", product: "The Battle of Lake-town", deck: { normal: "Q99.02", easy: "Q99.02" }, groups: { sharedEncounterDeck2: "setAside" } },
      // DragnCards' deck Q99.03 has no Easy twin either.
      { id: "the-stone-of-erech", product: "The Stone of Erech", deck: { normal: "Q99.03", easy: "Q99.03" } },
      // DragnCards' deck Q99.04 has no Easy twin either.
      { id: "the-old-forest", product: "The Old Forest", deck: { normal: "Q99.04", easy: "Q99.04" } },
      // DragnCards' deck Q99.05 has no Easy twin either.
      { id: "fog-on-the-barrow-downs", product: "Fog on the Barrow-downs", deck: { normal: "Q99.05", easy: "Q99.05" } },
      // DragnCards' deck E99.06 is the Easy twin of Q99.06: it holds none of the three copy pairs Hall of Beorn gives Easy 0 (Flooded Hall, Old Stone Troll, Spawn of Thangorodrim).
      { id: "the-ruins-of-belegost", product: "The Ruins of Belegost", deck: { normal: "Q99.06", easy: "E99.06" } },
      // DragnCards' deck E99.07 is the Easy twin of Q99.07.
      { id: "murder-at-the-prancing-pony", product: "Murder at the Prancing Pony", deck: { normal: "Q99.07", easy: "E99.07" } },
      // DragnCards' deck Q99.08 (Standard Game Mode) has no Easy twin; Q99.09 is the Epic Multiplayer Mode, which the app does not play.
      { id: "the-siege-of-annuminas", product: "The Siege of Annúminas", deck: { normal: "Q99.08", easy: "Q99.08", label: "Standard The Siege of Annúminas" }, modeCard: "Standard Game Mode" },
      // DragnCards' deck Q99.10 has no Easy twin, and it is the only deck: Epic Multiplayer Mode is a second mode card, not a second deck.
      { id: "attack-on-dol-guldur", product: "Attack on Dol Guldur", deck: { normal: "Q99.10", easy: "Q99.10" }, modeCard: "Standard Game Mode" },
      // DragnCards' deck Q99.11 has no Easy twin. Hall of Beorn lists the kit's quest card under one set and gives its 43 encounter cards none; they are printed with set numbers 15 to 28.
      { id: "the-wizards-quest", product: "The Wizard's Quest", deck: { normal: "Q99.11", easy: "Q99.11" }, encounterSets: ["The Wizard's Quest", "The Wizard's Quest 15", "The Wizard's Quest 16", "The Wizard's Quest 17", "The Wizard's Quest 18", "The Wizard's Quest 19", "The Wizard's Quest 20", "The Wizard's Quest 21", "The Wizard's Quest 22", "The Wizard's Quest 23", "The Wizard's Quest 24", "The Wizard's Quest 25", "The Wizard's Quest 26", "The Wizard's Quest 27", "The Wizard's Quest 28"] },
    ],
    // The other products of the cycle, in release order (README.md, Roadmap): the file's `later` lists them. An entry may name one title of a product that holds several (Hall of Beorn's scenarios under that product), so it is not always a whole product's name.
    later: ["The Woodland Realm", "The Mines of Moria", "Escape from Khazad-dûm", "The Hunt for the Dreadnaught"],
    saga: false,
    ledger: "standalone-scenarios",
  },
];
