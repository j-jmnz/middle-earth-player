import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { Instruction } from "../../src/catalog/boundary.ts";
import { instructionSchema } from "../../src/catalog/effect-schema.ts";
import { setupRoleVerbs } from "../../src/catalog/verb-sets.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { runsInFrame } from "../../src/rules/combat/shadow.ts";
import { blankScenario } from "../../src/rules/core/state.ts";
import { fixtureDefinition } from "../../src/rules/core/test-fixture.ts";
import { revealsPerPlayer } from "../../src/rules/families/quest/setup.ts";
import { runInstruction } from "../../src/rules/interpret/interpret.ts";

import { loadCards } from "../data/load-cards.ts";
import { ROOT } from "../data/paths.ts";

// Three places where the engine picks a record's route by its verbs, from a list kept beside the core. A record whose verbs the list does not name takes
// the other route without a word, and the mistake shows only when a game reaches the card: the quest card's Setup is skipped, a Shadow fails with
// "Unimplemented instruction", a campaign card's Setup line is dropped. Each check walks every record of that timing, so a new verb fails here first.
const questCards = new Set(loadCards().filter((card) => card.type === "quest").map((card) => card.code));
const records = (timing: string) => EFFECTS.filter((effect) => effect.timing === timing);

// The verbs a quest card's Setup prints that the scenario's data places instead (src/campaign/start.ts buildStart): the piles of setupInstructions
// (src/catalog/scenario-data.ts SETUP_VERB), the shuffle buildStart appends, the burden deck it deals (src/rules/setup/setup.ts) and the scenario's life.
// A Setup record made only of these needs no run; any other needs revealsPerPlayer.
const PLACED_BY_DATA: ReadonlySet<string> = new Set(["SetAside", "AddToStaging", "MakeActiveLocation", "AttachToRingBearer", "ShuffleEncounterDeck", "ShuffleBurdenDeck", "SetLife"]);

// The verbs of a campaign card's Setup that the start or the checklist reads itself, not by a setup role (src/catalog/verb-flags.ts).
const READ_FROM_CAMPAIGN_SETUP: Readonly<Record<string, string>> = {
  AttachChosen: "src/campaign/checklist.ts",
  AddToHandAfterMulligan: "src/campaign/checklist.ts",
  AddToPool: "src/campaign/checklist.ts",
  ChooseCards: "src/campaign/checklist.ts",
  WaiveThreatPenalty: "src/campaign/checklist.ts",
  RemoveFromEncounterDeckIfLogged: "src/campaign/checklist.ts",
  RemoveFromCavesIfLogged: "src/campaign/checklist.ts",
  SearchBoonAllyToHand: "src/campaign/checklist.ts",
  ShuffleIntoEncounterDeck: "src/campaign/start.ts",
  ShuffleIntoCorsairDeck: "src/campaign/start.ts",
  KeepCampaignCard: "src/rules/families/burden/campaign.ts",
};

const source = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

// The verbs runInstruction does not run: only an effect frame does (src/rules/interpret/effect-frames.ts runItemNow), or nothing does (a constant's marker).
// Found the way src/rules/interpret/family-manifest.test.ts finds a runner: an instruction with no fields, and "Unimplemented instruction" means no runner.
function frameOnlyVerbs(): Set<string> {
  const state = blankScenario({ seatCount: 1, seed: 4, definition: fixtureDefinition(["stage"]) });
  const ctx = { effects: [], cards: new Map() };
  const verbs = instructionSchema.options.map((schema) => schema.shape.verb.value);
  return new Set(
    verbs.filter((verb) => {
      try {
        return runInstruction(state, { verb } as unknown as Instruction, { seat: 0, sourceId: null }, ctx, []).failure === `Unimplemented instruction ${verb}`;
      } catch {
        // Reached the verb's own code.
        return false;
      }
    }),
  );
}

describe("record routes", () => {
  it("runs every quest card's Setup record the scenario's data does not place (families/quest/setup.ts revealsPerPlayer)", () => {
    const skipped = records("setup").filter((effect) => questCards.has(effect.cardCode) && !revealsPerPlayer(effect));
    const unplaced = skipped.flatMap((effect) => effect.instructions.filter((instruction) => !PLACED_BY_DATA.has(instruction.verb)).map((instruction) => `${effect.id}: ${instruction.verb}`));
    expect(unplaced, "a quest card's Setup record that is neither run nor placed: flag its verb `setupRuns` in its family file (src/catalog/verb-flags.ts)").toEqual([]);
  });

  it("runs in a frame every Shadow record with a verb only a frame runs (combat/shadow.ts runsInFrame)", () => {
    const frameOnly = frameOnlyVerbs();
    // The structural verbs are frame-only: the probe would miss nothing if it found them.
    for (const verb of ["Pick", "Choose", "Each", "Repeat"]) expect(frameOnly, verb).toContain(verb);
    const unframed = records("shadow").filter((effect) => !runsInFrame([effect]));
    const failing = unframed.flatMap((effect) => effect.instructions.filter((instruction) => frameOnly.has(instruction.verb)).map((instruction) => `${effect.id}: ${instruction.verb}`));
    expect(failing, "a Shadow record that would fail with \"Unimplemented instruction\": flag its verb `runsInFrame` in its family file (src/catalog/verb-flags.ts)").toEqual([]);
  });

  it("reads every verb of a campaign card's Setup (src/campaign/start.ts, src/campaign/checklist.ts)", () => {
    const roles = new Set([...setupRoleVerbs("dealt"), ...setupRoleVerbs("afterSetup")]);
    const dropped = records("campaignSetup").flatMap((effect) => effect.instructions.filter((instruction) => !roles.has(instruction.verb) && !(instruction.verb in READ_FROM_CAMPAIGN_SETUP)).map((instruction) => `${effect.id}: ${instruction.verb}`));
    expect(dropped, "a campaign Setup verb nothing reads: give its schema entry a setupRole flag, or read it in the start or the checklist").toEqual([]);
    for (const [verb, file] of Object.entries(READ_FROM_CAMPAIGN_SETUP)) expect(source(file), `${verb} in ${file}`).toContain(`"${verb}"`);
  });
});
