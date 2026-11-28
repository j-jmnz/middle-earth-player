// The campaigns the pipeline builds, one definition each. No source names a campaign: Hall of Beorn groups scenarios
// under products, and the booklets say which scenarios make a campaign. The definition is the hand-checked mapping.
//
// A scenario file belongs to the scenario, not to a campaign: The Oath and The Caves of Nibin-Dûm are in both
// `mirkwood-paths` (parts 4 and 5, tdom.mirkwood-paths) and `the-dark-of-mirkwood` (parts 1 and 2, tdom.mini-campaign).

import type { Pile } from "../../src/catalog/scenario-data.ts";
import { CYCLE_DEFS } from "./cycle-defs.ts";

export type ScenarioDef = {
  // The file name: data/scenarios/<id>.json.
  id: string;
  // The Hall of Beorn product whose Scenarios.json lists it, which is also the printing its cards come from.
  product: string;
  // The rules span (data/rules/index.json) that prints its encounter-deck paragraph. A campaign scenario names it; a cycle scenario's rules source is
  // the quest card's printed Setup (no booklet prints it) unless an Adventure Pack's rules insert is pinned (docs/brief.md, Data sources).
  setupSpan?: string;
  // DragnCards' 2011 core decks and Limited Collector's Edition decks (`Q01.1`, `E01.1`), where a deck of the same cards exists
  // for a box that has no load list of its own: the cross-check compares the built piles with them, copy counts only.
  crossCheck?: { normal: string; easy: string };
  // The DragnCards decks that load the scenario (`Q06.1`, `E06.1`), for a `load: "dragncards"` box whose decks are not the numbered
  // `Q0C` list of the Fellowship boxes. The deck's label must be the scenario's title, or `label` where DragnCards prefixes the mode
  // (The Siege of Annúminas' Q99.08 is "Standard The Siege of Annúminas", its Epic mode Q99.09).
  deck?: { normal: string; easy: string; label?: string };
  // The title of the mode card whose printed Setup runs before the quest card's (The Siege of Annúminas' "Standard Game Mode"): the build reads its Setup sentences with the quest card's.
  modeCard?: string;
  // The title of the mode card the Easy difficulty deals instead (The Hunt for the Dreadnaught's "Easy Mode"); its Setup is not read with the quest card's, the engine runs its records.
  easyModeCard?: string;
  // The encounter sets of a kit whose Hall of Beorn scenario file lists none of them (The Wizard's Quest: its quest card names one set, the 14 sets of its encounter cards are in the box): the sets the load list deals, in booklet order.
  encounterSets?: readonly string[];
  // The product whose campaign card, boons and burdens the scenario deals when it is not `product` (the Dream-chaser Campaign Expansion
  // reprints the nine scenarios of seven boxes and holds every campaign card).
  campaignProduct?: string;
  // The piles of the DragnCards load groups this scenario's deck uses beyond the common ones (sharedQuestDeck, sharedEncounterDeck,
  // sharedStagingArea, sharedActiveLocation, sharedSetAside): `sharedEncounterDeck2` is a different deck in each Dream-chaser scenario.
  groups?: Readonly<Record<string, Pile>>;
  // A two-sided card the Setup has the first player take control of is dealt on the side the Setup names (Ered Mithrin's Haldan, loaded as
  // Woodmen Village and flipped by DragnCards' postLoadActionList), where the load list's side is not the one in play.
  takeControlFaceup?: boolean;
  // The load list files a double-sided card of the scenario as one guid with a row for each side (Gollum / Sméagol of The Passage of the
  // Marshes and Shelob's Lair): the two sides are two catalog cards, `back` of one placement (`Loaded.placements`), as with `deck` scenarios.
  sidedLoad?: boolean;
  // The load list sets the saga start aside instead of putting it in player 1's play area (Mount Doom: the Ring-bearer Frodo Baggins and The One Ring in the set-aside group): they are
  // `ScenarioData.sagaStart`, as in the scenarios whose load list names them in play (mec113.setting-up-the-game).
  sagaStartAside?: boolean;
  // The treasure cards a deck may add at this scenario's Setup (The Hobbit: the sets of the earlier scenarios that discover treasure, hob.treasure-ohauh, hob.treasure-otd),
  // recorded as ScenarioData.treasures. The insert prints the sets as icons; each is the treasure of one scenario of the cycle (src/campaign/loadout.ts, `treasures`).
  treasures?: readonly string[];
};

// A saga box's reprint of RingsDB's adventure packs (MEC109, MEC112, MEC113): Hall of Beorn's card set of it, the catalog pack code its printings carry
// (Hall of Beorn's slug suffix; the only invented code), and the cardgame.tools product its scans are filed under.
// `keepsRingsDb`: a deck-legal player card of the twin packs keeps its RingsDB record and takes only the reprint's printing (The Two Towers and The Return of the King: the pool
// lines and the effect records of the twins' player cards are numbered from that text; the Fellowship's reprint takes Hall of Beorn's facts, as it always has).
export type ReprintDef = { set: string; pack: string; product: string; keepsRingsDb?: boolean };

const FELLOWSHIP_REPRINT: ReprintDef = { set: "The Fellowship of the Ring", pack: "TFotR", product: "MEC109" };
const TWO_TOWERS_REPRINT: ReprintDef = { set: "The Two Towers", pack: "TTwT", product: "MEC112", keepsRingsDb: true };
const RETURN_REPRINT: ReprintDef = { set: "The Return of the King", pack: "TRotK", product: "MEC113", keepsRingsDb: true };

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
  // The saga box that reprints this product's cards as one box (a twin pack's `reprint`): its Hall of Beorn card set and its catalog pack. The
  // Fellowship box (MEC109) reprints The Black Riders and The Road Darkens, The Two Towers (MEC112) The Treason of Saruman and The Land of Shadow, The Return of
  // the King (MEC113) The Flame of the West and The Mountain of Fire.
  // The reprint's card takes its twin's code, and the twins pair within their own reprint set (a title in both boxes must not cross).
  reprint?: ReprintDef;
  // The product is a campaign expansion: it prints a campaign's campaign cards, boons and burdens, and no scenario of its own (the
  // Dream-chaser and Ered Mithrin Campaign Expansions). The scan scope takes every card it prints, and a Hall of Beorn Treasure row of it is a campaign treasure.
  campaignExpansion?: boolean;
  // Hall of Beorn lists some keywords of the box's cards as text only, so the keyword sentences that open a line of the scan-read ledger
  // are keywords the card has (scripts/data/normalize/printed.ts).
  ledgerKeywords?: boolean;
  // The cards a scenario's campaign card Resolution names that the campaign deals are its boons, burdens and treasures: any other name in it is a count or a
  // condition ("If there are 3 or more resources on Urdug", "Hrogar's Hill"). Dream-chaser's Resolution names are cut at its XP list instead.
  campaignCardRewards?: boolean;
  // DragnCards files each side of a double-sided card of the box as a row of its own (the Dream-chaser boxes): addDragnBacks and dragnRowOf
  // read the two rows as one card.
  sidedDragnRows?: boolean;
  // Each scenario starts with the first player's saga hero, which the load list names in player 1's play area (The Two Towers and The Return of the King: ☺ Aragorn, or the Ring-bearer
  // and The One Ring): recorded as ScenarioData.sagaStart. The Fellowship's Ring-bearer attachments are the campaign's `prelude` instead.
  sagaStart?: boolean;
  // The product reprints cards of the Adventure Packs with a Campaign Mode only or Upgraded side (the Dream-chaser Campaign Expansion): a campaign
  // game deals the reprint (scripts/data/normalize/reprints.ts).
  campaignReprints?: boolean;
  // The product's name in Hall of Beorn's Scenarios.json where it differs from its card set's name (Angmar Awakened's Treachery of Rhudaur: the card set is "The Treachery of Rhudaur"):
  // the sync snapshots the scenario files of a campaign's products by it, and the campaign index counts them by it.
  scenarioProduct?: string;
  // Hall of Beorn lists more than one scenario under the product (the year 2014 holds The Old Forest and Fog on the Barrow-downs): only the one with this title is the product's.
  scenarioTitle?: string;
};

const DCCE = "Dream-chaser Campaign Expansion";
const EMCE = "Ered Mithrin Campaign Expansion";
const AACE = "Angmar Awakened Campaign Expansion";

export const PRODUCTS: readonly ProductDef[] = [
  { name: "The Black Riders", packs: ["TFotR"], home: "fellowship-of-the-ring", load: "dragncards", easySheet: false, twinPack: "TBR", reprint: FELLOWSHIP_REPRINT },
  { name: "The Road Darkens", packs: ["TFotR"], home: "fellowship-of-the-ring", load: "dragncards", easySheet: false, twinPack: "TRD", reprint: FELLOWSHIP_REPRINT },
  // The Two Towers: The Treason of Saruman and The Land of Shadow are the base cards (RingsDB 2015), the MEC112 box (2023) their reprint.
  { name: "The Treason of Saruman", packs: ["TTwT"], home: "the-two-towers", load: "dragncards", easySheet: false, twinPack: "ToS", reprint: TWO_TOWERS_REPRINT, sagaStart: true, campaignCardRewards: true },
  { name: "The Land of Shadow", packs: ["TTwT"], home: "the-two-towers", load: "dragncards", easySheet: false, twinPack: "LoS", reprint: TWO_TOWERS_REPRINT, sagaStart: true, campaignCardRewards: true },
  // The Return of the King: The Flame of the West and The Mountain of Fire are the base cards (RingsDB 2015 and 2016), the MEC113 box (2024) their reprint.
  { name: "The Flame of the West", packs: ["TRotK"], home: "the-return-of-the-king", load: "dragncards", easySheet: false, twinPack: "FotW", reprint: RETURN_REPRINT, sagaStart: true, campaignCardRewards: true },
  { name: "The Mountain of Fire", packs: ["TRotK"], home: "the-return-of-the-king", load: "dragncards", easySheet: false, twinPack: "MoF", reprint: RETURN_REPRINT, sagaStart: true, campaignCardRewards: true },
  { name: "Revised Core Set", packs: ["RevCore"], home: "mirkwood-paths", load: "setup", easySheet: true, twinPack: null },
  // Shadows of Mirkwood: the six Adventure Packs, whose encounter and quest cards are Hall of Beorn's alone (RingsDB carries their player cards).
  { name: "The Hunt for Gollum", packs: ["HfG"], home: "shadows-of-mirkwood", load: "dragncards", easySheet: false, twinPack: null },
  { name: "Conflict at the Carrock", packs: ["CatC"], home: "shadows-of-mirkwood", load: "dragncards", easySheet: false, twinPack: null },
  { name: "A Journey to Rhosgobel", packs: ["JtR"], home: "shadows-of-mirkwood", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Hills of Emyn Muil", packs: ["HoEM"], home: "shadows-of-mirkwood", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Dead Marshes", packs: ["TDM"], home: "shadows-of-mirkwood", load: "dragncards", easySheet: false, twinPack: null },
  { name: "Return to Mirkwood", packs: ["RtM"], home: "shadows-of-mirkwood", load: "dragncards", easySheet: false, twinPack: null },
  // Dwarrowdelf: the Khazad-dûm deluxe expansion (three scenarios) and the six Adventure Packs, whose cards are Hall of Beorn's alone like the first cycle's.
  { name: "Khazad-dûm", packs: ["KD"], home: "dwarrowdelf", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Redhorn Gate", packs: ["TRG"], home: "dwarrowdelf", load: "dragncards", easySheet: false, twinPack: null },
  { name: "Road to Rivendell", packs: ["RtR"], home: "dwarrowdelf", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Watcher in the Water", packs: ["WitW"], home: "dwarrowdelf", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Long Dark", packs: ["TLD"], home: "dwarrowdelf", load: "dragncards", easySheet: false, twinPack: null },
  { name: "Foundations of Stone", packs: ["FoS"], home: "dwarrowdelf", load: "dragncards", easySheet: false, twinPack: null },
  { name: "Shadow and Flame", packs: ["SaF"], home: "dwarrowdelf", load: "dragncards", easySheet: false, twinPack: null },
  // The Hobbit: the two saga boxes (RingsDB's cycle 40), three scenarios each. Hall of Beorn names the products "The Hobbit: ..."; the packs are RingsDB's OHaUH and OtD, which carry the player cards, and the encounter and quest cards are Hall of Beorn's.
  { name: "The Hobbit: Over Hill and Under Hill", packs: ["OHaUH"], home: "the-hobbit", load: "dragncards", easySheet: false, twinPack: null, sagaStart: true },
  { name: "The Hobbit: On the Doorstep", packs: ["OtD"], home: "the-hobbit", load: "dragncards", easySheet: false, twinPack: null, sagaStart: true },
  // Against the Shadow: the Heirs of Númenor deluxe expansion (three scenarios) and the six Adventure Packs, whose scenario and encounter cards are Hall of Beorn's like the earlier cycles'.
  { name: "Heirs of Númenor", packs: ["HoN"], home: "against-the-shadow", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Steward's Fear", packs: ["TSF"], home: "against-the-shadow", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Drúadan Forest", packs: ["TDF"], home: "against-the-shadow", load: "dragncards", easySheet: false, twinPack: null },
  { name: "Encounter at Amon Dîn", packs: ["EaAD"], home: "against-the-shadow", load: "dragncards", easySheet: false, twinPack: null },
  { name: "Assault on Osgiliath", packs: ["AoO"], home: "against-the-shadow", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Blood of Gondor", packs: ["BoG"], home: "against-the-shadow", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Morgul Vale", packs: ["TMV"], home: "against-the-shadow", load: "dragncards", easySheet: false, twinPack: null },
  // The Ring-maker: the Voice of Isengard deluxe expansion (three scenarios) and the six Adventure Packs, whose scenario and encounter cards are Hall of Beorn's like the earlier cycles'.
  { name: "The Voice of Isengard", packs: ["VoI"], home: "the-ring-maker", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Dunland Trap", packs: ["TDT"], home: "the-ring-maker", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Three Trials", packs: ["TTT"], home: "the-ring-maker", load: "dragncards", easySheet: false, twinPack: null },
  { name: "Trouble in Tharbad", packs: ["TiT"], home: "the-ring-maker", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Nîn-in-Eilph", packs: ["NiE"], home: "the-ring-maker", load: "dragncards", easySheet: false, twinPack: null },
  { name: "Celebrimbor's Secret", packs: ["CS"], home: "the-ring-maker", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Antlered Crown", packs: ["TAC"], home: "the-ring-maker", load: "dragncards", easySheet: false, twinPack: null },
  // Haradrim (The Sands of Harad and its six Adventure Packs) and Vengeance of Mordor (A Shadow in the East and its six Adventure Packs): Hall of Beorn's scenario and encounter cards, like the earlier cycles'.
  { name: "The Sands of Harad", packs: ["TSoH"], home: "haradrim", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Mûmakil", packs: ["M"], home: "haradrim", load: "dragncards", easySheet: false, twinPack: null },
  { name: "Race Across Harad", packs: ["RAH"], home: "haradrim", load: "dragncards", easySheet: false, twinPack: null },
  { name: "Beneath the Sands", packs: ["BtS"], home: "haradrim", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Black Serpent", packs: ["TBS"], home: "haradrim", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Dungeons of Cirith Gurat", packs: ["DoCG"], home: "haradrim", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Crossings of Poros", packs: ["CoP"], home: "haradrim", load: "dragncards", easySheet: false, twinPack: null },
  { name: "A Shadow in the East", packs: ["ASitE"], home: "vengeance-of-mordor", load: "dragncards", easySheet: false, twinPack: null },
  { name: "Wrath and Ruin", packs: ["WaR"], home: "vengeance-of-mordor", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The City of Ulfast", packs: ["TCoU"], home: "vengeance-of-mordor", load: "dragncards", easySheet: false, twinPack: null },
  { name: "Challenge of the Wainriders", packs: ["CotW"], home: "vengeance-of-mordor", load: "dragncards", easySheet: false, twinPack: null },
  { name: "Under the Ash Mountains", packs: ["UtAM"], home: "vengeance-of-mordor", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Land of Sorrow", packs: ["TLoS"], home: "vengeance-of-mordor", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Fortress of Nurn", packs: ["TFoN"], home: "vengeance-of-mordor", load: "dragncards", easySheet: false, twinPack: null },
  // Standalone scenarios: each official scenario printed on its own, Hall of Beorn's cards of it alone. Hall of Beorn lists the event scenarios of 2011 to 2017 under the year (`scenarioProduct`).
  { name: "The Massing at Osgiliath", packs: ["TMaO"], home: "standalone-scenarios", load: "dragncards", easySheet: false, twinPack: null, scenarioProduct: "2011" },
  { name: "The Battle of Lake-town", packs: ["TBoLT"], home: "standalone-scenarios", load: "dragncards", easySheet: false, twinPack: null, scenarioProduct: "2012" },
  { name: "The Stone of Erech", packs: ["TSoE"], home: "standalone-scenarios", load: "dragncards", easySheet: false, twinPack: null, scenarioProduct: "2013" },
  { name: "The Old Forest", packs: ["TOF"], home: "standalone-scenarios", load: "dragncards", easySheet: false, twinPack: null, scenarioProduct: "2014", scenarioTitle: "The Old Forest" },
  { name: "Fog on the Barrow-downs", packs: ["FotBd"], home: "standalone-scenarios", load: "dragncards", easySheet: false, twinPack: null, scenarioProduct: "2014", scenarioTitle: "Fog on the Barrow-downs" },
  { name: "The Ruins of Belegost", packs: ["TRoB"], home: "standalone-scenarios", load: "dragncards", easySheet: false, twinPack: null, scenarioProduct: "2015", scenarioTitle: "The Ruins of Belegost" },
  { name: "Murder at the Prancing Pony", packs: ["MatPP"], home: "standalone-scenarios", load: "dragncards", easySheet: false, twinPack: null, scenarioProduct: "2015", scenarioTitle: "Murder at the Prancing Pony" },
  { name: "The Siege of Annúminas", packs: ["TSoA"], home: "standalone-scenarios", load: "dragncards", easySheet: false, twinPack: null, scenarioProduct: "2016", scenarioTitle: "The Siege of Annúminas" },
  { name: "Attack on Dol Guldur", packs: ["AoDG"], home: "standalone-scenarios", load: "dragncards", easySheet: false, twinPack: null, scenarioProduct: "2017", scenarioTitle: "Attack on Dol Guldur" },
  { name: "The Wizard's Quest", packs: ["TWQ"], home: "standalone-scenarios", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Woodland Realm", packs: ["TWR"], home: "standalone-scenarios", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Mines of Moria", packs: ["TMoM"], home: "standalone-scenarios", load: "dragncards", easySheet: false, twinPack: null },
  { name: "Escape from Khazad-dûm", packs: ["EfKD"], home: "standalone-scenarios", load: "dragncards", easySheet: false, twinPack: null },
  { name: "The Hunt for the Dreadnaught", packs: ["THftD"], home: "standalone-scenarios", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true, sidedDragnRows: true },
  { name: "The Dark of Mirkwood", packs: ["TDoM"], home: "the-dark-of-mirkwood", load: "setup", easySheet: false, twinPack: null },
  // Dream-chaser: The Grey Havens and the six Adventure Packs are the base cards, the Campaign Expansion (MEC111, 2023) the campaign.
  { name: "The Grey Havens", packs: ["TGH"], home: "dream-chaser", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true, sidedDragnRows: true },
  { name: "Flight of the Stormcaller", packs: ["FotS"], home: "dream-chaser", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true, sidedDragnRows: true },
  { name: "The Thing in the Depths", packs: ["TitD"], home: "dream-chaser", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true, sidedDragnRows: true },
  { name: "Temple of the Deceived", packs: ["TotD"], home: "dream-chaser", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true, sidedDragnRows: true },
  { name: "The Drowned Ruins", packs: ["DR"], home: "dream-chaser", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true, sidedDragnRows: true },
  { name: "A Storm on Cobas Haven", packs: ["SoCH"], home: "dream-chaser", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true, sidedDragnRows: true },
  { name: "The City of Corsairs", packs: ["CoC"], home: "dream-chaser", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true, sidedDragnRows: true },
  { name: DCCE, packs: ["DCCE"], home: "dream-chaser", load: "dragncards", easySheet: false, twinPack: null, campaignExpansion: true, ledgerKeywords: true, sidedDragnRows: true, campaignReprints: true },
  // Ered Mithrin: The Wilds of Rhovanion and the six Adventure Packs are the base cards, the Campaign Expansion (MEC115, 2024) the campaign.
  { name: "The Wilds of Rhovanion", packs: ["TWoR"], home: "ered-mithrin", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true },
  { name: "The Withered Heath", packs: ["TWH"], home: "ered-mithrin", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true },
  { name: "Roam Across Rhovanion", packs: ["RAR"], home: "ered-mithrin", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true },
  { name: "Fire in the Night", packs: ["FitN"], home: "ered-mithrin", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true },
  { name: "The Ghost of Framsburg", packs: ["TGoF"], home: "ered-mithrin", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true },
  { name: "Mount Gundabad", packs: ["MG"], home: "ered-mithrin", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true },
  { name: "The Fate of Wilderland", packs: ["TFoW"], home: "ered-mithrin", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true },
  { name: EMCE, packs: ["EMCE"], home: "ered-mithrin", load: "dragncards", easySheet: false, twinPack: null, campaignExpansion: true, campaignCardRewards: true, ledgerKeywords: true },
  // Angmar Awakened: The Lost Realm and the six Adventure Packs of the cycle are the base cards, the Campaign Expansion (MEC108) the campaign.
  { name: "The Lost Realm", packs: ["TLR"], home: "angmar-awakened", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true },
  { name: "The Wastes of Eriador", packs: ["WoE"], home: "angmar-awakened", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true },
  { name: "Escape from Mount Gram", packs: ["EfMG"], home: "angmar-awakened", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true },
  { name: "Across the Ettenmoors", packs: ["AtE"], home: "angmar-awakened", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true },
  { name: "The Treachery of Rhudaur", packs: ["ToR"], home: "angmar-awakened", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true, scenarioProduct: "Treachery of Rhudaur" },
  { name: "The Battle of Carn Dûm", packs: ["BoCD"], home: "angmar-awakened", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true },
  { name: "The Dread Realm", packs: ["TDR"], home: "angmar-awakened", load: "dragncards", easySheet: false, twinPack: null, ledgerKeywords: true },
  { name: AACE, packs: ["AACE"], home: "angmar-awakened", load: "dragncards", easySheet: false, twinPack: null, campaignExpansion: true, campaignCardRewards: true, ledgerKeywords: true },
];

// Every saga box's reprint, once each, in campaign order.
export const REPRINTS: readonly ReprintDef[] = [...new Map(PRODUCTS.flatMap((product) => (product.reprint ? [[product.reprint.set, product.reprint] as const] : []))).values()];
// The catalog pack codes of the reprints (TFotR, TTwT): printings that are not RingsDB packs.
export const REPRINT_PACKS: ReadonlySet<string> = new Set(REPRINTS.map((reprint) => reprint.pack));

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

type CampaignBase = {
  id: string;
  name: string;
  // Hall of Beorn products the campaign's cards (campaign cards, boons, burdens) are looked up in.
  products: readonly string[];
  // In play order. A scenario another campaign also lists is built once.
  scenarios: readonly ScenarioDef[];
  // A saga campaign carries the Ring-bearer and the Fellowship rules (the three saga boxes).
  saga: boolean;
  // The US release of the product that starts the campaign (hallofgondor.com/release-dates): the hubs list campaigns in this order
  // (a saga box at the Fellowship's, LORD_OF_THE_RINGS_SAGA).
  released: string;
  // A campaign whose campaign cards award XP, which the players spend on the log's scalable and upgradable cards (Dream-chaser only).
  xp?: boolean;
  // Where the scan-read ledger for this campaign lives (data/printed/<ledger>.json).
  ledger: string;
  // The campaign file carries the booklet's two starter decklists (the Fellowship only; data/starter-decks.json).
  starterDecks?: boolean;
  // The campaign's cards reuse titles of an earlier saga box (The Two Towers' and The Return of the King's Aragorn, Frodo Baggins and The One Ring): a card name in a record of the
  // campaign is a card of the campaign (scripts/data/effects/generate.ts), and no other campaign's record reads those cards, so an earlier box's records stay as they were.
  ownTitles?: boolean;
};

// A campaign opens a booklet (src/screens/booklets/books.ts) and the rules document it is, and deals a campaign card for each scenario.
type PlayedCampaignDef = CampaignBase & { kind?: "campaign"; bookletId: string; bookletDoc: string };
// A cycle (Shadows of Mirkwood) has no Campaign Mode: no campaign card, no booklet of its own, and its scenarios are played standalone. It names a booklet only
// where its Adventure Packs' rules inserts are pinned (docs/brief.md, Data sources).
// `later` names the Hall of Beorn products whose scenarios the cycle lists and the app has not built yet: the cycle's file carries their titles, which the hubs show under
// Coming later. Each moves to `products` and `scenarios` as it is built.
type CycleDef = CampaignBase & { kind: "cycle"; bookletId?: string; bookletDoc?: string; later?: readonly string[] };
export type CampaignDef = PlayedCampaignDef | CycleDef;

const OATH: ScenarioDef = { id: "the-oath", product: "The Dark of Mirkwood", setupSpan: "tdom.setup-the-oath", crossCheck: { normal: "Q00.01B", easy: "E00.01B" } };
const CAVES: ScenarioDef = { id: "the-caves-of-nibin-dum", product: "The Dark of Mirkwood", setupSpan: "tdom.setup-the-caves-of-nibin-dum", crossCheck: { normal: "Q00.02B", easy: "E00.02B" } };

// A Dream-chaser scenario: its box, the Campaign Expansion's campaign card, and the DragnCards decks (Q06.n / E06.n).
function dreamChaser(n: number, id: string, product: string, groups: Readonly<Record<string, Pile>> = {}): ScenarioDef {
  return { id, product, campaignProduct: DCCE, setupSpan: `dcce.setup-${id}`, deck: { normal: `Q06.${n}`, easy: `E06.${n}` }, groups };
}

// An Ered Mithrin scenario: its box, the Campaign Expansion's campaign card, and the DragnCards decks (Q08.n / E08.n).
function eredMithrin(n: number, id: string, product: string, groups: Readonly<Record<string, Pile>> = {}): ScenarioDef {
  return { id, product, campaignProduct: EMCE, setupSpan: `emce.setup-${id}`, deck: { normal: `Q08.${n}`, easy: `E08.${n}` }, groups, takeControlFaceup: true };
}

// An Angmar Awakened scenario: its box, the Campaign Expansion's campaign card, and the DragnCards decks (Q05.n / E05.n).
function angmarAwakened(n: number, id: string, product: string, groups: Readonly<Record<string, Pile>> = {}): ScenarioDef {
  return { id, product, campaignProduct: AACE, setupSpan: `mec108.setup-${id}`, deck: { normal: `Q05.${n}`, easy: `E05.${n}` }, groups };
}

// A saga scenario (The Two Towers, The Return of the King): its box's product, the quest card's setup span in the saga's booklet (`mec112`, `mec113`) and, where the Setup
// deals an encounter set into a deck of its own, the pile of the DragnCards load group (`Q0C.<n>`'s sharedEncounterDeck2). The DragnCards Normal and Easy decks are found by
// the title, as the Fellowship's are.
function sagaScenario(doc: string, id: string, product: string, extra: Partial<ScenarioDef> = {}): ScenarioDef {
  return { id, product, setupSpan: `${doc}.setup-${id}`, ...extra };
}
const twoTowers = (id: string, product: string, extra: Partial<ScenarioDef> = {}): ScenarioDef => sagaScenario("mec112", id, product, extra);
const returnOfTheKing = (id: string, product: string, extra: Partial<ScenarioDef> = {}): ScenarioDef => sagaScenario("mec113", id, product, extra);

// The three saga boxes of The Lord of the Rings, in book order. Every list keeps them together, placed by the Fellowship's release
// (scripts/data/normalize/campaigns.ts, positions).
export const LORD_OF_THE_RINGS_SAGA: readonly string[] = ["fellowship-of-the-ring", "the-two-towers", "the-return-of-the-king"];

export const CAMPAIGNS: readonly CampaignDef[] = [
  {
    id: "fellowship-of-the-ring",
    name: "Fellowship of the Ring",
    released: "2022-10-14",
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
    starterDecks: true,
  },
  {
    id: "mirkwood-paths",
    name: "Mirkwood Paths",
    released: "2022-01-28",
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
    released: "2022-02-25",
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
  {
    id: "dream-chaser",
    name: "Dream-chaser",
    released: "2023-07-07",
    products: ["The Grey Havens", "Flight of the Stormcaller", "The Thing in the Depths", "Temple of the Deceived", "The Drowned Ruins", "A Storm on Cobas Haven", "The City of Corsairs", DCCE],
    scenarios: [
      dreamChaser(1, "voyage-across-belegaer", "The Grey Havens", { sharedEncounterDeck2: "corsairDeck" }),
      dreamChaser(2, "the-fate-of-numenor", "The Grey Havens", { sharedEncounterDeck2: "unchartedDeck" }),
      dreamChaser(3, "raid-on-the-grey-havens", "The Grey Havens"),
      dreamChaser(4, "flight-of-the-stormcaller", "Flight of the Stormcaller", { sharedEncounterDeck2: "corsairDeck", sharedQuestDeck2: "stormcallerQuests" }),
      dreamChaser(5, "the-thing-in-the-depths", "The Thing in the Depths", { sharedEncounterDeck2: "encounterDeck2" }),
      dreamChaser(6, "temple-of-the-deceived", "Temple of the Deceived", { sharedEncounterDeck2: "islandMap" }),
      dreamChaser(7, "the-drowned-ruins", "The Drowned Ruins", { sharedEncounterDeck2: "grottoDeck", player1Play1: "setAside" }),
      dreamChaser(8, "a-storm-on-cobas-haven", "A Storm on Cobas Haven", { sharedEncounterDeck2: "corsairDeck" }),
      dreamChaser(9, "the-city-of-corsairs", "The City of Corsairs", { sharedEncounterDeck2: "corsairDeck", sharedEncounterDeck3: "encounterDeck2" }),
    ],
    bookletId: "dream-chaser",
    bookletDoc: "dcce",
    saga: false,
    xp: true,
    ledger: "dream-chaser",
  },
  {
    id: "ered-mithrin",
    name: "Ered Mithrin",
    released: "2024-06-28",
    products: ["The Wilds of Rhovanion", "The Withered Heath", "Roam Across Rhovanion", "Fire in the Night", "The Ghost of Framsburg", "Mount Gundabad", "The Fate of Wilderland", EMCE],
    scenarios: [
      eredMithrin(1, "journey-up-the-anduin", "The Wilds of Rhovanion", { sharedEncounterDeck2: "evilCreaturesDeck" }),
      eredMithrin(2, "lost-in-mirkwood", "The Wilds of Rhovanion", { sharedEncounterDeck2: "spidersDeck", sharedEncounterDeck3: "orcsDeck", player1Play1: "setAside" }),
      eredMithrin(3, "the-kings-quest", "The Wilds of Rhovanion", { sharedEncounterDeck2: "cavesDeck" }),
      eredMithrin(4, "the-withered-heath", "The Withered Heath", { sharedEncounterDeck2: "cavesDeck" }),
      eredMithrin(5, "roam-across-rhovanion", "Roam Across Rhovanion"),
      eredMithrin(6, "fire-in-the-night", "Fire in the Night", { sharedEncounterDeck2: "sideQuestDeck" }),
      eredMithrin(7, "the-ghost-of-framsburg", "The Ghost of Framsburg"),
      eredMithrin(8, "mount-gundabad", "Mount Gundabad", { sharedEncounterDeck2: "cavesDeck" }),
      eredMithrin(9, "the-fate-of-wilderland", "The Fate of Wilderland"),
    ],
    bookletId: "ered-mithrin",
    bookletDoc: "emce",
    saga: false,
    ledger: "ered-mithrin",
  },
  {
    id: "angmar-awakened",
    name: "Angmar Awakened",
    released: "2022-08-19",
    products: ["The Lost Realm", "The Wastes of Eriador", "Escape from Mount Gram", "Across the Ettenmoors", "The Treachery of Rhudaur", "The Battle of Carn Dûm", "The Dread Realm", AACE],
    scenarios: [
      angmarAwakened(1, "intruders-in-chetwood", "The Lost Realm", { player1Play1: "setAside" }),
      angmarAwakened(2, "the-weather-hills", "The Lost Realm", { sharedEncounterDeck2: "angmarOrcDeck" }),
      angmarAwakened(3, "deadmens-dike", "The Lost Realm", { player1Play1: "setAside" }),
      angmarAwakened(4, "the-wastes-of-eriador", "The Wastes of Eriador"),
      angmarAwakened(5, "escape-from-mount-gram", "Escape from Mount Gram", { sharedEncounterDeck2: "encounterDeck2" }),
      angmarAwakened(6, "across-the-ettenmoors", "Across the Ettenmoors", { player1Play1: "setAside" }),
      angmarAwakened(7, "the-treachery-of-rhudaur", "The Treachery of Rhudaur", { player1Play1: "setAside" }),
      angmarAwakened(8, "the-battle-of-carn-dum", "The Battle of Carn Dûm"),
      angmarAwakened(9, "the-dread-realm", "The Dread Realm"),
    ],
    bookletId: "angmar-awakened",
    bookletDoc: "mec108",
    saga: false,
    ledger: "angmar-awakened",
  },
  {
    id: "the-two-towers",
    name: "The Two Towers",
    released: "2023-10-06",
    products: ["The Treason of Saruman", "The Land of Shadow"],
    scenarios: [
      twoTowers("the-uruk-hai", "The Treason of Saruman"),
      twoTowers("helms-deep", "The Treason of Saruman"),
      twoTowers("the-road-to-isengard", "The Treason of Saruman"),
      twoTowers("the-passage-of-the-marshes", "The Land of Shadow", { sidedLoad: true }),
      twoTowers("journey-to-the-cross-roads", "The Land of Shadow", { groups: { sharedEncounterDeck2: "haradDeck" } }),
      twoTowers("shelobs-lair", "The Land of Shadow", { groups: { sharedEncounterDeck2: "greatSpiderDeck" }, sidedLoad: true, takeControlFaceup: true }),
    ],
    bookletId: "the-two-towers",
    bookletDoc: "mec112",
    saga: true,
    ledger: "the-two-towers",
    ownTitles: true,
  },
  {
    id: "the-return-of-the-king",
    name: "The Return of the King",
    released: "2024-10-10",
    products: ["The Flame of the West", "The Mountain of Fire"],
    scenarios: [
      returnOfTheKing("the-passing-of-the-grey-company", "The Flame of the West"),
      returnOfTheKing("the-siege-of-gondor", "The Flame of the West", { sidedLoad: true }),
      returnOfTheKing("the-battle-of-the-pelennor-fields", "The Flame of the West", { sidedLoad: true }),
      returnOfTheKing("the-tower-of-cirith-ungol", "The Mountain of Fire", { sidedLoad: true }),
      returnOfTheKing("the-black-gate-opens", "The Mountain of Fire"),
      returnOfTheKing("mount-doom", "The Mountain of Fire", { sagaStartAside: true }),
    ],
    bookletId: "the-return-of-the-king",
    bookletDoc: "mec113",
    saga: true,
    ledger: "the-return-of-the-king",
    ownTitles: true,
  },
  ...CYCLE_DEFS,
];

// The packs of the products built from Hall of Beorn alone (no twin pack): their boons and burdens have a pool file of their own.
export const HOB_ONLY_PACKS: ReadonlySet<string> = new Set(PRODUCTS.flatMap((product) => (product.twinPack === null ? product.packs : [])));

// Every product a campaign or scenario names is in PRODUCTS.
for (const campaign of CAMPAIGNS) {
  for (const name of campaign.products) productOf(name);
  for (const scenario of campaign.scenarios) productOf(scenario.product);
}

// Every Hall of Beorn product some campaign is built from: what the sync snapshots scenario files for.
// (Hall of Beorn's own name for each: a product lists its scenarios in Scenarios.json under `scenarioProduct` where that differs from the card set.)
export function scenarioProductOf(name: string): string {
  return productOf(name).scenarioProduct ?? name;
}
export const BUILT_SCENARIO_PRODUCTS: ReadonlySet<string> = new Set(CAMPAIGNS.flatMap((campaign) => campaign.products.map(scenarioProductOf)));
// Whether a Scenarios.json entry is one of a product's scenarios: its product is the product's, and where the product names its one title, the title is it.
export function productListsScenario(name: string, entry: { Product: string; Title: string }): boolean {
  const def = productOf(name);
  return (def.scenarioProduct ?? name) === entry.Product && (def.scenarioTitle === undefined || def.scenarioTitle === entry.Title);
}
export function isBuiltScenario(entry: { Product: string; Title: string }): boolean {
  return CAMPAIGNS.some((campaign) => campaign.products.some((name) => productListsScenario(name, entry)));
}

// Hall of Beorn lists a scenario as "Passage Through Mirkwood (Campaign)" when it is the campaign-mode edition of a box
// that also prints a Nightmare or standalone scenario. The suffix is not part of the scenario's name.
export const CAMPAIGN_SUFFIX = / \(Campaign\)$/;

export function scenarioSlug(title: string): string {
  return title
    .replace(CAMPAIGN_SUFFIX, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// The built scenarios, each once, in the order the campaigns first list them.
export function scenarioDefs(campaigns: readonly CampaignDef[] = CAMPAIGNS): ScenarioDef[] {
  const seen = new Map<string, ScenarioDef>();
  for (const campaign of campaigns) for (const scenario of campaign.scenarios) if (!seen.has(scenario.id)) seen.set(scenario.id, scenario);
  return [...seen.values()];
}
