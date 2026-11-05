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
// import * as corsairs from "../scenarios/the-city-of-corsairs/game.ts";

import type { PlayedGame } from "./game-kit.ts";

// Every scenario's golden games (the `*_GOLDENS` of its test/scenarios/<id>/game.ts), in campaign order. src/campaign/causes.test.ts
// checks the cause of every number-changing step of each and src/campaign/replay.test.ts replays each from its save, so a new scenario
// is checked in both by adding its line here. The golden.json beside each scenario's golden.test.ts pins the same games. A Shadow of the
// Past's goldens are the filler-hero games and the starter decks (test/scenarios/a-shadow-of-the-past/game.ts); those two tests read
// them directly.
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
  // entry("the-city-of-corsairs", "The City of Corsairs", corsairs.CORSAIRS_GOLDENS, corsairs.corsairsWorld, corsairs.playGolden),
];
