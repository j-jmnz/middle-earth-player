import type { Ask } from "../asks.ts";
import { ASKS as ACROSS_THE_ETTENMOORS } from "./across-the-ettenmoors.ts";
import { ASKS as DEADMENS_DIKE } from "./deadmens-dike.ts";
import { ASKS as ESCAPE_FROM_MOUNT_GRAM } from "./escape-from-mount-gram.ts";
import { ASKS as HELMS_DEEP } from "./helms-deep.ts";
import { ASKS as INTRUDERS_IN_CHETWOOD } from "./intruders-in-chetwood.ts";
import { ASKS as JOURNEY_TO_THE_CROSS_ROADS } from "./journey-to-the-cross-roads.ts";
import { ASKS as MOUNT_DOOM } from "./mount-doom.ts";
import { ASKS as SHELOBS_LAIR } from "./shelobs-lair.ts";
import { ASKS as THE_BATTLE_OF_CARN_DUM } from "./the-battle-of-carn-dum.ts";
import { ASKS as THE_BATTLE_OF_THE_PELENNOR_FIELDS } from "./the-battle-of-the-pelennor-fields.ts";
import { ASKS as THE_BLACK_GATE_OPENS } from "./the-black-gate-opens.ts";
import { ASKS as THE_DREAD_REALM } from "./the-dread-realm.ts";
import { ASKS as THE_PASSAGE_OF_THE_MARSHES } from "./the-passage-of-the-marshes.ts";
import { ASKS as THE_PASSING_OF_THE_GREY_COMPANY } from "./the-passing-of-the-grey-company.ts";
import { ASKS as THE_ROAD_TO_ISENGARD } from "./the-road-to-isengard.ts";
import { ASKS as THE_SIEGE_OF_GONDOR } from "./the-siege-of-gondor.ts";
import { ASKS as THE_TOWER_OF_CIRITH_UNGOL } from "./the-tower-of-cirith-ungol.ts";
import { ASKS as THE_TREACHERY_OF_RHUDAUR } from "./the-treachery-of-rhudaur.ts";
import { ASKS as THE_URUK_HAI } from "./the-uruk-hai.ts";
import { ASKS as THE_WASTES_OF_ERIADOR } from "./the-wastes-of-eriador.ts";
import { ASKS as THE_WEATHER_HILLS } from "./the-weather-hills.ts";

// Written by pnpm data build from src/play/words/asks/ (scripts/data/effects/asks-barrel.ts). Do not edit.
export const ASKS_BY_SCENARIO: Readonly<Record<string, Readonly<Record<string, Ask>>>> = { "across-the-ettenmoors": ACROSS_THE_ETTENMOORS, "deadmens-dike": DEADMENS_DIKE, "escape-from-mount-gram": ESCAPE_FROM_MOUNT_GRAM, "helms-deep": HELMS_DEEP, "intruders-in-chetwood": INTRUDERS_IN_CHETWOOD, "journey-to-the-cross-roads": JOURNEY_TO_THE_CROSS_ROADS, "mount-doom": MOUNT_DOOM, "shelobs-lair": SHELOBS_LAIR, "the-battle-of-carn-dum": THE_BATTLE_OF_CARN_DUM, "the-battle-of-the-pelennor-fields": THE_BATTLE_OF_THE_PELENNOR_FIELDS, "the-black-gate-opens": THE_BLACK_GATE_OPENS, "the-dread-realm": THE_DREAD_REALM, "the-passage-of-the-marshes": THE_PASSAGE_OF_THE_MARSHES, "the-passing-of-the-grey-company": THE_PASSING_OF_THE_GREY_COMPANY, "the-road-to-isengard": THE_ROAD_TO_ISENGARD, "the-siege-of-gondor": THE_SIEGE_OF_GONDOR, "the-tower-of-cirith-ungol": THE_TOWER_OF_CIRITH_UNGOL, "the-treachery-of-rhudaur": THE_TREACHERY_OF_RHUDAUR, "the-uruk-hai": THE_URUK_HAI, "the-wastes-of-eriador": THE_WASTES_OF_ERIADOR, "the-weather-hills": THE_WEATHER_HILLS };
