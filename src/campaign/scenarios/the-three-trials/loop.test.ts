// Rules: rm.current-trial, rr.quest-advancement, rr.victory, rr.objective-cards, rr.active-location (data/rules/entries.json).
// The whole trial loop of The Three Trials on one table, played through the records with no random draw: three trials, each ended by a hero who holds its Key, then The Antlered Crown, which the players win by exploring Hallowed Circle and placing the last progress on it.
// The auto-player's random games all lose (the Guardians' Time effects and attacks kill the stand-in heroes), so this is the test that a win can be reached.
import { describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, moveCard } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { HERO, idOf, resolveRecords, run, send, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-three-trials";
const ASIDE = ["08040", "08041", "08042", "08043", "08044", "08045", "08046", "08047", "08048", "08049"];

describe("08036:B:2 the loop to a win", () => {
  it("08036:B:2 ends each of the three trials when a hero holds its Key, then 08039:B:2 is won with Hallowed Circle in the victory display", () => {
    const t = tableFromLayout(SCENARIO, { stage: "08035", setAside: ASIDE, deck: ["f0", "f0", "f0", "f0", "f0", "f0", "f0", "f0", "f0", "f0", "f0", "f0"], seed: 4 });
    let state: ScenarioState = resolveRecords(t.state, t.ctx, "08035", "whenRevealed", idOf(t.state, "08035"), () => "08036").state;
    const seen: string[] = [];
    for (let trial = 0; trial < 3; trial += 1) {
      const stage = state.cards[state.questStage ?? ""]?.code ?? "";
      seen.push(stage);
      // The current trial's Key is the marked one: a hero takes it (it lies on its Guardian or Barrow, or in the encounter deck at the third trial).
      const key = state.modifiers.find((mod) => mod.stat === "trialKey" && mod.sourceId === state.questStage)?.instanceId ?? "";
      expect(state.cards[key]?.code).toMatch(/^0804[345]$/);
      const held = settle(updateCard(attachTo(moveCard(state, key, { zone: "attached" }), key, idOf(state, HERO)), key, { claimed: true, controller: 0, face: "up" }), t.ctx, []);
      const left = ["08036", "08037", "08038"].filter((code) => !seen.includes(code));
      state = held.window?.kind === "choose" ? send({ state: held, steps: [] }, { type: "Choose", optionId: left[0] ?? "" }, t.ctx).state : held;
    }
    expect(seen.sort()).toEqual(["08036", "08037", "08038"]);
    // Stage 3A: Hallowed Circle is in the staging area and the three Guardians are back, each with the player who holds its Key.
    expect(state.cards[state.questStage ?? ""]?.code).toBe("08039");
    expect(Object.values(state.cards).filter((card) => ["08040", "08041", "08042"].includes(card.code)).map((card) => card.zone)).toEqual(["engaged", "engaged", "engaged"]);
    // The players explore Hallowed Circle (12 quest points); it goes to the victory display and the last progress defeats the stage.
    const circle = idOf(state, "08049");
    const active = { ...moveCard(state, circle, { zone: "activeLocation" }) };
    const explored = run(t, active, { verb: "PlaceQuestProgress", perPlayer: 12 });
    expect(explored.cards[circle]?.zone).toBe("victory");
    const won = run(t, explored, { verb: "PlaceQuestProgress", perPlayer: 1 });
    expect(won.stageCleared).toBe(true);
  });
});
