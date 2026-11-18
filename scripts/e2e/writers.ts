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
import { osgiliathFixtures } from "./standalone-scenarios/the-massing-at-osgiliath.ts";
import { townFixtures } from "./standalone-scenarios/the-battle-of-lake-town.ts";
import { erechFixtures } from "./standalone-scenarios/the-stone-of-erech.ts";
import { forestFixtures } from "./the-old-forest.ts";

// The scenarios scenario 1's block writes by hand (the won game is a search, `knife-lost` starts from its log).
export const SCENARIO_ONE = ["a-shadow-of-the-past", "a-knife-in-the-dark"] as const;
export type Chained = Exclude<FixtureScenarioId, (typeof SCENARIO_ONE)[number]>;
export const isChained = (id: FixtureScenarioId): id is Chained => !(SCENARIO_ONE as readonly string[]).includes(id);

// One writer per registry scenario. A part after the first is dealt from the log an earlier part's won game writes, so it takes
// that game from `written`; a game the seeds did not find is absent and the writer leaves its own out.
export type Written = Partial<Record<FixtureName, unknown>>;
export const WRITERS: Record<Chained, (written: Written) => Promise<object> | object> = {
  "passage-through-mirkwood": () => mirkwoodFixtures(),
  "journey-along-the-anduin": (written) => anduinFixtures(written["mirkwood-won"] as Parameters<typeof anduinFixtures>[0]),
  "escape-from-dol-guldur": (written) => dolGuldurFixtures(written["anduin-won"] as Parameters<typeof dolGuldurFixtures>[0]),
  "the-oath": () => oathFixtures(),
  "the-caves-of-nibin-dum": (written) => nibinDumFixtures(written["oath-won"] as Parameters<typeof nibinDumFixtures>[0]),
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
  "the-massing-at-osgiliath": () => osgiliathFixtures(),
  "the-battle-of-lake-town": () => townFixtures(),
  "the-stone-of-erech": () => erechFixtures(),
  "the-old-forest": () => forestFixtures(),
};
