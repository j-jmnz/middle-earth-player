// Rules: dwd.bypassing-a-quest-card, emce.bypassing, rr.first-player (data/rules/entries.json); ledger lines 901201:A:2, 901207:A:1, 03072:B:2.
// The sheets of Flight from Moria's choices that are not in its asks file: the bypass of a stage says the threat each player first pays (Shadowed Corridor) and the shuffle in place of the bottom of the quest deck (the Nightmare setup card), and Blocked by Shadow's choice says its two branches.
import { describe, expect, it } from "vitest";

import { settle } from "../../rules/engine/machine.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import type { EngineStep } from "../../rules/core/intents.ts";
import { fireForced } from "../../rules/windows/triggers.ts";
import { stageName } from "../../rules/families/wilderland/gundabad.ts";
import { send, start, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { momentOf } from "../store/outcome.ts";
import { flipsAtStaging, stageArrivalNote } from "../words/scenarios/gundabad-beats.ts";
import { sheetFor } from "./sheets.ts";

// The sheet open at the end of the combat phase, when the first player is asked whether to bypass.
function openBypass(layout: Layout) {
  const made = tableFromLayout("flight-from-moria", { stage: "03072", progress: 2, phase: "Combat", ...layout });
  const steps: EngineStep[] = [];
  const state = settle(fireForced({ ...made.state, window: null }, { trigger: "endOfPhase", seat: 0, phase: "Combat" }, made.ctx, steps), made.ctx, steps);
  const nameOf = (code: string) => made.cards.get(code)?.name ?? code;
  const names = { card: (id: string) => nameOf(state.cards[id]?.code ?? id), line: () => null, stageName: (id: string) => stageName(state, made.ctx, id, nameOf(state.cards[id]?.code ?? id)), mustBypass: () => null };
  return { made, state, names };
}

function bypassSheet(layout: Layout) {
  const { made, state, names } = openBypass(layout);
  const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
  if (sheet?.kind !== "pick") throw new Error(`no pick sheet: ${JSON.stringify(state.window)}`);
  return sheet;
}

describe("the bypass sheet of Flight from Moria (03072:B:2)", () => {
  it("03072:B:2 says the bottom of the quest deck and no cost on Normal", () => {
    const sheet = bypassSheet({});
    expect(sheet.note).toContain("It loses its 2 progress and goes to the bottom of the quest deck.");
    expect(sheet.note).not.toContain("raises their threat");
    expect(sheet.options.map((option) => option.label)).toEqual(["Bypass the stage: lose 2 progress, go to the bottom of the quest deck", "Stay on the stage: keep 2 progress"]);
  });

  it("901207:A:1 says the threat each player pays first, once for each copy in play", () => {
    const sheet = bypassSheet({ staging: ["901207", "901207"] });
    expect(sheet.note).toContain("Each player first raises their threat by 4.");
    expect(sheet.options[0]?.label).toBe("Bypass the stage: raise your threat by 4, lose 2 progress, go to the bottom of the quest deck");
  });

  it("901201:A:2 says the stage is shuffled into the quest deck and can come straight back", () => {
    const sheet = bypassSheet({ nightmare: "901201" });
    expect(sheet.note).toContain("loses its 2 progress and is shuffled into the quest deck.");
    expect(sheet.note).toContain("which can come straight back");
    expect(sheet.options[0]?.label).toBe("Bypass the stage: lose 2 progress, shuffle it into the quest deck");
  });
});

describe("the banner beats of Flight from Moria (dwd.creating-the-quest-deck, 901201:A:2)", () => {
  function bypassMoment(layout: Layout) {
    const { made, state, names } = openBypass(layout);
    const bypassed = send(start(state), { type: "Choose", optionId: "bypass" }, made.ctx);
    return momentOf(state, bypassed.state, bypassed.steps, { ...names, atStaging: (id) => flipsAtStaging(made.ctx, bypassed.state.cards[id]?.code ?? "") });
  }

  it("a bypassed stage goes to the bottom of the quest deck on Normal and arrives side A until the staging step", () => {
    const moment = bypassMoment({});
    expect(moment?.lines.map((line) => line.text)).toContain("The stage goes to the bottom of the quest deck. It is not defeated, so it is not added to the victory display.");
    expect(moment?.lines.map((line) => line.text)).toContain("It stays side A up until the staging step of the quest phase begins; its side B text works from then.");
  });

  it("901201:A:2 a bypassed stage is shuffled into the quest deck, not put at the bottom", () => {
    const text = bypassMoment({ nightmare: "901201" })?.lines.map((line) => line.text).join(" ") ?? "";
    expect(text).toContain("The stage is shuffled into the quest deck, which is shuffled. It is not defeated");
    expect(text).not.toContain("bottom of the quest deck");
  });

  it("a stage's flip is told at the staging step, and Mount Gundabad's stays the quest phase", () => {
    const made = tableFromLayout("flight-from-moria", { stage: "03072", progress: 0, phase: "Quest" });
    expect(flipsAtStaging(made.ctx, "03072")).toBe(true);
    expect(stageArrivalNote({ ...made.state, cards: { ...made.state.cards, x: { ...made.state.cards[made.state.questStage ?? ""]!, face: "A" } } }, "x", true)).toContain("staging step");
    expect(flipsAtStaging(made.ctx, "19135")).toBe(false);
  });
});
