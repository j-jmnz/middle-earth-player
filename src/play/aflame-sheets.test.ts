// Rules: dcce.aflame, rr.effects (data/rules/entries.json). The rows of the picks that burn Aflame locations or heal them (Corsairs' Assault, Sahír's Ravager, Corsair Arsonist, Put to the Torch, Sahír's Advance): the
// damage a location would stand at, the damage as a mark that is threat red when it destroys the card, and a caution when it burns the location or loses the game, on a table of plain-number heroes
// and the Campaign Expansion's cards (scripts/raid-scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { pushCardEffects } from "../rules/interpret/effect-frames.ts";
import type { EngineStep } from "../rules/core/intents.ts";
import { legalIntents } from "../rules/engine/legal.ts";
import { settle } from "../rules/engine/machine.ts";
import { reduce } from "../rules/engine/reduce.ts";
import type { ScenarioState } from "../rules/core/state.ts";
import { spawn } from "../rules/core/zones.ts";
import { CODES, idOf, loadRaidWorld, raidTable, type RaidLayout, type RaidWorld } from "../../scripts/raid-scene.ts";

import { fireRow } from "./aflame-sheets.ts";
import type { PickSheet, SheetNames } from "./sheet-types.ts";
import { sheetFor } from "./sheets.ts";

let world: RaidWorld;

beforeAll(async () => {
  world = await loadRaidWorld();
});

// The sheet of the question a card's records of this timing ask first, after the Choose answers given: what the table shows the player.
function asked(layout: RaidLayout, code: string, timing: "whenRevealed" | "forced", answers: readonly string[] = []): { sheet: PickSheet; state: ScenarioState } {
  const made = raidTable(world, layout);
  const effects = made.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing);
  const steps: EngineStep[] = [];
  // A When Revealed card is revealed into the staging area; a Forced stage record is the quest stage's.
  const revealed = timing === "forced" ? { state: made.state, id: made.state.questStage ?? "" } : spawn(made.state, code, { zone: "staging" });
  const source = revealed.id;
  const pushed = pushCardEffects(revealed.state, timing === "whenRevealed" ? "whenRevealed" : "forced", source, made.state.firstPlayer, false, effects, made.ctx, steps);
  let state = settle({ ...pushed, window: null, mode: "stopped" }, made.ctx, steps);
  for (const answer of answers) {
    const done = reduce(state, { type: "Choose", optionId: answer }, made.ctx);
    if (!done.ok) throw new Error(`refused: ${answer}`);
    state = done.state;
  }
  const names: SheetNames = { card: (id) => world.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
  const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
  if (sheet?.kind !== "pick") throw new Error(`no pick sheet: ${JSON.stringify(state.window)}`);
  return { sheet, state };
}
const caution = (option: PickSheet["options"][number]): string | undefined => ("caution" in option ? option.caution : undefined);

describe("the Aflame picks' rows", () => {
  it("Corsairs' Assault names the damage each tied location would stand at, marks it, and cautions when it burns one (11036:B:1)", () => {
    const { sheet, state } = asked({ phase: "Combat", staging: [{ code: CODES.caravel, damage: 3 }, CODES.whiteShip, "corsair"] }, CODES.assault, "forced");
    expect(sheet.options.map((option) => [option.id, option.label, option.mark, caution(option)])).toEqual([
      [idOf(state, CODES.caravel), "Elven Caravel · 4 of 4 damage · burns", { icon: "damage", value: 1, danger: true }, "Tap again: Elven Caravel burns and goes underneath The Havens Burn"],
      [idOf(state, CODES.whiteShip), "White Ship · 1 of 4 damage", { icon: "damage", value: 1, danger: false }, undefined],
    ]);
  });

  it("cautions that the game is lost when the location that burns is the one that fills The Havens Burn", () => {
    const { sheet } = asked({ phase: "Combat", under: [CODES.piers, CODES.pillaged, CODES.waveRunner], staging: [{ code: CODES.caravel, damage: 3 }, CODES.whiteShip, "corsair"] }, CODES.assault, "forced");
    expect(caution(sheet.options[0]!)).toBe("Tap again: Elven Caravel burns and the game is lost");
    expect(caution(sheet.options[1]!)).toBeUndefined();
  });

  it("Corsair Arsonist rows give the 2 damage each Aflame location would take, and the Dream-chaser's burning is the game lost whatever is under the Burn", () => {
    const { sheet, state } = asked({ bare: true, staging: [CODES.burn, { code: CODES.dreamChaser, damage: 11 }, { code: CODES.piers, damage: 1 }] }, CODES.arsonist, "whenRevealed");
    const rows = Object.fromEntries(sheet.options.map((option) => [option.id, [option.label, option.mark, caution(option)]]));
    expect(rows[idOf(state, CODES.dreamChaser)]).toEqual(["Dream-chaser · 12 of 12 damage · burns", { icon: "damage", value: 2, danger: true }, "Tap again: Dream-chaser burns and the game is lost"]);
    expect(rows[idOf(state, CODES.piers)]).toEqual(["Burning Piers · 3 of 5 damage", { icon: "damage", value: 2, danger: false }, undefined]);
  });

  it("Put to the Torch rows for a character you control say the damage, 'destroyed' and the game lost, and name the card and who controls it in the prompt", () => {
    const { sheet, state } = asked({ seats: 2, staging: [CODES.piers] }, CODES.torch, "whenRevealed", ["character"]);
    expect(sheet.note).toContain("choose a character you control to take 3 damage.");
    expect(sheet.note).toContain("Put to the Torch");
    expect(sheet.options.length).toBeGreaterThan(0);
    for (const option of sheet.options) {
      expect(option.mark).toEqual({ icon: "damage", value: 3, danger: false });
      expect(option.label).toBe(`${world.cards.get(state.cards[option.id]?.code ?? "")?.name} · 3 damage`);
    }
  });

  it("Sahír's Advance rows give each location's damage against its value, and the prompt counts the damage removed", () => {
    const made = raidTable(world, { stage: "11037", staging: [{ code: CODES.piers, damage: 3 }, { code: "place", damage: 2 }] });
    const names = { card: (id: string) => world.cards.get(made.state.cards[id]?.code ?? "")?.name ?? id };
    const heal = { verb: "HealLocations" as const, amount: 4, healed: 1 };
    expect(fireRow(heal, undefined, idOf(made.state, CODES.piers), made.state, made.ctx, names)).toEqual({ label: "Burning Piers · 3 of 5 damage", mark: { icon: "damage", value: 3, danger: false } });
    expect(fireRow(heal, undefined, idOf(made.state, "place"), made.state, made.ctx, names)).toEqual({ label: "place · 2 damage", mark: { icon: "damage", value: 2, danger: false } });
  });

  it("gives no row to a pick that is none of these", () => {
    const made = raidTable(world, {});
    const names = { card: (id: string) => id };
    expect(fireRow({ verb: "Pick", pick: { type: "enemy", control: "any" } }, { verb: "DamageCard", amount: 1, target: "picked" }, idOf(made.state, CODES.dreamChaser), made.state, made.ctx, names)).toBeNull();
    expect(fireRow({ verb: "Pick", pick: { type: "location", control: "any", aflame: true } }, { verb: "Draw" }, idOf(made.state, CODES.dreamChaser), made.state, made.ctx, names)).toBeNull();
  });
});
