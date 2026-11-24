// Rules: ats.ally-objectives, rr.action, rr.ownership-and-control, rr.first-player, rr.player-elimination, mec109.stage-4 (data/rules/entries.json); ledger lines 06132:A:1, 06132:A:2, 06132:A:3, 06133:A:1, 06133:A:2, 06133:A:3.
// Faramir and Lord Alcaron, the objective allies the first player controls. Their Actions are the controller's alone (their card type is objective, which the engine alone would let every player use), they are not offered while Captured! holds them or when nothing can answer them, they follow the first player
// token, and the players lose when one leaves play: in an attack, and when the seat that controls it is eliminated. Every moment is built on the table of the scenario with two seats where a player is named: seat 0 is the first player and controls both allies, seat 1 holds hidden cards and has an enemy engaged.
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { idOf, send, type Run } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { CODES, drive, engagedCodes, hiddenCodes, hurt, offeredActions as offered, opened, run, table, takes, where } from "../../../../test/scenarios/the-blood-of-gondor/table.ts";

const { faramir, alcaron, ambusher, uruk, rabble, arsonist, captured, numenorean } = CODES;
const FARAMIR = "06132:action:1";
const ALCARON = "06133:action:1";

/** Combat phase, two seats: seat 0 (first player) controls both allies and has Orc Rabble engaged; seat 1 has Orc Arsonist engaged; each seat holds one hidden card (Orc Ambusher, Brutal Uruk). */
function scene(effects: readonly Effect[], layout: Partial<Parameters<typeof table>[0]> = {}) {
  const made = table({ seats: 2, phase: "Combat", play: [faramir, alcaron], engaged: [{ code: rabble, seat: 0 }, { code: arsonist, seat: 1 }], deck: [ambusher, uruk, "f0", "f0"], ...layout }, effects);
  return { made, at: opened(made, takes(made, takes(made, made.state, 0), 1)) as Run };
}
const use = (made: ReturnType<typeof scene>["made"], from: Run, code: string, effectId: string) => send(from, { type: "Trigger", cardId: idOf(from.state, code), effectId }, made.ctx);

lineSpec("06132:A:2", "only the first player, who controls Faramir, is offered the Combat Action: the other seat is not, and it is refused if sent", (effects) => {
  const { made, at } = scene(effects);
  expect(offered(made, at.state)).toContain(FARAMIR);
  const second = send(at, { type: "Pass" }, made.ctx);
  expect(second.state.activeSeat).toBe(1);
  expect(offered(made, second.state)).not.toContain(FARAMIR);
  expect(() => use(made, second, faramir, FARAMIR)).toThrow();
});

lineSpec("06132:A:2", "the controller chooses whose hidden card is turned, and the card is that player's: the enemy takes 3 damage, engages him, and a card of the other player stays", (effects) => {
  const { made, at } = scene(effects);
  const asked = use(made, at, faramir, FARAMIR);
  expect(asked.state.window).toMatchObject({ kind: "choose", options: ["seat:0", "seat:1"] });
  const done = send(asked, { type: "Choose", optionId: "seat:1" }, made.ctx);
  expect(engagedCodes(done.state, 1)).toEqual([arsonist, uruk]);
  expect(done.state.cards[idOf(done.state, uruk)]?.damage).toBe(3);
  expect(hiddenCodes(done.state, 1)).toEqual([]);
  expect(hiddenCodes(done.state, 0)).toEqual([ambusher]);
});

lineSpec("06132:A:2", "an enemy turned by it is dealt 3 damage first, so Orc Ambusher (3 hit points) is destroyed and never engages; he is exhausted, and a treachery is discarded", (effects) => {
  const made = table({ phase: "Combat", play: [faramir], deck: [ambusher, "f0"] }, effects);
  const at = opened(made, takes(made, made.state, 0));
  const done = use(made, at, faramir, FARAMIR);
  expect(where(done.state, ambusher)).toBe("encounterDiscard");
  expect(engagedCodes(done.state)).toEqual([]);
  expect(done.state.cards[idOf(done.state, faramir)]?.exhausted).toBe(true);
  const looms = table({ phase: "Combat", play: [faramir], deck: [CODES.looms, "f0"] }, effects);
  const turned = use(looms, opened(looms, takes(looms, looms.state, 0)), faramir, FARAMIR);
  expect(where(turned.state, CODES.looms)).toBe("encounterDiscard");
});

lineSpec("06132:A:2", "with one player holding cards there is no choice of whose, and with no hidden card in the game the Action is not offered", (effects) => {
  const made = table({ seats: 2, phase: "Combat", play: [faramir], deck: [uruk, "f0"] }, effects);
  const held = opened(made, takes(made, made.state, 1));
  expect(offered(made, held.state)).toContain(FARAMIR);
  const done = use(made, held, faramir, FARAMIR);
  expect(done.state.window?.kind).not.toBe("choose");
  expect(engagedCodes(done.state, 1)).toEqual([uruk]);
  expect(offered(made, opened(made).state)).not.toContain(FARAMIR);
});

lineSpec("06132:A:2", "is a Combat Action: it is offered in the combat phase and in no other", (effects) => {
  const made = table({ phase: "Quest", play: [faramir], deck: [uruk, "f0"] }, effects);
  const held = takes(made, made.state, 0);
  expect(offered(made, opened(made, held).state)).not.toContain(FARAMIR);
  const combat = table({ phase: "Combat", play: [faramir], deck: [uruk, "f0"] }, effects);
  expect(offered(combat, opened(combat, takes(combat, combat.state, 0)).state)).toContain(FARAMIR);
});

lineSpec("06132:A:2", "cannot be used while Captured! holds Faramir under it, in play and controlled by nobody", (effects) => {
  const { made, at } = scene(effects, { stage: captured, side: "A" });
  expect(offered(made, at.state)).toContain(FARAMIR);
  const held = run(made, at.state, { verb: "HoldUnderStage", codes: [faramir, alcaron] }, { sourceId: idOf(at.state, captured) });
  expect(offered(made, opened(made, held).state)).not.toContain(FARAMIR);
  expect(offered(made, opened(made, held).state)).not.toContain(ALCARON);
});

lineSpec("06133:A:2", "only the first player, who controls Lord Alcaron, is offered the Action: the other seat has an enemy engaged and is not offered it, and it is refused if sent", (effects) => {
  const { made, at } = scene(effects);
  expect(offered(made, at.state)).toContain(ALCARON);
  const second = send(at, { type: "Pass" }, made.ctx);
  expect(offered(made, second.state)).not.toContain(ALCARON);
  expect(() => use(made, second, alcaron, ALCARON)).toThrow();
});

lineSpec("06133:A:2", "returns the enemy engaged with the controller to the staging area, and not the enemy engaged with the other player", (effects) => {
  const { made, at } = scene(effects);
  const done = use(made, at, alcaron, ALCARON);
  expect(where(done.state, rabble)).toBe("staging");
  expect(where(done.state, arsonist)).toBe("engaged");
  expect(done.state.cards[idOf(done.state, alcaron)]?.exhausted).toBe(true);
});

lineSpec("06133:A:2", "returns an enemy that a hidden turn has just engaged with the controller", (effects) => {
  const made = table({ phase: "Combat", play: [alcaron], deck: [uruk, "f0"] }, effects);
  const turned = run(made, takes(made, made.state, 0), { verb: "TurnHiddenCards", who: "actor" });
  expect(engagedCodes(turned)).toEqual([uruk]);
  expect(where(use(made, opened(made, turned), alcaron, ALCARON).state, uruk)).toBe("staging");
});

lineSpec("06133:A:2", "is offered only while an enemy is engaged with the controller: one engaged with the other player is not enough", (effects) => {
  const one = table({ seats: 2, phase: "Combat", play: [alcaron], engaged: [{ code: rabble, seat: 0 }] }, effects);
  expect(offered(one, opened(one).state)).toContain(ALCARON);
  const other = table({ seats: 2, phase: "Combat", play: [alcaron], engaged: [{ code: arsonist, seat: 1 }] }, effects);
  expect(offered(other, opened(other).state)).not.toContain(ALCARON);
});

const TOKEN = "the first player gains control of the ally: the token passes in the refresh phase and the ally goes to the new first player's play area, unless Captured! holds it";

function tokenPasses(effects: readonly Effect[], code: string): void {
  const passes = (held: boolean) => {
    const made = table({ seats: 2, phase: "PlayerAttacks", ...(held ? { stage: captured, side: "A" as const } : {}), play: [faramir, alcaron] }, effects);
    const state = held ? run(made, made.state, { verb: "HoldUnderStage", codes: [faramir, alcaron] }, { sourceId: idOf(made.state, captured) }) : made.state;
    expect(state.cards[idOf(state, code)]).toMatchObject({ controller: held ? null : 0 });
    return drive(made, opened(made, state), (now) => now.phase === "Planning").state;
  };
  const free = passes(false);
  expect(free.firstPlayer).toBe(1);
  expect(free.cards[idOf(free, code)]).toMatchObject({ zone: "play", controller: 1 });
  expect(free.seats[1]?.play).toContain(idOf(free, code));
  expect(free.seats[0]?.play).not.toContain(idOf(free, code));
  const under = passes(true);
  expect(under.firstPlayer).toBe(1);
  expect(under.cards[idOf(under, code)]).toMatchObject({ zone: "captive", controller: null });
}
lineSpec("06132:A:1", TOKEN, (effects) => tokenPasses(effects, faramir));
lineSpec("06133:A:1", TOKEN, (effects) => tokenPasses(effects, alcaron));

// Black Númenorean (Attack 5) kills Lord Alcaron (Defense 2, 3 hit points) and Faramir (Defense 1, 4 hit points) when one defends.
function destroyedDefending(effects: readonly Effect[], code: string): void {
  const attack = (defender: string) => {
    const made = table({ phase: "Combat", play: [faramir, alcaron], engaged: [numenorean], deck: ["f0", "f0", "f0", "f0"] }, effects);
    const hit = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.window?.kind === "defense");
    return drive(made, send(hit, { type: "DeclareDefender", defenderId: defender === "hero" ? made.hero : idOf(hit.state, defender) }, made.ctx), (state) => state.pendingAttack == null || state.lost);
  };
  const lost = attack(code);
  expect(lost.state.cards[idOf(lost.state, code)]?.zone).toBe("encounterDiscard");
  expect(lost.state.lost).toBe(true);
  expect(attack("hero").state.lost).toBe(false);
}

// The seat that controls the ally has one hero left, with 3 hit points, and Brutal Uruk (Attack 4) attacks him undefended.
function controllerEliminated(effects: readonly Effect[], code: string): void {
  const made = table({ seats: 2, phase: "Combat", play: [code], engaged: [uruk], deck: ["f0", "f0", "f0", "f0"] }, effects);
  const worn = hurt(made, hurt(made, made.state, "dh2", 6), "dh1", 3);
  expect(worn.lost).toBe(false);
  expect(worn.seats[0]?.eliminated).toBeFalsy();
  const hit = drive(made, send(opened(made, worn), { type: "Pass" }, made.ctx), (state) => state.window?.kind === "defense");
  const done = drive(made, send(hit, { type: "Undefended", heroId: idOf(hit.state, "dh1") }, made.ctx), (state) => state.lost || state.pendingAttack == null);
  expect(done.state.seats[0]?.eliminated).toBe(true);
  expect(done.state.cards[idOf(done.state, code)]?.zone).not.toBe("play");
  expect(done.state.lost).toBe(true);
}
const DESTROYED = (name: string) => `the players lose when ${name} is destroyed defending: a hero that dies instead does not lose the game`;
const ELIMINATED = (name: string) => `the players lose when the seat that controls ${name} is eliminated: he is discarded with the rest of what that player controls`;
lineSpec("06132:A:3", DESTROYED("Faramir"), (effects) => destroyedDefending(effects, faramir));
lineSpec("06132:A:3", ELIMINATED("Faramir"), (effects) => controllerEliminated(effects, faramir));
lineSpec("06133:A:3", DESTROYED("Lord Alcaron"), (effects) => destroyedDefending(effects, alcaron));
lineSpec("06133:A:3", ELIMINATED("Lord Alcaron"), (effects) => controllerEliminated(effects, alcaron));
