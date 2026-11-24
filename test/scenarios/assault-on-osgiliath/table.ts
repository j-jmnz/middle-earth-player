// Test helpers for the Assault on Osgiliath tests (src/rules/families/pelargir/osgiliath.test.ts, src/campaign/scenarios/assault-on-osgiliath/): a table of the scenario, a game driven through its windows, a card's id and zone.
import type { Effect } from "../../../src/catalog/boundary.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";
import type { PlayerIntent } from "../../../src/rules/engine/reduce.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";

import { idOf, legalIntents, send, start as begin, tableFromLayout, type Layout, type LayoutTable, type Run } from "../../harness/scene-kit.ts";

export const SCENARIO = "assault-on-osgiliath";
export const CODES = {
  retake: "06091",
  lieutenant: "06092",
  soldier: "06093",
  phalanx: "06094",
  commander: "06095",
  westGate: "06096",
  library: "06097",
  harbor: "06098",
  bridge: "06099",
  westQuarter: "06100",
  eastQuarter: "06101",
  square: "06102",
  tower: "06103",
  pinned: "06104",
  street: "06105",
  counter: "06106",
} as const;

/** A real hero with Willpower 1, Attack 3, Defense 2 (the stand-in heroes count 2 of each), so the stat a quest counts shows in the total. */
export const BOROMIR = "05002";
/** A real enemy with 0 Attack: its attack deals no damage, even undefended. */
export const EVIL_CROW = "141040";

/** A table of the scenario on its one stage unless the layout names another; `effects` are the records it runs (every authored one by default). */
export const table = (layout: Layout, effects?: readonly Effect[], extra?: readonly string[]): LayoutTable =>
  tableFromLayout(SCENARIO, { ...layout, stage: layout.stage ?? CODES.retake }, { ...(effects ? { effects } : {}), ...(extra ? { extra } : {}) });

/** The run of a table's state, constants synced. */
export const opened = (made: LayoutTable): Run => begin(syncConstants(made.state, made.ctx));

// The intent that lets a window go by without a decision: pass, decline to travel, engage nobody, attack nobody.
const PASSING: readonly PlayerIntent["type"][] = ["Pass", "DeclineTravel", "DeclineEngage", "DeclineAttack"];

/**
 * The game goes on until `stop` holds for its state: every window is passed, a choice takes its first option (or the one `choose` names), and an attack
 * waits for `defend` ("defense" window: the intent that answers it; none stops the drive there).
 */
export function drive(made: LayoutTable, from: Run, stop: (state: ScenarioState) => boolean, choose: (state: ScenarioState) => string = (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")): Run {
  let run = from;
  for (let guard = 0; guard < 400 && !stop(run.state) && !run.state.lost && !run.state.stageCleared; guard += 1) {
    const state = run.state;
    if (state.window?.kind === "choose") {
      run = send(run, { type: "Choose", optionId: choose(state) }, made.ctx);
      continue;
    }
    if (state.window?.kind === "chooseEnemy") {
      run = send(run, { type: "ChooseEnemy", enemyId: state.window.options[0] ?? "" }, made.ctx);
      continue;
    }
    const intents = legalIntents(state, made.ctx);
    const pass = PASSING.map((type) => intents.find((intent) => intent.type === type)).find((intent) => intent != null);
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  return run;
}

/** The zone of the first card with this code. */
export const where = (state: ScenarioState, code: string): string | undefined => state.cards[idOf(state, code)]?.zone;

/** The first card with this code. */
export const cardOf = (state: ScenarioState, code: string) => state.cards[idOf(state, code)];

/** The ids in the play area of a seat. */
export const playOf = (state: ScenarioState, seat = 0): readonly string[] => state.seats[seat]?.play ?? [];
