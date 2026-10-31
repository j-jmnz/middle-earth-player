// Rules: dcce.stormcallers-area, dcce.sailing-tests, dcce.boarding, rr.the-word-choose (data/rules/entries.json). Every choice a Flight of the Stormcaller record asks reads as a sentence on the table: each branch of a
// Choose and each prompt of a Pick, with no bare option id; and the clauses of the stormcaller family's verbs.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../catalog/boundary.ts";
import { AUTHORED_EFFECTS } from "../effects/authored/flight-of-the-stormcaller.ts";
import { RECORDS as DCCE_RECORDS } from "../effects/authored/pool/DCCE.ts";
import { settle } from "../rules/machine.ts";
import { CODES, flightTable, idOf, loadFlightWorld, type FlightWorld } from "../../scripts/stormcaller-scene.ts";

import { effectLines } from "./card-effects.ts";

import { branchWords, pickWords, type ChoiceNames } from "./choice-words.ts";
import { AREA_APART, AREA_TOGETHER, STAGE_LOSS, stormcallerWords } from "./stormcaller-words.ts";

let world: FlightWorld;

beforeAll(async () => {
  world = await loadFlightWorld();
});

const names: ChoiceNames = { card: (id) => id, code: (code) => world.cards.get(code)?.name ?? code };
const records: readonly Effect[] = [...AUTHORED_EFFECTS, ...DCCE_RECORDS.filter((effect) => ["11192", "11193"].includes(effect.cardCode))];

function walk(instructions: readonly Instruction[], visit: (instruction: Instruction, next: Instruction | undefined) => void): void {
  instructions.forEach((instruction, index) => {
    visit(instruction, instructions[index + 1]);
    if ("instructions" in instruction && Array.isArray(instruction.instructions)) walk(instruction.instructions, visit);
    if (instruction.verb === "Choose") for (const option of instruction.options) walk(option.instructions, visit);
  });
}

describe("the words of the Flight of the Stormcaller choices", () => {
  it("every Choose names each branch in a sentence", () => {
    const made = flightTable(world, {});
    const seen: string[] = [];
    for (const effect of records) {
      walk(effect.instructions, (instruction) => {
        if (instruction.verb !== "Choose") return;
        for (const option of instruction.options) {
          const words = branchWords(instruction, option.id, made.state, names, effect.cardCode);
          expect(words, `${effect.id} ${option.id}`).toMatch(/^[A-Z0-9][A-Za-z0-9']* .+/);
          seen.push(words);
        }
      });
    }
    expect(seen).toContain("Raise your threat by 3 (to 31)");
    expect(seen).toContain("12022 gains Boarding 1: reveal 1 Corsair card now");
  });

  it("every Pick that asks a player says what the card is for", () => {
    let picks = 0;
    for (const effect of records) {
      walk(effect.instructions, (instruction, next) => {
        if (instruction.verb !== "Pick") return;
        picks += 1;
        const words = pickWords(instruction, next, names, effect.cardCode);
        expect(words.prompt, effect.id).toMatch(/\.$/);
        expect(words.prompt, effect.id).not.toBe("Choose one.");
        expect(words.verb, effect.id).not.toBe("Choose");
      });
    }
    expect(picks).toBeGreaterThanOrEqual(3);
  });

  it("each verb of the family reads as a clause", () => {
    expect(stormcallerWords({ verb: "PrepareStormcallerArea", stages: ["12016", "12017", "12018"], number: 2 })).toBe("prepare the Stormcaller's area: a second quest deck of the Stormcaller's stages 2C, 3C and 4C, and the Stormcaller beside it");
    expect(stormcallerWords({ verb: "MoveProgressToStormcaller", amount: 2 })).toBe("move 2 progress from the main quest to the Stormcaller's quest stage");
    expect(stormcallerWords({ verb: "StormcallerProgress" })).toBe("discard the top card of the encounter deck; the Stormcaller places progress on its stage equal to its Threat plus the Threat of the discarded card");
    expect(stormcallerWords({ verb: "MoveToStormcallerArea" })).toBe("add it to the Stormcaller's area");
    expect(stormcallerWords({ verb: "FlipStormcaller" })).toBe("flip the Stormcaller to its Campaign Mode only side");
    expect(stormcallerWords({ verb: "CatchUpWins", stage: 2 })).toBe("defeating this stage when the Stormcaller is at stage 2 wins the game");
    expect(stormcallerWords({ verb: "Draw" })).toBeNull();
  });
});

describe("the preview of a card of the Stormcaller's area", () => {
  it("says where the card stands: apart from the staging area, in it at the Stormcaller's stage, or the stage the players have reached", () => {
    const apart = flightTable(world, { area: [CODES.escort], staging: [CODES.skiff] });
    const lines = (made: ReturnType<typeof flightTable>, id: string): readonly string[] => effectLines(made.state, made.ctx, id, (card) => card);
    expect(lines(apart, apart.caller)).toEqual([AREA_APART]);
    expect(lines(apart, idOf(apart.state, CODES.skiff))).toEqual([]);
    // The stage says where it stands against the players' stage, always, and what filling the last one does.
    expect(lines(apart, apart.callerStage)).toEqual(["The Stormcaller's stage 2 of 4 · 0/12 · the players are at stage 1: its cards are out of reach"]);
    const last = flightTable(world, { caller: 4, callerProgress: 10 });
    expect(lines(last, last.callerStage)).toEqual(["The Stormcaller's stage 4 of 4 · 10/24 · the players are at stage 1: its cards are out of reach", STAGE_LOSS]);
    const together = flightTable(world, { stage: "12013", area: [CODES.escort] });
    const settled = settle(together.state, together.ctx, []);
    expect(effectLines(settled, together.ctx, together.caller, (card) => card)).toEqual([AREA_TOGETHER]);
    expect(effectLines(settled, together.ctx, together.callerStage, (card) => card)).toEqual(["The Stormcaller's stage 2 of 4 · 0/12 · the players are at its stage: its cards are in the staging area"]);
  });
});
