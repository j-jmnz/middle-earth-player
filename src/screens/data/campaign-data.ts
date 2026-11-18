import shadowsOfMirkwood from "../../../data/campaigns/shadows-of-mirkwood.json";
import standaloneScenarios from "../../../data/campaigns/standalone-scenarios.json";
import dreamChaser from "../../../data/campaigns/dream-chaser.json";
import fellowship from "../../../data/campaigns/fellowship-of-the-ring.json";
import darkOfMirkwood from "../../../data/campaigns/the-dark-of-mirkwood.json";
import eredMithrin from "../../../data/campaigns/ered-mithrin.json";
import angmarAwakened from "../../../data/campaigns/angmar-awakened.json";
import returnOfTheKing from "../../../data/campaigns/the-return-of-the-king.json";
import twoTowers from "../../../data/campaigns/the-two-towers.json";
import mirkwoodPaths from "../../../data/campaigns/mirkwood-paths.json";
import hunt from "../../../data/scenarios/the-hunt-for-gollum.json";
import carrock from "../../../data/scenarios/conflict-at-the-carrock.json";
import rhosgobel from "../../../data/scenarios/a-journey-to-rhosgobel.json";
import emynMuil from "../../../data/scenarios/the-hills-of-emyn-muil.json";
import deadMarshes from "../../../data/scenarios/the-dead-marshes.json";
import returnToMirkwood from "../../../data/scenarios/return-to-mirkwood.json";
import massing from "../../../data/scenarios/the-massing-at-osgiliath.json";
import lakeTown from "../../../data/scenarios/the-battle-of-lake-town.json";
import stoneOfErech from "../../../data/scenarios/the-stone-of-erech.json";
import anduin from "../../../data/scenarios/journey-along-the-anduin.json";
import knife from "../../../data/scenarios/a-knife-in-the-dark.json";
import past from "../../../data/scenarios/a-shadow-of-the-past.json";
import breaking from "../../../data/scenarios/breaking-of-the-fellowship.json";
import dolGuldur from "../../../data/scenarios/escape-from-dol-guldur.json";
import flight from "../../../data/scenarios/flight-to-the-ford.json";
import journey from "../../../data/scenarios/journey-in-the-dark.json";
import caves from "../../../data/scenarios/the-caves-of-nibin-dum.json";
import oath from "../../../data/scenarios/the-oath.json";
import passage from "../../../data/scenarios/passage-through-mirkwood.json";
import south from "../../../data/scenarios/the-ring-goes-south.json";
import voyage from "../../../data/scenarios/voyage-across-belegaer.json";
import fate from "../../../data/scenarios/the-fate-of-numenor.json";
import raid from "../../../data/scenarios/raid-on-the-grey-havens.json";
import stormcaller from "../../../data/scenarios/flight-of-the-stormcaller.json";
import depths from "../../../data/scenarios/the-thing-in-the-depths.json";
import temple from "../../../data/scenarios/temple-of-the-deceived.json";
import ruins from "../../../data/scenarios/the-drowned-ruins.json";
import cobas from "../../../data/scenarios/a-storm-on-cobas-haven.json";
import corsairs from "../../../data/scenarios/the-city-of-corsairs.json";
import upTheAnduin from "../../../data/scenarios/journey-up-the-anduin.json";
import lostInMirkwood from "../../../data/scenarios/lost-in-mirkwood.json";
import kingsQuest from "../../../data/scenarios/the-kings-quest.json";
import witheredHeath from "../../../data/scenarios/the-withered-heath.json";
import roam from "../../../data/scenarios/roam-across-rhovanion.json";
import fireInTheNight from "../../../data/scenarios/fire-in-the-night.json";
import framsburg from "../../../data/scenarios/the-ghost-of-framsburg.json";
import gundabad from "../../../data/scenarios/mount-gundabad.json";
import wilderland from "../../../data/scenarios/the-fate-of-wilderland.json";
import urukHai from "../../../data/scenarios/the-uruk-hai.json";
import helmsDeep from "../../../data/scenarios/helms-deep.json";
import isengard from "../../../data/scenarios/the-road-to-isengard.json";
import marshes from "../../../data/scenarios/the-passage-of-the-marshes.json";
import crossRoads from "../../../data/scenarios/journey-to-the-cross-roads.json";
import shelob from "../../../data/scenarios/shelobs-lair.json";
import greyCompany from "../../../data/scenarios/the-passing-of-the-grey-company.json";
import siege from "../../../data/scenarios/the-siege-of-gondor.json";
import pelennor from "../../../data/scenarios/the-battle-of-the-pelennor-fields.json";
import cirithUngol from "../../../data/scenarios/the-tower-of-cirith-ungol.json";
import blackGate from "../../../data/scenarios/the-black-gate-opens.json";
import mountDoom from "../../../data/scenarios/mount-doom.json";
import intruders from "../../../data/scenarios/intruders-in-chetwood.json";
import weatherHills from "../../../data/scenarios/the-weather-hills.json";
import deadmensDike from "../../../data/scenarios/deadmens-dike.json";
import wastes from "../../../data/scenarios/the-wastes-of-eriador.json";
import mountGram from "../../../data/scenarios/escape-from-mount-gram.json";
import ettenmoors from "../../../data/scenarios/across-the-ettenmoors.json";
import rhudaur from "../../../data/scenarios/the-treachery-of-rhudaur.json";
import carnDum from "../../../data/scenarios/the-battle-of-carn-dum.json";
import dreadRealm from "../../../data/scenarios/the-dread-realm.json";
import { printedScenarioName } from "../../campaign/printed-name";
import { campaignDataSchema, parseAnyScenarioData, type AnyScenarioData, type CampaignData } from "../../catalog/scenario-data";

// The registry: every built campaign and scenario by id, from data/ (generated by pnpm data build). The phone reads no other
// source for them. Metro needs static JSON imports, so the map is written by hand; campaign-data.test.ts checks it against
// data/campaigns/index.json and data/scenarios. Each file is parsed (zod) the first time it is asked for, not when the module
// loads, and kept: the app opens without parsing every scenario, and a screen pays only for the ones it shows.
const RAW_CAMPAIGNS: Readonly<Record<string, unknown>> = Object.fromEntries([shadowsOfMirkwood, standaloneScenarios, fellowship, mirkwoodPaths, darkOfMirkwood, dreamChaser, eredMithrin, angmarAwakened, twoTowers, returnOfTheKing].map((raw) => [raw.id, raw]));
const RAW_SCENARIOS: Readonly<Record<string, unknown>> = Object.fromEntries([past, knife, flight, south, journey, breaking, passage, anduin, dolGuldur, oath, caves, voyage, fate, raid, stormcaller, depths, temple, ruins, cobas, corsairs, upTheAnduin, lostInMirkwood, kingsQuest, witheredHeath, roam, fireInTheNight, framsburg, gundabad, wilderland, urukHai, helmsDeep, isengard, marshes, crossRoads, shelob, greyCompany, siege, pelennor, cirithUngol, blackGate, mountDoom, intruders, weatherHills, deadmensDike, wastes, mountGram, ettenmoors, rhudaur, carnDum, dreadRealm, hunt, carrock, rhosgobel, emynMuil, deadMarshes, returnToMirkwood, massing, lakeTown, stoneOfErech].map((raw) => [raw.id, raw]));

const campaigns = new Map<string, CampaignData>();
const scenarios = new Map<string, AnyScenarioData>();

/** The campaign ids the registry holds, in list order. */
export function campaignIds(): readonly string[] {
  return Object.keys(RAW_CAMPAIGNS);
}

/**
 * A box: the scenarios one product prints, as the Scenarios tab lists them and standalone play deals them. `campaignId` is the
 * campaign whose flags (saga, booklet) the box's standalone games follow. The Oath and The Caves of Nibin-Dûm are in two campaigns
 * but one box, The Dark of Mirkwood. `name` is the printed product.
 */
export type Box = { id: string; name: string; campaignId: string; scenarios: readonly string[]; /** Titles of the cycle's scenarios not built yet, in release order (the campaign file's `later`); each waits under Coming later. */ later?: readonly string[] };

export const BOXES: readonly Box[] = [
  // In the campaigns table's order (`position`): by release, the Lord of the Rings saga boxes together at the Fellowship's.
  // Shadows of Mirkwood is a cycle, not a campaign: its six Adventure Packs have no Campaign Mode and are played standalone only (docs/brief.md, Shadows of Mirkwood).
  { id: "shadows-of-mirkwood", name: "Shadows of Mirkwood", campaignId: "shadows-of-mirkwood", scenarios: ["the-hunt-for-gollum", "conflict-at-the-carrock", "a-journey-to-rhosgobel", "the-hills-of-emyn-muil", "the-dead-marshes", "return-to-mirkwood"] },
  // The Standalone scenarios cycle likewise, one box in release order; its scenarios not built yet wait under Coming later (docs/brief.md, Standalone scenarios).
  { id: "standalone-scenarios", name: "Standalone scenarios", campaignId: "standalone-scenarios", scenarios: ["the-massing-at-osgiliath", "the-battle-of-lake-town", "the-stone-of-erech"], later: standaloneScenarios.later },
  { id: "revised-core", name: "Revised Core Set", campaignId: "mirkwood-paths", scenarios: ["passage-through-mirkwood", "journey-along-the-anduin", "escape-from-dol-guldur"] },
  { id: "the-dark-of-mirkwood", name: "The Dark of Mirkwood", campaignId: "the-dark-of-mirkwood", scenarios: ["the-oath", "the-caves-of-nibin-dum"] },
  // The Lost Realm and the six Adventure Packs are one box with the Campaign Expansion on the Scenarios tab, as the other campaign expansions' are.
  { id: "angmar-awakened", name: "Angmar Awakened Campaign Expansion", campaignId: "angmar-awakened", scenarios: ["intruders-in-chetwood", "the-weather-hills", "deadmens-dike", "the-wastes-of-eriador", "escape-from-mount-gram", "across-the-ettenmoors", "the-treachery-of-rhudaur", "the-battle-of-carn-dum", "the-dread-realm"] },
  { id: "fellowship-of-the-ring", name: "The Fellowship of the Ring Saga Expansion", campaignId: "fellowship-of-the-ring", scenarios: ["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford", "the-ring-goes-south", "journey-in-the-dark", "breaking-of-the-fellowship"] },
  // The Treason of Saruman and The Land of Shadow are the second saga box (MEC112); its standalone games follow its campaign's saga flag and the per-scenario saga start.
  { id: "the-two-towers", name: "The Two Towers Saga Expansion", campaignId: "the-two-towers", scenarios: ["the-uruk-hai", "helms-deep", "the-road-to-isengard", "the-passage-of-the-marshes", "journey-to-the-cross-roads", "shelobs-lair"] },
  // The Flame of the West and The Mountain of Fire are the third saga box (MEC113), played after The Two Towers.
  { id: "the-return-of-the-king", name: "The Return of the King Saga Expansion", campaignId: "the-return-of-the-king", scenarios: ["the-passing-of-the-grey-company", "the-siege-of-gondor", "the-battle-of-the-pelennor-fields", "the-tower-of-cirith-ungol", "the-black-gate-opens", "mount-doom"] },
  // The Grey Havens, the six Adventure Packs and the Campaign Expansion are one box on the Scenarios tab (user decision, 2026-10-30),
  // named by the RCO product that prints its nine scenarios.
  { id: "dream-chaser", name: "Dream-chaser Campaign Expansion", campaignId: "dream-chaser", scenarios: ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens", "flight-of-the-stormcaller", "the-thing-in-the-depths", "temple-of-the-deceived", "the-drowned-ruins", "a-storm-on-cobas-haven", "the-city-of-corsairs"] },
  // The Wilds of Rhovanion and the six Adventure Packs are one box with the Campaign Expansion on the Scenarios tab, as Dream-chaser's are.
  { id: "ered-mithrin", name: "Ered Mithrin Campaign Expansion", campaignId: "ered-mithrin", scenarios: ["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest", "the-withered-heath", "roam-across-rhovanion", "fire-in-the-night", "the-ghost-of-framsburg", "mount-gundabad", "the-fate-of-wilderland"] },
];

/** The box a scenario is printed in, or null for an id no box lists. */
export function boxOf(scenarioId: string): Box | null {
  return BOXES.find((box) => box.scenarios.includes(scenarioId)) ?? null;
}

/** The campaign a standalone game of the scenario follows (its box's), or null for an unknown scenario. */
export function campaignOfScenario(scenarioId: string): CampaignData | null {
  const box = boxOf(scenarioId);
  return box ? campaignOf(box.campaignId) : null;
}

export function campaignOf(campaignId: string): CampaignData | null {
  const kept = campaigns.get(campaignId);
  if (kept) return kept;
  if (!Object.hasOwn(RAW_CAMPAIGNS, campaignId)) return null;
  const raw = RAW_CAMPAIGNS[campaignId];
  const campaign = campaignDataSchema.parse(raw);
  campaigns.set(campaignId, campaign);
  return campaign;
}

export function scenarioOf(id: string): AnyScenarioData | null {
  const kept = scenarios.get(id);
  if (kept) return kept;
  if (!Object.hasOwn(RAW_SCENARIOS, id)) return null;
  const raw = RAW_SCENARIOS[id];
  const scenario = parseAnyScenarioData(raw);
  scenarios.set(id, scenario);
  return scenario;
}

/** The booklet page where a scenario's setup is printed, when the campaign registry records one. */
export function bookletPageOf(campaignId: string, scenarioId: string | null | undefined): number | null {
  const page = scenarioId ? campaignOf(campaignId)?.bookletPages?.[scenarioId] : undefined;
  return page ?? null;
}

/**
 * The router params that open the campaign's booklet (`bookletId`), on the scenario's page when one is recorded. A scenario the
 * campaign has no page for (The Oath and The Caves of Nibin-Dûm in Mirkwood Paths: the campaign's book does not print them) opens
 * the book of the box it is printed in, on its page there.
 */
export function bookletParams(campaignId: string, scenarioId?: string | null): { id: string; page?: string } {
  return bookletOf(campaignId, scenarioId) ?? { id: campaignId };
}

/**
 * The same as `bookletParams`, or null when there is none to open: a cycle (Shadows of Mirkwood) prints no booklet, only a
 * rules insert per Adventure Pack, which the reader does not open (docs/brief.md, Shadows of Mirkwood).
 */
export function bookletOf(campaignId: string, scenarioId?: string | null): { id: string; page?: string } | null {
  if (campaignOf(campaignId)?.kind === "cycle") return null;
  const own = bookletPageOf(campaignId, scenarioId);
  const box = own == null && scenarioId ? campaignOfScenario(scenarioId) : null;
  const boxPage = box ? bookletPageOf(box.id, scenarioId) : null;
  const from = boxPage != null && box ? box : campaignOf(campaignId);
  const page = own ?? boxPage;
  const id = from?.bookletId ?? campaignId;
  return page == null ? { id } : { id, page: String(page) };
}

/** A scenario's name as printed, for any scenario in the registry; the id itself when it holds none. */
export function scenarioName(id: string): string {
  const scenario = scenarioOf(id);
  return scenario ? printedScenarioName(scenario.name) : id;
}

/** Scenario names by id, for the path and the log. */
export function scenarioNames(campaign: CampaignData): Record<string, string> {
  return Object.fromEntries(campaign.scenarios.map((id) => [id, scenarioName(id)]));
}
