// Rules: rr.in-play-and-out-of-play, rr.restricted, rr.attachment-cards, rr.shadow-effects, rr.lasting-effects, dwd.cave-torch-the-long-dark (data/rules/entries.json).
// Lines: 901006:A:2, 901007:A:2, 901008:A:3, 03041:A:1. The Into the Pit lines of the audit that a card-spec row cannot show (spec.test.ts holds the rows): a Dark location in the staging area, a duration
// read after its phase ends, the host the Cave Torch may take. Each runs again with the records of its line removed (test/harness/card-spec.ts, withoutLine), where it must not hold.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { attachmentHostIds } from "../../../rules/player/attach.ts";
import { withoutLine } from "../../../../test/harness/card-spec.ts";
import { fightEnemy, finish, idOf, legalIntents, resolveRecords, revealFromTop, send, tableFromLayout, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";

const ID = "into-the-pit";
const TORCH = "03041";
const without = (...lines: string[]): readonly Effect[] => lines.reduce(withoutLine, EFFECTS);
const make = (layout: Layout, effects: readonly Effect[] = EFFECTS): LayoutTable => tableFromLayout(ID, layout, { effects });
const statOf = (made: LayoutTable, state: ScenarioState, code: string, name: "questPoints" | "defense"): number => modifiedStat(state, state.cards[idOf(state, code)]!, name, made.cards);

// The card is revealed from the top of the encounter deck and its choices take their first option.
function revealed(made: LayoutTable, code: string): ScenarioState {
  const steps: EngineStep[] = [];
  return finish({ state: revealFromTop(made.state, made.ctx, code, steps).state, steps }, made.ctx).state;
}

describe("901006 Twisting Shadows", () => {
  // "When Revealed: Remove all progress from each Dark location in play." In play is the staging area too (rr.in-play-and-out-of-play; docs/scenarios/dwarrowdelf.md, Into the Pit: "in play" counts the staging area
  // and the active location). Zigil Mineshaft 03038, a Dark location, holds 2 progress in the staging area (as the Cave Torch's Action leaves it).
  it("901006:A:2 removes all progress from a Dark location in the staging area", () => {
    const layout: Layout = { staging: [{ code: "03038", progress: 2 }], deck: ["f0"] };
    const progress = (effects: readonly Effect[]): number => {
      const state = revealed(make(layout, effects), "901006");
      return state.cards[idOf(state, "03038")]?.progress ?? 0;
    };
    expect(progress(EFFECTS)).toBe(0);
    expect(progress(without("901006:A:2"))).toBe(2);
  });
});

describe("901007 Narrow Fissure", () => {
  // "Each Dark location in play gets +2 quest points." Zigil Mineshaft prints 5 quest points; it waits in the staging area beside the Fissure.
  it("901007:A:2 gives +2 quest points to a Dark location in the staging area", () => {
    const made = make({ staging: ["901007", "03038"] });
    expect(statOf(made, made.state, "03038", "questPoints")).toBe(7);
    const bare = make({ staging: ["901007", "03038"] }, without("901007:A:2"));
    expect(statOf(bare, bare.state, "03038", "questPoints")).toBe(5);
  });
});

describe("901008 Shadow-fall", () => {
  // "Shadow: Attacking enemy gets +3 Defense this phase." f3 prints 1 Defense; the combat phase is passed to its end once the attack is over.
  it("901008:A:3 the +3 Defense holds after the attack and ends with the combat phase", () => {
    const fought = (effects: readonly Effect[]) => fightEnemy((layout: Layout) => make(layout, effects), "901008", "f3", {});
    const run = fought(EFFECTS);
    const made = run.made;
    expect(statOf(made, run.run.state, "f3", "defense")).toBe(4);
    let state = run.run.state;
    for (let guard = 0; guard < 40 && state.phase === "Combat"; guard += 1) {
      const pass = legalIntents(state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack");
      if (!pass) break;
      state = send({ state, steps: [] }, pass as PlayerIntent, made.ctx).state;
    }
    expect(state.phase).not.toBe("Combat");
    expect(statOf(made, state, "f3", "defense")).toBe(1);
    const bare = fought(without("901008:A:3"));
    expect(statOf(bare.made, bare.run.state, "f3", "defense")).toBe(1);
  });
});

describe("03041 Cave Torch", () => {
  // "Attach to a hero. Restricted." The hosts it may take: the first player's heroes, not his ally.
  it("03041:A:1 the Torch may be attached to a hero and not to an ally", () => {
    const hosts = (effects: readonly Effect[]): string[] => {
      const made = make({ play: ["ally"] }, effects);
      return attachmentHostIds(made.state, 0, TORCH, made.ctx).map((id) => made.state.cards[id]?.code ?? id).sort();
    };
    expect(hosts(EFFECTS)).toEqual(["dh1", "dh2"]);
    expect(hosts(without("03041:A:1"))).toContain("ally");
  });

  // Restricted: "Each character cannot have more than 2 attachments with the restricted keyword. If a third restricted attachment is ever attached to a character, one of the restricted attachments must immediately
  // be moved to its owner's discard pile" (rr.restricted). Entering the Mines' Setup (03064:A:1) attaches the Torch to the hero the first player picks: dh1 already carries Celebrían's Stone and Citadel Plate.
  it("03041:A:1 the Torch the Setup attaches is a third restricted attachment, and one of the three leaves the hero", () => {
    const made = tableFromLayout(ID, { deck: ["f0"], attached: [{ code: "01027", to: "dh1" }, { code: "01040", to: "dh1" }] }, { extra: ["01027", "01040"] });
    const dh1 = idOf(made.state, "dh1");
    const run = resolveRecords(made.state, made.ctx, "03064", "setup", undefined, (state) => (state.window?.kind === "choose" ? (state.window.options.includes(dh1) ? dh1 : (state.window.options[0] ?? "")) : ""));
    const restricted = (run.state.cards[dh1]?.attachments ?? []).filter((id) => made.cards.get(run.state.cards[id]?.code ?? "")?.keywords.restricted);
    expect(run.state.cards[idOf(run.state, TORCH)]?.host === dh1 || run.state.cards[idOf(run.state, TORCH)]?.zone === "removed").toBe(true);
    expect(restricted.length).toBe(2);
  });
});
