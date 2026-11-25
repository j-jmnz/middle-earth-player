// Rules: ats.hidden-cards-turn-faceup, ats.ally-objectives, rr.shadow-effects, rr.defending-player, rr.sentinel, rr.engaged, rr.attacks-outside-the-combat-phase, rr.player-elimination, rr.forced (data/rules/entries.json); ledger lines 06120:A:1, 06121:A:1, 06130:A:3, 06122:A:1.
// The enemies and the shadow card that turn hidden cards faceup or answer an engagement: Orc Ambusher's discard, Brutal Uruk's turn and Mordor Looms's shadow. The moment is a real attack on seat 0 in the combat phase, with a Sentinel defender of seat 1 (Aragorn), so the player who controls the destroyed
// character is not the defending player: seat 1 turns his cards, seat 0 keeps his. A turned enemy is dealt its shadow card and attacks in the same combat phase.
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { idOf, send } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { CODES, drive, engagedCodes, hiddenCodes, hurt, opened, run, table, takes, where } from "../../../../test/scenarios/the-blood-of-gondor/table.ts";

const { ambusher, uruk, rabble, arsonist, southern, looms, faramir, alcaron, numenorean } = CODES;
const ARAGORN = "01001";
const fillers = (count: number): string[] => Array<string>(count).fill("f0");
const shadowsOn = (state: ScenarioState, code: string): number => Object.values(state.cards).filter((card) => card.zone === "shadow" && state.cards[card.host ?? ""]?.code === code).length;

/**
 * Seat 0 is attacked by `enemy` with `shadow` on top of the deck when the shadow cards are dealt; Aragorn (seat 1, Sentinel, 1 hit point left) defends and is destroyed. Seat 1 holds Orc Rabble, a location and the stand-in the combat choice takes
 * for him; seat 0 holds Orc Ambusher. The run stops when the attack has resolved and the shadow card has been read (the next attack is not yet begun).
 */
function sentinelFight(effects: readonly Effect[], enemy: string, shadow: string) {
  const made = table({ seats: 2, phase: "Encounter", heroes: [{ code: ARAGORN, seat: 1 }], engaged: [{ code: enemy, seat: 0 }], deck: [rabble, southern, ambusher, "f0", "f0", shadow, ...fillers(10)] }, effects, [ARAGORN]);
  const held = takes(made, takes(made, made.state, 1, 2), 0, 1);
  const worn = hurt(made, held, ARAGORN, 4);
  const hit = drive(made, opened(made, worn), (state) => state.window?.kind === "defense", () => "take");
  const defended = send(hit, { type: "DeclareDefender", defenderId: idOf(hit.state, ARAGORN) }, made.ctx);
  return { made, hit, defended };
}

lineSpec("06121:A:1", "after Brutal Uruk's attack destroys a character, its controller (seat 1, the Sentinel's, not the defending player) turns every hidden card: each enemy engages him, is dealt a shadow card and attacks him in this combat phase", (effects) => {
  const { made, hit, defended } = sentinelFight(effects, uruk, "f0");
  expect(hiddenCodes(hit.state, 1)).toEqual([rabble, southern, "f0"]);
  const stopped = drive(made, defended, (state) => state.pendingAttack?.seat === 1 || state.phase !== "Combat", () => "take");
  expect(stopped.state.cards[idOf(stopped.state, ARAGORN)]?.zone).toBe("discard");
  expect(hiddenCodes(stopped.state, 1)).toEqual([]);
  expect(hiddenCodes(stopped.state, 0)).toEqual([ambusher, "f0"]);
  expect(engagedCodes(stopped.state, 1)).toEqual([rabble, "f0"]);
  expect(where(stopped.state, southern)).toBe("encounterDiscard");
  expect(shadowsOn(stopped.state, rabble)).toBe(1);
  // The turned enemy attacks seat 1 in this phase, among the attackers not yet resolved.
  expect(stopped.state.pendingAttack?.seat).toBe(1);
  expect(stopped.state.phase).toBe("Combat");
});

lineSpec("06121:A:1", "turns nothing when another enemy's attack destroys a character, or when Brutal Uruk's own attack destroys none", (effects) => {
  const other = sentinelFight(effects, numenorean, "f0");
  const done = drive(other.made, other.defended, (state) => state.pendingAttack?.seat === 1 || state.phase !== "Combat", () => "take");
  expect(done.state.cards[idOf(done.state, ARAGORN)]?.zone).toBe("discard");
  expect(hiddenCodes(done.state, 1)).toEqual([rabble, southern, "f0"]);
  const uruks = sentinelFight(effects, uruk, "f0");
  const turned = drive(uruks.made, uruks.defended, (state) => state.pendingAttack?.seat === 1 || state.phase !== "Combat", () => "take");
  expect(hiddenCodes(turned.state, 1)).toEqual([]);
  const made = table({ phase: "Encounter", engaged: [uruk], deck: [ambusher, "f0", "f0", "f0", ...fillers(6)] }, effects);
  const hit = drive(made, opened(made, takes(made, made.state, 0)), (state) => state.window?.kind === "defense", () => "take");
  const spared = drive(made, send(hit, { type: "DeclareDefender", defenderId: made.hero }, made.ctx), (state) => state.pendingAttack == null);
  expect(hiddenCodes(spared.state)).toEqual([ambusher, "f0"]);
  expect(engagedCodes(spared.state)).toEqual([uruk]);
});

lineSpec("06121:A:1", "a player whose last hero is destroyed is eliminated first: his hidden cards are discarded and nothing engages him, and the other player keeps his; a player who keeps another hero turns them", (effects) => {
  const kill = (lastHero: boolean): ScenarioState => {
    const made = table({ seats: 2, phase: "Encounter", engaged: [uruk], deck: [rabble, "f0", "f0", "f0", "f0", ...fillers(6)] }, effects);
    const base = hurt(made, takes(made, takes(made, made.state, 0), 1), "dh1", 3);
    const worn = lastHero ? hurt(made, base, "dh2", 6) : base;
    const hit = drive(made, opened(made, worn), (state) => state.window?.kind === "defense", () => "take");
    return drive(made, send(hit, { type: "Undefended", heroId: idOf(hit.state, "dh1") }, made.ctx), (state) => state.seats[0]?.eliminated === true || state.pendingAttack?.seat === 0 && state.window?.kind === "chooseEnemy" || state.phase !== "Combat", () => "take").state;
  };
  const survives = kill(false);
  expect(survives.seats[0]?.eliminated).toBeFalsy();
  expect(hiddenCodes(survives, 0)).toEqual([]);
  expect(engagedCodes(survives, 0)).toContain(rabble);
  const done = kill(true);
  expect(done.seats[0]?.eliminated).toBe(true);
  expect(hiddenCodes(done, 0)).toEqual([]);
  expect(hiddenCodes(done, 1).length).toBeGreaterThan(0);
  expect(engagedCodes(done, 0)).toEqual([]);
  expect(done.encounterDiscard.map((id) => done.cards[id]?.code)).toContain(rabble);
});

lineSpec("06130:A:3", "Shadow: after the attack destroys a character, its controller (seat 1, the Sentinel's) turns each hidden card: the enemies engage him with no shadow card at that moment and attack him in this combat phase; seat 0's cards stay; an attack that destroys nobody turns nothing", (effects) => {
  const { made, hit, defended } = sentinelFight(effects, numenorean, looms);
  expect(hit.state.window).toMatchObject({ kind: "defense" });
  const stopped = drive(made, defended, (state) => state.pendingAttack?.seat === 1 || state.phase !== "Combat", () => "take");
  expect(stopped.state.cards[idOf(stopped.state, ARAGORN)]?.zone).toBe("discard");
  expect(hiddenCodes(stopped.state, 1)).toEqual([]);
  expect(hiddenCodes(stopped.state, 0)).toHaveLength(2);
  expect(engagedCodes(stopped.state, 1)).toEqual([rabble, "f0"]);
  const dealtTo = (seat: number) => Object.values(stopped.state.cards).filter((card) => card.zone === "shadow" && stopped.state.seats[seat]?.engaged.includes(card.host ?? "")).length;
  expect(dealtTo(1)).toBe(0);
  expect(stopped.state.pendingAttack?.seat).toBe(1);
  const made2 = table({ phase: "Encounter", engaged: [rabble], deck: [ambusher, "f0", "f0", looms, ...fillers(6)] }, effects);
  const first = drive(made2, opened(made2, takes(made2, made2.state, 0)), (state) => state.window?.kind === "defense", () => "take");
  const spared = drive(made2, send(first, { type: "DeclareDefender", defenderId: made2.hero }, made2.ctx), (state) => state.pendingAttack == null);
  expect(hiddenCodes(spared.state)).toEqual([ambusher, "f0"]);
});

lineSpec("06120:A:1", "Forced: after Orc Ambusher engages you (by a hidden turn too) you discard 1 non-objective ally you control; Faramir and Lord Alcaron are never chosen, and an ally of the other player stays", (effects) => {
  const made = table({ seats: 2, firstPlayer: 1, phase: "Combat", play: [{ code: faramir, seat: 1 }, { code: alcaron, seat: 1 }, { code: "ally", seat: 1 }, { code: "ally", seat: 0 }], deck: [ambusher, "f0"] }, effects);
  const held = takes(made, made.state, 1);
  const turned = run(made, held, { verb: "TurnHiddenCards", who: "actor" }, { seat: 1 });
  expect(engagedCodes(turned, 1)).toEqual([ambusher]);
  const left = (state: ScenarioState, seat: number) => state.seats[seat]?.play.map((id) => state.cards[id]?.code);
  expect(left(turned, 1)).toEqual([faramir, alcaron]);
  expect(left(turned, 0)).toEqual(["ally"]);
  expect(turned.lost).toBe(false);
  // With no ally but the two objective allies nothing is discarded.
  const bare = table({ phase: "Combat", play: [faramir, alcaron], deck: [ambusher, "f0"] }, effects);
  const alone = run(bare, takes(bare, bare.state, 0), { verb: "TurnHiddenCards", who: "actor" });
  expect(engagedCodes(alone)).toEqual([ambusher]);
  expect(alone.seats[0]?.play).toHaveLength(2);
  expect(alone.lost).toBe(false);
});

lineSpec("06120:A:1", "Forced: engaged in the encounter phase the ordinary way, Orc Ambusher makes the player discard an ally", (effects) => {
  const made = table({ phase: "Encounter", staging: [ambusher], play: ["ally"] }, effects);
  const done = send(opened(made), { type: "Engage", enemyId: idOf(made.state, ambusher) }, made.ctx);
  expect(engagedCodes(done.state)).toEqual([ambusher]);
  expect(done.state.seats[0]?.play).toEqual([]);
});

lineSpec("06117:B:2", "turning engages Orc Arsonist in the middle of the combat phase: its Forced effect deals 1 shadow card to each enemy engaged with that player, itself included, before the combat phase deals its cards, which then deal none more (the engine turns first)", (effects) => {
  const made = table({ phase: "Encounter", engaged: [rabble], deck: [arsonist, ...fillers(8)] }, effects);
  const at = drive(made, opened(made, takes(made, made.state, 0)), (state) => state.window?.kind === "choose");
  const turned = send(at, { type: "Choose", optionId: "turn" }, made.ctx);
  expect(engagedCodes(turned.state)).toEqual([rabble, arsonist]);
  expect([shadowsOn(turned.state, rabble), shadowsOn(turned.state, arsonist)]).toEqual([1, 1]);
});
