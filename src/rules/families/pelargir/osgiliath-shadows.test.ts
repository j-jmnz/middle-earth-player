// Rules: ats.losing-control-of-locations, rr.shadow-effects, rr.ownership-and-control, rr.defending-player, rr.sentinel (data/rules/entries.json); ledger lines 06093:A:1, 06100:A:2, 06101:A:2, 06104:A:2, 06093:A:2, 06092:A:2, 06094:A:2, 06094:A:1.
// The cards of Assault on Osgiliath that act when an attack destroys a character: the Uruk Soldier's Forced effect and the Shadow effects of West Quarter, East Quarter and Pinned Down. The player who controls the destroyed character returns a location: not the defending player.
// Built on a real attack. Seat 1 is the first player and took control of Ancient Harbor in the quest phase; seat 0 is attacked, and seat 1's Sentinel hero (Aragorn) defends and is destroyed. A record that acts for the defending player (seat 0) finds no location to return.
import { describe, expect, it } from "vitest";

import { send, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { CODES, cardOf, drive, opened, table, where } from "../../../../test/scenarios/assault-on-osgiliath/table.ts";
import type { PlayerIntent } from "../../engine/reduce.ts";
import type { ScenarioState } from "../../core/state.ts";

const ARAGORN = "01001";
const VANGUARD = "05058";

const controlled = (state: ScenarioState): string[] => state.modifiers.filter((modifier) => modifier.stat === "controlledBy").map((modifier) => state.cards[modifier.instanceId]?.code ?? "");

/** The quest phase explores Ancient Harbor for the first player (seat 1), then the Vanguard engaged with seat 0 attacks it with the card dealt as shadow; the answer to the defense window comes from `defend`. */
function attacked(shadow: string, defend: (made: LayoutTable, state: ScenarioState) => PlayerIntent) {
  const made = table(
    { seats: 2, firstPlayer: 1, phase: "Quest", active: { code: CODES.harbor, progress: 4 }, committed: ["dh1", "dh2"], heroes: [{ code: ARAGORN, seat: 1 }], engaged: [{ code: VANGUARD, seat: 0 }], deck: ["f0", "f0", shadow, "f0", "f0", "f0"] },
    undefined,
    [ARAGORN, VANGUARD],
  );
  const run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.window?.kind === "defense");
  const done = drive(made, send(run, defend(made, run.state), made.ctx), (state) => state.pendingAttack == null && state.phase !== "Combat");
  return { made, before: run.state, done: done.state };
}

const sentinel = (made: LayoutTable, state: ScenarioState): PlayerIntent => ({ type: "DeclareDefender", defenderId: Object.values(state.cards).find((card) => card.code === ARAGORN && made.state.cards[card.id] != null)?.id ?? "" });

describe.each([
  ["06100:A:2", CODES.harbor, "06100"],
  ["06101:A:2", CODES.eastQuarter, "06101"],
  ["06104:A:2", CODES.pinned, "06104"],
])("%s Shadow: if this attack destroys a character, its controller returns a location he controls", (_line, _code, shadow) => {
  it("makes the player who controls the destroyed Sentinel hero return the location he controls, not the defending player", () => {
    const { before, done } = attacked(shadow, sentinel);
    expect(controlled(before)).toEqual([CODES.harbor]);
    expect(cardOf(before, CODES.harbor)).toMatchObject({ zone: "play", controller: 1 });
    expect(Object.values(done.cards).find((card) => card.code === ARAGORN)?.zone).toBe("discard");
    expect(cardOf(done, CODES.harbor)).toMatchObject({ zone: "staging", progress: 0, controller: null });
    expect(controlled(done)).toEqual([]);
  });

  it("returns no location when the attack destroys nobody", () => {
    const { done } = attacked(shadow, (_made, state) => ({ type: "DeclareDefender", defenderId: Object.values(state.cards).find((card) => card.code === "dh1" || card.zone === "heroes" && card.controller === 0)?.id ?? "" }));
    expect(where(done, CODES.harbor)).toBe("play");
  });
});

const SOLDIER = "06093";
const SPEARMAN = "01029";
const EOWYN = "01007";

/** As `attacked`, with a given enemy (and no shadow card of the scenario), the extra cards in play of seat 1 and the layout of the seats. */
function soldierAttack(layout: { seats: 1 | 2; firstPlayer: 0 | 1; play?: { code: string; seat: number }[]; heroes?: { code: string; seat: number }[] }, answer: (made: LayoutTable, state: ScenarioState) => PlayerIntent) {
  const made = table(
    { ...layout, phase: "Quest", active: { code: CODES.harbor, progress: 4 }, committed: ["dh1", "dh2"], engaged: [{ code: SOLDIER, seat: 0 }], deck: ["f0", "f0", "f0", "f0", "f0"] },
    undefined,
    [SPEARMAN, EOWYN],
  );
  const run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.window?.kind === "defense");
  const done = drive(made, send(run, answer(made, run.state), made.ctx), (state) => state.pendingAttack == null && state.phase !== "Combat");
  return { before: run.state, done: done.state };
}

const idByCode = (state: ScenarioState, code: string): string => Object.values(state.cards).find((card) => card.code === code)?.id ?? "";

describe("06093:A:1 Uruk Soldier: after it attacks and destroys a character, that character's controller returns a location", () => {
  it("makes the player who controls the destroyed Sentinel ally return the location he controls, though he was not attacked", () => {
    const { before, done } = soldierAttack({ seats: 2, firstPlayer: 1, play: [{ code: SPEARMAN, seat: 1 }] }, (_made, state) => ({ type: "DeclareDefender", defenderId: idByCode(state, SPEARMAN) }));
    expect(cardOf(before, CODES.harbor)).toMatchObject({ zone: "play", controller: 1 });
    expect(cardOf(done, SPEARMAN)?.zone).toBe("discard");
    expect(cardOf(done, CODES.harbor)).toMatchObject({ zone: "staging", progress: 0, controller: null });
  });

  it("sends the location back when an undefended attack destroys the hero it lands on", () => {
    const { done } = soldierAttack({ seats: 1, firstPlayer: 0, heroes: [{ code: EOWYN, seat: 0 }] }, (_made, state) => ({ type: "Undefended", heroId: idByCode(state, EOWYN) }));
    expect(cardOf(done, EOWYN)?.zone).toBe("discard");
    expect(cardOf(done, CODES.harbor)).toMatchObject({ zone: "staging", controller: null });
  });

  it("returns nothing when the character survives", () => {
    const { done } = soldierAttack({ seats: 1, firstPlayer: 0, heroes: [{ code: EOWYN, seat: 0 }] }, (made) => ({ type: "DeclareDefender", defenderId: made.hero2 }));
    expect(cardOf(done, EOWYN)?.zone).toBe("heroes");
    expect(where(done, CODES.harbor)).toBe("play");
  });
});
