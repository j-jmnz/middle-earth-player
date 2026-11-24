// Rules: ats.setup-encounter-at-amon-din, ats.setup-amon-din-objectives, ats.villagers, ats.ally-objectives, rr.reveal, rr.surge (data/rules/entries.json).
// The Setup of Encounter at Amon Dîn (06066:A:1, 06066:B:1, 06070:A:1, 06071:A:3) played by the engine from the standalone start, with one and with two players: the encounter deck, Burning Farmhouse as the active location with its tokens, the two objectives, Lord Alcaron under the first player's control, Ghulat set aside and the 5 tokens of stage 1B.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { reduce, startScenario, type PlayerIntent, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { resolveRecords } from "../../../../test/harness/scene-kit.ts";
import { dinStart, dinWorld } from "../../../../test/scenarios/encounter-at-amon-din/game.ts";
import { CODES, table, villagers } from "../../../../test/scenarios/encounter-at-amon-din/table.ts";

const { savagery, rescued, dead, alcaron, ghulat, farmhouse } = CODES;

const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// The game after its Setup: every mulligan kept and every choice of the opening answered with its first option.
function opened(seats: 1 | 2, ctx: ReduceContext): ScenarioState {
  let state = startScenario(dinStart(seats, 3, "Normal"), ctx);
  for (let guard = 0; guard < 12 && (state.window?.kind === "mulligan" || state.window?.kind === "choose"); guard += 1) {
    const intent: PlayerIntent = state.window.kind === "mulligan" ? { type: "Keep" } : { type: "Choose", optionId: state.window.options[0] ?? "" };
    state = expectOk(reduce(state, intent, ctx)).state;
  }
  return state;
}

describe("06066:A:1 Setup", () => {
  it("06066:A:1 Burning Farmhouse is the active location with its 4 villager tokens, and both objectives wait in the staging area, with one player and with two", async () => {
    const { ctx } = await dinWorld();
    for (const seats of [1, 2] as const) {
      const state = opened(seats, ctx);
      // The deck holds other copies of Burning Farmhouse: the active location is the one in its own zone.
      const active = cardsOf(state, farmhouse).filter((card) => card.zone === "activeLocation");
      expect(active).toHaveLength(1);
      expect(active[0]?.resources).toBe(4);
      expect(cardsOf(state, rescued).map((card) => card.zone)).toEqual(["staging"]);
      expect(cardsOf(state, dead).map((card) => card.zone)).toEqual(["staging"]);
      expect(cardsOf(state, rescued)[0]?.resources).toBe(0);
      expect(cardsOf(state, dead)[0]?.damage).toBe(0);
    }
  });

  it("06066:A:1 the encounter deck is Encounter at Amon Dîn and Ravaging Orcs (ats.setup-encounter-at-amon-din): the three Ravaging Orcs cards are in the game", async () => {
    const { ctx } = await dinWorld();
    const state = opened(1, ctx);
    const codes = new Set(Object.values(state.cards).map((card) => card.code));
    for (const code of ["05062", "05063", "05064", ghulat, alcaron, CODES.marauding, CODES.panicked]) expect(codes.has(code)).toBe(true);
  });

  it("06066:A:1 Ghulat is set aside, out of play, and the Setup reveals 1 encounter card for each player (more when a card gains surge)", async () => {
    const { ctx } = await dinWorld();
    for (const seats of [1, 2] as const) {
      const state = opened(seats, ctx);
      expect(cardsOf(state, ghulat).map((card) => card.zone)).toEqual(["setAside"]);
      expect(state.encounterDeck.map((id) => state.cards[id]?.code)).not.toContain(ghulat);
      const revealed = Object.values(state.cards).filter((card) => ["staging", "engaged", "encounterDiscard"].includes(card.zone) && card.code !== rescued && card.code !== dead && card.code !== ghulat);
      expect(revealed.length).toBeGreaterThanOrEqual(seats);
    }
  });
});

describe("06066:B:1 Villagers 5", () => {
  it("06066:B:1 stage 1B holds 5 villager tokens from the start of the game, and they are not resources (ats.villagers)", async () => {
    const { ctx } = await dinWorld();
    for (const seats of [1, 2] as const) {
      const state = opened(seats, ctx);
      const quest = state.cards[state.questStage ?? ""];
      expect(quest?.code).toBe(savagery);
      expect(quest?.face).toBe("B");
      expect(quest?.resources).toBe(5);
      // The tokens lie on the quest card only: each hero holds just the 1 resource of the first resource phase.
      expect((state.seats[0]?.heroes ?? []).map((id) => state.cards[id]?.resources)).toEqual([1, 1, 1]);
    }
  });

  it("06066:B:1 the Setup does not advance the quest while the card holds no token yet (stage 1B places its tokens as it is revealed)", async () => {
    const { ctx } = await dinWorld();
    const state = opened(1, ctx);
    expect(state.cards[state.questStage ?? ""]?.code).toBe(savagery);
    expect(cardsOf(state, CODES.protect).map((card) => card.zone)).not.toContain("questStage");
  });
});

describe("06070:A:1 Lord Alcaron", () => {
  it("06070:A:1 the first player gains control of Lord Alcaron: he is in that player's play area from the Setup and is not committed to the quest", async () => {
    const { ctx } = await dinWorld();
    const state = opened(2, ctx);
    const lord = cardsOf(state, alcaron)[0];
    expect(lord?.zone).toBe("play");
    expect(lord?.controller).toBe(state.firstPlayer);
    expect(lord?.committed).toBeFalsy();
  });

  it("06070:A:1 with the second player as first player the Setup gives Lord Alcaron to that player", () => {
    const t = table({ seats: 2, firstPlayer: 1, stage: CODES.protect, active: farmhouse, staging: [rescued, dead], setAside: [alcaron, ghulat], deck: ["f0", "f0", "f0"] });
    const done = resolveRecords(t.state, t.ctx, savagery, "setup", Object.values(t.state.cards).find((card) => card.code === savagery)?.id).state;
    const lord = cardsOf(done, alcaron)[0];
    expect(lord?.zone).toBe("play");
    expect(lord?.controller).toBe(1);
    expect(villagers(done, farmhouse)).toBe(4);
  });
});

describe("06071:A:3 Ghulat at the Setup", () => {
  it("06071:A:3 Ghulat is not in play at the start: the game can end until stage 2 adds him", async () => {
    const { ctx } = await dinWorld();
    const state = opened(1, ctx);
    expect(cardsOf(state, ghulat)[0]?.zone).toBe("setAside");
    expect(state.lost).toBeFalsy();
  });
});
