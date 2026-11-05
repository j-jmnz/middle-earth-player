// Rules: emce.caves-deck, emce.guarded-x, rr.first-player (data/rules/entries.json); ledger lines 18047:A:1, 18049:A:2, 18057:A:2, 12173:A:2, 18055:A:2.
// The King's Quest's choices on the live sheet: each record opens a real window (the effect frame the engine builds, not a hand-made instruction), and the sheet says what the table holds now.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { settle } from "../../rules/engine/machine.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { updateCard } from "../../rules/core/state.ts";
import { pushCardEffects, pushEffectFrame } from "../../rules/interpret/effect-frames.ts";
import { spawn } from "../../rules/core/zones.ts";
import { CODES, idOf, kingsquestTable, loadKingsquestWorld, send, type KingsquestWorld, type KingsquestTable } from "../../../test/scenarios/the-kings-quest/scene.ts";

import { sheetFor } from "./sheets.ts";
import type { SheetNames } from "./sheet-types.ts";

let world: KingsquestWorld;
beforeAll(async () => {
  world = await loadKingsquestWorld();
}, 120_000);

const nameOf = (code: string): string => world.cards.get(code)?.name ?? code;
const names = (state: ScenarioState): SheetNames => ({ card: (id) => nameOf(state.cards[id]?.code ?? id), line: (id) => id });
const effectIn = (t: KingsquestTable, id: string): Effect => t.ctx.effects.find((effect) => effect.id === id)!;

// The record's frame is pushed and settled until the engine opens its window: the live state the sheet is built from.
function opened(t: KingsquestTable, state: ScenarioState, code: string, timing: Effect["timing"], source: string): ScenarioState {
  const effects = t.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing);
  const pushed = pushCardEffects(state, "whenRevealed", source, state.firstPlayer, false, effects, t.ctx, []);
  return settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, []);
}

const sheetOf = (t: KingsquestTable, state: ScenarioState) => {
  const sheet = sheetFor(state, t.ctx, legalIntents(state, t.ctx), names(state));
  if (sheet?.kind !== "pick") throw new Error(`no pick sheet: ${JSON.stringify(state.window)}`);
  return sheet;
};

describe("Stone-troll's excess discard (18049:A:2)", () => {
  it("says whose turn it is and how many cards are left, on each of the picks the engine expands it into", () => {
    const t = kingsquestTable(world, { seats: 2, engaged: [CODES.stoneTroll], hand: ["filler", "event", "ally"] });
    const troll = idOf(t.state, CODES.stoneTroll);
    const record = effectIn(t, "18049:forced:1");
    const pushed = pushEffectFrame(t.state, { frame: "forced", sourceId: troll, actor: 0, peril: false, effectId: record.id, instructions: record.instructions, cancel: null, blockCancel: null, x: 2 }, []);
    const state = settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, []);
    const first = sheetOf(t, state);
    expect(first.note).toContain("Player 1: discard 1 card from your hand (2 left: 1 for each point of excess damage).");
    expect(first.note).not.toContain("Player 1 chooses");
    expect(first.note).not.toBe("Choose a card to discard.");
    const next = send({ state, steps: [] }, { type: "Choose", optionId: first.options[0]!.id }, t.ctx).state;
    expect(sheetOf(t, next).note).toContain("Player 1: discard 1 card from your hand (1 left: 1 for each point of excess damage).");
  });

  it("has no lead solo", () => {
    const t = kingsquestTable(world, { engaged: [CODES.stoneTroll], hand: ["filler", "event", "ally"] });
    const record = effectIn(t, "18049:forced:1");
    const pushed = pushEffectFrame(t.state, { frame: "forced", sourceId: idOf(t.state, CODES.stoneTroll), actor: 0, peril: false, effectId: record.id, instructions: record.instructions, cancel: null, blockCancel: null, x: 2 }, []);
    expect(sheetOf(t, settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, [])).note).toContain("Discard 1 card from your hand (2 left: 1 for each point of excess damage).");
  });
});

describe("Dagnir's Spawn (12173:A:2)", () => {
  const dagnir = (seats: 1 | 2) => {
    const t = kingsquestTable(world, { seats });
    const placed = spawn({ ...t.state, part: 3 }, CODES.dagnirSSpawn, { zone: "staging" });
    return { t, state: opened(t, placed.state, CODES.dagnirSSpawn, "whenRevealed", placed.id) };
  };

  it("two-handed, the note leads with the player and the row says what is distributed and where the card goes", () => {
    const { t, state } = dagnir(2);
    const sheet = sheetOf(t, state);
    expect(sheet.note).toMatch(/^Player 1: distribute 3 damage among characters you control\? If you do, Dagnir's Spawn is shuffled into the encounter deck\./);
    expect(sheet.note).not.toContain("Player 1 chooses");
    expect(sheet.options.map((option) => option.label)).toEqual(["Assign 3 damage among your characters: Dagnir's Spawn is shuffled back into the encounter deck", "Do nothing"]);
  });

  it("solo, the note has no lead", () => {
    const { t, state } = dagnir(1);
    expect(sheetOf(t, state).note).toMatch(/^Distribute 3 damage among characters you control\? If you do, Dagnir's Spawn is shuffled into the encounter deck\./);
  });

  it("each damage then says only the number left and the character, with no player in brackets solo, and leads with the player two-handed", () => {
    const { t, state } = dagnir(2);
    const assign = send({ state, steps: [] }, { type: "Choose", optionId: "distribute" }, t.ctx).state;
    expect(sheetOf(t, assign).note).toContain("Player 1: assign 1 damage to a character you control (3 of 3 left).");
    const solo = dagnir(1);
    const soloAssign = send({ state: solo.state, steps: [] }, { type: "Choose", optionId: "distribute" }, solo.t.ctx).state;
    expect(sheetOf(solo.t, soloAssign).note).toContain("Assign 1 damage to a character you control (3 of 3 left).");
    expect(sheetOf(solo.t, soloAssign).note).not.toContain("(Player");
  });
});

describe("Eyes in the Dark (18057:A:2)", () => {
  it("states the threat for the questing characters, and arms the row of a questing hero that would be discarded", () => {
    const t = kingsquestTable(world, { play: ["ally"] });
    const questing = updateCard(updateCard(t.state, t.hero, { committed: true }), idOf(t.state, "ally"), { committed: true });
    const eyes = spawn(questing, CODES.eyesInTheDark, { zone: "staging" });
    const state = opened(t, eyes.state, CODES.eyesInTheDark, "whenRevealed", eyes.id);
    const sheet = sheetOf(t, state);
    expect(sheet.options.map((option) => option.label)).toContain("Raise your threat by 2 (1 for each questing character you control)");
    const picking = sheetOf(t, send({ state, steps: [] }, { type: "Choose", optionId: "discard" }, t.ctx).state);
    const heroRow = picking.options.find((option) => option.id === t.hero);
    const allyRow = picking.options.find((option) => option.id === idOf(t.state, "ally"));
    expect(heroRow?.caution).toBe(`Tap again: ${nameOf(t.state.cards[t.hero]!.code)} is discarded`);
    expect(allyRow).toBeDefined();
    expect(allyRow).not.toHaveProperty("caution");
  });
});

describe("Denizen of the Deep (18047:A:1)", () => {
  it("names the enemy the chooser's own attack, the tie and the Attack", () => {
    const t = kingsquestTable(world, { seats: 2, staging: [CODES.denizenOfTheDeep, CODES.werewolf, CODES.blackBats] });
    const denizen = idOf(t.state, CODES.denizenOfTheDeep);
    const state = opened(t, t.state, CODES.denizenOfTheDeep, "whenRevealed", denizen);
    const note = sheetOf(t, state).note;
    expect(note).toMatch(/^Player 1: choose the enemy that attacks you \(2 tied at 2 Attack\)\./);
    expect(note).not.toContain("Player 1 chooses");
    // The first player chooses and is attacked: Player 2 when Player 2 holds the token.
    const second = opened(t, { ...t.state, firstPlayer: 1, activeSeat: 1 }, CODES.denizenOfTheDeep, "whenRevealed", denizen);
    expect(sheetOf(t, second).note).toMatch(/^Player 2: choose the enemy that attacks you \(2 tied at 2 Attack\)\./);
  });
});

describe("the Caves look (18055:A:2, 18079:B:2)", () => {
  it("leads with the action, and the seat that looks", () => {
    const t = kingsquestTable(world, { seats: 2, stage: "18079", progress: 5, caves: [CODES.lostArmory, CODES.ancientTreasury, CODES.frightfulDen] });
    const record = effectIn(t, "18079:response:1");
    const pushed = pushCardEffects(t.state, "forced", t.state.questStage ?? "", 1, false, [{ ...record, condition: undefined } as Effect], t.ctx, []);
    const state = settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, []);
    expect(sheetOf(t, state).note).toContain("Player 2: keep 1 on top of the Caves deck; the other goes to the bottom.");
  });
});

describe("The Threat to Wilderland (12172:A:2)", () => {
  it("words both rows in the player's own terms", () => {
    const t = kingsquestTable(world, { staging: [{ code: CODES.theThreatToWilderland, resources: 2 }] });
    const threat = idOf(t.state, CODES.theThreatToWilderland);
    const effects = t.ctx.effects.filter((effect) => effect.cardCode === CODES.theThreatToWilderland && effect.timing === "forced");
    const pushed = pushCardEffects(t.state, "forced", threat, 0, false, effects.map((effect) => ({ ...effect, condition: undefined }) as Effect), t.ctx, []);
    const sheet = sheetOf(t, settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, []));
    expect(sheet.options.map((option) => option.label)).toEqual(["Each player raises their threat by 2", "All encounter cards are immune to player card effects until the end of the phase"]);
  });
});
