// One writer per fixture scenario of the registry (src/campaign/fixtures/registry.ts), for scripts/e2e/fixtures.ts. A new scenario adds its import and its line here, not to that script.
import type { FixtureName, FixtureScenarioId } from "../../src/campaign/fixtures/registry.ts";

import { anduinFixtures } from "./journey-along-the-anduin.ts";
import { dolGuldurFixtures } from "./escape-from-dol-guldur.ts";
import { mirkwoodFixtures } from "./passage-through-mirkwood.ts";
import { nibinDumFixtures } from "./the-caves-of-nibin-dum.ts";
import { oathFixtures } from "./the-oath.ts";
import { voyageFixtures } from "./voyage-across-belegaer.ts";
import { fateFixtures } from "./the-fate-of-numenor.ts";
import { raidFixtures } from "./raid-on-the-grey-havens.ts";
import { stormcallerFixtures } from "./flight-of-the-stormcaller.ts";
import { depthsFixtures } from "./the-thing-in-the-depths.ts";
import { templeFixtures } from "./temple-of-the-deceived.ts";
import { ruinsFixtures } from "./the-drowned-ruins.ts";
import { havenFixtures } from "./a-storm-on-cobas-haven.ts";
import { corsairsFixtures } from "./the-city-of-corsairs.ts";
import { upanduinFixtures } from "./journey-up-the-anduin.ts";
import { lostmirkFixtures } from "./lost-in-mirkwood.ts";
import { kingsquestFixtures } from "./the-kings-quest.ts";
import { heathFixtures } from "./the-withered-heath.ts";
import { rhovanionFixtures } from "./roam-across-rhovanion.ts";
import { nightFixtures } from "./fire-in-the-night.ts";
import { framsburgFixtures } from "./the-ghost-of-framsburg.ts";
import { gundabadFixtures } from "./mount-gundabad.ts";
import { wilderlandFixtures } from "./the-fate-of-wilderland.ts";
import { haiFixtures } from "./the-uruk-hai.ts";
import { deepFixtures } from "./helms-deep.ts";
import { isengardFixtures } from "./the-road-to-isengard.ts";
import { marshesFixtures } from "./the-passage-of-the-marshes.ts";
import { roadsFixtures } from "./journey-to-the-cross-roads.ts";
import { lairFixtures } from "./shelobs-lair.ts";
import { companyFixtures } from "./the-passing-of-the-grey-company.ts";
import { gondorFixtures } from "./the-siege-of-gondor.ts";
import { fieldsFixtures } from "./the-battle-of-the-pelennor-fields.ts";
import { ungolFixtures } from "./the-tower-of-cirith-ungol.ts";
import { opensFixtures } from "./the-black-gate-opens.ts";
import { doomFixtures } from "./mount-doom.ts";
import { chetwoodFixtures } from "./angmar-awakened/intruders-in-chetwood.ts";
import { hillsFixtures } from "./angmar-awakened/the-weather-hills.ts";
import { dikeFixtures } from "./angmar-awakened/deadmens-dike.ts";
import { eriadorFixtures } from "./angmar-awakened/the-wastes-of-eriador.ts";
import { gramFixtures } from "./angmar-awakened/escape-from-mount-gram.ts";
import { ettenmoorsFixtures } from "./angmar-awakened/across-the-ettenmoors.ts";
import { rhudaurFixtures } from "./angmar-awakened/the-treachery-of-rhudaur.ts";
import { dumFixtures } from "./angmar-awakened/the-battle-of-carn-dum.ts";
import { realmFixtures } from "./angmar-awakened/the-dread-realm.ts";
import { gollumFixtures } from "./shadows-of-mirkwood/the-hunt-for-gollum.ts";
import { carrockFixtures } from "./shadows-of-mirkwood/conflict-at-the-carrock.ts";
import { rhosgobelFixtures } from "./shadows-of-mirkwood/a-journey-to-rhosgobel.ts";
import { muilFixtures } from "./shadows-of-mirkwood/the-hills-of-emyn-muil.ts";
import { deadmarshesFixtures } from "./shadows-of-mirkwood/the-dead-marshes.ts";
import { returnmirkwoodFixtures } from "./shadows-of-mirkwood/return-to-mirkwood.ts";
import { pitFixtures } from "./dwarrowdelf/into-the-pit.ts";
import { levelFixtures } from "./dwarrowdelf/the-seventh-level.ts";
import { frommoriaFixtures } from "./dwarrowdelf/flight-from-moria.ts";
import { gateFixtures } from "./dwarrowdelf/the-redhorn-gate.ts";
import { rivendellFixtures } from "./dwarrowdelf/road-to-rivendell.ts";
import { waterFixtures } from "./dwarrowdelf/the-watcher-in-the-water.ts";
import { darkFixtures } from "./dwarrowdelf/the-long-dark.ts";
import { stoneFixtures } from "./dwarrowdelf/foundations-of-stone.ts";
import { flameFixtures } from "./dwarrowdelf/shadow-and-flame.ts";
import { osgiliathFixtures } from "./standalone-scenarios/the-massing-at-osgiliath.ts";
import { townFixtures } from "./standalone-scenarios/the-battle-of-lake-town.ts";
import { erechFixtures } from "./standalone-scenarios/the-stone-of-erech.ts";
import { forestFixtures } from "./standalone-scenarios/the-old-forest.ts";
import { downsFixtures } from "./standalone-scenarios/fog-on-the-barrow-downs.ts";
import { belegostFixtures } from "./standalone-scenarios/the-ruins-of-belegost.ts";
import { ponyFixtures } from "./standalone-scenarios/murder-at-the-prancing-pony.ts";
import { annuminasFixtures } from "./standalone-scenarios/the-siege-of-annuminas.ts";
import { guldurFixtures } from "./standalone-scenarios/attack-on-dol-guldur.ts";
import { questFixtures } from "./standalone-scenarios/the-wizards-quest.ts";
import { woodlandFixtures } from "./standalone-scenarios/the-woodland-realm.ts";
import { minesFixtures } from "./standalone-scenarios/the-mines-of-moria.ts";
import { khazadFixtures } from "./standalone-scenarios/escape-from-khazad-dum.ts";
import { dreadnaughtFixtures } from "./standalone-scenarios/the-hunt-for-the-dreadnaught.ts";
import { pelargirFixtures } from "./against-the-shadow/peril-in-pelargir.ts";
import { grimFixtures } from "./the-hobbit/over-the-misty-mountains-grim.ts";
import { spidersFixtures } from "./the-hobbit/flies-and-spiders.ts";
import { dayFixtures } from "./the-hobbit/we-must-away-ere-break-of-day.ts";
import { dimFixtures } from "./the-hobbit/dungeons-deep-and-caverns-dim.ts";
import { mountainFixtures } from "./the-hobbit/the-lonely-mountain.ts";
import { ithilienFixtures } from "./against-the-shadow/into-ithilien.ts";
import { armiesFixtures } from "./the-hobbit/the-battle-of-five-armies.ts";
import { androsFixtures } from "./against-the-shadow/the-siege-of-cair-andros.ts";
import { fearFixtures } from "./against-the-shadow/the-stewards-fear.ts";
import { druadanFixtures } from "./against-the-shadow/the-druadan-forest.ts";
import { dinFixtures } from "./against-the-shadow/encounter-at-amon-din.ts";
import { assaultFixtures } from "./against-the-shadow/assault-on-osgiliath.ts";
import { bloodFixtures } from "./against-the-shadow/the-blood-of-gondor.ts";
import { valeFixtures } from "./against-the-shadow/the-morgul-vale.ts";

// The scenarios scenario 1's block writes by hand (`won` is the one fixture not committed that the registry names, `knife-lost` starts from its log).
export const SCENARIO_ONE = ["a-shadow-of-the-past", "a-knife-in-the-dark"] as const;
export type Chained = Exclude<FixtureScenarioId, (typeof SCENARIO_ONE)[number]>;
export const isChained = (id: FixtureScenarioId): id is Chained => !(SCENARIO_ONE as readonly string[]).includes(id);

// One writer per registry scenario. A part after the first is dealt from the log an earlier part's won game writes: its golden's
// (`wonLog` in seed-kit.ts), or the earlier part's won fixture in `written` where one is committed.
export type Written = Partial<Record<FixtureName, unknown>>;
export const WRITERS: Record<Chained, (written: Written) => Promise<object> | object> = {
  "passage-through-mirkwood": () => mirkwoodFixtures(),
  "journey-along-the-anduin": (written) => anduinFixtures(written["mirkwood-won"] as Parameters<typeof anduinFixtures>[0]),
  // Its games start from the log a won fixture of Journey Along the Anduin writes, and no won fixture is searched for (docs/architecture.md, Tests): it writes none.
  "escape-from-dol-guldur": () => dolGuldurFixtures(undefined),
  "the-oath": () => oathFixtures(),
  // Its games start from the log a won fixture of The Oath writes, and none is committed: it writes none.
  "the-caves-of-nibin-dum": () => nibinDumFixtures(undefined),
  "voyage-across-belegaer": () => voyageFixtures(),
  "the-fate-of-numenor": () => fateFixtures(),
  "raid-on-the-grey-havens": () => raidFixtures(),
  "flight-of-the-stormcaller": () => stormcallerFixtures(),
  "the-thing-in-the-depths": () => depthsFixtures(),
  "temple-of-the-deceived": () => templeFixtures(),
  "the-drowned-ruins": () => ruinsFixtures(),
  "a-storm-on-cobas-haven": () => havenFixtures(),
  "the-city-of-corsairs": () => corsairsFixtures(),
  "journey-up-the-anduin": () => upanduinFixtures(),
  "lost-in-mirkwood": () => lostmirkFixtures(),
  "the-kings-quest": () => kingsquestFixtures(),
  "the-withered-heath": () => heathFixtures(),
  "roam-across-rhovanion": () => rhovanionFixtures(),
  "fire-in-the-night": () => nightFixtures(),
  "the-ghost-of-framsburg": () => framsburgFixtures(),
  "mount-gundabad": () => gundabadFixtures(),
  "the-fate-of-wilderland": () => wilderlandFixtures(),
  "the-uruk-hai": () => haiFixtures(),
  "helms-deep": () => deepFixtures(),
  "the-road-to-isengard": () => isengardFixtures(),
  "the-passage-of-the-marshes": () => marshesFixtures(),
  "journey-to-the-cross-roads": () => roadsFixtures(),
  "shelobs-lair": () => lairFixtures(),
  "the-passing-of-the-grey-company": () => companyFixtures(),
  "the-siege-of-gondor": () => gondorFixtures(),
  "the-battle-of-the-pelennor-fields": () => fieldsFixtures(),
  "the-tower-of-cirith-ungol": () => ungolFixtures(),
  "the-black-gate-opens": () => opensFixtures(),
  "mount-doom": () => doomFixtures(),
  "intruders-in-chetwood": () => chetwoodFixtures(),
  "the-weather-hills": () => hillsFixtures(),
  "deadmens-dike": () => dikeFixtures(),
  "the-wastes-of-eriador": () => eriadorFixtures(),
  "escape-from-mount-gram": () => gramFixtures(),
  "across-the-ettenmoors": () => ettenmoorsFixtures(),
  "the-treachery-of-rhudaur": () => rhudaurFixtures(),
  "the-battle-of-carn-dum": () => dumFixtures(),
  "the-dread-realm": () => realmFixtures(),
  "the-hunt-for-gollum": () => gollumFixtures(),
  "conflict-at-the-carrock": () => carrockFixtures(),
  "a-journey-to-rhosgobel": () => rhosgobelFixtures(),
  "the-hills-of-emyn-muil": () => muilFixtures(),
  "the-dead-marshes": () => deadmarshesFixtures(),
  "return-to-mirkwood": () => returnmirkwoodFixtures(),
  "into-the-pit": () => pitFixtures(),
  "the-seventh-level": () => levelFixtures(),
  "flight-from-moria": () => frommoriaFixtures(),
  "the-redhorn-gate": () => gateFixtures(),
  "road-to-rivendell": () => rivendellFixtures(),
  "the-watcher-in-the-water": () => waterFixtures(),
  "the-long-dark": () => darkFixtures(),
  "foundations-of-stone": () => stoneFixtures(),
  "shadow-and-flame": () => flameFixtures(),
  "the-massing-at-osgiliath": () => osgiliathFixtures(),
  "the-battle-of-lake-town": () => townFixtures(),
  "the-stone-of-erech": () => erechFixtures(),
  "the-old-forest": () => forestFixtures(),
  "fog-on-the-barrow-downs": () => downsFixtures(),
  "the-ruins-of-belegost": () => belegostFixtures(),
  "murder-at-the-prancing-pony": () => ponyFixtures(),
  "the-siege-of-annuminas": () => annuminasFixtures(),
  "attack-on-dol-guldur": () => guldurFixtures(),
  "the-wizards-quest": () => questFixtures(),
  "the-woodland-realm": () => woodlandFixtures(),
  "the-mines-of-moria": () => minesFixtures(),
  "escape-from-khazad-dum": () => khazadFixtures(),
  "the-hunt-for-the-dreadnaught": () => dreadnaughtFixtures(),
  "peril-in-pelargir": () => pelargirFixtures(),
  "into-ithilien": () => ithilienFixtures(),
  "the-siege-of-cair-andros": () => androsFixtures(),
  "the-stewards-fear": () => fearFixtures(),
  "the-druadan-forest": () => druadanFixtures(),
  "encounter-at-amon-din": () => dinFixtures(),
  "assault-on-osgiliath": () => assaultFixtures(),
  "the-blood-of-gondor": () => bloodFixtures(),
  "the-morgul-vale": () => valeFixtures(),
  "we-must-away-ere-break-of-day": () => dayFixtures(),
  "over-the-misty-mountains-grim": () => grimFixtures(),
  "dungeons-deep-and-caverns-dim": () => dimFixtures(),
  "flies-and-spiders": () => spidersFixtures(),
  "the-lonely-mountain": () => mountainFixtures(),
  "the-battle-of-five-armies": () => armiesFixtures(),
};
