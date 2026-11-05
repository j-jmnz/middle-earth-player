// Rules: dcce.grapple, dcce.stormcaller-and-the-thing, rr.the-word-choose (data/rules/entries.json). Every choice a record of The Thing in the Depths asks reads as a sentence on the table, the grapple
// choices of the sheet, and what the table says of the enemies grappled with a location: a count and the Threat they add, never a name.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { AUTHORED_EFFECTS } from "../../effects/authored/the-thing-in-the-depths.ts";
import { RECORDS as DCCE_RECORDS } from "../../effects/authored/pool/DCCE.ts";
import { CODES, depthsTable, idOf, loadDepthsWorld, type DepthsWorld } from "../../../test/scenarios/the-thing-in-the-depths/scene.ts";

import { effectLines } from "../cards/card-effects.ts";
import { pickWords, type ChoiceNames } from "./choice.ts";
import { detachLine, grappleAsk, grappleDetail, grappleLine, grappleOptionLabel, grappleTell, grappledWords } from "./grapple.ts";
import { previewCards } from "../cards/table-preview.ts";
import { walk } from "../../../test/harness/record-walk.ts";

let world: DepthsWorld;

beforeAll(async () => {
  world = await loadDepthsWorld();
});

const names: ChoiceNames = { card: (id) => id, code: (code) => world.cards.get(code)?.name ?? code };
const records: readonly Effect[] = [...AUTHORED_EFFECTS, ...DCCE_RECORDS.filter((effect) => ["11195", "11196"].includes(effect.cardCode))];

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

  it("the grapple choices state the decision first, name the enemy that was faceup as it was revealed and the criterion, and name the character that gains a Trait", () => {
    const named: ChoiceNames = { card: (id) => (id === "i9" ? "Grasping Arm" : id === "i3" ? "Aragorn" : id), code: names.code };
    const tie = grappleAsk({ verb: "ResolveGrapple", card: "i9" }, "12053", named, { rule: "lowestThreat", picked: null });
    expect(tie).toEqual({ verb: "Grapple", prompt: "Grasping Arm grapples with the location with the lowest printed Threat. The locations are tied: choose one. The enemy goes facedown under it." });
    const quest = grappleAsk({ verb: "ResolveGrapple", card: "i9" }, "12052", named, { rule: "highestQuestPoints", picked: null });
    expect(quest?.prompt).toContain("the highest printed quest points");
    const giant = grappleAsk({ verb: "EngageOrGrapple" }, CODES.giant, { card: () => "Giant Arm", code: names.code });
    expect(giant?.prompt).toBe("Giant Arm: put it into play engaged with you and deal it a shadow card, or resolve its Grapple keyword?");
    expect(grappleAsk({ verb: "GainChosenTrait" }, CODES.comeTogether, named, { rule: null, picked: "i3" })?.prompt).toBe(`${CODES.comeTogether}: choose the Trait Aragorn gains until the end of the round.`);
    expect(grappleOptionLabel({ verb: "EngageOrGrapple" }, "engage")).toBe("Put it into play engaged with you, and deal it a shadow card");
    expect(grappleOptionLabel({ verb: "EngageOrGrapple" }, "grapple")).toBe("Resolve its Grapple keyword");
    expect(grappleOptionLabel({ verb: "GainChosenTrait" }, "Noble")).toBe("Noble");
    expect(grappleOptionLabel({ verb: "ShuffleEncounterDeck" }, "x")).toBeNull();
  });

  it("the damage a shadow card or Sea Serpent assigns one at a time says the card, the damage and what is left", () => {
    const assign = { verb: "AssignDamage" as const, amount: 3, pick: { type: "character" as const, control: "you" as const }, left: 2, of: 3 };
    expect(pickWords(assign, undefined, { card: () => "From the Depths", code: names.code }, "i1").prompt).toBe("From the Depths: assign 1 damage to a character you control (2 of 3 left).");
    expect(pickWords({ ...assign, left: 1, of: 1 }, undefined, names, null).prompt).toBe("Assign 1 damage to a character you control.");
  });

  it("the player Come Together is added to is asked in words, and every instruction of the scenario's records that asks a player has some", () => {
    const pick = { verb: "Pick" as const, pick: { type: "player" as const, control: "any" as const } };
    expect(pickWords(pick, { verb: "AddSetAsideToHand", code: CODES.comeTogether }, names, "i1").prompt).toBe(`Choose the player who adds ${names.code(CODES.comeTogether)} to their hand.`);
    let asked = 0;
    for (const effect of records) {
      walk(effect.instructions, (instruction, next) => {
        if (!["Pick", "AssignDamage", "ResolveGrapple", "EngageOrGrapple", "GainChosenTrait", "Choose"].includes(instruction.verb) || instruction.verb === "Choose") return;
        asked += 1;
        const words = grappleAsk(instruction, effect.cardCode, names, { rule: "highestThreat", picked: "x" }) ?? pickWords(instruction, next, names, effect.cardCode);
        expect(words.prompt, effect.id).not.toBe("Choose one.");
        expect(words.prompt, effect.id).toMatch(/\.$|\?$/);
      });
    }
    expect(asked).toBeGreaterThan(12);
  });
});

describe("the enemies grappled with a location", () => {
  it("says how many are facedown under it and how much Threat they add, and nothing when none are", () => {
    expect(grappledWords(0)).toBeNull();
    expect(grappledWords(1)).toBe("Grappled: 1 facedown enemy, +2 Threat");
    expect(grappledWords(3)).toBe("Grappled: 3 facedown enemies, +6 Threat");
    expect(grappleLine("Thrashing Arm", "Cargo Hold")).toBe("Thrashing Arm grapples with Cargo Hold");
    expect(detachLine("Crushing Arm", "Cargo Hold")).toBe("Crushing Arm comes out from under Cargo Hold");
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
