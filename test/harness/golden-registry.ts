import type { ReduceContext } from "../../src/rules/engine/reduce.ts";

import * as knife from "../scenarios/a-knife-in-the-dark/game.ts";
import * as ford from "../scenarios/flight-to-the-ford/game.ts";
import * as south from "../scenarios/the-ring-goes-south/game.ts";
import * as moria from "../scenarios/journey-in-the-dark/game.ts";
import * as breaking from "../scenarios/breaking-of-the-fellowship/game.ts";
import * as mirkwood from "../scenarios/passage-through-mirkwood/game.ts";
import * as anduin from "../scenarios/journey-along-the-anduin/game.ts";
import * as dolGuldur from "../scenarios/escape-from-dol-guldur/game.ts";
import * as oath from "../scenarios/the-oath/game.ts";
import * as caves from "../scenarios/the-caves-of-nibin-dum/game.ts";
import * as voyage from "../scenarios/voyage-across-belegaer/game.ts";
import * as fate from "../scenarios/the-fate-of-numenor/game.ts";
import * as raid from "../scenarios/raid-on-the-grey-havens/game.ts";
import * as flight from "../scenarios/flight-of-the-stormcaller/game.ts";
import * as depths from "../scenarios/the-thing-in-the-depths/game.ts";
import * as temple from "../scenarios/temple-of-the-deceived/game.ts";
import * as ruins from "../scenarios/the-drowned-ruins/game.ts";
import * as haven from "../scenarios/a-storm-on-cobas-haven/game.ts";
import * as corsairs from "../scenarios/the-city-of-corsairs/game.ts";
import * as upanduin from "../scenarios/journey-up-the-anduin/game.ts";
import * as lostmirk from "../scenarios/lost-in-mirkwood/game.ts";
import * as kingsquest from "../scenarios/the-kings-quest/game.ts";
import * as heath from "../scenarios/the-withered-heath/game.ts";
import * as rhovanion from "../scenarios/roam-across-rhovanion/game.ts";
import * as night from "../scenarios/fire-in-the-night/game.ts";
import * as framsburg from "../scenarios/the-ghost-of-framsburg/game.ts";
import * as gundabad from "../scenarios/mount-gundabad/game.ts";
import * as wilderland from "../scenarios/the-fate-of-wilderland/game.ts";
import * as hai from "../scenarios/the-uruk-hai/game.ts";
import * as deep from "../scenarios/helms-deep/game.ts";
import * as isengard from "../scenarios/the-road-to-isengard/game.ts";
import * as marshes from "../scenarios/the-passage-of-the-marshes/game.ts";
import * as roads from "../scenarios/journey-to-the-cross-roads/game.ts";
import * as lair from "../scenarios/shelobs-lair/game.ts";
import * as company from "../scenarios/the-passing-of-the-grey-company/game.ts";
import * as gondor from "../scenarios/the-siege-of-gondor/game.ts";
import * as fields from "../scenarios/the-battle-of-the-pelennor-fields/game.ts";
import * as ungol from "../scenarios/the-tower-of-cirith-ungol/game.ts";
import * as opens from "../scenarios/the-black-gate-opens/game.ts";
import * as doom from "../scenarios/mount-doom/game.ts";
import * as chetwood from "../scenarios/intruders-in-chetwood/game.ts";
import * as hills from "../scenarios/the-weather-hills/game.ts";
import * as dike from "../scenarios/deadmens-dike/game.ts";
import * as eriador from "../scenarios/the-wastes-of-eriador/game.ts";
import * as gram from "../scenarios/escape-from-mount-gram/game.ts";
import * as ettenmoors from "../scenarios/across-the-ettenmoors/game.ts";
import * as rhudaur from "../scenarios/the-treachery-of-rhudaur/game.ts";
import * as dum from "../scenarios/the-battle-of-carn-dum/game.ts";
import * as realm from "../scenarios/the-dread-realm/game.ts";
import * as gollum from "../scenarios/the-hunt-for-gollum/game.ts";
import * as carrock from "../scenarios/conflict-at-the-carrock/game.ts";
import * as rhosgobel from "../scenarios/a-journey-to-rhosgobel/game.ts";
import * as muil from "../scenarios/the-hills-of-emyn-muil/game.ts";
import * as deadmarshes from "../scenarios/the-dead-marshes/game.ts";
import * as returnmirkwood from "../scenarios/return-to-mirkwood/game.ts";
import * as pit from "../scenarios/into-the-pit/game.ts";
import * as level from "../scenarios/the-seventh-level/game.ts";
import * as frommoria from "../scenarios/flight-from-moria/game.ts";
import * as gate from "../scenarios/the-redhorn-gate/game.ts";
import * as rivendell from "../scenarios/road-to-rivendell/game.ts";
import * as water from "../scenarios/the-watcher-in-the-water/game.ts";
import * as dark from "../scenarios/the-long-dark/game.ts";
import * as stone from "../scenarios/foundations-of-stone/game.ts";
import * as flame from "../scenarios/shadow-and-flame/game.ts";
import * as osgiliath from "../scenarios/the-massing-at-osgiliath/game.ts";
import * as town from "../scenarios/the-battle-of-lake-town/game.ts";
import * as erech from "../scenarios/the-stone-of-erech/game.ts";
import * as forest from "../scenarios/the-old-forest/game.ts";
import * as downs from "../scenarios/fog-on-the-barrow-downs/game.ts";
import * as belegost from "../scenarios/the-ruins-of-belegost/game.ts";
import * as pony from "../scenarios/murder-at-the-prancing-pony/game.ts";
import * as annuminas from "../scenarios/the-siege-of-annuminas/game.ts";
import * as guldur from "../scenarios/attack-on-dol-guldur/game.ts";
import * as quest from "../scenarios/the-wizards-quest/game.ts";
import * as woodland from "../scenarios/the-woodland-realm/game.ts";
import * as mines from "../scenarios/the-mines-of-moria/game.ts";
import * as khazad from "../scenarios/escape-from-khazad-dum/game.ts";
import * as dreadnaught from "../scenarios/the-hunt-for-the-dreadnaught/game.ts";
import * as grim from "../scenarios/over-the-misty-mountains-grim/game.ts";

import type { PlayedGame } from "./game-kit.ts";

// Every scenario's golden games (the `*_GOLDENS` of its test/scenarios/<id>/game.ts), in campaign order and then the cycle's pack order. The reader check
// (src/play/reader-play/games.ts) plays them, `pnpm test scenario` filters the fixtures by an entry's title and
// `pnpm scenario new` reads the previous part's names here. Each scenario's golden.test.ts plays, pins, cause-checks and replays its
// goldens (test/harness/golden-suite.ts). A Shadow of the Past's goldens are the filler-hero games and the starter decks
// (test/scenarios/a-shadow-of-the-past/game.ts); src/campaign/causes.test.ts and replay.test.ts read them directly.
export type GoldenGame = Pick<PlayedGame, "start" | "intents" | "state" | "steps">;

export type GoldenEntry = {
  scenarioId: string;
  title: string;
  goldens: readonly { name: string; decks: string }[];
  /** The world a golden with these decks is played in. */
  world: (decks: string) => Promise<{ ctx: ReduceContext }>;
  play: (golden: { name: string; decks: string }, ctx: ReduceContext) => GoldenGame;
};

// Erases a scenario's own golden and deck types: its goldens are played in the world of their own `decks`.
function entry<G extends { name: string; decks: string }>(scenarioId: string, title: string, goldens: readonly G[], world: (decks: G["decks"]) => Promise<{ ctx: ReduceContext }>, play: (golden: G, ctx: ReduceContext) => GoldenGame): GoldenEntry {
  return { scenarioId, title, goldens, world: (decks) => world(decks as G["decks"]), play: (golden, ctx) => play(golden as G, ctx) };
}

export const GOLDEN_REGISTRY: readonly GoldenEntry[] = [
  entry("a-knife-in-the-dark", "A Knife in the Dark", knife.KNIFE_GOLDENS, knife.knifeWorld, knife.playGolden),
  entry("flight-to-the-ford", "Flight to the Ford", ford.FORD_GOLDENS, ford.fordWorld, ford.playGolden),
  entry("the-ring-goes-south", "The Ring Goes South", south.SOUTH_GOLDENS, south.southWorld, south.playGolden),
  entry("journey-in-the-dark", "Journey in the Dark", moria.MORIA_GOLDENS, moria.moriaWorld, moria.playGolden),
  entry("breaking-of-the-fellowship", "Breaking of the Fellowship", breaking.BREAKING_GOLDENS, breaking.breakingGameWorld, breaking.playGolden),
  entry("passage-through-mirkwood", "Passage Through Mirkwood", mirkwood.MIRKWOOD_GOLDENS, mirkwood.mirkwoodWorld, mirkwood.playGolden),
  entry("journey-along-the-anduin", "Journey Along the Anduin", anduin.ANDUIN_GOLDENS, anduin.anduinWorld, anduin.playGolden),
  entry("escape-from-dol-guldur", "Escape from Dol Guldur", dolGuldur.DOL_GULDUR_GOLDENS, dolGuldur.dolGuldurWorld, dolGuldur.playGolden),
  entry("the-oath", "The Oath", oath.OATH_GOLDENS, oath.oathWorld, oath.playGolden),
  entry("the-caves-of-nibin-dum", "The Caves of Nibin-Dûm", caves.CAVES_GOLDENS, caves.cavesWorld, caves.playGolden),
  entry("voyage-across-belegaer", "Voyage Across Belegaer", voyage.VOYAGE_GOLDENS, voyage.voyageWorld, voyage.playGolden),
  entry("the-fate-of-numenor", "The Fate of Númenor", fate.FATE_GOLDENS, fate.fateWorld, fate.playGolden),
  entry("raid-on-the-grey-havens", "Raid on the Grey Havens", raid.RAID_GOLDENS, raid.raidWorld, raid.playGolden),
  entry("flight-of-the-stormcaller", "Flight of the Stormcaller", flight.FLIGHT_GOLDENS, flight.flightWorld, flight.playGolden),
  entry("the-thing-in-the-depths", "The Thing in the Depths", depths.DEPTHS_GOLDENS, depths.depthsWorld, depths.playGolden),
  entry("temple-of-the-deceived", "Temple of the Deceived", temple.TEMPLE_GOLDENS, temple.templeWorld, temple.playGolden),
  entry("the-drowned-ruins", "The Drowned Ruins", ruins.RUINS_GOLDENS, ruins.ruinsWorld, ruins.playGolden),
  entry("a-storm-on-cobas-haven", "A Storm on Cobas Haven", haven.HAVEN_GOLDENS, haven.havenWorld, haven.playGolden),
  entry("the-city-of-corsairs", "The City of Corsairs", corsairs.CORSAIRS_GOLDENS, corsairs.corsairsWorld, corsairs.playGolden),
  entry("journey-up-the-anduin", "Journey Up the Anduin", upanduin.UPANDUIN_GOLDENS, upanduin.upanduinWorld, upanduin.playGolden),
  entry("lost-in-mirkwood", "Lost in Mirkwood", lostmirk.LOSTMIRK_GOLDENS, lostmirk.lostmirkWorld, lostmirk.playGolden),
  entry("the-kings-quest", "The King's Quest", kingsquest.KINGSQUEST_GOLDENS, kingsquest.kingsquestWorld, kingsquest.playGolden),
  entry("the-withered-heath", "The Withered Heath", heath.HEATH_GOLDENS, heath.heathWorld, heath.playGolden),
  entry("roam-across-rhovanion", "Roam Across Rhovanion", rhovanion.RHOVANION_GOLDENS, rhovanion.rhovanionWorld, rhovanion.playGolden),
  entry("fire-in-the-night", "Fire in the Night", night.NIGHT_GOLDENS, night.nightWorld, night.playGolden),
  entry("the-ghost-of-framsburg", "The Ghost of Framsburg", framsburg.FRAMSBURG_GOLDENS, framsburg.framsburgWorld, framsburg.playGolden),
  entry("mount-gundabad", "Mount Gundabad", gundabad.GUNDABAD_GOLDENS, gundabad.gundabadWorld, gundabad.playGolden),
  entry("the-fate-of-wilderland", "The Fate of Wilderland", wilderland.WILDERLAND_GOLDENS, wilderland.wilderlandWorld, wilderland.playGolden),
  entry("intruders-in-chetwood", "Intruders in Chetwood", chetwood.CHETWOOD_GOLDENS, chetwood.chetwoodWorld, chetwood.playGolden),
  entry("the-weather-hills", "The Weather Hills", hills.HILLS_GOLDENS, hills.hillsWorld, hills.playGolden),
  entry("deadmens-dike", "Deadmen's Dike", dike.DIKE_GOLDENS, dike.dikeWorld, dike.playGolden),
  entry("the-wastes-of-eriador", "The Wastes of Eriador", eriador.ERIADOR_GOLDENS, eriador.eriadorWorld, eriador.playGolden),
  entry("escape-from-mount-gram", "Escape from Mount Gram", gram.GRAM_GOLDENS, gram.gramWorld, gram.playGolden),
  entry("across-the-ettenmoors", "Across the Ettenmoors", ettenmoors.ETTENMOORS_GOLDENS, ettenmoors.ettenmoorsWorld, ettenmoors.playGolden),
  entry("the-treachery-of-rhudaur", "The Treachery of Rhudaur", rhudaur.RHUDAUR_GOLDENS, rhudaur.rhudaurWorld, rhudaur.playGolden),
  entry("the-battle-of-carn-dum", "The Battle of Carn Dûm", dum.DUM_GOLDENS, dum.dumWorld, dum.playGolden),
  entry("the-dread-realm", "The Dread Realm", realm.REALM_GOLDENS, realm.realmWorld, realm.playGolden),
  entry("the-uruk-hai", "The Uruk-hai", hai.HAI_GOLDENS, hai.haiWorld, hai.playGolden),
  entry("helms-deep", "Helm's Deep", deep.DEEP_GOLDENS, deep.deepWorld, deep.playGolden),
  entry("the-road-to-isengard", "The Road to Isengard", isengard.ISENGARD_GOLDENS, isengard.isengardWorld, isengard.playGolden),
  entry("the-passage-of-the-marshes", "The Passage of the Marshes", marshes.MARSHES_GOLDENS, marshes.marshesWorld, marshes.playGolden),
  entry("journey-to-the-cross-roads", "Journey to the Cross-roads", roads.ROADS_GOLDENS, roads.roadsWorld, roads.playGolden),
  entry("shelobs-lair", "Shelob's Lair", lair.LAIR_GOLDENS, lair.lairWorld, lair.playGolden),
  entry("the-passing-of-the-grey-company", "The Passing of the Grey Company", company.COMPANY_GOLDENS, company.companyWorld, company.playGolden),
  entry("the-siege-of-gondor", "The Siege of Gondor", gondor.GONDOR_GOLDENS, gondor.gondorWorld, gondor.playGolden),
  entry("the-battle-of-the-pelennor-fields", "The Battle of the Pelennor Fields", fields.FIELDS_GOLDENS, fields.fieldsWorld, fields.playGolden),
  entry("the-tower-of-cirith-ungol", "The Tower of Cirith Ungol", ungol.UNGOL_GOLDENS, ungol.ungolWorld, ungol.playGolden),
  entry("the-black-gate-opens", "The Black Gate Opens", opens.OPENS_GOLDENS, opens.opensWorld, opens.playGolden),
  entry("mount-doom", "Mount Doom", doom.DOOM_GOLDENS, doom.doomWorld, doom.playGolden),
  // Shadows of Mirkwood, a cycle (standalone games, no Campaign Mode), after the campaigns: `pnpm scenario new` adds each scenario's entry here, in pack order.
  entry("the-hunt-for-gollum", "The Hunt for Gollum", gollum.GOLLUM_GOLDENS, gollum.gollumWorld, gollum.playGolden),
  entry("conflict-at-the-carrock", "Conflict at the Carrock", carrock.CARROCK_GOLDENS, carrock.carrockWorld, carrock.playGolden),
  entry("a-journey-to-rhosgobel", "A Journey to Rhosgobel", rhosgobel.RHOSGOBEL_GOLDENS, rhosgobel.rhosgobelWorld, rhosgobel.playGolden),
  entry("the-hills-of-emyn-muil", "The Hills of Emyn Muil", muil.MUIL_GOLDENS, muil.muilWorld, muil.playGolden),
  entry("the-dead-marshes", "The Dead Marshes", deadmarshes.DEADMARSHES_GOLDENS, deadmarshes.deadmarshesWorld, deadmarshes.playGolden),
  entry("return-to-mirkwood", "Return to Mirkwood", returnmirkwood.RETURNMIRKWOOD_GOLDENS, returnmirkwood.returnmirkwoodWorld, returnmirkwood.playGolden),
  entry("into-the-pit", "Into the Pit", pit.PIT_GOLDENS, pit.pitWorld, pit.playGolden),
  entry("the-seventh-level", "The Seventh Level", level.LEVEL_GOLDENS, level.levelWorld, level.playGolden),
  entry("flight-from-moria", "Flight from Moria", frommoria.FROMMORIA_GOLDENS, frommoria.frommoriaWorld, frommoria.playGolden),
  entry("the-redhorn-gate", "The Redhorn Gate", gate.GATE_GOLDENS, gate.gateWorld, gate.playGolden),
  entry("road-to-rivendell", "Road to Rivendell", rivendell.RIVENDELL_GOLDENS, rivendell.rivendellWorld, rivendell.playGolden),
  entry("the-watcher-in-the-water", "The Watcher in the Water", water.WATER_GOLDENS, water.waterWorld, water.playGolden),
  entry("the-long-dark", "The Long Dark", dark.DARK_GOLDENS, dark.darkWorld, dark.playGolden),
  entry("foundations-of-stone", "Foundations of Stone", stone.STONE_GOLDENS, stone.stoneWorld, stone.playGolden),
  entry("shadow-and-flame", "Shadow and Flame", flame.FLAME_GOLDENS, flame.flameWorld, flame.playGolden),
  entry("over-the-misty-mountains-grim", "Over the Misty Mountains Grim", grim.GRIM_GOLDENS, grim.grimWorld, grim.playGolden),
  entry("the-massing-at-osgiliath", "The Massing at Osgiliath", osgiliath.OSGILIATH_GOLDENS, osgiliath.osgiliathWorld, osgiliath.playGolden),
  entry("the-battle-of-lake-town", "The Battle of Lake-town", town.TOWN_GOLDENS, town.townWorld, town.playGolden),
  entry("the-stone-of-erech", "The Stone of Erech", erech.ERECH_GOLDENS, erech.erechWorld, erech.playGolden),
  entry("the-old-forest", "The Old Forest", forest.FOREST_GOLDENS, forest.forestWorld, forest.playGolden),
  entry("fog-on-the-barrow-downs", "Fog on the Barrow-downs", downs.DOWNS_GOLDENS, downs.downsWorld, downs.playGolden),
  entry("the-ruins-of-belegost", "The Ruins of Belegost", belegost.BELEGOST_GOLDENS, belegost.belegostWorld, belegost.playGolden),
  entry("murder-at-the-prancing-pony", "Murder at the Prancing Pony", pony.PONY_GOLDENS, pony.ponyWorld, pony.playGolden),
  entry("the-siege-of-annuminas", "The Siege of Annúminas", annuminas.ANNUMINAS_GOLDENS, annuminas.annuminasWorld, annuminas.playGolden),
  entry("attack-on-dol-guldur", "Attack on Dol Guldur", guldur.GULDUR_GOLDENS, guldur.guldurWorld, guldur.playGolden),
  entry("the-wizards-quest", "The Wizard's Quest", quest.QUEST_GOLDENS, quest.questWorld, quest.playGolden),
  entry("the-woodland-realm", "The Woodland Realm", woodland.WOODLAND_GOLDENS, woodland.woodlandWorld, woodland.playGolden),
  entry("the-mines-of-moria", "The Mines of Moria", mines.MINES_GOLDENS, mines.minesWorld, mines.playGolden),
  entry("escape-from-khazad-dum", "Escape from Khazad-dûm", khazad.KHAZAD_GOLDENS, khazad.khazadWorld, khazad.playGolden),
  entry("the-hunt-for-the-dreadnaught", "The Hunt for the Dreadnaught", dreadnaught.DREADNAUGHT_GOLDENS, dreadnaught.dreadnaughtWorld, dreadnaught.playGolden),
];
