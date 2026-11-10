// Rules: emce.side-quests-in-play, rr.first-player (data/rules/entries.json); ledger lines 19067:A:2, 19075:A:1, 19076:A:1, 19083:B:1.
// The words of Fire in the Night's choices: the sentence over a Choose and the rows of its options.
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import { MAIN_QUEST } from "../../../rules/families/wilderland/night.ts";
import type { ReduceContext } from "../../../rules/interpret/interpret.ts";
import { CODES, loadNightWorld, nightTable, type NightWorld } from "../../../../test/scenarios/fire-in-the-night/scene.ts";
import type { ChoiceNames } from "../choice.ts";
import { nightAsk, nightBranchWords, nightChooseNote } from "./night.ts";

let world: NightWorld;
beforeAll(async () => {
  world = await loadNightWorld();
}, 120_000);

type Choose = Extract<Instruction, { verb: "Choose" }>;
const recordChoose = (ctx: ReduceContext, code: string, timing: string): Choose => ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing).flatMap((effect) => effect.instructions).flatMap((step) => (step.verb === "ForEachPlayer" ? step.instructions : [step])).find((step): step is Choose => step.verb === "Choose")!;
const names: ChoiceNames = { card: (id) => (id === "i-draw" ? "Draw Her Fire" : id), code: (code) => world.cards.get(code)?.name ?? code };
const withWindow = (seats: 1 | 2, seat: number) => {
  const t = nightTable(world, { seats });
  return { ...t, game: { ...t.state, window: { kind: "choose" as const, seat, options: [], cardIds: [] } as never } };
};
// The question the engine builds at the beginning of the quest phase (families/wilderland/night.ts askCurrentQuest): the main quest, and a side quest each.
const CURRENT: Choose = { verb: "Choose", who: "firstPlayer", options: [{ id: MAIN_QUEST, instructions: [] }, { id: "i-draw", instructions: [{ verb: "MakeCurrentQuest", card: "i-draw" }] }] };
const MANY: Choose = { ...CURRENT, options: [...CURRENT.options, { id: "i-two", instructions: [{ verb: "MakeCurrentQuest", card: "i-two" }] }] };

describe("the words of Fire in the Night", () => {
  it("emce.side-quests-in-play the first player's question at the beginning of the quest phase names the side quests and what each does; two-handed it leads with the player", () => {
    const solo = withWindow(1, 0);
    expect(nightChooseNote(CURRENT, solo.game, solo.ctx, names)).toBe("Make the side quest in the staging area the current quest until the end of the phase, or keep Hrogar's Hill? Progress goes on the active location first, then on the current quest instead of Hrogar's Hill. Progress beyond its quest points is discarded.");
    const pair = withWindow(2, 0);
    expect(nightChooseNote(MANY, pair.game, pair.ctx, names)?.startsWith("Player 1: make 1 of the 2 side quests in the staging area the current quest until the end of the phase, or keep Hrogar's Hill?")).toBe(true);
    expect(nightBranchWords(CURRENT, MAIN_QUEST, names)).toBe("Keep Hrogar's Hill as the current quest");
    expect(nightBranchWords(CURRENT, "i-draw", names)).toBe("Make Draw Her Fire the current quest");
  });

  it("19075:A:1 The Dragon's Thrall's question says what each choice does to the player who was engaged", () => {
    const t = withWindow(2, 1);
    const choose = recordChoose(t.ctx, CODES.theDragonSThrall, "forced");
    expect(nightChooseNote(choose, t.game, t.ctx, names, "The Dragon's Thrall")).toBe("Player 2: The Dragon's Thrall has engaged you. Deal 3 damage to Hrogar's Hill, or it makes an immediate attack against you (Attack 3)?");
    expect(nightBranchWords(choose, "hill", names)).toBe("Deal 3 damage to Hrogar's Hill");
    expect(nightBranchWords(choose, "attack", names, "The Dragon's Thrall")).toBe("The Dragon's Thrall makes an immediate attack against you");
  });

  it("19076:A:1 Orc of the Flame's question is the first player's", () => {
    const t = withWindow(2, 0);
    const choose = recordChoose(t.ctx, CODES.orcOfTheFlame, "whenRevealed");
    expect(nightChooseNote(choose, t.game, t.ctx, names, "Orc of the Flame")).toBe("Player 1, Orc of the Flame: deal 2 damage to a hero you control, or 3 damage to Hrogar's Hill?");
    expect(nightBranchWords(choose, "hero", names)).toBe("Deal 2 damage to a hero you control");
    expect(nightBranchWords(choose, "hill", names)).toBe("Deal 3 damage to Hrogar's Hill");
  });

  it("19067:A:2 Fortify the Defense asks each player in turn, naming the number of cards", () => {
    const solo = withWindow(1, 0);
    const choose = recordChoose(solo.ctx, CODES.fortifyTheDefense, "response");
    expect(nightChooseNote(choose, solo.game, solo.ctx, names, "Fortify the Defense")).toBe("Fortify the Defense is defeated. Draw 3 cards, or each hero you control gains 1 resource?");
    const pair = withWindow(2, 1);
    expect(nightChooseNote(choose, pair.game, pair.ctx, names)?.startsWith("Player 2: ")).toBe(true);
    expect(nightBranchWords(choose, "draw", names)).toBe("Draw 3 cards");
    expect(nightBranchWords(choose, "resources", names)).toBe("Each hero you control gains 1 resource");
  });

  it("19083:B:1 the enemy that attacks Hrogar's Hill is asked about with its words, naming the picked enemy and not Hrogar's Hill, the source", () => {
    const t = withWindow(2, 0);
    const stage = t.ctx.effects.filter((effect) => effect.cardCode === CODES.stage1 && effect.timing === "forced").flatMap((effect) => effect.instructions);
    const at = stage.findIndex((step) => step.verb === "Pick");
    const asked = nightAsk(stage[at]!, "Hrogar's Hill", names, stage[at + 1], { game: t.game, ctx: t.ctx, options: ["Dagnir"] });
    expect(asked?.verb).toBe("Attack");
    expect(asked?.prompt).toBe("Player 1: choose the enemy that attacks Hrogar's Hill (Dagnir). You may then declare a defender. The damage left undefended, and the damage beyond a defender's hit points, is dealt to Hrogar's Hill.");
    expect(nightAsk(stage[at]!, null, names, stage[at + 1], { game: t.game, ctx: t.ctx, options: ["a", "b"] })?.prompt).not.toContain("(");
    expect(nightAsk(stage[at]!, null, names, undefined, undefined)).toBeNull();
  });

  it("a choice of another scenario has no words here", () => {
    const t = withWindow(1, 0);
    const other: Choose = { verb: "Choose", who: "actor", options: [{ id: "a", instructions: [] }, { id: "b", instructions: [] }] };
    expect(nightChooseNote(other, t.game, t.ctx, names)).toBeNull();
    expect(nightBranchWords(other, "a", names)).toBeNull();
  });
});
