// Rules: ats.losing-control-of-locations, ats.controlling-locations, rr.shadow-effects, rr.ownership-and-control, rr.defending-player, rr.sentinel, rr.step-6-4-1 (data/rules/entries.json); ledger lines 06093:A:1, 06093:A:2, 06094:A:1, 06094:A:2, 06100:A:2, 06101:A:2, 06104:A:2.
// The cards of Assault on Osgiliath that read the locations the first player controls when an enemy attacks, and the ones that act when an attack destroys a character: the player who controls the destroyed character returns a location, not the defending player (a Sentinel defender
// belongs to another player). Built on a real attack: seat 1 is the first player and took control of Ancient Harbor in the quest phase; seat 0 is attacked.
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { send, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { CODES, cardOf, controlled, drive, idByCode, opened, table, where } from "../../../../test/scenarios/assault-on-osgiliath/table.ts";

const ARAGORN = "01001";
const VANGUARD = "05058";
const SOLDIER = "06093";
const PHALANX = "06094";
const SPEARMAN = "01029";
const EOWYN = "01007";

type Layout = { seats: 1 | 2; firstPlayer: 0 | 1; play?: { code: string; seat: number }[]; heroes?: { code: string; seat: number }[] };
type Answer = (made: LayoutTable, state: ScenarioState) => PlayerIntent;

/** The quest phase explores Ancient Harbor for the first player, then `enemy` engaged with seat 0 attacks with `shadow` dealt to it; `answer` is the intent that answers the defense window. */
function fight(layout: Layout, enemy: string, shadow: string | null, answer: Answer, effects: readonly Effect[], at: { code: string; progress: number } = { code: CODES.harbor, progress: 4 }) {
  // The quest phase reveals one card for each player; the next card is the enemy's shadow card.
  const reveals = Array.from({ length: layout.seats }, () => "f0");
  const deck = shadow ? [...reveals, shadow, "f0", "f0", "f0"] : [...reveals, "f0", "f0", "f0", "f0"];
  const made = table({ ...layout, phase: "Quest", active: at, committed: ["dh1", "dh2"], engaged: [{ code: enemy, seat: 0 }], deck }, effects, [ARAGORN, VANGUARD, SPEARMAN, EOWYN]);
  const run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.window?.kind === "defense");
  const done = drive(made, send(run, answer(made, run.state), made.ctx), (state) => state.pendingAttack == null && state.phase !== "Combat");
  return { made, before: run.state, done: done.state };
}

const sentinel: Answer = (_made, state) => ({ type: "DeclareDefender", defenderId: idByCode(state, ARAGORN) });
const hero2: Answer = (made) => ({ type: "DeclareDefender", defenderId: made.hero2 });
const SENTINEL_SEATS: Layout = { seats: 2, firstPlayer: 1, heroes: [{ code: ARAGORN, seat: 1 }] };

/** The Shadow effect of a card dealt to the Orc Vanguard: when the attack destroys the Sentinel hero of the first player (the player attacked is the other one) he returns the location he controls; when nobody is destroyed no location is returned. */
function shadowReturns(shadow: string, effects: readonly Effect[]): void {
  const hit = fight(SENTINEL_SEATS, VANGUARD, shadow, sentinel, effects);
  expect(controlled(hit.before)).toEqual([CODES.harbor]);
  expect(cardOf(hit.before, CODES.harbor)).toMatchObject({ zone: "play", controller: 1 });
  expect(idByCode(hit.done, ARAGORN) && hit.done.cards[idByCode(hit.done, ARAGORN)]?.zone).toBe("discard");
  expect(cardOf(hit.done, CODES.harbor)).toMatchObject({ zone: "staging", progress: 0, controller: null });
  expect(controlled(hit.done)).toEqual([]);
  const spared = fight({ seats: 1, firstPlayer: 0 }, "f3", shadow, hero2, effects);
  expect(where(spared.done, CODES.harbor)).toBe("play");
}

lineSpec("06100:A:2", "Shadow: if the attack destroys a character, its controller returns a location he controls, though he is not the player attacked", (effects) => shadowReturns("06100", effects));
lineSpec("06101:A:2", "Shadow: if the attack destroys a character, its controller returns a location he controls, though he is not the player attacked", (effects) => shadowReturns("06101", effects));
lineSpec("06104:A:2", "Shadow: if the attack destroys a character, its controller returns a location he controls, though he is not the player attacked", (effects) => shadowReturns("06104", effects));

lineSpec("06093:A:1", "makes the player who controls the destroyed Sentinel ally return the location he controls, though he was not attacked", (effects) => {
  const { before, done } = fight({ seats: 2, firstPlayer: 1, play: [{ code: SPEARMAN, seat: 1 }] }, SOLDIER, null, (_made, state) => ({ type: "DeclareDefender", defenderId: idByCode(state, SPEARMAN) }), effects);
  expect(cardOf(before, CODES.harbor)).toMatchObject({ zone: "play", controller: 1 });
  expect(cardOf(done, SPEARMAN)?.zone).toBe("discard");
  expect(cardOf(done, CODES.harbor)).toMatchObject({ zone: "staging", progress: 0, controller: null });
});

lineSpec("06093:A:1", "sends the location back when an undefended attack destroys the hero it lands on, and returns nothing when the character survives", (effects) => {
  // West Quarter is the location (Ancient Harbor would return by its own Forced effect: the attack is undefended).
  const quarter = { code: CODES.westQuarter, progress: 2 };
  const killed = fight({ seats: 1, firstPlayer: 0, heroes: [{ code: EOWYN, seat: 0 }] }, SOLDIER, null, (_made, state) => ({ type: "Undefended", heroId: idByCode(state, EOWYN) }), effects, quarter);
  expect(cardOf(killed.done, EOWYN)?.zone).toBe("discard");
  expect(cardOf(killed.done, CODES.westQuarter)).toMatchObject({ zone: "staging", controller: null });
  const survived = fight({ seats: 1, firstPlayer: 0, heroes: [{ code: EOWYN, seat: 0 }] }, SOLDIER, null, hero2, effects, quarter);
  expect(cardOf(survived.done, EOWYN)?.zone).toBe("heroes");
  expect(where(survived.done, CODES.westQuarter)).toBe("play");
});

lineSpec("06093:A:2", "Shadow: the defending player raises his threat by 1 for each location he controls", (effects) => {
  const threatAfter = (explored: boolean) => {
    const made = table({ phase: "Quest", ...(explored ? { active: { code: CODES.harbor, progress: 4 } } : { staging: [CODES.harbor] }), committed: ["dh1", "dh2"], engaged: [{ code: "f3", seat: 0 }], deck: ["f0", SOLDIER, "f0", "f0"], staging: [CODES.westQuarter] }, effects);
    const run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.window?.kind === "defense");
    const before = run.state.seats[0]?.threat ?? 0;
    const done = drive(made, send(run, { type: "DeclareDefender", defenderId: made.hero }, made.ctx), (state) => state.pendingAttack == null && state.phase !== "Combat");
    return (done.state.seats[0]?.threat ?? 0) - before;
  };
  expect(threatAfter(true) - threatAfter(false)).toBe(1);
});

lineSpec("06094:A:1", "gets +1 Attack for each location the player it is engaged with controls", (effects) => {
  const damage = (layout: Layout) => {
    const { done, made } = fight(layout, PHALANX, null, (_made, state) => ({ type: "Undefended", heroId: idByCode(state, "dh1") }), effects);
    return done.cards[made.hero]?.damage ?? 0;
  };
  // Southron Phalanx has 1 Attack: it deals 2 once the player it attacks controls a location.
  expect(damage({ seats: 1, firstPlayer: 0 })).toBe(2);
  const none = table({ phase: "Combat", engaged: [{ code: PHALANX, seat: 0 }], deck: ["f0", "f0", "f0"] }, effects);
  const run = drive(none, opened(none), (state) => state.window?.kind === "defense");
  const hit = drive(none, send(run, { type: "Undefended", heroId: none.hero }, none.ctx), (state) => state.pendingAttack == null);
  expect(hit.state.cards[none.hero]?.damage).toBe(1);
});

lineSpec("06094:A:2", "Shadow: the attacking enemy gets +1 Attack for each location the defending player controls", (effects) => {
  const damage = (explored: boolean) => {
    const made = table({ phase: "Quest", ...(explored ? { active: { code: CODES.harbor, progress: 4 } } : {}), staging: [CODES.westQuarter], committed: ["dh1", "dh2"], engaged: [{ code: "f3", seat: 0 }], deck: ["f0", PHALANX, "f0", "f0"] }, effects);
    const run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.window?.kind === "defense");
    const done = drive(made, send(run, { type: "Undefended", heroId: made.hero }, made.ctx), (state) => state.pendingAttack == null && state.phase !== "Combat");
    return done.state.cards[made.hero]?.damage ?? 0;
  };
  expect(damage(true) - damage(false)).toBe(1);
});
