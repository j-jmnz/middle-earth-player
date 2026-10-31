// Rules: dcce.grapple, dcce.stormcaller-and-the-thing, rr.the-word-choose (data/rules/entries.json). Every choice a record of The Thing in the Depths asks reads as a sentence on the table, the grapple
// choices of the sheet, and what the table says of the enemies grappled with a location: a count and the Threat they add, never a name.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../catalog/boundary.ts";
import { AUTHORED_EFFECTS } from "../effects/authored/the-thing-in-the-depths.ts";
import { RECORDS as DCCE_RECORDS } from "../effects/authored/pool/DCCE.ts";
import { CODES, depthsTable, idOf, loadDepthsWorld, type DepthsWorld } from "../../scripts/depths-scene.ts";

import { effectLines } from "./card-effects.ts";
import { pickWords, type ChoiceNames } from "./choice-words.ts";
import { detachLine, grappleAsk, grappleDetail, grappleLine, grappleOptionLabel, grappleTell, grappledWords } from "./grapple-words.ts";
import { previewCards } from "./table-preview.ts";

let world: DepthsWorld;

beforeAll(async () => {
  world = await loadDepthsWorld();
});

const names: ChoiceNames = { card: (id) => id, code: (code) => world.cards.get(code)?.name ?? code };
const records: readonly Effect[] = [...AUTHORED_EFFECTS, ...DCCE_RECORDS.filter((effect) => ["11195", "11196"].includes(effect.cardCode))];

function walk(instructions: readonly Instruction[], visit: (instruction: Instruction, next: Instruction | undefined) => void): void {
  instructions.forEach((instruction, index) => {
    visit(instruction, instructions[index + 1]);
    if ("instructions" in instruction && Array.isArray(instruction.instructions)) walk(instruction.instructions, visit);
    if (instruction.verb === "Choose") for (const option of instruction.options) walk(option.instructions, visit);
  });
}

describe("the words of The Thing in the Depths choices", () => {
  it("every Pick that asks a player says what the card is for", () => {
    let picks = 0;
    for (const effect of records) {
      walk(effect.instructions, (instruction, next) => {
        if (instruction.verb !== "Pick" && instruction.verb !== "ResolveGrapple" && instruction.verb !== "EngageOrGrapple" && instruction.verb !== "GainChosenTrait") return;
        picks += 1;
        const words = grappleAsk(instruction, effect.cardCode, names) ?? pickWords(instruction, next, names, effect.cardCode);
        expect(words.prompt, effect.id).toMatch(/\.$|\?$/);
        expect(words.prompt, effect.id).not.toBe("Choose one.");
      });
    }
    expect(picks).toBeGreaterThan(8);
  });

  it("the grapple choices state the decision first and never name the enemy that goes facedown", () => {
    const tie = grappleAsk({ verb: "ResolveGrapple", card: "i9" }, "12053", { card: (id) => (id === "i9" ? "Grasping Arm" : id), code: names.code });
    expect(tie).toEqual({ verb: "Grapple", prompt: "Choose the location the enemy grapples with. The locations are tied. The enemy goes facedown under it." });
    expect(tie?.prompt).not.toContain("Grasping Arm");
    const giant = grappleAsk({ verb: "EngageOrGrapple" }, CODES.giant, { card: () => "Giant Arm", code: names.code });
    expect(giant?.prompt).toBe("Giant Arm: put it into play engaged with you and deal it a shadow card, or resolve its Grapple keyword?");
    expect(grappleOptionLabel({ verb: "EngageOrGrapple" }, "engage")).toBe("Put it into play engaged with you, and deal it a shadow card");
    expect(grappleOptionLabel({ verb: "EngageOrGrapple" }, "grapple")).toBe("Resolve its Grapple keyword");
    expect(grappleOptionLabel({ verb: "GainChosenTrait" }, "Noble")).toBe("Noble");
    expect(grappleOptionLabel({ verb: "ShuffleEncounterDeck" }, "x")).toBeNull();
  });
});

describe("the enemies grappled with a location", () => {
  it("says how many are facedown under it and how much Threat they add, and nothing when none are", () => {
    expect(grappledWords(0)).toBeNull();
    expect(grappledWords(1)).toBe("Grappled: 1 facedown enemy, +2 Threat");
    expect(grappledWords(3)).toBe("Grappled: 3 facedown enemies, +6 Threat");
    expect(grappleLine("Cargo Hold")).toBe("An enemy grapples with Cargo Hold");
    expect(detachLine("Crushing Arm", "Cargo Hold")).toBe("Crushing Arm is detached from Cargo Hold");
  });

  it("is the one sentence the preview and the screen reader read, from the engine's own count", () => {
    const made = depthsTable(world, { staging: [CODES.cargoHold, CODES.weatherDeck], grappled: [[CODES.thrashing, CODES.cargoHold], [CODES.crushing, CODES.cargoHold]] });
    const cargo = idOf(made.state, CODES.cargoHold);
    expect(grappleDetail(made.state, cargo)).toBe("Grappled: 2 facedown enemies, +4 Threat");
    expect(grappleTell(made.state, cargo)).toBe(" · Grappled: 2 facedown enemies, +4 Threat");
    expect(grappleTell(made.state, idOf(made.state, CODES.weatherDeck))).toBe("");
    const describe = (code: string) => ({ name: names.code(code), picture: null, landscape: false, text: "", inactive: [] as string[] });
    const shown = previewCards(made.state, made.ctx, cargo, describe as never, (id) => names.code(made.state.cards[id]?.code ?? ""));
    expect(shown.cards).toHaveLength(1);
    expect(shown.cards[0]?.detail).toBe("Grappled: 2 facedown enemies, +4 Threat");
    // The preview never lists the facedown enemies: not by name, not as cards.
    expect(JSON.stringify(shown.cards)).not.toContain("Thrashing");
    expect(effectLines(made.state, made.ctx, cargo, (id) => id).join(" ")).not.toContain("Thrashing");
  });
});
