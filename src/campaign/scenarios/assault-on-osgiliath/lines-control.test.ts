// Rules: ats.controlling-locations, ats.losing-control-of-locations, rr.explored, rr.step-3-4, rr.action, rr.player-elimination, rr.winning-the-game (data/rules/entries.json); ledger lines 06091:B:1, 06091:B:2, 06091:B:3, 06096:A:2, 06097:A:2, 06098:A:3, 06099:A:3.
// The control of locations of Assault on Osgiliath, each built on the real moment (a quest resolution, an action, an attack, a travel, an elimination, a round): the explored location goes to the first player's play area, a loss of control is seen wherever it comes from, an undefended attack
// is announced whatever damage it deals, a player card's progress in the staging area is barred, and the players win once no Osgiliath location is in the staging area or active.
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { finish, idOf, legalIntents, revealFromTop, send, type LayoutTable, type Run } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { payFor } from "../../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { BOROMIR, CODES, EVIL_CROW, cardOf, controlled, drive, opened, playOf, table, where } from "../../../../test/scenarios/assault-on-osgiliath/table.ts";

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

lineSpec("06091:B:1", "places no progress from a player card on a location in the staging area, and places it on the active location", (effects) => {
  // Snowbourn Scout (01016): "After Snowbourn Scout enters play, choose a location. Place 1 progress token on that location."
  const scout = (placeOn: string) => {
    const made = table({ phase: "Planning", active: { code: CODES.westQuarter }, staging: [CODES.harbor], hand: ["01016"], heroes: [{ code: "01001", seat: 0, resources: 3 }] }, effects, ["01016", "01001"]);
    const card = idOf(made.state, "01016");
    let run = send(opened(made), { type: "PlayCard", cardId: card, payments: payFor(made.state, made.ctx, card) }, made.ctx);
    run = send(run, { type: "Trigger", cardId: card, effectId: "01016:response:1" }, made.ctx);
    return finish(run, made.ctx, (state) => (state.window?.kind === "choose" ? idOf(state, placeOn) : "")).state;
  };
  expect(cardOf(scout(CODES.harbor), CODES.harbor)?.progress).toBe(0);
  expect(cardOf(scout(CODES.westQuarter), CODES.westQuarter)?.progress).toBe(1);
});

lineSpec("06091:B:3", "wins at the end of the round when no Osgiliath location is in the staging area or active, and not while one is", (effects) => {
  const won = table({ phase: "Quest", active: { code: CODES.harbor, progress: 4 }, committed: ["dh1", "dh2"] }, effects);
  expect(drive(won, send(opened(won), { type: "Pass" }, won.ctx), (state) => state.stageCleared).state.stageCleared).toBe(true);
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
