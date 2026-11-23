// Rules: hob.riddle-area, rr.quest-advancement, faq.progress-without-advancing, rr.immune, mec109.immune-to-player-card-effects (data/rules/entries.json); ledger lines 131029:B:1, 131030:B:1, 131030:B:2, 131030:B:3, 131031:B:1, 131031:B:2, 131031:B:3, 131078:A:4. Stage 1 and stage 2 side by side, the advance to stage 3, and what the riddle area does to its cards.
import { describe, expect, it } from "vitest";

import { settle } from "../../engine/machine.ts";
import { constantInstructions } from "../../interpret/constant-records.ts";
import { holds } from "../../interpret/conditions.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { flagged, updateCard, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { codesIn, idOf } from "../../../../test/harness/scene-kit.ts";
import { revealAnswering, riddleTable, stacked, type RiddleTable } from "./fixture.ts";
import { canDefend } from "../../combat/combat.ts";

const withProgress = (state: ScenarioState, code: string, progress: number): ScenarioState => updateCard(state, idOf(state, code), { progress });
const quiet = (made: RiddleTable, state: ScenarioState): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, made.ctx, []);

describe("both stages complete (131029:B:1, 131030:B:1)", () => {
  it("holds the first stage back while the second is not complete, and keeps the progress above its quest points", () => {
    const made = riddleTable();
    const full = quiet(made, withProgress(made.state, "131029", 17));
    expect(full.questStage).toBe(idOf(full, "131029"));
    expect(full.cards[idOf(full, "131029")]?.progress).toBe(17);
    expect(restricted(full, made.ctx, "advance").map((rule) => rule.sourceId)).toContain(idOf(full, "131029"));
    expect(holds(full, { kind: "riddle", is: "complete" }, { actor: 0, sourceId: null, returned: 0 }, made.ctx)).toBe(false);
  });

  it("advances to stage 3 as soon as the second stage is complete, whichever was complete first", () => {
    const made = riddleTable();
    const first = quiet(made, withProgress(made.state, "131029", 14));
    expect(first.questStage).toBe(idOf(first, "131029"));
    const both = quiet(made, withProgress(first, "131030", 9));
    expect(both.questStage).toBe(idOf(both, "131031"));
    const other = quiet(made, withProgress(made.state, "131030", 9));
    expect(other.questStage).toBe(idOf(other, "131029"));
    expect(quiet(made, withProgress(other, "131029", 14)).questStage).toBe(idOf(both, "131031"));
  });

  it("does not win the game when stage 1 is complete: the quest goes on to stage 3, past stage 2", () => {
    const made = riddleTable();
    const both = quiet(made, withProgress(withProgress(made.state, "131029", 14), "131030", 9));
    expect(both.stageCleared).toBe(false);
    expect(both.cards[idOf(both, "131031")]?.zone).toBe("questStage");
  });
});

describe("stage 3 (131031:B:1, B:2, B:3; 131078:A:4)", () => {
  const stage3 = () => {
    const made = riddleTable();
    const state = quiet(made, withProgress(withProgress(made.state, "131029", 14), "131030", 9));
    return { made, state };
  };

  it("removes stage 2 and Lake in the Cavern, and Gollum engages the first player with the Ring still on Bilbo", () => {
    const { made, state } = stage3();
    expect(codesIn(state, "riddleArea")).toEqual([]);
    expect(state.cards[idOf(state, "131030")]?.zone).toBe("removed");
    expect(state.cards[idOf(state, "131078")]?.zone).toBe("removed");
    const gollum = state.cards[idOf(state, "131074")];
    expect(gollum?.zone).toBe("engaged");
    expect(gollum?.controller).toBe(state.firstPlayer);
    expect(state.cards[idOf(state, "131079")]?.host).toBe(made.bilbo);
  });

  it("reveals 1 encounter card per player and lets Bilbo go back to his limits: nothing is flagged on him", () => {
    const { made, state } = stage3();
    expect(flagged(state, made.bilbo, "cannotQuest")).toBe(false);
    expect(flagged(state, made.bilbo, "cannotAttack")).toBe(false);
  });

  it("makes riddles be ignored, treachery cards gain surge and sends Gollum's undefended damage to Bilbo", () => {
    const { made, state } = stage3();
    const verbs = constantInstructions(state, made.ctx).map(({ instruction }) => instruction.verb);
    expect(verbs).toContain("IgnoreRiddles");
    expect(verbs).toContain("TreacheriesGainSurge");
    expect(flagged(state, "table", "gollumDamageToBilbo")).toBe(true);
  });
});

describe("the riddle area (131030:B:2, B:3)", () => {
  it("makes its cards immune to player card effects and lists them for a pick", () => {
    const made = riddleTable();
    const spec = { type: "card", control: "any", riddleArea: true } as const;
    const area = pickCandidates(made.state, spec, 0, [], idOf(made.state, "131029"), made.ctx);
    expect(area.map((id) => made.state.cards[id]?.code).sort()).toEqual(["131001", "131030", "131074", "131079"]);
    for (const id of area) expect(flagged(made.state, id, "immuneToPlayerCards"), made.state.cards[id]?.code).toBe(true);
    // A player card's effect picks none of them.
    const played = spawn(made.state, "event", { zone: "hand", seat: 0 });
    expect(pickCandidates(played.state, spec, 0, [], played.id, made.ctx)).toEqual([]);
  });

  it("stops Bilbo from questing, attacking and taking attachments the players play", () => {
    const made = riddleTable();
    for (const stat of ["cannotQuest", "cannotAttack", "noPlayerAttachments"] as const) expect(flagged(made.state, made.bilbo, stat), stat).toBe(true);
    expect(flagged(made.state, idOf(made.state, "131074"), "cannotQuest")).toBe(false);
  });

  it("leaves the quest stage the first stage and the staging area free of Gollum", () => {
    const made = riddleTable();
    expect(made.state.questStage).toBe(idOf(made.state, "131029"));
    expect(made.state.staging.map((id) => made.state.cards[id]?.code)).toEqual(["131078"]);
  });
});

describe("stage 3's reveals and the rest of the riddle area's rules", () => {
  it("ignores riddles at stage 3: a riddle card revealed from the encounter deck gives the first player no choice", () => {
    const made = riddleTable();
    const state = quiet(made, withProgress(withProgress(made.state, "131029", 14), "131030", 9));
    const run = revealAnswering(state, made.ctx, "131076", []);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[idOf(run.state, "131076")]?.zone).toBe("staging");
  });

  it("gives a treachery revealed from the encounter deck surge at stage 3 and not before", () => {
    const made = riddleTable({ deck: ["131074", "131079", "f3", "f3", "f3"] });
    const before = revealAnswering(stacked(made.state, ["treachery", "f3"]), made.ctx, "treachery", []);
    expect(before.state.staging.map((id) => before.state.cards[id]?.code)).not.toContain("f3");
    const stage3 = quiet(made, withProgress(withProgress(made.state, "131029", 14), "131030", 9));
    const staged = (state: ScenarioState): number => state.staging.filter((id) => state.cards[id]?.code === "f3").length;
    const after = revealAnswering(stage3, made.ctx, "treachery", []);
    expect(staged(after.state)).toBe(staged(stage3) + 1);
  });

  it("lets Bilbo defend only against Gollum while he is in the riddle area", () => {
    const made = riddleTable({ engaged: ["f0"] });
    const attacked = { ...made.state, pendingAttack: { enemyId: idOf(made.state, "f0"), seat: 0 } };
    expect(canDefend(attacked, 0, made.bilbo, made.ctx.cards)).toBe(false);
    const gollum = { ...made.state, pendingAttack: { enemyId: idOf(made.state, "131074"), seat: 0 } };
    expect(canDefend(gollum, 0, made.bilbo, made.ctx.cards)).toBe(true);
    expect(canDefend(gollum, 0, made.hero, made.ctx.cards)).toBe(false);
    const stage3 = quiet(made, withProgress(withProgress(made.state, "131029", 14), "131030", 9));
    expect(canDefend({ ...stage3, pendingAttack: { enemyId: idOf(stage3, "f0"), seat: 0 } }, 0, made.bilbo, made.ctx.cards)).toBe(true);
  });
});
