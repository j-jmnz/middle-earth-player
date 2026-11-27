// Helpers of the Beneath the Sands audit tests (audit.test.ts, audit-cards.test.ts): the card codes, the tables, the reveal, travel, attack and quest-phase drivers.
import type { Effect } from "../../../catalog/boundary.ts";
import { type ScenarioState } from "../../../rules/core/state.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { PASSING, codesIn, fightEnemy, finish, idOf, idsOf, legalIntents, legalTargets, opened, revealFromTop, send, start, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";
import { pick } from "../../../../test/harness/pick.ts";

export const SID = "beneath-the-sands";
export const BROOD = "17065";
export const GUARDIAN = "17066";
export const BROODLING = "17067";
export const BURROW = "17068";
export const TUNNEL = "17069";
export const NEST = "17070";
export const CAVERN = "17071";
export const PASSAGE = "17072";
export const FORCED = "17073";
export const GRABBED = "17074";
export const LOST = "17075";
export const CAVES = "17076";
export const CLOSER = "17077";
export const HIVE = "17078";
export const OFF = "17079";
export const ON = "17080";
// Fillers: a Creature enemy (attack 1), an enemy with attack 3, a location, treacheries that print no On Track marker.
export const VIPER = "16054";
export const SCORPION = "16055";
export const PLACE = "place";
// Player cards that place progress: Ride to Ruin (spirit, cost 1) discards a Rohan ally (Snowbourn Scout) and Éowyn pays for it.
export const RIDE_TO_RUIN = "02078";
export const SCOUT = "01016";
export const EOWYN = "01007";
export const INJURED = "16046";

export type Made = ReturnType<typeof tableFromLayout>;
export const tableOf = (effects: readonly Effect[]) => (layout: Layout): Made => tableFromLayout(SID, layout, { effects });

export const inDiscard = (state: ScenarioState): string[] => state.encounterDiscard.map((id) => state.cards[id]?.code ?? "");
export const inDeck = (state: ScenarioState): string[] => state.encounterDeck.map((id) => state.cards[id]?.code ?? "");
export const has = (state: ScenarioState, zone: string, code: string): boolean => codesIn(state, zone).includes(code);
export const resourcesOf = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.resources ?? -1;
export const damageOf = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.damage ?? -1;

/** The id of the card of a code that lies in the zone. */
export const inZone = (state: ScenarioState, zone: string, code: string): string => idsOf(state, code).find((id) => state.cards[id]?.zone === zone) ?? "";

/** The players travel to the location in a real Travel phase; the choices that follow take the keys' options. */
export function travelTo(effects: readonly Effect[], layout: Layout, code: string, ...keys: string[]): { made: Made; state: ScenarioState } {
  const made = tableOf(effects)({ phase: "Travel", ...layout });
  const sent = send(start(made.state), { type: "Travel", locationId: inZone(made.state, "staging", code) }, made.ctx);
  return { made, state: finish(sent, made.ctx, pick(...keys)).state };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Helpers for the moments below: an encounter card revealed, an attack fought with a Shadow card, the quest phase played to its end.

export const HEROES = ["dh1", "dh2", "dh3"];
/** The first hero of the seat a 2-seat layout engages the attacker with. */
export const heroOfSeat = (seat: number): string => (seat === 0 ? "dh1" : "dh3");
/** An attack the player of the seat does not defend: the damage lands on that seat's first hero. */
export const undefendedOn = (seat: number) => ({ undefended: true, defender: (made: Made): string => (seat === 0 ? made.hero : (made.seat1Hero ?? made.hero)) });
export const fought = (effects: readonly Effect[], shadow: string, enemy: string, layout: Layout, options: Parameters<typeof fightEnemy<Made, Layout>>[4] = {}) => fightEnemy(tableOf(effects), shadow, enemy, layout, options);

/** The card is revealed from the top of the encounter deck by the seat (the first player by default); its choices take the keys' options. */
export function revealed(made: Made, code: string, seat?: number, ...keys: string[]): Run {
  const steps: Parameters<typeof revealFromTop>[3] = [];
  const top = revealFromTop(made.state, made.ctx, code, steps, seat);
  return finish({ state: top.state, steps }, made.ctx, pick(...keys));
}

/** The quest phase is played to its end: every seat commits all its heroes (when `commit`), every window is passed, a choice takes the first of the keys' options that is offered. */
export function questPhase(made: Made, from: ScenarioState, options: { commit?: boolean; keys?: string[]; trigger?: string; stopAtTrigger?: boolean } = {}): Run {
  let run: Run = opened(made, from);
  const choose = pick(...(options.keys ?? []));
  for (let guard = 0; guard < 80 && (run.state.phase === "Quest" || run.state.phase === "Planning" || run.state.window?.kind === "choose") && !run.state.lost && !run.state.stageCleared; guard += 1) {
    const state = run.state;
    if (state.window?.kind === "choose") {
      run = send(run, { type: "Choose", optionId: choose(state) }, made.ctx);
      continue;
    }
    if (state.window?.kind === "look") {
      run = send(run, { type: "Pass" }, made.ctx);
      continue;
    }
    const intents = legalIntents(state, made.ctx);
    const ids = intents.some((intent) => intent.type === "Commit") && options.commit !== false ? legalTargets(state, { type: "Commit" }, made.ctx).filter((id) => state.cards[id]?.committed !== true && HEROES.includes(state.cards[id]?.code ?? "")) : [];
    if (ids.length > 0) {
      run = send(run, { type: "Commit", cardIds: ids }, made.ctx);
      continue;
    }
    const response = options.trigger === undefined ? undefined : intents.find((intent) => intent.type === "Trigger" && state.cards[intent.cardId]?.code === options.trigger);
    if (response) {
      run = send(run, response as PlayerIntent, made.ctx);
      if (options.stopAtTrigger) return run;
      continue;
    }
    const pass = PASSING.map((type) => intents.find((intent) => intent.type === type)).find((intent) => intent != null);
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  return run;
}
export const questedTo = (effects: readonly Effect[], layout: Layout, options: { commit?: boolean; keys?: string[]; trigger?: string; stopAtTrigger?: boolean } = {}): ScenarioState => {
  const made = tableOf(effects)(layout);
  return questPhase(made, made.state, options).state;
};
/** A hero with +6 Attack (a stand-in boost from outside the scenario) attacks the engaged enemy in the player attack step: the damage the enemy holds afterwards. */
export function hitFor(effects: readonly Effect[], layout: Layout, target: string): number {
  const made = tableOf(effects)({ phase: "PlayerAttacks", ...layout });
  const strong: ScenarioState = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: made.hero, sourceId: made.hero, stat: "attack", amount: 6, until: "endOfPhase" }] };
  const done = finish(send(start(strong), { type: "DeclareAttackers", enemyId: idOf(strong, target), attackerIds: [made.hero] }, made.ctx), made.ctx);
  return damageOf(done.state, target);
}
/** Two fillers revealed by the players in the quest phase (no Threat), then a card that prints On Track: the end of the quest phase finds it in the top 3. */
export const SAFE_DECK = ["f0", "f0", GUARDIAN, "f0", "f0"];
export const progressOf = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.progress ?? -1;
export const threatsOf = (state: ScenarioState): number[] => state.seats.map((seat) => seat.threat);
export const surviving = (state: ScenarioState, code: string, zone: string): number => idsOf(state, code).filter((id) => state.cards[id]?.zone === zone).length;

