// Rules: dcce.heading, dcce.prepare-your-fleet, dcce.boarding, rr.the-word-choose (data/rules/entries.json). Every choice a Voyage Across Belegaer record asks reads as a sentence on the
// table: each branch of a Choose, each prompt of a Pick, and the questions the sea family's verbs ask (the ship, the Modification boon, the trade, the next stage, the deck and the
// named card) with no bare option id.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../catalog/boundary.ts";
import { AUTHORED_EFFECTS } from "../../effects/authored/voyage-across-belegaer.ts";
import { RECORDS as DCCE_RECORDS } from "../../effects/authored/pool/DCCE.ts";
import { loadVoyageWorld, voyageTable, type VoyageWorld } from "../../../test/scenarios/voyage-across-belegaer/scene.ts";

import { branchWords, pickWords, type ChoiceNames } from "./choice.ts";
import { pushEffectFrame } from "../../rules/interpret/effect-frames.ts";
import { seaAsk, seaOptionLabel } from "./sea.ts";

let world: VoyageWorld;

beforeAll(async () => {
  world = await loadVoyageWorld();
});

const names: ChoiceNames = { card: (id) => id, code: (code) => world.cards.get(code)?.name ?? code };
const records: readonly Effect[] = [...AUTHORED_EFFECTS, ...DCCE_RECORDS];

function walk(instructions: readonly Instruction[], visit: (instruction: Instruction, next: Instruction | undefined) => void): void {
  instructions.forEach((instruction, index) => {
    visit(instruction, instructions[index + 1]);
    if ("instructions" in instruction && Array.isArray(instruction.instructions)) walk(instruction.instructions, visit);
    if (instruction.verb === "Choose") for (const option of instruction.options) walk(option.instructions, visit);
  });
}

describe("the words of the Voyage Across Belegaer choices", () => {
  it("every Choose names each branch in a sentence", () => {
    const made = voyageTable(world, { heading: "Sun" });
    let branches = 0;
    for (const effect of records) {
      walk(effect.instructions, (instruction) => {
        if (instruction.verb !== "Choose") return;
        for (const option of instruction.options) {
          branches += 1;
          const words = branchWords(instruction, option.id, made.state, names, effect.cardCode);
          expect(words, `${effect.id} ${option.id}`).toMatch(/^[A-Z]/);
          expect(words, `${effect.id} ${option.id}`).not.toBe(option.id.charAt(0).toUpperCase() + option.id.slice(1));
        }
      });
    }
    expect(branches).toBeGreaterThanOrEqual(10);
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
    expect(picks).toBeGreaterThanOrEqual(5);
  });

  it("every verb of the sea family that asks a player has a prompt and a label for each option", () => {
    const asked: readonly Instruction[] = [
      { verb: "PrepareFleet" },
      { verb: "FitShips", codes: ["11172", "11173"] },
      { verb: "TradeShipDamage", damage: 2, resources: 1 },
      { verb: "LookAtStages", count: 2 },
      { verb: "SearchShips", count: 1 },
      { verb: "NameCard" },
      { verb: "DiscardFromAnyDeck", count: 2 },
    ];
    for (const instruction of asked) {
      const words = pickWords(instruction, undefined, names, "11016");
      expect(words.prompt, instruction.verb).toMatch(/[.?]$/);
      expect(words.prompt, instruction.verb).not.toBe("Choose one.");
    }
    const made = voyageTable(world, { seats: 2 });
    const label = (instruction: Instruction, id: string) => seaOptionLabel(instruction, id, made.state, world.cards);
    expect(label({ verb: "TradeShipDamage", damage: 2, resources: 1 }, "trade")).toBe("Trade: 2 damage to the ship for 1 resource");
    expect(label({ verb: "TradeShipDamage", damage: 2, resources: 1 }, "keep")).toBe("Keep the ship as it is");
    expect(label({ verb: "DiscardFromAnyDeck", count: 2 }, "seat:1")).toBe("Player 2's deck");
    expect(label({ verb: "DiscardFromAnyDeck", count: 2 }, "seat:0")).toBe("Your deck (Player 1)");
    expect(label({ verb: "DiscardFromAnyDeck", count: 2 }, "encounter")).toBe("The encounter deck");
    expect(label({ verb: "DiscardFromAnyDeck", count: 2 }, "corsair")).toBe("The Corsair deck");
    expect(label({ verb: "NameCard" }, "name:Scouting Ship")).toBe("Scouting Ship");
    expect(label({ verb: "TradeShipDamage", damage: 2, resources: 3 }, "trade")).toBe("Trade: 2 damage to the ship for 3 resources");
    expect(label({ verb: "FitShips", codes: ["11172"] }, "i1")).toBeNull();
  });
});

describe("the questions that name their ship and amount", () => {
  const nameOf = (state: ReturnType<typeof voyageTable>["state"]): ChoiceNames => ({ card: (id) => world.cards.get(state.cards[id]?.code ?? "")?.name ?? id, code: names.code });

  it("the fitting and the trade lead with the ship they are for, and the trade says what it deals and adds", () => {
    const made = voyageTable(world, { seats: 2, ships: [{ code: "110136", seat: 0 }] });
    const named = nameOf(made.state);
    const dreamChaser = made.ships[0] ?? "";
    expect(seaAsk({ verb: "FitShips", codes: ["11172", "11173"] }, undefined, [], made.state, made.ctx, named, null)?.prompt).toBe("Dream-chaser: choose a Modification boon to attach.");
    const trade = seaAsk({ verb: "TradeShipDamage", damage: 2, resources: 1, ship: dreamChaser }, undefined, ["trade", "keep"], made.state, made.ctx, named, null);
    expect(trade).toEqual({ verb: "Trade", prompt: "Dream-chaser: deal 2 damage to it to add 1 resource to a hero's pool?" });
    expect(seaAsk({ verb: "TradeShipDamage", damage: 2, resources: 1, ship: dreamChaser, hero: "?" }, undefined, [], made.state, made.ctx, named, null)).toEqual({ verb: "Add", prompt: "Choose the hero who gets 1 resource." });
    expect(seaAsk({ verb: "TradeShipDamage", damage: 3, resources: 2, ship: dreamChaser, hero: "?" }, undefined, [], made.state, made.ctx, named, null)?.prompt).toBe("Choose the hero who gets 2 resources.");
  });

  it("a lone player's second ship is asked as that, and the Dream-chaser is named only while it is open", () => {
    const solo = voyageTable(world, { seats: 1, ships: [{ code: "110136", seat: 0 }] });
    const named = nameOf(solo.state);
    const others = Object.values(solo.state.cards).filter((card) => card.code !== "110136").slice(0, 1).map((card) => card.id);
    expect(seaAsk({ verb: "PrepareFleet" }, undefined, others, solo.state, solo.ctx, named, null)?.prompt).toBe("Choose your second ship.");
    const duo = voyageTable(world, { seats: 2, ships: [{ code: "110136", seat: 0 }] });
    const both = { ...nameOf(duo.state) };
    expect(seaAsk({ verb: "PrepareFleet" }, undefined, [duo.ships[0] ?? ""], duo.state, duo.ctx, both, null)?.prompt).toContain("One player must take the Dream-chaser");
    expect(seaAsk({ verb: "PrepareFleet" }, undefined, others, duo.state, duo.ctx, nameOf(duo.state), null)?.prompt).toBe("Choose a Ship objective to take control of.");
  });

  it("the excess-damage pick says how much the Ship objective takes", () => {
    const made = voyageTable(world, { seats: 1, ships: [{ code: "110136", seat: 0 }] });
    const pick: Instruction = { verb: "Pick", pick: { type: "character", control: "you" } };
    const damage: Instruction = { verb: "DamageShip", amount: { excess: true } };
    const frame = (excess: number) =>
      pushEffectFrame(made.state, { frame: "shadow", sourceId: null, actor: 0, peril: false, effectId: "t", instructions: [], cancel: null, blockCancel: null, excess }, []);
    expect(seaAsk(pick, damage, [], frame(3), made.ctx, nameOf(made.state), null)?.prompt).toBe("Choose the Ship objective you control that takes 3 excess damage.");
    expect(seaAsk(pick, damage, [], frame(1), made.ctx, nameOf(made.state), null)?.prompt).toBe("Choose the Ship objective you control that takes 1 excess damage.");
  });

  it("labels a title to name with the deck its printed card belongs to", () => {
    const made = voyageTable(world, { seats: 1, ships: [{ code: "110136", seat: 0 }], staging: ["11022"] });
    const label = (title: string) => seaOptionLabel({ verb: "NameCard" }, `name:${title}`, made.state, world.cards);
    expect(label("Scouting Ship")).toBe("Scouting Ship · Encounter card");
    expect(label("Dream-chaser")).toBe("Dream-chaser · Player card");
    expect(label("dh1")).toBe("dh1 · Player card");
  });
});
