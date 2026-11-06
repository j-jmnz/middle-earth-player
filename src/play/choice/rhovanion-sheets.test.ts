// Rules: rr.first-player, rr.objective-cards, rr.guarded, rr.engaged (data/rules/entries.json); ledger lines 12184:A:2, 12184:B:1, 19036:A:1, 19040:A:1, 19042:A:2, 19044:A:1, 19045:A:1, 19046:A:1.
// Roam Across Rhovanion's choices on the live sheet: each record opens a real window (the effect frame the engine builds, not a hand-made instruction), and the sheet says the number, the side of the table and the player (Choice tray).
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { settle } from "../../rules/engine/machine.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import { CODES, idOf, loadRhovanionWorld, rhovanionTable, send, type RhovanionWorld } from "../../../test/scenarios/roam-across-rhovanion/scene.ts";

import { sheetFor } from "./sheets.ts";

let world: RhovanionWorld;
beforeAll(async () => {
  world = await loadRhovanionWorld();
}, 120_000);

type Table = ReturnType<typeof rhovanionTable>;
const nameOf = (code: string): string => world.cards.get(code)?.name ?? code;
const names = (state: ScenarioState) => ({ card: (id: string) => nameOf(state.cards[id]?.code ?? id), line: () => null });

// The record's frame is pushed and settled until the engine opens its window: the live state the sheet is built from. `only`: the one record of the card to run; `keep`: the verbs of it that run (the rest of a Setup is not this test's).
function opened(t: Table, state: ScenarioState, code: string, timing: Effect["timing"], source: string, frame: "whenRevealed" | "forced" | "travel" | "setup" = "forced", only?: string, keep?: readonly string[]): ScenarioState {
  const effects = t.ctx.effects
    .filter((effect) => effect.cardCode === code && effect.timing === timing && (only == null || effect.id === only))
    .map((effect) => ({ ...effect, condition: undefined, instructions: keep ? effect.instructions.filter((step) => keep.includes(step.verb)) : effect.instructions }) as Effect);
  const pushed = pushCardEffects(state, frame, source, state.firstPlayer, false, effects, t.ctx, []);
  return settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, []);
}

const sheetOf = (t: Table, state: ScenarioState) => {
  const sheet = sheetFor(state, t.ctx, legalIntents(state, t.ctx), names(state));
  if (sheet?.kind !== "pick") throw new Error(`no pick sheet: ${JSON.stringify(state.window)}`);
  return sheet;
};
const labels = (sheet: ReturnType<typeof sheetOf>) => sheet.options.map((option) => option.label);
const take = (t: Table, state: ScenarioState, optionId: string): ScenarioState => send({ state, steps: [] }, { type: "Choose", optionId }, t.ctx).state;
const resources = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.resources ?? 0;

describe("the trust in Urdug (12184:A:2, 12184:B:1)", () => {
  // The claim: the campaign card's Forced effect after the first player claims an objective.
  const claimed = (seats: 1 | 2, extra: Parameters<typeof rhovanionTable>[1] = {}) => {
    const t = rhovanionTable(world, { seats, campaign: true, play: [CODES.urdug], ...extra });
    return { t, state: opened(t, t.state, CODES.campaignCard, "forced", idOf(t.state, CODES.campaignCard), "forced", "12184:forced:1") };
  };

  it("solo, has no lead; it states the resources he has now, what each adds and what declining does", () => {
    const { t, state } = claimed(1);
    const sheet = sheetOf(t, state);
    expect(sheet.note).toBe("Put your trust in Urdug? He has 0; trust makes it 1. If you don't, a copy of Urdug's Cunning is shuffled into the encounter deck. At the Resolution, with 3 or more resources on him each player adds Misplaced Trust to the campaign pool and their deck; with fewer, Urdug's Cunning.");
    expect(labels(sheet)).toEqual(["Put a resource on Urdug: +1 Willpower, Threat, Attack and Defense", "Decline: shuffle a copy of Urdug's Cunning into the encounter deck"]);
  });

  it("two-handed, leads with the player who chooses (the first player), and the sheet adds no 'Player N chooses.'", () => {
    const { t, state } = claimed(2);
    const sheet = sheetOf(t, state);
    expect(sheet.note).toMatch(/^Player 1: put your trust in Urdug\? /);
    expect(sheet.note).not.toContain("Player 1 chooses");
    const second = { ...t, state: { ...t.state, firstPlayer: 1 } };
    const turned = opened(second, second.state, CODES.campaignCard, "forced", idOf(second.state, CODES.campaignCard), "forced", "12184:forced:1");
    expect(sheetOf(second, turned).note).toMatch(/^Player 2: put your trust in Urdug\? /);
  });

  it("counts the resources already on him, whichever side he shows, and trust puts one more on him", () => {
    const { t, state } = claimed(1, { play: [CODES.urdug] });
    const held = take(t, state, "trust");
    expect(resources(held, CODES.urdug)).toBe(1);
    const again = opened(t, held, CODES.campaignCard, "forced", idOf(held, CODES.campaignCard), "forced", "12184:forced:1");
    expect(sheetOf(t, again).note).toContain("He has 1; trust makes it 2.");
  });

  it("after a claim the question leads with the card claimed, and says nothing of it at the Setup", () => {
    for (const [seats, lead] of [[1, "You claimed Durin's Key. Put"], [2, "Player 1: you claimed Durin's Key. Put"]] as const) {
      const { t, state } = claimed(seats, { staging: [CODES.durinSKey] });
      const key = idOf(state, CODES.durinSKey);
      const top = state.stack.at(-1);
      expect(top?.data.kind).toBe("effect");
      const told = { ...state, stack: state.stack.map((frame) => (frame === top && frame.data.kind === "effect" ? { ...frame, data: { ...frame.data, subject: key } } : frame)) };
      expect(sheetOf(t, told).note).toMatch(new RegExp(`^${lead} your trust in Urdug\\? He has 0; trust makes it 1\\. `));
    }
  });

  it("the burden shuffles a copy of Urdug's Cunning into the encounter deck", () => {
    const { t, state } = claimed(1, { deck: ["f0", "f3"] });
    const after = take(t, state, "burden");
    expect(Object.values(after.cards).filter((card) => card.code === CODES.urdugSCunning && card.zone === "encounterDeck")).toHaveLength(1);
    expect(resources(after, CODES.urdug)).toBe(0);
  });

  it("the Setup's question reads the same once the quest card's Setup has put Urdug under the first player", () => {
    const t = rhovanionTable(world, { seats: 2, campaign: true, play: [CODES.urdug] });
    const state = opened(t, t.state, CODES.campaignCard, "campaignSetup", idOf(t.state, CODES.campaignCard), "setup", "12184:campaignSetup:1", ["PutTrust"]);
    const sheet = sheetOf(t, state);
    expect(sheet.note).toMatch(/^Player 1: put your trust in Urdug\? He has 0; trust makes it 1\./);
    expect(labels(sheet)).toHaveLength(2);
  });

  it("with no Urdug in play only the burden is offered", () => {
    const t = rhovanionTable(world, { campaign: true });
    const state = opened(t, t.state, CODES.campaignCard, "forced", idOf(t.state, CODES.campaignCard), "forced", "12184:forced:1");
    expect(state.window?.kind).not.toBe("choose");
  });
});

describe("Sneaking Off (19044:A:1), Wild Creatures (19046:A:1) and Durin's Key (19036:A:1)", () => {
  it("Sneaking Off: the first player chooses the location that comes to guard Urdug, and the sheet says what it costs", () => {
    for (const [seats, lead] of [[2, "Player 1: choose a location"], [1, "Choose a location"]] as const) {
      const t = rhovanionTable(world, { seats, play: [CODES.urdug], staging: [CODES.greyMoorland, CODES.slopesOfEredMithrin] });
      const off = spawn(t.state, CODES.sneakingOff, { zone: "staging" });
      const state = opened(t, off.state, CODES.sneakingOff, "whenRevealed", off.id, "whenRevealed");
      const sheet = sheetOf(t, state);
      expect(sheet.note).toContain(`${lead} in the staging area. Urdug is attached to it as a guarded objective: you lose control of him until it leaves play, and Sneaking Off is removed from the game.`);
      expect(sheet.note).not.toContain("chooses");
      expect(labels(sheet).sort()).toEqual(["Grey Moorland", "Slopes of Ered Mithrin"]);
    }
  });

  it("Wild Creatures: each player in turn chooses an enemy in the staging area to engage, the player's number leading two-handed", () => {
    for (const [seats, lead] of [[2, "Player 1: choose an enemy"], [1, "Choose an enemy"]] as const) {
      const t = rhovanionTable(world, { seats, staging: [CODES.stoneTroll, CODES.hobgoblin, CODES.huntingEagle] });
      const creatures = spawn(t.state, CODES.wildCreatures, { zone: "staging" });
      const state = opened(t, creatures.state, CODES.wildCreatures, "whenRevealed", creatures.id, "whenRevealed");
      const sheet = sheetOf(t, state);
      expect(sheet.note).toContain(`${lead} in the staging area to engage. If any player has none to engage, cards are discarded from the encounter deck until a Creature enemy is, and it joins the staging area.`);
      expect(sheet.note).not.toContain("chooses");
    }
  });

  it("Durin's Key: free of encounters, the first player chooses the hero that carries it, and the sheet says so", () => {
    for (const [seats, lead] of [[2, "Player 1: attach"], [1, "Attach"]] as const) {
      const t = rhovanionTable(world, { seats, campaign: true, play: [CODES.urdug], staging: [CODES.durinSKey] });
      const state = settle({ ...t.state, window: null, mode: "stopped" }, t.ctx, []);
      const sheet = sheetOf(t, state);
      expect(sheet.note).toContain(`${lead} Durin's Key to one of your heroes. It is free of encounters, so you claim it; you are asked about trust in Urdug next.`);
      expect(sheet.note).not.toContain("chooses");
    }
  });
});

describe("Wilderland Bear (19040:A:1), Deep Ravine (19042:A:2) and Harsh Weather (19045:A:1)", () => {
  it("Wilderland Bear: the first player chooses between the immediate attack and the discard", () => {
    for (const [seats, lead] of [[2, "Player 1: "], [1, ""]] as const) {
      const t = rhovanionTable(world, { seats, staging: [CODES.wilderlandBear] });
      const state = opened(t, t.state, CODES.wilderlandBear, "whenRevealed", idOf(t.state, CODES.wilderlandBear), "whenRevealed");
      const sheet = sheetOf(t, state);
      expect(sheet.note).toBe(`${lead}Wilderland Bear attacks you, or each player discards 1 card at random from their hand?`);
      expect(sheet.note).not.toContain("chooses");
      expect(labels(sheet)).toEqual(["Wilderland Bear makes an immediate attack against you", "Each player discards 1 card at random from their hand"]);
    }
  });

  it("Deep Ravine: to travel here the first player exhausts Urdug or each player raises their threat", () => {
    const t = rhovanionTable(world, { seats: 2, phase: "Travel", play: [CODES.urdug], staging: [CODES.deepRavine] });
    const ravine = idOf(t.state, CODES.deepRavine);
    const state = opened(t, t.state, CODES.deepRavine, "travel", ravine, "travel");
    const sheet = sheetOf(t, state);
    expect(sheet.note).toBe("Player 1: to travel to Deep Ravine, exhaust Urdug, or raise each player's threat by 2?");
    expect(labels(sheet)).toEqual(["Exhaust Urdug", "Raise each player's threat by 2"]);
    expect(resources(take(t, state, "exhaust"), CODES.urdug)).toBe(0);
    expect(take(t, state, "exhaust").cards[idOf(state, CODES.urdug)]?.exhausted).toBe(true);
    // Solo has no lead.
    const solo = rhovanionTable(world, { seats: 1, phase: "Travel", play: [CODES.urdug], staging: [CODES.deepRavine] });
    const alone = opened(solo, solo.state, CODES.deepRavine, "travel", idOf(solo.state, CODES.deepRavine), "travel");
    expect(sheetOf(solo, alone).note).toBe("To travel to Deep Ravine, exhaust Urdug, or raise each player's threat by 2?");
  });

  it("Harsh Weather: the player exhausts a ready character or raises their threat, and the sheet counts the round", () => {
    const t = rhovanionTable(world, { seats: 2, staging: [CODES.harshWeather] });
    const state = opened(t, t.state, CODES.harshWeather, "whenRevealed", idOf(t.state, CODES.harshWeather), "whenRevealed");
    const sheet = sheetOf(t, state);
    expect(sheet.note).toMatch(/^Player 1: exhaust .+, or raise your threat by \d\? \(\d of \d\)$/);
    expect(labels(sheet)[1]).toMatch(/^Raise your threat by \d$/);
  });
});
