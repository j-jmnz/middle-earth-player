// The cycles' definitions (the `kind: "cycle"` entries of CAMPAIGNS in campaign-defs.ts): each cycle's products and scenarios, with the DragnCards decks that load them. A cycle has no Campaign Mode and
// its scenarios are played standalone. A new cycle is one entry here and its products in PRODUCTS (campaign-defs.ts).
import type { CampaignDef, ScenarioDef } from "./campaign-defs.ts";

// A scenario of a cycle: its product (an Adventure Pack or a deluxe box), and the DragnCards decks `Q<cycle>.<n>` / `E<cycle>.<n>` that load it (`n` counts from 1 within DragnCards' cycle: Shadows
// of Mirkwood's start at 4, after the three 2011 core decks Q01.1 to Q01.3). An Adventure Pack's rulesheet (`<insert>.setup-<id>`) prints its encounter sets (read from its text layer, or by eye where the text is outlines: `handRead` in data/rules/columns.json), and a scenario
// with no such span has no `setupSpan`: its piles are checked against the quest card's printed Setup and Hall of Beorn's set list.
function cycleScenario(cycle: string, n: number, id: string, product: string, extra: Partial<ScenarioDef> = {}): ScenarioDef {
  return { id, product, deck: { normal: `Q${cycle}.${n}`, easy: `E${cycle}.${n}` }, ...extra };
}
const shadowsOfMirkwood = (n: number, id: string, product: string, extra: Partial<ScenarioDef> = {}): ScenarioDef => cycleScenario("01", n + 3, id, product, extra);
const dwarrowdelf = (n: number, id: string, product: string, extra: Partial<ScenarioDef> = {}): ScenarioDef => cycleScenario("02", n, id, product, extra);
// The treasure cards of the scenarios that discover them (hob.treasure-ohauh, hob.treasure-otd): We Must Away's three (the troll icon: Sting, Orcrist, Glamdring), Flies and Spiders' Bilbo's Magic Ring (the spider web) and The Lonely
// Mountain's five Erebor treasures (the dragon; The Arkenstone, Mithril Shirt, Thrór's Battle Axe, Thrór's Hunting Bow, Thrór's Golden Cup). A scenario's Setup lists the icons of the earlier scenarios that discover treasure.
const TROLL_TREASURE = ["131020", "131021", "131022"];
const WEB_TREASURE = ["132019"];
const DRAGON_TREASURE = ["132020", "132021", "132022", "132023", "132024"];
const againstTheShadow = (n: number, id: string, product: string, extra: Partial<ScenarioDef> = {}): ScenarioDef => cycleScenario("03", n, id, product, extra);
const ringMaker = (n: number, id: string, product: string, extra: Partial<ScenarioDef> = {}): ScenarioDef => cycleScenario("04", n, id, product, extra);
const haradrim = (n: number, id: string, product: string, extra: Partial<ScenarioDef> = {}): ScenarioDef => cycleScenario("07", n, id, product, extra);
const hobbit = (n: number, id: string, product: string, extra: Partial<ScenarioDef> = {}): ScenarioDef => cycleScenario("0A", n, id, product, extra);

export const CYCLE_DEFS: readonly CampaignDef[] = [
  {
    id: "shadows-of-mirkwood",
    name: "Shadows of Mirkwood",
    kind: "cycle",
    released: "2011-07-22",
    products: ["The Hunt for Gollum", "Conflict at the Carrock", "A Journey to Rhosgobel", "The Hills of Emyn Muil", "The Dead Marshes", "Return to Mirkwood"],
    scenarios: [
      shadowsOfMirkwood(1, "the-hunt-for-gollum", "The Hunt for Gollum", { setupSpan: "sotm.setup-the-hunt-for-gollum" }),
      shadowsOfMirkwood(2, "conflict-at-the-carrock", "Conflict at the Carrock", { setupSpan: "sotm.setup-conflict-at-the-carrock" }),
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
    id: "the-hobbit",
    name: "The Hobbit",
    kind: "cycle",
    released: "2012-08-17",
    products: ["The Hobbit: Over Hill and Under Hill", "The Hobbit: On the Doorstep"],
    scenarios: [
      // DragnCards loads Bilbo Baggins in player 1's play area (the first player takes control of him at the start of every game, hob.bilbo-baggins-ohauh) and the seven Sack cards in its second shared deck.
      hobbit(1, "we-must-away-ere-break-of-day", "The Hobbit: Over Hill and Under Hill", { groups: { sharedEncounterDeck2: "setAside" } }),
      // The second shared deck is the inactive second encounter deck (the Misty Mountain Goblins and The Great Goblin sets, hob.active-and-inactive-encounter-decks); Hall of Beorn lists the sets of the first deck only.
      hobbit(2, "over-the-misty-mountains-grim", "The Hobbit: Over Hill and Under Hill", { groups: { sharedEncounterDeck2: "encounterDeck2" }, encounterSets: ["Over the Misty Mountains Grim", "Western Lands", "Misty Mountain Goblins", "The Great Goblin"], treasures: TROLL_TREASURE }),
      hobbit(3, "dungeons-deep-and-caverns-dim", "The Hobbit: Over Hill and Under Hill", { treasures: TROLL_TREASURE }),
      hobbit(4, "flies-and-spiders", "The Hobbit: On the Doorstep", { treasures: TROLL_TREASURE }),
      // The second shared deck is the five Erebor treasure cards, which the Setup stacks facedown under The Lonely Mountain.
      hobbit(5, "the-lonely-mountain", "The Hobbit: On the Doorstep", { groups: { sharedEncounterDeck2: "setAside" }, treasures: [...TROLL_TREASURE, ...WEB_TREASURE] }),
      hobbit(6, "the-battle-of-five-armies", "The Hobbit: On the Doorstep", { treasures: [...TROLL_TREASURE, ...WEB_TREASURE, ...DRAGON_TREASURE] }),
    ],
    saga: false,
    ledger: "the-hobbit",
  },
  {
    id: "against-the-shadow",
    name: "Against the Shadow",
    kind: "cycle",
    released: "2012-11-26",
    products: ["Heirs of Númenor", "The Steward's Fear", "The Drúadan Forest", "Encounter at Amon Dîn", "Assault on Osgiliath", "The Blood of Gondor", "The Morgul Vale"],
    scenarios: [
      againstTheShadow(1, "peril-in-pelargir", "Heirs of Númenor", { setupSpan: "ats.setup-peril-in-pelargir", deck: { normal: "Q03.1", easy: "E03.1", label: "Peril In Pelargir" } }),
      againstTheShadow(2, "into-ithilien", "Heirs of Númenor", { setupSpan: "ats.setup-into-ithilien" }),
      againstTheShadow(3, "the-siege-of-cair-andros", "Heirs of Númenor", { setupSpan: "ats.setup-the-siege-of-cair-andros" }),
      // DragnCards loads the underworld deck (the Streets of Gondor and Brigands enemies and the three Clue objectives) as the second shared deck; the Setup builds it from the encounter deck's sets (ats.setup-the-stewards-fear-underworld-deck).
      againstTheShadow(4, "the-stewards-fear", "The Steward's Fear", { setupSpan: "ats.setup-the-stewards-fear", groups: { sharedEncounterDeck2: "setAside" } }),
      againstTheShadow(5, "the-druadan-forest", "The Drúadan Forest", { setupSpan: "ats.setup-the-druadan-forest" }),
      // DragnCards loads the objective ally Lord Alcaron in player 1's play area; the printed Setup puts him into play.
      againstTheShadow(6, "encounter-at-amon-din", "Encounter at Amon Dîn", { setupSpan: "ats.setup-encounter-at-amon-din", groups: { player1Play1: "setAside" } }),
      againstTheShadow(7, "assault-on-osgiliath", "Assault on Osgiliath", { setupSpan: "ats.setup-assault-on-osgiliath" }),
      // DragnCards loads the objective allies Faramir and Lord Alcaron in player 1's play area; the printed Setup puts them into play.
      againstTheShadow(8, "the-blood-of-gondor", "The Blood of Gondor", { setupSpan: "ats.setup-the-blood-of-gondor", groups: { player1Play1: "setAside" } }),
      againstTheShadow(9, "the-morgul-vale", "The Morgul Vale", { setupSpan: "ats.setup-the-morgul-vale" }),
    ],
    saga: false,
    ledger: "against-the-shadow",
  },
  // No source names a cycle: Hall of Beorn lists the scenarios of The Voice of Isengard and of its six Adventure Packs under each product, and RingsDB numbers the deluxe expansion and the six packs as cycles 15 and 16.
  // The cycle has no Campaign Mode, so the Scenarios tab lists it; released is the US release of its first product (hallofgondor.com/release-dates).
  {
    id: "the-ring-maker",
    name: "The Ring-maker",
    kind: "cycle",
    released: "2014-02-21",
    products: ["The Voice of Isengard", "The Dunland Trap", "The Three Trials", "Trouble in Tharbad", "The Nîn-in-Eilph", "Celebrimbor's Secret", "The Antlered Crown"],
    scenarios: [
      ringMaker(1, "the-fords-of-isen", "The Voice of Isengard", { setupSpan: "rm.setup-the-fords-of-isen", deck: { normal: "Q04.1", easy: "E04.1", label: "Fords of Isen" } }),
      ringMaker(2, "to-catch-an-orc", "The Voice of Isengard", { setupSpan: "rm.setup-to-catch-an-orc" }),
      ringMaker(3, "into-fangorn", "The Voice of Isengard", { setupSpan: "rm.setup-into-fangorn" }),
      ringMaker(4, "the-dunland-trap", "The Dunland Trap", { setupSpan: "rm.setup-the-dunland-trap" }),
      ringMaker(5, "the-three-trials", "The Three Trials", { setupSpan: "rm.setup-the-three-trials" }),
      // DragnCards loads the objective-ally Nalir in player 1's play area; the printed Setup has the first player take control of him.
      ringMaker(6, "trouble-in-tharbad", "Trouble in Tharbad", { setupSpan: "rm.setup-trouble-in-tharbad", groups: { player1Play1: "setAside" } }),
      ringMaker(7, "the-nin-in-eilph", "The Nîn-in-Eilph", { setupSpan: "rm.setup-the-nin-in-eilph", groups: { player1Play1: "setAside" } }),
      ringMaker(8, "celebrimbors-secret", "Celebrimbor's Secret", { setupSpan: "rm.setup-celebrimbors-secret" }),
      // DragnCards loads Chief Turch in player 1's play area and the Raven deck as the second shared deck; the Setup builds that deck from the encounter deck's sets (rm.raven-deck).
      ringMaker(9, "the-antlered-crown", "The Antlered Crown", { setupSpan: "rm.setup-the-antlered-crown", groups: { player1Play1: "setAside", sharedEncounterDeck2: "setAside" } }),
    ],
    saga: false,
    ledger: "the-ring-maker",
  },
  // No source names a cycle: Hall of Beorn lists the scenarios of The Sands of Harad and of its six Adventure Packs under each product, and RingsDB numbers the deluxe expansion and the six packs as cycles 23 and 24.
  // The cycle has no Campaign Mode, so the Scenarios tab lists it; released is the US release of its first product (hallofgondor.com/release-dates).
  {
    id: "haradrim",
    name: "Haradrim",
    kind: "cycle",
    released: "2016-11-23",
    products: ["The Sands of Harad", "The Mûmakil", "Race Across Harad", "Beneath the Sands", "The Black Serpent", "The Dungeons of Cirith Gurat", "The Crossings of Poros"],
    scenarios: [
      haradrim(1, "escape-from-umbar", "The Sands of Harad", { setupSpan: "hrd.setup-escape-from-umbar" }),
      haradrim(2, "desert-crossing", "The Sands of Harad", { setupSpan: "hrd.setup-desert-crossing" }),
      haradrim(3, "the-long-arm-of-mordor", "The Sands of Harad", { setupSpan: "hrd.setup-the-long-arm-of-mordor" }),
      haradrim(4, "the-mumakil", "The Mûmakil", { setupSpan: "hrd.setup-the-mumakil" }),
      // DragnCards loads the Orc's quest deck (stages 2C to 4C) as a second shared quest deck; the Setup creates it (hrd.prepare-the-orcs-area), so it waits set aside.
      haradrim(5, "race-across-harad", "Race Across Harad", { setupSpan: "hrd.setup-race-across-harad", groups: { sharedQuestDeck2: "setAside" } }),
      haradrim(6, "beneath-the-sands", "Beneath the Sands", { setupSpan: "hrd.setup-beneath-the-sands" }),
      haradrim(7, "the-black-serpent", "The Black Serpent", { setupSpan: "hrd.setup-the-black-serpent" }),
      haradrim(8, "the-dungeons-of-cirith-gurat", "The Dungeons of Cirith Gurat", { setupSpan: "hrd.setup-the-dungeons-of-cirith-gurat" }),
      haradrim(9, "the-crossings-of-poros", "The Crossings of Poros", { setupSpan: "hrd.setup-the-crossings-of-poros" }),
    ],
    saga: false,
    ledger: "haradrim",
  },
  {
    // The scenarios printed on their own (RingsDB's cycle 50 packs that are not A Long-extended Party's): one product line each as it is built. The index counts the built ones.
    id: "standalone-scenarios",
    name: "Standalone scenarios",
    kind: "cycle",
    released: "2011-09-21",
    products: ["The Massing at Osgiliath", "The Battle of Lake-town", "The Stone of Erech", "The Old Forest", "Fog on the Barrow-downs", "The Ruins of Belegost", "Murder at the Prancing Pony", "The Siege of Annúminas", "Attack on Dol Guldur", "The Wizard's Quest", "The Woodland Realm", "The Mines of Moria", "Escape from Khazad-dûm", "The Hunt for the Dreadnaught"],
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
      // DragnCards' deck Q99.12 has no Easy twin. Hall of Beorn lists the kit's quest card under one set and gives its 42 other encounter cards none; they are printed with set numbers 1 to 14.
      { id: "the-woodland-realm", product: "The Woodland Realm", deck: { normal: "Q99.12", easy: "Q99.12" }, encounterSets: ["The Woodland Realm", "The Woodland Realm 1", "The Woodland Realm 2", "The Woodland Realm 3", "The Woodland Realm 4", "The Woodland Realm 5", "The Woodland Realm 6", "The Woodland Realm 7", "The Woodland Realm 8", "The Woodland Realm 9", "The Woodland Realm 10", "The Woodland Realm 11", "The Woodland Realm 12", "The Woodland Realm 13", "The Woodland Realm 14"] },
      // DragnCards' deck Q99.13 has no Easy twin. Hall of Beorn lists the kit's quest card under one set and gives its other encounter cards none; they are printed with set numbers 1 to 14.
      { id: "the-mines-of-moria", product: "The Mines of Moria", deck: { normal: "Q99.13", easy: "Q99.13" }, encounterSets: ["The Mines of Moria", "The Mines of Moria 1", "The Mines of Moria 2", "The Mines of Moria 3", "The Mines of Moria 4", "The Mines of Moria 5", "The Mines of Moria 6", "The Mines of Moria 7", "The Mines of Moria 8", "The Mines of Moria 9", "The Mines of Moria 10", "The Mines of Moria 11", "The Mines of Moria 12", "The Mines of Moria 13", "The Mines of Moria 14"] },
      // DragnCards' deck Q99.14 has no Easy twin. Hall of Beorn lists the kit's quest card under one set and gives its other encounter cards none; they are printed with set numbers 15 to 28. DragnCards loads the encounter cards in its sharedQuestDeck group (`groups`) and omits Durin's Bane (overrides.scenarioAdded).
      { id: "escape-from-khazad-dum", product: "Escape from Khazad-dûm", deck: { normal: "Q99.14", easy: "Q99.14" }, groups: { sharedQuestDeck: "encounter" }, encounterSets: ["Escape from Khazad-dûm", "Escape from Khazad-dûm 15", "Escape from Khazad-dûm 16", "Escape from Khazad-dûm 17", "Escape from Khazad-dûm 18", "Escape from Khazad-dûm 19", "Escape from Khazad-dûm 20", "Escape from Khazad-dûm 21", "Escape from Khazad-dûm 22", "Escape from Khazad-dûm 23", "Escape from Khazad-dûm 24", "Escape from Khazad-dûm 25", "Escape from Khazad-dûm 26", "Escape from Khazad-dûm 27", "Escape from Khazad-dûm 28"] },
      // DragnCards' deck Q99.15 has no Easy twin: the Easy Mode card (not the deck) sets two Black Sails and a Corsair Warship aside. Its sharedEncounterDeck2 is the Corsair deck; Standard Mode is the mode card the scenario deals.
      { id: "the-hunt-for-the-dreadnaught", product: "The Hunt for the Dreadnaught", deck: { normal: "Q99.15", easy: "Q99.15" }, modeCard: "Standard Mode", easyModeCard: "Easy Mode", groups: { sharedEncounterDeck2: "corsairDeck" } },
    ],
    // The other products of the cycle, in release order (README.md, Roadmap): the file's `later` lists them. An entry may name one title of a product that holds several (Hall of Beorn's scenarios under that product), so it is not always a whole product's name.
    later: [],
    saga: false,
    ledger: "standalone-scenarios",
  },
];
