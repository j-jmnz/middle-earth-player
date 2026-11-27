// Rules: ats.controlling-locations, ats.losing-control-of-locations, rr.explored, rr.step-3-4, rr.action, rr.player-elimination, rr.winning-the-game (data/rules/entries.json); ledger lines 06091:B:1, 06091:B:2, 06091:B:3, 06096:A:2, 06097:A:2, 06098:A:3, 06099:A:3.
// The control of locations of Assault on Osgiliath, each built on the real moment (a quest resolution, an action, an attack, a travel, an elimination, a round): the explored location goes to the first player's play area, a loss of control is seen wherever it comes from, an undefended attack
// is announced whatever damage it deals, a player card's progress in the staging area is barred, and the players win once no Osgiliath location is in the staging area or active.
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { finish, idOf, legalIntents, revealFromTop, send, start as begin, type LayoutTable, type Run } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { sendUnledgered } from "../../../../test/harness/player-table.ts";
import { payFor } from "../../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { BOROMIR, CODES, EVIL_CROW, cardOf, controlled, controlling, drive, opened, playOf, table, where } from "../../../../test/scenarios/assault-on-osgiliath/table.ts";

/** The quest phase of a table that opens on it, played out: the committed heroes quest and the game goes on to the travel phase. */
const quested = (made: LayoutTable, from: Run = opened(made)): Run => drive(made, send(from, { type: "Pass" }, made.ctx), (state) => state.phase !== "Quest");

lineSpec("06091:B:2", "takes the active location a quest explores into the first player's play area, ready and with no progress, and notes who controls it", (effects) => {
  const made = table({ phase: "Quest", active: { code: CODES.westQuarter, progress: 1 }, committed: ["dh1", "dh2"] }, effects);
  const done = quested(made).state;
  expect(playOf(done, 0)).toContain(idOf(done, CODES.westQuarter));
  expect(done.activeLocation).toBeNull();
  expect(cardOf(done, CODES.westQuarter)).toMatchObject({ zone: "play", controller: 0, progress: 0, exhausted: false, face: "up" });
  expect(controlled(done)).toEqual([CODES.westQuarter]);
});

lineSpec("06091:B:2", "takes a location explored in the staging area too, by the Action of Ancient Harbor", (effects) => {
  const made = table({ phase: "Combat", staging: [{ code: CODES.harbor, progress: 4 }] }, effects);
  const trigger = legalIntents(made.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "06098:action:1");
  expect(trigger).toBeDefined();
  const run = drive(made, send(opened(made), trigger as PlayerIntent, made.ctx), (state) => state.window?.kind !== "choose" && where(state, CODES.harbor) === "play");
  expect(cardOf(run.state, CODES.harbor)).toMatchObject({ zone: "play", controller: 0, progress: 0 });
  expect(controlled(run.state)).toEqual([CODES.harbor]);
});

/** Seat 0 controls these locations, then the first-player token is with seat 1; Ancient Harbor holds 4 of its 5 quest points and the Action of Ancient Harbor explores it again. */
function exploredAgain(codes: readonly string[], effects: readonly Effect[]): ScenarioState {
  const made = table({ seats: 2, phase: "Combat", staging: [...codes, ...(codes.includes(CODES.harbor) ? [] : [CODES.harbor])] }, effects);
  const held = controlling(made, made.state, codes);
  const harbor = idOf(held, CODES.harbor);
  const state = { ...held, firstPlayer: 1, cards: { ...held.cards, [harbor]: { ...held.cards[harbor]!, progress: 4 } } } as ScenarioState;
  const trigger = legalIntents(state, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "06098:action:1");
  expect(trigger).toBeDefined();
  return drive(made, send(begin(syncConstants(state, made.ctx)), trigger as PlayerIntent, made.ctx), (now) => now.window?.kind !== "choose" && (now.cards[harbor]?.progress ?? 1) === 0).state;
}

lineSpec("06091:B:2", "a controlled location explored again is taken by the first player now, not by the seat that held it (the first player is the second seat)", (effects) => {
  const done = exploredAgain([CODES.harbor], effects);
  expect(cardOf(done, CODES.harbor)).toMatchObject({ zone: "play", controller: 1, progress: 0 });
  expect(playOf(done, 1)).toContain(idOf(done, CODES.harbor));
  expect(playOf(done, 0)).not.toContain(idOf(done, CODES.harbor));
  expect(controlled(done)).toEqual([CODES.harbor]);
});

lineSpec("06103:A:2", "the seat that held the location loses control of it when another first player takes it, and its Ruined Tower returns to the staging area", (effects) => {
  const done = exploredAgain([CODES.harbor, CODES.tower], effects);
  expect(cardOf(done, CODES.harbor)).toMatchObject({ zone: "play", controller: 1 });
  expect(cardOf(done, CODES.tower)).toMatchObject({ zone: "staging" });
});

lineSpec("06091:B:2", "the first player takes it when he is not the player whose heroes quested (the first player is the second seat)", (effects) => {
  const made = table({ seats: 2, firstPlayer: 1, phase: "Quest", active: { code: CODES.westQuarter, progress: 1 }, committed: ["dh1", "dh2"] }, effects);
  const done = quested(made).state;
  expect(cardOf(done, CODES.westQuarter)).toMatchObject({ zone: "play", controller: 1 });
  expect(playOf(done, 1)).toContain(idOf(done, CODES.westQuarter));
  expect(playOf(done, 0)).not.toContain(idOf(done, CODES.westQuarter));
});

lineSpec("06091:B:2", "a location explored while it is controlled is taken again with no loss (Ruined Square needs 2 progress)", (effects) => {
  const made = table({ phase: "Quest", active: { code: CODES.square, progress: 1 }, committed: ["dh1", "dh2"], heroes: [{ code: BOROMIR, seat: 0 }], engaged: [{ code: EVIL_CROW, seat: 0 }, { code: EVIL_CROW, seat: 0 }] }, effects, [BOROMIR, EVIL_CROW]);
  let run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.window?.kind === "defense");
  // Neither Crow deals damage (0 Attack): both attacks go undefended.
  for (let attacks = 0; attacks < 2; attacks += 1) {
    run = send(run, { type: "Undefended", heroId: made.hero }, made.ctx);
    run = drive(made, run, (state) => state.window?.kind === "defense" || state.mode === "playerAttacks");
  }
  const crows = Object.values(run.state.cards).filter((card) => card.code === EVIL_CROW && card.zone === "engaged").map((card) => card.id);
  const square = idOf(run.state, CODES.square);
  // Each destroyed enemy is a Response: Ruined Square places 1 progress on itself, in the first player's play area too.
  const kill = (r: Run, enemyId: string, attackerIds: string[]): Run => send(send(r, { type: "DeclareAttackers", enemyId, attackerIds }, made.ctx), { type: "Trigger", cardId: square, effectId: "06102:response:1" }, made.ctx);
  run = kill(run, crows[0] ?? "", [idOf(run.state, BOROMIR)]);
  expect(cardOf(run.state, CODES.square)).toMatchObject({ zone: "play", progress: 1 });
  run = drive(made, run, (state) => state.window?.kind === "playerAttack");
  run = kill(run, crows[1] ?? "", [made.hero, made.hero2]);
  run = drive(made, run, (state) => state.window?.kind === "playerAttack");
  expect(cardOf(run.state, CODES.square)).toMatchObject({ zone: "play", controller: 0, progress: 0 });
  expect(controlled(run.state)).toEqual([CODES.square]);
});

lineSpec("06091:B:2", "a location the players control is seen lost when they travel to it: its progress is gone and it is the active location", (effects) => {
  const made = table({ phase: "Quest", active: { code: CODES.library, progress: 1 }, committed: ["dh1", "dh2"], deck: ["f0", "f0", "f0"] }, effects);
  let run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.phase === "Travel");
  const library = idOf(run.state, CODES.library);
  expect(controlled(run.state)).toEqual([CODES.library]);
  run = send(run, { type: "Travel", locationId: library } as PlayerIntent, made.ctx);
  expect(run.state.activeLocation).toBe(library);
  expect(cardOf(run.state, CODES.library)).toMatchObject({ zone: "activeLocation", progress: 0, controller: null });
  expect(controlled(run.state)).toEqual([]);
});

lineSpec("06091:B:2", "a player who is eliminated returns the locations he controls to the staging area", (effects) => {
  const made = table({ seats: 2, phase: "Quest", active: { code: CODES.westQuarter, progress: 2 }, committed: ["dh1", "dh2"], threat: [49, 28] }, effects);
  const run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.phase === "Travel");
  expect(controlled(run.state)).toEqual([CODES.westQuarter]);
  // Counter-attack: the first player cannot afford "raise" (Threat 49 and the location's Threat 2 make 51): he takes it, and is eliminated.
  const revealed = revealFromTop({ ...run.state, window: null }, made.ctx, CODES.counter, []);
  const done = finish({ state: revealed.state, steps: [] }, made.ctx, (state) => (state.window?.kind === "choose" ? (state.window.options.includes("raise") ? "raise" : (state.window.options[0] ?? "")) : "")).state;
  expect(done.seats[0]?.eliminated).toBe(true);
  expect(cardOf(done, CODES.westQuarter)).toMatchObject({ zone: "staging", progress: 0, controller: null });
  expect(controlled(done)).toEqual([]);
});

lineSpec("06091:B:1", "places no progress from a player card on a location in the staging area, and places it on the active location (Snowbourn Scout offers the active location alone)", (effects) => {
  // Snowbourn Scout (01016): "After Snowbourn Scout enters play, choose a location. Place 1 progress token on that location."
  const made = table({ phase: "Planning", active: { code: CODES.westQuarter }, staging: [CODES.harbor], hand: ["01016"], heroes: [{ code: "01001", seat: 0, resources: 3 }] }, effects, ["01016", "01001"]);
  const card = idOf(made.state, "01016");
  let run = send(opened(made), { type: "PlayCard", cardId: card, payments: payFor(made.state, made.ctx, card) }, made.ctx);
  run = send(run, { type: "Trigger", cardId: card, effectId: "01016:response:1" }, made.ctx);
  // The staged Ancient Harbor is no target: the one location left is chosen at once and no question is asked.
  expect(run.state.window?.kind).not.toBe("choose");
  const done = finish(run, made.ctx).state;
  expect(cardOf(done, CODES.harbor)?.progress).toBe(0);
  expect(cardOf(done, CODES.westQuarter)?.progress).toBe(1);
});

/** Asfaloth (04110) on a hero, in the Action window of the combat phase of stage 1B; the trigger of his Action, when it is offered. */
function asfaloth(layout: Parameters<typeof table>[0], effects: readonly Effect[]) {
  const made = table({ phase: "Combat", attached: [{ code: "04110", to: "dh1" }], ...layout }, effects, ["04110"]);
  const trigger = legalIntents(made.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "04110:action:1");
  return { made, trigger };
}

lineSpec("06091:B:1", "does not offer an Action that would place progress on a location in the staging area only, and offers it once a location it may touch is in play (Asfaloth)", (effects) => {
  const staged = asfaloth({ staging: [CODES.library] }, effects);
  expect(staged.trigger).toBeUndefined();
  // The unused Action costs nothing: Asfaloth stays ready.
  expect(cardOf(staged.made.state, "04110")?.exhausted).toBe(false);
  const withActive = asfaloth({ active: { code: CODES.westQuarter }, staging: [CODES.library] }, effects);
  expect(withActive.trigger).toBeDefined();
});

lineSpec("06091:B:1", "says in a step that the bar kept the progress of an effect that touches each location with no choice (Northern Tracker)", (effects) => {
  const made = table({ phase: "Quest", active: { code: CODES.westQuarter }, staging: [CODES.library], play: [{ code: "01045", seat: 0 }] }, effects, ["01045"]);
  const run = send(opened(made), { type: "Commit", cardIds: [made.hero, idOf(made.state, "01045")] }, made.ctx);
  const done = finish(send(run, { type: "Trigger", cardId: idOf(made.state, "01045"), effectId: "01045:response:1" }, made.ctx), made.ctx);
  expect(cardOf(done.state, CODES.library)?.progress).toBe(0);
  expect(done.steps.filter((step) => step.kind === "progress" && step.targetId === idOf(done.state, CODES.library))).toEqual([expect.objectContaining({ amount: 0 })]);
});

lineSpec("06091:B:2", "lets a player card place progress on a controlled location: Snowbourn Scout fills Ancient Harbor, and the first player takes it again", (effects) => {
  const made = table({ phase: "Planning", active: { code: CODES.westQuarter }, staging: [CODES.harbor], hand: ["01016"], heroes: [{ code: "01001", seat: 0, resources: 3 }] }, effects, ["01016", "01001"]);
  const held = controlling(made, made.state, [CODES.harbor]);
  const harbor = idOf(held, CODES.harbor);
  const state = { ...held, cards: { ...held.cards, [harbor]: { ...held.cards[harbor]!, progress: 4 } } } as ScenarioState;
  const card = idOf(state, "01016");
  let run = send(begin(syncConstants(state, made.ctx)), { type: "PlayCard", cardId: card, payments: payFor(state, made.ctx, card) }, made.ctx);
  run = send(run, { type: "Trigger", cardId: card, effectId: "01016:response:1" }, made.ctx);
  // The controlled location and the active one are the two places the progress may go.
  expect(run.state.window).toMatchObject({ kind: "choose", options: expect.arrayContaining([harbor]) });
  const done = finish(run, made.ctx, (now) => (now.window?.kind === "choose" ? harbor : "")).state;
  expect(cardOf(done, CODES.harbor)).toMatchObject({ zone: "play", controller: 0, progress: 0 });
  expect(controlled(done)).toEqual([CODES.harbor]);
});

lineSpec("06091:B:3", "wins at the end of the round when no Osgiliath location is in the staging area or active, and not while one is", (effects) => {
  const won = table({ phase: "Quest", active: { code: CODES.harbor, progress: 4 }, committed: ["dh1", "dh2"] }, effects);
  const cleared = drive(won, send(opened(won), { type: "Pass" }, won.ctx), (state) => state.stageCleared).state;
  expect(cleared.stageCleared).toBe(true);
  // The check is the end of the round (06091:B:3): the quest explored the location in the round that began the game, the win waits for the refresh phase to end, and no new round has counted yet, and the table is still in the End of round phase.
  expect({ round: cleared.round, phase: cleared.phase }).toEqual({ round: won.state.round, phase: "End of round" });
  const going = table({ phase: "Quest", active: { code: CODES.harbor, progress: 4 }, committed: ["dh1", "dh2"], staging: [CODES.westQuarter] }, effects);
  const round = drive(going, send(opened(going), { type: "Pass" }, going.ctx), (state) => state.round > 1 || state.stageCleared);
  expect(controlled(round.state)).toEqual([CODES.harbor]);
  expect(round.state.stageCleared).toBe(false);
});

// The quest points of the four unique locations: the active location needs 1 more progress, which the quest phase gives.
const QUEST_POINTS: Readonly<Record<string, number>> = { [CODES.westGate]: 5, [CODES.library]: 3, [CODES.harbor]: 5, [CODES.bridge]: 6 };

/** The first player controls West Gate (explored in the quest phase), then the enemy engaged with him attacks in the combat phase: the attack is defended by the hero or goes undefended. */
function gate(code: string, enemy: string, effects: readonly Effect[]) {
  const made = table({ phase: "Quest", active: { code, progress: QUEST_POINTS[code] - 1 }, committed: ["dh1", "dh2"], engaged: [{ code: enemy, seat: 0 }] }, effects, enemy === EVIL_CROW ? [EVIL_CROW] : []);
  const run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.window?.kind === "defense");
  return { made, run };
}

/** The Forced effect of a location (`code`): it returns to the staging area, with no progress, when the player who controls it lets an attack go undefended, whatever the damage, and stays when the attack is defended. */
function returnsWhenUndefended(code: string, effects: readonly Effect[]): void {
  const hit = gate(code, "f3", effects);
  expect(cardOf(hit.run.state, code)?.zone).toBe("play");
  const undefended = drive(hit.made, send(hit.run, { type: "Undefended", heroId: hit.made.hero }, hit.made.ctx), (state) => state.pendingAttack == null && state.phase !== "Combat");
  expect(cardOf(undefended.state, code)).toMatchObject({ zone: "staging", progress: 0, controller: null });
  expect(controlled(undefended.state)).toEqual([]);
  expect(undefended.state.cards[hit.made.hero]?.damage).toBeGreaterThan(0);
  const none = gate(code, EVIL_CROW, effects);
  const harmless = drive(none.made, send(none.run, { type: "Undefended", heroId: none.made.hero }, none.made.ctx), (state) => state.pendingAttack == null && state.phase !== "Combat");
  expect(harmless.state.cards[none.made.hero]?.damage).toBe(0);
  expect(cardOf(harmless.state, code)?.zone).toBe("staging");
  const defended = gate(code, "f3", effects);
  const kept = drive(defended.made, send(defended.run, { type: "DeclareDefender", defenderId: defended.made.hero2 }, defended.made.ctx), (state) => state.pendingAttack == null && state.phase !== "Combat");
  expect(cardOf(kept.state, code)?.zone).toBe("play");
  expect(controlled(kept.state)).toEqual([code]);
}

lineSpec("06096:A:2", "returns West Gate to the staging area when its controller lets an attack go undefended, with or without damage, and not when it is defended", (effects) => returnsWhenUndefended(CODES.westGate, effects));
lineSpec("06097:A:2", "returns The King's Library to the staging area when its controller lets an attack go undefended, with or without damage, and not when it is defended", (effects) => returnsWhenUndefended(CODES.library, effects));
lineSpec("06098:A:3", "returns Ancient Harbor to the staging area when its controller lets an attack go undefended, with or without damage, and not when it is defended", (effects) => returnsWhenUndefended(CODES.harbor, effects));
lineSpec("06099:A:3", "returns The Old Bridge to the staging area when its controller lets an attack go undefended, with or without damage, and not when it is defended", (effects) => returnsWhenUndefended(CODES.bridge, effects));

/** Ravenhill Scout (04008) in the Action window of the combat phase of stage 06091, West Quarter active with 2 progress, and the locations of `staging` in the staging area; `held` are locations the first player controls. The trigger of its Action, when it is offered. */
function scout(staging: readonly string[], held: readonly string[], effects: readonly Effect[]) {
  const made = table({ phase: "Combat", active: { code: CODES.westQuarter, progress: 2 }, staging: [...staging, ...held], play: [{ code: "04008", seat: 0 }] }, effects, ["04008"]);
  const state = syncConstants(controlling(made, made.state, held), made.ctx);
  const trigger = legalIntents(state, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "04008:action:1");
  return { made, state, trigger };
}

/** The Action of Ravenhill Scout played: West Quarter is the source, 2 progress is chosen (no ledger entry for 04008 yet, so its steps are sent unledgered). */
function moveTwo(held: ReturnType<typeof scout>): ScenarioState {
  const ctx = held.made.ctx;
  let run = sendUnledgered(begin(held.state), held.trigger as PlayerIntent, ctx);
  run = sendUnledgered(run, { type: "Choose", optionId: idOf(held.state, CODES.westQuarter) }, ctx);
  for (let guard = 0; guard < 6 && run.state.window?.kind === "choose"; guard += 1) {
    run = sendUnledgered(run, { type: "Choose", optionId: run.state.window.options.includes("2") ? "2" : (run.state.window.options[0] ?? "") }, ctx);
  }
  return run.state;
}

lineSpec("06091:B:1", "does not offer Ravenhill Scout's Action when every other location it could move progress to is in the staging area, so no progress is lost", (effects) => {
  const made = table({ phase: "Combat", staging: [{ code: CODES.library, progress: 2 }, CODES.harbor], play: [{ code: "04008", seat: 0 }] }, effects, ["04008"]);
  const trigger = legalIntents(syncConstants(made.state, made.ctx), made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "04008:action:1");
  expect(trigger).toBeUndefined();
  expect(cardOf(made.state, "04008")?.exhausted).toBe(false);
});

lineSpec("06091:B:1", "moves Ravenhill Scout's progress to a controlled location only, never to a staged one", (effects) => {
  const held = scout([CODES.library], [CODES.harbor], effects);
  expect(held.trigger).toBeDefined();
  const done = moveTwo(held);
  expect(cardOf(done, CODES.westQuarter)?.progress).toBe(0);
  expect(cardOf(done, CODES.harbor)?.progress).toBe(2);
  expect(cardOf(done, CODES.library)?.progress).toBe(0);
});

lineSpec("04008:A:1", "moves Ravenhill Scout's progress to a staged location when the stage's bar is not in play", (effects) => {
  const free = scout([CODES.library], [], effects.filter((effect) => effect.id !== "06091:constant:1"));
  expect(free.trigger).toBeDefined();
  const done = moveTwo(free);
  expect(cardOf(done, CODES.westQuarter)?.progress).toBe(0);
  expect(cardOf(done, CODES.library)?.progress).toBe(2);
});

lineSpec("06091:B:1", "moves Mirkwood Explorer's progress to the active location only, and does not offer the Action when only staged locations are left", (effects) => {
  // Mirkwood Explorer (12037): "Exhaust Mirkwood Explorer to move all progress from it to a location in play."
  const withProgress = (made: LayoutTable): ScenarioState => {
    const id = idOf(made.state, "12037");
    return syncConstants({ ...made.state, cards: { ...made.state.cards, [id]: { ...made.state.cards[id]!, progress: 1 } } } as ScenarioState, made.ctx);
  };
  const offered = (state: ScenarioState, made: LayoutTable) => legalIntents(state, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "12037:action:1");
  const staged = table({ phase: "Combat", staging: [CODES.library], play: [{ code: "12037", seat: 0 }] }, effects, ["12037"]);
  expect(offered(withProgress(staged), staged)).toBeUndefined();
  const active = table({ phase: "Combat", active: { code: CODES.westQuarter }, staging: [CODES.library], play: [{ code: "12037", seat: 0 }] }, effects, ["12037"]);
  const state = withProgress(active);
  const trigger = offered(state, active);
  expect(trigger).toBeDefined();
  const done = sendUnledgered(begin(state), trigger as PlayerIntent, active.ctx).state;
  expect(cardOf(done, "12037")?.progress).toBe(0);
  expect(cardOf(done, CODES.westQuarter)?.progress).toBe(1);
  expect(cardOf(done, CODES.library)?.progress).toBe(0);
});
