// The extra top-bar dials of the scenarios that have them, in the order the bar draws them: The Road to Isengard's (readouts/isengard.ts), The Passage of the Marshes' (readouts/marshes.ts), Journey to the Cross-roads' (readouts/roads.ts), Shelob's Lair's (readouts/lair.ts), The Passing of the Grey Company's (readouts/company.ts), The Siege of Gondor's (readouts/siege.ts), The Battle of the Pelennor Fields' (readouts/pelennor.ts), The Tower of Cirith Ungol's (readouts/ungol.ts) and The Black Gate Opens' (readouts/black-gate.ts) and Mount Doom's (readouts/mount-doom.ts), Intruders in Chetwood's, Deadmen's Dike's (readouts/angmar.ts), The Wastes of Eriador's (readouts/wastes.ts), The Battle of Carn Dûm's (readouts/carn-dum.ts) The Dread Realm's (readouts/dread-realm.ts) and Into the Pit's (readouts/dwarrowdelf/pit.ts) and The Hunt for the Dreadnaught's (readouts/standalone-scenarios/hunt.ts), The Morgul Vale's (readouts/against-the-shadow/vale.ts) and Desert Crossing's temperature (readouts/haradrim/heat.ts).
// Each scenario's list is empty in any other scenario, so a new scenario's dials are one more line in `scenarioDials`. The engine decided each number; nothing here changes one. Pure, so a test reads it.
import { useMemo } from "react";

import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { angmarDials, angmarHands } from "./angmar.ts";
import { cairAndrosDials } from "./against-the-shadow/cair-andros.ts";
import { osgiliathDials } from "./against-the-shadow/osgiliath.ts";
import { bloodDials, bloodHands } from "./against-the-shadow/blood.ts";
import { valeDials } from "./against-the-shadow/vale.ts";
import { amonDinDials } from "./against-the-shadow/amon-din.ts";
import { druadanDials } from "./against-the-shadow/druadan.ts";
import { stewardsFearDials } from "./against-the-shadow/stewards-fear.ts";
import { armiesDials } from "./the-hobbit/armies.ts";
import { blackGateDials, blackGateHands } from "./black-gate.ts";
import { companyDials, companyHands } from "./company.ts";
import type { TableDial } from "./dials.ts";
import { useStableDials } from "./dials.ts";
import { dumDials } from "./carn-dum.ts";
import { realmDials, realmHands } from "./dread-realm.ts";
import { ettenmoorsDials } from "./ettenmoors.ts";
import { celebrimborDials } from "./ring-maker/celebrimbor.ts";
import { crownDials } from "./ring-maker/crown.ts";
import { ringMakerDials } from "./ring-maker/fords.ts";
import { orcDials } from "./ring-maker/orc.ts";
import { trialDials } from "./ring-maker/trials.ts";
import { rhudaurCurrentDials, rhudaurDials } from "./rhudaur.ts";
import { gramHands } from "./gram.ts";
import { isengardDials, isengardHands, type HandMark } from "./isengard.ts";
import { lairDials, lairHands } from "./lair.ts";
import { erechDials, erechHands } from "./standalone-scenarios/erech.ts";
import { riddleDials, riddleHands } from "./the-hobbit/riddles.ts";
import { lakeTownDials } from "./standalone-scenarios/lake-town.ts";
import { mountainDials } from "./the-hobbit/mountain.ts";
import { downsDials, downsHands } from "./standalone-scenarios/barrow-downs.ts";
import { forestDials } from "./standalone-scenarios/old-forest.ts";
import { belegostDials } from "./standalone-scenarios/belegost.ts";
import { khazadDials } from "./standalone-scenarios/khazad.ts";
import { annuminasDials } from "./standalone-scenarios/annuminas.ts";
import { guldurDials } from "./standalone-scenarios/guldur.ts";
import { huntDials } from "./standalone-scenarios/hunt.ts";
import { ponyDials } from "./standalone-scenarios/pony.ts";
import { woodlandDials } from "./standalone-scenarios/woodland.ts";
import { mountDoomDials, mountDoomHands } from "./mount-doom.ts";
import { marshesDials } from "./marshes.ts";
import { pelennorDials, pelennorHands } from "./pelennor.ts";
import { pitDials } from "./dwarrowdelf/pit.ts";
import { roadsDials } from "./roads.ts";
import { sackDials } from "./hobbit/sack.ts";
import { siegeDials, siegeHands } from "./siege.ts";
import { heatDials } from "./haradrim/heat.ts";
import { umbarHands } from "./haradrim/umbar.ts";
import { ungolDials, ungolHands } from "./ungol.ts";
import { wastesDials, wastesHands } from "./wastes.ts";

/** Every scenario dial the game holds now. */
export function scenarioDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  return [...isengardDials(game, ctx, nameOf), ...marshesDials(game, ctx, nameOf), ...roadsDials(game, ctx, nameOf), ...lairDials(game, ctx, nameOf), ...companyDials(game, ctx, nameOf), ...siegeDials(game, ctx, nameOf), ...pelennorDials(game, ctx, nameOf), ...ungolDials(game, ctx, nameOf), ...blackGateDials(game, nameOf), ...mountDoomDials(game, nameOf), ...rhudaurCurrentDials(game, nameOf), ...angmarDials(game, ctx, nameOf), ...wastesDials(game, nameOf), ...ettenmoorsDials(game, nameOf), ...rhudaurDials(game, ctx, nameOf), ...dumDials(game, ctx, nameOf), ...realmDials(game, ctx, nameOf), ...pitDials(game), ...lakeTownDials(game, ctx, nameOf), ...erechDials(game, ctx, nameOf), ...forestDials(game, ctx), ...downsDials(game, ctx, nameOf), ...belegostDials(game, ctx, nameOf), ...ponyDials(game, nameOf), ...woodlandDials(game, nameOf), ...annuminasDials(game, ctx, nameOf), ...guldurDials(game, ctx, nameOf), ...khazadDials(game, ctx, nameOf), ...huntDials(game, ctx, nameOf), ...sackDials(game), ...riddleDials(game, ctx, nameOf), ...mountainDials(game, ctx, nameOf), ...armiesDials(game, ctx, nameOf), ...cairAndrosDials(game, ctx), ...druadanDials(game, ctx, nameOf), ...stewardsFearDials(game, ctx, nameOf), ...amonDinDials(game, ctx), ...osgiliathDials(game, ctx), ...bloodDials(game), ...valeDials(game), ...ringMakerDials(game, ctx, nameOf), ...crownDials(game, nameOf), ...celebrimborDials(game, ctx, nameOf), ...orcDials(game), ...trialDials(game, ctx, nameOf), ...heatDials(game)];
}

/** The dials for the top bar: the same list while no dial's words or number changed, so the bar re-renders only when a token, a hit point or a card moves. */
export function useScenarioDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  return useStableDials(scenarioDials(game, ctx, nameOf));
}

/** The marks the seat dials wear: The Road to Isengard's cards in hand on stage 3B, Shelob's Lair's allies this round, The Passing of the Grey Company's Overcome by Fear and threat floor, The Siege of Gondor's Army of the Dead, The Battle of the Pelennor Fields' Aragorn, The Tower of Cirith Ungol's hero with Last of the Company, The Black Gate Opens' controller of Gwaihir, Mount Doom's hero with Heavy and Tired and Intruders in Chetwood's hands under Lost in the Wilderness and controller of Iârion, Deadmen's Dike's decks The Wastes of Eriador's starting threat lowered by Fend Off Despair, Escape from Mount Gram's captured deck and The Dread Realm's Reanimated Dead and Fog on the Barrow-downs' players apart.
 * A seat wears one mark: when two scenarios' pieces fall on the same seat (Fear and the Army, the Army and Aragorn) their labels, notes and notches are merged into it. */
export function seatMarks(game: ScenarioState, ctx: ReduceContext): readonly HandMark[] {
  return mergedBySeat([...isengardHands(game), ...lairHands(game, ctx), ...companyHands(game, ctx), ...siegeHands(game), ...pelennorHands(game), ...ungolHands(game, ctx), ...blackGateHands(game), ...mountDoomHands(game, ctx), ...angmarHands(game), ...wastesHands(game), ...gramHands(game, ctx), ...realmHands(game), ...erechHands(game), ...downsHands(game, ctx), ...riddleHands(game), ...bloodHands(game), ...umbarHands(game)]);
}

// The label after the seat prefix ("P1 · Fear" is "Fear"); a bare seat ("P1") or "Threat" says nothing more.
const labelTail = (label: string): string => label.replace(/^P\d+( · )?/, "").replace(/^Threat$/, "");

function mergedBySeat(marks: readonly HandMark[]): readonly HandMark[] {
  const bySeat = new Map<number, HandMark>();
  for (const mark of marks) {
    const held = bySeat.get(mark.seat);
    if (!held) {
      bySeat.set(mark.seat, mark);
      continue;
    }
    const tail = labelTail(mark.label);
    const label = tail === "" ? held.label : labelTail(held.label) === "" ? mark.label : `${held.label} · ${tail}`;
    const warn = held.warn?.level === "critical" || !mark.warn ? held.warn : mark.warn;
    const note = [held.note, mark.note].filter((words) => words != null).join(" ");
    const notch = held.notch ?? mark.notch;
    bySeat.set(mark.seat, { seat: mark.seat, label, ...(warn ? { warn } : {}), ...(note !== "" ? { note } : {}), ...(notch != null ? { notch } : {}) });
  }
  return [...bySeat.values()];
}

/** The seat marks for the top bar, stable the same way. */
export function useSeatMarks(game: ScenarioState, ctx: ReduceContext): readonly HandMark[] {
  const key = JSON.stringify(seatMarks(game, ctx));
  return useMemo((): readonly HandMark[] => JSON.parse(key), [key]);
}
